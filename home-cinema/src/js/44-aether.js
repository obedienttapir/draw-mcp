// ===================================================================
// 44 · Aether TV stand (Povison): a low floor-standing media console with
//      an integrated LED band under its top, in two colourways:
//        walnut  · walnut body, black sintered-stone top
//        cream   · cream body and top
//      From the product page: 78.74″ W × 15.75″ D × 15.95″ H. Modelled from the
//      photos: recessed base, body with rounded front corners and four fronts,
//      a set-back reveal under the top with the LED strip, and a slightly
//      proud top slab. The LED follows the room's LED-channel dimmer (and
//      blooms in high quality). Like every TV stand here it carries the soundbar.
// ===================================================================
const AETHER = { w: 78.74, d: 15.75, h: 15.95, base: 1.0, top: 1.2, reveal: 1.5, inset: 1.1, endR: 5 };
/** Height of the surface a soundbar stands on, for each TV stand type (inches). */
const STAND_TOP = { console: CONSOLE_Y0 + CONSOLE_H, aetherStand: AETHER.h };
/** UVs of extruded shapes are in inches: scale them so a texture spans ~`per` inches, optionally turned 90°. */
function uvInches(geo, per = 40, turn = false) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i) / per, v = uv.getY(i) / per;
    if (turn) uv.setXY(i, v, u); else uv.setXY(i, u, v);
  }
  uv.needsUpdate = true; return geo;
}
/** A plan outline (planShape from 43-pretty) extruded from y0 to y1 with a small rounded edge. */
function slab(g, mat, x0, x1, z0, z1, y0, y1, radii, b = 0.35, turn = true) {
  const geo = new THREE.ExtrudeGeometry(planShape(x0 + b, x1 - b, z0 + b, z1 - b, radii.map((r) => Math.max(0.2, r - b))),
    { depth: Math.max(0.05, y1 - y0 - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 24 });
  uvInches(geo, 40, turn);
  const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y0 + b; g.add(m); return m;
}
const AETHER_FINISH = {
  walnut: { body: () => woodMat('#6a4c34'), top: () => cached('aether-stone-black', () => new THREE.MeshStandardMaterial({ color: '#1e1d1c', roughness: 0.42, metalness: 0.05 })) },
  cream:  { body: () => cached('aether-cream', () => new THREE.MeshStandardMaterial({ color: '#e4dccf', roughness: 0.62 })),
            top: () => cached('aether-cream-top', () => new THREE.MeshStandardMaterial({ color: '#ebe4d9', roughness: 0.4 })) },
};
function makeAether(p, item, s) {
  const A = AETHER, g = new THREE.Group(), f = AETHER_FINISH[s.variant] || AETHER_FINISH.walnut;
  const body = f.body(), top = f.top(), w = A.w, d = A.d, R = A.endR;
  const x0 = -w / 2, x1 = w / 2, zb = -d / 2, zf = d / 2;
  const yb = A.base, yr = A.h - A.top - A.reveal, yt = A.h - A.top;       // body from yb to yr, reveal yr..yt, top yt..h
  // recessed base (a shadow gap at the floor)
  slab(g, M.black, x0 + 2, x1 - 2, zb + 1.5, zf - 1.5, 0, yb + 0.2, [1, 1, R - 2, R - 2], 0.2);
  // body: rounded front corners, square-ish at the wall
  slab(g, body, x0 + 0.3, x1 - 0.3, zb, zf - 0.5, yb, yr, [1.2, 1.2, R, R], 0.4);
  // four fronts: thin seams across the flat part of the front
  const seam = cached('aether-seam', () => new THREE.MeshStandardMaterial({ color: '#141210', roughness: 0.9 }));
  for (let i = 1; i < 4; i++) span(g, seam, x0 + (w * i) / 4 - 0.09, x0 + (w * i) / 4 + 0.09, yb + 0.6, yr - 0.6, zf - 0.56, zf - 0.42, 0.02);
  // reveal under the top: the set-back core glows with the room's LED channel (as in the product photos),
  // brightest in the strip just under the top's front and side edges
  slab(g, M.bandGlow, x0 + A.inset, x1 - A.inset, zb + 0.5, zf - A.inset - 0.5, yr - 0.1, yt + 0.1, [0.8, 0.8, R - A.inset, R - A.inset], 0.1);
  const led = slab(g, M.led, x0 + A.inset + 0.2, x1 - A.inset - 0.2, zb + 0.6, zf - A.inset - 0.3, yt - 0.55, yt - 0.05, [0.6, 0.6, R - A.inset - 0.2, R - A.inset - 0.2], 0.05);
  led.name = 'led strip';
  // top slab, a little proud of the body all round
  slab(g, top, x0, x1, zb, zf, yt, A.h, [1.2, 1.2, R + 0.3, R + 0.3], 0.3);
  // the soundbar on top, as on every TV stand in the planner
  span(g, M.black, -20, 20, A.h, A.h + SOUNDBAR_H, -2, 2, 1.2);
  return { group: g, w, d, hv: A.h, top: A.h, shadows: [[0, 0, w, d]] };
}

CATALOG.aetherStand = {
  label: 'TV stand · Aether', note: 'Povison: 78.74″ with integrated LED, walnut or cream',
  defaults: {}, params: [],
};
FACTORIES.aetherStand = makeAether;
// the two colourways on the product page, as one-tap presets
const AETHER_COLOURS = [
  { label: 'Walnut & Black', variant: 'walnut', color: '#6a4c34' },
  { label: 'Cream', variant: 'cream', color: '#e4dccf' },
];
