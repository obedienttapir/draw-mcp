// ===================================================================
// 42 · Wall décor: frames, a gallery wall, mirrors, shelves, sconces and
//      acoustic panels. Wall pieces (CATALOG[type].wall) are built around
//      their own centre, back on the wall (z = -d/2), front facing +Z;
//      placeItem lifts them to item.p.h (centre height) and 57-collide
//      keeps them flat on a wall. Art is drawn procedurally (no images).
// ===================================================================
const ART = {
  abstract: 'Warm abstract', landscape: 'Dusk landscape', botanical: 'Botanical', poster: 'Film poster',
  photo: 'B&W photograph', lines: 'Line drawing',
};
/** Procedural artwork for a w × h opening, cached per kind, aspect and seed. */
function artTexture(kind, aspect, seed = 1) {
  const a = Math.round(clamp(aspect, 0.3, 3) * 10) / 10;
  return cached(`art-${kind}-${a}-${seed}`, () => canvasTex(artCanvas(kind, a, seed), true));
}
function artCanvas(kind, aspect, seed) {
  const W = aspect >= 1 ? 512 : Math.round(512 * aspect), H = aspect >= 1 ? Math.round(512 / aspect) : 512;
  const cv = mkCanvas(W, H), g = cv.getContext('2d'), r = rng(seed * 97 + kind.length * 13), m = Math.min(W, H);
  const pal = (list) => list[Math.floor(r() * list.length)];
  if (kind === 'abstract') {
    g.fillStyle = pal(['#e9dcc6', '#efe3cf', '#e4d5bd']); g.fillRect(0, 0, W, H);
    const cols = ['#b5643c', '#d49a5a', '#6f7a5a', '#2f3a32', '#c98f7a', '#8a5a3c'];
    g.fillStyle = pal(cols); g.beginPath(); g.arc(W * (0.3 + r() * 0.4), H * (0.3 + r() * 0.2), m * (0.16 + r() * 0.08), 0, Math.PI * 2); g.fill();
    g.fillStyle = pal(cols); const aw = W * 0.42, ax = W * (0.1 + r() * 0.4), ay = H * 0.55;      // arch
    g.beginPath(); g.moveTo(ax, H); g.lineTo(ax, ay); g.arc(ax + aw / 2, ay, aw / 2, Math.PI, 0); g.lineTo(ax + aw, H); g.fill();
    g.fillStyle = pal(cols); g.fillRect(W * (0.55 + r() * 0.2), H * 0.68, W * 0.3, H * 0.32);
    g.strokeStyle = '#2b2622'; g.lineWidth = m * 0.008; g.beginPath(); g.arc(W * 0.7, H * 0.32, m * 0.12, Math.PI * 0.1, Math.PI * 1.2); g.stroke();
  } else if (kind === 'landscape') {
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#f2c58a'); sky.addColorStop(0.55, '#e9a07a'); sky.addColorStop(1, '#b8786a');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fbe6b8'; g.beginPath(); g.arc(W * (0.3 + r() * 0.4), H * 0.42, m * 0.08, 0, Math.PI * 2); g.fill();
    ['#8a6a62', '#6b5258', '#4a3c46', '#2f2834'].forEach((c, i) => {
      g.fillStyle = c; g.beginPath(); g.moveTo(0, H);
      const base = H * (0.5 + i * 0.12);
      for (let x = 0; x <= W; x += W / 24) g.lineTo(x, base - Math.sin(x / W * (3 + i) + seed + i) * H * 0.06 - r() * H * 0.02);
      g.lineTo(W, H); g.fill();
    });
  } else if (kind === 'botanical') {
    g.fillStyle = '#efe8d8'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#4f5d3f'; g.fillStyle = '#5f6e4a'; g.lineWidth = m * 0.008;
    const x0 = W / 2, y0 = H * 0.9, y1 = H * 0.12;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + W * 0.08, (y0 + y1) / 2, x0 - W * 0.02, y1); g.stroke();
    for (let k = 0; k < 9; k++) {
      const t = 0.12 + k * 0.09, y = lerp(y0, y1, t), x = x0 + Math.sin(t * 3) * W * 0.04, side = k % 2 ? 1 : -1, len = m * (0.18 - t * 0.08);
      g.save(); g.translate(x, y); g.rotate(side * (0.9 - t * 0.4)); g.beginPath(); g.ellipse(0, -len / 2, len * 0.22, len / 2, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    g.fillStyle = '#6d6250'; g.font = `${Math.round(m * 0.035)}px Georgia, serif`; g.textAlign = 'center'; g.fillText('Olea europaea', W / 2, H * 0.97);
  } else if (kind === 'poster') {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1b1f2b'); bg.addColorStop(1, '#0d0c10'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const sun = g.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, m * 0.34); sun.addColorStop(0, '#ffb35c'); sun.addColorStop(0.6, '#d9542f'); sun.addColorStop(1, 'rgba(120,30,30,0)');
    g.fillStyle = sun; g.fillRect(0, 0, W, H);
    g.fillStyle = '#0d0c10'; for (let i = 0; i < 6; i++) g.fillRect(0, H * 0.42 + i * m * 0.035 + i * i * 1.5, W, m * 0.012 + i);
    g.fillStyle = '#f3e6cf'; g.textAlign = 'center';
    g.font = `bold ${Math.round(m * 0.11)}px Georgia, serif`; g.fillText(pal(['LATE SHOW', 'NIGHT DRIVE', 'LONG SUMMER']), W / 2, H * 0.8);
    g.font = `${Math.round(m * 0.03)}px Georgia, serif`; g.fillStyle = '#b9a98f'; g.fillText('A BASEMENT CINEMA PRESENTATION', W / 2, H * 0.87);
    g.fillRect(W * 0.2, H * 0.92, W * 0.6, 1.5); g.fillRect(W * 0.28, H * 0.94, W * 0.44, 1.5);
  } else if (kind === 'photo') {
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#d8d8d6'); sky.addColorStop(0.6, '#9a9a98'); sky.addColorStop(1, '#3a3a3a');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = '#5a5a5a'; g.fillRect(0, H * 0.62, W, H * 0.38);
    g.fillStyle = '#2a2a2a'; g.beginPath(); g.moveTo(0, H); g.lineTo(0, H * 0.55); g.lineTo(W * 0.25, H * 0.5); g.lineTo(W * 0.42, H * 0.7); g.lineTo(W * 0.42, H); g.fill();
    for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'; g.fillRect(r() * W, r() * H, 1, 1); }
  } else {                                                                   // line drawing
    g.fillStyle = '#f2ede3'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#1f1c1a'; g.lineWidth = m * 0.007; g.lineCap = 'round';
    g.beginPath(); g.moveTo(W * 0.2, H * 0.75);
    for (let k = 0; k < 6; k++) g.bezierCurveTo(W * r(), H * (0.2 + r() * 0.6), W * r(), H * (0.2 + r() * 0.6), W * (0.2 + r() * 0.6), H * (0.25 + r() * 0.5));
    g.stroke();
    g.fillStyle = '#c4703f'; g.beginPath(); g.arc(W * 0.66, H * 0.34, m * 0.06, 0, Math.PI * 2); g.fill();
  }
  return cv;
}

const MAT_BOARD = () => cached('mat-board', () => new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 0.95 }));
const GLASS_MIRROR = () => cached('mirror-glass', () => new THREE.MeshStandardMaterial({ color: '#dfe6ea', metalness: 1, roughness: 0.04 }));
/** One framed picture centred at (x, y) on the wall plane, front at z = zf. */
function framePiece(g, x, y, fw, fh, s, art, seed, mat = true, zf = 0.8) {
  const v = s.variant, d = v === 'canvas' ? 1.5 : 1.2;
  const fmat = v === 'metal' ? metalFinish(s.metal || 'black') : woodFinish(s.wood || 'walnut');
  const b = v === 'metal' ? 0.45 : v === 'float' ? 0.9 : v === 'canvas' ? 0 : 1.1;
  const z0 = zf - d;
  const artMat = cached(`artmat-${art}-${fw / fh}-${seed}`, () => new THREE.MeshStandardMaterial({ map: artTexture(art, fw / fh, seed), roughness: 0.85 }));
  if (v === 'canvas') {                                                   // gallery wrap: the art runs round the sides
    span(g, artMat, x - fw / 2, x + fw / 2, y - fh / 2, y + fh / 2, z0, zf, 0.15);
    return;
  }
  // moulding: four bars
  span(g, fmat, x - fw / 2, x + fw / 2, y + fh / 2 - b, y + fh / 2, z0, zf, 0.2);
  span(g, fmat, x - fw / 2, x + fw / 2, y - fh / 2, y - fh / 2 + b, z0, zf, 0.2);
  span(g, fmat, x - fw / 2, x - fw / 2 + b, y - fh / 2, y + fh / 2, z0, zf, 0.2);
  span(g, fmat, x + fw / 2 - b, x + fw / 2, y - fh / 2, y + fh / 2, z0, zf, 0.2);
  const iw = fw - 2 * b, ih = fh - 2 * b;
  if (v === 'float') {                                                    // floating frame: a dark gap round the art
    span(g, M.black, x - iw / 2, x + iw / 2, y - ih / 2, y + ih / 2, z0, z0 + 0.2, 0.05);
    const gap = 0.6; meshAt(rbox(iw - 2 * gap, ih - 2 * gap, 0.9, 0.1), artMat, x, y, z0 + 0.65, g);
    return;
  }
  meshAt(new THREE.PlaneGeometry(iw, ih), mat ? MAT_BOARD() : artMat, x, y, zf - 0.35, g);
  if (mat) {
    const mg = Math.min(iw, ih) * 0.13, aw = iw - 2 * mg, ah = ih - 2 * mg;
    const plane = meshAt(new THREE.PlaneGeometry(aw, ah), cached(`artmat-${art}-${aw / ah}-${seed}`, () => new THREE.MeshStandardMaterial({ map: artTexture(art, aw / ah, seed), roughness: 0.85 })), x, y, zf - 0.33, g);
    plane.renderOrder = 1;
  }
  span(g, fmat, x - fw / 2 + 0.3, x + fw / 2 - 0.3, y - fh / 2 + 0.3, y + fh / 2 - 0.3, z0, z0 + 0.3, 0.05);   // backing
}

function makeFrame(p, item, s) {
  const g = new THREE.Group(), d = s.variant === 'canvas' ? 1.5 : 1.2;
  framePiece(g, 0, 0, p.w, p.hgt, s, p.art, 1, p.mat !== 'off' && s.variant !== 'canvas' && s.variant !== 'float', d / 2);
  return { group: g, w: p.w, d, hv: p.hgt, shadows: [] };
}
const GALLERY_ART = ['abstract', 'botanical', 'landscape', 'photo', 'lines', 'poster'];
function galleryLayout(count) {
  // [x, y, w, h] around (0, 0), 3″ gaps
  if (count === '3') return [[0, 0, 24, 32], [-22, 0, 14, 18], [22, 0, 14, 18]];
  if (count === '6') return [-21, 0, 21].flatMap((x) => [[x, 12.5, 18, 22], [x, -12.5, 18, 22]]);
  return [[0, 0, 24, 32], [-22, 9.5, 14, 13], [-22, -9.5, 14, 19], [22, 6.5, 14, 19], [22, -12.5, 14, 13]];   // 5
}
function makeGallery(p, item, s) {
  const g = new THREE.Group(), frames = galleryLayout(p.count);
  frames.forEach(([x, y, w, h], k) => framePiece(g, x, y, w, h, s, p.art === 'mixed' ? GALLERY_ART[k % GALLERY_ART.length] : p.art, k + 1, true, 0.6));
  const W = Math.max(...frames.map(([x, , w]) => Math.abs(x) + w / 2)) * 2, H = Math.max(...frames.map(([, y, , h]) => Math.abs(y) + h / 2)) * 2;
  return { group: g, w: W, d: 1.2, hv: H, shadows: [] };
}
function makeMirror(p, item, s) {
  const g = new THREE.Group(), metal = metalFinish(s.metal || 'brass'), d = 1.4, zf = d / 2;
  if (s.variant === 'round') {
    const R = p.w / 2;
    const glass = meshAt(new THREE.CircleGeometry(R - 0.6, 64), GLASS_MIRROR(), 0, 0, zf - 0.3, g);
    const ring = meshAt(new THREE.TorusGeometry(R - 0.4, 0.5, 12, 72), metal, 0, 0, zf - 0.5, g);
    meshAt(new THREE.CylinderGeometry(R - 0.5, R - 0.5, 0.6, 48), M.black, 0, 0, -zf + 0.3, g).rotation.x = Math.PI / 2;
    glass.renderOrder = 1; ring.renderOrder = 1;
    return { group: g, w: p.w, d, hv: p.w, shadows: [] };
  }
  const w = p.w, hh = p.hgt;
  const shape = new THREE.Shape();
  if (s.variant === 'arch') {
    const r0 = w / 2, top = hh / 2 - r0;
    shape.moveTo(-w / 2, -hh / 2); shape.lineTo(w / 2, -hh / 2); shape.lineTo(w / 2, top); shape.absarc(0, top, r0, 0, Math.PI, false); shape.lineTo(-w / 2, -hh / 2);
  } else {
    const rr = 2; shape.moveTo(-w / 2 + rr, -hh / 2); shape.lineTo(w / 2 - rr, -hh / 2); shape.quadraticCurveTo(w / 2, -hh / 2, w / 2, -hh / 2 + rr);
    shape.lineTo(w / 2, hh / 2 - rr); shape.quadraticCurveTo(w / 2, hh / 2, w / 2 - rr, hh / 2); shape.lineTo(-w / 2 + rr, hh / 2);
    shape.quadraticCurveTo(-w / 2, hh / 2, -w / 2, hh / 2 - rr); shape.lineTo(-w / 2, -hh / 2 + rr); shape.quadraticCurveTo(-w / 2, -hh / 2, -w / 2 + rr, -hh / 2);
  }
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: d - 0.4, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2, curveSegments: 40 }), metal);
  frame.position.z = -zf + 0.2; g.add(frame);
  const inner = new THREE.Mesh(new THREE.ShapeGeometry(shape, 40), GLASS_MIRROR());
  inner.scale.set((w - 1.6) / w, (hh - 1.6) / hh, 1); inner.position.z = zf + 0.05; inner.renderOrder = 1; g.add(inner);
  return { group: g, w, d, hv: hh, shadows: [] };
}
function makeShelf(p, item, s) {
  const g = new THREE.Group(), wood = woodFinish(s.wood || 'walnut'), w = p.w;
  if (s.variant === 'ledge') {                                            // picture ledge with leaning frames
    const D = 4.5;
    span(g, wood, -w / 2, w / 2, -1, 0.6, -D / 2, D / 2, 0.3);
    span(g, wood, -w / 2, w / 2, 0.6, 1.8, D / 2 - 0.6, D / 2, 0.2);    // lip
    const frames = [[-w * 0.28, 12, 15], [w * 0.05, 16, 20], [w * 0.32, 9, 12]];
    frames.forEach(([x, fw, fh], k) => {
      const sub = new THREE.Group(); framePiece(sub, 0, fh / 2, fw, fh, { variant: k === 1 ? 'wood' : 'metal', wood: s.wood, metal: 'black' }, GALLERY_ART[k + 1], k + 3, true, 0.6);
      sub.position.set(x, 0.6, -D / 2 + 1.2 + (k % 2) * 0.8); sub.rotation.x = -0.12; g.add(sub);
    });
    return { group: g, w, d: D, hv: 24, shadows: [] };
  }
  const D = 9;                                                           // floating shelf, styled
  span(g, wood, -w / 2, w / 2, -1.8, 0, -D / 2, D / 2, 0.3);
  const books = ['#6e2f2f', '#2f3a4a', '#c9bba5', '#3f4a3f', '#b48a52', '#2b2724', '#8a5a3c'], r = rng(Math.round(w));
  let x = -w / 2 + 2;
  while (x < -w / 2 + w * 0.42) {
    const bw = 1 + r() * 1.3, bh = 7.5 + r() * 3;
    span(g, coverMat('linen', books[Math.floor(r() * books.length)]), x, x + bw, 0, bh, -D / 2 + 1, -D / 2 + 1 + 6 + r() * 1.5, 0.15);
    x += bw + 0.15;
  }
  const vase = cached('vase-ceramic', () => new THREE.MeshStandardMaterial({ color: '#d9cdb8', roughness: 0.55 }));
  const pts = [[0, 0], [2.4, 0.2], [3, 2.5], [2.6, 5.5], [1.2, 7.5], [1.3, 9], [0, 9]].map(([a, b]) => new THREE.Vector2(a, b));
  meshAt(new THREE.LatheGeometry(pts, 28), vase, w * 0.12, 0, 0, g);
  span(g, coverMat('linen', '#2b2724'), w * 0.26, w * 0.26 + 6, 0, 1.2, -2.5, 2.5, 0.2);          // stacked books lying flat
  span(g, coverMat('linen', '#c9bba5'), w * 0.26 + 0.4, w * 0.26 + 5.6, 1.2, 2.3, -2.2, 2.2, 0.2);
  meshAt(new THREE.SphereGeometry(1.4, 16, 12), metalFinish('brass'), w * 0.26 + 3, 3.7, 0, g);
  return { group: g, w, d: D, hv: 12, shadows: [] };
}
const sconceGlow = (color, emissive) => new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide, emissive, emissiveIntensity: 0 });
function makeSconce(p, item, s) {
  const g = new THREE.Group(), metal = metalFinish(s.metal || 'brass');
  let shadeMat, glow = 1, lightAt;
  meshAt(new THREE.CylinderGeometry(2.4, 2.4, 0.6, 32), metal, 0, 0, -2.7, g).rotation.x = Math.PI / 2;     // wall plate
  if (s.variant === 'globe') {
    strut(g, metal, [0, 0, -2.4], [0, 0, 2.2], 0.35);
    shadeMat = sconceGlow('#f4efe6', '#ffd9a8'); glow = 0.9;
    meshAt(new THREE.SphereGeometry(3.4, 28, 18), shadeMat, 0, 0.5, 3.4, g);
    lightAt = [0, 0.5, 3.4];
  } else if (s.variant === 'arm') {                                     // swing-arm reading sconce
    strut(g, metal, [0, 0, -2.4], [0, 0, 8], 0.3); strut(g, metal, [0, 0, 8], [0, -2, 10], 0.3);
    shadeMat = sconceGlow('#efe2cc', '#ffcf96');
    const sh = meshAt(new THREE.CylinderGeometry(2.2, 3.6, 4.5, 28, 1, true), shadeMat, 0, -3.8, 10, g);
    lightAt = [0, -4.5, 10];
  } else {                                                              // up/down cone
    shadeMat = sconceGlow('#2b2724', '#ffcf96'); glow = 0.6;
    meshAt(new THREE.CylinderGeometry(1.8, 1.8, 9, 28), metal, 0, 0, 0.2, g);
    meshAt(new THREE.CylinderGeometry(1.5, 1.5, 9.1, 28, 1, true), shadeMat, 0, 0, 0.2, g);
    lightAt = [0, 0, 2.5];
  }
  const light = new THREE.PointLight('#ffc78a', 0, 0, 2); light.position.set(...lightAt); g.add(light);
  FX.lamps = FX.lamps || {}; FX.lamps[item.id] = { light, shadeMat, glow };
  const d = s.variant === 'arm' ? 16 : s.variant === 'globe' ? 9 : 6;
  // re-centre so the back plate sits at z = -d/2
  g.children.forEach((c) => { c.position.z += -d / 2 + 3; });
  return { group: g, w: 8, d, hv: 9, shadows: [] };
}
function makeAcousticPanel(p, item, s) {
  const g = new THREE.Group(), w = p.w, hh = p.hgt;
  if (s.variant === 'slat') {                                          // wood slats on black felt
    const D = 0.9;
    span(g, coverMat('weave', '#1c1b1a'), -w / 2, w / 2, -hh / 2, hh / 2, -0.8, -0.8 + 0.5, 0.05);
    const wood = woodFinish(s.wood || 'walnut'), n = Math.max(2, Math.floor(w / 1.8));
    const list = []; for (let i = 0; i < n; i++) list.push([-w / 2 + (i + 0.5) * (w / n), 0, 0]);
    instances(g, rbox(w / n * 0.62, hh, D, 0.15), wood, list);
    return { group: g, w, d: 2.2, hv: hh, shadows: [] };
  }
  span(g, coverMat(s.cover, s.color), -w / 2, w / 2, -hh / 2, hh / 2, -1, 1, 0.8);
  return { group: g, w, d: 2, hv: hh, shadows: [] };
}

Object.assign(CATALOG, {
  frame: {
    label: 'Picture frame', note: 'Art, photo or film poster', wall: true,
    defaults: { w: 24, hgt: 32, h: 57, art: 'abstract', mat: 'on' },
    params: [['w', 'Width', 8, 72], ['hgt', 'Height', 8, 72], ['h', 'Centre height', 12, 96]],
    options: [['art', 'Art', Object.entries(ART)], ['mat', 'Mat', [['on', 'White mat'], ['off', 'No mat']]]],
  },
  gallery: {
    label: 'Gallery wall', note: '3, 5 or 6 frames, ready arranged', wall: true,
    defaults: { count: '5', h: 57, art: 'mixed' },
    params: [['h', 'Centre height', 24, 90]],
    options: [['count', 'Frames', [['3', '3'], ['5', '5'], ['6', '6 (grid)']]], ['art', 'Art', [['mixed', 'Mixed'], ...Object.entries(ART)]]],
  },
  mirror: {
    label: 'Mirror', note: 'Round, arch or rectangle', wall: true,
    defaults: { w: 30, hgt: 44, h: 60 },
    params: [['w', 'Width', 16, 48], ['hgt', 'Height (arch, rectangle)', 20, 76], ['h', 'Centre height', 24, 90]],
  },
  shelf: {
    label: 'Wall shelf', note: 'Styled floating shelf or picture ledge', wall: true,
    defaults: { w: 36, h: 54 }, params: [['w', 'Length', 18, 84], ['h', 'Height', 20, 90]],
  },
  sconce: {
    label: 'Wall sconce', note: 'Globe, swing-arm or cone; dims with the lamps', wall: true,
    defaults: { h: 64 }, params: [['h', 'Height', 40, 84]],
  },
  acousticPanel: {
    label: 'Acoustic panel', note: 'Fabric or wood-slat panel: tames echo', wall: true,
    defaults: { w: 24, hgt: 48, h: 54 },
    params: [['w', 'Width', 12, 48], ['hgt', 'Height', 12, 96], ['h', 'Centre height', 12, 90]],
  },
});
Object.assign(FACTORIES, { frame: makeFrame, gallery: makeGallery, mirror: makeMirror, shelf: makeShelf, sconce: makeSconce, acousticPanel: makeAcousticPanel });
const DECOR_TYPES = ['frame', 'gallery', 'mirror', 'shelf', 'sconce', 'acousticPanel'];
const isWallType = (type) => !!(CATALOG[type] && CATALOG[type].wall);
