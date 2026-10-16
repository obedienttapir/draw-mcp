// ===================================================================
// 40 · Furniture. Each factory builds in a local frame: origin = centre
// of the footprint on the floor, +Z = the side people face, inches.
// It gets the geometry params p, the item, and its resolved style s
// (variant, cover, colour, wood, metal, stone: see 45-styles.js) and
// returns { group, w, d, shadows: [[x, z, w, d]] }.
// ===================================================================
const rbox = (w, h, d, r = 1.5, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
function meshAt(geo, mat, x, y, z, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }
/** Box spanning x0..x1, y0..y1, z0..z1 (rounded). */
function span(parent, mat, x0, x1, y0, y1, z0, z1, r = 1.5) {
  return meshAt(rbox(x1 - x0, y1 - y0, z1 - z0, r), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, parent);
}
/** Cylinder between two points (legs, tubes, struts). */
function strut(parent, mat, a, b, r0, r1 = r0, seg = 10) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const m = meshAt(new THREE.CylinderGeometry(r1, r0, len, seg), mat, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, parent);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}
/** Instanced copies of one geometry at [x, y, z, rotY] positions. */
function instances(parent, geo, mat, list) {
  const inst = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  list.forEach(([x, y, z, ry = 0], i) => inst.setMatrixAt(i, m4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), one)));
  inst.count = list.length; parent.add(inst); return inst;
}

// style sets dress every piece, so the catalogue only carries geometry
const CATALOG = {
  sectional: {
    label: 'L-sectional', note: 'Six styles, return on either side', defaults: { back: 136, ret: 104, depth: 38, side: 'right' },
    params: [['back', 'Back length', 84, 180], ['ret', 'Return length', 60, 140], ['depth', 'Seat depth', 32, 44]],
    options: [['side', 'Return side', [['right', 'Right'], ['left', 'Left']]]],
  },
  sofa: { label: 'Sofa', note: 'Straight, six styles', defaults: { w: 90, depth: 38 }, params: [['w', 'Length', 60, 120], ['depth', 'Seat depth', 32, 44]] },
  loungeChair: { label: 'Lounge chair', note: 'Tub, frame, sling, swivel or low', defaults: {}, params: [] },
  roundTable: { label: 'Coffee table', note: 'Pedestal, slab, tulip, drum or steel', defaults: { dia: 34 }, params: [['dia', 'Size', 24, 48]] },
  ottoman: { label: 'Ottoman', note: 'Block, tufted or tray', defaults: { w: 40, d: 30 }, params: [['w', 'Width', 18, 60], ['d', 'Depth', 18, 48]] },
  rug: { label: 'Rug', note: 'Six weaves', defaults: { w: 120, d: 96 }, params: [['w', 'Length', 36, 168], ['d', 'Width', 24, 144]] },
  console: { label: 'Media console', note: 'Wall-hung or on legs', defaults: { w: 70 }, params: [['w', 'Length', 40, 84]] },
  sideTable: { label: 'Side table', note: 'Drum, C-table, stump or stone', defaults: {}, params: [] },
  floorLamp: { label: 'Floor lamp', note: 'Drum, arc, tripod, lantern or globe', defaults: {}, params: [] },
  plant: { label: 'Plant', note: 'Olive, fiddle-leaf fig or snake plant', defaults: { h: 70 }, params: [['h', 'Height', 36, 90]] },
  towerSpeaker: { label: 'Tower speaker', note: 'Front L / R', defaults: {}, params: [] },
  subwoofer: { label: 'Subwoofer', note: '15″ cube', defaults: {}, params: [] },
  recliner: { label: 'Cinema recliner', note: 'Power recline, 36″ wide', defaults: {}, params: [] },
  pouf: { label: 'Pouf', note: '20″ extra seat or footrest', defaults: {}, params: [] },
  barCart: { label: 'Bar cart', note: '24″ × 16″, two shelves', defaults: {}, params: [] },
};

// ---------------- sectional and sofa ----------------
// base: plinth | taper (wood legs) | steel (legs) | brass (plinth with a brass kick)
// back: loose cushions | bolster | tufted (buttons) | rolls (two stacked) | channels (vertical) | headrest (recliner modules)
const SEAT_STYLES = {
  track:    { base: 'plinth', baseH: 3.5, deck: 12, seat: 18.5, frameH: 30, bt: 8, armH: 24, armW: 6, arm: 'track', back: 'loose', cr: 2.6, cw: 30 },
  modular:  { base: 'plinth', baseH: 2.5, deck: 9.5, seat: 16, frameH: 21, bt: 7, armH: 0, armW: 0, arm: 'none', back: 'bolster', cr: 4, cw: 36 },
  tufted:   { base: 'taper', baseH: 6.5, deck: 13, seat: 18, frameH: 31, bt: 7, armH: 24, armW: 4.5, arm: 'track', back: 'tufted', cr: 1.6, cw: 0 },
  slope:    { base: 'steel', baseH: 4.5, deck: 12, seat: 18.5, frameH: 26, bt: 7, armH: 25, armW: 7, arm: 'slope', back: 'rolls', cr: 3.4, cw: 30 },
  channel:  { base: 'brass', baseH: 3, deck: 12, seat: 18, frameH: 31, bt: 4.5, armH: 25, armW: 7, arm: 'pillow', back: 'channels', cr: 2.2, cw: 0 },
  recliner: { base: 'plinth', baseH: 3, deck: 12.5, seat: 19.5, frameH: 26, bt: 6, armH: 25, armW: 7.5, arm: 'track', back: 'headrest', cr: 2.8, cw: 34 },
};
function makeSeating(p, s, isL) {
  const st = SEAT_STYLES[s.variant] || SEAT_STYLES.track;
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const fab = coverMat(s.cover, s.color), d = p.depth, B = isL ? p.back : p.w, R = isL ? p.ret : d;
  const { baseH: base, deck, seat: seatTop, frameH, bt, armH, cr } = st, arm = st.arm === 'none' ? 0 : st.armW;
  const x0 = -B / 2, x1 = B / 2, z0 = -R / 2, z1 = z0 + R, zf = z0 + d;
  const box = (mat, xa, xb, ya, yb, za, zb, r) => span(inner, mat, xa, xb, ya, yb, za, zb, r);
  // runs: u along the seat row, v from the back (vb) to the front (vf); 'x' rows face +z, 'z' rows face +x
  const runs = isL
    ? [{ axis: 'x', u0: x0 + d, u1: x1 - arm, vb: z0 + bt, vf: zf, corner: d - bt }, { axis: 'z', u0: zf, u1: z1 - arm, vb: x0 + bt, vf: x0 + d, corner: 0 }]
    : [{ axis: 'x', u0: x0 + arm, u1: x1 - arm, vb: z0 + bt, vf: zf, corner: 0 }];
  const inRun = (run, mat, ua, ub, ya, yb, va, vb, r) => (run.axis === 'x' ? box(mat, ua, ub, ya, yb, va, vb, r) : box(mat, va, vb, ya, yb, ua, ub, r));
  const placeRot = (run, m, u, y, v, tilt) => {
    if (run.axis === 'x') m.position.set(u, y, v); else { m.position.set(v, y, u); m.rotation.y = Math.PI / 2; }
    if (tilt) m.rotateX(-tilt); inner.add(m); return m;
  };
  // ---- base ----
  const feet = [[x0, x1, z0, zf]]; if (isL) feet.push([x0, x0 + d, zf, z1]);
  if (st.base === 'taper' || st.base === 'steel') {
    const wood = woodFinish('walnut'), steel = metalFinish('black'), pts = [];
    for (const [xa, xb, za, zb] of feet) {
      const nx = Math.max(1, Math.ceil((xb - xa) / 64)), nz = Math.max(1, Math.ceil((zb - za) / 64));
      for (let i = 0; i <= nx; i++) for (const z of [za + 2.5, zb - 2.5]) pts.push([lerp(xa + 2.5, xb - 2.5, i / nx), z]);
      for (let k = 1; k < nz; k++) for (const x of [xa + 2.5, xb - 2.5]) pts.push([x, lerp(za + 2.5, zb - 2.5, k / nz)]);
    }
    const seen = new Set();
    for (const [x, z] of pts) {
      const key = `${Math.round(x)},${Math.round(z)}`; if (seen.has(key)) continue; seen.add(key);
      if (st.base === 'taper') strut(inner, wood, [x * 1.004, 0, z * 1.004 + 0.3], [x, base, z], 0.45, 0.85, 10);
      else meshAt(new THREE.BoxGeometry(1.3, base, 1.3), steel, x, base / 2, z, inner);
    }
  } else {
    for (const [xa, xb, za, zb] of feet) box(M.black, xa + 2, xb - 2, 0, base, za + 2, zb - 2, 0.3);
    if (st.base === 'brass') {
      box(M.brass, x0 + 2, x1 - 2, 0.4, 1.0, zf - 2.2, zf - 1.9, 0.1);
      if (isL) box(M.brass, x0 + d - 2.2, x0 + d - 1.9, 0.4, 1.0, zf, z1 - 2, 0.1);
    }
  }
  // ---- back frame and arms ----
  const backs = isL ? [[x0, x1 - arm, z0, z0 + bt], [x0, x0 + bt, z0 + bt, z1 - arm]] : [[x0, x1, z0, z0 + bt]];
  for (const [xa, xb, za, zb] of backs) box(fab, xa, xb, base, frameH, za, zb, st.back === 'tufted' ? 1.6 : 2.5);
  const arms = isL ? [[x1 - arm, x1, z0, zf, 'z'], [x0, x0 + d, z1 - arm, z1, 'x']] : [[x0, x0 + arm, z0, zf, 'z'], [x1 - arm, x1, z0, zf, 'z']];
  if (arm) for (const [xa, xb, za, zb, along] of arms) {
    if (st.arm === 'slope') {
      // sloping arm: high at the back, low at the front (profile extruded across the arm's width)
      const len = along === 'z' ? zb - za : xb - xa, wd = along === 'z' ? xb - xa : zb - za;
      const sh = new THREE.Shape([[0.8, base], [len - 0.8, base], [len - 0.8, armH - 5.5], [len - 3.5, armH - 4], [2.5, armH], [0.8, armH - 1.5]].map(([a, b]) => new THREE.Vector2(a, b)));
      const geo = new THREE.ExtrudeGeometry(sh, { depth: wd - 1.6, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.8, bevelSegments: 3 });
      const m = new THREE.Mesh(geo, fab);
      if (along === 'z') { m.rotation.y = -Math.PI / 2; m.position.set(xb - 0.8, 0, za); } else { m.position.set(xa, 0, za + 0.8); }
      inner.add(m);
    } else box(fab, xa, xb, base, armH, za, zb, st.arm === 'pillow' ? Math.min(xb - xa, zb - za) / 2 - 0.2 : 2.5);
  }
  // ---- deck ----
  for (const run of runs) inRun(run, fab, run.u0 - run.corner, run.u1, base, deck, run.vb, run.vf, 1.5);
  // ---- seats and backs per run ----
  const gap = 0.4, darker = coverMat(s.cover, css(shade(s.color, -0.35)));
  const buttons = [], channels = [];
  for (const run of runs) {
    const len = run.u1 - run.u0, depth = run.vf - run.vb;
    // seat cushions (bench styles get one long cushion per run)
    const cells = [];
    if (run.corner) cells.push([run.u0 - run.corner, run.u0, true]);
    const n = st.cw ? Math.max(1, Math.round(len / st.cw)) : 1;
    for (let i = 0; i < n; i++) cells.push([run.u0 + (len * i) / n, run.u0 + (len * (i + 1)) / n, false]);
    if (!st.cw && run.corner) { cells.length = 0; cells.push([run.u0 - run.corner, run.u1, false]); }
    for (const [ua, ub, corner] of cells) {
      inRun(run, fab, ua + gap, ub - gap, deck, seatTop, run.vb + gap, run.vf, cr);
      const w = ub - ua;
      if (st.back === 'loose') placeRot(run, new THREE.Mesh(rbox(w - 1, 17, 6.5, 3), fab), (ua + ub) / 2, seatTop + 8, run.vb + 3, 0.16);
      else if (st.back === 'bolster') placeRot(run, new THREE.Mesh(rbox(w - 1.2, 11, 8.5, 4.2), fab), (ua + ub) / 2, seatTop + 5.5, run.vb + 4.2, 0.1);
      else if (st.back === 'rolls') {
        placeRot(run, new THREE.Mesh(rbox(w - 1, 8, 7.5, 3.6), fab), (ua + ub) / 2, seatTop + 4.6, run.vb + 3.9, 0.1);
        placeRot(run, new THREE.Mesh(rbox(w - 1, 8, 7.5, 3.6), fab), (ua + ub) / 2, seatTop + 12.2, run.vb + 3.1, 0.14);
      } else if (st.back === 'headrest') {
        // reclining module: tall back with a headrest, and the footrest seam on the front
        placeRot(run, new THREE.Mesh(rbox(w - 1.2, 20, 7, 3), fab), (ua + ub) / 2, seatTop + 9.8, run.vb + 3.4, 0.1);
        if (!corner) placeRot(run, new THREE.Mesh(rbox(w - 5, 7.5, 4.5, 2.4), fab), (ua + ub) / 2, seatTop + 18.5, run.vb + 5.6, 0.1);
        if (!corner) inRun(run, M.black, ua + 1, ub - 1, deck - 2.4, deck - 2, run.vf - 0.05, run.vf + 0.15, 0.05);
      }
    }
    // tight backs: button grid or vertical channels across the back face
    const ua = run.u0 - run.corner, ub = run.u1;
    if (st.back === 'tufted') {
      for (let y = seatTop + 3.5, row = 0; y < frameH - 2.5; y += 5, row++) {
        for (let u = ua + 3 + (row % 2) * 3.5; u < ub - 2; u += 7) buttons.push(run.axis === 'x' ? [u, y, run.vb + 0.05] : [run.vb + 0.05, y, u, Math.PI / 2]);
      }
    } else if (st.back === 'channels') {
      const k = Math.max(1, Math.floor((ub - ua) / 6.2));
      for (let i = 0; i < k; i++) {
        const u = ua + ((ub - ua) * (i + 0.5)) / k;
        channels.push(run.axis === 'x' ? [u, (seatTop - 1 + frameH) / 2, run.vb + 2.2] : [run.vb + 2.2, (seatTop - 1 + frameH) / 2, u, Math.PI / 2]);
      }
    }
  }
  if (buttons.length) instances(inner, new THREE.SphereGeometry(0.6, 10, 6).scale(1, 1, 0.55), darker, buttons);
  if (channels.length) instances(inner, rbox(5.7, frameH - seatTop + 1, 4.4, 2), fab, channels);   // ~6.2″ channels
  // accent pillows from the set
  const pil = (STYLE_SETS[activeSetId()].pieces.pillow);
  if (pil && st.back !== 'headrest') {
    const pm = coverMat(pil.cover, pil.color), spots = isL ? [[x0 + bt + 9, z0 + bt + 9, Math.PI / 4], [x1 - arm - 10, z0 + bt + 7, -0.15]] : [[x0 + arm + 9, z0 + bt + 7, 0.2], [x1 - arm - 9, z0 + bt + 7, -0.2]];
    for (const [x, z, ry] of spots) { const m = meshAt(rbox(18, 17, 5, 2.5), pm, x, seatTop + 8, z, inner); m.rotation.y = ry; m.rotateX(-0.25); }
  }
  if (isL && p.side === 'left') inner.scale.x = -1;
  const sx = isL && p.side === 'left' ? -1 : 1;
  return { group: g, w: B, d: R, shadows: isL ? [[0, z0 + d / 2, B, d], [sx * (x0 + d / 2), (zf + z1) / 2, d, R - d]] : [[0, 0, B, d]] };
}
const makeSectional = (p, item, s) => makeSeating(p, s, true);
const makeSofa = (p, item, s) => makeSeating(p, s, false);

// ---------------- lounge chairs ----------------
function makeLoungeChair(p, item, s) {
  const g = new THREE.Group(), fab = coverMat(s.cover, s.color), v = s.variant;
  const pillowMat = coverMat('linen', css(shade(s.color, -0.3)));
  if (v === 'frame') {                                    // mid-century: solid wood frame, loose cushions
    const wood = woodFinish(s.wood || 'walnut');
    for (const sx of [-1, 1]) {
      const x = sx * 13.5;
      strut(g, wood, [x, 0, 12], [x, 22.4, 11], 0.6, 0.8);
      strut(g, wood, [x, 0, -13], [x, 22.4, -9], 0.6, 0.8);
      span(g, wood, x - 1.3, x + 1.3, 21.8, 23.1, -13, 15, 0.5);
      span(g, wood, x - 0.7, x + 0.7, 8, 9.6, -11, 11, 0.3);
    }
    for (const z of [10.5, -10.5]) span(g, wood, -13, 13, 8, 9.6, z - 0.8, z + 0.8, 0.3);
    span(g, fab, -12.5, 12.5, 10, 15.5, -10.5, 13, 2.2);
    const back = meshAt(rbox(25, 19, 5, 2.2), fab, 0, 24.5, -11, g); back.rotation.x = -0.3;
    const rail = meshAt(rbox(27.4, 1.6, 1.4, 0.4), wood, 0, 32.5, -15, g); rail.rotation.x = -0.3;
    return { group: g, w: 30, d: 33, shadows: [[0, 0, 30, 32]] };
  }
  if (v === 'sling') {                                    // black steel frame, slung seat and back
    const steel = metalFinish(s.metal || 'black');
    for (const sx of [-1, 1]) {
      const x = sx * 13;
      strut(g, steel, [x, 0, 12], [x, 22, 12], 0.5);
      strut(g, steel, [x, 22, 12], [x, 22, -9], 0.5);
      strut(g, steel, [x, 22, -9], [x, 31, -15], 0.5);
      strut(g, steel, [x, 0, -13], [x, 22, -9], 0.5);
      span(g, fab, x - 1.2, x + 1.2, 22.2, 23.3, -8, 11, 0.4);               // leather arm pad
    }
    strut(g, steel, [-13, 14, 11], [13, 14, 11], 0.45); strut(g, steel, [-13, 9, -10], [13, 9, -10], 0.45);
    strut(g, steel, [-13, 31, -15], [13, 31, -15], 0.45);
    const sag = (w, h, depth) => { const geo = new THREE.PlaneGeometry(w, h, 8, 8), pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) / (w / 2), y = pos.getY(i) / (h / 2); pos.setZ(i, -depth * (1 - x * x * 0.25) * (1 - y * y)); }
      geo.computeVertexNormals(); return geo; };
    const leather = cached(`sling-${s.cover}-${s.color}`, () => { const m = coverMat(s.cover, s.color).clone(); m.side = THREE.DoubleSide; return m; });
    const seat = meshAt(sag(25, 22, 2.4), leather, 0, 11.5, 0.5, g); seat.rotation.x = -Math.PI / 2 + 0.22;
    const back = meshAt(sag(25, 21, 1.6), leather, 0, 21.5, -12.5, g); back.rotation.x = -0.45;
    return { group: g, w: 28, d: 32, shadows: [[0, 0, 28, 30]] };
  }
  if (v === 'swivel') {                                   // barrel back on a swivel base
    const metal = metalFinish(s.metal || 'black');
    meshAt(new THREE.CylinderGeometry(9, 9.5, 0.8, 40), metal, 0, 0.4, 0, g);
    meshAt(new THREE.CylinderGeometry(1.8, 1.8, 5, 16), metal, 0, 3.2, 0, g);
    meshAt(new THREE.CylinderGeometry(13.5, 13, 6, 40), fab, 0, 8.5, 0, g);
    const shape = new THREE.Shape(), a0 = -40 * DEG, a1 = 220 * DEG, N = 40;
    for (let i = 0; i <= N; i++) { const t = lerp(a0, a1, i / N), x = Math.cos(t) * 14.6, y = Math.sin(t) * 14.6; i ? shape.lineTo(x, y) : shape.moveTo(x, y); }
    for (let i = N; i >= 0; i--) { const t = lerp(a0, a1, i / N); shape.lineTo(Math.cos(t) * 11.2, Math.sin(t) * 11.2); }
    const shell = new THREE.ExtrudeGeometry(shape, { depth: 15.5, bevelEnabled: true, bevelThickness: 1.6, bevelSize: 1.4, bevelSegments: 4, curveSegments: 24 });
    shell.rotateX(-Math.PI / 2); shell.translate(0, 11.6, 0);
    meshAt(shell, fab, 0, 0, 0, g);
    const seat = meshAt(new THREE.CylinderGeometry(11.6, 12, 5, 40), fab, 0, 14, 1, g); seat.scale.set(1, 1, 0.95);
    return { group: g, w: 30, d: 30, shadows: [[0, 0, 30, 30]] };
  }
  if (v === 'low') {                                      // Japandi: low oak sides, deep cushions
    const wood = woodFinish(s.wood || 'oak');
    for (const sx of [-1, 1]) span(g, wood, sx * 14.5 - 0.8, sx * 14.5 + 0.8, 0, 19, -14, 15, 0.7);
    span(g, wood, -13.7, 13.7, 4, 6.5, -13, 13, 0.4);
    span(g, wood, -13.7, 13.7, 6.5, 24, -14.5, -12.8, 0.4);
    span(g, fab, -13.6, 13.6, 6.5, 13.5, -12.5, 14, 2.8);
    const back = meshAt(rbox(27, 15, 6, 2.6), fab, 0, 20, -10.4, g); back.rotation.x = -0.22;
    const pil = meshAt(rbox(14, 11, 4, 2), pillowMat, 4, 18, -6.8, g); pil.rotation.x = -0.3; pil.rotation.z = -0.1;
    return { group: g, w: 30, d: 30, shadows: [[0, 0, 31, 31]] };
  }
  // curved tub shell (the original bouclé chair)
  const shape = new THREE.Shape();
  const a0 = -18 * DEG, a1 = 198 * DEG, ro = [15, 15.5], ri = [10.2, 10.6], cy = 0.5, N = 40;
  for (let i = 0; i <= N; i++) { const t = lerp(a0, a1, i / N); const x = Math.cos(t) * ro[0], y = cy + Math.sin(t) * ro[1]; i ? shape.lineTo(x, y) : shape.moveTo(x, y); }
  for (let i = N; i >= 0; i--) { const t = lerp(a0, a1, i / N); shape.lineTo(Math.cos(t) * ri[0], cy + Math.sin(t) * ri[1]); }
  const shell = new THREE.ExtrudeGeometry(shape, { depth: 23, bevelEnabled: true, bevelThickness: 2.4, bevelSize: 2.2, bevelSegments: 4, curveSegments: 24 });
  shell.rotateX(-Math.PI / 2); shell.translate(0, 2.4, 0);
  meshAt(shell, fab, 0, 0, 0, g);
  meshAt(rbox(24, 13, 25, 4), fab, 0, 6.5, 2.5, g);                     // seat block
  meshAt(rbox(22.5, 5.5, 22, 2.6), fab, 0, 15.2, 3.4, g);                // cushion
  const pillow = meshAt(rbox(16, 13, 4.5, 2.2), pillowMat, 0, 23, -6.5, g); pillow.rotateX(-0.3);
  return { group: g, w: 31, d: 32, shadows: [[0, 0, 32, 32]] };
}

// ---------------- coffee tables ----------------
function makeRoundTable(p, item, s) {
  const g = new THREE.Group(), D = p.dia, v = s.variant;
  const wood = woodFinish(s.wood || 'walnut');
  let top = 16.4, fw = D, fd = D;
  if (v === 'slab' || v === 'frame') {
    fw = D * 1.4; fd = D * 0.72;
    if (v === 'slab') {
      top = 14; span(g, wood, -fw / 2, fw / 2, 11.4, top, -fd / 2, fd / 2, 0.5);
      for (const sx of [-1, 1]) span(g, wood, sx * (fw / 2 - 5) - 1.4, sx * (fw / 2 - 5) + 1.4, 0, 11.4, -fd / 2 + 2, fd / 2 - 2, 0.3);
    } else {
      const steel = metalFinish(s.metal || 'black');
      top = 17.3; span(g, woodFinish(s.wood || 'reclaimed'), -fw / 2, fw / 2, 15.5, top, -fd / 2, fd / 2, 0.3);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) meshAt(new THREE.BoxGeometry(1.2, 15.5, 1.2), steel, x * (fw / 2 - 1.2), 7.75, z * (fd / 2 - 1.2), g);
      for (const y of [4.2, 15]) for (const z of [-1, 1]) meshAt(new THREE.BoxGeometry(fw - 2.4, 0.8, 0.8), steel, 0, y, z * (fd / 2 - 1.2), g);
      span(g, woodFinish(s.wood || 'reclaimed'), -fw / 2 + 1.8, fw / 2 - 1.8, 4.2, 5.1, -fd / 2 + 1.6, fd / 2 - 1.6, 0.2);
    }
  } else if (v === 'tulip') {
    const base = metalFinish(s.metal || 'nickel'), stone = stoneFinish(s.stone || 'marble');
    const prof = [[D * 0.36, 0], [D * 0.34, 0.8], [D * 0.12, 3], [D * 0.06, 8], [D * 0.07, 12.5], [D * 0.16, 15], [0, 15]].map(([x, y]) => new THREE.Vector2(x, y));
    meshAt(new THREE.LatheGeometry(prof, 48), base, 0, 0, 0, g);
    top = 16.1; meshAt(new THREE.CylinderGeometry(D / 2, D / 2 - 0.5, 1.1, 64), stone, 0, 15.55, 0, g);
  } else if (v === 'drum') {
    const stone = stoneFinish(s.stone || 'travertine');
    meshAt(new THREE.CylinderGeometry(D / 2, D / 2, 12, 64), stone, 0, 6, 0, g);
    meshAt(new THREE.CylinderGeometry(D / 2 - 0.9, D / 2 - 0.9, 0.7, 64), M.black, 0, 12.35, 0, g);         // shadow reveal
    top = 15.2; meshAt(new THREE.CylinderGeometry(D / 2, D / 2, 2.5, 64), stone, 0, 13.95, 0, g);
  } else {                                                                                                  // sculpted pedestal
    const r = D / 2;
    const prof = [[r * 0.5, 0], [r * 0.48, 1.2], [r * 0.3, 4], [r * 0.22, 8], [r * 0.26, 11.5], [r * 0.42, 14.2], [r * 0.45, 14.6], [0, 14.6]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    meshAt(new THREE.LatheGeometry(prof, 48), wood, 0, 0, 0, g);
    meshAt(new THREE.CylinderGeometry(r, r - 0.4, 1.8, 64), wood, 0, 15.5, 0, g);
  }
  // styling: stacked books, a bowl, a small vase with greenery
  const r = Math.min(fw, fd) / 2, sx = fw / Math.min(fw, fd);
  meshAt(new THREE.BoxGeometry(10, 1.2, 7.5), fabricMat('#d8d0c2', 'linen'), r * 0.25 * sx, top + 0.6, r * 0.2, g).rotation.y = 0.3;
  meshAt(new THREE.BoxGeometry(9, 1, 6.5), fabricMat('#3d3833', 'linen'), r * 0.25 * sx, top + 1.7, r * 0.2, g).rotation.y = 0.15;
  const bowl = new THREE.LatheGeometry([[0, 0], [2.6, 0.2], [3.6, 1.6], [3.8, 2.2]].map(([x, y]) => new THREE.Vector2(x, y)), 32);
  meshAt(bowl, cached('bowl', () => new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.6, side: THREE.DoubleSide })), -r * 0.4 * sx, top, r * 0.15, g);
  const vase = new THREE.LatheGeometry([[0, 0], [2.2, 0.3], [3, 3], [2.2, 6], [1.2, 7.5], [1.3, 8]].map(([x, y]) => new THREE.Vector2(x, y)), 32);
  meshAt(vase, cached('vase', () => new THREE.MeshStandardMaterial({ color: '#8c8478', roughness: 0.9 })), 0, top, -r * 0.35, g);
  const leaves = foliage(60, 4.5, 31, '#6f7d4f');
  leaves.position.set(0, top + 10, -r * 0.35); g.add(leaves);
  return { group: g, w: fw, d: fd, shadows: [[0, 0, fw * 0.9, fd * 0.9]] };
}

// ---------------- ottoman and pouf ----------------
function makeOttoman(p, item, s) {
  const g = new THREE.Group(), fab = coverMat(s.cover, s.color), v = s.variant;
  if (v === 'tufted') {
    const wood = woodFinish(s.wood || 'walnut');
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) strut(g, wood, [x * (p.w / 2 - 2.2), 0, z * (p.d / 2 - 2.2)], [x * (p.w / 2 - 2.8), 7, z * (p.d / 2 - 2.8)], 0.45, 0.75);
    span(g, fab, -p.w / 2, p.w / 2, 7, 16.5, -p.d / 2, p.d / 2, 2.6);
    const btn = [];
    for (let i = 1; i < 4; i++) for (let k = 1; k < 3; k++) btn.push([-p.w / 2 + (p.w * i) / 4, 16.55, -p.d / 2 + (p.d * k) / 3]);
    const geo = new THREE.SphereGeometry(0.65, 10, 6); geo.scale(1, 0.5, 1);
    instances(g, geo, coverMat(s.cover, css(shade(s.color, -0.35))), btn);
  } else if (v === 'tray') {
    span(g, fab, -p.w / 2, p.w / 2, 1.5, 15, -p.d / 2, p.d / 2, 3);
    span(g, M.black, -p.w / 2 + 3, p.w / 2 - 3, 0, 1.6, -p.d / 2 + 3, p.d / 2 - 3, 0.2);
    const wood = woodFinish(s.wood || 'walnut'), tw = p.w * 0.78, td = p.d * 0.74;
    span(g, wood, -tw / 2, tw / 2, 15, 15.7, -td / 2, td / 2, 0.3);
    for (const sz of [-1, 1]) span(g, wood, -tw / 2, tw / 2, 15.7, 17, sz * td / 2 - 0.5, sz * td / 2 + 0.5, 0.2);
    for (const sx of [-1, 1]) span(g, wood, sx * tw / 2 - 0.5, sx * tw / 2 + 0.5, 15.7, 17, -td / 2, td / 2, 0.2);
  } else {
    span(g, fab, -p.w / 2, p.w / 2, 1.5, 16, -p.d / 2, p.d / 2, 3.5);
    span(g, M.black, -p.w / 2 + 3, p.w / 2 - 3, 0, 1.6, -p.d / 2 + 3, p.d / 2 - 3, 0.2);
  }
  return { group: g, w: p.w, d: p.d, shadows: [[0, 0, p.w, p.d]] };
}
function makePouf(p, item, s) {
  const g = new THREE.Group(), fab = coverMat(s.cover, s.color);
  if (s.variant === 'knit') {
    const prof = [[0, 0], [8, 0.3], [10.6, 3], [11, 7.5], [10.2, 12.5], [7.5, 15.2], [0, 15.6]].map(([x, y]) => new THREE.Vector2(x, y));
    meshAt(new THREE.LatheGeometry(prof, 40), fab, 0, 0, 0, g);
  } else {
    meshAt(new THREE.CylinderGeometry(10, 10, 15, 40), fab, 0, 8, 0, g);
    meshAt(new THREE.TorusGeometry(9.2, 1.4, 12, 40), fab, 0, 15.4, 0, g).rotation.x = Math.PI / 2;
    meshAt(new THREE.CircleGeometry(9.3, 40), fab, 0, 16.6, 0, g).rotation.x = -Math.PI / 2;
    if (s.variant === 'leather') {                       // panel seams
      const seam = coverMat(s.cover, css(shade(s.color, -0.45))), list = [];
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; list.push([Math.cos(a) * 10.02, 8, Math.sin(a) * 10.02, -a + Math.PI / 2]); }
      instances(g, new THREE.BoxGeometry(0.25, 14.6, 0.12), seam, list);
    }
  }
  return { group: g, w: 20, d: 20, shadows: [[0, 0, 20, 20]] };
}

// ---------------- rug ----------------
function makeRug(p, item, s) {
  const g = new THREE.Group(), th = s.variant === 'shag' ? 0.9 : s.variant === 'jute' ? 0.45 : 0.35;
  const top = rugMat(s.color, s.variant, s.color2 || null);
  meshAt(new THREE.BoxGeometry(p.w, th, p.d), [M.felt, M.felt, top, M.felt, M.felt, M.felt], 0, th / 2 + 0.01, 0, g);
  g.userData.isRug = true;
  return { group: g, w: p.w, d: p.d, shadows: [] };
}

// ---------------- media console ----------------
const CONSOLE_Y0 = 6, CONSOLE_H = 13, SOUNDBAR_H = 2.6;
function makeConsole(p, item, s) {
  const g = new THREE.Group(), y0 = CONSOLE_Y0, h = CONSOLE_H, d = 15, w = p.w, v = s.variant;
  const wood = woodFinish(s.wood || (v === 'cane' ? 'oak' : 'walnut'));
  const doorGaps = (mat, n) => { for (let i = 1; i < n; i++) span(g, mat, -w / 2 + (w * i) / n - 0.12, -w / 2 + (w * i) / n + 0.12, y0 + 0.8, y0 + h - 0.8, d / 2 - 0.1, d / 2 + 0.05, 0.02); };
  if (v === 'lacquer') {
    const lac = cached('lacquer-black', () => new THREE.MeshStandardMaterial({ color: '#121110', roughness: 0.62 }));
    span(g, lac, -w / 2, w / 2, y0, y0 + h, -d / 2, d / 2, 0.4);
    doorGaps(M.black, 3);
  } else if (v === 'fluted') {
    span(g, wood, -w / 2, w / 2, y0, y0 + h, -d / 2, d / 2, 0.6);
    const n = Math.floor((w - 2) / 1.7), list = [];
    for (let i = 0; i < n; i++) list.push([-w / 2 + 1 + 1.7 * (i + 0.5), y0 + h / 2, d / 2 - 0.15, -Math.PI / 2]);   // half-round faces out
    const flute = new THREE.CylinderGeometry(0.85, 0.85, h - 1.6, 10, 1, false, 0, Math.PI);
    instances(g, flute, wood, list);
    for (const x of [-w / 6, w / 6]) meshAt(new THREE.CylinderGeometry(0.28, 0.28, 5, 12), metalFinish(s.metal || 'brass'), x, y0 + h / 2, d / 2 + 1.1, g);
  } else if (v === 'frame') {
    const steel = metalFinish(s.metal || 'black');
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) meshAt(new THREE.BoxGeometry(1.2, y0 + h, 1.2), steel, x * (w / 2 - 0.6), (y0 + h) / 2, z * (d / 2 - 0.6), g);
    for (const y of [y0, y0 + h - 0.6]) for (const z of [-1, 1]) meshAt(new THREE.BoxGeometry(w, 0.6, 0.6), steel, 0, y + 0.3, z * (d / 2 - 0.6), g);
    span(g, wood, -w / 2 + 1.4, w / 2 - 1.4, y0 + 0.6, y0 + h - 0.8, -d / 2 + 1, d / 2 - 1, 0.3);
    doorGaps(M.black, 3);
  } else if (v === 'credenza') {
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) strut(g, wood, [x * (w / 2 - 3.5), 0, z * (d / 2 - 3)], [x * (w / 2 - 4), y0, z * (d / 2 - 3.4)], 0.5, 0.8);
    span(g, wood, -w / 2, w / 2, y0, y0 + h, -d / 2, d / 2, 0.5);
    doorGaps(M.black, 3);
    for (const x of [-w / 3, 0, w / 3]) meshAt(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 16), metalFinish(s.metal || 'brass'), x, y0 + h / 2, d / 2 + 0.25, g).rotation.x = Math.PI / 2;
  } else if (v === 'cane') {
    span(g, wood, -w / 2, w / 2, y0, y0 + h, -d / 2, d / 2, 0.6);
    const cane = cached('cane', () => new THREE.MeshStandardMaterial({ map: canvasTex(caneCanvas(), true, [3, 2]), roughness: 0.8 }));
    for (let i = 0; i < 3; i++) {
      const xa = -w / 2 + (w * i) / 3 + 1.4, xb = -w / 2 + (w * (i + 1)) / 3 - 1.4;
      meshAt(new THREE.PlaneGeometry(xb - xa, h - 2.8), cane, (xa + xb) / 2, y0 + h / 2, d / 2 + 0.02, g);
    }
  } else {                                                                                                 // slatted, wall-hung
    span(g, wood, -w / 2, w / 2, y0, y0 + h, -d / 2, d / 2, 0.6);
    const n = Math.floor(w / 1.6), list = [];
    for (let i = 0; i < n; i++) list.push([-w / 2 + 1.6 * (i + 0.5), y0 + h / 2, d / 2 + 0.05]);
    instances(g, new THREE.BoxGeometry(0.25, h - 2, 0.2), M.black, list);
  }
  span(g, M.black, -20, 20, y0 + h, y0 + h + SOUNDBAR_H, -2, 2, 1.2);   // soundbar
  return { group: g, w, d, shadows: [[0, 0, w, d]] };
}

// ---------------- side table ----------------
function makeSideTable(p, item, s) {
  const g = new THREE.Group(), v = s.variant;
  if (v === 'ctable') {
    const steel = metalFinish(s.metal || 'black');
    span(g, steel, -7, 7, 0, 0.6, -6, 6, 0.2);
    span(g, steel, -0.6, 0.6, 0.6, 23.4, -6, -4.8, 0.2);
    span(g, s.wood ? woodFinish(s.wood) : steel, -8, 8, 23.2, 24, -6, 6, 0.3);
    return { group: g, w: 16, d: 12, shadows: [[0, 0, 16, 12]] };
  }
  if (v === 'stump') {
    const wood = woodFinish(s.wood || 'teak'), r = rng(7), prof = [];
    for (let i = 0; i <= 8; i++) prof.push(new THREE.Vector2(7.2 + (r() - 0.5) * 1.2 + (i === 0 ? 0.6 : 0), (18 * i) / 8));
    prof.push(new THREE.Vector2(0, 18));
    meshAt(new THREE.LatheGeometry(prof, 28), wood, 0, 0, 0, g);
    return { group: g, w: 15, d: 15, shadows: [[0, 0, 16, 16]] };
  }
  if (v === 'pedestal') {
    const stone = stoneFinish(s.stone || 'travertine');
    meshAt(new THREE.CylinderGeometry(7, 7, 1.5, 40), stone, 0, 0.75, 0, g);
    meshAt(new THREE.CylinderGeometry(3.4, 3.4, 19, 32), stone, 0, 11, 0, g);
    meshAt(new THREE.CylinderGeometry(9, 9, 1.5, 48), stone, 0, 21.25, 0, g);
    return { group: g, w: 18, d: 18, shadows: [[0, 0, 18, 18]] };
  }
  const wood = woodFinish(s.wood || 'walnut');
  meshAt(new THREE.CylinderGeometry(9, 9, 21, 48), wood, 0, 10.5, 0, g);
  meshAt(new THREE.CylinderGeometry(9.3, 9.3, 1.2, 48), wood, 0, 21.6, 0, g);
  return { group: g, w: 18, d: 18, shadows: [[0, 0, 18, 18]] };
}

// ---------------- floor lamps ----------------
function makeFloorLamp(p, item, s) {
  const g = new THREE.Group(), v = s.variant, metal = metalFinish(s.metal || 'brass');
  const glowMat = (color, emissive) => new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide, emissive, emissiveIntensity: 0 });
  let shadeMat, lightAt, glow = 0.45, w = 18, d = 18;
  if (v === 'arc') {
    meshAt(new THREE.BoxGeometry(12, 3, 12), stoneFinish(s.stone || 'marble'), 0, 1.5, 0, g);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 3, -2), new THREE.Vector3(0, 98, 6), new THREE.Vector3(0, 72, 44));
    meshAt(new THREE.TubeGeometry(curve, 40, 0.45, 8), metal, 0, 0, 0, g);
    shadeMat = glowMat('#f2ede4', '#ffd9a8');
    meshAt(new THREE.SphereGeometry(8, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), shadeMat, 0, 64, 44, g);
    lightAt = [0, 63, 44]; glow = 0.35; w = 14; d = 14;
  } else if (v === 'tripod') {
    const leg = s.wood ? woodFinish(s.wood) : metal;
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.5; strut(g, leg, [Math.cos(a) * 11, 0, Math.sin(a) * 11], [0, 50, 0], 0.55, 0.7); }
    shadeMat = glowMat('#efe2cc', '#ffcf96');
    meshAt(new THREE.CylinderGeometry(8.5, 9.5, 12, 40, 1, true), shadeMat, 0, 55, 0, g);
    lightAt = [0, 54, 0]; w = 22; d = 22;
  } else if (v === 'lantern') {
    meshAt(new THREE.CylinderGeometry(6, 6.5, 0.8, 32), M.black, 0, 0.4, 0, g);
    meshAt(new THREE.CylinderGeometry(0.4, 0.4, 12, 8), M.black, 0, 6, 0, g);
    shadeMat = glowMat('#f3ece0', '#ffe2b8'); glow = 0.8;
    meshAt(new THREE.CylinderGeometry(7, 7, 44, 32, 1, true), shadeMat, 0, 34, 0, g);
    const ribs = []; for (let y = 13; y < 56; y += 3.6) ribs.push([0, y, 0]);
    const rib = new THREE.TorusGeometry(7.05, 0.12, 4, 32); rib.rotateX(Math.PI / 2);
    instances(g, rib, cached('rib', () => new THREE.MeshStandardMaterial({ color: '#d8ccb6', roughness: 1 })), ribs);
    lightAt = [0, 34, 0]; w = 14; d = 14;
  } else if (v === 'globe') {
    meshAt(new THREE.CylinderGeometry(6, 6.5, 0.9, 32), metal, 0, 0.45, 0, g);
    meshAt(new THREE.CylinderGeometry(0.4, 0.4, 54, 10), metal, 0, 27, 0, g);
    shadeMat = glowMat('#f4efe6', '#ffd9a8'); glow = 0.9;
    meshAt(new THREE.SphereGeometry(7, 32, 20), shadeMat, 0, 61, 0, g);
    lightAt = [0, 61, 0]; w = 14; d = 14;
  } else {                                                                                                 // linen drum
    meshAt(new THREE.CylinderGeometry(5.5, 6, 1, 32), metal === M.brass ? M.metal : metal, 0, 0.5, 0, g);
    meshAt(new THREE.CylinderGeometry(0.45, 0.45, 56, 12), metal, 0, 28, 0, g);
    shadeMat = glowMat('#efe2cc', '#ffcf96');
    meshAt(new THREE.CylinderGeometry(8, 9, 11, 40, 1, true), shadeMat, 0, 58, 0, g);
    lightAt = [0, 57, 0];
  }
  const light = new THREE.PointLight('#ffc78a', 0, 0, 2); light.position.set(...lightAt); g.add(light);
  FX.lamps = FX.lamps || {}; FX.lamps[item.id] = { light, shadeMat, glow };
  return { group: g, w, d, shadows: [[0, 0, w - 2, d - 2]] };
}
function setLamp(id, on) {
  const l = FX.lamps && FX.lamps[id]; if (!l) return;
  l.light.intensity = on ? LAMP_CD : 0; l.light.visible = on; l.shadeMat.emissiveIntensity = on ? l.glow : 0;
}

/** Instanced leaf cloud: n leaves in a sphere of radius rad. */
function foliage(n, rad, seed, color, leaf = [0.35, 0.08, 1.2]) {
  const geo = new THREE.SphereGeometry(1, 6, 4); geo.scale(...leaf);
  const mat = cached('leaf', () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }));
  const inst = new THREE.InstancedMesh(geo, mat, n), r = rng(seed), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const base = new THREE.Color(color), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, rr = rad * Math.cbrt(r());
    const v = new THREE.Vector3(Math.sqrt(1 - u * u) * Math.cos(th), u * 0.8, Math.sqrt(1 - u * u) * Math.sin(th)).multiplyScalar(rr);
    e.set(r() * Math.PI, r() * Math.PI, r() * Math.PI); q.setFromEuler(e);
    const sc = 0.8 + r() * 0.6;
    inst.setMatrixAt(i, m4.compose(v, q, new THREE.Vector3(sc, sc, sc)));
    inst.setColorAt(i, c.copy(base).offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.1, (r() - 0.5) * 0.12));
  }
  return inst;
}

// ---------------- plants ----------------
function plantPot(g, low) {
  const pot = low ? [[0, 0], [7, 0], [7.8, 1.5], [8, 11], [7.4, 11.4], [7, 10.4]] : [[0, 0], [7, 0], [8.6, 3], [9, 15], [8.6, 16], [7.8, 16], [7.8, 14.5]];
  meshAt(new THREE.LatheGeometry(pot.map(([x, y]) => new THREE.Vector2(x, y)), 40), M.stone, 0, 0, 0, g);
  meshAt(new THREE.CircleGeometry(low ? 7 : 7.8, 32), cached('soil', () => new THREE.MeshStandardMaterial({ color: '#2a211a', roughness: 1 })), 0, low ? 10.2 : 14.2, 0, g).rotation.x = -Math.PI / 2;
}
function makePlant(p, item, s) {
  const g = new THREE.Group(), h = p.h, v = s.variant;
  const bark = cached('bark', () => new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 0.95 }));
  if (v === 'snake') {                                    // upright sword leaves in a low planter
    plantPot(g, true);
    const r = rng(17), mat = cached('snake-leaf', () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, side: THREE.DoubleSide }));
    const n = 22, geo = new THREE.PlaneGeometry(2.6, 1, 1, 4); geo.translate(0, 0.5, 0);
    const inst = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, rr = r() * 4.5, hh = 16 + r() * 18;
      e.set((r() - 0.5) * 0.3, r() * Math.PI, (r() - 0.5) * 0.3); q.setFromEuler(e);
      inst.setMatrixAt(i, m4.compose(new THREE.Vector3(Math.cos(a) * rr, 10, Math.sin(a) * rr), q, new THREE.Vector3(0.8 + r() * 0.5, hh, 1)));
      inst.setColorAt(i, c.set(r() < 0.5 ? '#3f5f35' : '#58763f').offsetHSL(0, 0, (r() - 0.5) * 0.08));
    }
    g.add(inst);
    return { group: g, w: 16, d: 16, shadows: [[0, 0, 18, 18]] };
  }
  plantPot(g, false);
  const top = h - 16, r = rng(v === 'fiddle' ? 23 : 9);
  if (v === 'fiddle') {                                   // fiddle-leaf fig: one trunk, big glossy leaves up high
    const trunk = new THREE.CatmullRomCurve3([[0, 14, 0], [1, 14 + top * 0.5, 0.5], [-0.5, 14 + top * 0.95, 0]].map((a) => new THREE.Vector3(...a)));
    meshAt(new THREE.TubeGeometry(trunk, 16, 0.9, 8), bark, 0, 0, 0, g);
    for (const [y, rad, n, seed] of [[0.72, 7, 26, 51], [0.9, 8, 34, 52], [1.02, 6, 22, 53]]) {
      const cl = foliage(n, rad, seed, '#3f5d32', [2.4, 0.12, 3.6]); cl.position.set((r() - 0.5) * 2, 14 + top * y, (r() - 0.5) * 2); g.add(cl);
    }
    return { group: g, w: 18, d: 18, shadows: [[0, 0, 22, 22]] };
  }
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

// ---------------- AV, recliner, bar cart ----------------
function makeTower(p, item, s) {
  const g = new THREE.Group();
  span(g, avFinish(s.finish), -4.5, 4.5, 1, 41, -6, 6, 0.6);
  span(g, fabricMat('#1b1a19', 'linen'), -4.2, 4.2, 4, 39, 5.6, 6.3, 0.3);
  for (const [y, r] of [[34, 1.6], [26, 2.8], [16, 2.8]]) meshAt(new THREE.CylinderGeometry(r, r, 0.3, 24), M.metal, 0, y, 6.4, g).rotation.x = Math.PI / 2;
  return { group: g, w: 9, d: 12, shadows: [[0, 0, 11, 13]] };
}
function makeSub(p, item, s) {
  const g = new THREE.Group();
  span(g, avFinish(s.finish), -7.5, 7.5, 0.6, 15.6, -7.5, 7.5, 0.8);
  meshAt(new THREE.CylinderGeometry(5.5, 5.5, 0.4, 32), M.metal, 0, 8, 7.6, g).rotation.x = Math.PI / 2;
  return { group: g, w: 15, d: 15, shadows: [[0, 0, 17, 17]] };
}
function makeRecliner(p, item, s) {
  const g = new THREE.Group(), fab = coverMat(s.cover, s.color);
  span(g, fab, -18, -12, 2, 25, -18, 16, 2.4); span(g, fab, 12, 18, 2, 25, -18, 16, 2.4);
  span(g, fab, -12, 12, 2, 18, -12, 16, 2.4);
  const back = span(g, fab, -12, 12, 18, 41, -18, -10, 3); back.rotation.x = -0.12;
  span(g, M.black, -17, 17, 0, 2, -16, 14, 0.3);
  return { group: g, w: 36, d: 38, shadows: [[0, 0, 36, 38]] };
}
function makeBarCart(p, item, s) {
  const g = new THREE.Group(), w = 24, d = 16, wood = woodFinish(s.wood || 'walnut');
  const post = s.variant === 'oak' ? null : metalFinish(s.metal || 'brass');
  for (const [x, z] of [[-w / 2 + 0.6, -d / 2 + 0.6], [w / 2 - 0.6, -d / 2 + 0.6], [-w / 2 + 0.6, d / 2 - 0.6], [w / 2 - 0.6, d / 2 - 0.6]]) {
    if (post) meshAt(new THREE.CylinderGeometry(0.45, 0.45, 32, 10), post, x, 16, z, g);
    else span(g, wood, x - 0.7, x + 0.7, 0.5, 33, z - 0.7, z + 0.7, 0.3);
  }
  for (const y of [6, 30]) meshAt(new THREE.BoxGeometry(w - 0.4, 0.8, d - 0.4), wood, 0, y, 0, g);
  const glass = cached('cart-glass', () => new THREE.MeshStandardMaterial({ color: '#c9d3cf', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45 }));
  const amber = cached('cart-amber', () => new THREE.MeshStandardMaterial({ color: '#8a4b16', roughness: 0.1, transparent: true, opacity: 0.8 }));
  for (const [x, z, hgt, mat] of [[-7, -2, 11, amber], [-3, 3, 9, glass], [5, -3, 12, glass], [8, 3, 4, amber]]) {
    meshAt(new THREE.CylinderGeometry(1.4, 1.6, hgt, 16), mat, x, 30.4 + hgt / 2, z, g);
  }
  meshAt(new THREE.CylinderGeometry(2.2, 1.8, 4, 20), M.metal, 2, 8.4, 0, g);   // ice bucket
  return { group: g, w, d, shadows: [[0, 0, w, d]] };
}

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
  const built = FACTORIES[item.type](item.p, item, resolveSpec(item));
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
  holder.position.copy(P(item.x, item.y, 0));
  holder.rotation.y = Math.PI + item.rot * DEG;
}
function buildAllItems() {
  for (const { group } of itemObjects.values()) { itemsGroup.remove(group); disposeGroup(group); }
  itemObjects.clear(); FX.lamps = {};
  for (const it of state.items) buildItem(it);
}
