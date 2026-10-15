// ===================================================================
// 30 · Lighting: pot lights, 2700K LED channels, scenes
// ===================================================================
const hemi = new THREE.HemisphereLight('#fff1e2', '#2a2119', 0.25);
scene.add(hemi);
const POT_CD = 11 * LUX;        // tuned to display exposure (a 650 lm wafer, scaled)
const LED_NITS = 2.2;

const FIRE_CD = 0.7 * LUX;
const LAMP_CD = 0.8 * LUX;
const LED_PT = 0.9 * LUX;      // fast mode: LED washes approximated by zone point lights
const TV_PT = 5 * LUX, SCREEN_PT = 4 * LUX;
const SCENES = {
  work:     { label: 'Bright',   pots: 1,    leds: 0.4, tv: false, fire: false, lamp: false, steps: false, screenDown: false },
  evening:  { label: 'Evening',  pots: 0.35, leds: 1,   tv: false, fire: true,  lamp: true,  steps: true,  screenDown: false },
  movie:    { label: 'Movie',    pots: 0,    leds: 0.18, tv: true, fire: false, lamp: false, steps: true,  screenDown: true },
  game:     { label: 'Game night', pots: 0.25, leds: 0.8, tv: true, fire: true,  lamp: true,  steps: true,  screenDown: false },
  fireside: { label: 'Fireside', pots: 0.08, leds: 0.7, tv: false, fire: true,  lamp: true,  steps: true,  screenDown: false },
};

function addPot(x, y, z, group) {
  // fast mode keeps the fixtures but lets a few zone lights do the lighting
  const light = isFast() ? null : new THREE.SpotLight('#ffd9b0', 0, 0, 52 * DEG, 0.75, 2);
  if (light) {
    light.position.copy(P(x, y, z - 0.6));
    light.target.position.copy(P(x, y, 0));
    group.add(light, light.target);
  }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.9, 24), M.potOff);
  disc.rotation.x = Math.PI / 2; disc.position.copy(P(x, y, z - 0.08));
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.6, 24), M.trim);
  ring.rotation.x = Math.PI / 2; ring.position.copy(P(x, y, z - 0.06));
  group.add(disc, ring);
  FX.pots.push({ light, disc });
}

/** Thin emissive strip from plan a -> b at height z, nudged by (ox, oy). */
function ledStrip(a, b, z, group, ox = 0, oy = 0) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.35, 0.35), M.led);
  m.rotation.y = Math.atan2(b[1] - a[1], b[0] - a[0]);
  m.position.copy(P((a[0] + b[0]) / 2 + ox, (a[1] + b[1]) / 2 + oy, z));
  group.add(m); FX.ledMeshes.push(m);
  return m;
}
function rectLight(w, h, pos, target, group, color = '#ffb36e') {
  if (isFast()) return null;                       // area lights are the most expensive thing to shade
  const l = new THREE.RectAreaLight(color, 0, w, h);
  l.position.copy(pos); group.add(l); l.lookAt(target);
  FX.leds.push(l);
  return l;
}

function buildLights() {
  disposeGroup(lightsGroup);
  FX.pots = []; FX.leds = []; FX.ledMeshes = []; FX.zones = [];
  const r = state.room, G = geom(), H = r.ceiling;
  lightsGroup.updateMatrixWorld(true);
  if (isFast()) {
    // one point light per zone stands in for that zone's pots (and its LED wash)
    const zone = (x, y, z, pots, led, color = '#ffd9b0') => {
      const l = new THREE.PointLight(color, 0, 0, 2); l.position.copy(P(x, y, z)); lightsGroup.add(l);
      FX.zones.push({ light: l, pots, led });
    };
    const bb = Math.min(r.beamBottom, H);
    zone(Math.max(r.beamDepth, 30) / 2, G.westY / 2, bb - 10, 2, 1.1, '#ffd2a0');                            // fireplace lounge
    zone((Math.max(r.beamDepth, 0) + r.width) / 2, G.mainY / 2, H - 12, 6, 0.35);                               // main room
    zone(G.tvX, G.mainY + r.bayDepth * 0.45, r.soffitBottom - 8, state.light.bayPots ? 2 : 0, 0.9, '#ffcf9a');  // TV alcove
    zone((r.boxX + G.hallEnd) / 2, (G.hallY - r.stairWidth) / 2 + 12, H - 12, 2, 0.1);                         // landing + hallway
  }

  // bay: two pots in front of the bulkhead face, washing the TV wall
  // two pots in front of the bulkhead face: they scallop the bulkhead like a pair of eyes and glare on the screen
  const bayPotY = r.depth - r.soffitDepth - 7;
  if (state.light.bayPots) for (const dx of [-24, 24]) addPot(G.tvX + dx, bayPotY, H, lightsGroup);
  // main ceiling grid (clear of the fireplace bulkhead)
  const x0 = Math.max(r.beamDepth, 0) + 8, x1 = r.width - 22;
  for (const fx of [0, 0.5, 1]) for (const fy of [0.24, 0.74]) addPot(lerp(x0 + 14, x1, fx), G.mainY * fy, H, lightsGroup);
  // fireplace bulkhead underside, the landing below it, and the hallway behind the stairs
  if (r.beamDepth > 12) for (const dy of [-34, 34]) addPot(r.beamDepth / 2 + 4, state.fireplace.center + dy, r.beamBottom, lightsGroup);
  if (r.beamDepth > r.boxX + 6 && r.beamBottom < H) addPot((r.boxX + r.beamDepth) / 2, -r.stairWidth / 2, r.beamBottom, lightsGroup);
  if (G.hallEnd - r.boxX > 30) addPot(Math.min(G.hallEnd - 18, (r.beamDepth + G.hallEnd) / 2 + 10), (G.hallY - r.stairWidth) / 2, H, lightsGroup);

  // LED channel under the bay bulkhead, tight to the bay walls
  const z = r.soffitBottom - 0.3, bay = G.bay;
  for (let i = 0; i < bay.length - 1; i++) {
    const [a, b] = [bay[i], bay[i + 1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 2) continue;
    const nx = (b[1] - a[1]) / len, ny = -(b[0] - a[0]) / len;   // walking L0..R0 the bay interior is on the right
    ledStrip(a, b, z, lightsGroup, nx * 1.2, ny * 1.2);
  }
  const fa = bay[2], fb = bay[3];
  rectLight(fb[0] - fa[0] - 4, 3, P((fa[0] + fb[0]) / 2, r.depth - 2, z - 0.4), P((fa[0] + fb[0]) / 2, r.depth - 6, 0), lightsGroup);
  for (const [a, b] of [[bay[1], bay[2]], [bay[3], bay[4]]]) {
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const l = rectLight(len - 4, 3, P(cx, cy, z - 0.4), P(cx, cy, 0), lightsGroup);
    if (l) l.lookAt(P(cx + (b[1] - a[1]) * 0.15, cy - (b[0] - a[0]) * 0.15, 0));
  }

  // vertical LED channels at both ends of the fireplace slat wall
  const top = r.beamDepth > 1 ? r.beamBottom : H;
  const face = state.finish.fireplaceSlats ? SLAT_FACE : 0;
  for (const [u, dir] of [[0.9, 1], [G.westY - 0.9, -1]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, top - 1, 0.5), M.led);
    m.position.copy(P(face * 0.5 + 0.4, u, top / 2)); lightsGroup.add(m); FX.ledMeshes.push(m);
    rectLight(2, top - 4, P(face + 2.5, u, top / 2), P(face + 2.5, u + dir * 20, top / 2), lightsGroup);
  }
  // cove along the edge of the fireplace bulkhead
  if (r.beamDepth > 1 && r.beamBottom < H) {
    ledStrip([r.beamDepth - 1.2, 2], [r.beamDepth - 1.2, G.westY - 2], r.beamBottom - 0.3, lightsGroup);
    rectLight(G.westY - 8, 3, P(r.beamDepth - 2, G.westY / 2, r.beamBottom - 0.6), P(r.beamDepth - 14, G.westY / 2, 0), lightsGroup);
  }
  updateLighting();
}

/** Push state.light into every light, emissive and environment level. */
function updateLighting() {
  const L = state.light;
  // lights at zero are hidden, which also drops them from the shaders
  for (const { light, disc } of FX.pots) {
    if (light) { light.intensity = POT_CD * L.pots; light.visible = L.pots > 0.005; }
    disc.material = L.pots > 0.02 ? M.potOn : M.potOff;
  }
  for (const z of FX.zones || []) {
    z.light.intensity = POT_CD * 0.55 * z.pots * L.pots + LED_PT * z.led * L.leds;
    z.light.visible = z.light.intensity > 1;
  }
  M.potOn.color.set('#fff1dc').multiplyScalar(1 + 3 * L.pots);
  for (const l of FX.leds) { l.intensity = LED_NITS * L.leds; l.visible = L.leds > 0.005; }
  M.led.color.set('#ffb46b').multiplyScalar(0.15 + 2.6 * L.leds);
  M.bandGlow.color.set('#ffc890').multiplyScalar(0.25 + 1.3 * L.leds);
  for (const m of [...FX.ledMeshes, ...(FX.fixtureLeds || [])]) m.visible = L.leds > 0.01;
  M.stepLight.color.set(L.steps ? '#ffc58a' : '#3a342c').multiplyScalar(L.steps ? 2.2 : 1);
  const screenDown = !!(FX.screen && L.screenDown);
  if (FX.screen) {
    FX.screen.mat.emissive.set(screenDown && L.tv ? '#ffffff' : '#000000');
    FX.screen.mat.emissiveIntensity = screenDown && L.tv ? 0.95 : 0;
    FX.screen.glow.intensity = screenDown && L.tv ? (FX.screen.glow.isRectAreaLight ? 2.4 : SCREEN_PT) : 0;
    FX.screen.glow.visible = FX.screen.glow.intensity > 0;
  }
  if (FX.tv) {
    const tvOn = L.tv && !screenDown;                   // the projector takes over when the screen is down
    FX.tv.screenMat.emissive.set(tvOn ? '#ffffff' : '#000000');
    FX.tv.screenMat.emissiveIntensity = tvOn ? 1.15 : 0;
    FX.tv.glow.intensity = tvOn ? (FX.tv.glow.isRectAreaLight ? 3.5 : TV_PT) : 0;
    FX.tv.glow.visible = tvOn;
    if (FX.tv.bias) { FX.tv.bias.intensity = L.bias && L.tv ? 4 : L.bias ? 1.2 : 0; FX.tv.bias.visible = FX.tv.bias.intensity > 0; }
    FX.tv.halo.material.opacity = L.bias ? (L.tv && !screenDown ? 0.32 : L.tv ? 0 : 0.16) : 0;
  }
  if (FX.fire) {
    FX.fire.flames.forEach((f) => (f.visible = L.fire));
    FX.fire.ember.visible = L.fire;
    FX.fire.light.intensity = L.fire ? FIRE_CD : 0;
    FX.fire.light.visible = L.fire;
  }
  for (const b of FX.transomGlow) b.material.color.set(L.pots > 0.5 ? '#6f8396' : '#2b3846');
  M.reeded.emissiveIntensity = 0.1 + 0.3 * Math.max(L.pots, 0.3 * L.leds);
  const planBoost = typeof mode !== 'undefined' && mode === 'plan' ? 1.4 : 0;
  hemi.intensity = 0.06 + 0.5 * L.pots + 0.12 * L.leds + planBoost;
  const env = 0.015 + 0.08 * L.pots + 0.02 * L.leds + planBoost * 0.05;
  scene.traverse((o) => {
    if (!o.material) return;
    for (const m of [].concat(o.material)) if (m.isMeshStandardMaterial) m.envMapIntensity = env;
  });
  for (const it of state.items) if (it.type === 'floorLamp') setLamp(it.id, L.lamp);
  invalidate(3);
}

function applyScene(name) {
  const s = SCENES[name]; if (!s) return;
  Object.assign(state.light, { scene: name, pots: s.pots, leds: s.leds, tv: s.tv, fire: s.fire, lamp: s.lamp, steps: s.steps, screenDown: s.screenDown });
  updateLighting();
}
