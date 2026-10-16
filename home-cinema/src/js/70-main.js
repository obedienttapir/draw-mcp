// ===================================================================
// 70 · Boot, post-processing, render loop
// ===================================================================
initMaterials();
const restored = loadSaved();
initControls();

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.55, 0.92);
composer.addPass(renderPass); composer.addPass(bloomPass); composer.addPass(new OutputPass());

rebuildAll();
initTabs(); initCodeDialog(); initPanels(); initStyleUI(); refreshPanels();

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
  renderer.setPixelRatio(pixelRatio());
  composer.setPixelRatio(renderer.getPixelRatio());
  renderer.setSize(w, hgt, false); composer.setSize(w, hgt); labelRenderer.setSize(w, hgt);
  camera.aspect = w / hgt; camera.updateProjectionMatrix();
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
  dprScale = 1;
  $('#app').classList.toggle('fast', isFast());
  buildFixtures(); buildLights(); updateLighting(); drawOutline(); updateLabels(); resize(); renderLighting();
  toast(isFast() ? 'Fast display: smooth on any computer' : 'High quality: glow and soft area light');
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

const clock = new THREE.Clock();
const _frustum = new THREE.Frustum(), _pv = new THREE.Matrix4(), _fireBall = new THREE.Sphere();
function fireInView() {
  if (mode === 'plan') return false;
  activeCam.updateMatrixWorld();
  _frustum.setFromProjectionMatrix(_pv.multiplyMatrices(activeCam.projectionMatrix, activeCam.matrixWorldInverse));
  _fireBall.center.setFromMatrixPosition(FX.fire.group.matrixWorld); _fireBall.radius = state.fireplace.width * 0.75;
  return _frustum.intersectsSphere(_fireBall);
}
let lastFlame = -1, lastRaf = 0, drewLast = false, slowScore = 0, fastFrames = 0, lastScale = 0, paused = false;
function frame(now) {
  requestAnimationFrame(frame);
  if (paused) return;                                 // batch rendering: frames are drawn only by capture()
  const rafGap = now - lastRaf; lastRaf = now;
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  let active = false;
  if (mode === 'walk') { if (walk.keys.size || walk.pad) active = true; stepWalk(dt); }
  else {
    if (tween) active = true;
    stepTween(dt);
    if ((mode === 'plan' ? planControls : controls).update()) active = true;   // true while moving or easing
  }
  if (FX.screen) {                                    // motorised screen rolls down / up
    const target = state.light.screenDown ? 1 : 0.02;
    if (Math.abs(FX.screen.cur - target) > 0.001) {
      FX.screen.cur += Math.sign(target - FX.screen.cur) * Math.min(Math.abs(target - FX.screen.cur), dt * 0.5);
      FX.screen.sheet.scale.y = FX.screen.cur; active = true;
    }
  }
  // the flame animates at 24 fps in fast mode, 50 in high, and only while it is on screen; nothing else needs a clock
  if (FX.fire && state.light.fire && t - lastFlame > (isFast() ? 1 / 24 : 1 / 50) && fireInView()) {
    lastFlame = t;
    flameUniforms.uTime.value = t;
    FX.fire.light.intensity = FIRE_CD * (0.85 + 0.18 * Math.sin(t * 7.3) + 0.1 * Math.sin(t * 13.7 + 1.3));
    active = true;
  }
  if (active) invalidate(1);
  if (dirty <= 0) { drewLast = false; return; }       // idle: no GPU work at all
  dirty--;
  const above = activeCam.position.y > state.room.ceiling + 1;
  if (FX.stairwell) FX.stairwell.visible = mode !== 'plan' && !above;
  if (FX.screen) FX.screen.ceilingKit.visible = mode !== 'plan' && !above;
  ghostBulkheads(mode === 'plan' || above);
  if (sightline) { const far = activeCam.position.distanceTo(sightline.eye) > 30; for (const o of sightline.objs) o.visible = far; }
  const glow = !isFast() && state.light.bloom && mode !== 'plan';
  flameUniforms.uDirect.value = glow ? 0 : 1;
  if (glow) { renderPass.camera = activeCam; composer.render(dt); }
  else renderer.render(scene, activeCam);
  labelRenderer.render(scene, activeCam);
  // fast mode: drop resolution while frames are slow, raise it back when there is headroom. Only back-to-back
  // frames count: the 24 fps flame draws every few display frames, and those gaps are not a sign of a slow GPU.
  if (isFast() && drewLast && rafGap < 1000) {          // (a longer stall is a one-off, e.g. a shader compile)
    // a frame under 24 fps adds to the score in proportion to how slow it was, so a very slow GPU adapts within seconds
    if (rafGap > 42) { slowScore += Math.min(4, rafGap / 42); fastFrames = 0; } else if (rafGap < 22) { fastFrames++; slowScore = 0; }
    if (slowScore > 12 && dprScale > 0.55 && now - lastScale > 700) { dprScale = Math.max(0.55, dprScale - 0.15); slowScore = 0; lastScale = now; resize(); }
    else if (fastFrames > 90 && dprScale < 1 && now - lastScale > 2500) { dprScale = Math.min(1, dprScale + 0.15); fastFrames = 0; lastScale = now; resize(); }
  }
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
    const above = activeCam.position.y > state.room.ceiling + 1;
    if (FX.stairwell) FX.stairwell.visible = mode !== 'plan' && !above;
    if (FX.screen) FX.screen.ceilingKit.visible = mode !== 'plan' && !above;
    ghostBulkheads(mode === 'plan' || above);
    activeCam.updateMatrixWorld();
    const glow = !isFast() && state.light.bloom && mode !== 'plan';
    flameUniforms.uDirect.value = glow ? 0 : 1;
    if (glow) { renderPass.camera = activeCam; composer.render(0.016); } else renderer.render(scene, activeCam);
    labelRenderer.render(scene, activeCam);
    return type ? renderer.domElement.toDataURL(type, q) : '';
  },
  idle: () => dirty <= 0, frames: () => renderer.info.render.frame, perf: () => ({ dprScale, slowScore, fastFrames, rafGap: performance.now() - lastRaf }), fireInView: () => !!FX.fire && fireInView(), camera: () => activeCam,
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
