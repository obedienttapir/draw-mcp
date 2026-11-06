// ===================================================================
// 68 · Photo mode: frame and shoot the room like an interior photographer.
//  - lenses in full-frame-equivalent millimetres (16–50 mm), matched across the frame's diagonal like a phone camera,
//    so a "24 mm" shot here frames the same as 24 mm in a render app
//  - aspect ratios, a thirds grid, the area outside the frame dimmed
//  - straight verticals: the camera stays level and a lens shift moves the picture instead of tilting it,
//    so walls don't lean (the look of architectural photography)
//  - viewpoints (camera presets + your saved shots), 3D or walk at a chosen eye height, exposure, lighting scene
//  - the shutter renders exactly the frame at print resolution with no labels or outlines, then offers
//    Share (any app on the phone), Download, Copy, the scene + this camera as a .glb, and the camera data
// ===================================================================
const SENSOR_DIAG = Math.hypot(36, 24);                 // 43.27 mm: full-frame diagonal
const PHOTO_ASPECTS = { '4:3': 4 / 3, '3:2': 3 / 2, '16:9': 16 / 9, '1:1': 1, '4:5': 4 / 5, '9:16': 9 / 16 };
const PHOTO_LENSES = [16, 20, 24, 28, 35, 50];
const LENS_MIN = 12, LENS_MAX = 85;                     // pinch and Ctrl+wheel zoom continuously between these
const PHOTO_RES = { '2K': 2048, '3K': 3072, '4K': 4096 };
const PHOTO_KEY = 'basement-cinema-photo';
const BASE_EXPOSURE = 1.05;
const photo = Object.assign({ on: false, aspect: '4:3', mm: 24, grid: true, level: true, res: '3K', hq: true, fmt: 'jpeg', ev: 0, eye: 60 },
  (() => { try { return JSON.parse(localStorage.getItem(PHOTO_KEY)) || {}; } catch (e) { return {}; } })(), { on: false });
photo.frame = { x: 0, y: 0, w: 1, h: 1 }; photo.shift = 0; photo.keep = null; photo.last = null;
function savePhotoPrefs() {
  const { aspect, mm, grid, level, res, hq, fmt, eye } = photo;
  try { localStorage.setItem(PHOTO_KEY, JSON.stringify({ aspect, mm, grid, level, res, hq, fmt, eye })); } catch (e) { /* per visit */ }
}
const photoAspect = () => PHOTO_ASPECTS[photo.aspect] || 4 / 3;
/** Vertical field of view (radians) of the frame for a full-frame-equivalent focal length, matched on the diagonal. */
function frameVFov(mm = photo.mm, a = photoAspect()) {
  const half = Math.atan(SENSOR_DIAG / (2 * mm));
  return 2 * Math.atan(Math.tan(half) / Math.hypot(1, a));
}
const hFovOf = (v, a) => 2 * Math.atan(Math.tan(v / 2) * a);
const photoTag = () => `${photo.mm} mm · ${photo.aspect}${photo.level ? (photo.levelNow === false ? ' · aerial tilt' : ' · level') : ''}`;

// ---------------- enter / leave ----------------
function enterPhoto() {
  if (photo.on) return;
  closeSheet(); select(null); if (measure.on) setMeasure(false); if (viewOnly()) setFocus(false);
  photo.keep = { labels: labelsGroup.visible, helpers: helpersGroup.visible, exposure: renderer.toneMappingExposure };
  if (mode === 'plan') setMode('orbit');
  photo.on = true;
  $('#app').classList.add('photo');
  labelsGroup.visible = false; helpersGroup.visible = false;
  renderer.toneMappingExposure = BASE_EXPOSURE * 2 ** photo.ev;
  // like a camera app: one finger orbits, two fingers pan, pinch zooms the lens (handled below). The orbit
  // controls keep their two-finger dolly+pan; their dolly is switched off while fingers are down (see gestures)
  renderPhotoUI(); photoLayout();
  if (mode === 'walk') walk.pos.y = photo.eye;
  photoHint();
  invalidate(3);
}
function photoHint() {
  const touch = matchMedia('(pointer: coarse)').matches;
  toast(mode === 'walk'
    ? (touch ? 'Drag to look · two fingers to move · pinch to zoom the lens' : 'Drag to look · wheel or W/S to move · Ctrl+wheel zooms the lens')
    : (touch ? 'One finger orbits · two fingers pan · pinch zooms the lens · hold ▲ ▼ to move in' : 'Drag to orbit · right-drag pans · wheel moves in · Ctrl+wheel zooms the lens'));
}
function exitPhoto() {
  if (!photo.on) return;
  photo.on = false; photo.dolly = 0; pinch.pts.clear(); controls.enableZoom = true;
  $('#app').classList.remove('photo');
  $('#photoMenu').hidden = true;
  labelsGroup.visible = photo.keep ? photo.keep.labels : true; helpersGroup.visible = photo.keep ? photo.keep.helpers : true;
  renderer.toneMappingExposure = photo.keep ? photo.keep.exposure : BASE_EXPOSURE;
  camera.fov = 50; camera.clearViewOffset(); camera.up.set(0, 1, 0);
  if (mode === 'orbit') camera.lookAt(controls.target);
  resize(); updateLabels(); invalidate(3);
}

// ---------------- the frame on screen and the camera behind it ----------------
/** Fit the frame between the top bar and the controls, centred; the camera is then aimed through its centre. */
function photoLayout() {
  if (!photo.on) return;
  const st = stage.getBoundingClientRect(), top = $('.ph-top').getBoundingClientRect(), bot = $('.ph-bottom').getBoundingClientRect();
  const y0 = top.bottom - st.top + 10, y1 = bot.top - st.top - 10, m = 12;
  const aw = st.width - 2 * m, ah = Math.max(60, y1 - y0), a = photoAspect();
  const w = Math.min(aw, ah * a), h = w / a;
  photo.frame = { x: (st.width - w) / 2, y: y0 + (ah - h) / 2, w, h };
  const f = $('.ph-frame');
  Object.assign(f.style, { left: `${photo.frame.x}px`, top: `${photo.frame.y}px`, width: `${w}px`, height: `${h}px` });
  $('.ph-tag').textContent = photoTag();
  f.classList.toggle('grid', photo.grid);
  invalidate(2);
}
/**
 * Each frame: aim the camera (level when straight verticals is on, with the tilt turned into lens shift),
 * set the field of view so the frame shows exactly the lens's view, and centre the projection on the frame.
 */
function photoCamera() {
  if (!photo.on || mode === 'plan') return;
  if (photo.dolly && mode === 'orbit') {                // ▲ ▼ held: move the camera and its aim point together, level
    const f = controls.target.clone().sub(camera.position); f.y = 0;
    if (f.lengthSq() > 1e-6) {
      f.normalize().multiplyScalar(photo.dolly * 1.6);
      camera.position.add(f); controls.target.add(f);
    }
    invalidate(1);
  }
  const W = Math.max(1, stage.clientWidth), H = Math.max(1, stage.clientHeight), fr = photo.frame;
  const vf = frameVFov(), vc = 2 * Math.atan(Math.tan(vf / 2) * H / fr.h);   // canvas fov that puts the lens's view in the frame
  // where the camera points
  let dir;
  if (mode === 'walk') dir = new THREE.Vector3(-Math.sin(walk.yaw) * Math.cos(walk.pitch), Math.sin(walk.pitch), -Math.cos(walk.yaw) * Math.cos(walk.pitch));
  else dir = controls.target.clone().sub(camera.position);
  const pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
  let shift = 0;                                                    // in frame half-heights (NDC of the frame)
  // straight verticals is for eye-level shots; an aerial view (steeper than 35°) tilts freely, as photographers do
  const levelNow = photo.level && Math.abs(pitch) < 35 * DEG;
  if (levelNow !== photo.levelNow) { photo.levelNow = levelNow; const t = $('.ph-tag'); if (t) t.textContent = photoTag(); }
  if (levelNow) {
    camera.up.set(0, 1, 0);
    camera.lookAt(camera.position.x + dir.x, camera.position.y, camera.position.z + dir.z);
    shift = clamp(Math.tan(pitch) / Math.tan(vf / 2), -1.6, 1.6);   // keep what you aimed at in the middle of the frame
  }
  photo.shift = shift; photo.pitch = pitch;
  const offY = (H / 2 - (fr.y + fr.h / 2)) - shift * fr.h / 2, offX = W / 2 - (fr.x + fr.w / 2);
  if (Math.abs(camera.fov - vc / DEG) > 1e-4 || !camera.view || !camera.view.enabled || Math.abs(camera.view.offsetY - offY) > 0.05 || Math.abs(camera.view.offsetX - offX) > 0.05) {
    camera.fov = vc / DEG;
    camera.setViewOffset(W, H, offX, offY, W, H);
  }
  camera.updateMatrixWorld();
}

// ---------------- the shutter ----------------
async function takePhoto() {
  if (photo.busy) return;
  photo.busy = true;
  const shutter = $('.ph-shutter'); shutter.classList.add('busy');
  const flash = $('.ph-flash'); flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
  buzz(18);
  await new Promise((r) => setTimeout(r, 30));
  const a = photoAspect(), cap = Math.min(renderer.capabilities.maxTextureSize || 4096, 8192);
  const long = Math.min(PHOTO_RES[photo.res] || 3072, cap);
  const W = Math.round(a >= 1 ? long : long * a), H = Math.round(a >= 1 ? long / a : long);
  const tempHQ = photo.hq && isFast();
  const keepQ = quality;
  try {
    if (tempHQ) { quality = 'high'; buildFixtures(); buildLights(); updateLighting(); }
    renderer.setPixelRatio(1); renderer.setSize(W, H, false); composer.setPixelRatio(1); composer.setSize(W, H);
    const vf = frameVFov();
    camera.aspect = W / H; camera.fov = vf / DEG;
    if (photo.shift) camera.setViewOffset(W, H, 0, -photo.shift * H / 2, W, H); else camera.clearViewOffset();
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    const above = camera.position.y > state.room.ceiling + 1;
    if (FX.stairwell) FX.stairwell.visible = !above;
    if (FX.screen) FX.screen.ceilingKit.visible = !above;
    const glow = !isFast() && state.light.bloom;
    flameUniforms.uDirect.value = glow ? 0 : 1;
    if (glow) { renderPass.camera = camera; composer.render(0.016); } else renderer.render(scene, camera);
    const cv = mkCanvas(W, H); cv.getContext('2d').drawImage(renderer.domElement, 0, 0, W, H);
    const type = photo.fmt === 'png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise((r) => cv.toBlob(r, type, 0.93));
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1-');
    photo.last = { blob, url: URL.createObjectURL(blob), W, H, name: `basement-cinema-${stamp}-${photo.mm}mm.${photo.fmt === 'png' ? 'png' : 'jpg'}`, cam: cameraData(W, H) };
  } catch (err) {
    console.error(err); toast('Could not take the picture');
  } finally {
    if (tempHQ) { quality = keepQ; buildFixtures(); buildLights(); updateLighting(); }
    resize(); photoCamera(); invalidate(3);
    shutter.classList.remove('busy'); photo.busy = false;
  }
  if (photo.last) showPhotoResult();
}

/** Everything a render app needs to match the shot: pose in metres (Y up), lens, sensor, aspect, shift. */
function cameraData(W, H) {
  const m = 0.0254, p = camera.position, d = new THREE.Vector3(); camera.getWorldDirection(d);
  const tgt = mode === 'walk' ? p.clone().addScaledVector(d, 100) : controls.target;
  const vf = frameVFov(), a = W / H;
  const r3 = (v) => [v.x, v.y, v.z].map((n) => Math.round(n * m * 1000) / 1000);
  return {
    app: 'Basement Cinema Planner', units: 'metres, Y up (glTF / three.js); plan inches below',
    position: r3(p), lookAt: photo.level ? r3(new THREE.Vector3(tgt.x, p.y, tgt.z)) : r3(tgt),
    focalLength35mm: photo.mm, sensor: '36 × 24 mm (full-frame equivalent, matched on the diagonal)',
    verticalFovDeg: +(vf / DEG).toFixed(2), horizontalFovDeg: +(hFovOf(vf, a) / DEG).toFixed(2),
    aspect: photo.aspect, image: `${W} × ${H}`,
    straightVerticals: !!photo.levelNow, lensShiftY: +(photo.shift / 2).toFixed(4),
    lensShiftNote: photo.level && photo.shift ? `Level camera with lens shift: in Blender set Shift Y = ${(photo.shift / 2 * Math.min(1, 1 / a)).toFixed(3)}` : 'No lens shift',
    exposureEV: photo.ev, lighting: (SCENES[state.light.scene] || {}).label || 'custom',
    plan: { x: +(p.x).toFixed(1), y: +(-p.z).toFixed(1), height: +(p.y).toFixed(1) },
  };
}

// ---------------- after the shot: share / save / hand off ----------------
async function shareFile(file, fallback) {
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: file.name }); return true; }
  } catch (e) { if (e && e.name === 'AbortError') return true; }
  fallback(); return false;
}
function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function showPhotoResult() {
  const L = photo.last, box = $('#photoResult'); box.hidden = false;
  const file = new File([L.blob], L.name, { type: L.blob.type });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const body = $('.ph-result-body', box); body.replaceChildren(
    h('img', { src: L.url, alt: 'Your photo', class: 'ph-shot' }),
    h('p', { class: 'ph-meta' }, `${L.W} × ${L.H} · ${photo.mm} mm · ${photo.aspect}${photo.levelNow ? ' · straight verticals' : ''} · ${(L.blob.size / 1048576).toFixed(1)} MB`),
    h('div', { class: 'ph-actions' },
      h('button', { class: 'btn primary', onclick: () => shareFile(file, () => { downloadBlob(L.blob, L.name); toast('Saved: open it from your downloads in your render app'); }) },
        canShare ? 'Share to an app…' : 'Download'),
      canShare ? h('button', { class: 'btn', onclick: () => downloadBlob(L.blob, L.name) }, 'Download') : null,
      window.ClipboardItem ? h('button', { class: 'btn', onclick: async () => {
        try { const png = L.blob.type === 'image/png' ? L.blob : await toPng(L.url); await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]); toast('Image copied'); }
        catch (e) { toast('This browser will not copy images: use Download'); }
      } }, 'Copy') : null),
    h('h4', {}, 'For a render app'),
    h('div', { class: 'ph-actions' },
      h('button', { class: 'btn', onclick: () => exportSceneGLB(L) }, 'Scene + camera (.glb)'),
      h('button', { class: 'btn', onclick: async () => {
        const txt = JSON.stringify(L.cam, null, 2);
        try { await navigator.clipboard.writeText(txt); toast('Camera data copied'); } catch (e) { downloadBlob(new Blob([txt], { type: 'application/json' }), L.name.replace(/\.\w+$/, '-camera.json')); }
      } }, 'Camera data')),
    h('p', { class: 'note' }, 'Share sends the picture to any app on your phone (a render or AI app, Photos, Messages). The .glb has the room, furniture and a camera named after this shot, so Blender, D5, SketchUp or Twinmotion open it with the same framing.'));
  $('.ph-result-done', box).focus();
}
async function toPng(url) {
  const img = new Image(); img.src = url; await img.decode();
  const c = mkCanvas(img.naturalWidth, img.naturalHeight); c.getContext('2d').drawImage(img, 0, 0);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}
/** The whole room (no labels or helpers) in metres, with a glTF camera matching the shot. */
function exportSceneGLB(L) {
  toast('Building the 3D scene…');
  setTimeout(() => {
    try {
      const top = new THREE.Group(); top.name = 'Basement cinema';
      const root = new THREE.Group(); root.name = 'room'; root.scale.setScalar(0.0254); top.add(root);
      for (const g of [roomGroup, fixturesGroup, itemsGroup]) root.add(g.clone(true));
      const lights = []; root.traverse((o) => { if (o.isLight || o.isCSS2DObject) lights.push(o); });
      for (const o of lights) o.parent && o.parent.remove(o);
      flattenInstances(root);
      const vf = frameVFov(), a = L.W / L.H;
      const cam = new THREE.PerspectiveCamera(vf / DEG, a, 0.02, 60);
      cam.name = `Photo ${photo.mm}mm ${photo.aspect}`;
      cam.position.copy(camera.position).multiplyScalar(0.0254); cam.quaternion.copy(camera.quaternion);
      cam.userData = L.cam; top.add(cam); top.updateMatrixWorld(true);
      new GLTFExporter().parse(top, (buf) => {
        const blob = new Blob([buf], { type: 'model/gltf-binary' }), name = L.name.replace(/\.\w+$/, '.glb');
        shareFile(new File([blob], name, { type: 'model/gltf-binary' }), () => downloadBlob(blob, name));
        toast(`${name} ready`);
      }, (err) => { console.error(err); toast('Could not build the 3D scene'); }, { binary: true, onlyVisible: true, maxTextureSize: 2048 });
    } catch (err) { console.error(err); toast('Could not build the 3D scene'); }
  }, 30);
}

// ---------------- viewpoints ----------------
const PHOTO_PRESETS = [['overview', 'Overview'], ['sofa', 'From sofa'], ['tvwall', 'TV wall'], ['lounge', 'Fireplace'], ['stairs', 'From stairs']];
function saveShot() {
  state.shots = state.shots || [];
  const shot = { name: `Shot ${state.shots.length + 1}`, mode, mm: photo.mm, aspect: photo.aspect, level: photo.level,
    pos: camera.position.toArray().map((n) => +n.toFixed(2)), tgt: controls.target.toArray().map((n) => +n.toFixed(2)),
    walk: mode === 'walk' ? { x: walk.pos.x, y: walk.pos.y, z: walk.pos.z, yaw: walk.yaw, pitch: walk.pitch } : null };
  state.shots.push(shot); save(); toast(`${shot.name} saved with the layout`);
}
function goShot(s) {
  photo.mm = s.mm; photo.aspect = s.aspect; photo.level = s.level;
  if (s.mode === 'walk' && s.walk) {
    if (mode !== 'walk') setMode('walk');
    walk.pos.set(s.walk.x, s.walk.y, s.walk.z); walk.yaw = s.walk.yaw; walk.pitch = s.walk.pitch;
  } else {
    if (mode !== 'orbit') setMode('orbit');
    tween = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...s.pos), t1: new THREE.Vector3(...s.tgt) };
  }
  labelsGroup.visible = false; renderPhotoUI(); photoLayout();
}
function photoMenu(kind, anchor) {
  const m = $('#photoMenu');
  if (!m.hidden && m.dataset.kind === kind) { m.hidden = true; return; }
  m.dataset.kind = kind; m.replaceChildren();
  const item = (label, fn, sel, extra) => h('div', { class: 'ph-mi' + (sel ? ' sel' : '') }, h('button', { onclick: () => { m.hidden = true; fn(); } }, label), extra || null);
  if (kind === 'views') {
    m.append(h('h4', {}, 'Viewpoints'));
    for (const [k, label] of PHOTO_PRESETS) m.append(item(label, () => { goPreset(k); labelsGroup.visible = false; photoLayout(); }));
    if ((state.shots || []).length) {
      m.append(h('h4', {}, 'Your shots'));
      state.shots.forEach((s, i) => m.append(item(`${s.name} · ${s.mm} mm ${s.aspect}`, () => goShot(s), false,
        h('button', { class: 'ph-x', 'aria-label': `Delete ${s.name}`, onclick: (e) => { e.stopPropagation(); state.shots.splice(i, 1); save(); photoMenu('views', anchor); photoMenu('views', anchor); } }, '✕'))));
    }
    m.append(h('div', { class: 'ph-mi add' }, h('button', { onclick: () => { m.hidden = true; saveShot(); } }, '＋ Save this view')));
  } else if (kind === 'settings') {
    const row = (label, ...kids) => h('div', { class: 'ph-row' }, h('span', {}, label), h('div', { class: 'chips' }, ...kids));
    const chip = (text, on, fn) => h('button', { class: 'chip', 'aria-pressed': String(on), onclick: () => { fn(); savePhotoPrefs(); renderPhotoUI(); photoLayout(); photoMenu('settings', anchor); photoMenu('settings', anchor); } }, text);
    m.append(h('h4', {}, 'Capture'),
      row('Resolution', ...Object.keys(PHOTO_RES).map((k) => chip(`${k}`, photo.res === k, () => { photo.res = k; }))),
      row('Format', chip('JPEG', photo.fmt === 'jpeg', () => { photo.fmt = 'jpeg'; }), chip('PNG', photo.fmt === 'png', () => { photo.fmt = 'png'; })),
      row('Render', chip('High quality', photo.hq, () => { photo.hq = true; }), chip('As on screen', !photo.hq, () => { photo.hq = false; })),
      row('Verticals', chip('Straight', photo.level, () => { photo.level = true; }), chip('Free tilt', !photo.level, () => { photo.level = false; })),
      h('p', { class: 'note' }, 'High quality adds the glow and the soft area light for the shot only, so the live view stays fast. Long edge: 2K 2048 px, 3K 3072 px, 4K 4096 px. Straight verticals keeps an eye-level camera level and shifts the lens; views steeper than 35° tilt freely.'));
  }
  m.hidden = false;
  const r = anchor.getBoundingClientRect(), app = $('#app').getBoundingClientRect();
  m.style.top = `${r.bottom - app.top + 6}px`;
  m.style.left = `${Math.max(8, Math.min(r.left - app.left, app.width - m.offsetWidth - 8))}px`;
}

// ---------------- the controls ----------------
function renderPhotoUI() {
  const ui = $('#photoUI');
  const seg = (label, on, fn) => h('button', { 'aria-pressed': String(on), onclick: fn }, label);
  const top = h('div', { class: 'ph-top' },
    h('button', { class: 'ph-ic', 'aria-label': 'Leave photo mode', title: 'Leave photo mode (Esc)', onclick: exitPhoto }, '✕'),
    h('div', { class: 'seg' },
      seg('3D', mode !== 'walk', () => { setMode('orbit'); labelsGroup.visible = false; renderPhotoUI(); photoLayout(); }),
      seg('Walk', mode === 'walk', () => { setMode('walk'); walk.pos.y = photo.eye; labelsGroup.visible = false; renderPhotoUI(); photoLayout(); })),
    h('button', { class: 'ph-pill', onclick: (e) => photoMenu('views', e.currentTarget) }, h('span', { class: 'wide-label' }, 'Viewpoints'), h('span', { class: 'narrow-label' }, 'Views'), ' ▾'),
    h('span', { class: 'spacer' }),
    (() => {
      const s = h('select', { class: 'ph-pill', 'aria-label': 'Aspect ratio', onchange: (e) => { photo.aspect = e.target.value; savePhotoPrefs(); photoLayout(); } },
        Object.keys(PHOTO_ASPECTS).map((k) => h('option', { value: k, selected: k === photo.aspect }, k)));
      return s;
    })(),
    h('button', { class: 'ph-ic', 'aria-pressed': String(photo.grid), 'aria-label': 'Thirds grid', title: 'Thirds grid', onclick: () => { photo.grid = !photo.grid; savePhotoPrefs(); renderPhotoUI(); photoLayout(); } }, '#'),
    h('button', { class: 'ph-ic', 'aria-label': 'Capture settings', title: 'Capture settings', onclick: (e) => photoMenu('settings', e.currentTarget) }, '⚙'));
  const lenses = h('div', { class: 'ph-lenses', role: 'group', 'aria-label': 'Lens' },
    PHOTO_LENSES.map((mm) => h('button', { 'aria-pressed': String(photo.mm === mm), onclick: () => setLens(mm, true) }, `${mm}`)),
    h('span', { class: 'ph-unit' }, 'mm'));
  const level = h('button', { class: 'ph-level', 'aria-pressed': String(photo.level), title: 'Straight verticals: keep the camera level and shift the lens instead of tilting',
    onclick: () => { photo.level = !photo.level; savePhotoPrefs(); renderPhotoUI(); photoLayout(); } }, '⊥ Level');
  const walkRow = h('div', { class: 'ph-walk' },
    ...(mode === 'walk' ? [[42, 'Seated'], [60, 'Eye'], [72, 'High']].map(([y, label]) => h('button', { class: 'chip', 'aria-pressed': String(photo.eye === y),
      onclick: () => { photo.eye = y; walk.pos.y = y; savePhotoPrefs(); renderPhotoUI(); invalidate(3); } }, `${label} ${ftin(y)}`))
      : [h('span', { class: 'ph-gest' }, matchMedia('(pointer: coarse)').matches ? '1 finger orbit · 2 pan · pinch = lens' : 'drag orbit · right-drag pan · Ctrl+wheel = lens')]),
    h('span', { class: 'spacer' }),
    ...[[1, '▲'], [-1, '▼']].map(([d, t]) => {
      const b = h('button', { class: 'ph-ic walkbtn', 'aria-label': d > 0 ? 'Move in' : 'Move back', title: 'Hold to move' }, t);
      const set = (v) => { if (mode === 'walk') walk.pad = v; else photo.dolly = v; invalidate(2); };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); set(d); });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => set(0));
      return b;
    }));
  const exposure = h('input', { type: 'range', min: -2, max: 2, step: 0.1, value: String(photo.ev), 'aria-label': 'Exposure' });
  const evOut = h('span', { class: 'ph-ev' }, `${photo.ev > 0 ? '+' : ''}${photo.ev.toFixed(1)} EV`);
  exposure.addEventListener('input', () => { photo.ev = parseFloat(exposure.value); renderer.toneMappingExposure = BASE_EXPOSURE * 2 ** photo.ev; evOut.textContent = `${photo.ev > 0 ? '+' : ''}${photo.ev.toFixed(1)} EV`; invalidate(2); });
  exposure.addEventListener('dblclick', () => { exposure.value = '0'; exposure.dispatchEvent(new Event('input')); });
  const sceneSel = h('select', { class: 'ph-pill', 'aria-label': 'Lighting', onchange: (e) => { applyScene(e.target.value); renderLighting(); invalidate(3); } },
    Object.entries(SCENES).map(([k, s]) => h('option', { value: k, selected: state.light.scene === k }, s.label)));
  const bottom = h('div', { class: 'ph-bottom' },
    h('div', { class: 'ph-controls' },
      h('div', { class: 'ph-line' }, lenses, level),
      walkRow,
      h('div', { class: 'ph-line' }, h('span', { class: 'ph-sun', 'aria-hidden': 'true' }, '☀'), exposure, evOut, sceneSel)),
    h('button', { class: 'ph-shutter', 'aria-label': 'Take photo', title: 'Take photo (Space)', onclick: takePhoto }, h('i')));
  ui.replaceChildren(top, h('div', { class: 'ph-frame' }, h('span', { class: 'ph-tag' }), h('i', { class: 'ph-horizon' })), bottom, h('div', { class: 'ph-flash' }));
}

/** Set the focal length (continuous); the chips and the frame label follow live. */
function setLens(mm, commit = false) {
  photo.mm = Math.round(clamp(mm, LENS_MIN, LENS_MAX));
  $$('.ph-lenses button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.textContent) === photo.mm)));
  const t = $('.ph-tag'); if (t) t.textContent = photoTag();
  invalidate(2);
  if (commit) savePhotoPrefs();
}
// ---- live gestures: pinch zooms the lens (both modes); in walk, two fingers also move you ----
const pinch = { pts: new Map(), d0: 0, mm0: 24, mid0: null };
const pinchMid = () => { const p = [...pinch.pts.values()]; return [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2]; };
const pinchDist = () => { const p = [...pinch.pts.values()]; return Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); };
/** Move the walking camera by forward / sideways inches, staying a body's width off the walls. */
function walkBy(fwd, side) {
  const fw = new THREE.Vector3(-Math.sin(walk.yaw), 0, -Math.cos(walk.yaw)), rt = new THREE.Vector3(Math.cos(walk.yaw), 0, -Math.sin(walk.yaw));
  const next = walk.pos.clone().addScaledVector(fw, fwd).addScaledVector(rt, side), m = 9;
  if (insideRoom(next.x + m, -walk.pos.z) && insideRoom(next.x - m, -walk.pos.z)) walk.pos.x = next.x;
  if (insideRoom(walk.pos.x, -next.z + m) && insideRoom(walk.pos.x, -next.z - m)) walk.pos.z = next.z;
  invalidate(2);
}
function initPhotoGestures() {
  const cv = renderer.domElement;
  cv.addEventListener('pointerdown', (e) => {
    if (!photo.on || e.pointerType !== 'touch') return;
    controls.enableZoom = false;                                        // fingers pan and zoom the lens, never dolly
    pinch.pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch.pts.size === 2) { pinch.d0 = Math.max(10, pinchDist()); pinch.mm0 = photo.mm; pinch.mid0 = pinchMid(); }
  }, true);
  cv.addEventListener('pointermove', (e) => {
    if (!photo.on || !pinch.pts.has(e.pointerId)) return;
    pinch.pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch.pts.size !== 2) return;
    setLens(pinch.mm0 * pinchDist() / pinch.d0);                       // spread = longer lens (zoom in)
    if (mode === 'walk') {                                              // two-finger drag: up = forward, sideways = step
      const [mx, my] = pinchMid();
      walkBy((pinch.mid0[1] - my) * 0.35, (pinch.mid0[0] - mx) * 0.35);
      pinch.mid0 = [mx, my];
    }
  }, true);
  const up = (e) => {
    if (pinch.pts.delete(e.pointerId) && pinch.pts.size < 2) savePhotoPrefs();
    if (!pinch.pts.size) controls.enableZoom = true;                    // the mouse wheel still moves in
  };
  cv.addEventListener('pointerup', up, true); cv.addEventListener('pointercancel', up, true);
  // desktop: Ctrl+wheel (and trackpad pinch) zooms the lens; the wheel moves in 3D (orbit dolly) and walks in Walk
  window.addEventListener('wheel', (e) => {
    if (!photo.on || e.target !== cv) return;
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); e.stopImmediatePropagation(); setLens(photo.mm * Math.exp(-e.deltaY * 0.006), true); }
    else if (mode === 'walk') { e.preventDefault(); walkBy(-e.deltaY * 0.12, 0); }
  }, { capture: true, passive: false });
}
function initPhoto() {
  initPhotoGestures();
  $('#photoBtn').addEventListener('click', enterPhoto);
  $('#photoResult .ph-result-done').addEventListener('click', () => { $('#photoResult').hidden = true; });
  $('#photoResult').addEventListener('click', (e) => { if (e.target.id === 'photoResult') $('#photoResult').hidden = true; });
  document.addEventListener('pointerdown', (e) => { const m = $('#photoMenu'); if (!m.hidden && !m.contains(e.target) && !e.target.closest('.ph-top')) m.hidden = true; });
  window.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '') && (e.target.type !== 'range');
    if (!photo.on) {
      if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !typing && $('#codeModal').hidden && $('#compareModal').hidden && $('#specModal').hidden) enterPhoto();
      return;
    }
    if (e.key === 'Escape') { if (!$('#photoResult').hidden) $('#photoResult').hidden = true; else exitPhoto(); }
    else if (e.code === 'Space' && !/BUTTON/.test((e.target || {}).tagName || '')) { e.preventDefault(); takePhoto(); }
    // in photo mode only the walking keys reach the room (editing and view shortcuts are off)
    if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code) || typing) e.stopImmediatePropagation();
  }, true);
}
