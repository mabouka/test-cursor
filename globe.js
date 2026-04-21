import * as THREE from 'three';
(() => {
  // ── LOCATIONS (Europe / Turkey / Middle East focus) ──────────────────────────
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
    { name: 'Tbilisi',   lat: 41.69, lng: 44.83 },
  ];

  // ── SCENE ────────────────────────────────────────────────────────────────────
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

  // Minimal lighting — most visual info lives in the texture
  scene.add(new THREE.AmbientLight(0xffffff, 2.4));
  const key = new THREE.DirectionalLight(0xffffff, 0.4);
  key.position.set(4, 2, 5);
  scene.add(key);

  // ── CANVAS TEXTURE ───────────────────────────────────────────────────────────
  const TW = 4096, TH = 2048;
  const texCanvas = document.createElement('canvas');
  texCanvas.width  = TW;
  texCanvas.height = TH;
  const tc = texCanvas.getContext('2d');

  // Equirectangular lon/lat → pixel
  function px(lon, lat) {
    return [(lon + 180) / 360 * TW, (90 - lat) / 180 * TH];
  }

  // ── Ocean fill (near-black) ─────────────────────────────────────────
  tc.fillStyle = '#161616';
  tc.fillRect(0, 0, TW, TH);

  // ── Continent drawing helper ────────────────────────────────────────
  function land(pts) {
    tc.beginPath();
    tc.moveTo(...px(...pts[0]));
    for (let i = 1; i < pts.length; i++) tc.lineTo(...px(...pts[i]));
    tc.closePath();
    tc.fill();
    tc.stroke();
  }

  tc.fillStyle   = '#202020';                     // land slightly lighter than ocean
  tc.strokeStyle = 'rgba(215, 215, 215, 0.78)';  // white continent borders
  tc.lineWidth   = 3.5;
  tc.lineJoin    = 'round';
  tc.lineCap     = 'round';

  // ── CONTINENTS ─────────────────────────────────────────────────────

  // North America
  land([
    [-168,72],[-140,83],[-90,84],[-60,78],[-55,65],
    [-60,50],[-55,45],[-65,44],[-68,47],[-80,44],
    [-83,42],[-85,30],[-87,25],[-90,20],[-95,18],
    [-92,16],[-100,18],[-104,20],[-118,22],[-120,30],
    [-124,40],[-124,48],[-130,55],[-140,58],[-152,60],[-168,68]
  ]);

  // Central America + Mexico Gulf Coast
  land([
    [-90,20],[-87,15],[-83,10],[-79,8],[-77,9],[-78,8],
    [-83,8],[-88,13],[-92,16]
  ]);

  // Cuba
  land([[-85,22],[-80,22],[-75,20],[-74,21],[-77,22],[-83,23],[-85,22]]);

  // South America
  land([
    [-80,12],[-67,12],[-60,5],[-50,4],[-35,-5],[-35,-10],
    [-39,-15],[-39,-23],[-48,-28],[-53,-34],[-65,-55],
    [-72,-50],[-75,-45],[-72,-40],[-72,-35],[-75,-20],
    [-78,-10],[-80,-2],[-77,2],[-80,8]
  ]);

  // Greenland
  land([
    [-46,84],[-20,84],[-15,78],[-18,72],[-24,68],
    [-30,65],[-44,60],[-52,65],[-52,72],[-48,78]
  ]);

  // Iceland
  land([[-24,64],[-13,64],[-13,66],[-18,66],[-24,65]]);

  // Western Europe (main Iberian–SE block)
  land([
    [-10,36],[-9,39],[-7,44],[-2,44],[3,44],[7,44],
    [10,44],[15,44],[20,43],[28,40],[34,37],[36,37],
    [40,37],[42,38],[42,41],[45,42],[40,44],[38,47],
    [33,46],[30,48],[24,58],[22,65],[20,69],[15,70],
    [5,62],[0,56],[-3,54],[-5,54],[-8,52],[-10,44]
  ]);

  // Norway / Sweden
  land([
    [5,58],[8,58],[12,58],[20,60],[28,70],[30,72],
    [28,74],[22,70],[20,69],[16,69],[14,66],[10,63],[5,60]
  ]);

  // Finland + Baltic region
  land([
    [20,60],[28,60],[30,62],[28,68],[26,70],[22,70],
    [18,68],[20,65],[22,60],[20,60]
  ]);

  // Great Britain
  land([
    [-5,50],[-3,50],[-2,51],[0,52],[0,53],[-2,54],
    [-5,56],[-6,58],[-4,58],[-2,57],[0,56],[0,53],
    [-2,52],[-3,51],[-5,50]
  ]);

  // Ireland
  land([[-10,52],[-6,52],[-6,54],[-8,55],[-10,54],[-10,52]]);

  // Africa
  land([
    [-18,16],[-16,20],[-17,28],[-13,24],[-5,34],[0,35],
    [10,37],[15,38],[22,37],[32,30],[37,22],[42,12],
    [50,12],[52,11],[44,4],[40,-3],[40,-10],[36,-18],
    [35,-25],[28,-34],[18,-34],[14,-22],[10,-18],[8,-4],
    [3,5],[2,6],[-5,5],[-15,5],[-18,5],[-17,14]
  ]);

  // Madagascar
  land([[44,-12],[50,-14],[50,-20],[44,-26],[44,-20],[44,-12]]);

  // Arabian Peninsula
  land([
    [37,22],[44,12],[50,12],[56,24],[58,22],
    [54,18],[48,12],[44,12],[37,22]
  ]);

  // Main Asia block
  land([
    [26,42],[36,37],[42,38],[46,42],[50,44],[60,44],
    [65,44],[72,36],[78,32],[80,28],[88,24],[92,22],
    [98,16],[100,5],[104,1],[110,-4],[118,4],[116,16],
    [110,20],[110,22],[120,30],[120,40],[130,44],[138,44],
    [142,48],[140,55],[130,62],[120,68],[104,73],[86,76],
    [68,76],[55,70],[50,65],[44,60],[38,56],[33,52],
    [26,50],[22,54],[22,58],[28,62],[28,65],[24,68],
    [26,72],[30,68],[38,68],[48,68],[48,60],[44,56],
    [44,52],[40,48],[36,48],[32,45],[28,42]
  ]);

  // Japan (Honshu)
  land([
    [130,32],[134,34],[138,36],[140,40],[142,44],
    [140,44],[136,36],[132,34],[130,32]
  ]);

  // Australia
  land([
    [114,-22],[116,-20],[122,-18],[130,-12],[136,-12],
    [140,-18],[144,-18],[148,-20],[154,-24],[152,-28],
    [154,-36],[150,-38],[148,-38],[144,-38],[140,-36],
    [136,-36],[132,-34],[128,-34],[122,-34],[116,-32],[114,-28]
  ]);

  // Antarctica strip
  tc.beginPath();
  tc.moveTo(...px(-180,-70));
  tc.lineTo(...px(180,-70));
  tc.lineTo(...px(180,-90));
  tc.lineTo(...px(-180,-90));
  tc.closePath();
  tc.fill();
  tc.stroke();

  // ── GRID LINES ─────────────────────────────────────────────────────
  tc.strokeStyle = 'rgba(200, 200, 200, 0.09)';
  tc.lineWidth   = 1.5;

  for (let lon = -180; lon <= 180; lon += 20) {
    const [x] = px(lon, 0);
    tc.beginPath(); tc.moveTo(x, 0); tc.lineTo(x, TH); tc.stroke();
  }
  for (let lat = -80; lat <= 80; lat += 20) {
    const [, y] = px(0, lat);
    tc.beginPath(); tc.moveTo(0, y); tc.lineTo(TW, y); tc.stroke();
  }

  // ── GLOBE MESH ───────────────────────────────────────────────────────────────
  const texture  = new THREE.CanvasTexture(texCanvas);
  const globeGeo = new THREE.SphereGeometry(1, 80, 80);
  const globeMat = new THREE.MeshPhongMaterial({
    map: texture,
    specular: new THREE.Color(0x0a0a0a),
    shininess: 4,
  });
  const globe = new THREE.Mesh(globeGeo, globeMat);
  scene.add(globe);

  // Subtle edge glow
  const atmosGeo = new THREE.SphereGeometry(1.035, 64, 64);
  const atmosMat = new THREE.MeshPhongMaterial({
    color: 0x444444,
    transparent: true,
    opacity: 0.07,
    side: THREE.BackSide,
  });
  scene.add(new THREE.Mesh(atmosGeo, atmosMat));

  // ── LOCATION MARKERS ─────────────────────────────────────────────────────────
  function latLngTo3D(lat, lng, r) {
    const phi   = (90 - lat)  * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
       r * Math.cos(phi),
       r * Math.sin(phi) * Math.sin(theta)
    );
  }

  const dotGeo = new THREE.SphereGeometry(0.020, 12, 12);
  const markerObjects = [];

  LOCATIONS.forEach(loc => {
    const pos = latLngTo3D(loc.lat, loc.lng, 1.018);
    const dot = new THREE.Mesh(
      dotGeo,
      new THREE.MeshBasicMaterial({ color: 0xc4856a })
    );
    dot.position.copy(pos);
    globe.add(dot);
    markerObjects.push({ dot, loc });
  });

  // ── DRAG + AUTO-ROTATE ───────────────────────────────────────────────────────
  // rotY ≈ -1.83 → Europe faces the camera at startup
  let rotY = -1.83;
  let rotX = 0.12;
  let isDragging = false;
  let prev = { x: 0, y: 0 };
  let autoRotate = true;
  let idleTimer  = null;

  function resumeRotate() { autoRotate = true; }

  canvas.addEventListener('mousedown', e => {
    isDragging = true; autoRotate = false;
    clearTimeout(idleTimer);
    prev = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    idleTimer = setTimeout(resumeRotate, 3000);
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
    clearTimeout(idleTimer);
    prev = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  window.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    idleTimer = setTimeout(resumeRotate, 3000);
  });
  window.addEventListener('touchmove', e => {
    if (!isDragging) return;
    rotY += (e.touches[0].clientX - prev.x) * 0.005;
    rotX += (e.touches[0].clientY - prev.y) * 0.005;
    rotX = Math.max(-1.1, Math.min(1.1, rotX));
    prev = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });

  // ── HOVER TOOLTIP ────────────────────────────────────────────────────────────
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
      tooltip.style.left      = `${rx}%`;
      tooltip.style.top       = `${ry}%`;
      tooltip.style.transform = 'translate(14px, -50%)';
    } else {
      tooltip.style.opacity = '0';
    }
  });
  canvas.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });

  // ── RENDER LOOP ──────────────────────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    if (autoRotate) rotY += 0.0015;
    globe.rotation.set(rotX, rotY, 0);
    renderer.render(scene, camera);
  }
  animate();
})();
