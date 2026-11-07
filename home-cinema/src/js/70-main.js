// ===================================================================
// 70 · Boot, post-processing, render loop
// ===================================================================
initMaterials();
const restored = loadSaved();
initControls();

initPipeline();                                       // composers: quick frames while moving, full frames when still (52-render)

rebuildAll();
initTabs(); initCodeDialog(); initPanels(); initStyleUI(); initSheet(); initPhoto(); refreshPanels();

$('#mode-orbit').addEventListener('click', () => setMode('orbit'));
$('#mode-plan').addEventListener('click', () => setMode('plan'));
$('#mode-walk').addEventListener('click', () => setMode('walk'));
$$('#presets button').forEach((b) => b.addEventListener('click', () => goPreset(b.dataset.preset)));
$('#measureBtn').addEventListener('click', () => setMeasure(!measure.on));
$('#undoBtn').addEventListener('click', undo);
$$('#walkpad button').forEach((b) => {
  const dir = parseFloat(b.dataset.walk);
  const on = (e) => { e.preventDefault(); walk.pad = dir; };
  const off = () => { walk.pad = 0; };
  b.addEventListener('pointerdown', on);
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, off);
});

function resize() {
  const w = Math.max(1, stage.clientWidth), hgt = Math.max(1, stage.clientHeight);
  renderer.setPixelRatio(stillPR());
  renderer.setSize(w, hgt, false); sizePipeline(); labelRenderer.setSize(w, hgt);
  camera.aspect = w / hgt; camera.updateProjectionMatrix(); applyViewInset(viewInset);
  if (photo.on) photoLayout();
  if (mode === 'plan') fitPlan();
  invalidate(2);
}
resize();
window.addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
goPreset('overview', true);
updateLabels();

/** Switch display quality; lights are rebuilt for the chosen path. */
function setQuality(q) {
  quality = q === 'high' ? 'high' : 'fast';
  try { localStorage.setItem(QUALITY_KEY, quality); } catch (e) { /* preference stays for this visit */ }
  dprScale = 1; moveScale = 1;
  $('#app').classList.toggle('fast', isFast());
  buildFixtures(); buildLights(); updateLighting(); drawOutline(); updateLabels(); resize(); renderLighting(); markEnvDirty(0);
  toast(isFast() ? 'Standard: smooth on phones and laptops' : 'High: every light fitting, soft area light and glow');
}
$('#app').classList.toggle('fast', isFast());

let ghosted = null;
function ghostBulkheads(on) {
  if (ghosted === on) return;
  ghosted = on;
  M.bulkhead.transparent = on; M.bulkhead.opacity = on ? 0.16 : 1; M.bulkhead.depthWrite = !on; M.bulkhead.needsUpdate = true;
}

// any input may change the picture: draw a few frames after it (plain hover does not)
for (const ev of ['pointerdown', 'pointerup', 'wheel', 'keydown', 'keyup', 'input', 'change', 'click', 'touchstart', 'touchmove']) {
  window.addEventListener(ev, () => invalidate(3), { passive: true, capture: true });
}
window.addEventListener('pointermove', (e) => { if (e.buttons || walk.dragging || drag) invalidate(2); }, { passive: true, capture: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) invalidate(3); });

const clock = new THREE.Timer();                     // THREE.Clock is deprecated (r168+)
const _frustum = new THREE.Frustum(), _pv = new THREE.Matrix4(), _fireBall = new THREE.Sphere();
function fireInView() {
  if (mode === 'plan') return false;
  activeCam.updateMatrixWorld();
  _frustum.setFromProjectionMatrix(_pv.multiplyMatrices(activeCam.projectionMatrix, activeCam.matrixWorldInverse));
  _fireBall.center.setFromMatrixPosition(FX.fire.group.matrixWorld); _fireBall.radius = state.fireplace.width * 0.75;
  return _frustum.intersectsSphere(_fireBall);
}
let lastFlame = -1, lastRaf = 0, drewLast = false, slowScore = 0, fastFrames = 0, lastScale = 0, paused = false;
let moveUntil = 0, lastWasMove = false, lastWasStill = false, stillSlow = false, lastDragShadow = 0;
function sizeMove() { const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight); PIPE.move.c.setPixelRatio(movePR()); PIPE.move.c.setSize(w, h); }
function frame(now) {
  requestAnimationFrame(frame);
  if (paused) return;                                 // batch rendering: frames are drawn only by capture()
  const rafGap = now - lastRaf; lastRaf = now;
  if (lastWasStill) stillSlow = rafGap > 70;          // how long the GPU took over the last full frame (any length counts)
  clock.update(now);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.getElapsed();
  let active = false, moving = false;                 // moving: the view or a piece is changing (quick frames)
  if (mode === 'walk') { if (walk.keys.size || walk.pad || walk.dragging) moving = true; stepWalk(dt); }
  else {
    if (tween) moving = true;
    stepTween(dt);
    if ((mode === 'plan' ? planControls : controls).update()) moving = true;   // true while moving or easing
  }
  if (drag && drag.moved) { moving = true; if (now - lastDragShadow > 200) { lastDragShadow = now; markShadowsDirty(); } }
  if (moving) { moveUntil = now + 160; active = true; }
  const inMove = now < moveUntil;
  photoCamera();                                      // photo mode: level camera, lens, frame-centred projection
  if (FX.screen) {                                    // motorised screen rolls down / up
    const target = state.light.screenDown ? 1 : 0.02;
    if (Math.abs(FX.screen.cur - target) > 0.001) {
      FX.screen.cur += Math.sign(target - FX.screen.cur) * Math.min(Math.abs(target - FX.screen.cur), dt * 0.5);
      FX.screen.sheet.scale.y = FX.screen.cur; active = true;
    }
  }
  // the flame animates only while it is on screen: with the quick frames while you move, and at a gentle rate on the
  // full-quality picture when you stop (slower still if the device takes long to draw a full frame)
  // (a device that takes long over a full frame keeps the flame still until you move again: no work while idle)
  const flameDt = inMove ? 1 / 30 : stillSlow ? Infinity : isFast() ? 1 / 15 : 1 / 12;
  if (FX.fire && state.light.fire && t - lastFlame > flameDt && fireInView()) {
    lastFlame = t;
    flameUniforms.uTime.value = t;
    FX.fire.light.intensity = FIRE_CD * (0.85 + 0.18 * Math.sin(t * 7.3) + 0.1 * Math.sin(t * 13.7 + 1.3));
    active = true;
  }
  if (active) invalidate(1);
  if (!inMove && lastWasMove) invalidate(1);          // just stopped: draw the full-quality frame
  if (envDirty && !inMove) { captureEnv(); invalidate(1); }   // the room's light changed: recapture the bounce
  if (dirty <= 0) { drewLast = false; lastWasStill = false; return; }   // idle: no GPU work at all
  dirty--;
  const above = viewFromAbove(activeCam);
  if (FX.stairwell) FX.stairwell.visible = mode !== 'plan' && !above;
  if (FX.screen) FX.screen.ceilingKit.visible = mode !== 'plan' && !above;
  ghostBulkheads(mode === 'plan' || above);
  if (sightline) { const far = activeCam.position.distanceTo(sightline.eye) > 30; for (const o of sightline.objs) o.visible = far; }
  const which = inMove ? 'move' : 'still';
  drawView(activeCam, which);
  labelRenderer.render(scene, activeCam);
  // moving frames: drop their resolution while they're slow, raise it back when there is headroom. Only back-to-back
  // moving frames count (a longer stall is a one-off, e.g. a shader compile); the full frame is never scaled down.
  if (which === 'move' && lastWasMove && rafGap < 1000) {
    if (rafGap > 34) { slowScore += Math.min(4, rafGap / 34); fastFrames = 0; } else if (rafGap < 20) { fastFrames++; slowScore = 0; }
    if (slowScore > 6 && moveScale > 0.35 && now - lastScale > 350) { moveScale = Math.max(0.35, moveScale * 0.8); slowScore = 0; lastScale = now; sizeMove(); }
    else if (fastFrames > 40 && moveScale < 1 && now - lastScale > 1200) { moveScale = Math.min(1, moveScale * 1.12); fastFrames = 0; lastScale = now; sizeMove(); }
  }
  lastWasMove = which === 'move'; lastWasStill = which === 'still';
  if (which === 'still') dirty = 0;                   // one full frame shows the change; redrawing it again adds nothing
  drewLast = true;
}
requestAnimationFrame(frame);
$('#loading').classList.add('done');
if (restored) toast('Restored your last layout from this browser');
// handy for debugging and automated checks
window.__cinema = {
  state: () => state, setMode, goPreset, applyScene, select, scene, selected: () => selected, mode: () => mode, loadOption,
  rebuild() { rebuildAll(); refreshPanels(); }, setQuality, quality: () => quality, dpr: () => renderer.getPixelRatio(),
  setStyle(id) { state.style.set = id; for (const it of state.items) delete it.s; buildAllItems(); updateLighting(); invalidate(3); },
  evaluate: (id, own = false) => evaluateSet(id, own), specRows: (id, own = false) => specRows(id, own), sets: () => SET_IDS,
  exposure(v) { renderer.toneMappingExposure = v; invalidate(3); },
  pause(v) { paused = !!v; invalidate(2); },
  showItems(v) { itemsGroup.visible = !!v; invalidate(2); },       // clean architectural views for print
  pixelRatio(v) { forcePR = v || 0; resize(); },
  /** Draw one frame now and return it as an image (renders and print artwork). */
  capture(type = 'image/png', q, flameT = 0) {
    if (flameT && FX.fire) { flameUniforms.uTime.value = flameT; FX.fire.light.intensity = state.light.fire ? FIRE_CD : 0; }
    const above = viewFromAbove(activeCam);
    if (FX.stairwell) FX.stairwell.visible = mode !== 'plan' && !above;
    if (FX.screen) FX.screen.ceilingKit.visible = mode !== 'plan' && !above;
    ghostBulkheads(mode === 'plan' || above);
    activeCam.updateMatrixWorld();
    if (envDirty) captureEnv();
    drawView(activeCam, 'still');
    labelRenderer.render(scene, activeCam);
    return type ? renderer.domElement.toDataURL(type, q) : '';
  },
  idle: () => dirty <= 0 && !envDirty, frames: () => renderer.info.render.frame,
  perf: () => ({ moveScale, movePR: movePR(), stillPR: stillPR(), slowScore, fastFrames, stillSlow, rafGap: performance.now() - lastRaf }), fireInView: () => !!FX.fire && fireInView(), camera: () => activeCam,
  view(px, py, pz, tx, ty, tz, fov = 50) { tween = null; camera.fov = fov; camera.updateProjectionMatrix(); camera.position.copy(P(px, py, pz)); controls.target.copy(P(tx, ty, tz)); controls.update(); invalidate(3); },
  settle() { if (FX.screen) { FX.screen.cur = state.light.screenDown ? 1 : 0.02; FX.screen.sheet.scale.y = FX.screen.cur; } invalidate(3); },
  /** Print artwork: a top-down plan at an explicit frame (plan inches per CSS px, centre) on a paper colour, without the
   *  overlay; returns the overlay's dimensions and tags (plan inches) so they can be redrawn as vectors. */
  planShot({ cx, cy, scale, bg = '#120f0c' }) {
    planLog = [];
    setMode('plan');
    const W = stage.clientWidth, H = stage.clientHeight;
    Object.assign(ortho, { left: -W / 2 * scale, right: W / 2 * scale, top: H / 2 * scale, bottom: -H / 2 * scale, zoom: 1 });
    ortho.position.copy(P(cx, cy, 1500)); ortho.up.set(0, 0, -1); ortho.lookAt(P(cx, cy, 0)); ortho.updateProjectionMatrix();
    labelsGroup.visible = false; scene.background = new THREE.Color(bg);
    const log = planLog; planLog = null;
    const G = geom(), r = state.room;
    return { W, H, log, room: { ...r }, geom: { mainY: G.mainY, westY: G.westY, hallY: G.hallY, hallEnd: G.hallEnd, tvX: G.tvX, bay: G.bay, outline: G.outline },
      items: state.items.map(({ id, type, x, y, rot, p }) => ({ id, type, x, y, rot, p })), seat: mainSeat(), stats: viewingStats(),
      speakers: speakerPlan(), fireplace: { ...state.fireplace }, tv: { ...state.tv } };
  },
  endPlanShot() { scene.background = new THREE.Color('#120f0c'); setMode('orbit'); labelsGroup.visible = true; },
  /** Everything the printed design review needs from the style study, for each set as designed (and the current mix). */
  studyData() {
    const pieces = (id, own) => state.items.map((it) => {
      const s = resolveSpec(it, id, own), v = (VARIANTS[it.type] || {})[s.variant];
      return { id: it.id, type: it.type, label: CATALOG[it.type].label, variant: v ? v.label : '', desc: v ? v.desc : '', spec: pieceSpecText(it, s),
        size: pieceSize(it, s).text, price: piecePrice(it, s), weeks: pieceWeeks(it, s), s };
    });
    const pack = (id, own) => {
      const e = evaluateSet(id, own);
      return { eval: e, totals: Object.fromEntries(Object.entries(WEIGHT_PRESETS).map(([k, w]) => [k, weightedTotal(e.scores, w)])),
        spec: specRows(id, own), pieces: pieces(id, own) };
    };
    return { sets: SET_IDS.map((id) => ({ id, ...STYLE_SETS[id], ...pack(id, false) })), mix: isCustomised() ? { base: activeSetId(), ...pack(activeSetId(), true) } : null,
      criteria: CRITERIA, presets: WEIGHT_PRESETS, covers: COVERS, woods: WOOD_FINISHES, metals: METAL_FINISHES, stones: STONE_FINISHES };
  },
  screenOf(x, y, z = 10) {
    activeCam.updateMatrixWorld();
    const v = P(x, y, z).project(activeCam), r = renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  },
};
