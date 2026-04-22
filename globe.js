import * as THREE from 'three';

(async () => {
  const LOCATIONS = [
    { name: 'Tarifa',          lat:  36.01, lng:   -5.60 },
    { name: 'Bruxelles',       lat:  50.85, lng:    4.35 },
    { name: 'Tatajuba, Ceará', lat:  -2.85, lng:  -40.25 },
    { name: 'Phan Rang',       lat:  11.57, lng:  108.99 },
    { name: 'Maui',            lat:  20.80, lng: -156.33 },
  ];

  // ── SCENE ──────────────────────────────────────────────────────────────────
  const canvas  = document.getElementById('globe-canvas');
  const tooltip = document.getElementById('globe-tooltip');
  const S = window.innerHeight;
  canvas.width = canvas.height = S;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(S, S);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.15, 2.6);
  camera.lookAt(0, 0, 0);

  // Subtle top light
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));
  const keyLight = new THREE.DirectionalLight(0x8899bb, 1.2);
  keyLight.position.set(2, 4, 3);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x223344, 0.8);
  rimLight.position.set(-3, -1, -3);
  scene.add(rimLight);

  // ── DARK SPHERE ────────────────────────────────────────────────────────────
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(1, 80, 80),
    new THREE.MeshPhongMaterial({
      color:    0x0c0c0e,
      emissive: 0x08080c,
      specular: 0x1a2030,
      shininess: 12,
    })
  );
  scene.add(globe);

  // ── ATMOSPHERE HALO ────────────────────────────────────────────────────────
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(1.055, 64, 64),
    new THREE.MeshPhongMaterial({
      color: 0x1a2035,
      transparent: true,
      opacity: 0.28,
      side: THREE.BackSide,
    })
  ));
  // second, tighter glow ring
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(1.022, 64, 64),
    new THREE.MeshPhongMaterial({
      color: 0x2a3555,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    })
  ));

  // ── COORDINATE HELPER ─────────────────────────────────────────────────────
  function ll3d(lon, lat, r = 1.002) {
    const phi   = (90 - lat)  * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
       r * Math.cos(phi),
       r * Math.sin(phi) * Math.sin(theta)
    );
  }

  // ── LAND DETECTION (rasterise world-borders onto canvas) ──────────────────
  const rings = await fetch('/world-borders.json').then(r => r.json());

  const LW = 2048, LH = 1024;
  const landCanvas = document.createElement('canvas');
  landCanvas.width = LW; landCanvas.height = LH;
  const lctx = landCanvas.getContext('2d');
  lctx.fillStyle = '#000';
  lctx.fillRect(0, 0, LW, LH);
  lctx.fillStyle = '#fff';
  for (const ring of rings) {
    lctx.beginPath();
    ring.forEach(([lon, lat], i) => {
      const x = (lon + 180) / 360 * LW;
      const y = (90 - lat)  / 180 * LH;
      i === 0 ? lctx.moveTo(x, y) : lctx.lineTo(x, y);
    });
    lctx.closePath();
    lctx.fill();
  }
  const pixels = lctx.getImageData(0, 0, LW, LH).data;

  function isLand(lon, lat) {
    const x = Math.min(LW - 1, Math.max(0, Math.round((lon + 180) / 360 * LW)));
    const y = Math.min(LH - 1, Math.max(0, Math.round((90 - lat)  / 180 * LH)));
    return pixels[(y * LW + x) * 4] > 128;
  }

  // ── DOTTED CONTINENT GRID (InstancedMesh) ─────────────────────────────────
  const STEP = 1.6;
  const landPts = [];
  for (let lat = -80; lat <= 80; lat += STEP) {
    // slightly reduce longitude step near equator so dots look uniform in size
    const lonStep = STEP / Math.cos(lat * Math.PI / 180) * 0.85;
    for (let lon = -180; lon < 180; lon += Math.min(lonStep, STEP * 2)) {
      if (isLand(lon, lat)) landPts.push(ll3d(lon, lat, 1.004));
    }
  }

  const dotGeo  = new THREE.SphereGeometry(0.0068, 5, 5);
  const dotMat  = new THREE.MeshBasicMaterial({ color: 0xa8b8c8 });
  const dotMesh = new THREE.InstancedMesh(dotGeo, dotMat, landPts.length);
  const dummy   = new THREE.Object3D();
  landPts.forEach((pos, i) => {
    dummy.position.copy(pos);
    dummy.updateMatrix();
    dotMesh.setMatrixAt(i, dummy.matrix);
  });
  dotMesh.instanceMatrix.needsUpdate = true;
  globe.add(dotMesh);

  // ── LOCATION MARKERS ──────────────────────────────────────────────────────
  const markerGeo = new THREE.SphereGeometry(0.022, 12, 12);
  const markerObjects = [];
  LOCATIONS.forEach(loc => {
    const pos = ll3d(loc.lng, loc.lat, 1.014);
    const dot = new THREE.Mesh(
      markerGeo,
      new THREE.MeshBasicMaterial({ color: 0xff3d00 })
    );
    dot.position.copy(pos);
    globe.add(dot);
    markerObjects.push({ dot, loc });
  });

  // ── INTERACTION ───────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const mouse2d   = new THREE.Vector2();

  let rotY = -1.83, rotX = 0.60;
  let isDragging = false, prev = { x: 0, y: 0 };
  let autoRotate = true, idleTimer = null;
  let targetX = null, targetY = null;

  function centerOn(lat, lng) {
    autoRotate = false;
    clearTimeout(idleTimer);
    targetX = lat  * Math.PI / 180;
    targetY = Math.PI / 2 - (lng + 180) * Math.PI / 180;
    idleTimer = setTimeout(() => { autoRotate = true; }, 4000);
  }

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    mouse2d.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse2d.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse2d, camera);
    const hits = raycaster.intersectObjects(markerObjects.map(m => m.dot));
    if (hits.length) {
      const loc = markerObjects[markerObjects.map(m => m.dot).indexOf(hits[0].object)].loc;
      centerOn(loc.lat, loc.lng);
    }
  });

  canvas.addEventListener('mousedown', e => {
    isDragging = true; autoRotate = false; targetX = null; targetY = null;
    clearTimeout(idleTimer); prev = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('mouseup', () => {
    if (!isDragging) return; isDragging = false;
    idleTimer = setTimeout(() => { autoRotate = true; }, 3000);
  });
  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    rotY += (e.clientX - prev.x) * 0.005;
    rotX += (e.clientY - prev.y) * 0.005;
    rotX = Math.max(-1.1, Math.min(1.1, rotX));
    prev = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('touchstart', e => {
    isDragging = true; autoRotate = false; targetX = null; targetY = null;
    clearTimeout(idleTimer); prev = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  window.addEventListener('touchend', () => {
    if (!isDragging) return; isDragging = false;
    idleTimer = setTimeout(() => { autoRotate = true; }, 3000);
  });
  window.addEventListener('touchmove', e => {
    if (!isDragging) return;
    rotY += (e.touches[0].clientX - prev.x) * 0.005;
    rotX += (e.touches[0].clientY - prev.y) * 0.005;
    rotX = Math.max(-1.1, Math.min(1.1, rotX));
    prev = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });

  // ── TOOLTIP ───────────────────────────────────────────────────────────────
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse2d.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse2d.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse2d, camera);
    const hits = raycaster.intersectObjects(markerObjects.map(m => m.dot));
    if (hits.length) {
      const loc = markerObjects[markerObjects.map(m => m.dot).indexOf(hits[0].object)].loc;
      tooltip.textContent = loc.name;
      tooltip.style.opacity = '1';
      const rx = ((e.clientX - rect.left) / rect.width)  * 100;
      const ry = ((e.clientY - rect.top)  / rect.height) * 100;
      tooltip.style.left = `${rx}%`;
      tooltip.style.top  = `${ry}%`;
      tooltip.style.transform = 'translate(14px, -50%)';
      canvas.style.cursor = 'pointer';
    } else {
      tooltip.style.opacity = '0';
      canvas.style.cursor = isDragging ? 'grabbing' : 'grab';
    }
  });
  canvas.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });

  // ── RESIZE ────────────────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    const s = window.innerHeight;
    renderer.setSize(s, s);
  });

  // ── RENDER LOOP ───────────────────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    if (targetX !== null) {
      rotX += (targetX - rotX) * 0.05;
      rotY += (targetY - rotY) * 0.05;
      if (Math.abs(targetX - rotX) < 0.001 && Math.abs(targetY - rotY) < 0.001) {
        rotX = targetX; rotY = targetY; targetX = null; targetY = null;
      }
    } else if (autoRotate) {
      rotY += 0.0015;
    }
    globe.rotation.set(rotX, rotY, 0);
    renderer.render(scene, camera);
  }
  animate();
})();
