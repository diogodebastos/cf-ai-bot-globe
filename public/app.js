import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import Globe from "three-globe";

// Per-country anchor cities [lat, lng, weight≈population millions].
// Radar caps at country granularity; we spread flashes across major
// metros to reproduce a night-lights distribution within each country.
const CITIES = {
  US: [[40.71,-74.01,18],[34.05,-118.24,13],[41.88,-87.63,9],[29.76,-95.37,7],[33.45,-112.07,5],[37.77,-122.42,5],[47.61,-122.33,4],[39.74,-104.99,3],[33.75,-84.39,6],[25.76,-80.19,6],[42.36,-71.06,5],[38.91,-77.04,6]],
  GB: [[51.51,-0.13,9],[53.48,-2.24,3],[52.49,-1.89,2.5],[55.86,-4.25,2],[53.80,-1.55,2],[53.41,-2.99,1.5]],
  DE: [[52.52,13.41,4],[48.14,11.58,1.5],[50.11,8.68,1],[53.55,9.99,2],[51.23,6.78,1],[50.94,6.96,1.1],[48.78,9.18,0.6]],
  FR: [[48.86,2.35,11],[45.75,4.85,2],[43.30,5.37,1.6],[43.60,1.44,1.4],[47.22,-1.55,0.7]],
  NL: [[52.37,4.90,1.5],[51.92,4.48,1],[52.08,4.31,0.6],[52.09,5.12,0.4]],
  IE: [[53.35,-6.26,1.5],[51.90,-8.47,0.3]],
  ES: [[40.42,-3.70,3.5],[41.39,2.17,2.8],[39.47,-0.38,1.5],[37.39,-5.99,1.3]],
  IT: [[41.90,12.50,2.9],[45.46,9.19,3.2],[40.85,14.27,1],[43.77,11.25,0.8]],
  PL: [[52.23,21.01,1.8],[50.06,19.94,0.8],[51.11,17.04,0.7]],
  SE: [[59.33,18.07,1.6],[57.71,11.97,0.6],[55.60,13.00,0.4]],
  FI: [[60.17,24.94,1.3],[60.45,22.27,0.3]],
  NO: [[59.91,10.75,1],[60.39,5.32,0.3]],
  RU: [[55.75,37.62,12],[59.93,30.31,5],[55.05,82.95,1.6],[56.83,60.61,1.5],[55.75,49.12,1.3]],
  TR: [[41.01,28.98,15],[39.93,32.86,5],[38.42,27.14,3]],
  JP: [[35.68,139.65,14],[34.69,135.50,2.7],[35.18,136.91,2.3],[34.39,132.46,1.2],[33.59,130.40,1.6]],
  KR: [[37.57,126.98,9.7],[35.18,129.07,3.4],[37.45,126.71,3]],
  CN: [[39.90,116.41,21],[31.23,121.47,24],[23.13,113.26,18],[22.55,114.06,12],[30.57,104.07,10],[34.34,108.94,8],[30.59,114.30,11]],
  TW: [[25.03,121.57,2.6],[22.63,120.27,2.7],[24.15,120.68,2.8]],
  HK: [[22.30,114.17,7]],
  SG: [[1.35,103.82,5.7]],
  IN: [[28.61,77.21,30],[19.08,72.88,21],[12.97,77.59,12],[13.08,80.27,10],[22.57,88.36,15],[17.39,78.49,10],[18.52,73.86,7],[23.03,72.58,8]],
  AU: [[-33.87,151.21,5.4],[-37.81,144.96,5.2],[-27.47,153.03,2.6],[-31.95,115.86,2.1]],
  BR: [[-23.55,-46.63,22],[-22.91,-43.17,13],[-15.78,-47.93,4.6],[-19.92,-43.94,5.9],[-12.97,-38.51,3.7],[-3.10,-60.02,2.2]],
  CA: [[43.65,-79.38,6.4],[45.50,-73.57,4.3],[49.28,-123.12,2.6],[51.05,-114.07,1.6],[45.42,-75.70,1.4]],
  MX: [[19.43,-99.13,21],[20.66,-103.35,5],[25.67,-100.30,5.3],[19.04,-98.20,3.2]],
  AR: [[-34.60,-58.38,15],[-31.42,-64.18,1.6],[-32.95,-60.65,1.3]],
  ZA: [[-26.20,28.04,9.5],[-33.92,18.42,4.6],[-29.86,31.02,3.7]],
  AE: [[25.20,55.27,3.5],[24.47,54.37,1.5]],
  IL: [[32.08,34.78,4.2],[31.77,35.21,1]],
  ID: [[-6.21,106.85,11],[-7.25,112.75,3.0],[-6.97,107.63,2.5],[3.59,98.67,2.4]],
};

const CENTROIDS = Object.fromEntries(
  Object.entries(CITIES).map(([code, list]) => {
    const totalW = list.reduce((a, c) => a + c[2], 0) || 1;
    const lat = list.reduce((a, c) => a + c[0] * c[2], 0) / totalW;
    const lng = list.reduce((a, c) => a + c[1] * c[2], 0) / totalW;
    return [code, [lat, lng]];
  }),
);

// Country borders (Natural Earth 110m).
const COUNTRIES_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

// 7,342 populated places with POP_MAX — gives a real sense of population density.
const CITIES_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson";

// Cool-graphite radar palette — orange flashes are the only saturated color.
const COLOR_LAND_DAY   = "#7c9bb0";   // sun-lit land (muted steel blue)
const COLOR_LAND_NIGHT = "#152230";   // shadowed land (deep navy)
const COLOR_BORDER     = "rgba(190, 215, 235, 0.22)";
const COLOR_GRID       = "#1a3548";
const COLOR_ATMO       = "#3a6a88";
const COLOR_FLASH      = "#f6821f";
const COLOR_FLASH_RGB  = "246, 130, 31";

const container = document.getElementById("globe");
const hud = {
  total: document.getElementById("total"),
  updated: document.getElementById("updated"),
  sun: document.getElementById("sun"),
  moon: document.getElementById("moon"),
  top: document.getElementById("top"),
  status: document.getElementById("status"),
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

// Solid black sphere occluder so back-side dots/grid don't bleed through.
const globe = new Globe()
  .showAtmosphere(true)
  .atmosphereColor(COLOR_ATMO)
  .atmosphereAltitude(0.18)
  .ringAltitude(0.012)
  // Stronger pulse: slower fade-out, brighter peak, never fully transparent
  // until the very end so the ring is visible across its full propagation.
  .ringColor(() => (t) => {
    // t goes 0 → 1 over one repeat period
    const a = Math.pow(1 - t, 1.6) * 0.95 + 0.05;
    return `rgba(${COLOR_FLASH_RGB}, ${a.toFixed(3)})`;
  })
  .ringMaxRadius((d) => d.maxR ?? 4.5)
  .ringPropagationSpeed(2.2)
  // Re-emit a ring every 700ms while the flash is alive → real pulsation.
  .ringRepeatPeriod(700)
  .pointAltitude(0.012)
  .pointRadius(0.25)
  .pointColor(() => COLOR_FLASH)
  .pointsMerge(false);

// Replace the default shaded earth with a flat dark sphere — keeps the
// hex-dot land readable and hides the back hemisphere.
globe.globeMaterial(
  new THREE.MeshBasicMaterial({ color: 0x000604, transparent: false }),
);

scene.add(globe);

// Lat/lon wireframe grid laid over the globe.
const gridRadius = globe.getGlobeRadius() * 1.001;
const gridGeo = new THREE.SphereGeometry(gridRadius, 36, 24);
const gridWire = new THREE.LineSegments(
  new THREE.WireframeGeometry(gridGeo),
  new THREE.LineBasicMaterial({
    color: COLOR_GRID,
    transparent: true,
    opacity: 0.22,
  }),
);
scene.add(gridWire);

// ---------------------------------------------------------------------------
// Per-dot land grid: one InstancedMesh of small dots, lit per-instance in the
// shader using the live sun direction. This replaces three-globe's
// hexPolygons (one color per country) with true per-dot lighting.
// ---------------------------------------------------------------------------
const DOT_ALT = 0.004;
const DOT_BASE_RADIUS = globe.getGlobeRadius() * 0.000005; // smallest hamlet
const DOT_MAX_RADIUS  = globe.getGlobeRadius() * 0.005;  // megacities (Tokyo, Delhi)

let landMesh = null;
function buildCityDots(cityFeatures) {
  // Filter out features missing population, log-scale into [0, 1].
  const cities = cityFeatures
    .map((f) => {
      const [lon, lat] = f.geometry.coordinates;
      const pop = f.properties.POP_MAX || f.properties.POP_MIN || 0;
      return { lat, lon, pop };
    })
    .filter((c) => c.pop > 0);

  if (!cities.length) return null;
  const popMin = Math.log10(Math.max(1, Math.min(...cities.map((c) => c.pop))));
  const popMax = Math.log10(Math.max(...cities.map((c) => c.pop)));
  const popRange = Math.max(0.1, popMax - popMin);

  // Unit sphere geometry — instance matrix scales it to the per-city radius.
  const geom = new THREE.SphereGeometry(1, 6, 6);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      sunDir:   { value: new THREE.Vector3(1, 0, 0) },
      colDay:   { value: new THREE.Color(COLOR_LAND_DAY) },
      colNight: { value: new THREE.Color(COLOR_LAND_NIGHT) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 instanceDir;
      varying float vSunDot;
      uniform vec3 sunDir;
      void main() {
        vSunDot = dot(normalize(instanceDir), normalize(sunDir));
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 colDay;
      uniform vec3 colNight;
      varying float vSunDot;
      void main() {
        float lit = smoothstep(-0.20, 0.20, vSunDot);
        vec3 col = mix(colNight, colDay, lit);
        // Lower the alpha on night dots so the dark hemisphere recedes,
        // and keep day dots translucent so orange flashes win the eye.
        float alpha = mix(0.40, 0.72, lit);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const mesh = new THREE.InstancedMesh(geom, mat, cities.length);
  mesh.frustumCulled = false;

  const dirs = new Float32Array(cities.length * 3);
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const center = globe.position;
  for (let i = 0; i < cities.length; i++) {
    const { lat, lon, pop } = cities[i];
    const c = globe.getCoords(lat, lon, DOT_ALT);
    pos.set(c.x, c.y, c.z);
    // Log-scale population → dot radius. Cube it lightly so megacities feel
    // dramatic without obliterating small towns.
    const t = (Math.log10(pop) - popMin) / popRange; // 0..1
    // Stronger curve (t^2.2) so megacities tower over towns — dot size = city population count.
    const r = DOT_BASE_RADIUS + (DOT_MAX_RADIUS - DOT_BASE_RADIUS) * Math.pow(t, 2.2);
    scl.set(r, r, r);
    m.compose(pos, quat, scl);
    mesh.setMatrixAt(i, m);
    const dx = c.x - center.x, dy = c.y - center.y, dz = c.z - center.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    dirs[i * 3]     = dx / len;
    dirs[i * 3 + 1] = dy / len;
    dirs[i * 3 + 2] = dz / len;
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.geometry.setAttribute(
    "instanceDir",
    new THREE.InstancedBufferAttribute(dirs, 3),
  );

  return mesh;
}

let countriesData = [];
Promise.all([
  fetch(COUNTRIES_URL).then((r) => r.json()),
  fetch(CITIES_URL).then((r) => r.json()),
])
  .then(([countries, cities]) => {
    countriesData = countries.features;
    landMesh = buildCityDots(cities.features);
    if (landMesh) scene.add(landMesh);
    globe
      .polygonsData(countriesData)
      .polygonCapColor(() => "rgba(0,0,0,0)")
      .polygonSideColor(() => "rgba(0,0,0,0)")
      .polygonStrokeColor(() => COLOR_BORDER)
      .polygonAltitude(0.006);
  })
  .catch((e) => console.warn("countries load failed", e));

// --- Sun: glowing yellow disc floating above the subsolar point. ---
const sunMarker = new THREE.Mesh(
  new THREE.SphereGeometry(globe.getGlobeRadius() * 0.04, 24, 16),
  new THREE.MeshBasicMaterial({ color: 0xfff4b8 }),
);
const sunGlow = new THREE.Mesh(
  new THREE.SphereGeometry(globe.getGlobeRadius() * 0.10, 32, 24),
  new THREE.MeshBasicMaterial({
    color: 0xffcd5a, transparent: true, opacity: 0.30, depthWrite: false,
  }),
);

// --- Moon: pale gray disc above the sub-lunar point. ---
const moonMarker = new THREE.Mesh(
  new THREE.SphereGeometry(globe.getGlobeRadius() * 0.025, 24, 16),
  new THREE.MeshBasicMaterial({ color: 0xcfd6e0 }),
);
// Place markers in world space via three-globe's own coord helper so we don't
// have to second-guess its internal sphere rotation.
scene.add(sunMarker);
scene.add(sunGlow);
scene.add(moonMarker);

function placeAtLatLon(obj, lat, lon, alt = 0.18) {
  const c = globe.getCoords(lat, lon, alt);
  obj.position.set(c.x, c.y, c.z);
}

// --- Live sun direction ---
function deg2rad(x) { return (x * Math.PI) / 180; }
function rad2deg(x) { return (x * 180) / Math.PI; }

// Subsolar point (lat, lon in degrees) for a given Date.
function subsolarPoint(date) {
  const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  const d = (date.getTime() - J2000) / 86400000; // days since J2000
  const g = deg2rad(357.529 + 0.98560028 * d);
  const q = 280.459 + 0.98564736 * d;
  const L = deg2rad(q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
  const e = deg2rad(23.439 - 0.00000036 * d);
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)); // radians
  const dec = Math.asin(Math.sin(e) * Math.sin(L));               // radians
  // Greenwich Mean Sidereal Time in hours
  let gmst = 18.697374558 + 24.06570982441908 * d;
  gmst = ((gmst % 24) + 24) % 24;
  const gmstDeg = gmst * 15;          // degrees
  let lon = rad2deg(ra) - gmstDeg;    // subsolar longitude
  lon = ((lon + 540) % 360) - 180;    // normalize to [-180, 180]
  const lat = rad2deg(dec);
  return { lat, lon };
}

// Sub-lunar point: simplified ELP model, accurate to ~0.5° (plenty for a marker).
function subLunarPoint(date) {
  const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  const d = (date.getTime() - J2000) / 86400000;
  const L = 218.316 + 13.176396 * d;        // mean longitude
  const M = deg2rad(134.963 + 13.064993 * d); // mean anomaly
  const F = deg2rad(93.272 + 13.229350 * d);  // mean argument of latitude
  const lambda = deg2rad(L + 6.289 * Math.sin(M));
  const beta = deg2rad(5.128 * Math.sin(F));
  const e = deg2rad(23.439);
  const ra = Math.atan2(
    Math.sin(lambda) * Math.cos(e) - Math.tan(beta) * Math.sin(e),
    Math.cos(lambda),
  );
  const dec = Math.asin(
    Math.sin(beta) * Math.cos(e) + Math.cos(beta) * Math.sin(e) * Math.sin(lambda),
  );
  let gmst = 18.697374558 + 24.06570982441908 * d;
  gmst = ((gmst % 24) + 24) % 24;
  let lon = rad2deg(ra) - gmst * 15;
  lon = ((lon + 540) % 360) - 180;
  return { lat: rad2deg(dec), lon };
}

let lastSun = { lat: 0, lon: 0 };
let lastMoon = { lat: 0, lon: 0 };
const _sunDirVec = new THREE.Vector3();
function updateSun() {
  lastSun = subsolarPoint(new Date());
  placeAtLatLon(sunMarker, lastSun.lat, lastSun.lon, 0.45);
  placeAtLatLon(sunGlow, lastSun.lat, lastSun.lon, 0.45);
  lastMoon = subLunarPoint(new Date());
  placeAtLatLon(moonMarker, lastMoon.lat, lastMoon.lon, 0.30);

  if (landMesh) {
    // World-space sun direction = unit vector from globe center to subsolar point.
    const surface = globe.getCoords(lastSun.lat, lastSun.lon, 0);
    _sunDirVec
      .set(surface.x - globe.position.x, surface.y - globe.position.y, surface.z - globe.position.z)
      .normalize();
    landMesh.material.uniforms.sunDir.value.copy(_sunDirVec);
  }
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
container.appendChild(renderer.domElement);


const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 0, 320);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.5;
controls.enablePan = false;
controls.minDistance = 160;
controls.maxDistance = 600;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.25;

addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let activity = { totalRate: 0, countries: [], updatedAt: null };
const rings = [];
const points = [];
const RING_TTL = 4800;   // longer-lived flashes — ~7 pulses each
const POINT_TTL = 1200;  // central glow stays a bit longer too

function pickWeighted(items, weightOf) {
  let total = 0;
  for (const it of items) total += weightOf(it);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const it of items) {
    r -= weightOf(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function pickCountry() {
  const list = activity.countries.filter((c) => c.share > 0 && CITIES[c.code]);
  return pickWeighted(list, (c) => c.share);
}

function pickCity(code) {
  const list = CITIES[code];
  if (!list) return null;
  return pickWeighted(list, (c) => c[2]);
}

function jitter(deg) {
  return (Math.random() - 0.5) * deg;
}

function spawnFlash() {
  const country = pickCountry();
  if (!country) return;
  const city = pickCity(country.code);
  if (!city) return;
  const [lat, lng] = city;
  // Tighter jitter — city-scale spread, not country-scale.
  const fLat = lat + jitter(0.6);
  const fLng = lng + jitter(0.8);
  const now = performance.now();
  rings.push({ lat: fLat, lng: fLng, born: now, maxR: 3.5 + Math.random() * 2.5 });
  points.push({ lat: fLat, lng: fLng, born: now });
}

function tickFlashes() {
  const now = performance.now();
  while (rings.length && now - rings[0].born > RING_TTL) rings.shift();
  while (points.length && now - points[0].born > POINT_TTL) points.shift();
  globe.ringsData(rings);
  globe.pointsData(points.map((p) => ({ lat: p.lat, lng: p.lng })));
}

let scheduleAcc = 0;
let lastFrame = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = now - lastFrame;
  lastFrame = now;

  const fps = Math.max(1, Math.min(30, activity.totalRate / 80));
  scheduleAcc += dt;
  const interval = 1000 / fps;
  while (scheduleAcc >= interval) {
    spawnFlash();
    scheduleAcc -= interval;
  }
  tickFlashes();
  updateSun();

  controls.update();
  renderer.render(scene, camera);
}
animate();

function fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(Math.round(n));
}

function renderHUD() {
  hud.total.textContent = fmt(activity.totalRate);
  if (activity.updatedAt) {
    const age = Math.round((Date.now() - new Date(activity.updatedAt).getTime()) / 1000);
    hud.updated.textContent = age + "s ago";
  }
  const fmtLL = (p) => {
    const ns = p.lat >= 0 ? "N" : "S";
    const ew = p.lon >= 0 ? "E" : "W";
    return `${Math.abs(p.lat).toFixed(1)}°${ns}, ${Math.abs(p.lon).toFixed(1)}°${ew}`;
  };
  if (hud.sun) hud.sun.textContent = fmtLL(lastSun);
  if (hud.moon) hud.moon.textContent = fmtLL(lastMoon);
  const top = [...activity.countries].sort((a, b) => b.value - a.value).slice(0, 5);
  hud.top.innerHTML = top
    .map((c) => `<li><span>${c.code}</span><span>${(c.share * 100).toFixed(1)}%</span></li>`)
    .join("");
}

async function poll() {
  try {
    const r = await fetch("/api/activity", { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    activity = j;
    hud.status.textContent = "";
    renderHUD();
  } catch (e) {
    hud.status.textContent = "Data unavailable: " + e.message;
  }
}

poll();
setInterval(poll, 30_000);
setInterval(renderHUD, 1000);
