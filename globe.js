import * as THREE from 'three';

(async () => {
  // ── LOCATIONS ─────────────────────────────────────────────────────────────
  const LOCATIONS = [
    { name: 'Istanbul',   lat: 41.01, lng: 28.95 },
    { name: 'London',     lat: 51.51, lng: -0.13 },
    { name: 'Amsterdam',  lat: 52.37, lng:  4.89 },
    { name: 'Berlin',     lat: 52.52, lng: 13.40 },
    { name: 'Warsaw',     lat: 52.23, lng: 21.01 },
    { name: 'Budapest',   lat: 47.50, lng: 19.04 },
    { name: 'Bucharest',  lat: 44.43, lng: 26.10 },
    { name: 'Sofia',      lat: 42.70, lng: 23.32 },
    { name: 'Belgrade',   lat: 44.80, lng: 20.46 },
    { name: 'Athens',     lat: 37.98, lng: 23.73 },
    { name: 'Kyiv',       lat: 50.45, lng: 30.52 },
    { name: 'Moscow',     lat: 55.75, lng: 37.62 },
    { name: 'Baku',       lat: 40.41, lng: 49.87 },
    { name: 'Dubai',      lat: 25.20, lng: 55.27 },
    { name: 'Tel Aviv',   lat: 32.09, lng: 34.79 },
    { name: 'Tbilisi',    lat: 41.69, lng: 44.83 },
  ];

  // ── SCENE ──────────────────────────────────────────────────────────────────
  const canvas  = document.getElementById('globe-canvas');
  const tooltip = document.getElementById('globe-tooltip');
  const SIZE = 900;
  canvas.width  = SIZE;
  canvas.height = SIZE;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(SIZE, SIZE);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 3.0);

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

  // ── GRID LINES ─────────────────────────────────────────────────────────────
  const gridMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 });

  // Longitude lines
  for (let lon = -180; lon < 180; lon += 20) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 2) pts.push(ll3d(lon, lat));
    globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
  }
  // Latitude lines
  for (let lat = -80; lat <= 80; lat += 20) {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 2) pts.push(ll3d(lon, lat));
    globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
  }

  // ── COUNTRY BORDERS from real Natural Earth 50m data ──────────────────────
  const borderMat = new THREE.LineBasicMaterial({ color: 0xd0d0d0, transparent: true, opacity: 0.75 });

  const rings = await fetch('/world-borders.json').then(r => r.json());
  for (const ring of rings) {
    const pts = ring.map(([lon, lat]) => ll3d(lon, lat, 1.0015));
    if (pts.length < 2) continue;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    globe.add(new THREE.Line(geo, borderMat));
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

  // ── RENDER LOOP ───────────────────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    if (autoRotate) rotY += 0.0015;
    globe.rotation.set(rotX, rotY, 0);
    renderer.render(scene, camera);
  }
  animate();
})();
