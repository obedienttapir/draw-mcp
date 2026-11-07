// ===================================================================
// 20 · Room shell. Walls are single inward-facing planes, so any wall
// between the camera and the room is culled automatically (dollhouse
// cut-away); dark caps on top read as the section cut from above.
// ===================================================================
const scene = new THREE.Scene();
const world = new THREE.Group(); scene.add(world);
const roomGroup = new THREE.Group(); world.add(roomGroup);
const fixturesGroup = new THREE.Group(); world.add(fixturesGroup);
const itemsGroup = new THREE.Group(); world.add(itemsGroup);
const lightsGroup = new THREE.Group(); world.add(lightsGroup);
const helpersGroup = new THREE.Group(); world.add(helpersGroup);
const labelsGroup = new THREE.Group(); world.add(labelsGroup);
const FX = { pots: [], leds: [], ledMeshes: [], fire: null, tv: null, transomGlow: [], bulkheads: [], ceiling: null, floor: null };
const WALL_T = 6;
const CAP_MAT = new THREE.MeshBasicMaterial({ color: '#0f0d0b' });

function disposeGroup(g) {
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.isCSS2DObject && o.element.parentNode) o.element.parentNode.removeChild(o.element);
  });
  while (g.children.length) g.remove(g.children[0]);
}

/** Inward-facing wall quad from plan p -> q (interior on the left), z0..z1 high. */
function wallQuad(p, q, z0, z1, mat) {
  const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
  const geo = new THREE.PlaneGeometry(len, z1 - z0);
  const m = new THREE.Mesh(geo, mat);
  // plane faces +Z by default; turn it so its normal is the edge's left (interior) side
  m.rotation.y = Math.atan2(dy, dx) + Math.PI;
  m.position.copy(P((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (z0 + z1) / 2));
  m.userData.wall = { p, q };
  return m;
}
/** Dark cap strip on top of a wall, extending outward by WALL_T. */
function wallCap(p, q, z) {
  const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
  const ox = dy / len, oy = -dx / len;                       // outward unit normal
  const shape = new THREE.Shape();
  const e = WALL_T;
  // extend along the edge by e at both ends so corners close
  const ux = dx / len, uy = dy / len;
  const a = [p[0] - ux * e, p[1] - uy * e], b = [q[0] + ux * e, q[1] + uy * e];
  shape.moveTo(a[0], a[1]); shape.lineTo(b[0], b[1]);
  shape.lineTo(b[0] + ox * e, b[1] + oy * e); shape.lineTo(a[0] + ox * e, a[1] + oy * e);
  const geo = new THREE.ShapeGeometry(shape); geo.rotateX(-Math.PI / 2); geo.translate(0, z, 0);
  return new THREE.Mesh(geo, CAP_MAT);
}

/** Offset an open polyline by d to its left (miter joins). */
function offsetPolyline(pts, d) {
  const lines = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
    lines.push([[x0 + nx * d, y0 + ny * d], [x1 + nx * d, y1 + ny * d]]);
  }
  const out = [lines[0][0]];
  for (let i = 0; i < lines.length - 1; i++) out.push(intersect(lines[i], lines[i + 1]) || lines[i][1]);
  out.push(lines[lines.length - 1][1]);
  return out;
}
function intersect([a, b], [c, d]) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  return [a[0] + r[0] * t, a[1] + r[1] * t];
}

function shapeFrom(pts, holes = []) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return s;
}
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** Openings in the fireplace wall, in wall coords (u = plan y, v = height). */
function fireplaceOpenings() {
  const r = state.room, f = state.fireplace;
  const fp = { u0: f.center - f.width / 2, u1: f.center + f.width / 2, v0: f.bottom, v1: f.bottom + f.height };
  // the two openings are already cut on site; treatments dress them, never move them
  const tr = [], v0 = r.transomBottom, v1 = r.transomBottom + r.transomH, half = r.transomGap / 2;
  for (const s of [-1, 1]) {
    const uA = f.center + s * half, uB = f.center + s * (half + r.transomW);
    tr.push({ u0: Math.min(uA, uB), u1: Math.max(uA, uB), v0, v1 });
  }
  return { fp, tr };
}

function buildRoom() {
  disposeGroup(roomGroup);
  FX.bulkheads = [];
  const r = state.room, G = geom();
  const H = r.ceiling;

  // ---- floor (UVs = plan inches, so plank scale is real) ----
  const floorGeo = new THREE.ShapeGeometry(shapeFrom(G.outline));
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, M.floor);
  floor.name = 'floor'; floor.userData.floor = true;
  roomGroup.add(floor); FX.floor = floor;

  // ---- walls ----
  const o = G.outline, stairOpenX = r.stairStart + 30;
  const stairwell = new THREE.Group(); stairwell.name = 'stairwell'; roomGroup.add(stairwell); FX.stairwell = stairwell;
  for (let i = 0; i < o.length; i++) {
    const p = o[i], q = o[(i + 1) % o.length];
    const isFireplaceWall = p[0] === 0 && q[0] === 0;
    if (isFireplaceWall) continue;                       // built with openings below
    const oe = G.openEdge;                               // the passage to the rest of the basement carries on: no wall there
    if (oe && p[0] === oe[0][0] && p[1] === oe[0][1] && q[0] === oe[1][0] && q[1] === oe[1][1]) continue;
    const inBay = G.bay.some((b) => b[0] === p[0] && b[1] === p[1]) && G.bay.some((b) => b[0] === q[0] && b[1] === q[1]);
    const mat = inBay && state.finish.bayAccent !== 'paint-wall' ? M.accent : M.wall;
    const segs = [[p, q]];
    // walls bordering the stairwell rise into it
    const onStairSide = Math.abs(p[1] + r.stairWidth) < 0.01 && Math.abs(q[1] + r.stairWidth) < 0.01;
    if (onStairSide && stairOpenX > Math.min(p[0], q[0]) && stairOpenX < Math.max(p[0], q[0])) segs.splice(0, 1, [p, [stairOpenX, p[1]]], [[stairOpenX, p[1]], q]);
    if (p[0] === r.width && q[0] === r.width) segs.splice(0, 1, [p, [r.width, 0]], [[r.width, 0], q]);
    const inStrip = (pt) => pt[1] <= 0.01 && pt[1] >= -r.stairWidth - 0.01;
    for (const [a, b] of segs) {
      const quad = wallQuad(a, b, 0, H, mat);
      if (inBay) quad.userData.bay = true;
      roomGroup.add(quad);
      if (inStrip(a) && inStrip(b) && Math.min(a[0], b[0]) >= stairOpenX - 0.01) stairwell.add(wallQuad(a, b, H, H + 110, M.wall));
    }
    roomGroup.add(wallCap(p, q, H + 0.2));
  }

  // ---- fireplace wall with fireplace + two transom openings ----
  const { fp, tr } = fireplaceOpenings();
  const holes = [rect(fp.u0, fp.v0, fp.u1, fp.v1), ...tr.map((t) => rect(t.u0, t.v0, t.u1, t.v1))];
  const fwGeo = new THREE.ShapeGeometry(shapeFrom(rect(0, 0, G.westY, H), holes));
  const fw = new THREE.Mesh(fwGeo, M.wall);
  // shape u (plan y) -> world -Z, v -> world Y, normal (+Z) -> world +X (into the room)
  fw.rotation.y = Math.PI / 2;
  roomGroup.add(fw);
  roomGroup.add(wallCap([0, G.westY], [0, 0], H + 0.2));
  // reveals (jambs) through the wall thickness
  for (const h of [fp, ...tr]) addReveal(h, M.wall);

  // ---- the wall facing the TV: solid from the stairwell opening to the exterior wall (both faces) ----
  if (G.wallX < r.width - 0.5) {
    const tv = wallQuad([G.wallX, 0], [r.width, 0], 0, H, M.wall); tv.name = 'wall facing TV'; roomGroup.add(tv);
    roomGroup.add(wallQuad([r.width, 0], [G.wallX, 0], 0, H, M.wall));                     // its stair side
    roomGroup.add(wallCap([G.wallX, 0], [r.width, 0], H + 0.2));
  }

  // ---- ceiling with the stairwell opening ----
  const ceilGeo = new THREE.ShapeGeometry(shapeFrom(G.outline, [rect(stairOpenX, -r.stairWidth + 0.01, r.width - 0.01, -0.01)]));
  ceilGeo.rotateX(-Math.PI / 2);
  const ceilMat = M.ceiling.clone(); ceilMat.side = THREE.BackSide;   // invisible from above
  const ceil = new THREE.Mesh(ceilGeo, ceilMat); ceil.position.y = H; ceil.name = 'ceiling';
  roomGroup.add(ceil); FX.ceiling = ceil;
  // stairwell above the opening: header, west side and a lid (inward faces only)
  const top = H + 110;
  stairwell.add(wallQuad([r.width, 0], [stairOpenX, 0], H, top, M.wall));
  stairwell.add(wallQuad([stairOpenX, 0], [stairOpenX, -r.stairWidth], H, top, M.wall));
  // where the hallway is open below, the stairwell still has its south wall above the ceiling
  if (G.hallEnd > stairOpenX) stairwell.add(wallQuad([stairOpenX, -r.stairWidth], [Math.min(G.hallEnd, r.width), -r.stairWidth], H, top, M.wall));
  const lid = new THREE.Mesh(new THREE.PlaneGeometry(r.width - stairOpenX, r.stairWidth), M.ceiling);
  lid.rotation.x = Math.PI / 2; lid.position.copy(P((stairOpenX + r.width) / 2, -r.stairWidth / 2, top));
  stairwell.add(lid);

  // ---- bay bulkhead (soffit following the bay outline) ----
  const outer = G.bay.slice();                                   // L0 .. R0, interior on the right
  const rev = outer.slice().reverse();                           // R0 .. L0, interior on the left
  const inner = offsetPolyline(rev, r.soffitDepth);
  const soffitShape = shapeFrom([...rev, ...inner.slice().reverse()]);
  const sh = H - r.soffitBottom;
  if (sh > 0.5) {
    const sGeo = new THREE.ExtrudeGeometry(soffitShape, { depth: sh, bevelEnabled: false });
    sGeo.rotateX(-Math.PI / 2); sGeo.translate(0, r.soffitBottom, 0);
    const soffit = new THREE.Mesh(sGeo, M.bulkhead); soffit.name = 'bay bulkhead';
    roomGroup.add(soffit); FX.bulkheads.push(soffit);
    FX.soffitInner = inner;                                       // R0' .. L0' (for LED cove + pots)
  } else FX.soffitInner = rev;

  // ---- fireplace-side bulkhead over the steel beam ----
  const bh = H - r.beamBottom;
  if (bh > 0.5 && r.beamDepth > 1) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(r.beamDepth, bh, G.westY), M.bulkhead);
    b.position.copy(P(r.beamDepth / 2, G.westY / 2, r.beamBottom + bh / 2)); b.name = 'beam bulkhead';
    roomGroup.add(b); FX.bulkheads.push(b);
    // it carries on over the landing and the hallway, out to the same line
    if (r.beamDepth > r.boxX + 1) {
      const w = r.beamDepth - r.boxX, d = -G.hallY;
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(w, bh, d), M.bulkhead);
      b2.position.copy(P(r.boxX + w / 2, G.hallY / 2, r.beamBottom + bh / 2)); b2.name = 'beam bulkhead (landing)';
      roomGroup.add(b2); FX.bulkheads.push(b2);
    }
  }
  // the hallway: a door on its far wall (a third of the way from its east end, as on site)
  // and the closet door on its east wall, its 26″ opening starting closetDoor from the far wall
  const hallLen = G.hallEnd - r.boxX, farDoorX = Math.max(r.boxX + 20, G.hallEnd - hallLen * 0.34);
  if (hallLen >= 40) roomGroup.add(makeDoor(farDoorX, G.hallY));
  if (r.hallDepth >= 34) {
    const cy = clamp(G.hallY + (r.closetDoor ?? 28) + 13, G.hallY + 16, -r.stairWidth - 16);
    roomGroup.add(makeDoor(G.hallEnd, cy, -Math.PI / 2, 26));
  }
  if (state.finish.baseboards !== false) {
    const cy = clamp(G.hallY + (r.closetDoor ?? 28) + 13, G.hallY + 16, -r.stairWidth - 16);
    buildBaseboards(G, r, { far: hallLen >= 40 ? [farDoorX - 17.6, farDoorX + 17.6] : null, closet: r.hallDepth >= 34 ? [cy - 15.6, cy + 15.6] : null });
  }
  // ---- pilaster under the beam bearing (the rectangular protrusion) ----
  const pil = new THREE.Mesh(new THREE.BoxGeometry(r.pilasterW, r.beamBottom, r.pilasterD), M.wall);
  pil.position.copy(P(r.beamX, G.westY - r.pilasterD / 2, r.beamBottom / 2)); pil.name = 'pilaster';
  roomGroup.add(pil);
  const pilCap = new THREE.Mesh(new THREE.PlaneGeometry(r.pilasterW, r.pilasterD), CAP_MAT);
  pilCap.rotation.x = -Math.PI / 2; pilCap.position.copy(P(r.beamX, G.westY - r.pilasterD / 2, H + 0.25));
  roomGroup.add(pilCap);
}

/** Jamb/head/sill faces lining an opening in the fireplace wall (thickness WALL_T, toward -X). */
function addReveal(h, mat) {
  const T = WALL_T, w = h.u1 - h.u0, ht = h.v1 - h.v0, uc = (h.u0 + h.u1) / 2, vc = (h.v0 + h.v1) / 2;
  const head = new THREE.Mesh(new THREE.PlaneGeometry(T, w), mat);
  head.rotation.x = Math.PI / 2; head.position.copy(P(-T / 2, uc, h.v1));          // faces down
  const sill = new THREE.Mesh(new THREE.PlaneGeometry(T, w), mat);
  sill.rotation.x = -Math.PI / 2; sill.position.copy(P(-T / 2, uc, h.v0));         // faces up
  const south = new THREE.Mesh(new THREE.PlaneGeometry(T, ht), mat);
  south.rotation.y = Math.PI; south.position.copy(P(-T / 2, h.u0, vc));            // faces north
  const north = new THREE.Mesh(new THREE.PlaneGeometry(T, ht), mat);
  north.position.copy(P(-T / 2, h.u1, vc));                                        // faces south
  roomGroup.add(head, sill, south, north);
}

// ---------------- baseboards ----------------
// Metrie 8095D colonial baseboard, 23/32″ × 4-3/4″: a flat lower face, a small step, a cove and a rounded bead at the top.
// Profile in (out from the wall, height) inches, traced from the label drawing.
const BASE_T = 23 / 32, BASE_H = 4.75;
const BASE_PROFILE = [[0, 0], [BASE_T, 0], [BASE_T, 2.95], [0.62, 3.0], [0.6, 3.08], [0.52, 3.2], [0.46, 3.35], [0.43, 3.5], [0.42, 3.6],
  [0.47, 3.72], [0.52, 3.88], [0.53, 4.02], [0.5, 4.16], [0.43, 4.28], [0.36, 4.36], [0.34, 4.4], [0.3, 4.5], [0.24, 4.62], [0.16, 4.7], [0.08, 4.74], [0, BASE_H]];
const baseShape = () => cached('base-profile-geo', () => new THREE.Shape(BASE_PROFILE.map(([x, y]) => new THREE.Vector2(x, y))));
/** One straight run of baseboard along the wall from plan point a to b (the room on the left of a→b), extended at either end. */
function baseRun(a, b, ext0 = 0, ext1 = 0) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy); if (len < 0.5) return;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const geo = new THREE.ExtrudeGeometry(baseShape(), { depth: len + ext0 + ext1, bevelEnabled: false, curveSegments: 1 });
  const m = new THREE.Mesh(geo, M.trim);
  // local X = out of the wall (into the room), Y = up, Z = along the wall
  const X = new THREE.Vector3(nx, 0, -ny), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(ux, 0, -uy);
  m.matrixAutoUpdate = false;
  m.matrix.makeBasis(X, Y, Z).setPosition(P(a[0] - ux * ext0, a[1] - uy * ext0, 0));
  m.name = 'baseboard'; roomGroup.add(m);
}
/** Run a wall's baseboard, leaving gaps (along-the-wall distances from a) for door casings. */
function baseWall(a, b, gaps = [], ext0 = 0, ext1 = 0) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len, at = (t) => [a[0] + ux * t, a[1] + uy * t];
  let t0 = 0;
  for (const [g0, g1] of gaps.slice().sort((p, q) => p[0] - q[0])) {
    if (g1 <= 0 || g0 >= len) continue;
    if (g0 > t0) baseRun(at(t0), at(g0), t0 === 0 ? ext0 : 0, 0);
    t0 = Math.max(t0, g1);
  }
  if (t0 < len) baseRun(at(t0), b, t0 === 0 ? ext0 : 0, ext1);
}
function buildBaseboards(G, r, doors) {
  const o = G.outline, n = o.length, same = (p, q) => Math.abs(p[0] - q[0]) < 0.01 && Math.abs(p[1] - q[1]) < 0.01;
  const turn = (i) => {                                    // at vertex i: > 0 an inside corner of the room, < 0 an outside corner
    const p = o[(i - 1 + n) % n], c = o[i], q = o[(i + 1) % n];
    return (c[0] - p[0]) * (q[1] - c[1]) - (c[1] - p[1]) * (q[0] - c[0]);
  };
  const oe = G.openEdge, sw = r.stairWidth, bayBack = [G.bay[3], G.bay[2]];
  for (let i = 0; i < n; i++) {
    let a = o[i], b = o[(i + 1) % n];
    if (oe && same(a, oe[0]) && same(b, oe[1])) continue;                                   // the passage carries on
    if (a[0] === 0 && b[0] === 0 && state.finish.fireplaceSlats) continue;                // slat wall to the floor
    if (same(a, bayBack[0]) && same(b, bayBack[1]) && state.finish.tvSlats) continue;
    const inStrip = (p) => p[1] <= 0.01 && p[1] >= -sw - 0.01 && p[0] >= r.stairStart - 0.01;
    if (inStrip(a) && inStrip(b)) continue;                                                 // under / behind the stairs
    if (a[0] === r.width && b[0] === r.width && a[1] < 0) a = [r.width, 0];                // exterior wall: only from the wall facing the TV
    const ext0 = turn(i) < 0 ? BASE_T : 0, ext1 = turn((i + 1) % n) < 0 ? BASE_T : 0;      // outside corners: run past to meet
    let gaps = [];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (doors.far && a[1] === G.hallY && b[1] === G.hallY) gaps = [[doors.far[0] - a[0], doors.far[1] - a[0]]];
    if (doors.closet && a[0] === G.hallEnd && b[0] === G.hallEnd && b[1] > a[1]) gaps = [[doors.closet[0] - a[1], doors.closet[1] - a[1]]];
    if (len > 0.5) baseWall(a, b, gaps, ext0, ext1);
  }
  // the wall facing the TV and the panel under the stairs (room side)
  if (G.wallX < r.width - 0.5 || G.kneeX < G.wallX) baseWall([G.kneeX, 0], [r.width, 0]);
  // the hallway side of the stairs, under the railing
  const openTo = Math.min(G.hallEnd, r.width);
  if (openTo > r.stairStart + 4) baseWall([openTo, -sw], [r.stairStart + 2, -sw]);
  // round the steel-beam bump
  if (r.pilasterD > 0.5) {
    const x0 = r.beamX - r.pilasterW / 2, x1 = r.beamX + r.pilasterW / 2, yf = G.westY - r.pilasterD, yb = G.westY;
    baseWall([x1, yf], [x0, yf], [], BASE_T, BASE_T);
    baseWall([x1, yb], [x1, yf], [], 0, 0);
    baseWall([x0, yf], [x0, yb], [], 0, 0);
  }
}

/** White two-panel door with casing on a wall facing north (into the hallway). */
function makeDoor(x, y, turn = Math.PI, w = 30) {
  const g = new THREE.Group(), h = 80;
  const white = cached('door-white', () => new THREE.MeshStandardMaterial({ color: '#f1eee8', roughness: 0.55 }));
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.4), white); slab.position.set(0, h / 2, 0.7); g.add(slab);
  for (const py of [h * 0.72, h * 0.3]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w - 9, h * 0.36, 0.3), white); panel.position.set(0, py, 1.5); g.add(panel);
  }
  for (const [sx, sy, px, py] of [[2.6, h + 2.6, -w / 2 - 1.3, (h + 2.6) / 2], [2.6, h + 2.6, w / 2 + 1.3, (h + 2.6) / 2], [w + 5.2, 2.6, 0, h + 1.3]]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.8), white); c.position.set(px, py, 0.4); g.add(c);
  }
  const knob = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), M.metal); knob.position.set(w / 2 - 3, 36, 2.2); g.add(knob);
  g.rotation.y = turn;                          // π: on a south wall, facing north · -π/2: on an east wall, facing west
  g.position.copy(turn === Math.PI ? P(x, y + 0.05, 0) : P(x - 0.05, y, 0));
  return g;
}
