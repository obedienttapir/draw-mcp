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
    const inBay = G.bay.some((b) => b[0] === p[0] && b[1] === p[1]) && G.bay.some((b) => b[0] === q[0] && b[1] === q[1]);
    const mat = inBay && state.finish.bayAccent !== 'paint-wall' ? M.accent : M.wall;
    const segs = [[p, q]];
    // walls bordering the stairwell rise into it
    if (p[1] === -r.stairWidth && q[1] === -r.stairWidth) segs.splice(0, 1, [p, [stairOpenX, p[1]]], [[stairOpenX, p[1]], q]);
    if (p[0] === r.width && q[0] === r.width) segs.splice(0, 1, [p, [r.width, 0]], [[r.width, 0], q]);
    for (const [a, b] of segs) {
      const quad = wallQuad(a, b, 0, H, mat);
      if (inBay) quad.userData.bay = true;
      roomGroup.add(quad);
      if (a[1] <= 0 && b[1] <= 0 && Math.min(a[0], b[0]) >= stairOpenX - 0.01) stairwell.add(wallQuad(a, b, H, H + 110, M.wall));
    }
    roomGroup.add(wallCap(p, q, H + 0.2));
  }

  // ---- fireplace wall with fireplace + two transom openings ----
  const { fp, tr } = fireplaceOpenings();
  const holes = [rect(fp.u0, fp.v0, fp.u1, fp.v1), ...tr.map((t) => rect(t.u0, t.v0, t.u1, t.v1))];
  const fwGeo = new THREE.ShapeGeometry(shapeFrom(rect(0, 0, G.mainY, H), holes));
  const fw = new THREE.Mesh(fwGeo, M.wall);
  // shape u (plan y) -> world -Z, v -> world Y, normal (+Z) -> world +X (into the room)
  fw.rotation.y = Math.PI / 2;
  roomGroup.add(fw);
  roomGroup.add(wallCap([0, G.mainY], [0, 0], H + 0.2));
  // reveals (jambs) through the wall thickness
  for (const h of [fp, ...tr]) addReveal(h, M.wall);

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
    const b = new THREE.Mesh(new THREE.BoxGeometry(r.beamDepth, bh, G.mainY), M.bulkhead);
    b.position.copy(P(r.beamDepth / 2, G.mainY / 2, r.beamBottom + bh / 2)); b.name = 'beam bulkhead';
    roomGroup.add(b); FX.bulkheads.push(b);
  }
  // ---- pilaster under the beam bearing (the rectangular protrusion) ----
  const pil = new THREE.Mesh(new THREE.BoxGeometry(r.pilasterW, r.beamBottom, r.pilasterD), M.wall);
  pil.position.copy(P(r.beamX, G.mainY - r.pilasterD / 2, r.beamBottom / 2)); pil.name = 'pilaster';
  roomGroup.add(pil);
  const pilCap = new THREE.Mesh(new THREE.PlaneGeometry(r.pilasterW, r.pilasterD), CAP_MAT);
  pilCap.rotation.x = -Math.PI / 2; pilCap.position.copy(P(r.beamX, G.mainY - r.pilasterD / 2, H + 0.25));
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
