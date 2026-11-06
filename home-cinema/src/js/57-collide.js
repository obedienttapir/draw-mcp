// ===================================================================
// 57 · Walls: furniture stays on the floor. A piece's footprint (its
//      w × d box, turned with it) must sit inside the floor outline and
//      clear the stairs and the steel-beam bump. Moves slide along a
//      wall instead of passing through it.
// ===================================================================
const WALL_SKIN = 0.5;                                  // footprints may touch a wall, not cross it

/** Plan-space corners of a piece's footprint at (x, y, rot), from its built size. */
function footprint(it, x = it.x, y = it.y, rot = it.rot) {
  const obj = itemObjects.get(it.id); if (!obj) return null;
  const hw = Math.max(0.5, obj.w / 2 - WALL_SKIN), hd = Math.max(0.5, obj.d / 2 - WALL_SKIN);
  const th = Math.PI + rot * DEG, c = Math.cos(th), s = Math.sin(th);
  // local (lx, lz) -> world X = lx c + lz s, Z = -lx s + lz c -> plan (x + X, y - Z)
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => [x + lx * c + lz * s, y + lx * s - lz * c]);
}
function pointInPoly([px, py], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segsCross(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
/** Separating-axis test for two convex polygons. */
function convexOverlap(A, B) {
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length], nx = y0 - y1, ny = x1 - x0;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, y] of A) { const v = x * nx + y * ny; a0 = Math.min(a0, v); a1 = Math.max(a1, v); }
    for (const [x, y] of B) { const v = x * nx + y * ny; b0 = Math.min(b0, v); b1 = Math.max(b1, v); }
    if (a1 <= b0 || b1 <= a0) return false;
  }
  return true;
}
const rectPoly = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/** Solid things standing on the floor inside the outline. */
function floorObstacles() {
  const r = state.room, G = geom();
  return [
    rectPoly(r.stairStart, -r.stairWidth, r.width, 0),                                         // the stair run
    rectPoly(r.beamX - r.pilasterW / 2, G.westY - r.pilasterD, r.beamX + r.pilasterW / 2, G.westY),   // steel-beam bump
  ];
}
/** True when the piece at (x, y, rot) is fully on the floor and clear of walls, stairs and the bump. */
function fitsRoom(it, x = it.x, y = it.y, rot = it.rot) {
  const fp = footprint(it, x, y, rot); if (!fp) return true;
  const poly = geom().outline;
  if (!fp.every((p) => pointInPoly(p, poly))) return false;
  for (let i = 0; i < 4; i++) for (let j = 0; j < poly.length; j++) {
    if (segsCross(fp[i], fp[(i + 1) % 4], poly[j], poly[(j + 1) % poly.length])) return false;
  }
  if (poly.some((p) => pointInPoly(p, fp))) return false;    // a wall corner poking into the footprint
  return !floorObstacles().some((o) => convexOverlap(fp, o));
}
/** Furthest point from (x0, y0) toward (x1, y1) where the piece still fits. */
function furthestFit(it, x0, y0, x1, y1) {
  if (fitsRoom(it, x1, y1)) return [x1, y1];
  let lo = 0, hi = 1;
  for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; if (fitsRoom(it, lerp(x0, x1, m), lerp(y0, y1, m))) lo = m; else hi = m; }
  return [lerp(x0, x1, lo), lerp(y0, y1, lo)];
}
/** How much of the footprint is off the free floor: share of a 9 × 9 grid of sample points (0 = none). */
function overlapAmount(it, x = it.x, y = it.y, rot = it.rot) {
  const fp = footprint(it, x, y, rot); if (!fp) return 0;
  const poly = geom().outline, obs = floorObstacles(), N = 8;
  const inRect = (pt, o) => pt[0] > o[0][0] && pt[0] < o[2][0] && pt[1] > o[0][1] && pt[1] < o[2][1];
  let bad = 0;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const u = i / N, v = j / N;
    const pt = [lerp(lerp(fp[0][0], fp[1][0], u), lerp(fp[3][0], fp[2][0], u), v), lerp(lerp(fp[0][1], fp[1][1], u), lerp(fp[3][1], fp[2][1], u), v)];
    if (!pointInPoly(pt, poly) || obs.some((o) => inRect(pt, o))) bad++;
  }
  return bad / ((N + 1) * (N + 1));
}
/**
 * Where a move toward (tx, ty) actually ends: straight there if it fits, otherwise up to the wall
 * and then sliding along it. A piece that already overlaps a wall (an old layout, or one made
 * bigger in place) may only move in ways that don't push it further in, so it can be dragged free
 * but never through.
 */
function resolveMove(it, tx, ty) {
  if (fitsRoom(it, tx, ty)) return [tx, ty];
  if (!fitsRoom(it)) {
    const now = overlapAmount(it), ok = (x, y) => overlapAmount(it, x, y) <= now;
    if (ok(tx, ty)) return [tx, ty];
    if (ok(tx, it.y)) return [tx, it.y];
    if (ok(it.x, ty)) return [it.x, ty];
    return [it.x, it.y];
  }
  let [x, y] = furthestFit(it, it.x, it.y, tx, ty);
  [x, y] = furthestFit(it, x, y, tx, y);
  [x, y] = furthestFit(it, x, y, x, ty);
  const sx = Math.round(x * 2) / 2, sy = Math.round(y * 2) / 2;   // keep the ½″ snap when it still fits
  return fitsRoom(it, sx, sy) ? [sx, sy] : [x, y];
}
/** Nearest spot to (x, y) where the piece fits (spiral search), or null. */
function nearestFit(it, x, y, rot = it.rot) {
  if (fitsRoom(it, x, y, rot)) return [x, y];
  for (let rad = 3; rad <= 160; rad += 3) {
    const steps = Math.max(8, Math.round(rad / 2));
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2, px = Math.round((x + Math.cos(a) * rad) * 2) / 2, py = Math.round((y + Math.sin(a) * rad) * 2) / 2;
      if (fitsRoom(it, px, py, rot)) return [px, py];
    }
  }
  return null;
}
