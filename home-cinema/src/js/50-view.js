// ===================================================================
// 50 · Renderer, cameras, view modes, presets, labels, sightline
// ===================================================================
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
let forcePR = 0;                                   // set by the render hook for print artwork
function pixelRatio() {
  if (forcePR) return forcePR;
  const d = window.devicePixelRatio || 1;
  return isFast() ? Math.min(d, 1) * dprScale : Math.min(d, 2);
}
renderer.setPixelRatio(pixelRatio());
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute('aria-label', '3D view of the basement cinema');
RectAreaLightUniformsLib.init();
scene.background = new THREE.Color('#120f0c');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const labelRenderer = new CSS2DRenderer({ element: $('#labels') });

const camera = new THREE.PerspectiveCamera(50, 1, 1, 8000);
const ortho = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 4000);
let activeCam = camera;
let mode = 'orbit';

// pointer handlers for picking are registered (in 55-edit) before controls, so they can veto a drag
let controls = null, planControls = null;
function initControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.maxPolarAngle = 89 * DEG; controls.minDistance = 20; controls.maxDistance = 900;
  controls.screenSpacePanning = true;
  planControls = new OrbitControls(ortho, renderer.domElement);
  planControls.enableRotate = false; planControls.screenSpacePanning = true;
  planControls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  planControls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
  planControls.minZoom = 0.4; planControls.maxZoom = 6;
  planControls.enabled = false;
  planControls.addEventListener('change', updatePlanDensity);
}
let planFit = 0.5;                                     // inches per pixel of the fitted plan
/** A small plan (a phone) hides the room-name tags and shrinks the dimension text until it is zoomed in. */
function updatePlanDensity() {
  $('#labels').classList.toggle('compact', mode === 'plan' && ortho.zoom / planFit < 1.6);
}

// ---------------- presets ----------------
let tween = null;
function presetPose(name) {
  const r = state.room, G = geom(), t = state.tv, seat = mainSeat();
  switch (name) {
    case 'sofa': return { pos: seat ? P(seat.x, seat.y, 40) : P(G.tvX, 25, 40), target: P(G.tvX + t.offset, r.depth, t.center) };
    case 'tvwall': return { pos: P(G.tvX, r.depth - 34, 62), target: P(G.tvX + 10, 25, 28) };
    case 'lounge': return { pos: P(128, 18, 60), target: P(0, state.fireplace.center + 8, 50) };
    case 'stairs': return { pos: P(r.boxX + 18, -24, 64), target: P(G.tvX, G.mainY + 20, 38) };
    default: return { pos: P(r.width + 70, -125, 330), target: P(r.width / 2 - 6, G.mainY / 2 + 14, 0) };
  }
}
function goPreset(name, instant = false) {
  if (mode !== 'orbit') setMode('orbit');
  const { pos, target } = presetPose(name);
  const aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
  if (name === 'overview' && aspect < 1.25) pos.sub(target).multiplyScalar(Math.min(2.2, Math.pow(1.25 / aspect, 0.7))).add(target);
  $$('#presets button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === name)));
  if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    camera.position.copy(pos); controls.target.copy(target); controls.update(); invalidate(2); return;
  }
  tween = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target };
  invalidate(2);
}
function stepTween(dt) {
  if (!tween) return;
  tween.t = Math.min(1, tween.t + dt / 0.9);
  const k = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - (-2 * tween.t + 2) ** 3 / 2;
  camera.position.lerpVectors(tween.p0, tween.p1, k);
  controls.target.lerpVectors(tween.t0, tween.t1, k);
  if (tween.t >= 1) tween = null;
}

// ---------------- walk mode ----------------
const walk = { yaw: 0, pitch: 0, keys: new Set(), pos: new THREE.Vector3(), dragging: false, pad: 0 };
function enterWalk() {
  const G = geom(), r = state.room;
  const start = P((r.boxX + r.stairStart) / 2, -r.stairWidth / 2, 64);      // foot of the stairs
  walk.pos.copy(start);
  const look = P(G.tvX, state.room.depth, 48).sub(start);
  walk.yaw = Math.atan2(-look.x, -look.z); walk.pitch = -0.08;
}
function insideRoom(x, y) {
  const o = geom().outline; let inside = false;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const [xi, yi] = o[i], [xj, yj] = o[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function stepWalk(dt) {
  const k = walk.keys, speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? 110 : 55) * dt;
  let f = 0, s = 0;
  if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
  if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) s -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) s += 1;
  f += walk.pad;
  if (f || s) {
    const fw = new THREE.Vector3(-Math.sin(walk.yaw), 0, -Math.cos(walk.yaw));
    const rt = new THREE.Vector3(Math.cos(walk.yaw), 0, -Math.sin(walk.yaw));
    const next = walk.pos.clone().addScaledVector(fw, f * speed).addScaledVector(rt, s * speed);
    const m = 9;   // keep a body's width off the walls
    if (insideRoom(next.x + m, -walk.pos.z) && insideRoom(next.x - m, -walk.pos.z)) walk.pos.x = next.x;
    if (insideRoom(walk.pos.x, -next.z + m) && insideRoom(walk.pos.x, -next.z - m)) walk.pos.z = next.z;
  }
  camera.position.copy(walk.pos);
  camera.rotation.set(walk.pitch, walk.yaw, 0, 'YXZ');
}

// ---------------- plan view ----------------
/** Screen rect (px) not covered by panels and bars, so the plan centres in what you can see. */
function safeRect() {
  const W = stage.clientWidth, H = stage.clientHeight, s = stage.getBoundingClientRect();
  let l = 0, r = W, t = 74, b = H - 70;
  if (viewOnly()) { t = 56; b = H - 16; }                         // menus hidden: only the Show menus button
  const L = $('#leftPanel'), R = $('#rightPanel');
  if (!isNarrow()) {
    if (L && !L.classList.contains('collapsed') && L.offsetParent) l = L.getBoundingClientRect().right - s.left + 8;
    if (R && !R.classList.contains('collapsed') && R.offsetParent) r = R.getBoundingClientRect().left - s.left - 8;
  }
  if (r - l < 240) { l = 0; r = W; }
  return { W, H, l, r, t, b };
}
function fitPlan() {
  const r = state.room, S = safeRect();
  // the room out to its outermost dimension lines (inches; see updateLabels), plus pixel margins for their labels,
  // which keep their screen size however small the plan gets
  const minX = -46, maxX = r.width + 48, minY = geom().hallY - 24, maxY = r.depth + 34;
  const pl = 36, pr = 74, pt = 18, pb = 18;
  const scale = Math.max((maxX - minX) / Math.max(60, S.r - S.l - pl - pr), (maxY - minY) / Math.max(60, S.b - S.t - pt - pb));   // inches per px
  const cx = (minX - pl * scale + maxX + pr * scale) / 2, cy = (minY - pb * scale + maxY + pt * scale) / 2;
  const sx = (S.l + S.r) / 2, sy = (S.t + S.b) / 2;
  ortho.left = -sx * scale; ortho.right = (S.W - sx) * scale; ortho.top = sy * scale; ortho.bottom = -(S.H - sy) * scale;
  ortho.position.copy(P(cx, cy, 1500));
  ortho.up.set(0, 0, -1);
  ortho.lookAt(P(cx, cy, 0));
  ortho.zoom = 1; ortho.updateProjectionMatrix();
  planControls.target.copy(P(cx, cy, 0));
  planControls.update();
  planFit = scale; updatePlanDensity();
}

function setMode(m) {
  if (m === mode && m !== 'plan') return;
  mode = m; tween = null;
  ['orbit', 'plan', 'walk'].forEach((k) => $('#mode-' + k).setAttribute('aria-pressed', String(k === m)));
  if (m !== 'orbit') $$('#presets button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  controls.enabled = m === 'orbit';
  planControls.enabled = m === 'plan';
  activeCam = m === 'plan' ? ortho : camera;
  if (m === 'plan') fitPlan(); else updatePlanDensity();
  if (m === 'walk') { enterWalk(); toast(matchMedia('(pointer: coarse)').matches ? 'Drag to look · hold ▲ to walk' : 'Drag to look · W A S D to walk · Shift to hurry'); }
  if (m === 'orbit') { camera.up.set(0, 1, 0); if (camera.position.y < 30 || prevWalk) goPreset('overview'); }
  prevWalk = m === 'walk';
  renderPass.camera = activeCam;
  labelsGroup.visible = true;
  updateLighting();
  updateLabels();
  invalidate(3);
  $('#walkpad').hidden = m !== 'walk';
  $('#hint').textContent = m === 'walk'
    ? 'Drag to look around · W A S D or arrow keys to walk · Shift to move faster'
    : m === 'plan' ? 'Drag furniture to move it · drag empty floor to pan · scroll to zoom'
      : 'Click furniture to select · drag to move · Q / E rotate · Del removes';
}
let prevWalk = false;

// ---------------- labels: plan dimensions + 3D sightline ----------------
const lineMat = new THREE.LineBasicMaterial({ color: '#d6a463', transparent: true, opacity: 0.9, depthTest: false });
const dimMat = new THREE.LineBasicMaterial({ color: '#efe6d8', transparent: true, opacity: 0.55, depthTest: false });
let planLog = null;                                   // print artwork: collects the plan's dimensions and tags
function label(text, pos, cls = 'dim', rot = 0) {
  if (planLog) planLog.push({ kind: cls === 'tag' ? 'tag' : 'label', text, x: pos.x, y: -pos.z, rot });
  const el = document.createElement('div');            // CSS2DRenderer owns this element's transform
  const inner = document.createElement('div'); inner.className = cls; inner.textContent = text;
  if (rot) inner.style.transform = `rotate(${rot}deg)`;
  el.appendChild(inner);
  const o = new CSS2DObject(el); o.position.copy(pos); o.center.set(0.5, 0.5);
  labelsGroup.add(o); return o;
}
function line(points, mat = dimMat, dashed = false) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  let m = mat;
  if (dashed) m = new THREE.LineDashedMaterial({ color: mat.color, dashSize: 4, gapSize: 3, transparent: true, opacity: 0.8, depthTest: false });
  const l = new THREE.Line(geo, m); if (dashed) l.computeLineDistances();
  l.renderOrder = 10; labelsGroup.add(l); return l;
}
function dimLine(a, b, z, text, at = 0.5) {         // at: where along the line the label sits
  if (planLog) planLog.push({ kind: 'dim', a, b, text, at });
  const pa = P(a[0], a[1], z), pb = P(b[0], b[1], z);
  line([pa, pb]);
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), nx = -dy / len * 4, ny = dx / len * 4;
  line([P(a[0] - nx, a[1] - ny, z), P(a[0] + nx, a[1] + ny, z)]);
  line([P(b[0] - nx, b[1] - ny, z), P(b[0] + nx, b[1] + ny, z)]);
  label(text, pa.clone().lerp(pb, at));
}

/** The eye point of the prime seat (plan x, y) on the main sofa, or null. */
function mainSeat() {
  const it = state.items.find((i) => i.type === 'sectional') || state.items.find((i) => i.type === 'sofa') || state.items.find((i) => i.type === 'recliner');
  if (!it) return null;
  const G = geom(), phi = it.rot * DEG, ex = [-Math.cos(phi), -Math.sin(phi)], ez = [-Math.sin(phi), Math.cos(phi)];
  const p = { ...CATALOG[it.type].defaults, ...it.p };
  let lx0, lx1, lz;
  if (it.type === 'sectional') {
    const B = p.back, R = p.ret, d = p.depth;
    [lx0, lx1] = p.side === 'left' ? [-(B / 2 - 6), B / 2 - d] : [-B / 2 + d, B / 2 - 6];
    lz = -R / 2 + 22;
  } else if (it.type === 'sofa') { lx0 = -p.w / 2 + 12; lx1 = p.w / 2 - 12; lz = -p.depth / 2 + 22; } else { lx0 = lx1 = 0; lz = 2; }
  const tv = [G.tvX + state.tv.offset, state.room.depth];
  const rel = [tv[0] - it.x, tv[1] - it.y];
  const lx = clamp(rel[0] * ex[0] + rel[1] * ex[1], Math.min(lx0, lx1), Math.max(lx0, lx1));
  return { x: it.x + lx * ex[0] + lz * ez[0], y: it.y + lx * ex[1] + lz * ez[1] };
}

function viewingStats() {
  const seat = mainSeat(); if (!seat) return null;
  const r = state.room, G = geom(), t = state.tv;
  const face = state.finish.tvSlats ? SLAT_FACE : 0;
  const onScreen = !!(t.screen && state.light.screenDown);
  const sd = onScreen ? screenDims() : null;
  const { w, h } = onScreen ? sd : tvDims(t.size);
  const tv = onScreen ? { x: G.tvX, y: sd.y, z: sd.centre } : { x: G.tvX + t.offset, y: r.depth - face - 1, z: t.center };
  const eye = 40;
  const dist = Math.hypot(tv.x - seat.x, tv.y - seat.y);
  const hAngle = 2 * Math.atan(w / 2 / dist) / DEG;
  const tilt = Math.atan((tv.z - eye) / dist) / DEG;
  const sizeFor = (deg) => 2 * dist * Math.tan(deg / 2 * DEG) * Math.hypot(16, 9) / 16;
  // a console standing under the TV (close to the TV wall and overlapping it sideways)
  const con = state.items.find((i) => i.type === 'console' && Math.abs(i.y - r.depth) < 30 && Math.abs(i.x - tv.x) < (i.p.w || 70) / 2 + w / 2);
  const clearance = con && !onScreen ? (t.center - h / 2) - (CONSOLE_Y0 + CONSOLE_H + SOUNDBAR_H) : null;
  return { seat, tv, dist, hAngle, tilt, w, h, eye, fit: G.bay[3][0] - G.bay[2][0] - w, size30: sizeFor(30), size40: sizeFor(40), clearance, onScreen, screenFits: sd ? sd.fits : true };
}

let sightline = null;
function updateLabels() {
  disposeGroup(labelsGroup); sightline = null; invalidate(2);
  const r = state.room, G = geom();
  if (mode === 'plan') {
    const zz = r.ceiling + 2;
    dimLine([0, G.hallY - 24], [r.width, G.hallY - 24], zz, `${ftin(r.width)}  fireplace wall → exterior wall`);
    dimLine([r.boxX, -r.stairWidth / 2], [r.stairStart, -r.stairWidth / 2], zz, ftin(r.stairStart - r.boxX));
    label('Hallway', P((r.boxX + G.hallEnd) / 2, G.hallY + 14, zz), 'tag');
    // measured from the stair-side line: exterior wall to the alcove notch, then the whole depth to the TV wall
    dimLine([r.width + 20, 0], [r.width + 20, G.mainY], zz, ftin(G.mainY), 0.32);   // staggered from the outer label
    dimLine([r.width + 48, 0], [r.width + 48, r.depth], zz, `${ftin(r.depth)} to TV wall`);
    // fireplace pocket: to the face of the steel-beam bump, then the whole fireplace wall
    dimLine([-18, 0], [-18, G.westY - r.pilasterD], zz, ftin(G.westY - r.pilasterD), 0.32);
    dimLine([-46, 0], [-46, G.westY], zz, ftin(G.westY));
    dimLine([0, 9], [r.boxX, 9], zz, ftin(r.boxX));
    dimLine([G.bay[2][0], r.depth + 16], [G.bay[3][0], r.depth + 16], zz, `TV wall ${ftin(G.bay[3][0] - G.bay[2][0])}`);
    dimLine([r.bayLeft, r.depth + 34], [r.bayRight, r.depth + 34], zz, `alcove ${ftin(r.bayRight - r.bayLeft)} · bulkhead at ${ftin(r.soffitBottom)}`);
    line([P(r.beamX, 0, zz), P(r.beamX, G.westY - r.pilasterD, zz)], dimMat, true);
    label('Steel beam W200', P(r.beamX, G.westY * 0.5, zz), 'tag', -90);
    label('TV alcove', P(G.tvX, G.mainY + r.bayDepth * 0.55, zz), 'tag');
    if (r.beamDepth > 1) dimLine([0, G.westY + 14], [r.beamDepth, G.westY + 14], zz, `bulkhead at ${ftin(r.beamBottom)}`);
    label('Stairs ↑', P((r.stairStart + r.width) / 2, -r.stairWidth * 0.3, zz), 'tag');
    dimLine([r.stairStart - 2, -r.stairWidth + 8], [r.width, -r.stairWidth + 8], zz, `tip of stairs ${ftin(r.width - r.stairStart + 2)}`);
    label('Exterior wall', P(r.width - 10, G.mainY / 2, zz), 'tag', 90);
    label('Fireplace', P(10, state.fireplace.center, zz), 'tag', -90);
  }
  const v = viewingStats();
  const overlays = mode === 'plan' || !viewOnly();
  if (v && state.showSightline && mode !== 'walk' && overlays) {
    const a = P(v.seat.x, v.seat.y, v.eye), b = P(v.tv.x, v.tv.y, v.tv.z);
    const sl = [line([a, b], lineMat, true)];
    const dot = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), new THREE.MeshBasicMaterial({ color: '#d6a463', depthTest: false }));
    dot.position.copy(a); dot.renderOrder = 11; labelsGroup.add(dot); sl.push(dot);
    sl.push(label(`${ftin(v.dist)} · ${v.hAngle.toFixed(0)}° wide`, a.clone().lerp(b, 0.62), 'dim brass'));
    sightline = { objs: sl, eye: a };
  }
  if (state.showSpeakers && overlays) drawSpeakerPlan();
  updateMeasureLabels();
}

/**
 * 5.1.2 pre-wire plan from the prime seat, after Dolby's placement angles:
 * fronts ~22° off axis, surrounds 90–110°, top-middle pair just ahead of the seat.
 */
function speakerPlan() {
  const seat = mainSeat(); if (!seat) return [];
  const r = state.room, G = geom(), H = r.ceiling, ear = 40;
  const T = [G.tvX, r.depth], f = [T[0] - seat.x, T[1] - seat.y], fl = Math.hypot(f[0], f[1]);
  f[0] /= fl; f[1] /= fl;
  const rt = [f[1], -f[0]];                               // listener's right
  const at = (along, side) => [seat.x + f[0] * along + rt[0] * side, seat.y + f[1] * along + rt[1] * side];
  const frontY = G.mainY + G.ret - 4, along = frontY - seat.y, lat = along * Math.tan(22 * DEG);
  const clampBay = ([x, y]) => [clamp(x, r.bayLeft + 8, r.bayRight - 8), y];
  const sideR = r.width - 2 - seat.x, back = -8;
  return [
    { k: 'L', name: 'Front left', p: clampBay(at(along, -lat)), z: ear, how: 'tower or in-wall' },
    { k: 'C', name: 'Centre', p: [G.tvX, r.depth - 10], z: 16, how: 'under the screen' },
    { k: 'R', name: 'Front right', p: clampBay(at(along, lat)), z: ear, how: 'tower or in-wall' },
    { k: 'SW', name: 'Subwoofer', p: [r.bayRight - 12, G.mainY + 10], z: 8, how: 'floor, front corner' },
    { k: 'SR', name: 'Surround right', p: at(back, sideR), z: ear + 22, how: 'exterior wall, 2 ft above ears' },
    { k: 'SL', name: 'Surround left', p: at(back, -Math.min(sideR, seat.x - r.boxX)), z: H, how: 'in-ceiling, angled (no wall there)' },
    { k: 'TL', name: 'Top left', p: at(26, -lat * 0.8), z: H, how: 'in-ceiling, Atmos' },
    { k: 'TR', name: 'Top right', p: at(26, lat * 0.8), z: H, how: 'in-ceiling, Atmos' },
  ];
}
function drawSpeakerPlan() {
  const disc = new THREE.MeshBasicMaterial({ color: '#7fb3d5', depthTest: false, transparent: true, opacity: 0.9 });
  const seat = mainSeat();
  for (const s of speakerPlan()) {
    const pos = P(s.p[0], s.p[1], mode === 'plan' ? state.room.ceiling + 3 : s.z);
    const m = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 12), disc); m.position.copy(pos); m.renderOrder = 12; labelsGroup.add(m);
    if (seat) line([P(seat.x, seat.y, mode === 'plan' ? state.room.ceiling + 3 : 40), pos], new THREE.LineBasicMaterial({ color: '#7fb3d5', transparent: true, opacity: 0.35, depthTest: false }));
    const o = label(s.k, pos, 'dim spk'); o.element.title = `${s.name}: ${s.how}`;
  }
}
