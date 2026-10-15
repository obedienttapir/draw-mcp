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
initTabs(); initCodeDialog(); initPanels(); refreshPanels();

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
  renderer.setSize(w, hgt, false); composer.setSize(w, hgt); labelRenderer.setSize(w, hgt);
  camera.aspect = w / hgt; camera.updateProjectionMatrix();
  if (mode === 'plan') fitPlan();
}
resize();
window.addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
goPreset('overview', true);
updateLabels();

let ghosted = null;
function ghostBulkheads(on) {
  if (ghosted === on) return;
  ghosted = on;
  M.bulkhead.transparent = on; M.bulkhead.opacity = on ? 0.16 : 1; M.bulkhead.depthWrite = !on; M.bulkhead.needsUpdate = true;
}

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (mode === 'walk') stepWalk(dt);
  else { stepTween(dt); (mode === 'plan' ? planControls : controls).update(); }
  flameUniforms.uTime.value = t;
  if (FX.fire && state.light.fire) FX.fire.light.intensity = FIRE_CD * (0.85 + 0.18 * Math.sin(t * 7.3) + 0.1 * Math.sin(t * 13.7 + 1.3));
  if (FX.stairwell) FX.stairwell.visible = mode !== 'plan' && activeCam.position.y < state.room.ceiling + 1;
  if (FX.screen) FX.screen.ceilingKit.visible = mode !== 'plan' && activeCam.position.y < state.room.ceiling + 1;
  if (FX.screen) {                                    // motorised screen rolls down / up
    const target = state.light.screenDown ? 1 : 0.02;
    if (Math.abs(FX.screen.cur - target) > 0.001) {
      FX.screen.cur += Math.sign(target - FX.screen.cur) * Math.min(Math.abs(target - FX.screen.cur), dt * 0.5);
      FX.screen.sheet.scale.y = FX.screen.cur;
    }
  }
  ghostBulkheads(mode === 'plan' || activeCam.position.y > state.room.ceiling + 1);
  if (sightline) { const far = activeCam.position.distanceTo(sightline.eye) > 30; for (const o of sightline.objs) o.visible = far; }
  if (state.light.bloom && mode !== 'plan') { renderPass.camera = activeCam; composer.render(dt); }
  else renderer.render(scene, activeCam);
  labelRenderer.render(scene, activeCam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
$('#loading').classList.add('done');
if (restored) toast('Restored your last layout from this browser');
// handy for debugging and automated checks
window.__cinema = {
  state: () => state, setMode, goPreset, applyScene, select, scene, selected: () => selected, mode: () => mode, loadOption,
  rebuild() { rebuildAll(); refreshPanels(); },
  view(px, py, pz, tx, ty, tz) { tween = null; camera.position.copy(P(px, py, pz)); controls.target.copy(P(tx, ty, tz)); controls.update(); },
  settle() { if (FX.screen) { FX.screen.cur = state.light.screenDown ? 1 : 0.02; FX.screen.sheet.scale.y = FX.screen.cur; } },
  screenOf(x, y, z = 10) {
    const v = P(x, y, z).project(activeCam), r = renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  },
};
