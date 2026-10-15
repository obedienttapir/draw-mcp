// ===================================================================
// 25 · Fixtures: stairs, slat walls, fireplace (animated), transoms, TV
// ===================================================================
const SLAT_W = 1.1, SLAT_GAP = 0.55, SLAT_D = 0.75, FELT_D = 0.45;
const SLAT_FACE = SLAT_D + FELT_D;          // how far a slat wall stands off the drywall

/**
 * Slat panel in a local wall frame: u along the wall, v up, +Z into the room.
 * holes: [{u0,u1,v0,v1}] that slats stop around.
 */
function buildSlats(u0, u1, v0, v1, holes) {
  const g = new THREE.Group();
  const pitch = SLAT_W + SLAT_GAP, n = Math.floor((u1 - u0 + SLAT_GAP) / pitch);
  const start = u0 + ((u1 - u0) - (n * pitch - SLAT_GAP)) / 2;
  const segs = [];
  for (let i = 0; i < n; i++) {
    const a = start + i * pitch, b = a + SLAT_W;
    let cuts = [[v0, v1]];
    for (const h of holes) {
      if (b <= h.u0 || a >= h.u1) continue;
      cuts = cuts.flatMap(([s, e]) => {
        if (e <= h.v0 || s >= h.v1) return [[s, e]];
        const out = [];
        if (h.v0 > s) out.push([s, h.v0]);
        if (h.v1 < e) out.push([h.v1, e]);
        return out;
      });
    }
    for (const [s, e] of cuts) if (e - s > 0.5) segs.push([a + SLAT_W / 2, (s + e) / 2, e - s]);
  }
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.slat, segs.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  segs.forEach(([u, v, h], i) => {
    p.set(u, v, FELT_D + SLAT_D / 2); s.set(SLAT_W, h, SLAT_D);
    inst.setMatrixAt(i, m4.compose(p, q, s));
  });
  inst.userData.slats = true;
  g.add(inst);
  // black acoustic felt behind, with the same openings
  const felt = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(rect(u0, v0, u1, v1),
    holes.map((h) => rect(h.u0, h.v0, h.u1, h.v1)))), M.felt);
  felt.position.z = FELT_D;
  g.add(felt);
  return g;
}

// ---------------- flames ----------------
const flameUniforms = { uTime: { value: 0 }, uIntensity: { value: 1 } };
function flameMaterial(seed) {
  return new THREE.ShaderMaterial({
    uniforms: { ...flameUniforms, uSeed: { value: seed } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform float uTime; uniform float uIntensity; uniform float uSeed; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 uv = vUv;
        float n = noise(vec2(uv.x*9.0 + uSeed, uv.y*2.5 - uTime*1.8))*0.65 + noise(vec2(uv.x*23.0 - uSeed, uv.y*5.0 - uTime*3.1))*0.35;
        float tongue = 0.5 + 0.5*sin(uv.x*48.0 + uSeed*3.0 + n*4.0 + uTime*0.7);
        float h = (0.25 + 0.7*n) * (0.35 + 0.65*tongue);
        float f = smoothstep(h, h*0.35, uv.y) * smoothstep(0.0, 0.06, uv.y);
        f *= smoothstep(0.0, 0.05, uv.x) * smoothstep(1.0, 0.95, uv.x);
        float core = smoothstep(0.55, 0.0, uv.y / max(h, 0.02));
        vec3 col = mix(vec3(1.0, 0.32, 0.04), vec3(1.0, 0.82, 0.42), core);
        gl_FragColor = vec4(col * f * uIntensity * 2.2, f * uIntensity);
      }`,
  });
}

function buildFireplace() {
  const f = state.fireplace, face = state.finish.fireplaceSlats ? SLAT_FACE : 0;
  const g = new THREE.Group();
  g.name = 'fireplace'; g.userData.fixture = 'fireplace';
  const w = f.width, h = f.height, depth = WALL_T + 1;
  // firebox interior
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth),
    new THREE.MeshStandardMaterial({ color: '#0b0a09', roughness: 0.9, side: THREE.BackSide }));
  box.position.set(0, 0, -depth / 2 + face);
  g.add(box);
  // black metal surround
  const t = 1.6, fr = M.metal;
  for (const [sx, sy, px, py] of [[w + 2 * t, t, 0, h / 2 + t / 2], [w + 2 * t, t, 0, -h / 2 - t / 2], [t, h, -w / 2 - t / 2, 0], [t, h, w / 2 + t / 2, 0]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.6), fr); m.position.set(px, py, face + 0.3); g.add(m);
  }
  // white stone ember bed
  const stones = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: '#e9e4dc', roughness: 0.8 }), 70);
  const r = rng(5), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 70; i++) {
    const sx = 0.7 + r() * 0.9;
    e.set(r() * 3, r() * 3, r() * 3); q.setFromEuler(e);
    m4.compose(new THREE.Vector3((r() - 0.5) * (w - 4), -h / 2 + 2 + r() * 1.5, face - 2.5 - r() * 3),
      q, new THREE.Vector3(sx * 1.3, sx * 0.7, sx));
    stones.setMatrixAt(i, m4);
  }
  g.add(stones);
  const ember = new THREE.Mesh(new THREE.PlaneGeometry(w - 3, 5),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6a1a').multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0.9 }));
  ember.rotation.x = -Math.PI / 2; ember.position.set(0, -h / 2 + 1.6, face - 4);
  g.add(ember);
  const flames = [];
  for (const [i, z] of [[0, -5], [1, -3.5], [2, -2]]) {
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(w - 4, h * 0.72), flameMaterial(i * 7.3 + 1));
    fl.position.set(0, -h / 2 + 2 + h * 0.36, face + z); flames.push(fl); g.add(fl);
  }
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.glassDark);
  glass.position.z = face + 0.05; g.add(glass);
  // flickering light into the lounge
  const light = new THREE.PointLight('#ff8a3d', 0, 0, 2);
  light.position.set(0, -h / 2 + 6, face + 10);
  g.add(light);
  // fireplace wall frame: u -> -Z, so rotate like the wall
  g.rotation.y = Math.PI / 2;
  g.position.copy(P(0, f.center, f.bottom + h / 2));
  fixturesGroup.add(g);
  FX.fire = { group: g, flames, ember, light };
}

function buildTransoms() {
  const { tr } = fireplaceOpenings();
  FX.transomGlow = [];
  for (const t of tr) {
    const w = t.u1 - t.u0, h = t.v1 - t.v0, g = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.reeded);
    glass.position.z = -WALL_T / 2; g.add(glass);
    const bar = 0.9;
    for (const [sx, sy, px, py] of [[w, bar, 0, h / 2 - bar / 2], [w, bar, 0, -h / 2 + bar / 2], [bar, h, -w / 2 + bar / 2, 0], [bar, h, w / 2 - bar / 2, 0]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 1.2), M.metal); m.position.set(px, py, -WALL_T / 2); g.add(m);
    }
    // the neighbouring room seen through the glass
    // the neighbouring room's light, seen through reeded glass (kept inside the wall so it never shows from above)
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: '#2b3846' }));
    back.position.z = -WALL_T + 0.4; g.add(back); FX.transomGlow.push(back);
    g.rotation.y = Math.PI / 2;
    g.position.copy(P(0, (t.u0 + t.u1) / 2, (t.v0 + t.v1) / 2));
    fixturesGroup.add(g);
  }
}

function buildStairs() {
  const r = state.room, G = geom(), g = new THREE.Group(); g.name = 'stairs';
  const y0 = -r.stairWidth, y1 = 0, wid = y1 - y0;
  const steps = [];
  for (let i = 0; i < G.treads; i++) {
    const x0 = r.stairStart + i * G.run, top = (i + 1) * G.riserH;
    if (x0 >= r.width) break;
    const len = Math.min(G.run + 1.2, r.width - x0 + 1.2);
    const tread = new THREE.Mesh(new THREE.BoxGeometry(len, 1.25, wid + 1.2), M.stairWood);
    tread.position.copy(P(x0 - 1.2 + len / 2, (y0 + y1) / 2 + 0.6, top - 0.62)); g.add(tread);
    const riser = new THREE.Mesh(new THREE.BoxGeometry(0.75, G.riserH - 1.25, wid), M.stairWood);
    riser.position.copy(P(x0 + 0.4, (y0 + y1) / 2, top - 1.25 - (G.riserH - 1.25) / 2)); g.add(riser);
    // solid mass under each step (closed by the knee wall on the room side)
    const fill = new THREE.Mesh(new THREE.BoxGeometry(G.run, Math.max(0.1, top - 1.25 - (G.riserH - 1.25)), wid - 0.2), M.wall);
    fill.position.copy(P(x0 + G.run / 2 + 0.75, (y0 + y1) / 2, (top - 1.25 - (G.riserH - 1.25)) / 2)); g.add(fill);
    steps.push({ x0, top });
  }
  // knee wall + dark stringer on the room side (y = 0), following the pitch
  const slope = G.riserH / G.run, H = r.ceiling;
  const zAt = (x) => (x - r.stairStart) * slope;
  const xTop = Math.min(r.width, r.stairStart + H / slope);
  const pts = [[r.stairStart + 2, 0], [r.width, 0], [r.width, Math.min(H, zAt(r.width) - 3)], [xTop, Math.min(H, zAt(xTop) - 3)], [r.stairStart + 2, 0.01]];
  // mirrored shape turned 180deg so the face points north, into the room
  const knee = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(pts.slice(0, 4).map(([x, z]) => [-x, z]))), M.wall);
  knee.rotation.y = Math.PI; knee.position.copy(P(0, 0.05, 0));
  g.add(knee);
  const sLen = (xTop - r.stairStart) / Math.cos(Math.atan(slope));
  const stringer = new THREE.Mesh(new THREE.BoxGeometry(sLen, 9, 0.9), M.stairWood);
  stringer.rotation.z = Math.atan(slope);
  const mid = (r.stairStart + xTop) / 2;
  stringer.position.copy(P(mid, 0.4, zAt(mid) - 4)); g.add(stringer);
  // balusters, handrail and newel (black iron + dark wood, as on site)
  const iron = new THREE.MeshStandardMaterial({ color: '#141312', roughness: 0.5, metalness: 0.6 });
  const balGeo = new THREE.CylinderGeometry(0.32, 0.32, 1, 8);
  const rail = 34;
  for (const s of steps) {
    for (const off of [G.run * 0.25, G.run * 0.75]) {
      const x = s.x0 + off, z0 = s.top, z1 = zAt(x) + G.riserH + rail;
      if (z0 > H + 30) continue;
      const b = new THREE.Mesh(balGeo, iron); b.scale.y = z1 - z0;
      b.position.copy(P(x, -1.8, (z0 + z1) / 2)); g.add(b);
    }
  }
  const hrLen = sLen;
  const hr = new THREE.Mesh(new THREE.BoxGeometry(hrLen, 2.6, 2.4), M.stairWood);
  hr.rotation.z = Math.atan(slope); hr.position.copy(P(mid, -1.8, zAt(mid) + G.riserH + rail + 1)); g.add(hr);
  const newel = new THREE.Mesh(new THREE.BoxGeometry(3.6, 40, 3.6), M.stairWood);
  newel.position.copy(P(r.stairStart - 1.5, -1.8, 20)); g.add(newel);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.2, 4.6), M.stairWood);
  cap.position.copy(P(r.stairStart - 1.5, -1.8, 40.6)); g.add(cap);
  fixturesGroup.add(g);
}

// ---------------- TV ----------------
function movieStill() {
  const cv = mkCanvas(1024, 576), g = cv.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 576);
  sky.addColorStop(0, '#1b2440'); sky.addColorStop(0.45, '#7a3f5c'); sky.addColorStop(0.7, '#f08a4b'); sky.addColorStop(1, '#2a1a1a');
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 576);
  g.fillStyle = 'rgba(255,214,150,0.95)'; g.beginPath(); g.arc(640, 360, 46, 0, Math.PI * 2); g.fill();
  const r = rng(77);
  for (const [base, col] of [[400, '#3a1f2b'], [450, '#241521'], [500, '#140c12']]) {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, 576);
    for (let x = 0; x <= 1024; x += 32) g.lineTo(x, base - Math.sin(x * 0.006 + r() * 2) * 40 - r() * 30);
    g.lineTo(1024, 576); g.fill();
  }
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 64); g.fillRect(0, 512, 1024, 64);   // 2.39:1 letterbox
  return canvasTex(cv, true);
}
let _still = null;
function buildTV() {
  const G = geom(), t = state.tv, { w, h } = tvDims(t.size);
  const face = state.finish.tvSlats ? SLAT_FACE : 0;
  const g = new THREE.Group(); g.name = 'tv'; g.userData.fixture = 'tv';
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, h + 0.5, 1.1), M.black); g.add(bezel);
  _still = _still || movieStill();
  const screenMat = new THREE.MeshStandardMaterial({ color: '#050506', roughness: 0.12, metalness: 0.5, emissiveMap: _still, emissive: '#000000' });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat); screen.position.z = 0.56; g.add(screen);
  const glow = new THREE.RectAreaLight('#9fb4ff', 0, w, h); glow.position.set(0, 0, 0.7);
  glow.lookAt(new THREE.Vector3(0, 0, 10)); g.add(glow);
  g.position.copy(P(G.tvX + t.offset, state.room.depth - face - 1.6, t.center));
  fixturesGroup.add(g);
  FX.tv = { group: g, screenMat, glow, w, h };
}

function buildFixtures() {
  disposeGroup(fixturesGroup);
  const r = state.room, G = geom();
  buildStairs(); buildFireplace(); buildTransoms(); buildTV();
  const { fp, tr } = fireplaceOpenings();
  if (state.finish.fireplaceSlats) {
    const top = r.beamDepth > 1 ? r.beamBottom : r.ceiling;
    const holes = [{ u0: fp.u0 - 1.6, u1: fp.u1 + 1.6, v0: fp.v0 - 1.6, v1: fp.v1 + 1.6 },
      ...tr.map((t) => ({ u0: t.u0 - 0.5, u1: t.u1 + 0.5, v0: t.v0 - 0.5, v1: t.v1 + 0.5 }))];
    const s = buildSlats(1.5, G.mainY - 1.5, 0.4, top - 0.2, holes);
    s.rotation.y = Math.PI / 2;                       // u -> plan y, +Z -> into the room
    fixturesGroup.add(s);
  }
  if (state.finish.tvSlats) {
    const [a, b] = [G.bay[2], G.bay[3]];
    const s = buildSlats(0.6, b[0] - a[0] - 0.6, 0.4, r.soffitBottom - 0.2, []);
    s.position.copy(P(a[0], r.depth)); fixturesGroup.add(s);
  }
}
