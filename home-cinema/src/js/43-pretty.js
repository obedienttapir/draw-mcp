// ===================================================================
// 43 · Pretty modular sectional (Must Société, SKU 906121).
// From the product page: 127″ W × 93″ D × 26″ H, seat height 14″,
// seat depth 20″. Modelled from the listing photo as a low corner L:
//   long run  = corner seat + middle seat + long end module
//   short run = (shared corner) + end module
// Each end module's back stops short, so the seat runs on into an open,
// fully rounded end. Modules are 30″ deep with a 10″ back, which leaves the
// 20″ seat; the 127″ run = 30 corner + 30 middle + 67 end, the 93″ run = 30 + 63.
// Lumbar pillows sit against the backs. Built around its footprint centre,
// +Z = the side people face; the short run is on your left as you face it
// (side 'right' mirrors it).
// ===================================================================
const PRETTY = { depth: 30, back: 10, seatH: 14, H: 26, plinth: 1.8, mid: 30, longEnd: 67, shortEnd: 63, open: 28 };
function prettySize(p) {
  const T = PRETTY, mids = clamp(Math.round(p.mids ?? 1), 0, 3);
  return { mids, W: T.depth + mids * T.mid + T.longEnd, D: T.depth + T.shortEnd };
}
/** Plan outline (x, z) of a box with its own corner radii [back-left, back-right, front-right, front-left], as a Shape in (x, -z). */
function planShape(x0, x1, z0, z1, radii) {
  const pts = [];
  const arc = (cx, cz, r, a0) => { for (let k = 0; k <= 10; k++) { const a = (a0 + k * 9) * DEG; pts.push(new THREE.Vector2(cx + Math.cos(a) * r, -(cz + Math.sin(a) * r))); } };
  const lim = Math.min(x1 - x0, z1 - z0) / 2 - 0.05;          // two curves on one side must not overlap (a full half-round end)
  const [bl, br, fr, fl] = radii.map((r) => clamp(r, 0.05, lim));
  arc(x0 + bl, z0 + bl, bl, 180); arc(x1 - br, z0 + br, br, 270); arc(x1 - fr, z1 - fr, fr, 0); arc(x0 + fl, z1 - fl, fl, 90);
  return new THREE.Shape(pts);
}
/** A soft upholstered block: a plan outline extruded from y0 to y1 with a rounded (bevelled) edge all round. */
function softBlock(g, mat, x0, x1, z0, z1, y0, y1, radii, b = 1.6) {
  const geo = new THREE.ExtrudeGeometry(planShape(x0 + b, x1 - b, z0 + b, z1 - b, radii.map((r) => Math.max(0.3, r - b))),
    { depth: Math.max(0.1, y1 - y0 - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 20 });
  const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y0 + b; g.add(m); return m;
}
function makePretty(p, item, s) {
  const T = PRETTY, g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const { mids, W, D } = prettySize(p), fab = coverMat(s.cover, s.color);
  const xL = -W / 2, zB = -D / 2, d = T.depth, bt = T.back, gap = 0.25, R = d / 2;
  // seams only between modules: the outside edges sit exactly on the listed 127″ × 93″
  const gx = (v) => (Math.abs(v - xL) < 0.01 || Math.abs(v - W / 2) < 0.01 ? 0 : gap), gz = (v) => (Math.abs(v - zB) < 0.01 || Math.abs(v - D / 2) < 0.01 ? 0 : gap);
  const seat = (x0, x1, z0, z1, radii) => {
    softBlock(inner, fab, x0 + gx(x0), x1 - gx(x1), z0 + gz(z0), z1 - gz(z1), T.plinth, T.seatH, radii, 2.2);
    softBlock(inner, M.black, x0 + 3, x1 - 3, z0 + 3, z1 - 3, 0, T.plinth + 0.2, radii.map((r) => Math.max(0.5, r - 3)), 0.3);   // recessed plinth, same outline
  };
  const back = (x0, x1, z0, z1) => softBlock(inner, fab, x0 + gx(x0), x1 - gap, z0 + gz(z0), z1 - gap, T.seatH - 2.5, T.H, [3.5, 3.5, 3.5, 3.5], 3.2);
  // ---- long run, along the back ----
  let x = xL;
  seat(x, x + d, zB, zB + d, [5, 2, 2, 2]);                                       // corner
  back(x, x + d, zB, zB + bt); back(x, x + bt, zB + bt, zB + d);
  x += d;
  for (let i = 0; i < mids; i++) { seat(x, x + T.mid, zB, zB + d, [2, 2, 2, 2]); back(x, x + T.mid, zB, zB + bt); x += T.mid; }
  seat(x, W / 2, zB, zB + d, [2, R, R, 2]);                                         // long end: rounded open end
  back(x, W / 2 - T.open, zB, zB + bt);
  const midBackX = x - T.mid / 2, endBackX = (x + W / 2 - T.open) / 2;
  // ---- short run, coming forward on the left ----
  seat(xL, xL + d, zB + d, D / 2, [2, 2, R, R]);
  back(xL, xL + bt, zB + d, D / 2 - T.open);
  // ---- lumbar pillows ----
  if (p.pillows !== 'off') {
    const pm = coverMat(s.cover, css(shade(s.color, -0.08)));
    const pillow = (px, pz, ry) => { const m = meshAt(rbox(19, 8, 5, 2.4), pm, px, T.seatH + 5, pz, inner); m.rotation.y = ry; m.rotateX(-0.22); };
    pillow(xL + bt + 8, zB + bt + 8, Math.PI / 4);                                 // across the corner
    if (mids) pillow(midBackX, zB + bt + 2.6, 0);
    pillow(endBackX, zB + bt + 2.6, 0);
    pillow(xL + bt + 2.6, (zB + d + D / 2 - T.open) / 2, Math.PI / 2);
  }
  const sx = p.side === 'right' ? -1 : 1;
  if (sx < 0) inner.scale.x = -1;
  return { group: g, w: W, d: D, shadows: [[0, zB + d / 2, W, d], [sx * (xL + d / 2), (zB + d + D / 2) / 2, d, D - d]] };
}

CATALOG.prettySectional = {
  label: 'Pretty sectional · Must', note: 'Must Société: curved modular L, 127″ × 93″ × 26″',
  defaults: { mids: 1, side: 'left', pillows: 'on' },
  params: [['mids', 'Middle modules', 0, 3, 'n']],
  options: [
    ['side', 'Short end', [['left', 'On the left (as pictured)'], ['right', 'On the right']]],
    ['pillows', 'Lumbar pillows', [['on', 'On'], ['off', 'Off']]],
  ],
};
FACTORIES.prettySectional = makePretty;
// the four colours on the product page
const MUST_FABRICS = [
  { label: 'Light grey', cover: 'boucle', color: '#d6d2c8' },
  { label: 'Taupe', cover: 'boucle', color: '#9a8a7c' },
  { label: 'Light blue', cover: 'boucle', color: '#a9bfd3' },
  { label: 'Green', cover: 'boucle', color: '#626b58' },
];
