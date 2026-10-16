// ===================================================================
// 45 · Furniture style study: curated sets, upholstery library, piece
//      variants with indicative prices and lead times, and the scoring
//      model used to compare sets. Geometry lives in 40-furniture.js.
// ===================================================================

// ---------------- upholstery ----------------
// Performance figures are typical for each class of cover (Wyzenbeek double rubs, cleaning code);
// they drive the durability, acoustics and screen-contrast scores below.
const COVERS = {
  weave:   { label: 'Performance weave', kind: 'weave', sheen: 0, durability: 5, care: 5, pets: 5, absorb: 4, factor: 1.0, weeks: 0,
    spec: 'Solution-dyed performance weave, 100,000 double rubs, cleaning code W/S' },
  linen:   { label: 'Performance linen-look', kind: 'linen', sheen: 0, durability: 4, care: 4, pets: 4, absorb: 4, factor: 1.0, weeks: 0,
    spec: 'Linen-look performance blend, 50,000 double rubs, cleaning code W/S' },
  boucle:  { label: 'Wool-blend bouclé', kind: 'boucle', sheen: 0, durability: 3, care: 2, pets: 1, absorb: 5, factor: 1.12, weeks: 2,
    spec: 'Wool-blend bouclé, 30,000 double rubs; loops can snag on claws' },
  tweed:   { label: 'Wool tweed', kind: 'tweed', sheen: 0, durability: 4, care: 3, pets: 3, absorb: 4, factor: 1.08, weeks: 2,
    spec: 'Wool-rich tweed, 40,000 double rubs, cleaning code S' },
  velvet:  { label: 'Performance velvet', kind: 'velvet', sheen: 0.3, durability: 4, care: 3, pets: 2, absorb: 4, factor: 1.12, weeks: 2,
    spec: 'Polyester performance velvet, 60,000 double rubs; shows pet hair' },
  leather: { label: 'Top-grain leather', kind: 'leather', sheen: 0.4, durability: 5, care: 4, pets: 2, absorb: 1, factor: 1.55, weeks: 3,
    spec: 'Semi-aniline top-grain leather; wipes clean, takes a patina, scratches show' },
  natural: { label: 'Washed linen', kind: 'linen', sheen: 0, durability: 2, care: 2, pets: 2, absorb: 4, factor: 1.05, weeks: 1,
    spec: 'Stone-washed linen on a removable slipcover; creases by design' },
  knit:    { label: 'Chunky wool knit', kind: 'knit', sheen: 0, durability: 2, care: 2, pets: 1, absorb: 5, factor: 1.0, weeks: 0,
    spec: 'Hand-knit wool cover over bead fill' },
};
// colours offered per cover in the inspector, with names for the spec sheet
const COVER_COLORS = {
  weave:   [['#3a3836', 'Graphite'], ['#2f2c2a', 'Ink'], ['#4b4f55', 'Slate'], ['#5f5a54', 'Pewter'], ['#8f877c', 'Stone'], ['#2f3a4a', 'Midnight']],
  linen:   [['#8f877c', 'Stone'], ['#cdbfa8', 'Oatmeal'], ['#c9bba5', 'Oat'], ['#5f5a54', 'Graphite'], ['#3f4a3f', 'Moss'], ['#2f2c2a', 'Ink']],
  boucle:  [['#e6dccb', 'Ivory'], ['#d8ccb6', 'Cream'], ['#c9bba5', 'Oat'], ['#8c7d68', 'Mushroom'], ['#7a5f48', 'Toffee']],
  tweed:   [['#9a5636', 'Rust'], ['#c08a2e', 'Mustard'], ['#2f5d5a', 'Teal'], ['#6b6358', 'Heather grey'], ['#8a7a64', 'Wheat']],
  velvet:  [['#2e4a3c', 'Forest'], ['#2a3346', 'Midnight'], ['#b8895a', 'Camel'], ['#6e2f2f', 'Oxblood'], ['#c7a196', 'Blush'], ['#3a3633', 'Charcoal']],
  leather: [['#7a4a2a', 'Cognac'], ['#6b3f22', 'Saddle'], ['#5b4636', 'Chestnut'], ['#3a2a20', 'Chocolate'], ['#1f1c1a', 'Black']],
  natural: [['#b9ab94', 'Flax'], ['#a99a82', 'Sand'], ['#d8ccb6', 'Natural'], ['#8c7d68', 'Mushroom']],
  knit:    [['#d8ccb6', 'Cream'], ['#8c7d68', 'Mushroom'], ['#c9bba5', 'Oat'], ['#3a3633', 'Charcoal']],
};
const WOOD_FINISHES = {
  walnut:    { label: 'Walnut', color: '#3b281b' },
  teak:      { label: 'Teak', color: '#4a3424' },
  oak:       { label: 'White oak', color: '#b48a5c' },
  ebony:     { label: 'Ebonised oak', color: '#1f1813' },
  reclaimed: { label: 'Reclaimed pine', color: '#6e4c30' },
};
const METAL_FINISHES = { brass: 'Satin brass', black: 'Black steel', nickel: 'Brushed nickel' };
const STONE_FINISHES = { marble: 'White marble', travertine: 'Honed travertine', nero: 'Black marble' };
const AV_FINISHES = { black: 'Black ash', walnut: 'Walnut veneer', oak: 'Light oak veneer' };
const RUG_COLORS = [['#6e6559', 'Taupe'], ['#7d7466', 'Sand'], ['#3d3833', 'Charcoal'], ['#2f2d2b', 'Graphite'], ['#8a7a64', 'Wheat'],
  ['#a68d68', 'Natural jute'], ['#d9cdb5', 'Cream'], ['#7b3f2e', 'Faded rust'], ['#3d4656', 'Indigo'], ['#2f5d5a', 'Teal'], ['#6b5a4a', 'Mink']];
const colorName = (hex) => {
  const all = [...Object.values(COVER_COLORS).flat(), ...RUG_COLORS];
  const hit = all.find(([c]) => c.toLowerCase() === String(hex).toLowerCase());
  return hit ? hit[1] : String(hex).toUpperCase();
};

// ---------------- piece variants ----------------
// price: indicative CAD range for the catalogue size (seating per linear inch, rugs per sq ft), before the cover factor.
// weeks: typical made-to-order lead time. comfort / hangout: 1–5. H: overall height (in).
const VARIANTS = {
  sectional: {
    track:    { label: 'Track-arm plinth', desc: 'Track arms, loose back cushions, recessed plinth base', H: 30, comfort: 4, hangout: 3, perIn: [17.5, 28.5], weeks: [8, 12] },
    modular:  { label: 'Low modular', desc: 'Armless low modules, deep seats, reconfigurable', H: 26, comfort: 3, hangout: 5, perIn: [15, 26], weeks: [4, 8] },
    tufted:   { label: 'Tufted mid-century', desc: 'Button-tufted tight back, bench seat, tapered walnut legs', H: 31, comfort: 3, hangout: 3, perIn: [16, 25], weeks: [8, 12] },
    slope:    { label: 'Slope-arm lounge', desc: 'Sloped arms, plump channel-stitched cushions, black steel legs', H: 32, comfort: 4, hangout: 3, perIn: [18, 30], weeks: [10, 14] },
    channel:  { label: 'Channel-tufted', desc: 'Vertical channel-tufted back, pillow arms, plinth with brass kick', H: 31, comfort: 4, hangout: 3, perIn: [19, 32], weeks: [10, 14] },
    recliner: { label: 'Power-reclining theatre', desc: 'Power recline and headrest at each seat, USB-C in the arms', H: 40, comfort: 5, hangout: 2, perIn: [26, 44], weeks: [8, 12] },
  },
  loungeChair: {
    tub:    { label: 'Curved tub chair', desc: 'Curved tub shell, tight seat, loose lumbar pillow', W: 31, D: 32, H: 28, comfort: 3, hangout: 4, price: [900, 1600], weeks: [6, 10] },
    frame:  { label: 'Wood-frame lounge', desc: 'Solid wood frame, loose seat and back cushions', W: 30, D: 33, H: 32, comfort: 4, hangout: 3, price: [1100, 2100], weeks: [6, 10] },
    sling:  { label: 'Sling chair', desc: 'Black steel frame, slung seat and back', W: 28, D: 32, H: 31, comfort: 3, hangout: 4, price: [700, 1300], weeks: [2, 6] },
    swivel: { label: 'Swivel barrel', desc: 'Barrel back on a 360° swivel base: turns from the screen to the fire', W: 30, D: 30, H: 29, comfort: 4, hangout: 5, price: [1000, 1900], weeks: [6, 10] },
    low:    { label: 'Low lounge', desc: 'Low solid-oak frame, deep seat and back cushions', W: 30, D: 30, H: 26, comfort: 4, hangout: 3, price: [950, 1800], weeks: [4, 8] },
  },
  roundTable: {
    pedestal: { label: 'Sculpted pedestal', desc: 'Turned solid-wood pedestal, round top', H: 16, price: [900, 1700], weeks: [4, 8] },
    slab:     { label: 'Low slab', desc: 'Rectangular solid-wood top on panel legs', H: 14, price: [700, 1400], weeks: [4, 8] },
    tulip:    { label: 'Tulip, marble top', desc: 'Marble top on a flared cast pedestal', H: 16, price: [1100, 2200], weeks: [4, 10] },
    drum:     { label: 'Travertine drum', desc: 'Honed travertine drum with a shadow reveal', H: 15, price: [1400, 2800], weeks: [6, 12] },
    frame:    { label: 'Steel and timber', desc: 'Reclaimed-timber top on a black steel frame, lower shelf', H: 17, price: [600, 1200], weeks: [2, 6] },
  },
  ottoman: {
    block:  { label: 'Block ottoman', desc: 'Upholstered block on a recessed base', H: 16, price: [500, 950], weeks: [6, 10] },
    tufted: { label: 'Tufted ottoman', desc: 'Button-tufted top on tapered legs', H: 17, price: [650, 1200], weeks: [6, 10] },
    tray:   { label: 'Tray ottoman', desc: 'Upholstered base with a lift-off wood tray', H: 17, price: [600, 1100], weeks: [4, 8] },
  },
  pouf: {
    round:   { label: 'Round pouf', desc: 'Piped round pouf', H: 16, price: [180, 380], weeks: [2, 4] },
    leather: { label: 'Stitched leather pouf', desc: 'Panel-stitched leather pouf', H: 16, price: [250, 520], weeks: [2, 6] },
    knit:    { label: 'Chunky knit pouf', desc: 'Hand-knit cover over bead fill', H: 15, price: [120, 300], weeks: [1, 3] },
  },
  rug: {
    weave:     { label: 'Tonal weave', desc: 'Hand-loomed wool and viscose, low pile', perSqFt: [9, 16], absorb: 3, weeks: [2, 6] },
    border:    { label: 'Bordered', desc: 'Tufted wool with a contrast border', perSqFt: [10, 18], absorb: 3, weeks: [2, 6] },
    vintage:   { label: 'Vintage medallion', desc: 'Distressed medallion, low pile, washable', perSqFt: [8, 22], absorb: 2, weeks: [1, 4] },
    jute:      { label: 'Jute flatweave', desc: 'Natural jute and wool flatweave', perSqFt: [5, 10], absorb: 2, weeks: [1, 4] },
    geometric: { label: 'Geometric', desc: 'Hand-tufted wool, mid-century geometric', perSqFt: [10, 18], absorb: 3, weeks: [4, 8] },
    shag:      { label: 'Plush shag', desc: 'High-pile wool shag, 1½″ pile', perSqFt: [12, 22], absorb: 5, weeks: [4, 10] },
  },
  console: {
    slatted:  { label: 'Slatted, wall-hung', desc: 'Wall-hung, slatted front, push-latch doors', price: [1400, 2600], weeks: [6, 10], sheen: 0.1 },
    credenza: { label: 'Credenza', desc: 'Sliding doors on tapered legs, brass pulls', price: [1500, 2900], weeks: [6, 10], sheen: 0.1 },
    fluted:   { label: 'Fluted', desc: 'Fluted door fronts with brass pulls', price: [1700, 3200], weeks: [8, 12], sheen: 0.1 },
    lacquer:  { label: 'Matte lacquer', desc: 'Handleless matte-black lacquer, no glare under the screen', price: [1200, 2400], weeks: [6, 10], sheen: 0 },
    frame:    { label: 'Steel frame', desc: 'Timber boxes in a black steel frame on legs', price: [900, 1700], weeks: [2, 6], sheen: 0.05 },
    cane:     { label: 'Cane front', desc: 'Light oak with woven cane doors', price: [1300, 2400], weeks: [6, 10], sheen: 0 },
  },
  sideTable: {
    drum:     { label: 'Drum', desc: 'Solid-wood drum', H: 22, price: [250, 550], weeks: [2, 6] },
    ctable:   { label: 'C-table', desc: 'Black steel C-table that slides over a seat', H: 24, price: [180, 420], weeks: [1, 4] },
    stump:    { label: 'Stump', desc: 'Solid timber stump, oiled', H: 18, price: [300, 700], weeks: [2, 6] },
    pedestal: { label: 'Stone pedestal', desc: 'Stone top on a stone column', H: 22, price: [400, 900], weeks: [4, 8] },
  },
  floorLamp: {
    drum:    { label: 'Linen drum', desc: 'Linen drum shade on a slim pole, warm 2700K bulb', H: 64, price: [250, 600], weeks: [1, 4] },
    arc:     { label: 'Arc lamp', desc: 'Marble base, arching arm, dome shade over a seat', H: 80, price: [400, 1000], weeks: [2, 6] },
    tripod:  { label: 'Tripod', desc: 'Tripod legs with a linen drum', H: 62, price: [250, 650], weeks: [1, 4] },
    lantern: { label: 'Paper lantern', desc: 'Tall paper column, soft all-round glow', H: 58, price: [150, 450], weeks: [1, 4] },
    globe:   { label: 'Opal globe', desc: 'Opal glass globe on a slim stem', H: 62, price: [350, 900], weeks: [2, 6] },
  },
  plant: {
    olive:  { label: 'Olive tree', desc: 'Olive tree in a stone planter', price: [250, 700], weeks: [1, 3] },
    fiddle: { label: 'Fiddle-leaf fig', desc: 'Fiddle-leaf fig in a stone planter', price: [200, 600], weeks: [1, 3] },
    snake:  { label: 'Snake plant', desc: 'Snake plant in a low planter; copes with low light', price: [120, 350], weeks: [1, 3] },
  },
  barCart: {
    classic: { label: 'Metal and wood', desc: 'Metal frame, two wood shelves, casters', H: 33, price: [350, 900], weeks: [1, 4] },
    oak:     { label: 'All timber', desc: 'Solid oak frame and shelves, casters', H: 33, price: [400, 950], weeks: [2, 6] },
  },
  recliner: {
    power: { label: 'Power recliner', desc: 'Power recline with adjustable headrest', H: 41, comfort: 5, hangout: 2, price: [1400, 2600], weeks: [6, 10] },
  },
};
VARIANTS.sofa = VARIANTS.sectional;                        // the straight sofa shares the sectional's styles
const UPHOLSTERED = { sectional: 1, sofa: 1, loungeChair: 1, ottoman: 1, pouf: 1, recliner: 1 };
const AV_TYPES = { towerSpeaker: 1, subwoofer: 1 };

// ---------------- curated sets ----------------
// Each entry styles every piece type. An array means "alternate by instance" (first rug, second rug ...).
const STYLE_SETS = {
  'warm-modern': {
    name: 'Warm Modern', tagline: 'Walnut, soft taupe and ivory bouclé: the current plan.',
    palette: ['#8f877c', '#e6dccb', '#3b281b', '#5b4636', '#6e6559', '#b48a52'],
    fit: 5, fitNote: 'Built around the walnut slat wall and the warm 2700K coves; calm next to the dark alcove.',
    pros: ['Ties straight into the walnut slats and brass', 'Soft, absorbent fabrics help the acoustics', 'Easy to live with for years'],
    cons: ['Ivory bouclé chairs mark and snag', 'Mid-tone taupe sectional bounces some light back at the screen'],
    pieces: {
      sectional: { variant: 'track', cover: 'linen', color: '#8f877c' }, sofa: { variant: 'track', cover: 'linen', color: '#8f877c' },
      loungeChair: { variant: 'tub', cover: 'boucle', color: '#e6dccb' }, roundTable: { variant: 'pedestal', wood: 'walnut' },
      ottoman: { variant: 'block', cover: 'leather', color: '#5b4636' }, pouf: { variant: 'round', cover: 'boucle', color: ['#c9bba5', '#7a5f48'] },
      rug: { variant: ['weave', 'border'], color: ['#6e6559', '#7d7466'] }, console: { variant: 'slatted', wood: 'teak' },
      sideTable: { variant: 'drum', wood: 'walnut' }, floorLamp: { variant: 'drum', metal: 'brass' }, plant: { variant: 'olive' },
      barCart: { variant: 'classic', metal: 'brass', wood: 'walnut' }, recliner: { variant: 'power', cover: 'linen', color: '#2f2c2a' },
      towerSpeaker: { finish: 'black' }, subwoofer: { finish: 'black' }, pillow: { cover: 'boucle', color: '#d8ccb6' },
    },
  },
  'mid-century': {
    name: 'Mid-century Modern', tagline: 'Walnut on tapered legs, rust tweed, mustard and teal.',
    palette: ['#9a5636', '#c08a2e', '#2f5d5a', '#3b281b', '#d9cdb5', '#b48a52'],
    fit: 4, fitNote: 'Walnut and rust pick up the slat wall; raised legs keep the room light under the 7′-10″ bulkhead.',
    pros: ['Timeless and characterful', 'Tweed wears well and hides marks', 'Pieces on legs make the floor read bigger'],
    cons: ['Tight tufted back is firmer for long films', 'Cream geometric rug lightens the floor in front of the screen'],
    pieces: {
      sectional: { variant: 'tufted', cover: 'tweed', color: '#9a5636' }, sofa: { variant: 'tufted', cover: 'tweed', color: '#9a5636' },
      loungeChair: { variant: 'frame', cover: 'tweed', color: '#c08a2e', wood: 'walnut' }, roundTable: { variant: 'tulip', stone: 'marble', metal: 'nickel' },
      ottoman: { variant: 'tufted', cover: 'leather', color: '#7a4a2a', wood: 'walnut' }, pouf: { variant: 'round', cover: 'tweed', color: ['#2f5d5a', '#c08a2e'] },
      rug: { variant: 'geometric', color: ['#d9cdb5', '#2f5d5a'], color2: ['#2f5d5a', '#9a5636'] }, console: { variant: 'credenza', wood: 'walnut', metal: 'brass' },
      sideTable: { variant: 'drum', wood: 'walnut' }, floorLamp: { variant: 'arc', metal: 'brass', stone: 'marble' }, plant: { variant: 'fiddle' },
      barCart: { variant: 'classic', metal: 'brass', wood: 'walnut' }, recliner: { variant: 'power', cover: 'tweed', color: '#9a5636' },
      towerSpeaker: { finish: 'walnut' }, subwoofer: { finish: 'walnut' }, pillow: { cover: 'tweed', color: '#2f5d5a' },
    },
  },
  japandi: {
    name: 'Japandi', tagline: 'Low and calm: oatmeal linen, white oak, jute and paper light.',
    palette: ['#cdbfa8', '#b48a5c', '#a68d68', '#8c7d68', '#efe6d6', '#2b2724'],
    fit: 4, fitNote: 'Light oak and linen lift a basement, but pale pieces fight the dark alcove when the screen is on.',
    pros: ['Modules regroup for game nights', 'Low profile makes the 9′ ceiling feel higher', 'Lowest budget of the six'],
    cons: ['Pale seating bounces light back at the screen', 'Washed linen and knit need gentle care', 'Low seats are harder to get out of'],
    pieces: {
      sectional: { variant: 'modular', cover: 'linen', color: '#cdbfa8' }, sofa: { variant: 'modular', cover: 'linen', color: '#cdbfa8' },
      loungeChair: { variant: 'low', cover: 'natural', color: '#b9ab94', wood: 'oak' }, roundTable: { variant: 'slab', wood: 'oak' },
      ottoman: { variant: 'block', cover: 'natural', color: '#a99a82' }, pouf: { variant: 'knit', cover: 'knit', color: ['#d8ccb6', '#8c7d68'] },
      rug: { variant: 'jute', color: ['#a68d68', '#8a7a64'] }, console: { variant: 'cane', wood: 'oak' },
      sideTable: { variant: 'stump', wood: 'oak' }, floorLamp: { variant: 'lantern' }, plant: { variant: 'snake' },
      barCart: { variant: 'oak', wood: 'oak' }, recliner: { variant: 'power', cover: 'natural', color: '#a99a82' },
      towerSpeaker: { finish: 'oak' }, subwoofer: { finish: 'oak' }, pillow: { cover: 'natural', color: '#8c7d68' },
    },
  },
  industrial: {
    name: 'Industrial Loft', tagline: 'Cognac leather, black steel, reclaimed timber and a vintage rug.',
    palette: ['#7a4a2a', '#1d1c1a', '#6e4c30', '#7b3f2e', '#3d4656', '#c9bfb0'],
    fit: 3, fitNote: 'Leather and steel suit a screening room, but compete with the warm walnut; best with the black band fireplace look.',
    pros: ['Leather wipes clean and ages well', 'Sling chairs and steel tables are light to move', 'Washable vintage rug hides spills'],
    cons: ['Leather reflects sound and some light', 'Highest seating cost per seat', 'Leather sticks to skin in summer'],
    pieces: {
      sectional: { variant: 'slope', cover: 'leather', color: '#7a4a2a' }, sofa: { variant: 'slope', cover: 'leather', color: '#7a4a2a' },
      loungeChair: { variant: 'sling', cover: 'leather', color: '#6b3f22', metal: 'black' }, roundTable: { variant: 'frame', wood: 'reclaimed', metal: 'black' },
      ottoman: { variant: 'tray', cover: 'leather', color: '#3a2a20', wood: 'reclaimed' }, pouf: { variant: 'leather', cover: 'leather', color: ['#7a4a2a', '#3a2a20'] },
      rug: { variant: 'vintage', color: ['#7b3f2e', '#3d4656'], color2: ['#3d4656', '#7b3f2e'] }, console: { variant: 'frame', wood: 'reclaimed', metal: 'black' },
      sideTable: { variant: 'ctable', metal: 'black', wood: 'reclaimed' }, floorLamp: { variant: 'tripod', metal: 'black', wood: 'reclaimed' }, plant: { variant: 'fiddle' },
      barCart: { variant: 'classic', metal: 'black', wood: 'reclaimed' }, recliner: { variant: 'power', cover: 'leather', color: '#7a4a2a' },
      towerSpeaker: { finish: 'black' }, subwoofer: { finish: 'black' }, pillow: { cover: 'tweed', color: '#6b6358' },
    },
  },
  luxe: {
    name: 'Luxe Lounge', tagline: 'Forest velvet, travertine and brass: a members’-club screening room.',
    palette: ['#2e4a3c', '#b8895a', '#d8c7ad', '#b48a52', '#3a3633', '#3b281b'],
    fit: 4, fitNote: 'Deep green against walnut is rich and cinematic; brass echoes the existing fittings.',
    pros: ['Deep, dark velvet keeps the screen punchy', 'Shag rug and velvet soak up echo', 'Swivel chairs turn from the screen to the fire'],
    cons: ['Velvet shows pet hair and pressure marks', 'Travertine needs sealing and coasters', 'Highest budget of the six'],
    pieces: {
      sectional: { variant: 'channel', cover: 'velvet', color: '#2e4a3c' }, sofa: { variant: 'channel', cover: 'velvet', color: '#2e4a3c' },
      loungeChair: { variant: 'swivel', cover: 'velvet', color: '#b8895a', metal: 'brass' }, roundTable: { variant: 'drum', stone: 'travertine' },
      ottoman: { variant: 'tufted', cover: 'velvet', color: '#6e2f2f', wood: 'walnut' }, pouf: { variant: 'round', cover: 'velvet', color: ['#b8895a', '#2e4a3c'] },
      rug: { variant: 'shag', color: ['#3a3633', '#6b5a4a'] }, console: { variant: 'fluted', wood: 'walnut', metal: 'brass' },
      sideTable: { variant: 'pedestal', stone: 'travertine' }, floorLamp: { variant: 'globe', metal: 'brass' }, plant: { variant: 'olive' },
      barCart: { variant: 'classic', metal: 'brass', wood: 'walnut' }, recliner: { variant: 'power', cover: 'velvet', color: '#2e4a3c' },
      towerSpeaker: { finish: 'black' }, subwoofer: { finish: 'black' }, pillow: { cover: 'velvet', color: '#b8895a' },
    },
  },
  theater: {
    name: 'Performance Theatre', tagline: 'Graphite performance fabric, power recline and matte black: built for films.',
    palette: ['#3a3836', '#4b4f55', '#1f1813', '#2f2d2b', '#141210', '#8f877c'],
    fit: 3, fitNote: 'Best seats and best picture, but the reclining sectional is visually heavy for a hangout room.',
    pros: ['Power recline and headrests for long films', 'Dark, matte surfaces keep contrast high', 'Performance fabric shrugs off spills, kids and pets'],
    cons: ['Reclining seats fix where people sit', 'Bulky backs block the view across the room', 'Feels more like a theatre than a lounge'],
    pieces: {
      sectional: { variant: 'recliner', cover: 'weave', color: '#3a3836' }, sofa: { variant: 'recliner', cover: 'weave', color: '#3a3836' },
      loungeChair: { variant: 'swivel', cover: 'weave', color: '#4b4f55', metal: 'black' }, roundTable: { variant: 'slab', wood: 'ebony' },
      ottoman: { variant: 'tray', cover: 'weave', color: '#2f2c2a', wood: 'ebony' }, pouf: { variant: 'round', cover: 'weave', color: ['#4b4f55', '#2f2c2a'] },
      rug: { variant: 'weave', color: ['#2f2d2b', '#3d3833'] }, console: { variant: 'lacquer' },
      sideTable: { variant: 'ctable', metal: 'black', wood: 'ebony' }, floorLamp: { variant: 'drum', metal: 'black' }, plant: { variant: 'snake' },
      barCart: { variant: 'classic', metal: 'black', wood: 'ebony' }, recliner: { variant: 'power', cover: 'weave', color: '#3a3836' },
      towerSpeaker: { finish: 'black' }, subwoofer: { finish: 'black' }, pillow: null,
    },
  },
};
const SET_IDS = Object.keys(STYLE_SETS);

// ---------------- resolving a piece's style ----------------
let previewSetId = null;                                   // set shown temporarily (compare thumbnails), ignoring overrides
const activeSetId = () => previewSetId || (state.style && STYLE_SETS[state.style.set] ? state.style.set : 'warm-modern');
const STYLE_KEYS = ['variant', 'cover', 'color', 'color2', 'wood', 'metal', 'stone', 'finish'];

/** The style of one placed piece: its set's choice (alternating per instance) plus the owner's overrides. */
function resolveSpec(item, setId = activeSetId(), withOverrides = !previewSetId) {
  const set = STYLE_SETS[setId] || STYLE_SETS['warm-modern'];
  const base = set.pieces[item.type] || {};
  const idx = state.items.filter((i) => i.type === item.type).indexOf(item);
  const pick = (v) => (Array.isArray(v) ? v[Math.max(0, idx) % v.length] : v);
  const s = {};
  for (const k of STYLE_KEYS) if (base[k] != null) s[k] = pick(base[k]);
  if (withOverrides && item.s) for (const k of STYLE_KEYS) if (item.s[k] != null) s[k] = item.s[k];
  const vars = VARIANTS[item.type];
  if (vars && !vars[s.variant]) s.variant = Object.keys(vars)[0];
  if (UPHOLSTERED[item.type] && !COVERS[s.cover]) s.cover = 'linen';
  return s;
}
const hasOverrides = (item) => !!item.s && STYLE_KEYS.some((k) => item.s[k] != null);
const isCustomised = () => state.items.some(hasOverrides);

// ---------------- what a piece costs, how long it takes, how big it is ----------------
function pieceSize(item, s) {
  const p = { ...CATALOG[item.type].defaults, ...item.p }, v = (VARIANTS[item.type] || {})[s.variant] || {};
  switch (item.type) {
    case 'sectional': return { text: `${ftin(p.back)} × ${ftin(p.ret)} L, ${inch(p.depth)} deep, ${inch(v.H)} high`, run: p.back + p.ret - p.depth };
    case 'sofa': return { text: `${inch(p.w)} W × ${inch(p.depth)} D × ${inch(v.H)} H`, run: p.w };
    case 'rug': return { text: `${ftin(p.w)} × ${ftin(p.d)}`, sqft: (p.w * p.d) / 144 };
    case 'roundTable': {
      const rect = s.variant === 'slab' || s.variant === 'frame';
      return { text: rect ? `${inch(p.dia * 1.4)} × ${inch(p.dia * 0.72)} × ${inch(v.H)} H` : `Ø ${inch(p.dia)} × ${inch(v.H)} H` };
    }
    case 'ottoman': return { text: `${inch(p.w)} × ${inch(p.d)} × ${inch(v.H)} H` };
    case 'loungeChair': return { text: `${inch(v.W)} W × ${inch(v.D)} D × ${inch(v.H)} H` };
    case 'console': return { text: `${inch(p.w)} W × 15″ D × ${s.variant === 'frame' || s.variant === 'credenza' ? '24″ H on legs' : '13″ H, wall-hung'}`, scale: p.w / 70 };
    case 'plant': return { text: `${inch(s.variant === 'snake' ? 30 : p.h)} tall` };
    case 'towerSpeaker': return { text: '9″ × 12″ × 41″ H' };
    case 'subwoofer': return { text: '15″ cube' };
    case 'recliner': return { text: '36″ × 38″ × 41″ H' };
    case 'barCart': return { text: '24″ × 16″ × 33″ H' };
    case 'pouf': return { text: `Ø 20″ × ${inch(v.H || 16)} H` };
    case 'floorLamp': return { text: s.variant === 'arc' ? '80″ H, 50″ reach' : `${inch(v.H)} H` };
    case 'sideTable': return { text: `${s.variant === 'ctable' ? '16″ × 12″' : 'Ø 18″'} × ${inch(v.H)} H` };
    default: return { text: v.H ? `${inch(v.H)} H` : '' };
  }
}
/** Indicative CAD price range [lo, hi] for one piece, or null for AV gear (budgeted separately). */
function piecePrice(item, s) {
  if (AV_TYPES[item.type]) return null;
  const v = (VARIANTS[item.type] || {})[s.variant] || {}, size = pieceSize(item, s);
  const f = UPHOLSTERED[item.type] ? (COVERS[s.cover] || COVERS.linen).factor : 1;
  let lo, hi;
  if (v.perIn) { const corner = item.type === 'sectional' ? 1.15 : 1; lo = v.perIn[0] * size.run * corner; hi = v.perIn[1] * size.run * corner; }
  else if (v.perSqFt) { lo = v.perSqFt[0] * size.sqft; hi = v.perSqFt[1] * size.sqft; }
  else if (v.price) { lo = v.price[0] * (size.scale || 1); hi = v.price[1] * (size.scale || 1); }
  else return null;
  const round = (x) => Math.round(x / 10) * 10;
  return [round(lo * f), round(hi * f)];
}
function pieceWeeks(item, s) {
  if (AV_TYPES[item.type]) return null;
  const v = (VARIANTS[item.type] || {})[s.variant] || {};
  if (!v.weeks) return null;
  const extra = UPHOLSTERED[item.type] ? (COVERS[s.cover] || COVERS.linen).weeks : 0;
  return [v.weeks[0] + extra, v.weeks[1] + extra];
}
function pieceSpecText(item, s) {
  const v = (VARIANTS[item.type] || {})[s.variant], bits = [];
  if (v) bits.push(v.desc);
  if (UPHOLSTERED[item.type]) bits.push(`${COVERS[s.cover].label}, ${colorName(s.color)}`);
  if (item.type === 'rug') bits.push(colorName(s.color));
  if (s.wood && WOOD_FINISHES[s.wood]) bits.push(WOOD_FINISHES[s.wood].label);
  if (s.metal && METAL_FINISHES[s.metal]) bits.push(METAL_FINISHES[s.metal]);
  if (s.stone && STONE_FINISHES[s.stone]) bits.push(STONE_FINISHES[s.stone]);
  if (s.finish && AV_FINISHES[s.finish]) bits.push(AV_FINISHES[s.finish] + ' cabinet');
  return bits.join(' · ');
}

// ---------------- scoring ----------------
const CRITERIA = [
  { key: 'comfort', label: 'Movie comfort', note: 'Seat depth, back height and recline of the main seating, plus the lounge chairs.' },
  { key: 'picture', label: 'Screen contrast', note: 'Dark, matte furniture facing the screen bounces less light back onto it.' },
  { key: 'acoustics', label: 'Acoustics', note: 'Soft upholstery and deep rugs absorb echo; leather, stone and lacquer reflect it.' },
  { key: 'care', label: 'Durability and care', note: 'Abrasion resistance, cleanability, and how it copes with kids and pets.' },
  { key: 'hangout', label: 'Hangout flexibility', note: 'Swivels, modules and movable seats for game nights.' },
  { key: 'budget', label: 'Budget', note: 'Indicative furniture total for this layout; lower scores higher.' },
  { key: 'lead', label: 'Lead time', note: 'The longest wait among the pieces.' },
  { key: 'fit', label: 'Fit with the room', note: 'Designer read on the walnut slat wall, dark alcove and warm lighting.' },
];

function luminance(hex) {
  const c = new THREE.Color(hex);                       // three keeps colours linear: this is relative luminance
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}
function pieceTone(item, s) {                           // [luminance, sheen] of the surface the screen sees
  if (UPHOLSTERED[item.type]) return [luminance(s.color), (COVERS[s.cover] || {}).sheen || 0];
  if (item.type === 'rug') return [luminance(s.color) * 0.8 + luminance(s.color2 || s.color) * 0.2, 0];
  if (item.type === 'console') return s.variant === 'lacquer' ? [luminance('#121110'), 0] : [luminance(WOOD_FINISHES[s.wood || 'walnut'].color), VARIANTS.console[s.variant].sheen || 0.1];
  if (item.type === 'roundTable') {
    if (s.stone) return [luminance(s.stone === 'marble' ? '#e8e4dc' : s.stone === 'travertine' ? '#d8c7ad' : '#2a2724'), s.stone === 'marble' ? 0.3 : 0.1];
    return [luminance(WOOD_FINISHES[s.wood || 'walnut'].color), 0.1];
  }
  return null;
}

/** Scores 1–5 per criterion, plus budget and lead time, for a set as designed (or the current layout with overrides). */
function evaluateSet(setId, withOverrides = false) {
  const set = STYLE_SETS[setId];
  const rows = state.items.map((it) => ({ it, s: resolveSpec(it, setId, withOverrides) }));
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const wmean = (pairs) => { const w = pairs.reduce((a, [, k]) => a + k, 0); return w ? pairs.reduce((a, [v, k]) => a + v * k, 0) / w : 0; };
  const of = (type) => rows.filter((r) => r.it.type === type);
  const main = of('sectional')[0] || of('sofa')[0] || of('recliner')[0];
  const varOf = (r) => (VARIANTS[r.it.type] || {})[r.s.variant] || {};
  // movie comfort: main seating dominates; lounge chairs and a footrest add the rest
  const chairs = of('loungeChair'), foot = of('ottoman').length + of('pouf').length;
  const comfort = (main ? varOf(main).comfort * 0.6 : 2) + (chairs.length ? mean(chairs.map((r) => varOf(r).comfort)) * 0.25 : 0.75) + (foot ? 4 : 2.5) * 0.15;
  // screen contrast: luminance and sheen of what faces the screen, weighted by how much of it the screen sees
  const W = { sectional: 3, sofa: 3, recliner: 3, console: 3, rug: 2, roundTable: 1, ottoman: 1, loungeChair: 0.5, pouf: 0.4 };
  const tones = rows.map((r) => [pieceTone(r.it, r.s), W[r.it.type] || 0]).filter(([t, k]) => t && k);
  const glare = wmean(tones.map(([[L, sh], k]) => [L + sh * 0.35, k]));
  const picture = clamp(5 - 4 * (glare - 0.03) / 0.42, 1, 5);
  // acoustics: absorption of soft surfaces by area (main seating and rugs dominate)
  const dims = (r) => ({ ...CATALOG[r.it.type].defaults, ...r.it.p });
  const area = (r) => ({ sectional: 24, sofa: 18, recliner: 6, loungeChair: 5, ottoman: 4, pouf: 2, rug: (dims(r).w * dims(r).d) / 300 })[r.it.type] || 0;
  const absorbOf = (r) => (r.it.type === 'rug' ? varOf(r).absorb : (COVERS[r.s.cover] || {}).absorb);
  const acoustics = clamp(wmean(rows.filter((r) => area(r) && absorbOf(r)).map((r) => [absorbOf(r), area(r)])), 1, 5);
  // durability and care: upholstery by area
  const soft = rows.filter((r) => UPHOLSTERED[r.it.type]);
  const care = clamp(wmean(soft.map((r) => { const c = COVERS[r.s.cover]; return [(c.durability + c.care + c.pets) / 3, area(r)]; })), 1, 5);
  // hangout: modules and swivels, plus how many movable seats the layout has
  const movable = chairs.length + of('pouf').length + of('ottoman').length;
  const hangout = clamp((main ? varOf(main).hangout * 0.5 : 1.5) + (chairs.length ? mean(chairs.map((r) => varOf(r).hangout)) * 0.3 : 0.6) + Math.min(5, 1.5 + movable * 0.6) * 0.2, 1, 5);
  // budget and lead time
  let lo = 0, hi = 0, weeks = 0;
  for (const r of rows) {
    const pr = piecePrice(r.it, r.s); if (pr) { lo += pr[0]; hi += pr[1]; }
    const wk = pieceWeeks(r.it, r.s); if (wk) weeks = Math.max(weeks, wk[1]);
  }
  const mid = (lo + hi) / 2;
  const budget = clamp(5 - 4 * (mid - 9000) / 15000, 1, 5);
  const lead = clamp(5 - (weeks - 4) * 0.28, 1, 5);
  const scores = { comfort: clamp(comfort, 1, 5), picture, acoustics, care, hangout, budget, lead, fit: set.fit };
  return { scores, lo, hi, weeks, total: weightedTotal(scores) };
}
// one-click priority profiles in the Style tab (0 ignores a criterion, 5 counts most)
const WEIGHT_PRESETS = {
  'Balanced': DEFAULT_WEIGHTS,
  'Cinema first': { comfort: 5, picture: 5, acoustics: 4, care: 3, hangout: 1, budget: 2, lead: 1, fit: 2 },
  'Hangout first': { comfort: 3, picture: 2, acoustics: 2, care: 4, hangout: 5, budget: 3, lead: 2, fit: 3 },
  'Budget first': { comfort: 2, picture: 1, acoustics: 1, care: 2, hangout: 2, budget: 5, lead: 2, fit: 1 },
};
function weightedTotal(scores, weights = (state.study && state.study.weights) || DEFAULT_WEIGHTS) {
  let sw = 0, s = 0;
  for (const c of CRITERIA) { const w = weights[c.key] ?? DEFAULT_WEIGHTS[c.key]; sw += w; s += w * scores[c.key]; }
  return sw ? Math.round((s / sw) * 20) : 0;                // 0–100
}
const money = (v) => (v >= 10000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v).toLocaleString('en-CA')}`);
const moneyRange = (lo, hi) => `${money(lo)}–${money(hi)}`;

/** Spec sheet rows for a set (as designed) or the current layout: identical pieces grouped with a quantity. */
function specRows(setId, withOverrides) {
  const groups = new Map(), PREFIX = { sectional: 'SE', sofa: 'SE', recliner: 'SE', loungeChair: 'SE', ottoman: 'SE', pouf: 'SE',
    roundTable: 'TB', sideTable: 'TB', rug: 'RG', console: 'ST', barCart: 'ST', floorLamp: 'LT', plant: 'AC', towerSpeaker: 'AV', subwoofer: 'AV' };
  for (const it of state.items) {
    const s = resolveSpec(it, setId, withOverrides), size = pieceSize(it, s), spec = pieceSpecText(it, s);
    const key = [it.type, spec, size.text].join('|');
    if (!groups.has(key)) {
      const v = (VARIANTS[it.type] || {})[s.variant];
      groups.set(key, { type: it.type, item: v ? `${CATALOG[it.type].label}: ${v.label}` : CATALOG[it.type].label, spec, size: size.text,
        qty: 0, unit: piecePrice(it, s), weeks: pieceWeeks(it, s), care: UPHOLSTERED[it.type] ? COVERS[s.cover].spec : '', ids: [] });
    }
    groups.get(key).qty++; groups.get(key).ids.push(it.id);
  }
  const order = ['SE', 'TB', 'RG', 'ST', 'LT', 'AC', 'AV'], count = {};
  return [...groups.values()]
    .sort((a, b) => order.indexOf(PREFIX[a.type]) - order.indexOf(PREFIX[b.type]))
    .map((g) => { const p = PREFIX[g.type] || 'XX'; count[p] = (count[p] || 0) + 1; return { ...g, tag: `${p}-${String(count[p]).padStart(2, '0')}` }; });
}
