// ===================================================================
// 46 · Wall décor in the style study: variants with indicative prices,
//      default finishes (the curated sets don't restyle décor), sizes.
// ===================================================================
Object.assign(VARIANTS, {
  frame: {
    wood:   { label: 'Wood frame', desc: 'Solid wood moulding, white mat, glazed', price: [90, 260], weeks: [1, 3] },
    metal:  { label: 'Thin metal frame', desc: 'Slim metal frame, white mat, glazed', price: [70, 200], weeks: [1, 3] },
    float:  { label: 'Floating frame', desc: 'Canvas floating in a wood tray frame', price: [150, 420], weeks: [2, 4] },
    canvas: { label: 'Gallery canvas', desc: 'Gallery-wrapped canvas, no frame', price: [80, 300], weeks: [1, 3] },
  },
  gallery: {
    wood:  { label: 'Wood frames', desc: 'Matching wood frames with white mats', price: [300, 900], weeks: [1, 3] },
    metal: { label: 'Black metal frames', desc: 'Slim black frames with white mats', price: [250, 750], weeks: [1, 3] },
  },
  mirror: {
    round: { label: 'Round', desc: 'Round mirror, slim metal ring', price: [180, 520], weeks: [1, 4] },
    arch:  { label: 'Arch', desc: 'Arched mirror, metal frame', price: [260, 700], weeks: [2, 5] },
    rect:  { label: 'Rectangle', desc: 'Soft-cornered rectangular mirror, metal frame', price: [220, 600], weeks: [1, 4] },
  },
  shelf: {
    floating: { label: 'Floating shelf', desc: 'Solid wood floating shelf, hidden bracket, styled with books and a vase', price: [120, 340], weeks: [1, 4] },
    ledge:    { label: 'Picture ledge', desc: 'Picture ledge with a lip, three leaning frames', price: [150, 380], weeks: [1, 4] },
  },
  sconce: {
    globe: { label: 'Opal globe', desc: 'Opal glass globe on a short arm, hard-wired, dimmable', price: [180, 480], weeks: [2, 6] },
    arm:   { label: 'Swing-arm', desc: 'Swing-arm reading sconce with a linen shade, plug-in', price: [150, 420], weeks: [1, 4] },
    cone:  { label: 'Up/down cylinder', desc: 'Up/down cylinder washing the wall, dimmable', price: [120, 360], weeks: [1, 4] },
  },
  acousticPanel: {
    fabric: { label: 'Fabric panel', desc: '2″ fabric-wrapped mineral-wool panel, NRC ≈ 0.9', price: [110, 260], weeks: [2, 4] },
    slat:   { label: 'Wood-slat panel', desc: 'Wood slats on black acoustic felt, NRC ≈ 0.7', price: [140, 320], weeks: [1, 4] },
  },
});
Object.assign(PIECE_FALLBACK, {
  frame: { variant: 'wood', wood: 'walnut' }, gallery: { variant: 'metal', metal: 'black' },
  mirror: { variant: 'round', metal: 'brass' }, shelf: { variant: 'floating', wood: 'walnut' },
  sconce: { variant: 'globe', metal: 'brass' }, acousticPanel: { variant: 'fabric', cover: 'weave', color: '#3a3836', wood: 'walnut' },
});
UPHOLSTERED.acousticPanel = 1;

// ---- Aether TV stand (Povison) ----
VARIANTS.aetherStand = {
  walnut: { label: 'Walnut & Black', desc: 'Walnut body, black sintered-stone top, integrated LED under the top; four fronts (two drawers, two flap doors)', price: [1934, 2149], weeks: [1, 2], sheen: 0.1 },
  cream:  { label: 'Cream', desc: 'Cream body and top, integrated LED under the top; four fronts (two drawers, two flap doors)', price: [1599, 1999], weeks: [1, 2], sheen: 0.05 },
};
PIECE_FALLBACK.aetherStand = { variant: 'walnut' };

// ---- Pretty sectional (Must Société) ----
VARIANTS.prettySectional = {
  pretty: { label: 'Pretty, as sold', desc: 'Must Société Pretty modular sectional: low curved L with open rounded ends, tight seats, lumbar pillows', H: 26, comfort: 3, hangout: 5, price: [3037, 3796], weeks: [2, 6] },
};
PIECE_FALLBACK.prettySectional = { variant: 'pretty', cover: 'boucle', color: '#626b58' };
UPHOLSTERED.prettySectional = 1;
COVER_COLORS.boucle.push(...MUST_FABRICS.map((f) => [f.color, f.label]));
/** Brand fabric lists shown first under Fabric for real products. */
const PRODUCT_FABRICS = { uSectional: ['Wayfair fabric options', WAYFAIR_FABRICS], prettySectional: ['Must Société colours', MUST_FABRICS] };
