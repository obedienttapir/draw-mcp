// ===================================================================
// 25 · Fixtures: stairs, slat walls, fireplace (animated), transoms, TV
// ===================================================================
const SLAT_W = 1.1, SLAT_GAP = 0.55, SLAT_D = 0.75, FELT_D = 0.45;
const SLAT_FACE = SLAT_D + FELT_D;          // how far a slat wall stands off the drywall

/**
 * Slat panel in a local wall frame: u along the wall, v up, +Z into the room.
 * holes: [{u0,u1,v0,v1}] that slats stop around.
 */
function buildSlats(u0, u1, v0, v1, holes, feltHoles = holes) {
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
  // black acoustic felt behind; it can stay open where slats run across a window
  const felt = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(rect(u0, v0, u1, v1),
    feltHoles.map((h) => rect(h.u0, h.v0, h.u1, h.v1)))), M.felt);
  felt.position.z = FELT_D;
  g.add(felt);
  return g;
}

// ---------------- flames ----------------
// uDirect: 1 when drawing straight to the 8-bit canvas (Fast, or High without glow), 0 into the HDR glow target
const flameUniforms = { uTime: { value: 0 }, uIntensity: { value: 1 }, uDirect: { value: 1 } };
function flameMaterial(seed) {
  return new THREE.ShaderMaterial({
    uniforms: { ...flameUniforms, uSeed: { value: seed } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform float uTime; uniform float uIntensity; uniform float uSeed; uniform float uDirect; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 uv = vUv;
        // flame height wanders along the burner; turbulence bends it, so no regular 'teeth'
        // (smoothstep edges always ascending: reversed edges are undefined in GLSL and render grey on some GPUs)
        float n1 = noise(vec2(uv.x*5.0 + uSeed, uTime*0.8));
        float n2 = noise(vec2(uv.x*13.0 - uSeed, uTime*1.6));
        float h = 0.22 + 0.5*n1 + 0.22*n2;
        float turb = noise(vec2(uv.x*9.0 + uSeed, uv.y*3.5 - uTime*2.4)) - 0.5;
        float y = uv.y + turb * 0.22 * uv.y;
        float f = (1.0 - smoothstep(h * 0.3, h + 0.08, y)) * smoothstep(0.0, 0.07, uv.y);
        f *= smoothstep(0.0, 0.05, uv.x) * (1.0 - smoothstep(0.95, 1.0, uv.x));
        float core = 1.0 - smoothstep(0.0, 0.55, uv.y / max(h, 0.02));
        vec3 col = mix(vec3(1.0, 0.32, 0.04), vec3(1.0, 0.82, 0.42), core) * uIntensity;
        if (uDirect > 0.5) {
          // 8-bit canvas, no tone mapping: soft-clip each layer so the three layers add up to a warm white core
          // instead of clipping to grey (or olive once the dark glass is over it)
          gl_FragColor = vec4((1.0 - exp(-col * f * f * 2.4)) * 0.42, 1.0);
        } else {
          gl_FragColor = vec4(col * f * 0.75, f);
          #include <colorspace_fragment>
        }
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
    fl.position.set(0, -h / 2 + 2 + h * 0.36, face + z); fl.renderOrder = 1;   // after the glass, so it never greys them
    flames.push(fl); g.add(fl);
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
  if (state.finish.transoms === 'framed' && tr.length === 2) {
    // one 2″ black steel surround + a black mullion where the wall shows between the panes: one window, not two eyes
    const face = state.finish.fireplaceSlats ? SLAT_FACE : 0, b = 2;
    const u0 = Math.min(tr[0].u0, tr[1].u0), u1 = Math.max(tr[0].u1, tr[1].u1), v0 = tr[0].v0, v1 = tr[0].v1;
    const g = new THREE.Group(), W = u1 - u0, Hh = v1 - v0;
    for (const [sx, sy, px, py] of [[W + 2 * b, b, 0, Hh / 2 + b / 2], [W + 2 * b, b, 0, -Hh / 2 - b / 2], [b, Hh, -W / 2 - b / 2, 0], [b, Hh, W / 2 + b / 2, 0]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 1.2), M.metal); m.position.set(px, py, face + 0.6); g.add(m);
    }
    const gapU0 = Math.min(tr[0].u1, tr[1].u1), gapU1 = Math.max(tr[0].u0, tr[1].u0);
    const mull = new THREE.Mesh(new THREE.BoxGeometry(gapU1 - gapU0, Hh, 0.8), M.metal);
    mull.position.set((gapU0 + gapU1) / 2 - (u0 + u1) / 2, 0, 0.4); g.add(mull);
    g.rotation.y = Math.PI / 2; g.position.copy(P(0, (u0 + u1) / 2, (v0 + v1) / 2));
    fixturesGroup.add(g);
  }
  const mode = state.finish.transoms, face = state.finish.fireplaceSlats ? SLAT_FACE : 0;
  const union = tr.length ? { u0: Math.min(...tr.map((t) => t.u0)), u1: Math.max(...tr.map((t) => t.u1)), v0: tr[0].v0, v1: tr[0].v1 } : null;
  const onWall = (obj, u, v) => { obj.rotation.y = Math.PI / 2; obj.position.copy(P(0, u, v)); fixturesGroup.add(obj); };
  if (mode === 'shade' && union) {
    // one linen shade over both windows: a single soft band instead of two eyes
    const g = new THREE.Group(), W = union.u1 - union.u0 + 6, Hh = union.v1 - union.v0 + 5;
    meshAt(new THREE.BoxGeometry(W, Hh, 0.35), fabricMat('#b8a487', 'linen'), 0, -0.5, face + 1.2, g);
    meshAt(new THREE.BoxGeometry(W + 1, 2.2, 2.4), M.matteBlack, 0, Hh / 2 + 0.2, face + 1.4, g);
    meshAt(new THREE.CylinderGeometry(0.45, 0.45, W - 2, 10), M.brass, 0, -Hh / 2 - 0.2, face + 1.4, g).rotation.z = Math.PI / 2;
    onWall(g, (union.u0 + union.u1) / 2, (union.v0 + union.v1) / 2);
  }
  if (mode === 'band' && union) {
    // continuous matte-black band across the whole wall; the windows become slots in it
    const G = geom(), bv0 = union.v0 - 4, bv1 = union.v1 + 4;
    const shape = shapeFrom(rect(1.5, bv0, G.westY - 1.5, bv1), tr.map((t) => rect(t.u0, t.v0, t.u1, t.v1)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: face + 0.8, bevelEnabled: false });
    const band = new THREE.Mesh(geo, M.matteBlack); band.rotation.y = Math.PI / 2; fixturesGroup.add(band);
  }
  for (const t of tr) {
    const w = t.u1 - t.u0, h = t.v1 - t.v0, g = new THREE.Group();
    const tinted = mode === 'band' || mode === 'hidden';   // tinted glass or privacy film: no light from the next room
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), tinted ? M.smoked : M.reeded);
    glass.position.z = -WALL_T / 2; g.add(glass);
    const bar = 0.9;
    for (const [sx, sy, px, py] of [[w, bar, 0, h / 2 - bar / 2], [w, bar, 0, -h / 2 + bar / 2], [bar, h, -w / 2 + bar / 2, 0], [bar, h, w / 2 - bar / 2, 0]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 1.2), M.metal); m.position.set(px, py, -WALL_T / 2); g.add(m);
    }
    // the neighbouring room seen through the glass
    // the neighbouring room's light, seen through reeded glass (kept inside the wall so it never shows from above)
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: '#2b3846' }));
    back.position.z = -WALL_T + 0.4; g.add(back);
    if (tinted) back.material.color.set('#0b0908'); else FX.transomGlow.push(back);
    g.rotation.y = Math.PI / 2;
    g.position.copy(P(0, (t.u0 + t.u1) / 2, (t.v0 + t.v1) / 2));
    fixturesGroup.add(g);
  }
}

function buildStairs() {
  const r = state.room, G = geom(), g = new THREE.Group(); g.name = 'stairs';
  FX.stepLights = [];
  const y0 = -r.stairWidth, y1 = 0, wid = y1 - y0, yc = (y0 + y1) / 2;
  const slope = G.riserH / G.run, H = r.ceiling;
  const zAt = (x) => (x - r.stairStart) * slope;
  const xTop = Math.min(r.width, r.stairStart + H / slope);
  const openTo = Math.min(G.hallEnd, r.width);           // hallway side is open (railing) up to here
  const steps = [];
  // treads, risers and the mass under each step: three instanced draws instead of ~45 meshes
  const box = new THREE.BoxGeometry(1, 1, 1), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const treads = new THREE.InstancedMesh(box, M.stairWood, G.treads), risers = new THREE.InstancedMesh(box, M.stairWood, G.treads);
  const fills = new THREE.InstancedMesh(box, M.stairWood, G.treads);   // solid, dark: reads as a cut stringer from either side
  let n = 0;
  for (let i = 0; i < G.treads; i++) {
    const x0 = r.stairStart + i * G.run, top = (i + 1) * G.riserH;
    if (x0 >= r.width) break;
    const nose = i === 0 ? 2 : 1.2;                        // the starting step's bullnose is the tip of the stairs
    const len = Math.min(G.run + nose, r.width - x0 + nose);
    const extra = i === 0 ? 3 : 0;                         // wider starting step, like the one on site
    treads.setMatrixAt(n, m4.compose(P(x0 - nose + len / 2, yc, top - 0.62), q, sc.set(len, 1.25, wid + 1.2 + 2 * extra)));
    risers.setMatrixAt(n, m4.compose(P(x0 + 0.4, yc, top - G.riserH / 2 - 0.62), q, sc.set(0.75, G.riserH - 1.25, wid + 2 * extra)));
    const fh = Math.max(0.1, top - 1.3);
    fills.setMatrixAt(n, m4.compose(P(x0 + G.run / 2 + 0.75, yc, fh / 2), q, sc.set(G.run - 0.6, fh, wid - 0.2)));
    steps.push({ x0, top });
    if (top < H + 20) {                                    // low-glare light in each riser
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 4), M.stepLight);
      lens.position.copy(P(x0 - 0.05, yc, top - G.riserH * 0.55)); g.add(lens); FX.stepLights.push(lens);
    }
    n++;
  }
  for (const im of [treads, risers, fills]) { im.count = n; g.add(im); }

  // knee walls under the stringers: room side (faces north) and hallway side (faces south)
  const knee = (x1, side) => {
    const pts = [[r.stairStart + 2, 0], [x1, 0], [x1, Math.min(H, zAt(x1) - 3)], [Math.min(x1, xTop), Math.min(H, zAt(Math.min(x1, xTop)) - 3)]];
    const geo = new THREE.ShapeGeometry(shapeFrom(side > 0 ? pts.map(([x, z]) => [-x, z]) : pts));
    const m = new THREE.Mesh(geo, M.wall);
    if (side > 0) { m.rotation.y = Math.PI; m.position.copy(P(0, 0.05, 0)); }   // mirrored + turned: faces north
    else m.position.copy(P(0, y0 - 0.05, 0));                                       // faces south, into the hallway
    g.add(m);
  };
  knee(r.width, 1);
  if (openTo > r.stairStart + 4) knee(openTo, -1);

  // dark stringers, iron balusters (one instanced draw), handrails and newels
  const iron = cached('stair-iron', () => new THREE.MeshStandardMaterial({ color: '#141312', roughness: 0.5, metalness: 0.6 }));
  const rail = 34, bal = [];
  const side = (yy, xEnd) => {
    const len = (xEnd - r.stairStart) / Math.cos(Math.atan(slope)), mid = (r.stairStart + xEnd) / 2;
    const stringer = new THREE.Mesh(new THREE.BoxGeometry(len, 9, 0.9), M.stairWood);
    stringer.rotation.z = Math.atan(slope); stringer.position.copy(P(mid, yy, zAt(mid) - 4)); g.add(stringer);
    const hr = new THREE.Mesh(new THREE.BoxGeometry(len, 2.6, 2.4), M.stairWood);
    hr.rotation.z = Math.atan(slope); hr.position.copy(P(mid, yy, zAt(mid) + G.riserH + rail + 1)); g.add(hr);
    for (const st of steps) for (const off of [G.run * 0.25, G.run * 0.75]) {
      const x = st.x0 + off; if (x > xEnd - 1) continue;
      const z0 = st.top, z1 = zAt(x) + G.riserH + rail;
      if (z0 < H + 30) bal.push([x, yy, z0, z1]);
    }
    const newel = new THREE.Mesh(new THREE.BoxGeometry(3.6, 40, 3.6), M.stairWood);
    newel.position.copy(P(r.stairStart - 1.5, yy, 20)); g.add(newel);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.2, 4.6), M.stairWood);
    cap.position.copy(P(r.stairStart - 1.5, yy, 40.6)); g.add(cap);
  };
  side(-1.8, xTop);                                        // room side
  if (openTo > r.stairStart + 4) side(y0 + 1.8, openTo);   // hallway side, open
  const balusters = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.32, 0.32, 1, 8), iron, bal.length);
  bal.forEach(([x, yy, z0, z1], i) => balusters.setMatrixAt(i, m4.compose(P(x, yy, (z0 + z1) / 2), q, sc.set(1, z1 - z0, 1))));
  g.add(balusters);
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
  let glow;
  if (isFast()) { glow = new THREE.PointLight('#9fb4ff', 0, 0, 2); glow.position.set(0, 0, 26); }
  else { glow = new THREE.RectAreaLight('#9fb4ff', 0, w, h); glow.position.set(0, 0, 0.7); glow.lookAt(new THREE.Vector3(0, 0, 10)); }
  g.add(glow);
  // 6500K bias light: an LED strip on the back of the TV washing the wall (RectAreaLight emits along -Z = toward the wall)
  const bias = isFast() ? null : new THREE.RectAreaLight('#dfe8ff', 0, w * 0.9, h * 0.85);   // fast mode: halo only
  if (bias) { bias.position.set(0, 0, -0.7); g.add(bias); }
  const haloMat = new THREE.MeshBasicMaterial({ map: TEX.halo, color: '#dfe8ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.45, h * 1.7), haloMat); halo.position.z = -0.75; g.add(halo);
  g.position.copy(P(G.tvX + t.offset, state.room.depth - face - 1.6, t.center));
  fixturesGroup.add(g);
  FX.tv = { group: g, screenMat, glow, bias, halo, w, h };
}

function buildFixtures() {
  disposeGroup(fixturesGroup);
  FX.fixtureLeds = [];
  const r = state.room, G = geom();
  buildStairs(); buildFireplace(); buildTransoms(); buildTV(); buildMantel(); buildScreen();
  const { fp, tr } = fireplaceOpenings();
  if (state.finish.fireplaceSlats) {
    const top = r.beamDepth > 1 ? r.beamBottom : r.ceiling;
    const fireHole = { u0: fp.u0 - 1.6, u1: fp.u1 + 1.6, v0: fp.v0 - 1.6, v1: fp.v1 + 1.6 };
    const tmode = state.finish.transoms, uMin = Math.min(...tr.map((t) => t.u0)), uMax = Math.max(...tr.map((t) => t.u1));
    const pad = { framed: 2.5, shade: 1 }[tmode] ?? 0.5;
    // framed / shade: slats stop at the pair, not at each window; band: slats stop above and below one full-width strip
    const winHoles = tmode === 'band' ? [{ u0: 0, u1: G.westY, v0: tr[0].v0 - 4, v1: tr[0].v1 + 4 }]
      : tmode === 'framed' || tmode === 'shade' ? [{ u0: uMin - pad, u1: uMax + pad, v0: tr[0].v0 - pad, v1: tr[0].v1 + pad }]
        : tr.map((t) => ({ u0: t.u0 - pad, u1: t.u1 + pad, v0: t.v0 - pad, v1: t.v1 + pad }));
    if (state.finish.mantel === 'slab') { const sl = slabRect(); fireHole.u0 = sl.u0; fireHole.u1 = sl.u1; fireHole.v0 = sl.v0; fireHole.v1 = sl.v1; }
    // 'slatted' / 'hidden': slats run straight across the windows
    const across = (tmode === 'slatted' || tmode === 'hidden') && tr.length;
    // slatted: one continuous backlit band behind the slats swallows both windows; hidden: felt behind, no light at all
    const band = across && tmode === 'slatted' ? { u0: 10, u1: G.westY - 10, v0: tr[0].v0 - 1, v1: tr[0].v1 + 1 } : null;
    const s = buildSlats(1.5, G.westY - 1.5, 0.4, top - 0.2, across ? [fireHole] : [fireHole, ...winHoles], band ? [fireHole, band] : across ? [fireHole] : [fireHole, ...winHoles]);
    if (band) {
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(band.u1 - band.u0, band.v1 - band.v0), M.bandGlow);
      glow.position.set((band.u0 + band.u1) / 2, (band.v0 + band.v1) / 2, 0.15); s.add(glow); FX.fixtureLeds.push(glow);
    }
    s.rotation.y = Math.PI / 2;                       // u -> plan y, +Z -> into the room
    fixturesGroup.add(s);
  }
  if (state.finish.tvSlats) {
    const [a, b] = [G.bay[2], G.bay[3]];
    const s = buildSlats(0.6, b[0] - a[0] - 0.6, 0.4, r.soffitBottom - 0.2, []);
    s.position.copy(P(a[0], r.depth)); fixturesGroup.add(s);
  }
}

// ---------------- fireplace ledge / floating hearth bench ----------------
function buildMantel() {
  const kind = state.finish.mantel; if (!kind || kind === 'none') return;
  const { fp } = fireplaceOpenings(), G = geom(), face = state.finish.fireplaceSlats ? SLAT_FACE : 0;
  const wood = woodMat('#4a3020'), g = new THREE.Group(); g.name = 'mantel';
  if (kind === 'ledge') {
    // floating walnut shelf: splits the 'eyes' from the 'mouth'
    span(g, wood, fp.u0 - 14, fp.u1 + 14, fp.v1 + 6, fp.v1 + 8.5, face, face + 9, 0.4);
  } else if (kind === 'picture') {
    // full-width picture ledge between the fire and the windows: art leaned off-centre breaks the symmetry
    const r = state.room, v = fp.v1 + 6, c = (fp.u0 + fp.u1) / 2;
    const room = r.transomBottom - (state.finish.transoms === 'band' ? 5 : 2) - (v + 1.4);   // stay clear of the windows
    span(g, wood, 6, G.westY - 6, v, v + 1.4, face, face + 5, 0.3);
    span(g, wood, 6, G.westY - 6, v + 1.4, v + 2.6, face + 4.2, face + 5, 0.2);
    for (const [du, aw, k, col, dz] of [[-17, 24, 1, '#b4573a', 0], [1, 13, 0.7, '#d9cdb8', 0.9], [33, 14, 0.85, '#2f3a40', 0]]) {
      const u = c + du, ah = Math.max(6, room * k - 2);
      if (u - aw / 2 < 7 || u + aw / 2 > G.westY - 7) continue;
      const fr = meshAt(new THREE.BoxGeometry(aw + 2, ah + 2, 0.8), M.matteBlack, u, v + 1.4 + (ah + 2) / 2, face + 2.2 + dz, g); fr.rotation.x = -0.1;
      meshAt(new THREE.PlaneGeometry(aw, ah), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 }), 0, 0, 0.45, fr);
    }
    const vase = new THREE.LatheGeometry([[0, 0], [2.4, 0.2], [3.2, 4], [1.6, 9], [1.8, 10]].map(([x, y]) => new THREE.Vector2(x, y)), 24);
    meshAt(vase, new THREE.MeshStandardMaterial({ color: '#c9b79c', roughness: 0.8 }), c + 19, v + 1.4, face + 2.6, g);
  } else if (kind === 'slab') {
    // large porcelain slab from floor to just under the windows: the fireplace sits in one tall panel
    const sl = slabRect(), shape = shapeFrom(rect(sl.u0, sl.v0, sl.u1, sl.v1), [rect(fp.u0, fp.v0, fp.u1, fp.v1)]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: face + 1.4, bevelEnabled: false });
    geo.computeBoundingBox();
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 60, uv.getY(i) / 60);
    g.add(new THREE.Mesh(geo, M.slab));
  } else if (kind === 'shelves') {
    // open walnut shelves either side of the fireplace, each with a book stack or a vase
    const sides = [[6, fp.u0 - 7], [fp.u1 + 7, G.westY - 6]].filter(([a, b]) => b - a >= 14);
    const r = rng(81);
    for (const [a, b] of sides) for (const v of [30, 48, 66]) {
      span(g, wood, a, b, v, v + 1.6, face, face + 10, 0.3);
      if (r() < 0.55) for (let k = 0; k < 3; k++) {
        const bw = 1.4 + r(), bh = 7 + r() * 3;
        meshAt(new THREE.BoxGeometry(bw, bh, 7), new THREE.MeshStandardMaterial({ color: ['#6b5b4a', '#2f3a40', '#c9bba5', '#7a4a32'][k % 4], roughness: 0.9 }), a + 3 + k * (bw + 0.3), v + 1.6 + bh / 2, face + 4.5, g);
      } else {
        const vase = new THREE.LatheGeometry([[0, 0], [2, 0.2], [2.8, 3], [1.4, 7], [1.6, 8]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
        meshAt(vase, new THREE.MeshStandardMaterial({ color: r() < 0.5 ? '#2a2622' : '#d8cdbb', roughness: 0.8 }), (a + b) / 2, v + 1.6, face + 5, g);
      }
    }
  } else {
    // full-width floating bench: extra perch seating, grounds the fireplace as one horizontal band
    span(g, wood, 6, G.westY - 6, 13, 17, face, face + 17, 0.6);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(G.westY - 16, 0.35, 0.35), M.led);
    strip.position.set(G.westY / 2, 12.6, face + 13); g.add(strip); FX.fixtureLeds.push(strip);
  }
  g.rotation.y = Math.PI / 2;                          // wall frame: u -> plan y, +Z -> into the room
  fixturesGroup.add(g);
}

/** Stone slab extent in fireplace-wall coords: 15″ past the fireplace each side, floor (or bench) to just under the windows. */
function slabRect() {
  const { fp } = fireplaceOpenings(), r = state.room;
  return { u0: fp.u0 - 15, u1: fp.u1 + 15, v0: 0.4, v1: Math.max(fp.v1 + 8, r.transomBottom - 5) };
}

// ---------------- drop-down projector screen in the alcove bulkhead ----------------
const SCREEN_OFF = 9;                                  // screen plane, inches in front of the TV wall
function screenDims() {
  const s = tvDims(state.tv.screenSize || 110), r = state.room, G = geom();
  const avail = r.bayFace + 2 * Math.min(SCREEN_OFF, G.a);  // alcove width at the screen plane (45° walls)
  const centre = 50;                                   // image centre height
  return { ...s, centre, avail, fits: s.w + 6 <= avail, y: r.depth - SCREEN_OFF };
}
function buildScreen() {
  FX.screen = null;
  if (!state.tv.screen) return;
  const r = state.room, G = geom(), d = screenDims();
  const g = new THREE.Group(); g.name = 'screen';
  const top = r.soffitBottom;
  // slot in the bulkhead underside + housing
  const slot = new THREE.Mesh(new THREE.BoxGeometry(d.w + 6, 1, 5), M.black);
  slot.position.copy(P(G.tvX, d.y, top - 0.45)); g.add(slot);
  // rolling sheet: black drop above the image, matte white image area
  const imgTop = d.centre + d.h / 2, imgBot = d.centre - d.h / 2;
  const sheet = new THREE.Group(); sheet.position.copy(P(G.tvX, d.y, top - 0.9));
  const drop = new THREE.Mesh(new THREE.PlaneGeometry(d.w + 4, top - 0.9 - imgTop), M.black);
  drop.position.y = -(top - 0.9 - imgTop) / 2; sheet.add(drop);
  const mat = new THREE.MeshStandardMaterial({ color: '#d9d9d6', roughness: 0.9, emissiveMap: _still || (_still = movieStill()), emissive: '#000000' });
  const img = new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.h), mat);
  img.position.y = -(top - 0.9 - d.centre); sheet.add(img);
  const border = new THREE.Mesh(new THREE.PlaneGeometry(d.w + 4, d.h + 4), M.black);
  border.position.set(0, img.position.y, -0.05); sheet.add(border);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(d.w + 5, 1.2, 1), M.black);
  bar.position.y = -(top - 0.9 - imgBot) - 3; sheet.add(bar);
  g.add(sheet);
  let glow;
  if (isFast()) { glow = new THREE.PointLight('#ffd7b0', 0, 0, 2); glow.position.copy(P(G.tvX, d.y - 30, d.centre)); g.add(glow); }
  else { glow = new THREE.RectAreaLight('#ffd7b0', 0, d.w, d.h); glow.position.copy(P(G.tvX, d.y - 0.5, d.centre)); g.add(glow); glow.lookAt(P(G.tvX, d.y - 20, d.centre)); }
  // ceiling projector, roughly 1.4 x image width away
  const throwY = d.y - 1.4 * d.w;
  const proj = new THREE.Mesh(new RoundedBoxGeometry(14, 5, 13, 2, 1.2), new THREE.MeshStandardMaterial({ color: '#1d1c1b', roughness: 0.4 }));
  const ceilingKit = new THREE.Group(); g.add(ceilingKit);              // hidden with the ceiling in cut-away views
  proj.position.copy(P(G.tvX, throwY, r.ceiling - 6.5)); ceilingKit.add(proj);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 4, 8), M.metal);
  rod.position.copy(P(G.tvX, throwY, r.ceiling - 2)); ceilingKit.add(rod);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20), new THREE.MeshBasicMaterial({ color: '#2c3440' }));
  lens.rotation.y = Math.PI; lens.position.copy(P(G.tvX + 3, throwY + 6.6, r.ceiling - 6.5)); ceilingKit.add(lens);
  fixturesGroup.add(g);
  const down = state.light.screenDown ? 1 : 0.02;
  sheet.scale.y = down;
  FX.screen = { group: g, sheet, mat, glow, cur: down, ceilingKit };
}
