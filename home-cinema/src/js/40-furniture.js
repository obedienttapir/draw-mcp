// ===================================================================
// 40 · Furniture. Each factory builds in a local frame: origin = centre
// of the footprint on the floor, +Z = the side people face, inches.
// It returns { group, w, d, shadows: [[x, z, w, d]] }.
// ===================================================================
const rbox = (w, h, d, r = 1.5, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
function meshAt(geo, mat, x, y, z, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }
/** Box spanning x0..x1, y0..y1, z0..z1 (rounded). */
function span(parent, mat, x0, x1, y0, y1, z0, z1, r = 1.5) {
  return meshAt(rbox(x1 - x0, y1 - y0, z1 - z0, r), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, parent);
}

const CATALOG = {
  sectional: {
    label: 'L-sectional', note: 'Modular, return on either side', fabric: true,
    defaults: { back: 136, ret: 104, depth: 38, side: 'right', color: '#8f877c' },
    params: [['back', 'Back length', 84, 180], ['ret', 'Return length', 60, 140], ['depth', 'Seat depth', 32, 44]],
    options: [['side', 'Return side', [['right', 'Right'], ['left', 'Left']]]],
    colors: FABRICS,
  },
  sofa: {
    label: 'Sofa', note: 'Straight 3-seat', fabric: true,
    defaults: { w: 90, depth: 38, color: '#5f5a54' }, params: [['w', 'Length', 60, 120], ['depth', 'Seat depth', 32, 44]], colors: FABRICS,
  },
  loungeChair: { label: 'Bouclé chair', note: '31″ curved tub chair', defaults: { color: '#e6dccb' }, params: [], colors: FABRICS },
  roundTable: {
    label: 'Round coffee table', note: 'Sculpted pedestal', defaults: { dia: 34, color: '#3b281b' },
    params: [['dia', 'Diameter', 24, 48]], colors: WOODS,
  },
  ottoman: {
    label: 'Ottoman', note: 'Upholstered, doubles as table', defaults: { w: 40, d: 30, color: '#5b4636' },
    params: [['w', 'Width', 18, 60], ['d', 'Depth', 18, 48]], colors: [...FABRICS, ['#5b4636', 'Leather']],
  },
  rug: {
    label: 'Rug', note: 'Low pile', defaults: { w: 120, d: 96, color: '#6e6559', pattern: 'weave' },
    params: [['w', 'Length', 36, 168], ['d', 'Width', 24, 144]],
    options: [['pattern', 'Pattern', [['weave', 'Tonal weave'], ['border', 'Bordered']]]],
    colors: [['#6e6559', 'Taupe'], ['#7d7466', 'Sand'], ['#3d3833', 'Charcoal'], ['#8a7a64', 'Wheat'], ['#4b4f55', 'Slate'], ['#5e4a3a', 'Rust brown']],
  },
  console: {
    label: 'Media console', note: 'Wall-hung, slatted front', defaults: { w: 70, color: '#4a3424' },
    params: [['w', 'Length', 40, 84]], colors: WOODS,
  },
  sideTable: { label: 'Side table', note: '18″ drum', defaults: { color: '#3b281b' }, params: [], colors: WOODS },
  floorLamp: { label: 'Floor lamp', note: 'Linen drum, warm bulb', defaults: {}, params: [] },
  plant: { label: 'Olive tree', note: 'In stone planter', defaults: { h: 70 }, params: [['h', 'Height', 36, 90]] },
  towerSpeaker: { label: 'Tower speaker', note: 'Front L / R', defaults: {}, params: [] },
  subwoofer: { label: 'Subwoofer', note: '15″ cube', defaults: {}, params: [] },
  recliner: {
    label: 'Cinema recliner', note: 'Power recline, 36″ wide', fabric: true,
    defaults: { color: '#2f2c2a' }, params: [], colors: FABRICS,
  },
  pouf: { label: 'Pouf', note: '20″ extra seat or footrest', defaults: { color: '#c9bba5' }, params: [], colors: FABRICS },
  barCart: { label: 'Bar cart', note: '24″ × 16″, two shelves', defaults: {}, params: [] },
};

function makeSectional(p) {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const B = p.back, R = p.ret, d = p.depth, arm = 6, bt = 8, base = 3.5, seatTop = 18.5, deck = 12;
  const fab = fabricMat(p.color, 'linen'), dark = M.black;
  const x0 = -B / 2, x1 = B / 2, z0 = -R / 2, z1 = R / 2;
  // recessed plinth
  span(inner, dark, x0 + 2, x1 - 2, 0, base, z0 + 2, z0 + d - 2, 0.3);
  span(inner, dark, x0 + 2, x0 + d - 2, 0, base, z0 + d - 2, z1 - 2, 0.3);
  // backrests, arms, decks
  span(inner, fab, x0, x1 - arm, base, 30, z0, z0 + bt, 2.5);
  span(inner, fab, x0, x0 + bt, base, 30, z0 + bt, z1 - arm, 2.5);
  span(inner, fab, x1 - arm, x1, base, 24, z0, z0 + d, 2.5);
  span(inner, fab, x0, x0 + d, base, 24, z1 - arm, z1, 2.5);
  span(inner, fab, x0 + bt, x1 - arm, base, deck, z0 + bt, z0 + d, 1.5);
  span(inner, fab, x0 + bt, x0 + d, base, deck, z0 + d, z1 - arm, 1.5);
  // seat cushions: corner + back leg + return
  const gap = 0.4;
  span(inner, fab, x0 + bt + gap, x0 + d, deck, seatTop, z0 + bt + gap, z0 + d, 2.6);
  const runB = x1 - arm - (x0 + d), nB = Math.max(1, Math.round(runB / 30));
  for (let i = 0; i < nB; i++) {
    const a = x0 + d + (runB * i) / nB + gap, b = x0 + d + (runB * (i + 1)) / nB - gap;
    span(inner, fab, a, b, deck, seatTop, z0 + bt + gap, z0 + d, 2.6);
  }
  const runR = z1 - arm - (z0 + d), nR = Math.max(1, Math.round(runR / 30));
  for (let i = 0; i < nR; i++) {
    const a = z0 + d + (runR * i) / nR + gap, b = z0 + d + (runR * (i + 1)) / nR - gap;
    span(inner, fab, x0 + bt + gap, x0 + d, deck, seatTop, a, b, 2.6);
  }
  // loose back cushions, slightly reclined
  const backC = (cx, cz, w, rotY) => {
    const m = meshAt(rbox(w, 17, 6.5, 3), fab, cx, seatTop + 8, cz, inner);
    m.rotation.y = rotY; m.rotateX(-0.16);
  };
  for (let i = 0; i < nB; i++) {
    const a = x0 + d + (runB * i) / nB, b = x0 + d + (runB * (i + 1)) / nB;
    backC((a + b) / 2, z0 + bt + 3, b - a - 1, 0);
  }
  backC(x0 + bt + (d - bt) / 2 + 2, z0 + bt + 3, d - bt - 3, 0);
  for (let i = 0; i < nR; i++) {
    const a = z0 + d + (runR * i) / nR, b = z0 + d + (runR * (i + 1)) / nR;
    backC(x0 + bt + 3, (a + b) / 2, b - a - 1, Math.PI / 2);
  }
  // accent pillows
  const pil = fabricMat('#d8cdbb', 'boucle');
  for (const [x, z, ry] of [[x0 + bt + 9, z0 + bt + 9, Math.PI / 4], [x1 - arm - 10, z0 + bt + 7, -0.15]]) {
    const m = meshAt(rbox(18, 17, 5, 2.5), pil, x, seatTop + 8, z, inner); m.rotation.y = ry; m.rotateX(-0.25);
  }
  if (p.side === 'left') inner.scale.x = -1;
  const s = p.side === 'left' ? -1 : 1;
  return { group: g, w: B, d: R, shadows: [[0, z0 + d / 2, B, d], [s * (x0 + d / 2), (z0 + d + z1) / 2, d, R - d]] };
}

function makeSofa(p) {
  const g = new THREE.Group(), W = p.w, d = p.depth, arm = 6, bt = 8, fab = fabricMat(p.color, 'linen');
  const x0 = -W / 2, x1 = W / 2, z0 = -d / 2, z1 = d / 2;
  span(g, M.black, x0 + 2, x1 - 2, 0, 3.5, z0 + 2, z1 - 2, 0.3);
  span(g, fab, x0, x1, 3.5, 30, z0, z0 + bt, 2.5);
  span(g, fab, x0, x0 + arm, 3.5, 24, z0, z1, 2.5);
  span(g, fab, x1 - arm, x1, 3.5, 24, z0, z1, 2.5);
  span(g, fab, x0 + arm, x1 - arm, 3.5, 12, z0 + bt, z1, 1.5);
  const n = Math.max(1, Math.round((W - 2 * arm) / 30)), run = W - 2 * arm;
  for (let i = 0; i < n; i++) {
    const a = x0 + arm + (run * i) / n + 0.4, b = x0 + arm + (run * (i + 1)) / n - 0.4;
    span(g, fab, a, b, 12, 18.5, z0 + bt + 0.4, z1, 2.6);
    const m = meshAt(rbox(b - a - 0.6, 17, 6.5, 3), fab, (a + b) / 2, 26.5, z0 + bt + 3, g); m.rotateX(-0.16);
  }
  return { group: g, w: W, d, shadows: [[0, 0, W, d]] };
}

function makeLoungeChair(p) {
  const g = new THREE.Group(), fab = fabricMat(p.color, 'boucle');
  const shape = new THREE.Shape();
  const a0 = -18 * DEG, a1 = 198 * DEG, ro = [15, 15.5], ri = [10.2, 10.6], cy = 0.5, N = 40;
  for (let i = 0; i <= N; i++) { const t = lerp(a0, a1, i / N); const x = Math.cos(t) * ro[0], y = cy + Math.sin(t) * ro[1]; i ? shape.lineTo(x, y) : shape.moveTo(x, y); }
  for (let i = N; i >= 0; i--) { const t = lerp(a0, a1, i / N); shape.lineTo(Math.cos(t) * ri[0], cy + Math.sin(t) * ri[1]); }
  const shell = new THREE.ExtrudeGeometry(shape, { depth: 23, bevelEnabled: true, bevelThickness: 2.4, bevelSize: 2.2, bevelSegments: 4, curveSegments: 24 });
  shell.rotateX(-Math.PI / 2); shell.translate(0, 2.4, 0);
  meshAt(shell, fab, 0, 0, 0, g);
  meshAt(rbox(24, 13, 25, 4), fab, 0, 6.5, 2.5, g);                     // seat block
  meshAt(rbox(22.5, 5.5, 22, 2.6), fab, 0, 15.2, 3.4, g);                // cushion
  const pillow = meshAt(rbox(16, 13, 4.5, 2.2), fabricMat('#8a7764', 'linen'), 0, 23, -6.5, g); pillow.rotateX(-0.3);
  return { group: g, w: 31, d: 32, shadows: [[0, 0, 32, 32]] };
}

function makeRoundTable(p) {
  const g = new THREE.Group(), r = p.dia / 2, wood = woodMat(p.color);
  const prof = [[r * 0.5, 0], [r * 0.48, 1.2], [r * 0.3, 4], [r * 0.22, 8], [r * 0.26, 11.5], [r * 0.42, 14.2], [r * 0.45, 14.6], [0, 14.6]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  meshAt(new THREE.LatheGeometry(prof, 48), wood, 0, 0, 0, g);
  meshAt(new THREE.CylinderGeometry(r, r - 0.4, 1.8, 64), wood, 0, 15.5, 0, g);
  // styling: stacked books, bowl, small vase with greenery
  meshAt(new THREE.BoxGeometry(10, 1.2, 7.5), fabricMat('#d8d0c2', 'linen'), r * 0.25, 17.0, r * 0.2, g).rotation.y = 0.3;
  meshAt(new THREE.BoxGeometry(9, 1, 6.5), fabricMat('#3d3833', 'linen'), r * 0.25, 18.1, r * 0.2, g).rotation.y = 0.15;
  const bowl = new THREE.LatheGeometry([[0, 0], [2.6, 0.2], [3.6, 1.6], [3.8, 2.2]].map(([x, y]) => new THREE.Vector2(x, y)), 32);
  meshAt(bowl, M.stone, -r * 0.35, 16.4, r * 0.15, g).material = new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.6, side: THREE.DoubleSide });
  const vase = new THREE.LatheGeometry([[0, 0], [2.2, 0.3], [3, 3], [2.2, 6], [1.2, 7.5], [1.3, 8]].map(([x, y]) => new THREE.Vector2(x, y)), 32);
  meshAt(vase, new THREE.MeshStandardMaterial({ color: '#8c8478', roughness: 0.9 }), 0, 16.4, -r * 0.35, g);
  const leaves = foliage(60, 4.5, 31, '#6f7d4f');
  leaves.position.set(0, 26.5, -r * 0.35); g.add(leaves);
  return { group: g, w: p.dia, d: p.dia, shadows: [[0, 0, p.dia * 0.9, p.dia * 0.9]] };
}

function makeOttoman(p) {
  const g = new THREE.Group();
  span(g, fabricMat(p.color, p.color === '#5b4636' ? 'linen' : 'boucle'), -p.w / 2, p.w / 2, 1.5, 16, -p.d / 2, p.d / 2, 3.5);
  span(g, M.black, -p.w / 2 + 3, p.w / 2 - 3, 0, 1.6, -p.d / 2 + 3, p.d / 2 - 3, 0.2);
  return { group: g, w: p.w, d: p.d, shadows: [[0, 0, p.w, p.d]] };
}

function makeRug(p) {
  const g = new THREE.Group();
  const m = meshAt(new THREE.BoxGeometry(p.w, 0.35, p.d), [M.felt, M.felt, rugMat(p.color, p.pattern), M.felt, M.felt, M.felt], 0, 0.18, 0, g);
  m.material = [M.felt, M.felt, rugMat(p.color, p.pattern), M.felt, M.felt, M.felt];
  g.userData.isRug = true;
  return { group: g, w: p.w, d: p.d, shadows: [] };
}

function makeConsole(p) {
  const g = new THREE.Group(), wood = woodMat(p.color), y0 = CONSOLE_Y0, h = CONSOLE_H, d = 15;
  span(g, wood, -p.w / 2, p.w / 2, y0, y0 + h, -d / 2, d / 2, 0.6);
  const n = Math.floor(p.w / 1.6);
  const groove = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, h - 2, 0.2), M.black, n);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) groove.setMatrixAt(i, m4.makeTranslation(-p.w / 2 + 1.6 * (i + 0.5), y0 + h / 2, d / 2 + 0.05));
  g.add(groove);
  span(g, M.black, -20, 20, y0 + h, y0 + h + SOUNDBAR_H, -2, 2, 1.2);   // soundbar
  return { group: g, w: p.w, d, shadows: [[0, 0, p.w, d]] };
}

function makeSideTable(p) {
  const g = new THREE.Group(), wood = woodMat(p.color);
  meshAt(new THREE.CylinderGeometry(9, 9, 21, 48), wood, 0, 10.5, 0, g);
  meshAt(new THREE.CylinderGeometry(9.3, 9.3, 1.2, 48), wood, 0, 21.6, 0, g);
  return { group: g, w: 18, d: 18, shadows: [[0, 0, 18, 18]] };
}

function makeFloorLamp(p, item) {
  const g = new THREE.Group();
  meshAt(new THREE.CylinderGeometry(5.5, 6, 1, 32), M.metal, 0, 0.5, 0, g);
  meshAt(new THREE.CylinderGeometry(0.45, 0.45, 56, 12), M.brass, 0, 28, 0, g);
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#efe2cc', roughness: 1, side: THREE.DoubleSide, emissive: '#ffcf96', emissiveIntensity: 0 });
  meshAt(new THREE.CylinderGeometry(8, 9, 11, 40, 1, true), shadeMat, 0, 58, 0, g);
  const light = new THREE.PointLight('#ffc78a', 0, 0, 2); light.position.set(0, 57, 0); g.add(light);
  FX.lamps = FX.lamps || {}; FX.lamps[item.id] = { light, shadeMat };
  return { group: g, w: 18, d: 18, shadows: [[0, 0, 16, 16]] };
}
function setLamp(id, on) {
  const l = FX.lamps && FX.lamps[id]; if (!l) return;
  l.light.intensity = on ? LAMP_CD : 0; l.light.visible = on; l.shadeMat.emissiveIntensity = on ? 0.45 : 0;
}

/** Instanced leaf cloud: n leaves in a sphere of radius rad. */
function foliage(n, rad, seed, color) {
  const geo = new THREE.SphereGeometry(1, 6, 4); geo.scale(0.35, 0.08, 1.2);
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
  const inst = new THREE.InstancedMesh(geo, mat, n), r = rng(seed), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const base = new THREE.Color(color), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, rr = rad * Math.cbrt(r());
    const v = new THREE.Vector3(Math.sqrt(1 - u * u) * Math.cos(th), u * 0.8, Math.sqrt(1 - u * u) * Math.sin(th)).multiplyScalar(rr);
    e.set(r() * Math.PI, r() * Math.PI, r() * Math.PI); q.setFromEuler(e);
    const s = 0.8 + r() * 0.6;
    inst.setMatrixAt(i, m4.compose(v, q, new THREE.Vector3(s, s, s)));
    inst.setColorAt(i, c.copy(base).offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.1, (r() - 0.5) * 0.12));
  }
  return inst;
}

function makePlant(p) {
  const g = new THREE.Group(), h = p.h;
  const pot = new THREE.LatheGeometry([[0, 0], [7, 0], [8.6, 3], [9, 15], [8.6, 16], [7.8, 16], [7.8, 14.5]].map(([x, y]) => new THREE.Vector2(x, y)), 40);
  meshAt(pot, M.stone, 0, 0, 0, g);
  meshAt(new THREE.CircleGeometry(7.8, 32), new THREE.MeshStandardMaterial({ color: '#2a211a', roughness: 1 }), 0, 14.2, 0, g).rotation.x = -Math.PI / 2;
  const bark = new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 0.95 });
  const top = h - 16, r = rng(9);
  const trunk = new THREE.CatmullRomCurve3([[0, 14, 0], [1.5, 14 + top * 0.3, 0.5], [-1, 14 + top * 0.55, -0.5], [0.5, 14 + top * 0.7, 0]].map((a) => new THREE.Vector3(...a)));
  meshAt(new THREE.TubeGeometry(trunk, 16, 1.1, 8), bark, 0, 0, 0, g);
  const tips = [[-9, 0.82, 4], [8, 0.86, -3], [2, 0.98, 6], [-4, 0.93, -7], [6, 0.74, 7]];
  tips.forEach(([x, f, z], i) => {
    const end = new THREE.Vector3(x, 14 + top * f, z);
    const br = new THREE.CatmullRomCurve3([new THREE.Vector3(0.5, 14 + top * 0.65, 0), new THREE.Vector3(x * 0.4, 14 + top * (f - 0.08), z * 0.4), end]);
    meshAt(new THREE.TubeGeometry(br, 8, 0.45, 6), bark, 0, 0, 0, g);
    const cl = foliage(170, 5.5 + r() * 2.5, 40 + i, '#7f8b5c'); cl.position.copy(end); g.add(cl);
  });
  return { group: g, w: 18, d: 18, shadows: [[0, 0, 22, 22]] };
}

function makeTower() {
  const g = new THREE.Group();
  span(g, M.black, -4.5, 4.5, 1, 41, -6, 6, 0.6);
  const grille = fabricMat('#1b1a19', 'linen');
  span(g, grille, -4.2, 4.2, 4, 39, 5.6, 6.3, 0.3);
  for (const [y, r] of [[34, 1.6], [26, 2.8], [16, 2.8]]) meshAt(new THREE.CylinderGeometry(r, r, 0.3, 24), M.metal, 0, y, 6.4, g).rotation.x = Math.PI / 2;
  return { group: g, w: 9, d: 12, shadows: [[0, 0, 11, 13]] };
}
function makeSub() {
  const g = new THREE.Group();
  span(g, M.black, -7.5, 7.5, 0.6, 15.6, -7.5, 7.5, 0.8);
  meshAt(new THREE.CylinderGeometry(5.5, 5.5, 0.4, 32), M.metal, 0, 8, 7.6, g).rotation.x = Math.PI / 2;
  return { group: g, w: 15, d: 15, shadows: [[0, 0, 17, 17]] };
}
function makeRecliner(p) {
  const g = new THREE.Group(), fab = fabricMat(p.color, 'linen');
  span(g, fab, -18, -12, 2, 25, -18, 16, 2.4); span(g, fab, 12, 18, 2, 25, -18, 16, 2.4);
  span(g, fab, -12, 12, 2, 18, -12, 16, 2.4);
  const back = span(g, fab, -12, 12, 18, 41, -18, -10, 3); back.rotation.x = -0.12;
  span(g, M.black, -17, 17, 0, 2, -16, 14, 0.3);
  return { group: g, w: 36, d: 38, shadows: [[0, 0, 36, 38]] };
}

function makePouf(p) {
  const g = new THREE.Group();
  meshAt(new THREE.CylinderGeometry(10, 10, 15, 40), fabricMat(p.color, 'boucle'), 0, 8, 0, g);
  meshAt(new THREE.TorusGeometry(9.2, 1.4, 12, 40), fabricMat(p.color, 'boucle'), 0, 15.4, 0, g).rotation.x = Math.PI / 2;
  meshAt(new THREE.CircleGeometry(9.3, 40), fabricMat(p.color, 'boucle'), 0, 16.6, 0, g).rotation.x = -Math.PI / 2;
  return { group: g, w: 20, d: 20, shadows: [[0, 0, 20, 20]] };
}
function makeBarCart() {
  const g = new THREE.Group(), w = 24, d = 16;
  for (const [x, z] of [[-w / 2 + 0.6, -d / 2 + 0.6], [w / 2 - 0.6, -d / 2 + 0.6], [-w / 2 + 0.6, d / 2 - 0.6], [w / 2 - 0.6, d / 2 - 0.6]]) {
    meshAt(new THREE.CylinderGeometry(0.45, 0.45, 32, 10), M.brass, x, 16, z, g);
  }
  for (const y of [6, 30]) meshAt(new THREE.BoxGeometry(w - 0.4, 0.8, d - 0.4), woodMat('#3b281b'), 0, y, 0, g);
  const glass = new THREE.MeshStandardMaterial({ color: '#c9d3cf', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45 });
  const amber = new THREE.MeshStandardMaterial({ color: '#8a4b16', roughness: 0.1, transparent: true, opacity: 0.8 });
  for (const [x, z, hgt, mat] of [[-7, -2, 11, amber], [-3, 3, 9, glass], [5, -3, 12, glass], [8, 3, 4, amber]]) {
    meshAt(new THREE.CylinderGeometry(1.4, 1.6, hgt, 16), mat, x, 30.4 + hgt / 2, z, g);
  }
  meshAt(new THREE.CylinderGeometry(2.2, 1.8, 4, 20), M.metal, 2, 8.4, 0, g);   // ice bucket
  return { group: g, w, d, shadows: [[0, 0, w, d]] };
}

const CONSOLE_Y0 = 6, CONSOLE_H = 13, SOUNDBAR_H = 2.6;
const FACTORIES = {
  sectional: makeSectional, sofa: makeSofa, loungeChair: makeLoungeChair, roundTable: makeRoundTable, ottoman: makeOttoman,
  rug: makeRug, console: makeConsole, sideTable: makeSideTable, floorLamp: makeFloorLamp, plant: makePlant,
  towerSpeaker: makeTower, subwoofer: makeSub, recliner: makeRecliner, pouf: makePouf, barCart: makeBarCart,
};

const itemObjects = new Map();      // id -> { group, w, d }
function buildItem(item) {
  const old = itemObjects.get(item.id);
  if (old) { itemsGroup.remove(old.group); disposeGroup(old.group); }
  const def = CATALOG[item.type]; if (!def) return;
  item.p = { ...def.defaults, ...item.p };
  const built = FACTORIES[item.type](item.p, item);
  const holder = new THREE.Group();
  holder.add(built.group);
  for (const [x, z, w, d] of built.shadows) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.3, d * 1.3), M.shadow);
    s.rotation.x = -Math.PI / 2; s.position.set(x, 0.25, z); s.renderOrder = 1; holder.add(s);
  }
  holder.userData.itemId = item.id;
  holder.traverse((o) => { o.userData.itemId = item.id; });
  placeItem(holder, item);
  itemsGroup.add(holder);
  itemObjects.set(item.id, { group: holder, w: built.w, d: built.d });
}
function placeItem(holder, item) {
  const lift = item.type === 'rug' ? 0 : 0;
  holder.position.copy(P(item.x, item.y, lift));
  holder.rotation.y = Math.PI + item.rot * DEG;
}
function buildAllItems() {
  for (const { group } of itemObjects.values()) { itemsGroup.remove(group); disposeGroup(group); }
  itemObjects.clear(); FX.lamps = {};
  for (const it of state.items) buildItem(it);
}
