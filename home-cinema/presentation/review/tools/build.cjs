// Composes the printed design review (17 × 11 in landscape) as one HTML document; print.cjs prints it with Chromium.
// Usage: IMG_DIR=<print|screen image set> node build.cjs out.html  (renders and data come from $REVIEW_WORK/renders)
const fs = require('fs'), path = require('path');
const WORK = process.env.REVIEW_WORK || path.resolve(__dirname, '../.work');
const IMG = process.env.IMG_DIR || path.join(WORK, 'print');
const FONTS = process.env.FONTS_DIR || path.join(WORK, 'vendor/cormorant/package/files');
const OUT = process.argv[2] || path.join(WORK, 'review.html');
const DATA = path.join(WORK, 'renders');
const study = JSON.parse(fs.readFileSync(path.join(DATA, 'study.json'), 'utf8'));
const plan = JSON.parse(fs.readFileSync(path.join(DATA, 'plan-data.json'), 'utf8'));
const extra = JSON.parse(fs.readFileSync(path.join(DATA, 'extra.json'), 'utf8'));

// ---------------------------------------------------------------- helpers
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function ftin(v) {
  let inches = Math.round(Math.abs(v) * 2) / 2, ft = Math.floor(inches / 12), rem = inches - ft * 12;
  const whole = Math.floor(rem), half = rem - whole >= 0.5 ? '½' : '';
  return `${ft}′-${whole}${half}″`;
}
const money = (v) => (v >= 10000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v).toLocaleString('en-CA')}`);
const moneyFull = (v) => `$${Math.round(v).toLocaleString('en-CA')}`;
const moneyK = (v) => `$${(Math.round(v / 100) / 10).toFixed(1)}k`;
const range = (r) => (r ? `${moneyFull(r[0])}–${moneyFull(r[1])}` : '—');
const PLAN_EXT = process.env.PLAN_EXT || 'jpg';
const url = (f) => 'file://' + path.join(IMG, f.replace(/\.png$/, '.' + PLAN_EXT));
const img = (name, pos = 'center') => `<img src="${url(name.includes('.') ? name : name + '.jpg')}" style="object-position:${pos}" alt="">`;
const fig = (name, cap = '', { cls = '', style = '', pos = 'center' } = {}) =>
  `<figure class="fig ${cls}" style="${style}"><div class="ph">${img(name, pos)}</div>${cap ? `<figcaption class="cap">${cap}</figcaption>` : ''}</figure>`;
const capt = (code, text) => `<b>${esc(code)}</b>${text}`;
const chips = (colors, cls = '') => `<span class="chips ${cls}">${colors.map((c) => `<i style="background:${c}"></i>`).join('')}</span>`;

// ---------------------------------------------------------------- data
const SCENES = {
  work: { label: 'Bright', pots: '100%', leds: '40%', fire: '—', lamp: '—', bias: '—', steps: '—', screen: 'Up', use: 'Cleaning, games tables, homework' },
  evening: { label: 'Evening', pots: '35%', leds: '100%', fire: 'On', lamp: 'On', bias: '—', steps: 'On', screen: 'Up', use: 'Arrival, conversation, the default' },
  fireside: { label: 'Fireside', pots: '8%', leds: '70%', fire: 'On', lamp: 'On', bias: '—', steps: 'On', screen: 'Up', use: 'A drink by the fire, music' },
  game: { label: 'Game night', pots: '25%', leds: '80%', fire: 'On', lamp: 'On', bias: '6500K', steps: 'On', screen: 'Up', use: 'Sport, games, the TV with friends' },
  movie: { label: 'Movie', pots: '0%', leds: '18%', fire: '—', lamp: '—', bias: '6500K', steps: 'On', screen: 'Down', use: 'Films on the 110″ screen' },
};
const ORDER = ['warm-modern', 'mid-century', 'japandi', 'industrial', 'luxe', 'theater', 'cinema-edit'];
const byId = Object.fromEntries(study.sets.map((s) => [s.id, s]));
const mix = study.mix;
const COLL = ORDER.map((id, i) => {
  const base = id === 'cinema-edit'
    ? {
      id, name: 'Cinema Edit', fullName: 'Warm Modern · Cinema Edit', tagline: 'Our recommendation: Warm Modern re-covered for the screen — pewter performance weave, oatmeal swivels, a charcoal rug.',
      palette: ['#5f5a54', '#cdbfa8', '#3d3833', '#3b281b', '#5b4636', '#b48a52'], fit: 5,
      fitNote: 'Keeps everything that made Warm Modern the best fit for the room — walnut, brass, warm neutrals — and darkens the surfaces the screen sees.',
      pros: ['Highest balanced score of the seven', 'Darker sectional and rug keep the picture punchy', 'Performance fabric on every seat used daily', 'Swivel chairs turn from the fire to the screen'],
      cons: ['Pewter reads cooler than taupe: keep walnut and brass close by', 'Bouclé poufs still want gentle care', 'The sectional sets the pace: about 13 weeks'],
      ...mix,
    }
    : { ...byId[id], fullName: byId[id].name };
  return { ...base, no: String(i + 1).padStart(2, '0') };
});
const C = Object.fromEntries(COLL.map((c) => [c.id, c]));
const STYLING = {
  'warm-modern': 'Layer oatmeal and rust cushions and a chunky wool throw on the sectional; keep brass for the bar cart and the lamp. Accessories low and few — the slat wall is the pattern.',
  'mid-century': 'A teak tray on the ottoman, amber glass on the bar cart, one framed abstract print. Let the geometric rug be the only bold pattern in the room.',
  japandi: 'Edit hard: stoneware, a single branch in a vase, sand-coloured linen throws. Ceramic rather than glass on the bar cart; the paper lantern should be the only light you notice.',
  industrial: 'A kilim cushion or two, black-framed photography, warm amber bulbs at the bar. Keep every metal matte — no chrome next to the walnut.',
  luxe: 'Velvet cushions in camel and oxblood, a marble tray, smoked-glass decanters on the bar cart. Brass in small doses; nothing silver.',
  theater: 'Keep it dark and quiet: graphite throws, framed film posters, nothing glossy facing the screen. Warm amber light at the bar stops it feeling like a cinema hall.',
  'cinema-edit': 'Pewter and oatmeal want warmth: rust and camel cushions, a chunky wool throw, walnut and brass at the bar. Keep the charcoal rug plain so the screen stays the focus.',
};
const REC = C['cinema-edit'];
const CRIT = study.criteria;
const PRESETS = Object.keys(study.presets);
const rankBy = (k) => [...COLL].sort((a, b) => b.totals[k] - a.totals[k]);
const finishText = (spec) => spec.split(' · ').slice(1).join(' · ') || spec;
const itemName = (item) => { const [type, v] = item.split(': '); if (!v) return item; const last = type.split(' ').pop().toLowerCase(); return v.toLowerCase().includes(last) ? v : item; };

// room numbers used in the text
const R = plan.room, G = plan.geom;
const fp = plan.fireplace;
const slab = { w: fp.width + 30, h: Math.max(fp.bottom + fp.height + 8, R.transomBottom - 5) };
const tvWall = G.bay[3][0] - G.bay[2][0];
const stats = extra.tv, sstats = extra.screen;

// ---------------------------------------------------------------- page frame
const pages = [];
function page(id, section, body, { cls = '', head = true, foot = true } = {}) { pages.push({ id, section, body, cls, head, foot }); }
const pageNo = {};

// ---------------------------------------------------------------- plan figure (rendered plan + vector overlay)
function planSvg(imgName, { inches = 7.4, dims = true, tags = true, ffe = null, speakers = false, sight = false, north = true, scale = true } = {}) {
  const S = 374, x0 = 114 - 187, Y0 = -(53 + 187);
  const u = (pt) => pt / (inches * 72 / S);                 // points -> plan inches
  const o = [];
  o.push(`<image href="${url(imgName)}" x="${x0}" y="${Y0}" width="${S}" height="${S}" preserveAspectRatio="none"/>`);
  if (dims) {
    for (const e of plan.log.filter((l) => l.kind === 'dim')) {
      const [ax, ay] = e.a, [bx, by] = e.b, t = 2.4;
      o.push(`<line class="dl" x1="${ax}" y1="${-ay}" x2="${bx}" y2="${-by}"/>`);
      for (const [x, y] of [[ax, ay], [bx, by]]) o.push(`<line class="dt" x1="${x - t}" y1="${-y + t}" x2="${x + t}" y2="${-y - t}"/>`);
      const vx = ax + (bx - ax) * e.at, vy = ay + (by - ay) * e.at, vert = Math.abs(ax - bx) < 0.01;
      const txt = e.text.replace('  ', ' ').replace('→', 'to');
      o.push(`<text class="dtx" x="${vx}" y="${-vy}" font-size="${u(6.4)}" ${vert ? `transform="rotate(-90 ${vx} ${-vy})"` : ''} dy="${u(2.2)}">${esc(txt)}</text>`);
    }
    // the steel beam overhead
    o.push(`<line class="beam" x1="${R.beamX}" y1="0" x2="${R.beamX}" y2="${-(G.westY - R.pilasterD)}"/>`);
  }
  if (tags) {
    for (const e of plan.log.filter((l) => l.kind === 'tag')) {
      const txt = e.text.replace(' ↑', '').replace('Steel beam W200', 'Steel beam W200 over');
      o.push(`<text class="tg" x="${e.x}" y="${-e.y}" font-size="${u(5.6)}" letter-spacing="${u(1.1)}" ${e.rot ? `transform="rotate(${e.rot} ${e.x} ${-e.y})"` : ''} dy="${u(2)}">${esc(txt.toUpperCase())}</text>`);
    }
  }
  if (sight && stats) {
    const s = plan.seat, tv = [G.tvX, R.depth - 3];
    o.push(`<line class="sl" x1="${s.x}" y1="${-s.y}" x2="${tv[0]}" y2="${-tv[1]}"/>`);
    o.push(`<circle class="seat" cx="${s.x}" cy="${-s.y}" r="${u(3.2)}"/>`);
  }
  if (speakers) {
    const s = plan.seat;
    for (const k of plan.speakers) o.push(`<line class="spl" x1="${s.x}" y1="${-s.y}" x2="${k.p[0]}" y2="${-k.p[1]}"/>`);
    for (const k of plan.speakers) {
      o.push(`<circle class="spk${k.z >= R.ceiling ? ' up' : ''}" cx="${k.p[0]}" cy="${-k.p[1]}" r="${u(8.2)}"/>`);
      o.push(`<text class="spt" x="${k.p[0]}" y="${-k.p[1]}" font-size="${u(6.2)}" dy="${u(2.2)}">${k.k}</text>`);
    }
    o.push(`<circle class="seat" cx="${s.x}" cy="${-s.y}" r="${u(3.4)}"/>`);
  }
  if (ffe) {
    const at = (it) => {
      const p = it.p || {};
      if (it.type === 'rug') { const sw = it.rot % 180 === 90; const w = sw ? p.d : p.w, d = sw ? p.w : p.d; return [it.x - w / 2 + 12, it.y + d / 2 - 9]; }
      if (it.type === 'sectional') return [it.x - 20, it.y - 30];
      return [it.x, it.y];
    };
    for (const row of ffe) for (const id of row.ids) {
      const it = plan.items.find((i) => i.id === id); if (!it) continue;
      const [x, y] = at(it), w = u(25), h = u(10.5);
      o.push(`<g class="ffe"><rect x="${x - w / 2}" y="${-y - h / 2}" width="${w}" height="${h}" rx="${h / 2}"/><text x="${x}" y="${-y}" font-size="${u(5.8)}" dy="${u(2.05)}">${row.tag}</text></g>`);
    }
  }
  if (scale) {                                               // 0-2-4-8 ft bar, bottom left
    const X = -62, Y = -224, h = u(3.2);
    o.push(`<g class="scale"><rect x="${X}" y="${Y}" width="24" height="${h}" class="f"/><rect x="${X + 24}" y="${Y}" width="24" height="${h}"/><rect x="${X + 48}" y="${Y}" width="48" height="${h}" class="f"/>`);
    for (const [d, t] of [[0, '0'], [24, '2'], [48, '4'], [96, '8 ft']]) o.push(`<text x="${X + d}" y="${Y - u(3)}" font-size="${u(5.4)}">${t}</text>`);
    o.push('</g>');
  }
  if (north) {                                               // the exterior wall is the north wall
    const X = 284, Y = 112, L = u(26);
    o.push(`<g class="north"><circle cx="${X}" cy="${Y}" r="${u(15)}"/><path d="M ${X - L * 0.42} ${Y} L ${X + L * 0.5} ${Y} M ${X + L * 0.5} ${Y} L ${X + L * 0.18} ${Y - L * 0.2} M ${X + L * 0.5} ${Y} L ${X + L * 0.18} ${Y + L * 0.2}"/><text x="${X}" y="${Y - u(19)}" font-size="${u(6.6)}">N</text></g>`);
  }
  return `<svg class="plan" viewBox="${x0} ${Y0} ${S} ${S}" xmlns="http://www.w3.org/2000/svg">${o.join('')}</svg>`;
}

// ---------------------------------------------------------------- fireplace wall elevation (line drawing, inches)
function elevSvg(k) {
  const W = G.westY, H = R.beamBottom, c = fp.center, Y = (v) => H - v;
  const win = [-1, 1].map((sgn) => { const a = c + sgn * (R.transomGap / 2), b = c + sgn * (R.transomGap / 2 + R.transomW); return [Math.min(a, b), Math.max(a, b)]; });
  const fb = { u0: c - fp.width / 2, u1: c + fp.width / 2, v0: fp.bottom, v1: fp.bottom + fp.height };
  const sl = { u0: fb.u0 - 15, u1: fb.u1 + 15, v1: slab.h };
  const hole = k === 'A' ? { u0: sl.u0, u1: sl.u1, v0: 0, v1: sl.v1 } : { u0: fb.u0 - 1.5, u1: fb.u1 + 1.5, v0: fb.v0 - 1.5, v1: fb.v1 + 1.5 };
  const o = [];
  // LED band behind the window slats, and the two windows (dashed: behind the slats)
  o.push(`<rect class="glow" x="10" y="${Y(R.transomBottom + R.transomH + 1)}" width="${W - 20}" height="${R.transomH + 2}"/>`);
  for (const [a, b] of win) o.push(`<rect class="win" x="${a}" y="${Y(R.transomBottom + R.transomH)}" width="${b - a}" height="${R.transomH}"/>`);
  // slats: every 2.4″, broken by the slab (A) or the firebox reveal (B)
  for (let u = 2.6; u < W - 1.5; u += 2.4) {
    if (u > hole.u0 && u < hole.u1) {
      if (hole.v1 < H) o.push(`<line class="slat" x1="${u}" y1="0" x2="${u}" y2="${Y(hole.v1)}"/>`);
      if (hole.v0 > 0) o.push(`<line class="slat" x1="${u}" y1="${Y(hole.v0)}" x2="${u}" y2="${H}"/>`);
    } else o.push(`<line class="slat" x1="${u}" y1="0" x2="${u}" y2="${H}"/>`);
  }
  if (k === 'A') o.push(`<rect class="slab" x="${sl.u0}" y="${Y(sl.v1)}" width="${sl.u1 - sl.u0}" height="${sl.v1}"/>`);
  o.push(`<rect class="fb" x="${fb.u0}" y="${Y(fb.v1)}" width="${fp.width}" height="${fp.height}"/><rect class="flame" x="${fb.u0 + 3}" y="${Y(fb.v0 + 6)}" width="${fp.width - 6}" height="4" rx="2"/>`);
  // walls, floor and bulkhead
  o.push(`<rect class="wall" x="0" y="0" width="${W}" height="${H}"/><line class="floor" x1="-6" y1="${H}" x2="${W + 6}" y2="${H}"/>`);
  // dimensions
  const dim = (x1, y1, x2, y2, t, side = 1) => {
    const vert = x1 === x2, tx = (x1 + x2) / 2, ty = (y1 + y2) / 2, tk = 1.6;
    return `<line class="d" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>` + [[x1, y1], [x2, y2]].map(([x, y]) => `<line class="dk" x1="${x - tk}" y1="${y + tk}" x2="${x + tk}" y2="${y - tk}"/>`).join('')
      + `<text class="dt" x="${tx}" y="${ty}" ${vert ? `transform="rotate(-90 ${tx} ${ty})"` : ''} dy="1.4">${esc(t)}</text>`;
  };
  o.push(dim(0, -7, W, -7, `${ftin(W)} wall`));
  o.push(dim(W + 7, 0, W + 7, H, `${ftin(H)} to bulkhead`));
  o.push(dim(-7, Y(R.transomBottom), -7, H, `sill ${ftin(R.transomBottom)}`));
  o.push(dim(win[0][0], Y(R.transomBottom + R.transomH) - 4, win[0][1], Y(R.transomBottom + R.transomH) - 4, `${R.transomW}″`));
  o.push(dim(win[1][0], Y(R.transomBottom + R.transomH) - 4, win[1][1], Y(R.transomBottom + R.transomH) - 4, `${R.transomW}″`));
  if (k === 'A') o.push(dim(sl.u0, H + 7, sl.u1, H + 7, `slab ${slab.w}″ × ${slab.h}″`));
  else o.push(dim(fb.u0, H + 7, fb.u1, H + 7, `firebox ${fp.width}″ × ${fp.height}″`));
  o.push(`<text class="lb" x="${W / 2}" y="${Y(R.transomBottom + R.transomH / 2)}" dy="1.2">LED BAND BEHIND THE SLATS</text>`);
  return `<svg class="elev" viewBox="-20 -16 ${W + 40} ${H + 32}" xmlns="http://www.w3.org/2000/svg">${o.join('')}</svg>`;
}

// ---------------------------------------------------------------- charts
function scoreBars(c, { w = 3.3 } = {}) {
  return `<div class="bars">${CRIT.map((k) => {
    const v = c.eval.scores[k.key];
    return `<div class="bar"><span class="bl">${esc(k.label)}</span><span class="bt"><i style="width:${(v / 5) * 100}%"></i></span><span class="bv">${v.toFixed(1)}</span></div>`;
  }).join('')}</div>`;
}
function heat(v) {                                          // 1..5 -> warm sequential ramp
  const t = Math.max(0, Math.min(1, (v - 1) / 4));
  const a = [241, 235, 225], b = [120, 88, 52];
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * Math.pow(t, 1.1)));
  return { bg: `rgb(${c.join(',')})`, fg: t > 0.55 ? '#f6f1e8' : '#2c251e' };
}
function budgetChart() {
  const W = 9.6 * 72, rowH = 46, top = 30, left = 150, right = 80, H = top + COLL.length * rowH + 30;
  const lo = 8000, hi = 28000, X = (v) => left + ((v - lo) / (hi - lo)) * (W - left - right);
  const rows = [...COLL].sort((a, b) => (a.eval.lo + a.eval.hi) - (b.eval.lo + b.eval.hi));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  for (let v = 8000; v <= 28000; v += 4000) s += `<line class="grid" x1="${X(v)}" y1="${top - 8}" x2="${X(v)}" y2="${H - 26}"/><text class="ax" x="${X(v)}" y="${H - 10}">$${v / 1000}k</text>`;
  rows.forEach((c, i) => {
    const y = top + i * rowH + rowH / 2, m = (c.eval.lo + c.eval.hi) / 2, rec = c.id === 'cinema-edit';
    s += `<text class="rl${rec ? ' rec' : ''}" x="${left - 14}" y="${y + 4}">${esc(c.name)}</text>`;
    s += `<rect class="rg${rec ? ' rec' : ''}" x="${X(c.eval.lo)}" y="${y - 8}" width="${X(c.eval.hi) - X(c.eval.lo)}" height="16" rx="8"/>`;
    s += `<circle class="mid" cx="${X(m)}" cy="${y}" r="3.4"/>`;
    s += `<text class="rv" x="${X(c.eval.hi) + 10}" y="${y + 4}">${moneyK(c.eval.lo)}–${moneyK(c.eval.hi)}</text>`;
  });
  return s + '</svg>';
}
function leadChart() {
  const W = 4.6 * 72, rowH = 46, top = 30, left = 18, right = 40, H = top + COLL.length * rowH + 30, max = 18;
  const X = (v) => left + (v / max) * (W - left - right);
  const rows = [...COLL].sort((a, b) => (a.eval.lo + a.eval.hi) - (b.eval.lo + b.eval.hi));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  for (let v = 0; v <= max; v += 6) s += `<line class="grid" x1="${X(v)}" y1="${top - 8}" x2="${X(v)}" y2="${H - 26}"/><text class="ax" x="${X(v)}" y="${H - 10}">${v} wk</text>`;
  rows.forEach((c, i) => {
    const y = top + i * rowH + rowH / 2, rec = c.id === 'cinema-edit';
    s += `<rect class="lb${rec ? ' rec' : ''}" x="${X(0)}" y="${y - 8}" width="${X(c.eval.weeks) - X(0)}" height="16" rx="2"/>`;
    s += `<text class="rv" x="${X(c.eval.weeks) + 8}" y="${y + 4}">${c.eval.weeks}</text>`;
  });
  return s + '</svg>';
}
function gantt() {
  const W = 15.4 * 72, left = 250, right = 20, top = 36, rowH = 48, weeks = 18;
  const tasks = [
    ['Decide', 'Fireplace option, collection, screen', 0, 1, 'k'],
    ['Samples & quotes', 'Swatches under 2700K and with the TV on; trade quotes', 1, 3, 'k'],
    ['Order furniture', 'Sectional first: it is the long lead', 3, 3.4, 'o'],
    ['Furniture lead time', `Longest piece about ${REC.eval.weeks} weeks`, 3.4, 3.4 + REC.eval.weeks, 'w'],
    ['Electrical & AV rough-in', 'Speaker pre-wire, LED drivers, keypad, screen power', 3, 6, 'k'],
    ['Slat walls & slab', 'Fabricate and install; slab templated on site (Option A)', 6, 9.5, 'k'],
    ['Screen, projector & TV', 'Hang, align, calibrate; program the five scenes', 9.5, 10.5, 'k'],
    ['Deliver & style', 'Furniture in, rugs down, lamps and art', 3.4 + REC.eval.weeks, 3.4 + REC.eval.weeks + 1, 'o'],
  ];
  const H = top + tasks.length * rowH + 12, X = (w) => left + (w / weeks) * (W - left - right);
  let s = `<svg class="chart gantt" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  for (let w = 0; w <= weeks; w += 1) s += `<line class="${w % 2 ? 'grid2' : 'grid'}" x1="${X(w)}" y1="${top - 6}" x2="${X(w)}" y2="${H - 6}"/>${w % 2 ? '' : `<text class="ax" x="${X(w)}" y="${top - 14}">wk ${w}</text>`}`;
  tasks.forEach(([t, d, a, b, k], i) => {
    const y = top + i * rowH;
    s += `<text class="tl" x="0" y="${y + 16}">${esc(t)}</text><text class="td" x="0" y="${y + 30}">${esc(d)}</text>`;
    s += `<rect class="gb ${k}" x="${X(a)}" y="${y + 9}" width="${Math.max(6, X(b) - X(a))}" height="18" rx="3"/>`;
  });
  return s + '</svg>';
}

// ================================================================ PAGES
// ---- cover
page('cover', '', `
  <div class="cover">
    ${img('cinema-edit-room-evening', '40% 50%')}
    <div class="shade"></div>
    <div class="ctop"><span class="mono">BC</span><span>Design Review No. 02</span><span>October 2026</span></div>
    <div class="cblock">
      <div class="kicker light">Furniture · Finishes · Light</div>
      <h1>The Basement<br>Cinema</h1>
      <p class="sub">A screening room and fireside lounge, studied in seven collections and five lighting scenes.</p>
      <div class="cmeta"><span>Lower level · ${ftin(R.width)} × ${ftin(R.depth)}</span><span>Prepared for the homeowner</span></div>
    </div>
  </div>`, { cls: 'dark', head: false, foot: false });

// ---- contents
page('contents', 'Contents', `
  <div class="contents">
    <div class="cl">
      <div class="kicker">Contents</div>
      <h2 class="title">What is in<br>this review</h2>
      <p class="stand">We studied the room as measured, solved the two walls that were working against it, and dressed it seven ways — so the choice in front of you is a confident one.</p>
      <div class="cstrip">${['arch-fireEl-A-evening', 'luxe-fire-fireside', 'arch-seat-movie'].map((n) => `<div class="ph">${img(n)}</div>`).join('')}</div>
    </div>
    <div class="toc">
      <div class="tcol">
        <div class="tg"><span class="tn">—</span><div><b>Introduction</b><a data-p="glance">At a glance</a><a data-p="room">The room as measured</a><a data-p="principles">Principles &amp; materials</a></div></div>
        <div class="tg"><span class="tn">I</span><div><b>Architecture &amp; light</b><a data-p="diagnosis">The fireplace wall</a><a data-p="optA">Option A · Slats + stone slab</a><a data-p="optB">Option B · Slats only</a><a data-p="avsb">A or B</a><a data-p="tvwall">The TV wall</a><a data-p="screen">The screen</a><a data-p="light">Five lighting scenes</a><a data-p="sound">Sound</a></div></div>
      </div>
      <div class="tcol">
        <div class="tg"><span class="tn">II</span><div><b>Seven collections</b><a data-p="overview">The collections at a glance</a>${COLL.map((c) => `<a data-p="c-${c.id}">${c.no} · ${esc(c.fullName)}</a>`).join('')}</div></div>
        <div class="tg"><span class="tn">III</span><div><b>Evaluation &amp; recommendation</b><a data-p="sbs1">Side by side</a><a data-p="scorecard">Scorecard</a><a data-p="budget">Budget &amp; lead time</a><a data-p="rec">Our recommendation</a><a data-p="ffe">FF&amp;E schedule</a><a data-p="quotes">Scope for trade quotes</a><a data-p="next">Next steps</a><a data-p="appA">Appendix · Method &amp; upholstery</a></div></div>
      </div>
    </div>
  </div>`);

// ---- at a glance
page('glance', 'At a glance', `
  <div class="glance">
    <div class="gl">
      <div class="kicker">At a glance</div>
      <h2 class="title">A cinema that is also<br>the best room for<br>an evening in.</h2>
      <div class="moves">
        <div><span class="mn">1</span><h4>Close the face</h4><p>Walnut slats run straight across the two windows over the fireplace, lit from behind by one warm LED band. The openings stop reading as eyes; light still glows through the gaps.</p></div>
        <div><span class="mn">2</span><h4>Frame the fire</h4><p>A floor-to-window stone slab (Option A) makes the fireplace the room’s one feature. Option B runs the slats to the firebox for a quieter, lower-cost wall.</p></div>
        <div><span class="mn">3</span><h4>Let the alcove disappear</h4><p>Walnut slats behind the ${plan.tv.size}″ TV, a ${plan.tv.screenSize}″ drop-down screen in the bulkhead, and a 6500K bias light that only comes on with the picture.</p></div>
      </div>
      <div class="nums">
        <div><b>7</b><span>collections<br>studied</span></div>
        <div><b>5</b><span>lighting<br>scenes</span></div>
        <div><b>${Math.round(sstats.hAngle)}°</b><span>of view on the<br>${plan.tv.screenSize}″ screen</span></div>
        <div><b>5.1.2</b><span>sound,<br>pre-wired</span></div>
      </div>
    </div>
    <div class="gr">
      <div class="ph big">${img('cinema-edit-fire-fireside')}</div>
      <div class="recbox">
        <div class="kicker">Recommended collection</div>
        <h3>${esc(REC.fullName)}</h3>
        <div class="kpis">
          <div><b>${REC.totals.Balanced}</b><span>score of 100<br>balanced priorities</span></div>
          <div><b>${moneyK(REC.eval.lo)}–${moneyK(REC.eval.hi)}</b><span>indicative furniture<br>budget, CAD</span></div>
          <div><b>${REC.eval.weeks} wk</b><span>longest lead time<br>(the sectional)</span></div>
        </div>
      </div>
      <div class="decide">
        <div class="kicker">Decisions we need from you</div>
        <ol><li>Fireplace wall: <b>Option A</b> (stone slab) or <b>Option B</b> (slats only).</li><li>Collection: the <b>Cinema Edit</b>, or one of the six alternates.</li><li>Approve samples: pewter weave, oatmeal linen-look, charcoal rug, slab.</li><li>Book the trades: electrician, millwork, slab fabricator, AV.</li></ol>
      </div>
    </div>
  </div>`);

// ---- the room as measured
const measures = [
  ['Fireplace wall to exterior wall', ftin(R.width)],
  ['Stair-side line to TV wall', ftin(R.depth)],
  ['… to the alcove notch, exterior side', ftin(G.mainY)],
  ['Fireplace wall length', ftin(G.westY)],
  ['… to the face of the steel-beam bump', ftin(G.westY - R.pilasterD)],
  ['Fireplace nook', ftin(R.boxX)],
  ['Landing at the foot of the stairs', ftin(R.stairStart - R.boxX)],
  ['Tip of the stairs to the exterior wall', ftin(R.width - R.stairStart + 2)],
  ['TV alcove, wide · TV wall', `${ftin(R.bayRight - R.bayLeft)} · ${ftin(tvWall)}`],
  ['Alcove bulkhead · lounge bulkhead (W200 beam)', `${ftin(R.soffitBottom)} · ${ftin(R.beamBottom)}`],
  ['Ceiling', ftin(R.ceiling)],
  ['Windows over the fireplace (already cut)', `2 × ${R.transomW}″ × ${R.transomH}″, sill ${ftin(R.transomBottom)}`],
];
page('room', 'The room as measured', `
  <div class="roomp">
    <div class="rl">${planSvg('plan-cinema-edit.png', { inches: 9.15 })}</div>
    <div class="rr">
      <div class="kicker">The room as measured</div>
      <h2 class="title">Nineteen feet of<br>room, two moods</h2>
      <p class="stand">A cinema facing the TV alcove and a lounge facing the fire share one ${ftin(R.width)} room. Everything here is drawn from your measurements.</p>
      <table class="mt">${measures.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table>
      <div class="notes">
        <p><b>Givens.</b> The two windows over the fireplace are already cut and stay. The W200 steel beam over the lounge sets a ${ftin(R.beamBottom)} bulkhead; the alcove bulkhead sits at ${ftin(R.soffitBottom)}.</p>
        <p><b>Circulation.</b> The stairs land into the room. Between the lounge chairs and the end of the sectional the layout keeps 30½″ to 34″ clear, depending on the chairs (34″ with the Cinema Edit swivels).</p>
      </div>
    </div>
  </div>`);

// ---- principles & materials
const MATS = [
  ['Walnut slats', 'Fireplace and TV walls, on black felt', 'linear-gradient(90deg,#2b1c12 0 18%,#4a3222 18% 32%,#120c08 32% 36%,#3b281b 36% 52%,#5b3e29 52% 66%,#120c08 66% 70%,#3e2a1c 70% 86%,#2b1c12 86%)'],
  ['Black stone slab', 'Honed, floor to windows (Option A)', 'radial-gradient(120% 60% at 30% 30%, #2b2825 0%, #161412 60%), #161412'],
  ['Pewter weave', 'Sectional · performance, 100k rubs', '#5f5a54'],
  ['Oatmeal linen-look', 'Swivel chairs · performance', '#cdbfa8'],
  ['Charcoal wool', 'Cinema rug, tonal weave', '#3d3833'],
  ['Chestnut leather', 'Block ottoman', '#5b4636'],
  ['Satin brass', 'Lamp, bar cart, details', 'linear-gradient(135deg,#8c6a3c,#c9a46a 45%,#9b7745)'],
  ['Warm white walls', 'Matte, with 2700K light', '#cbc2b3'],
];
page('principles', 'Principles & materials', `
  <div class="princ">
    <div class="pl">
      <div class="kicker">Design principles</div>
      <h2 class="title">Four rules<br>for the room</h2>
      <div class="rules">
        <div><span>01</span><h4>One warm material story</h4><p>Walnut, warm stone, wool and linen, a little brass. Every light source is 2700K except the screen’s own bias light.</p></div>
        <div><span>02</span><h4>Dark where the screen looks</h4><p>What faces the screen goes darker and matte — sectional, rug, console — so films keep their blacks and the room doesn’t glow back at the picture.</p></div>
        <div><span>03</span><h4>Two rooms in one</h4><p>A cinema that faces the alcove and a lounge that faces the fire. Swivel chairs turn between them; five lighting scenes switch the mood.</p></div>
        <div><span>04</span><h4>Calm the walls</h4><p>The fireplace wall and the TV wall each become one composed surface in the same walnut, instead of a collection of openings.</p></div>
      </div>
      <blockquote class="pull">The room should feel finished with the screen off — and disappear around the picture when it is on.</blockquote>
    </div>
    <div class="pr">
      <div class="matgrid">${MATS.map(([n, d, bg]) => `<div class="mat"><div class="sw" style="background:${bg}"></div><b>${esc(n)}</b><span>${esc(d)}</span></div>`).join('')}</div>
      <div class="details">${[['detail-slats', 'Backlit slats across the windows'], ['detail-slab', 'Honed slab around the fire'], ['detail-seat', 'Pewter weave and oatmeal swivels']].map(([n, c]) => fig(n, c)).join('')}</div>
    </div>
  </div>`);

// ---- Part I
page('part1', 'Architecture & light', `
  <div class="divider">${img('arch-fireEl-A-evening', '50% 45%')}<div class="shade"></div>
    <div class="dblock"><span class="roman">I</span><div><div class="kicker light">Part one</div><h2>Architecture<br>&amp; light</h2><p>Two walls, one screen and five lighting scenes: the moves that make the room work before a single piece of furniture arrives.</p></div></div></div>`, { cls: 'dark', head: false, foot: false });

page('diagnosis', 'I · Architecture & light', `
  <div class="diag">
    <div class="dtext">
      <div class="kicker">01 · The fireplace wall</div>
      <h2 class="title">Two eyes<br>and a mouth</h2>
      <p class="stand">Two equal windows centred over a wide, low fire read as a face. Because the windows are already cut, the fix is not to move them but to stop them reading as openings.</p>
      <p>Running the walnut slats straight across both windows, with one warm LED band behind them, turns two dark rectangles into a single lit stripe inside the slat wall. The glass stays; from the room you see a glow through the gaps, not two holes.</p>
      <p>With the face gone, the question becomes how to frame the fire itself — with a stone slab (Option A) or with the slats alone (Option B).</p>
      <table class="mt givens">
        <tr><td>Windows over the fireplace</td><td>2 × ${R.transomW}″ × ${R.transomH}″</td></tr>
        <tr><td>Between the windows · sill</td><td>${R.transomGap}″ · ${ftin(R.transomBottom)}</td></tr>
        <tr><td>Fireplace opening · bottom</td><td>${fp.width}″ × ${fp.height}″ · ${ftin(fp.bottom)}</td></tr>
        <tr><td>Wall, length × height to bulkhead</td><td>${ftin(G.westY)} × ${ftin(R.beamBottom)}</td></tr>
      </table>
    </div>
    <div class="dimgs">
      ${fig('arch-fireEl-asbuilt-evening', capt('As built', 'Painted wall, two windows, the fire.'))}
      ${fig('arch-fireEl-original-evening', capt('Original scheme', 'Slats around the windows: the face is framed, not fixed.'))}
      ${fig('arch-fireEl-A-evening', capt('Proposed', 'Slats run across both windows; one lit band.'), { cls: 'wide' })}
    </div>
  </div>`);

function optionPage(id, k, title, lead, bullets, pros, cons, bright) {
  page(id, 'I · Architecture & light', `
  <div class="opt">
    <div class="ohero">${fig(`arch-fireEl-${k}-evening`, capt(`${k}1`, 'Evening scene: fire on, LED band at full, pots at 35%.'))}</div>
    <div class="oside">
      <div class="kicker">Option ${k}</div>
      <h2 class="title">${title}</h2>
      <p class="stand">${lead}</p>
      <ul class="spec">${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>
      <div class="pc"><div><b>Why</b><ul>${pros.map((p) => `<li>${p}</li>`).join('')}</ul></div><div><b>Watch</b><ul>${cons.map((p) => `<li>${p}</li>`).join('')}</ul></div></div>
      <div class="elevbox"><div class="kicker">Elevation · Option ${k}</div>${elevSvg(k)}</div>
    </div>
    <div class="orow">
      ${fig(`arch-fireEl-${k}-fireside`, capt(`${k}2`, 'Fireside: the band and the fire carry the room.'))}
      ${fig(`arch-fireEl-${k}-work`, capt(`${k}3`, bright))}
      ${fig(`arch-fire-${k}-evening`, capt(`${k}4`, 'In context, from the bar corner.'))}
    </div>
  </div>`);
}
optionPage('optA', 'A', 'Slats across the<br>windows, stone slab',
  'A tall honed slab wraps the fire from the floor to just under the windows. The slats stop at its edges, so the wall reads as walnut, one stone panel, and a band of light.',
  [`Slab ${ftin(slab.w)} wide × ${ftin(slab.h)} high (${slab.w}″ × ${slab.h}″): 15″ past the firebox each side, floor to 5″ under the windows.`,
    'Black marble-look porcelain or natural stone, honed. A polished face would mirror the lamp and the TV.',
    `Fabrication: a standard 63″ × 126″ porcelain slab needs one seam here — book-match it on the fire’s centreline. A natural slab at least ${slab.h + 1}″ tall can do it in one piece.`,
    'Slats to the 7′-10″ bulkhead and across both windows, 2700K LED band behind the window section, vertical LED channels at both ends.',
    'Confirm the fireplace maker’s clearances to the walnut beside the slab before ordering.'],
  ['The fire becomes the one feature', 'Stone gives the eye a resting place between busy slats', 'The most “finished” wall of the two'],
  ['Highest cost and the longest path: template, fabricate, install', 'Heavy: confirm fixing to the wall and the floor', 'Must be decided before the slats are made'],
  'Bright: true colours of slab, slats and walls.');
optionPage('optB', 'B', 'Slats across the<br>windows, no slab',
  'The slats run continuously to a slim reveal around the firebox. The wall becomes one walnut surface with a band of light and a line of fire.',
  ['Slats run to a 1½″ reveal around the firebox; a black metal trim (most inserts offer one) finishes the opening.',
    'Same LED band across the windows and the same vertical channels at both ends as Option A.',
    'The full wall is one trade (millwork): simpler to coordinate, quicker to finish.',
    'Confirm the fireplace maker’s clearances to combustible trim; some inserts need a non-combustible strip around the opening.'],
  ['Quieter, all-timber wall', 'Lower cost and faster', 'The slat rhythm wraps the fire'],
  ['The firebox reads as a cut-out rather than a feature', 'Busier around the fire at eye level', 'Walnut close to the opening: clearances rule'],
  'Bright: true colours of the slats, the trim and the walls.');

page('avsb', 'I · Architecture & light', `
  <div class="avsb">
    <div class="ab-head"><div class="kicker">02 · Option A or Option B</div><h2 class="title">Same slats,<br>different fire</h2></div>
    <div class="ab-imgs">
      ${fig('arch-lounge-A-fireside', capt('A', 'Stone slab: the fire sits in one calm panel.'))}
      ${fig('arch-lounge-B-fireside', capt('B', 'Slats only: one continuous walnut wall.'))}
    </div>
    <div class="ab-table">
      <table class="cmp">
        <tr><th></th><th>Option A · Stone slab</th><th>Option B · Slats only</th></tr>
        <tr><td>The look</td><td>Hotel lounge: fire framed in stone</td><td>Quiet and warm: walnut throughout</td></tr>
        <tr><td>Trades</td><td>Millwork + slab fabricator</td><td>Millwork only</td></tr>
        <tr><td>Time on site</td><td>Longer: slab templated after the insert is in</td><td>Shorter</td></tr>
        <tr><td>Upkeep</td><td>Porcelain wipes clean; natural stone needs sealing once a year</td><td>Dust the slats</td></tr>
        <tr><td>Cost</td><td>Higher (slab and fabrication)</td><td>Lower</td></tr>
        <tr><td>Our view</td><td><b>Recommended</b> for a screening room and lounge</td><td>The right call if time or budget is tight</td></tr>
      </table>
      <p class="note">Decide before the slats are made: in A they stop at the slab; in B they run to the firebox. Either way, the window treatment is identical.</p>
    </div>
  </div>`);

page('tvwall', 'I · Architecture & light', `
  <div class="tvw">
    <div class="tvtext">
      <div class="kicker">03 · The TV wall</div>
      <h2 class="title">The alcove,<br>in walnut</h2>
      <p class="stand">Slats behind the TV carry the fireplace wall’s material into the alcove, so the two walls read as a pair and the TV sits in a warm, textured field instead of on a flat wall.</p>
      <ul class="spec">
        <li>Walnut slats on black felt across the ${ftin(tvWall)} TV wall, floor to the ${ftin(R.soffitBottom)} bulkhead (about ${Math.round((tvWall * R.soffitBottom) / 144)} sq ft).</li>
        <li>${plan.tv.size}″ TV centred at ${plan.tv.center}″; blocking and a cable chase behind the slats before they go up.</li>
        <li>6500K bias light behind the TV, on only with the picture (Game night and Movie).</li>
        <li>The bulkhead cove grazes the slats from above; there are no downlights in the alcove, so it drops back into shadow when the TV is off and the fire leads.</li>
      </ul>
      ${fig('arch-tvEl-after-evening', capt('TV off', 'Evening: the alcove recedes; the cove draws a line of light.'), { cls: 'tvoff' })}
    </div>
    <div class="tvimgs">
      ${fig('arch-tvEl-before-game', capt('Before', 'A flat painted wall: the bias light is all that holds the TV.'))}
      ${fig('arch-tvEl-after-game', capt('After', 'Walnut slats: the picture floats in a warm, ribbed field.'))}
      ${fig('detail-tv-before', capt('Detail · before', 'Light falls flat on paint.'))}
      ${fig('detail-tv-after', capt('Detail · after', 'The cove and the bias light rake across every slat.'))}
    </div>
  </div>`);

page('screen', 'I · Architecture & light', `
  <div class="scr">
    <div class="simgs">
      ${fig('arch-seat-movie', capt('Movie', `The ${plan.tv.screenSize}″ screen drops from the bulkhead, ${9}″ in front of the TV.`))}
      ${fig('arch-seat-game', capt('Game night', `The ${plan.tv.size}″ TV with its bias light, screen rolled up.`))}
    </div>
    <div class="stext">
      <div class="kicker">04 · The screen</div>
      <h2 class="title">From the best seat</h2>
      <div class="kpis vert">
        <div><b>${ftin(stats.dist)}</b><span>from the prime seat on the sectional to the TV</span></div>
        <div><b>${Math.round(stats.hAngle)}°</b><span>of view filled by the ${plan.tv.size}″ TV — right for sport and games</span></div>
        <div><b>${Math.round(sstats.hAngle)}°</b><span>filled by the ${plan.tv.screenSize}″ screen — in the 30–40° range cinema standards aim for</span></div>
      </div>
      <p>The TV stays the everyday screen; the drop-down screen and a ceiling projector make Movie night an event. Both sit centred on the prime seat, so nobody watches at an angle.</p>
    </div>
  </div>`);

page('light', 'I · Architecture & light', `
  <div class="lightp">
    <div class="lhead"><div class="kicker">05 · Five lighting scenes</div><h2 class="title">One room, five moods</h2><p class="stand">One keypad at the foot of the stairs. Every source is warm 2700K and dimmable; only the bias light behind the TV is 6500K, so whites on screen stay true.</p></div>
    <div class="lgrid">
      ${fig('cinema-edit-room-evening', capt('Evening', 'The default: coves full, pots low, fire and lamp on.'), { cls: 'lbig' })}
      ${['work', 'fireside', 'game', 'movie'].map((s) => fig(`cinema-edit-room-${s}`, capt(SCENES[s].label, SCENES[s].use))).join('')}
    </div>
    <table class="scenes">
      <tr><th>Scene</th><th>Pot lights</th><th>LED channels</th><th>Fire</th><th>Lamp</th><th>Bias</th><th>Step lights</th><th>Screen</th><th>For</th></tr>
      ${Object.values(SCENES).map((s) => `<tr><td>${s.label}</td><td>${s.pots}</td><td>${s.leds}</td><td>${s.fire}</td><td>${s.lamp}</td><td>${s.bias}</td><td>${s.steps}</td><td>${s.screen}</td><td>${s.use}</td></tr>`).join('')}
    </table>
  </div>`);

page('sound', 'I · Architecture & light', `
  <div class="sound">
    <div class="sl">${planSvg('plan-cinema-edit.png', { inches: 9.15, dims: false, tags: true, speakers: true })}</div>
    <div class="sr">
      <div class="kicker">06 · Sound</div>
      <h2 class="title">5.1.2, wired<br>before the slats</h2>
      <p class="stand">Speaker positions follow Dolby’s angles from the prime seat. All of it is pre-wire: it has to happen before the slat walls and the slab go up.</p>
      <table class="spk">${plan.speakers.map((k) => `<tr><td><span class="sk${k.z >= R.ceiling ? ' up' : ''}">${k.k}</span></td><td>${esc(k.name)}</td><td>${esc(k.how)}</td></tr>`).join('')}</table>
      <p class="note">Also before close-up: a 2″ conduit with HDMI 2.1 from the console to the projector and TV, power and a 12 V trigger for the screen motor in the bulkhead, and the LED drivers in an accessible spot.</p>
    </div>
  </div>`);

// ---- Part II
page('part2', 'Seven collections', `
  <div class="divider">${img('luxe-room-evening', '50% 50%')}<div class="shade"></div>
    <div class="dblock"><span class="roman">II</span><div><div class="kicker light">Part two</div><h2>Seven<br>collections</h2><p>Six curated sets and our Cinema Edit, shown in the same room, from the same cameras, under the same light — so the furniture is the only thing that changes.</p></div></div></div>`, { cls: 'dark', head: false, foot: false });

page('overview', 'II · Seven collections', `
  <div class="ovw">
    <div class="ovh"><div class="kicker">The collections at a glance</div><h2 class="title">Seven ways to dress the room</h2></div>
    <div class="ovgrid">${COLL.map((c) => `
      <div class="ovc${c.id === 'cinema-edit' ? ' rec' : ''}">
        <div class="ph">${img(`${c.id}-room-evening`)}</div>
        <div class="ovt"><span class="no">${c.no}</span><b>${esc(c.fullName)}</b>${c.id === 'cinema-edit' ? '<span class="pill">Recommended</span>' : ''}</div>
        <p>${esc(c.tagline)}</p>
        <div class="ovm">${chips(c.palette)}<span><b>${c.totals.Balanced}</b>/100</span><span>${moneyK(c.eval.lo)}–${moneyK(c.eval.hi)}</span><span>${c.eval.weeks} wk</span></div>
      </div>`).join('')}
      <div class="ovc legend"><p><b>Score</b> out of 100 with balanced priorities (method in the appendix). <b>Budget</b> is the indicative furniture total for this layout in CAD. <b>Weeks</b> is the longest made-to-order lead time.</p><p>Every collection is shown with the proposed architecture: slats across the windows, the stone slab, and slats behind the TV.</p></div>
    </div>
  </div>`);

for (const c of COLL) {
  const rank = rankBy('Balanced').indexOf(c) + 1;
  page(`c-${c.id}`, `II · ${c.fullName}`, `
  <div class="copen">${img(`${c.id}-room-evening`)}<div class="shade"></div>
    <div class="cob">
      <div class="kicker light">Collection ${c.no}${c.id === 'cinema-edit' ? ' · Our recommendation' : ''}</div>
      <h2>${c.id === 'cinema-edit' ? 'Warm Modern ·<br>Cinema Edit' : esc(c.fullName)}</h2>
      <p>${esc(c.tagline)}</p>
      ${chips(c.palette, 'big')}
    </div>
    <div class="cscore"><b>${c.totals.Balanced}</b><span>of 100 · #${rank} of 7</span></div>
  </div>`, { cls: 'dark', head: false, foot: false });

  const rows = c.spec.filter((r) => r.type !== 'towerSpeaker' && r.type !== 'subwoofer');
  page(`c-${c.id}-2`, `II · ${c.fullName}`, `
  <div class="cpieces">
    <div class="cpl">
      ${fig(`${c.id}-fire-fireside`, capt('Fireside', 'The lounge from the bar corner.'), { cls: 'cbig' })}
      <div class="crow3">
        ${fig(`${c.id}-sofa-work`, capt('Bright', 'The sectional, true colours.'))}
        ${fig(`${c.id}-arrive-game`, capt('Game night', 'Arriving from the stairs.'))}
        ${fig(`${c.id}-back-evening`, capt('Evening', 'From the alcove to the lounge.'))}
      </div>
    </div>
    <div class="cpr">
      <div class="kicker">Collection ${c.no} · The pieces</div>
      <h3 class="ctitle">${esc(c.fullName)}</h3>
      <table class="pieces">
        <tr><th>Tag</th><th>Piece</th><th>Qty</th><th>Each, CAD</th></tr>
        ${rows.map((r) => `<tr><td class="tag">${r.tag}</td><td><b>${esc(r.item.replace(/^[^:]+: /, ''))}</b><span>${esc(r.item.split(':')[0])} · ${esc(finishText(r.spec))}</span></td><td>${r.qty}</td><td>${range(r.unit)}</td></tr>`).join('')}
      </table>
      <div class="ctot"><span>Furniture, this layout</span><b>${moneyFull(c.eval.lo)}–${moneyFull(c.eval.hi)}</b></div>
      <p class="note">Indicative prices for made-to-order pieces at these sizes, before tax and delivery. Speakers are budgeted with the AV.</p>
      <div class="dnote"><div class="kicker">Styling note</div><p>${esc(STYLING[c.id])}</p>${chips(c.palette, 'mid')}</div>
    </div>
  </div>`);

  const kp = [[`${moneyK(c.eval.lo)}–${moneyK(c.eval.hi)}`, 'furniture, CAD'], [`${c.eval.weeks} wk`, 'longest lead'], [`#${rank} of 7`, 'balanced rank']];
  page(`c-${c.id}-3`, `II · ${c.fullName}`, `
  <div class="cmood">
    <div class="cmtop">
      <div class="kicker">Collection ${c.no} · In every light</div>
      <div class="mrow">${['work', 'fireside', 'game', 'movie'].map((s) => fig(`${c.id}-room-${s}`, capt(SCENES[s].label, SCENES[s].use))).join('')}</div>
    </div>
    <div class="cmbot">
      <div class="cplan">${planSvg(`plan-${c.id}.png`, { inches: 6.4, dims: false, tags: false, ffe: c.spec.filter((r) => r.type !== 'towerSpeaker'), north: false, scale: false })}</div>
      <div class="ceval">
        <div class="cev-h">
          <div><div class="kicker">Evaluation · ${esc(c.fullName)}</div><p class="fitnote">${esc(c.fitNote)}</p></div>
          <div class="bigscore"><b>${c.totals.Balanced}</b><span>of 100 · balanced</span></div>
        </div>
        <div class="kpis small">${kp.map(([a, b]) => `<div><b>${a}</b><span>${b}</span></div>`).join('')}</div>
        ${scoreBars(c)}
        <div class="pc"><div><b>Strengths</b><ul>${c.pros.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div><div><b>Watch-outs</b><ul>${c.cons.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div></div>
        <p class="note">Plan: furnished layout with the tags used in the piece list. Scores 1–5 per criterion; method in the appendix.</p>
      </div>
    </div>
  </div>`);
}

// ---- Part III
page('part3', 'Evaluation & recommendation', `
  <div class="divider">${img('arch-seat-movie', '50% 50%')}<div class="shade"></div>
    <div class="dblock"><span class="roman">III</span><div><div class="kicker light">Part three</div><h2>Evaluation &amp;<br>recommendation</h2><p>The seven collections side by side, scored against eight criteria, priced and timed — and the one we would build.</p></div></div></div>`, { cls: 'dark', head: false, foot: false });

// our read of which fireplace wall suits each collection
const PAIR = {
  'warm-modern': 'A or B: walnut and ivory sit well with either wall',
  'mid-century': 'B: an all-timber wall suits teak, tweed and tapered legs',
  japandi: 'B: oak, linen and walnut, with no black stone to fight them',
  industrial: 'A: black stone answers the black steel and leather',
  luxe: 'A: stone, velvet and brass — the members’-club look',
  theater: 'A: the slab frames the fire against dark upholstery',
  'cinema-edit': 'A: the slab gives the fire an edge against pewter and charcoal',
};
const pieceOf = (c, id) => (c.pieces || []).find((p) => p.id === id);
const pline = (c, id, label) => { const p = pieceOf(c, id); return p ? `<li><b>${label}</b>${esc(p.variant)} · ${esc(finishText(p.spec))}</li>` : ''; };
const sbs = [
  ['sbs1', 'room-evening', 'The whole room, Evening', 'Read the room as a whole: how much each set lifts or darkens the space at night.',
    (c) => `<li><b>Budget</b>${moneyK(c.eval.lo)}–${moneyK(c.eval.hi)} · longest lead ${c.eval.weeks} wk</li><li><b>Palette</b>${chips(c.palette)}</li>`],
  ['sbs2', 'fire-fireside', 'The lounge, Fireside', 'The fireside lounge is where most evenings happen: compare the chairs, the table and the lamp.',
    (c) => pline(c, 'chair-a', 'Chairs') + pline(c, 'table', 'Table') + pline(c, 'lamp', 'Lamp')],
  ['sbs3', 'sofa-work', 'The sectional, Bright', 'Bright light shows true upholstery colours: the sectional is the largest surface the screen sees.',
    (c) => pline(c, 'sectional', 'Sectional') + pline(c, 'ottoman', 'Ottoman') + pline(c, 'rug-main', 'Rug')],
  ['sbs4', 'roomB-evening', 'The whole room, Option B', 'The same seven with slats only — no stone slab. Compare with page __SBS1__ to see which wall suits which collection.',
    (c) => `<li><b>Pairs with</b>${PAIR[c.id]}</li>`],
];
sbs.forEach(([id, v, t, lead, info], i) => page(id, 'III · Evaluation', `
  <div class="sbs">
    <div class="sbh"><div><div class="kicker">07 · Side by side, ${i + 1} of ${sbs.length}</div><h2 class="title">${t}</h2></div><p class="stand">${lead}</p></div>
    <div class="sbgrid">${COLL.map((c) => `
      <div class="sbc${c.id === 'cinema-edit' ? ' rec' : ''}">
        <div class="ph">${img(`${c.id}-${v}`, v.startsWith('room') ? '38% 50%' : '50% 50%')}</div>
        <div class="sbt"><span class="no">${c.no}</span><b>${esc(c.fullName)}</b><em>${c.totals.Balanced}</em></div>
        <ul>${info(c)}</ul>
      </div>`).join('')}
      <div class="sbnote"><p>Same cameras, same light, same architecture — only the furniture changes.</p><p class="note">The number beside each name is its balanced score out of 100.</p></div>
    </div>
  </div>`));

page('scorecard', 'III · Evaluation', `
  <div class="scp">
    <div class="sch"><div class="kicker">08 · Scorecard</div><h2 class="title">Eight criteria,<br>four sets of priorities</h2>
      <p class="stand">Each criterion is scored 1–5 from the pieces themselves — covers, colours, sizes, prices, lead times. Totals are weighted averages on a 100-point scale.</p></div>
    <table class="heat">
      <tr><th class="cn"></th>${CRIT.map((k) => `<th>${esc(k.label)}</th>`).join('')}<th class="sep"></th>${PRESETS.map((p) => `<th class="tot">${esc(p)}</th>`).join('')}</tr>
      ${rankBy('Balanced').map((c) => `<tr class="${c.id === 'cinema-edit' ? 'rec' : ''}"><td class="cn"><span class="no">${c.no}</span>${esc(c.fullName)}</td>${CRIT.map((k) => { const v = c.eval.scores[k.key], h = heat(v); return `<td style="background:${h.bg};color:${h.fg}">${v.toFixed(1)}</td>`; }).join('')}<td class="sep"></td>${PRESETS.map((p) => { const best = Math.max(...COLL.map((x) => x.totals[p])); return `<td class="tot${c.totals[p] === best ? ' best' : ''}">${c.totals[p]}</td>`; }).join('')}</tr>`).join('')}
    </table>
    <div class="legend">${[1, 2, 3, 4, 5].map((v) => { const h = heat(v); return `<span style="background:${h.bg};color:${h.fg}">${v}</span>`; }).join('')}<em>1 weak — 5 strong</em></div>
    <div class="scfoot">
      <div><b>How to read it.</b> Darker cells score higher. The four columns on the right re-weight the same scores: <em>Balanced</em> is our default; <em>Cinema first</em> leans on comfort, picture and acoustics; <em>Hangout first</em> on flexibility and care; <em>Budget first</em> on cost and speed. The best total in each column is underlined.</div>
      <div><b>What it says.</b> Performance Theatre leads on comfort, picture and care, and wins when films come first. The Cinema Edit leads on fit with the room (5 against 3), hangout flexibility and budget — and with balanced priorities that adds up to the highest total.</div>
    </div>
  </div>`);

page('budget', 'III · Evaluation', `
  <div class="bud">
    <div class="budh"><div class="kicker">09 · Budget &amp; lead time</div><h2 class="title">What it costs,<br>how long it takes</h2>
      <p class="stand">Indicative furniture totals for this layout, in Canadian dollars, and the longest made-to-order lead time in each collection.</p></div>
    <div class="charts">
      <div><div class="chh">Furniture budget, CAD · range and midpoint</div>${budgetChart()}</div>
      <div><div class="chh">Longest lead time</div>${leadChart()}</div>
    </div>
    <p class="note wide">Prices are typical ranges for made-to-order pieces at these sizes, before tax, delivery and installation. Covers change the price (leather adds about 55% to an upholstered piece; bouclé and velvet about 12%). AV equipment, the screen, slats, slab and lighting are separate: see Scope for trade quotes.</p>
  </div>`);

page('rec', 'III · Recommendation', `
  <div class="recp">
    <div class="rimg">${fig('cinema-edit-room-evening', capt('Cinema Edit', 'Evening scene, Option A fireplace wall.'))}</div>
    <div class="rtext">
      <div class="kicker">10 · Our recommendation</div>
      <h2 class="title">Warm Modern,<br>Cinema Edit</h2>
      <p class="stand">Keep the collection that already belongs to this room, and re-cover the three surfaces the screen sees most.</p>
      <ol class="why">
        <li><b>Sectional in pewter performance weave.</b> Darker and matte facing the screen; 100,000 double rubs; cleans with water.</li>
        <li><b>Swivel chairs in oatmeal performance linen-look.</b> They turn from the fire to the screen, and stay light against the black slab.</li>
        <li><b>Charcoal tonal rug in front of the screen.</b> Less light bouncing back from the floor in Movie scene.</li>
        <li><b>Everything else stays Warm Modern:</b> walnut, chestnut leather, brass, the bordered rug by the fire.</li>
      </ol>
      <div class="kpis"><div><b>${REC.totals.Balanced}</b><span>balanced score —<br>highest of seven</span></div><div><b>${moneyK(REC.eval.lo)}–${moneyK(REC.eval.hi)}</b><span>furniture,<br>indicative CAD</span></div><div><b>${REC.eval.weeks} wk</b><span>longest<br>lead time</span></div></div>
      <div class="alts">
        <div><b>If films come first</b><span>Performance Theatre — ${C.theater.totals['Cinema first']} with cinema priorities; power recline and the darkest surfaces.</span></div>
        <div><b>If you want a statement</b><span>Luxe Lounge — forest velvet and travertine; the most dramatic, and the highest budget.</span></div>
        <div><b>If budget leads</b><span>Japandi — from ${money(C.japandi.eval.lo)}; light and calm, but pale seats work against the screen.</span></div>
      </div>
    </div>
  </div>`);

const ffeRows = REC.spec;
page('ffe', 'III · Recommendation', `
  <div class="ffe">
    <div class="ffh"><div class="kicker">11 · FF&amp;E schedule</div><h2 class="title">Cinema Edit, piece by piece</h2></div>
    <div class="ffb">
      <table class="sched">
        <tr><th>Tag</th><th>Item</th><th>Specification</th><th>Size</th><th>Qty</th><th>Each, CAD</th><th>Lead</th></tr>
        ${ffeRows.map((r) => `<tr><td class="tag">${r.tag}</td><td><b>${esc(itemName(r.item))}</b></td><td>${esc(r.spec)}${r.care ? `<span class="care">${esc(r.care)}</span>` : ''}</td><td>${esc(r.size)}</td><td>${r.qty}</td><td>${range(r.unit)}</td><td>${r.weeks ? `${r.weeks[0]}–${r.weeks[1]} wk` : 'with AV'}</td></tr>`).join('')}
        <tr class="sum"><td></td><td colspan="4">Furniture total, indicative</td><td colspan="2">${moneyFull(REC.eval.lo)}–${moneyFull(REC.eval.hi)}</td></tr>
      </table>
      <div class="ffside">
        ${planSvg('plan-cinema-edit.png', { inches: 3.9, dims: false, tags: false, ffe: ffeRows.filter((r) => r.type !== 'towerSpeaker'), north: false, scale: false })}
        <p class="note">Tags key each piece to the plan. Order the sectional first: at ${REC.eval.weeks} weeks it sets the date for everything else. Approve every cover from a physical swatch, at night, under the 2700K coves.</p>
      </div>
    </div>
  </div>`);

const scope = [
  ['Millwork', 'Walnut slat wall, fireplace wall', `About ${ftin(G.westY)} × ${ftin(R.beamBottom)} (${Math.round((G.westY * R.beamBottom) / 144)} sq ft) on black felt, running across both windows; cut-out for the slab (A) or the firebox (B).`],
  ['Millwork', 'Walnut slats behind the TV', `${ftin(tvWall)} × ${ftin(R.soffitBottom)} (${Math.round((tvWall * R.soffitBottom) / 144)} sq ft); blocking for the TV mount and a cable chase behind.`],
  ['Stone', 'Slab surround (Option A)', `${slab.w}″ × ${slab.h}″, honed, with a ${fp.width}″ × ${fp.height}″ opening; templated after the insert is set; one book-matched seam if porcelain.`],
  ['Electrical', 'LED channels and drivers', 'Backlit band behind the window slats, vertical channels at both ends of the fireplace wall, alcove bulkhead cove; 2700K, high-CRI, dimmable.'],
  ['Electrical', 'Lighting control', 'Five-scene keypad at the foot of the stairs; dimmable pots; step lights; 6500K bias strip on the TV circuit.'],
  ['AV', 'Screen and projector', `${plan.tv.screenSize}″ 16:9 motorised screen in the alcove bulkhead, ceiling projector (to select), 12 V trigger, power in the bulkhead.`],
  ['AV', '5.1.2 pre-wire', 'Eight speaker locations plus subwoofer (see Sound), HDMI 2.1 conduit from console to projector and TV.'],
];
page('quotes', 'III · Recommendation', `
  <div class="quotes">
    <div class="qh"><div class="kicker">12 · Scope for trade quotes</div><h2 class="title">What to ask the trades</h2>
      <p class="stand">Furniture is priced from the collections. The architecture, lighting and AV should be priced by your trades, from this scope and these quantities.</p></div>
    <table class="qt"><tr><th>Trade</th><th>Item</th><th>Scope and quantities</th><th>Quote</th></tr>
      ${scope.map(([t, i, s]) => `<tr><td>${t}</td><td><b>${i}</b></td><td>${s}</td><td class="q"></td></tr>`).join('')}
    </table>
    <div class="qfoot">
      <div class="check"><div class="kicker">When you ask for prices</div><ul>
        <li>Price Option A and Option B separately.</li>
        <li>Confirm the fireplace maker’s clearances to walnut and to the slab.</li>
        <li>Sequence: pre-wire and blocking before any slats or slab.</li>
        <li>Ask for samples: a slat section with felt, the slab finish, the LED in 2700K.</li></ul></div>
      <div><div class="ctot"><span>Furniture · Cinema Edit, indicative</span><b>${moneyFull(REC.eval.lo)}–${moneyFull(REC.eval.hi)}</b></div><p class="note">Architecture, lighting and AV are excluded from this figure and priced by quote.</p></div>
    </div>
  </div>`);

page('next', 'III · Next steps', `
  <div class="nextp">
    <div class="nh"><div class="kicker">13 · Next steps</div><h2 class="title">From decision to first screening</h2>
      <p class="stand">About ${Math.ceil(3.4 + REC.eval.weeks + 1)} weeks end to end, set by the sectional’s lead time. The walls and wiring finish well before the furniture arrives.</p></div>
    <div class="gwrap">${gantt()}</div>
    <div class="steps">
      <div><span>01</span><b>Choose</b><p>Option A or B for the fireplace wall, and the collection.</p></div>
      <div><span>02</span><b>Sample</b><p>See swatches at night under the 2700K coves and with the TV on before approving.</p></div>
      <div><span>03</span><b>Pre-wire</b><p>Speakers, HDMI, screen power and LED drivers go in before any slats.</p></div>
      <div><span>04</span><b>Build</b><p>Slat walls, slab, screen; then calibrate the picture and program the scenes.</p></div>
    </div>
  </div>`);

page('appA', 'Appendix', `
  <div class="appx">
    <div class="ax1">
      <div class="kicker">Appendix A · How the scores work</div>
      <h3 class="ctitle">Method</h3>
      <table class="crit">${CRIT.map((k) => `<tr><td><b>${esc(k.label)}</b></td><td>${esc(k.key === 'budget' ? 'Indicative furniture total for this layout: the lower the total, the higher the score.' : k.note)}</td></tr>`).join('')}</table>
      <table class="wts"><tr><th></th>${CRIT.map((k) => `<th>${esc(k.label.split(' ')[0])}</th>`).join('')}</tr>
        ${PRESETS.map((p) => `<tr><td>${esc(p)}</td>${CRIT.map((k) => `<td>${study.presets[p][k.key]}</td>`).join('')}</tr>`).join('')}</table>
      <p class="note">Each criterion is scored 1–5. A total is the weighted average of the eight scores × 20. Weights run 0 (ignored) to 5 (counts most). The interactive planner recomputes everything as you change pieces or priorities.</p>
    </div>
    <div class="ax2">
      <div class="kicker">Appendix B · Upholstery guide</div>
      <h3 class="ctitle">Covers in these collections</h3>
      <table class="covers"><tr><th>Cover</th><th>Wear</th><th>Care</th><th>Pets</th><th>Sound</th><th>Notes</th></tr>
        ${Object.values(study.covers).map((v) => `<tr><td><b>${esc(v.label)}</b></td>${['durability', 'care', 'pets', 'absorb'].map((k) => `<td><span class="dots">${'●'.repeat(v[k])}<i>${'●'.repeat(5 - v[k])}</i></span></td>`).join('')}<td>${esc(v.spec)}</td></tr>`).join('')}</table>
      <p class="note">Renders come from the interactive planner and show proportions, materials and light, not exact products. Colours on screen and in print vary: approve real samples, at night, in the room.</p>
    </div>
  </div>`);

page('back', '', `
  <div class="backc"><span class="mono">BC</span><p>The Basement Cinema · Design Review No. 02 · October 2026</p><p class="small">Renders, plans and figures generated from the Basement Cinema Planner. Prices indicative, in CAD, before tax and delivery.</p></div>`, { cls: 'dark', head: false, foot: false });

// ---------------------------------------------------------------- assemble
pages.forEach((p, i) => { pageNo[p.id] = i + 1; });
const css = fs.readFileSync(path.join(__dirname, 'review.css'), 'utf8').replace(/FONTS\//g, 'file://' + FONTS + '/');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>The Basement Cinema — Design Review No. 02</title><style>${css}</style></head><body>
${pages.map((p, i) => `<section class="page ${p.cls}" id="p-${p.id}">
${p.head ? `<div class="rh"><span>The Basement Cinema</span><span>${esc(p.section)}</span></div>` : ''}
${p.body.replace('__SBS1__', String(pageNo.sbs1)).replace(/<a data-p="([^"]+)">([^<]*)<\/a>/g, (m, id, t) => `<a class="ti" href="#p-${id}"><span>${t}</span><i></i><em>${String(pageNo[id] || '').padStart(2, '0')}</em></a>`)}
${p.foot ? `<div class="rf"><span>Design Review No. 02 · October 2026</span><span class="pn">${String(i + 1).padStart(2, '0')}</span></div>` : ''}
</section>`).join('\n')}
</body></html>`;
fs.writeFileSync(OUT, html);
// bookmark outline for the PDF (finalize.py adds it with the metadata)
const O = (title, id, kids) => ({ title, page: pageNo[id], kids: kids || [] });
const outline = [
  O('Cover', 'cover'), O('Contents', 'contents'), O('At a glance', 'glance'), O('The room as measured', 'room'), O('Principles & materials', 'principles'),
  O('I · Architecture & light', 'part1', [O('The fireplace wall', 'diagnosis'), O('Option A · Slats + stone slab', 'optA'), O('Option B · Slats only', 'optB'),
    O('A or B', 'avsb'), O('The TV wall', 'tvwall'), O('The screen', 'screen'), O('Five lighting scenes', 'light'), O('Sound', 'sound')]),
  O('II · Seven collections', 'part2', [O('The collections at a glance', 'overview'), ...COLL.map((c) => O(`${c.no} · ${c.fullName}`, `c-${c.id}`))]),
  O('III · Evaluation & recommendation', 'part3', [O('Side by side', 'sbs1'), O('Scorecard', 'scorecard'), O('Budget & lead time', 'budget'),
    O('Our recommendation', 'rec'), O('FF&E schedule', 'ffe'), O('Scope for trade quotes', 'quotes'), O('Next steps', 'next')]),
  O('Appendix · Method & upholstery', 'appA'),
];
fs.writeFileSync(OUT.replace(/\.html$/, '.outline.json'), JSON.stringify(outline, null, 1));
console.log('pages', pages.length, '->', OUT);
