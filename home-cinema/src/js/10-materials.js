// ===================================================================
// 10 · Procedural textures + shared materials (no image downloads)
// ===================================================================
function rng(seed) {                       // mulberry32
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shade(hex, f) {                   // f > 0 lighten, f < 0 darken
  const c = new THREE.Color(hex);
  return f >= 0 ? c.lerp(new THREE.Color('#ffffff'), f) : c.lerp(new THREE.Color('#000000'), -f);
}
const css = (c) => '#' + c.getHexString();
function canvasTex(cv, srgb = true, rep = [1, 1]) {
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep[0], rep[1]);
  t.anisotropy = 8;
  return t;
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

/** Wood: planks (floor) or one long board face (slats). Grain runs along canvas Y. */
function woodCanvas({ base, grain, plankCols = 0, plankRows = 0, seed = 7, size = 1024 }) {
  const cv = mkCanvas(size, size), g = cv.getContext('2d'), r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  const cols = Math.max(1, plankCols), colW = size / cols;
  for (let c = 0; c < cols; c++) {
    const rows = plankRows || 1;
    const offset = r() * size;
    for (let k = 0; k <= rows; k++) {
      const y0 = (k * size / rows + offset) % size - (k === 0 ? 0 : 0);
      const h = size / rows;
      const tint = (r() - 0.5) * 0.22;
      g.fillStyle = css(shade(base, tint));
      for (const yy of [y0, y0 - size]) g.fillRect(c * colW, yy, colW, h);
      if (plankRows) {                  // butt joint
        g.fillStyle = 'rgba(0,0,0,0.35)';
        for (const yy of [y0, y0 - size]) g.fillRect(c * colW, yy, colW, 2);
      }
    }
    // grain lines
    g.save(); g.beginPath(); g.rect(c * colW, 0, colW, size); g.clip();
    const lines = 26 + Math.floor(r() * 14);
    for (let i = 0; i < lines; i++) {
      const x = c * colW + r() * colW, amp = 1 + r() * 5, freq = 0.004 + r() * 0.01, ph = r() * 6;
      g.strokeStyle = r() < 0.6 ? grain : css(shade(grain, 0.25));
      g.globalAlpha = 0.12 + r() * 0.28; g.lineWidth = 0.6 + r() * 1.8;
      g.beginPath();
      for (let y = 0; y <= size; y += 16) g.lineTo(x + Math.sin(y * freq + ph) * amp, y);
      g.stroke();
    }
    // a few cathedral arches
    for (let i = 0; i < 3; i++) {
      const cx = c * colW + colW * (0.3 + r() * 0.4), cy = r() * size;
      g.strokeStyle = grain; g.globalAlpha = 0.18; g.lineWidth = 1.2;
      for (let k = 0; k < 6; k++) {
        g.beginPath(); g.ellipse(cx, cy, 4 + k * 5, 40 + k * 28, 0, Math.PI * 0.1, Math.PI * 0.9); g.stroke();
      }
    }
    g.restore(); g.globalAlpha = 1;
    if (plankCols) { g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(c * colW, 0, 2, size); }
  }
  return cv;
}

function noiseCanvas(size, { base = '#808080', amp = 40, blobs = 0, seed = 3, dots = 0 } = {}) {
  const cv = mkCanvas(size, size), g = cv.getContext('2d'), r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amp;
    d[i] = clamp(d[i] + n, 0, 255); d[i + 1] = clamp(d[i + 1] + n, 0, 255); d[i + 2] = clamp(d[i + 2] + n, 0, 255);
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < dots; i++) {           // boucle loops
    const x = r() * size, y = r() * size, rr = 1 + r() * 2.6;
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)';
    g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
  }
  return cv;
}

function rugCanvas(color, pattern, seed = 11) {
  const size = 512, cv = noiseCanvas(size, { base: color, amp: 26, seed }), g = cv.getContext('2d');
  const r = rng(seed + 1), light = css(shade(color, 0.22)), dark = css(shade(color, -0.25));
  if (pattern === 'border') {
    g.strokeStyle = light; g.lineWidth = 10; g.strokeRect(30, 30, size - 60, size - 60);
    g.strokeStyle = dark; g.lineWidth = 3; g.strokeRect(52, 52, size - 104, size - 104);
  } else {
    g.globalAlpha = 0.14;
    for (let y = 0; y < size; y += 4) { g.fillStyle = y % 8 ? dark : light; g.fillRect(0, y, size, 2); }
    g.globalAlpha = 0.1;
    for (let i = 0; i < 40; i++) {
      g.fillStyle = r() < 0.5 ? light : dark;
      g.fillRect(r() * size, r() * size, 40 + r() * 120, 3 + r() * 10);
    }
    g.globalAlpha = 1;
  }
  return cv;
}

/** Dark porcelain slab with soft white veining. */
function stoneCanvas() {
  const size = 512, cv = noiseCanvas(size, { base: '#2c2926', amp: 14, seed: 61 }), g = cv.getContext('2d'), r = rng(62);
  for (let i = 0; i < 16; i++) {
    g.strokeStyle = `rgba(232,226,214,${0.08 + r() * 0.22})`; g.lineWidth = 0.6 + r() * 2.4;
    g.beginPath(); let x = -20, y = r() * size; g.moveTo(x, y);
    while (x < size + 20) { const nx = x + 40 + r() * 70, ny = y + (r() - 0.45) * 60; g.quadraticCurveTo((x + nx) / 2 + (r() - 0.5) * 40, (y + ny) / 2 + (r() - 0.5) * 40, nx, ny); x = nx; y = ny; }
    g.stroke();
  }
  return cv;
}

function reededCanvas() {
  const cv = mkCanvas(256, 64), g = cv.getContext('2d');
  for (let x = 0; x < 256; x += 8) {
    const grd = g.createLinearGradient(x, 0, x + 8, 0);
    grd.addColorStop(0, '#5f7383'); grd.addColorStop(0.45, '#c9d6de'); grd.addColorStop(1, '#3d4a55');
    g.fillStyle = grd; g.fillRect(x, 0, 8, 64);
  }
  return cv;
}

function radialCanvas(inner = 'rgba(0,0,0,0.55)', outer = 'rgba(0,0,0,0)') {
  const cv = mkCanvas(128, 128), g = cv.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, inner); grd.addColorStop(0.55, inner.replace(/[\d.]+\)$/, '0.32)')); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return cv;
}

// ---------------- finishes ----------------
const FLOORS = {
  walnut:  { label: 'Dark walnut', base: '#4f3322', grain: '#2c1a0f', rough: 0.55 },
  smoked:  { label: 'Smoked oak',  base: '#6f5a47', grain: '#3f3024', rough: 0.6 },
  oak:     { label: 'Natural oak', base: '#b38c60', grain: '#7d5a37', rough: 0.6 },
  espresso:{ label: 'Espresso',    base: '#2f221a', grain: '#170f0a', rough: 0.5 },
  carpet:  { label: 'Charcoal carpet', base: '#3a3633', rough: 1.0, carpet: true },
};
const SLATS = {
  walnut: { label: 'Walnut', base: '#5a3a24', grain: '#2d1b0e' },
  oak:    { label: 'Oak',    base: '#a77f55', grain: '#6d4c2d' },
  smoked: { label: 'Smoked', base: '#4a3a2e', grain: '#251b14' },
  black:  { label: 'Black',  base: '#1d1a17', grain: '#0b0908' },
};
const WALL_COLORS = [
  ['#cbc2b3', 'Greige (current)'], ['#e4ded3', 'Warm white'], ['#a79c8c', 'Taupe'],
  ['#6e665d', 'Mushroom'], ['#3f3a36', 'Charcoal'], ['#2b2f33', 'Navy slate'], ['#4a3f35', 'Cocoa'],
];
const FABRICS = [
  ['#8f877c', 'Stone'], ['#5f5a54', 'Graphite'], ['#2f2c2a', 'Ink'], ['#7a5f48', 'Cognac'],
  ['#3f4a3f', 'Moss'], ['#2f3a4a', 'Midnight'], ['#c9bba5', 'Oat'], ['#e6dccb', 'Bouclé ivory'],
];
const WOODS = [['#3b281b', 'Walnut'], ['#1f1813', 'Ebony'], ['#7a5a3d', 'Oak'], ['#4a3424', 'Teak']];

const M = {};               // shared materials, rebuilt by applyFinishes()
const TEX = {};
function initMaterials() {
  TEX.shadow = canvasTex(radialCanvas(), false);
  TEX.halo = (() => {                       // soft rounded-rectangle glow for TV bias lighting
    // bright at the TV's edge, fading to nothing at the plane's edge (TV covers the inner 69% x 59%)
    const W = 256, Hh = 160, cv = mkCanvas(W, Hh), g = cv.getContext('2d'), img = g.createImageData(W, Hh);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const u = Math.abs((x + 0.5) / W * 2 - 1), v = Math.abs((y + 0.5) / Hh * 2 - 1);
      const du = Math.max(0, u - 0.69) / 0.31, dv = Math.max(0, v - 0.59) / 0.41;
      const a = Math.pow(Math.max(0, 1 - Math.hypot(du, dv)), 2.2);
      const i = (y * W + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(a * 255);
    }
    g.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(cv);
  })();
  TEX.reeded = canvasTex(reededCanvas(), true, [6, 1]);
  TEX.boucle = canvasTex(noiseCanvas(256, { base: '#808080', amp: 50, dots: 1400, seed: 21 }), false, [3, 3]);
  TEX.linen = canvasTex(noiseCanvas(256, { base: '#808080', amp: 34, seed: 5 }), false, [4, 4]);
  TEX.paint = canvasTex(noiseCanvas(256, { base: '#808080', amp: 10, seed: 9 }), false, [8, 8]);

  M.wall = new THREE.MeshStandardMaterial({ color: state.finish.wall, roughness: 0.92, bumpMap: TEX.paint, bumpScale: 0.02 });
  M.accent = new THREE.MeshStandardMaterial({ color: '#2f2b28', roughness: 0.9 });
  M.ceiling = new THREE.MeshStandardMaterial({ color: '#efebe4', roughness: 0.95 });
  M.bulkhead = new THREE.MeshStandardMaterial({ color: '#ebe6de', roughness: 0.95 });   // ghosted when seen from above
  M.floor = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0 });
  M.slat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  M.felt = new THREE.MeshStandardMaterial({ color: '#141210', roughness: 1 });
  M.black = new THREE.MeshStandardMaterial({ color: '#0d0c0b', roughness: 0.5, metalness: 0.2 });
  M.metal = new THREE.MeshStandardMaterial({ color: '#1a1816', roughness: 0.35, metalness: 0.8 });
  M.brass = new THREE.MeshStandardMaterial({ color: '#b48a52', roughness: 0.3, metalness: 0.9 });
  M.trim = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.6 });
  M.stairWood = new THREE.MeshStandardMaterial({ color: '#2e2019', roughness: 0.45 });
  M.glassDark = new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.55, depthWrite: false });
  M.reeded = new THREE.MeshStandardMaterial({ map: TEX.reeded, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.88,
    emissive: '#b8c6d4', emissiveMap: TEX.reeded, emissiveIntensity: 0.25 });
  M.shadow = new THREE.MeshBasicMaterial({ map: TEX.shadow, transparent: true, depthWrite: false, opacity: 0.8 });
  M.led = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb46b').multiplyScalar(3), toneMapped: false });
  M.potOn = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1dc').multiplyScalar(4), toneMapped: false });
  M.potOff = new THREE.MeshStandardMaterial({ color: '#d9d4cc', roughness: 0.4 });
  M.stepLight = new THREE.MeshBasicMaterial({ color: '#3a342c', toneMapped: false });
  M.smoked = new THREE.MeshStandardMaterial({ color: '#17110d', roughness: 0.1, metalness: 0.55 });
  M.matteBlack = new THREE.MeshStandardMaterial({ color: '#141210', roughness: 0.75, metalness: 0.1 });
  M.slab = new THREE.MeshStandardMaterial({ map: canvasTex(stoneCanvas(), true), roughness: 0.35 });
  M.bandGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc890').multiplyScalar(1.4), toneMapped: false });
  M.stone = new THREE.MeshStandardMaterial({ color: '#3a3733', roughness: 0.85 });
  applyFinishes();
}

function woodTexture(def, cols, rows, seed, rep) {
  return canvasTex(woodCanvas({ base: def.base, grain: def.grain, plankCols: cols, plankRows: rows, seed }), true, rep);
}
const _texCache = {};
function cached(key, make) { return _texCache[key] || (_texCache[key] = make()); }

function applyFinishes() {
  const f = state.finish;
  M.wall.color.set(f.wall);
  const fl = FLOORS[f.floor] || FLOORS.walnut;
  if (fl.carpet) {
    M.floor.map = cached('carpet', () => canvasTex(noiseCanvas(512, { base: fl.base, amp: 30, seed: 41 }), true, [1 / 60, 1 / 60]));
  } else {
    // one tile = 8 planks x 7.5" wide, 2 boards of 48" per column
    M.floor.map = cached('floor-' + f.floor, () => woodTexture(fl, 8, 2, 13, [1 / 60, 1 / 96]));
  }
  M.floor.roughness = fl.rough; M.floor.needsUpdate = true;
  const sl = SLATS[f.slat] || SLATS.walnut;
  M.slat.map = cached('slat-' + f.slat, () => woodTexture(sl, 1, 0, 17, [0.12, 1]));
  M.slat.needsUpdate = true;
  const accents = { 'paint-dark': '#2f2b28', 'paint-wall': f.wall, 'paint-navy': '#232a33', 'paint-green': '#2f3a32' };
  M.accent.color.set(accents[f.bayAccent] || f.wall);
}

/** Fabric material per colour (cached so many cushions share one). */
function fabricMat(color, kind = 'linen') {
  return cached(`fab-${kind}-${color}`, () => new THREE.MeshStandardMaterial({
    color, roughness: 0.95, bumpMap: kind === 'boucle' ? TEX.boucle : TEX.linen, bumpScale: kind === 'boucle' ? 0.6 : 0.25,
  }));
}
function woodMat(color) {
  return cached('wood-' + color, () => {
    const c = new THREE.Color(color);
    const map = woodTexture({ base: color, grain: css(c.clone().multiplyScalar(0.55)) }, 1, 0, 29, [1, 1]);
    return new THREE.MeshStandardMaterial({ map, roughness: 0.5 });
  });
}
function rugMat(color, pattern) {
  return cached(`rug-${color}-${pattern}`, () => new THREE.MeshStandardMaterial({
    map: canvasTex(rugCanvas(color, pattern), true), roughness: 1,
  }));
}
