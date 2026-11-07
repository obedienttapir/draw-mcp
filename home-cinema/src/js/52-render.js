// ===================================================================
// 52 · Rendering pipeline
//  - Progressive: while the camera (or a piece) moves, a quick frame at whatever resolution keeps up
//    (adaptive, no ambient occlusion); as soon as it stops, one full frame: full resolution, ambient
//    occlusion (soft contact shadows in corners and under furniture), glow in High, 4× MSAA.
//    Interaction stays smooth in both modes and the still picture is the best the device can draw.
//  - Bounce light: the room is captured from its middle into a cube map and used as the scene's
//    environment, so walls, floor and the lighting scene tint everything (one bounce of indirect
//    light, plus matching reflections). It is recaptured only when the room, finishes, lights or
//    layout change, never per frame.
// ===================================================================
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// A few materials (sheen fabrics with deep bump maps, at grazing angles) can shade an odd pixel to NaN. On its own
// that's one dark speck, but a blur (the glow, or the bounce-light map) spreads it into black blotches, so every
// picture is cleaned right after it's drawn: NaN or infinite pixels become black, negatives become zero.
const NAN_GUARD_GLSL = `
  vec4 nanGuard(vec4 c) {
    if (any(isnan(c)) || any(isinf(c))) return vec4(0.0, 0.0, 0.0, 1.0);
    return max(c, vec4(0.0));
  }`;
const NanGuardShader = {
  name: 'NanGuardShader',
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; ${NAN_GUARD_GLSL}
    void main() { gl_FragColor = nanGuard(texture2D(tDiffuse, vUv)); }`,
};

const RQ = {                                         // per display quality: pixel ratios and effects
  fast: { still: 1.5, move: 1, bloom: true, env: 160 },     // glow runs at half resolution: cheap enough everywhere
  high: { still: 2, move: 1.25, bloom: true, env: 256 },
};
const rq = () => RQ[isFast() ? 'fast' : 'high'];
let moveScale = 1;                                    // adaptive factor on the moving-frame resolution

/** A composer rendering into a 4× MSAA half-float target, with optional ambient occlusion and glow. */
function makeComposer(withAO) {
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const c = new EffectComposer(renderer, rt);
  const rp = new RenderPass(scene, camera); c.addPass(rp);
  c.addPass(new ShaderPass(NanGuardShader));
  let ao = null;
  if (withAO) {
    ao = new GTAOPass(scene, camera, 1, 1);
    // world units are inches: look about 16″ around each point for occluders
    ao.updateGtaoMaterial({ radius: 16, distanceExponent: 1.4, thickness: 6, scale: 1.05, samples: 16, distanceFallOff: 1 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    ao.blendIntensity = 0.85;
    c.addPass(ao);
  }
  // glow only from light sources (LEDs, flames, lamps, hot spots), not from walls brightened by the bounce light
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.38, 0.42, 1.6); c.addPass(bloom);
  c.addPass(new OutputPass());
  return { c, rp, ao, bloom };
}
let PIPE = null;
function initPipeline() {
  PIPE = { move: makeComposer(false), still: makeComposer(true) };
  sizePipeline();
}
const stillPR = () => (forcePR || Math.min(window.devicePixelRatio || 1, rq().still));
const movePR = () => (forcePR || clamp(Math.min(window.devicePixelRatio || 1, rq().move) * moveScale, 0.45, stillPR()));
function sizePipeline() {
  if (!PIPE) return;
  const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
  PIPE.still.c.setPixelRatio(stillPR()); PIPE.still.c.setSize(w, h);
  PIPE.move.c.setPixelRatio(movePR()); PIPE.move.c.setSize(w, h);
}
/** Draw the view with one of the composers ('move' quick, 'still' full). */
function drawView(cam, which) {
  updateShadowsIfDirty();
  const p = PIPE[which], glow = rq().bloom && state.light.bloom && mode !== 'plan';
  p.rp.camera = cam;
  if (p.ao) { p.ao.camera = cam; p.ao.enabled = !!cam.isPerspectiveCamera; }   // the AO shader is built for a perspective camera: off in Plan
  p.bloom.enabled = glow;
  flameUniforms.uDirect.value = glow ? 0 : 1;
  p.c.render(0.016);
}
/** One full-quality frame at an explicit size into the canvas (photos, thumbnails, print). Call resize() after. */
function drawStillAt(cam, W, H) {
  // 3K/4K photos: no MSAA (the pixel density does the anti-aliasing), which keeps a 4K shot from needing ~1 GB of GPU memory
  const big = W * H > 3.5e6;
  if (big) setSamples(PIPE.still.c, 0);
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  PIPE.still.c.setPixelRatio(1); PIPE.still.c.setSize(W, H);
  drawView(cam, 'still');
  if (big) setSamples(PIPE.still.c, 4);                 // the picture is already in the canvas; normal frames get MSAA back
}
function setSamples(c, n) {
  for (const rt of [c.renderTarget1, c.renderTarget2]) if (rt.samples !== n) { rt.samples = n; rt.dispose(); }
}

// ---------------- shadows ----------------
let shadowsDirty = true;
/** Lights, room or furniture changed: redraw the shadow maps with the next frame. */
function markShadowsDirty() { shadowsDirty = true; invalidate(2); }
/** Every solid surface receives shadows; furniture, fixtures, walls and stairs cast them (the ceiling doesn't). */
function flagShadows() {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    const solid = m && (!m.transparent || m === M.bulkhead) && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial);
    o.receiveShadow = !!solid;
    o.castShadow = !!solid && o.name !== 'ceiling' && !o.userData.noShadow;
  });
}
function updateShadowsIfDirty() {
  if (!shadowsDirty) return;
  shadowsDirty = false;
  flagShadows();
  renderer.shadowMap.needsUpdate = true;              // consumed by the next render call
}
/** A light that casts a soft shadow; world units are inches. */
function shadowize(light, size) {
  light.castShadow = true;
  light.shadow.mapSize.set(size, size);
  light.shadow.camera.near = 4; light.shadow.camera.far = 420;
  light.shadow.bias = -0.0005; light.shadow.normalBias = 0.8; light.shadow.radius = 3;
  return light;
}

// ---------------- bounce light ----------------
let envCube = null, envCam = null, envRT = null, envDirty = true, envTimer = 0;
let guardCube = null, guardCam = null;
// the capture is copied through the same guard (a cube drawn inside out, sampling the capture) before it's blurred
const guardCubeMat = new THREE.ShaderMaterial({
  uniforms: { src: { value: null } }, side: THREE.BackSide, depthTest: false, depthWrite: false,
  vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform samplerCube src; varying vec3 vDir; ${NAN_GUARD_GLSL}
    void main() { gl_FragColor = nanGuard(textureCube(src, normalize(vDir))); }`,
});
const guardScene = new THREE.Scene(); guardScene.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), guardCubeMat));
/** Something lit or coloured changed: recapture the room's light once things settle. */
function markEnvDirty(delay = 250) {
  clearTimeout(envTimer);
  envTimer = setTimeout(() => { envDirty = true; invalidate(2); }, delay);
}
function captureEnv() {
  envDirty = false;
  const size = rq().env;
  if (!envCube || envCube.width !== size) {
    if (envCube) { envCube.dispose(); guardCube.dispose(); }
    envCube = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
    envCam = new THREE.CubeCamera(2, 4000, envCube);
    guardCube = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
    guardCam = new THREE.CubeCamera(0.1, 10, guardCube);
  }
  const r = state.room, G = geom();
  envCam.position.copy(P(r.width * 0.55, G.mainY * 0.5, 52));          // middle of the room, seated eye height
  envCam.updateMatrixWorld(true);
  const keep = { l: labelsGroup.visible, h: helpersGroup.visible, sw: FX.stairwell ? FX.stairwell.visible : null, g: ghosted, env: scene.environment };
  labelsGroup.visible = false; helpersGroup.visible = false;
  if (FX.stairwell) FX.stairwell.visible = true;
  ghostBulkheads(false);
  scene.environment = null;                                               // one clean bounce: no feedback between captures
  flameUniforms.uDirect.value = 1;
  updateShadowsIfDirty();
  envCam.update(renderer, scene);
  guardCubeMat.uniforms.src.value = envCube.texture; guardCam.update(renderer, guardScene);
  const rt = pmrem.fromCubemap(guardCube.texture);
  if (envRT) envRT.dispose();
  envRT = rt; scene.environment = rt.texture;
  labelsGroup.visible = keep.l; helpersGroup.visible = keep.h;
  if (FX.stairwell && keep.sw != null) FX.stairwell.visible = keep.sw;
  if (keep.g != null) ghostBulkheads(keep.g);
}
