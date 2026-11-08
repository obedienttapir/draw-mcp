// ===================================================================
// 64 · Bass tools on top of the wave model: listening positions, subwoofer placement (presets and a
// multi-sub optimiser in the spirit of Welti's work at Harman: minimise seat-to-seat variation first, then
// the flatness of what's left, without throwing away output), per-sub DSP (gain, delay, polarity), an
// automatic parametric EQ for the seating area, the impulse response, waterfall and low-frequency decay
// per third octave, and a sweep of the sofa's position through the room.
// ===================================================================

// ---------------- listening positions ----------------
/** The main seating piece and its seat line (same frame as mainSeat). */
function mainSeatLine() {
  const it = state.items.find((i) => i.type === 'prettySectional') || state.items.find((i) => i.type === 'uSectional')
    || state.items.find((i) => i.type === 'sectional') || state.items.find((i) => i.type === 'sofa') || state.items.find((i) => i.type === 'recliner');
  if (!it) return null;
  const phi = it.rot * DEG, ex = [-Math.cos(phi), -Math.sin(phi)], ez = [-Math.sin(phi), Math.cos(phi)];
  const p = { ...CATALOG[it.type].defaults, ...it.p };
  let lx0 = 0, lx1 = 0, lz = 2, xs = null;
  if (it.type === 'prettySectional') {
    const u = prettySize(p), sx = p.side === 'right' ? -1 : 1;
    [lx0, lx1] = [sx * (-u.W / 2 + PRETTY.depth + 6), sx * (u.W / 2 - PRETTY.open)]; lz = -u.D / 2 + 22;
  } else if (it.type === 'uSectional') {
    const u = uSectionalSize(p);
    lx0 = -u.W / 2 + u.arm + 12; lx1 = u.W / 2 - u.arm - 12; lz = -u.D / 2 + 22;
    xs = Array.from({ length: u.n }, (_, i) => -u.W / 2 + u.arm + TREMEE.mw * (i + 0.5));
  } else if (it.type === 'sectional') {
    const B = p.back, R = p.ret, d = p.depth;
    [lx0, lx1] = p.side === 'left' ? [-(B / 2 - 6), B / 2 - d] : [-B / 2 + d, B / 2 - 6]; lz = -R / 2 + 22;
  } else if (it.type === 'sofa') { lx0 = -p.w / 2 + 12; lx1 = p.w / 2 - 12; lz = -p.depth / 2 + 22; }
  return { it, ex, ez, lx0, lx1, lz, xs };
}
/** Listening positions: the main sofa's seats (ear height 38″), plus lounge chairs as a second group. */
function acSeats(shift = [0, 0]) {
  const out = [], L = mainSeatLine();
  if (L) {
    const { it, ex, ez, lz } = L;
    let xs = L.xs;
    if (!xs) { const a = Math.min(L.lx0, L.lx1), b = Math.max(L.lx0, L.lx1), n = Math.max(1, Math.round((b - a) / 26) + 1); xs = Array.from({ length: n }, (_, i) => (n === 1 ? (a + b) / 2 : a + (b - a) * i / (n - 1))); }
    const right = [ez[1], -ez[0]];
    const pts = xs.map((lx) => ({ x: it.x + lx * ex[0] + lz * ez[0] + shift[0], y: it.y + lx * ex[1] + lz * ez[1] + shift[1] }))
      .sort((a, b) => (a.x * right[0] + a.y * right[1]) - (b.x * right[0] + b.y * right[1]));
    const m = mainSeat(); const mp = m ? { x: m.x + shift[0], y: m.y + shift[1] } : pts[0];
    let mi = 0, md = Infinity; pts.forEach((p, i) => { const d = Math.hypot(p.x - mp.x, p.y - mp.y); if (d < md) { md = d; mi = i; } });
    pts.forEach((p, i) => out.push({ id: `s${i + 1}`, label: i === mi ? 'MLP' : `Seat ${i + 1}`, x: p.x, y: p.y, z: AC.ear, main: true, mlp: i === mi }));
  }
  let k = 0;
  for (const it of state.items) if ((it.type === 'loungeChair' || it.type === 'recliner') && it !== (L && L.it)) {
    out.push({ id: `c${++k}`, label: `Chair ${k}`, x: it.x, y: it.y, z: AC.ear - 2, main: false, mlp: false });
  }
  if (!out.length) out.push({ id: 's1', label: 'MLP', x: geom().tvX, y: geom().mainY * 0.45, z: AC.ear, main: true, mlp: true });
  return out;
}
const tuneSeats = () => acSeats().filter((s) => s.main || state.tune.allSeats);

// ---------------- sources ----------------
/** The subwoofers in the layout (or the pre-wire position when there are none), with their DSP. */
function currentSubs() {
  const subs = state.items.filter((i) => i.type === 'subwoofer').map((it) => {
    const d = state.tune.dsp[it.id] || {};
    return { id: it.id, x: it.x, y: it.y, g: d.g || 0, d: d.d || 0, pol: d.pol === -1 ? -1 : 1, real: true };
  });
  if (subs.length) return subs;
  const G = geom(), r = state.room;
  return [{ id: 'prewire', x: r.width - 10, y: G.mainY - 10, g: 0, d: 0, pol: 1, real: false }];
}
/** The front left / right mains (tower items, or the layout's front positions). */
function currentMains() {
  const t = state.items.filter((i) => i.type === 'towerSpeaker').map((i) => ({ x: i.x, y: i.y }));
  if (t.length >= 2) return t.slice(0, 2);
  const lay = tuneLayout('5.1');
  return lay.filter((c) => c.k === 'L' || c.k === 'R').map((c) => ({ x: c.p[0], y: c.p[1] }));
}

// ---------------- the analysis context (rebuilt when the layout or tuning changes) ----------------
let BCTX = null;
function bassCtx() {
  if (!ACS || ACS.grid.key !== acKey()) return null;
  const key = JSON.stringify([state.items, state.tune, state.room.ceiling]);
  if (BCTX && BCTX.key === key && BCTX.S === ACS) return BCTX;
  const S = ACS, damp = acDamping(S), F = logFreqs(), inv = acInv(S, damp, F);
  const seats = acSeats().map((s) => ({ ...s, c: acCoef(S, s.x, s.y, s.z) }));
  BCTX = { key, S, damp, F, inv, seats, cache: new Map() };
  return BCTX;
}
/** Transfer from a point source at (x, y, z) to a seat (cached). */
function ctxTransfer(ctx, x, y, z, seat) {
  const k = `${x.toFixed(1)},${y.toFixed(1)},${z}|${seat.id}|${seat.x.toFixed(1)},${seat.y.toFixed(1)}`;
  let t = ctx.cache.get(k);
  if (!t) { t = acTransfer(ctx.inv, acCoef(ctx.S, x, y, z), seat.c || acCoef(ctx.S, seat.x, seat.y, seat.z)); ctx.cache.set(k, t); }
  return t;
}
/** Complex weight of one sub at f: level, polarity, delay. */
const subW = (s, f) => { const a = 10 ** ((s.g || 0) / 20) * (s.pol === -1 ? -1 : 1), ph = -2 * Math.PI * f * (s.d || 0) / 1000; return [a * Math.cos(ph), a * Math.sin(ph)]; };
/** Seat responses (dB re one sub at 1 m) for a sub configuration. opts: { eq, signal, seats } */
function bassResponses(ctx, subs, opts = {}) {
  const t = state.tune, F = ctx.F, seats = opts.seats || ctx.seats, eq = opts.eq || null, signal = opts.signal || t.signal;
  const mains = signal === 'managed' ? currentMains() : [];
  const gd = (f) => { const ph = -2 * Math.PI * f * (t.gdelay || 0) / 1000; return [Math.cos(ph), Math.sin(ph)]; };
  const chain = F.map((f) => { const c = cmul(cmul(subResp(t.sub, f), lr4('lp', signal === 'managed' ? t.xo : 120, f)), gd(f)); return eq ? cmul(c, eqResp(eq, f)) : c; });
  const out = seats.map((seat) => {
    const re = new Float64Array(F.length), im = new Float64Array(F.length);
    for (const s of subs) {
      const tr = ctxTransfer(ctx, s.x, s.y, AC.subZ, seat);
      F.forEach((f, i) => { const w = cmul(subW(s, f), chain[i]);
        re[i] += (tr[2 * i] * w[0] - tr[2 * i + 1] * w[1]) * FF; im[i] += (tr[2 * i] * w[1] + tr[2 * i + 1] * w[0]) * FF; });
    }
    for (const m of mains) {
      const tr = ctxTransfer(ctx, m.x, m.y, 30, seat), pol = t.subPol === -1 ? -1 : 1;
      F.forEach((f, i) => { const w = mainChain(f); re[i] += pol * (tr[2 * i] * w[0] - tr[2 * i + 1] * w[1]) * FF * 0.5; im[i] += pol * (tr[2 * i] * w[1] + tr[2 * i + 1] * w[0]) * FF * 0.5; });
    }
    const d = new Float64Array(F.length); for (let i = 0; i < F.length; i++) d[i] = db(re[i], im[i]);
    return { seat, re, im, db: d };
  });
  return out;
}
/** Power average across responses, in dB. */
function powerMean(rs, idx) {
  const n = rs[0].db.length, out = new Float64Array(n), use = idx || rs.map((_, i) => i);
  for (let f = 0; f < n; f++) { let s = 0; for (const i of use) s += 10 ** (rs[i].db[f] / 10); out[f] = 10 * Math.log10(s / use.length); }
  return out;
}
/** Fractional-octave smoothing (power) on the log-spaced grid. frac 0 = none. */
function smoothDb(d, frac, ppo = AC.ppo) {
  if (!frac) return Float64Array.from(d);
  const half = Math.max(1, Math.round(ppo / (2 * frac))), out = new Float64Array(d.length);
  for (let i = 0; i < d.length; i++) { let s = 0, n = 0; for (let j = Math.max(0, i - half); j <= Math.min(d.length - 1, i + half); j++) { s += 10 ** (d[j] / 10); n++; } out[i] = 10 * Math.log10(s / n); }
  return out;
}
const TARGETS = {
  flat: { label: 'Flat', g: 0 },
  gentle: { label: '+3 dB house curve', g: 3 },
  harman: { label: '+6 dB house curve', g: 6 },
};
/** Target curve shape (dB, 0 in the upper bass) at f: a gentle low shelf. */
const targetAt = (f, key = state.tune.target) => (TARGETS[key] || TARGETS.flat).g / (1 + (f / 45) ** 2);
/** The analysis band for the bass metrics. */
const bassBand = () => [20, state.tune.signal === 'managed' ? Math.max(100, state.tune.xo * 1.5) : 100];

// ---------------- metrics ----------------
function bassMetrics(rs, F, opts = {}) {
  const [lo, hi] = opts.band || bassBand(), idx = [];
  F.forEach((f, i) => { if (f >= lo && f <= hi) idx.push(i); });
  const seatIdx = rs.map((r, i) => i).filter((i) => rs[i].seat.main || state.tune.allSeats);
  const mlpI = Math.max(0, rs.findIndex((r) => r.seat.mlp));
  const sm = rs.map((r) => smoothDb(r.db, 12));
  // seat-to-seat variation: standard deviation across seats, averaged over the band
  let ssv = 0;
  for (const i of idx) { let m = 0; for (const s of seatIdx) m += sm[s][i]; m /= seatIdx.length; let v = 0; for (const s of seatIdx) v += (sm[s][i] - m) ** 2; ssv += Math.sqrt(v / Math.max(1, seatIdx.length - (seatIdx.length > 1 ? 1 : 0))); }
  ssv /= idx.length;
  const mean = powerMean(rs, seatIdx), meanS = smoothDb(mean, 12);
  const dev = (arr) => { const v = idx.map((i) => arr[i] - targetAt(F[i])); const m = v.reduce((a, b) => a + b, 0) / v.length; return { sd: Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length), lvl: m, p2p: Math.max(...v) - Math.min(...v) }; };
  const dm = dev(meanS), dl = dev(sm[mlpI]);
  // extension: lowest frequency within 6 dB of the target line (mean response, 1/6 octave)
  const m6 = smoothDb(mean, 6); let ext = F[F.length - 1];
  for (let i = F.length - 1; i >= 0; i--) { if (F[i] > 80) continue; if (m6[i] - targetAt(F[i]) >= dm.lvl - 6) ext = F[i]; else break; }
  return { ssv, flat: dm.sd, flatMlp: dl.sd, p2pMlp: dl.p2p, level: dm.lvl, ext, mean, meanS, mlp: mlpI, idx };
}
/** One number for comparing configurations (lower is better). */
const bassScore = (m, n = 1, ref = null) => m.ssv + 0.5 * m.flat + (ref != null ? 0.25 * Math.max(0, ref + 20 * Math.log10(n) - 6 - m.level) : 0);

// ---------------- subwoofer positions ----------------
/** Where a subwoofer could stand: against the walls of the room (every foot, corners first) and just behind the seats. */
function subCandidates() {
  const S = ACS; if (!S) return [];
  const g = S.grid, r = state.room, G = geom(), off = 8.5 - g.g / 2;
  const byCell = new Map();
  for (const [k, di, dj] of g.walls) { if (!g.room[k] || g.Y[k] < 4) continue; const v = byCell.get(k) || [0, 0, 0]; v[0] -= di; v[1] -= dj; v[2]++; byCell.set(k, v); }
  // big pieces block a spot; small ones (a plant, a lamp, a bar cart) can move, and the spot says so
  const BIG = { uSectional: 1, prettySectional: 1, sectional: 1, sofa: 1, recliner: 1, loungeChair: 1, console: 1, aetherStand: 1, towerSpeaker: 1, ottoman: 1 };
  const blockers = state.items.filter((it) => BIG[it.type]).map((it) => footprint(it)).filter(Boolean);
  const movable = state.items.filter((it) => !BIG[it.type] && it.type !== 'subwoofer' && it.type !== 'rug' && !isWallType(it.type)).map((it) => ({ it, fp: footprint(it) })).filter((q) => q.fp);
  const fp = state.fireplace;
  const free = (x, y) => pointInPoly([x, y], G.outline) && !blockers.some((poly) => [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]].some(([a, b]) => pointInPoly([x + a, y + b], poly)))
    && !(x < 22 && Math.abs(y - fp.center) < fp.width / 2 + 10) && !floorObstacles().some((o) => pointInPoly([x, y], o)) && y > 6;
  const raw = [];
  for (const [k, v] of byCell) {
    const x = g.X[k] + Math.sign(v[0]) * off, y = g.Y[k] + Math.sign(v[1]) * off;
    if (free(x, y)) raw.push({ x, y, corner: v[0] !== 0 && v[1] !== 0, n: [Math.sign(v[0]), Math.sign(v[1])] });
  }
  raw.sort((a, b) => (b.corner - a.corner));
  const out = [];
  for (const c of raw) if (out.every((o) => Math.hypot(o.x - c.x, o.y - c.y) >= (c.corner ? 8 : 12))) out.push(c);
  // near-field: just behind the main seats
  const L = mainSeatLine();
  if (L) for (const s of acSeats().filter((q) => q.main)) {
    const x = s.x - L.ez[0] * 36, y = s.y - L.ez[1] * 36;
    if (free(x, y) && out.every((o) => Math.hypot(o.x - x, o.y - y) >= 12)) out.push({ x, y, corner: false, near: true, n: [-L.ez[0], -L.ez[1]] });
  }
  out.forEach((c) => {
    c.label = spotName(c);
    const mv = movable.filter((q) => [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]].some(([a, b]) => pointInPoly([c.x + a, c.y + b], q.fp)));
    if (mv.length) c.label += ` (move the ${mv.map((q) => CATALOG[q.it.type].label.toLowerCase()).join(' and ')})`;
  });
  return out;
}
/** Plain-language position: wall and side, as you face the TV. */
function spotName(c) {
  const G = geom(), r = state.room;
  if (c.near) return 'behind the seats';
  if (c.y > G.mainY + 2) return c.x < G.tvX - 8 ? 'TV alcove, left side' : c.x > G.tvX + 8 ? 'TV alcove, right side' : 'TV alcove, under the screen';
  const [nx, ny] = c.n || [0, 0];
  const side = nx > 0 ? 'left' : nx < 0 ? 'right' : '', end = ny < 0 ? 'front' : ny > 0 ? 'back' : '';
  if (side && end) return `${end} ${side} corner`;
  if (end) return `${end} wall${c.x < r.width * 0.33 ? ', left' : c.x > r.width * 0.66 ? ', right' : ''}`;
  if (side) return `${side} wall${c.y > G.mainY * 0.66 ? ', front' : c.y < G.mainY * 0.33 ? ', back' : ', middle'}`;
  return 'in the room';
}
/** Named arrangements, each snapped to the nearest valid spot. */
function subPresets() {
  const r = state.room, G = geom(), cands = subCandidates(); if (!cands.length) return [];
  const snap = (x, y) => cands.reduce((b, c) => (Math.hypot(c.x - x, c.y - y) < Math.hypot(b.x - x, b.y - y) ? c : b), cands[0]);
  const back = Math.max(G.wallX, (G.wallX + r.width) / 2), midY = G.mainY / 2;
  const L = mainSeatLine(), near = cands.find((c) => c.near);
  const list = [
    ['fc', '1 · front corner', [[r.width, G.mainY]]],
    ['tv', '1 · under the TV', [[G.tvX, r.depth]]],
    ['2fc', '2 · front corners', [[0, G.westY], [r.width, G.mainY]]],
    ['2al', '2 · alcove sides', [[G.bay[0][0], G.mainY + G.ret], [G.bay[5][0], G.mainY + G.ret]]],
    ['2fb', '2 · front and back walls', [[G.tvX, r.depth], [back, 0]]],
    ['2lr', '2 · side walls, middle', [[0, midY], [r.width, midY]]],
    ['4mid', '4 · middle of each wall', [[G.tvX, r.depth], [back, 0], [0, midY], [r.width, midY]]],
    ['4c', '4 · corners', [[0, G.westY], [r.width, G.mainY], [0, 0], [r.width, 0]]],
  ];
  if (near) list.push(['nf', '1 · near-field, behind the seats', [[near.x, near.y]]]);
  return list.map(([key, label, pts]) => {
    const subs = []; for (const [x, y] of pts) { const c = snap(x, y); if (!subs.some((s) => s.x === c.x && s.y === c.y)) subs.push({ x: c.x, y: c.y, g: 0, d: 0, pol: 1, label: c.label }); }
    return { key, label, subs };
  });
}

// ---------------- the optimiser ----------------
/** Search positions (and per-sub gain, delay and polarity) for n subs. keep: optimise the current subs' DSP only. */
async function optimiseSubs({ n = 2, keep = false, onProgress = () => {} } = {}) {
  const ctx = bassCtx(); if (!ctx) return null;
  const t = state.tune, [lo, hi] = bassBand(), F = ctx.F.filter((f, i) => i % 2 === 0 && f >= lo && f <= hi), nf = F.length;
  const seats = ctx.seats.filter((s) => s.main || t.allSeats), ns = seats.length;
  const chain = F.map((f) => cmul(subResp(t.sub, f), t.signal === 'managed' ? lr4('lp', t.xo, f) : lr4('lp', 120, f)));
  const tgt = F.map((f) => targetAt(f));
  const cands = keep ? currentSubs().map((s) => ({ ...s, label: spotName({ ...s, n: [0, 0] }) })) : subCandidates();
  if (!cands.length) return null;
  // transfer from every candidate to every seat on the band, with the common chain
  const fi = F.map((f) => ctx.F.indexOf(f));
  const Hc = cands.map((c, ci) => seats.map((s) => {
    const tr = ctxTransfer(ctx, c.x, c.y, AC.subZ, s), out = new Float64Array(nf * 2);
    for (let i = 0; i < nf; i++) { const a = tr[2 * fi[i]] * FF, b = tr[2 * fi[i] + 1] * FF, w = chain[i]; out[2 * i] = a * w[0] - b * w[1]; out[2 * i + 1] = a * w[1] + b * w[0]; }
    return out;
  }));
  onProgress(0.1, `${cands.length} spots × ${seats.length} seats`); await tick();
  const rot = (d) => { const c = new Float64Array(nf * 2); for (let i = 0; i < nf; i++) { const ph = -2 * Math.PI * F[i] * d / 1000; c[2 * i] = Math.cos(ph); c[2 * i + 1] = Math.sin(ph); } return c; };
  const rotCache = new Map(), R = (d) => { const k = d.toFixed(2); let r = rotCache.get(k); if (!r) { r = rot(d); rotCache.set(k, r); } return r; };
  const dbs = new Float64Array(ns * nf);
  const evalCfg = (cfg) => {
    for (let s = 0; s < ns; s++) {
      for (let i = 0; i < nf; i++) {
        let re = 0, im = 0;
        for (const q of cfg) {
          const h = Hc[q.c][s], a = 10 ** (q.g / 20) * q.pol, r = R(q.d);
          const hr = h[2 * i] * r[2 * i] - h[2 * i + 1] * r[2 * i + 1], hi2 = h[2 * i] * r[2 * i + 1] + h[2 * i + 1] * r[2 * i];
          re += a * hr; im += a * hi2;
        }
        dbs[s * nf + i] = 10 * Math.log10(re * re + im * im + 1e-30);
      }
    }
    // seat-to-seat variation, flatness of the spatial average, output
    let ssv = 0; const mean = new Float64Array(nf);
    for (let i = 0; i < nf; i++) {
      let m = 0, p = 0; for (let s = 0; s < ns; s++) { m += dbs[s * nf + i]; p += 10 ** (dbs[s * nf + i] / 10); }
      m /= ns; let v = 0; for (let s = 0; s < ns; s++) v += (dbs[s * nf + i] - m) ** 2;
      ssv += Math.sqrt(v / Math.max(1, ns - 1)); mean[i] = 10 * Math.log10(p / ns) - tgt[i];
    }
    ssv /= nf;
    let mu = 0; for (let i = 0; i < nf; i++) mu += mean[i]; mu /= nf;
    let sd = 0; for (let i = 0; i < nf; i++) sd += (mean[i] - mu) ** 2; sd = Math.sqrt(sd / nf);
    return { ssv, flat: sd, level: mu };
  };
  const J = (cfg, m) => bassScore(m, cfg.length, ref);
  // single spots first: the reference output for one sub
  const singles = cands.map((c, i) => { const cfg = [{ c: i, g: 0, d: 0, pol: 1 }]; return { cfg, m: evalCfg(cfg) }; });
  const ref = Math.max(...singles.map((s) => s.m.level));
  singles.forEach((s) => { s.J = J(s.cfg, s.m); });
  let pool;
  if (keep) {
    pool = [{ cfg: cands.map((c, i) => ({ c: i, g: c.g || 0, d: c.d || 0, pol: c.pol || 1 })) }];
  } else if (n === 1) pool = singles.slice().sort((a, b) => a.J - b.J).slice(0, 4);
  else {
    const pairs = [];
    for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) { const cfg = [{ c: i, g: 0, d: 0, pol: 1 }, { c: j, g: 0, d: 0, pol: 1 }]; const m = evalCfg(cfg); pairs.push({ cfg, m, J: J(cfg, m) }); }
    pairs.sort((a, b) => a.J - b.J);
    onProgress(0.35, `${pairs.length} pairs compared`); await tick();
    pool = pairs.slice(0, 10);
    for (let size = 3; size <= n; size++) {
      const next = [];
      for (const p of pool) for (let k = 0; k < cands.length; k++) {
        if (p.cfg.some((q) => q.c === k)) continue;
        const cfg = [...p.cfg, { c: k, g: 0, d: 0, pol: 1 }]; const m = evalCfg(cfg); next.push({ cfg, m, J: J(cfg, m) });
      }
      next.sort((a, b) => a.J - b.J);
      pool = []; for (const c of next) { const key = c.cfg.map((q) => q.c).sort((a, b) => a - b).join(','); if (!pool.some((p) => p.key === key)) pool.push({ ...c, key }); if (pool.length >= 8) break; }
      onProgress(0.35 + 0.15 * (size - 2), `${size} subs: ${next.length} layouts compared`); await tick();
    }
    // move one sub at a time to wherever it helps most
    for (const p of pool.slice(0, 4)) {
      for (let round = 0; round < 3; round++) {
        let improved = false;
        for (let q = 0; q < p.cfg.length; q++) for (let k = 0; k < cands.length; k++) {
          if (p.cfg.some((x) => x.c === k)) continue;
          const cfg = p.cfg.map((x, i) => (i === q ? { ...x, c: k } : x)); const m = evalCfg(cfg), j = J(cfg, m);
          if (j < p.J - 1e-6) { p.cfg = cfg; p.m = m; p.J = j; improved = true; }
        }
        if (!improved) break;
      }
      await tick();
    }
    pool.sort((a, b) => a.J - b.J); pool = pool.slice(0, 4);
  }
  onProgress(0.7, 'Tuning gain, delay and polarity'); await tick();
  // DSP: coordinate descent on each sub but the first (gain −6…0 dB, delay 0…12 ms, polarity)
  for (const p of pool) {
    p.m = p.m || evalCfg(p.cfg); p.J = J(p.cfg, p.m);
    if (p.cfg.length < 2) continue;
    for (let round = 0; round < 3; round++) {
      for (let q = 1; q < p.cfg.length; q++) {
        let best = p.cfg[q];
        for (const pol of [1, -1]) for (let d = 0; d <= 12; d += 0.5) for (let g = -6; g <= 0; g += 1) {
          const cfg = p.cfg.map((x, i) => (i === q ? { ...x, g, d, pol } : x)); const m = evalCfg(cfg), j = J(cfg, m);
          if (j < p.J - 1e-6) { p.J = j; p.m = m; best = cfg[q]; }
        }
        p.cfg = p.cfg.map((x, i) => (i === q ? best : x));
      }
      await tick();
    }
  }
  pool.sort((a, b) => a.J - b.J);
  const seen = new Set(); pool = pool.filter((p) => { const k = p.cfg.map((q) => `${q.c}:${q.g}:${q.d}:${q.pol}`).sort().join('|'); if (seen.has(k)) return false; seen.add(k); return true; });
  onProgress(1, 'Done');
  return pool.map((p) => ({ score: p.J, ...p.m, subs: p.cfg.map((q) => ({ x: cands[q.c].x, y: cands[q.c].y, g: q.g, d: q.d, pol: q.pol, label: cands[q.c].label })) }));
}
/** Evaluate a list of sub configurations the same way the optimiser does (for the comparison table). */
function compareConfigs(configs) {
  const ctx = bassCtx(); if (!ctx) return [];
  const ref = Math.max(...subCandidates().slice(0, 40).map((c) => bassMetrics(bassResponses(ctx, [{ ...c, g: 0, d: 0, pol: 1 }]), ctx.F).level), -99);
  return configs.map((cfg) => { const m = bassMetrics(bassResponses(ctx, cfg.subs), ctx.F); return { ...cfg, ...m, score: bassScore(m, cfg.subs.length, ref) }; });
}

// ---------------- automatic EQ ----------------
/** Parametric EQ (cuts, and small boosts only for broad dips) fitting the seating area's average to the target. */
function autoEQ(ctx, subs, max = 6) {
  const F = ctx.F, rs = bassResponses(ctx, subs, { eq: null }), m0 = bassMetrics(rs, F);
  const lo = 18, hi = Math.min(160, bassBand()[1] + 20), idx = F.map((f, i) => i).filter((i) => F[i] >= lo && F[i] <= hi);
  const base = smoothDb(m0.mean, 6);
  const ref = (() => { const v = idx.filter((i) => F[i] >= 30 && F[i] <= 90).map((i) => base[i] - targetAt(F[i])).sort((a, b) => a - b); return v[Math.floor(v.length * 0.4)] || 0; })();
  const err = (filters) => idx.map((i) => base[i] + 20 * Math.log10(Math.hypot(...eqResp(filters, F[i]))) - targetAt(F[i]) - ref);
  const cost = (filters) => { const e = err(filters); return e.reduce((a, b) => a + b * b, 0) / e.length; };
  const filters = [];
  for (let n = 0; n < max; n++) {
    const e = err(filters); let bi = 0; e.forEach((v, i) => { if (v > e[bi]) bi = i; });
    let gain = -e[bi], fc = F[idx[bi]];
    if (e[bi] < 1.5) {                                                       // no peaks left: one broad, gentle boost at most
      let wi = 0; e.forEach((v, i) => { if (v < e[wi]) wi = i; });
      let a = wi, b = wi; while (a > 0 && e[a - 1] < e[wi] / 2) a--; while (b < e.length - 1 && e[b + 1] < e[wi] / 2) b++;
      const bw = Math.log2(F[idx[b]] / F[idx[a]]);
      if (e[wi] > -3 || bw < 0.4 || filters.some((q) => q.g > 0)) break;
      gain = Math.min(3, -e[wi]); fc = F[idx[wi]];
    }
    let a = bi, b = bi; while (a > 0 && e[a - 1] > e[bi] / 2) a--; while (b < e.length - 1 && e[b + 1] > e[bi] / 2) b++;
    const bw = Math.max(1 / 12, Math.log2(F[idx[b]] / F[idx[a]])), q = clamp(Math.sqrt(2 ** bw) / (2 ** bw - 1), 0.7, 8);
    const near = filters.find((x) => Math.abs(Math.log2(x.f / fc)) < 1 / 6);
    if (near) { near.g = clamp(near.g + gain * 0.7, -12, 3); if (n > max + 2) break; } else filters.push({ f: fc, g: clamp(gain, -12, 3), q });
    // refine every filter a little
    for (let pass = 0; pass < 2; pass++) for (const fl of filters) {
      for (const [k, steps] of [['g', [-1, -0.5, 0.5, 1]], ['q', [0.8, 1.25]], ['f', [2 ** (-1 / 24), 2 ** (1 / 24)]]]) {
        let best = cost(filters), bv = fl[k];
        for (const s of steps) { const old = fl[k]; fl[k] = k === 'g' ? clamp(old + s, -12, 3) : k === 'q' ? clamp(old * s, 0.7, 8) : clamp(old * s, lo, hi); const c = cost(filters); if (c < best) { best = c; bv = fl[k]; } fl[k] = old; }
        fl[k] = bv;
      }
    }
  }
  filters.sort((a, b) => a.f - b.f);
  filters.forEach((q) => { q.f = Math.round(q.f * 10) / 10; q.g = Math.round(q.g * 10) / 10; q.q = Math.round(q.q * 100) / 100; });
  return filters.filter((q) => Math.abs(q.g) >= 0.5);
}

// ---------------- impulse response, waterfall, decay ----------------
function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inverse ? 2 : -2) * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let j = 0; j < len / 2; j++) {
      const a = i + j, b = a + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
      re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
/** Impulse response at a seat (fs 800 Hz, 5.1 s) for a sub configuration, from the same modal model. */
function bassImpulse(ctx, subs, seat, eq) {
  const fs = 800, N = 4096, df = fs / N, half = N / 2, t = state.tune;
  const F = Array.from({ length: half + 1 }, (_, k) => Math.max(k * df, 0.01));
  const inv = acInv(ctx.S, ctx.damp, F), cr = seat.c || acCoef(ctx.S, seat.x, seat.y, seat.z);
  const re = new Float64Array(N), im = new Float64Array(N);
  const mains = t.signal === 'managed' ? currentMains() : [];
  const add = (cs, wf) => {
    const tr = acTransfer(inv, cs, cr);
    for (let k = 1; k <= half; k++) {
      const f = F[k], w = wf(f), taper = f < 220 ? 1 : f > 295 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (f - 220) / 75);
      const a = tr[2 * k] * FF * taper, b = tr[2 * k + 1] * FF * taper;
      re[k] += a * w[0] - b * w[1]; im[k] += a * w[1] + b * w[0];
    }
  };
  for (const s of subs) add(acCoef(ctx.S, s.x, s.y, AC.subZ), (f) => { let w = cmul(subW(s, f), cmul(subResp(t.sub, f), lr4('lp', t.signal === 'managed' ? t.xo : 120, f))); if (eq) w = cmul(w, eqResp(eq, f)); const gd = -2 * Math.PI * f * (t.gdelay || 0) / 1000; return cmul(w, [Math.cos(gd), Math.sin(gd)]); });
  for (const m of mains) add(acCoef(ctx.S, m.x, m.y, 30), (f) => { const w = mainChain(f); return [w[0] * 0.5 * (t.subPol === -1 ? -1 : 1), w[1] * 0.5 * (t.subPol === -1 ? -1 : 1)]; });
  for (let k = 1; k < half; k++) { re[N - k] = re[k]; im[N - k] = -im[k]; }
  im[half] = 0;
  fft(re, im, true);
  return { h: re, fs, N };
}
/** Cumulative spectral decay: spectra (dB) of the impulse response from successive start times (ms). */
function waterfall(ir, F, times = Array.from({ length: 16 }, (_, i) => i * 25), win = 0.4) {
  const { h, fs, N } = ir, L = Math.round(win * fs), out = [];
  for (const t0 of times) {
    const s0 = Math.round(t0 / 1000 * fs), re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < L && s0 + i < N; i++) re[i] = h[s0 + i] * 0.5 * (1 + Math.cos(Math.PI * i / L));   // half-Hann tail
    fft(re, im);
    const mag = F.map((f) => { const x = f * N / fs, k = Math.floor(x), u = x - k; const m0 = Math.hypot(re[k], im[k]), m1 = Math.hypot(re[k + 1], im[k + 1]); return 20 * Math.log10(lerp(m0, m1, u) + 1e-12); });
    out.push({ t: t0, db: mag });
  }
  return out;
}
const THIRDS = [20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200];
/** Low-frequency decay time per third octave: band-filtered (time-reversed, so the filter's own ringing doesn't
 *  lengthen the decay, as ISO 3382 suggests for low frequencies), Schroeder backward integration, T30 (or T20). */
function bandDecay(ir) {
  const { h, fs, N } = ir;
  const bp = (x, fc) => {                                  // two RBJ band-pass sections (0 dB peak), 1/3 octave
    const w0 = 2 * Math.PI * fc / fs, Q = 4.32, al = Math.sin(w0) / (2 * Q), a0 = 1 + al, a1 = -2 * Math.cos(w0) / a0, a2 = (1 - al) / a0, b0 = al / a0, b2 = -al / a0;
    for (let pass = 0; pass < 2; pass++) { let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const y = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y; } }
  };
  return THIRDS.map((fc) => {
    const x = new Float64Array(N); for (let i = 0; i < N; i++) x[i] = h[N - 1 - i];
    bp(x, fc); x.reverse();
    const e = new Float64Array(N); let acc = 0; for (let i = N - 1; i >= 0; i--) { acc += x[i] * x[i]; e[i] = acc; }
    let i0 = 0; for (let i = 1; i < N; i++) if (e[i - 1] - e[i] > e[i0 > 0 ? i0 - 1 : 0] - e[i0]) i0 = i;   // start at the strongest arrival
    const e0 = e[i0] || 1, L = (i) => 10 * Math.log10(e[i] / e0 + 1e-30);
    let a = -1, b = -1; for (let i = i0; i < N; i++) { const l = L(i); if (a < 0 && l <= -5) a = i; if (l <= -35) { b = i; break; } }
    let span = 30; if (b < 0) { span = 20; for (let i = Math.max(a, i0); i < N; i++) if (L(i) <= -25) { b = i; break; } }
    if (a < 0 || b <= a) return { fc, t60: null };
    let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
    for (let i = a; i <= b; i++) { const xx = i / fs, y = L(i); sx += xx; sy += y; sxx += xx * xx; sxy += xx * y; n++; }
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    return { fc, t60: slope < 0 ? -60 / slope : null, span };
  });
}
/** Target for the low-frequency decay: about the mid-band reverb time + 0.1 s, allowed to rise below 63 Hz. */
const decayTarget = (fc, rtMid) => (rtMid + 0.1) * (fc >= 63 ? 1 : 1 + 0.6 * Math.log2(63 / fc) / Math.log2(63 / 20));

// ---------------- the sofa's position in the room ----------------
/** Move the main seating forward / back and see what the bass does at the seats (subs stay put). */
function rowSweep(ctx, subs) {
  const L = mainSeatLine(); if (!L) return null;
  const out = [];
  for (let off = -42; off <= 42; off += 3) {
    const dx = L.ez[0] * off, dy = L.ez[1] * off;
    const fits = itemObjects.get(L.it.id) ? fitsRoom(L.it, L.it.x + dx, L.it.y + dy) : true;
    const seats = acSeats([dx, dy]).filter((s) => s.main).map((s) => ({ ...s, c: acCoef(ctx.S, s.x, s.y, s.z) }));
    const rs = bassResponses(ctx, subs, { seats, eq: null }), m = bassMetrics(rs, ctx.F);
    out.push({ off, fits, ssv: m.ssv, flat: m.flatMlp, score: m.flatMlp + 0.5 * m.ssv });
  }
  const ok = out.filter((o) => o.fits), best = ok.length ? ok.reduce((a, b) => (b.score < a.score ? b : a)) : null;
  return { pts: out, best, cur: out.find((o) => o.off === 0), dir: L.ez };
}
/** Put the subs from a configuration into the layout (replacing the current ones). */
function applySubConfig(subs) {
  pushHistory();
  for (const it of state.items.filter((i) => i.type === 'subwoofer')) {
    const obj = itemObjects.get(it.id); if (obj) { itemsGroup.remove(obj.group); disposeGroup(obj.group); itemObjects.delete(it.id); }
    delete state.tune.dsp[it.id];
  }
  state.items = state.items.filter((i) => i.type !== 'subwoofer');
  const G = geom(), c = [state.room.width * 0.55, G.mainY * 0.5];
  subs.forEach((s, i) => {
    const it = { id: uid('sub'), type: 'subwoofer', x: s.x, y: s.y, rot: 0, p: {} };
    it.rot = squareFacing(it, c[0], c[1]);
    state.items.push(it); buildItem(it);
    if (!fitsRoom(it)) { const p = nearestFit(it, it.x, it.y); if (p) [it.x, it.y] = p; }
    placeItem(itemObjects.get(it.id).group, it);
    state.tune.dsp[it.id] = { g: s.g || 0, d: s.d || 0, pol: s.pol || 1 };
  });
  updateLighting(); select(null); commit(false);
}
