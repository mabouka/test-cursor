import * as THREE from 'three';

(async () => {
  // ── LOCATIONS ─────────────────────────────────────────────────────────────
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
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width  = W;
  canvas.height = H;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
  // shifted left so globe sits right, z increased ~25% → globe 20% smaller
  camera.position.set(-0.55, 0, 3.75);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 2.5));
  const key = new THREE.DirectionalLight(0xffffff, 0.35);
  key.position.set(4, 2, 5);
  scene.add(key);

  // ── GLOBE SPHERE (solid dark) ──────────────────────────────────────────────
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(1, 80, 80),
    new THREE.MeshPhongMaterial({ color: 0x1c1c1c, specular: 0x050505, shininess: 4 })
  );
  scene.add(globe);

  // Subtle edge atmosphere
  const atmosMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.035, 64, 64),
    new THREE.MeshPhongMaterial({ color: 0x555555, transparent: true, opacity: 0.06, side: THREE.BackSide })
  );
  scene.add(atmosMesh);

  // ── COORDINATE HELPER ─────────────────────────────────────────────────────
  function ll3d(lon, lat, r = 1.001) {
    const phi   = (90 - lat)  * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
       r * Math.cos(phi),
       r * Math.sin(phi) * Math.sin(theta)
    );
  }

  // ── CONTINENT COASTLINES (no country borders) ─────────────────────────────
  const borderMat = new THREE.LineBasicMaterial({ color: 0xd0d0d0, transparent: true, opacity: 0.75 });

  const rings = await fetch('/world-borders.json').then(r => r.json());
  for (const ring of rings) {
    const pts = ring.map(([lon, lat]) => ll3d(lon, lat, 1.0015));
    if (pts.length < 2) continue;
    globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), borderMat));
  }

  // ── LOCATION MARKERS ──────────────────────────────────────────────────────
  const dotGeo = new THREE.SphereGeometry(0.020, 12, 12);
  const markerObjects = [];

  LOCATIONS.forEach(loc => {
    const pos = ll3d(loc.lng, loc.lat, 1.018);
    const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xc4856a }));
    dot.position.copy(pos);
    globe.add(dot);
    markerObjects.push({ dot, loc });
  });

  // ── DRAG + AUTO-ROTATE ────────────────────────────────────────────────────
  let rotY = -1.83, rotX = 0.60;
  let isDragging = false, prev = { x: 0, y: 0 };
  let autoRotate = true, idleTimer = null;

  canvas.addEventListener('mousedown', e => {
    isDragging = true; autoRotate = false;
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
    isDragging = true; autoRotate = false;
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
  const raycaster = new THREE.Raycaster();
  const mouse2d   = new THREE.Vector2();

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse2d.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse2d.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse2d, camera);
    const dots = markerObjects.map(m => m.dot);
    const hits  = raycaster.intersectObjects(dots);
    if (hits.length) {
      const loc = markerObjects[dots.indexOf(hits[0].object)].loc;
      tooltip.textContent = loc.name;
      tooltip.style.opacity = '1';
      const rx = ((e.clientX - rect.left) / rect.width)  * 100;
      const ry = ((e.clientY - rect.top)  / rect.height) * 100;
      tooltip.style.left = `${rx}%`;
      tooltip.style.top  = `${ry}%`;
      tooltip.style.transform = 'translate(14px, -50%)';
    } else {
      tooltip.style.opacity = '0';
    }
  });
  canvas.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });

  // ── RESIZE ────────────────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // ── RENDER LOOP ───────────────────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    if (autoRotate) rotY += 0.0015;
    globe.rotation.set(rotX, rotY, 0);
    renderer.render(scene, camera);
  }
  animate();
})();
