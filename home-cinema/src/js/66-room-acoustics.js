// ===================================================================
// 66 · Room acoustics above the bass: reverberation time per octave (Sabine and Eyring, from the actual
// surfaces, furniture and treatment), first reflections from every speaker to every seat (image sources
// on the real walls, ceiling and floor, with the speaker's directivity and the absorption where each one
// lands), speaker layouts from 2.1 to 9.1.6 placed on this room's walls and ceiling after Dolby's angles,
// level headroom, and the scorecard and advice that tie the whole analysis together.
// ===================================================================

// ---------------- surfaces and reverberation ----------------
/** The cinema's own volume (the room and alcove, not the stairs and hall) and what lines it. */
function rtModel() {
  const S = ACS, r = state.room, G = geom(), t = state.tune, f = state.finish, H = acM(r.ceiling);
  let floorIn = 0, wallIn = 0, openIn = 0;
  if (S) {
    const g = S.grid;
    for (let k = 0; k < g.N; k++) if (g.room[k]) { floorIn += g.g * g.g; wallIn += g.wallF[k] * g.g; }
    for (let e = 0; e < g.edges.length; e += 2) if (g.room[g.edges[e]] !== g.room[g.edges[e + 1]]) openIn += g.g;
  }
  const Fl = floorIn * AC.IN * AC.IN, V = Fl * H;
  const sq = (a, b) => a * b * AC.IN * AC.IN;                         // in × in -> m²
  const surf = [], add = (key, label, area, mat) => { if (area > 0.01) surf.push({ key, label, area, a: (ABS[mat] || ABS.drywall).a, mat }); };
  // special areas on the walls
  const tr = 2 * sq(r.transomW, r.transomH), trMat = f.transoms === 'hidden' ? 'drywall' : f.transoms === 'slatted' ? 'slats' : 'glass';
  const fpA = sq(state.fireplace.width, state.fireplace.height);
  const tvD = state.tv.screen && state.light.screenDown ? tvDims(state.tv.screenSize) : tvDims(state.tv.size), tvA = sq(tvD.w, tvD.h);
  const fpSlats = f.fireplaceSlats ? sq(2 * (r.transomW + 14), r.transomH + 24) : 0;
  const tvSlats = f.tvSlats ? Math.max(0, sq(r.bayFace, r.soffitBottom) - tvA) : 0;
  let panelArea = { panel2: 0, slatPanel: 0, panel4: 0 };
  for (const it of state.items) if (it.type === 'acousticPanel') { const p = { ...CATALOG.acousticPanel.defaults, ...it.p }; panelArea[resolveSpec(it).variant === 'slat' ? 'slatPanel' : 'panel2'] += sq(p.w, p.hgt); }
  if (t.reflPanels) panelArea.panel2 += acReflectionPanelSpots().length * sq(24, 48);
  if (t.rearPanels) panelArea.panel4 += acRearSpots().length * sq(24, 48);
  const wallA = Math.max(0, wallIn * AC.IN * H - tr - fpA - tvA - fpSlats - tvSlats - panelArea.panel2 - panelArea.slatPanel - panelArea.panel4);
  let rugA = 0; for (const it of state.items) if (it.type === 'rug') rugA += sq(it.p.w || 96, it.p.d || 72);
  rugA = Math.min(rugA, Fl * 0.8);
  const cloudA = t.cloud ? sq(48, 72) : 0;
  add('walls', 'Walls · drywall on studs', wallA, 'drywall');
  add('ceiling', 'Ceiling · drywall', Fl - cloudA, 'ceiling');
  add('floor', 'Floor · laminate on the slab', Fl - rugA, 'laminate');
  add('rug', 'Rugs', rugA, 'rug');
  add('transoms', `Transom openings · ${trMat === 'glass' ? 'glass' : trMat === 'slats' ? 'slats over glass' : 'closed in'}`, tr, trMat);
  add('fireplace', 'Fireplace glass and surround', fpA, 'stone');
  add('tv', state.tv.screen && state.light.screenDown ? 'Projection screen' : 'TV', tvA, 'tv');
  add('fpslats', 'Walnut slats over felt · fireplace wall', fpSlats, 'slats');
  add('tvslats', 'Walnut slats over felt · TV wall', tvSlats, 'slats');
  add('panel2', '2″ panels', panelArea.panel2, 'panel2');
  add('slatPanel', 'Slatted acoustic panels', panelArea.slatPanel, 'slatPanel');
  add('panel4', '4″ panels (rear wall)', panelArea.panel4, 'panel4');
  add('cloud', 'Ceiling cloud · 4″ over the seats', cloudA, 'panel4');
  add('open', 'Open to the stairs and hall', openIn * AC.IN * H, 'opening');
  const ab = acAbsorbers();
  const units = [
    { label: `Upholstered seating (${Math.round(ab.seats)} seats)`, n: ab.seats, a: UNITS.seat.a },
    ab.people ? { label: `People (${ab.people})`, n: ab.people, a: UNITS.person.a } : null,
    ab.traps.length ? { label: `Corner bass traps (${ab.traps.length})`, n: ab.traps.length, a: UNITS.trap.a } : null,
  ].filter(Boolean);
  const Stot = surf.reduce((s, q) => s + q.area, 0);
  const bands = OCT.map((fq, i) => {
    const As = surf.reduce((s, q) => s + q.area * q.a[i], 0), Au = units.reduce((s, u) => s + u.n * u.a[i], 0), m4 = 4 * AIR_M[i] * V;
    const sab = 0.161 * V / (As + Au + m4);
    const abar = clamp((As + Au) / Stot, 0, 0.98), ey = 0.161 * V / (-Stot * Math.log(1 - abar) + m4);
    return { f: fq, sabine: sab, eyring: ey, A: As + Au };
  });
  const mid = (bands[3].eyring + bands[4].eyring + bands[5].eyring) / 3;
  return { V, S: Stot, floor: Fl, surf, units, bands, rtMid: mid, schroeder: 2000 * Math.sqrt(mid / V), openArea: openIn * AC.IN * H };
}
/** Recommended reverberation time per octave for a room this size (small rooms: short and even). */
const rtTarget = (fq) => ({ lo: 0.2, hi: fq <= 63 ? 0.6 : fq <= 125 ? 0.5 : 0.4 });

// ---------------- walls for geometry ----------------
/** The cinema's wall segments (clipped to the room side of the stairs), with names as you face the TV. */
function roomWalls() {
  const r = state.room, G = geom(), o = G.outline, out = [];
  for (let i = 0; i < o.length; i++) {
    let a = o[i], b = o[(i + 1) % o.length];
    if (a[1] < -0.5 && b[1] < -0.5) continue;
    if (a[1] < 0 || b[1] < 0) {                                           // clip to y >= 0
      const t = (0 - a[1]) / (b[1] - a[1]); const c = [a[0] + (b[0] - a[0]) * t, 0];
      if (a[1] < 0) a = c; else b = c;
    }
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 3) continue;
    out.push({ a, b });
  }
  out.push({ a: [r.width, 0], b: [G.wallX, 0] });                           // the solid wall beside the stairs
  for (const w of out) {
    const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], L = Math.hypot(dx, dy);
    w.n = [-dy / L, dx / L];                                               // outline is counter-clockwise: interior on the left
    if (w.a[1] === 0 && w.b[1] === 0 && w.a[0] > w.b[0]) w.n = [0, 1];
    w.len = L;
    const mid = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
    w.name = mid[1] > G.mainY + 1 ? (Math.abs(w.n[0]) > 0.3 && Math.abs(w.n[1]) > 0.3 ? 'alcove corner' : Math.abs(w.n[1]) > 0.9 ? 'TV wall' : 'alcove side')
      : w.n[0] > 0.9 ? 'left wall' : w.n[0] < -0.9 ? 'right wall' : w.n[1] < -0.9 ? 'front wall' : w.n[1] > 0.9 ? 'back wall' : 'wall';
  }
  return out;
}
const inCinema = (x, y) => y >= 0 && pointInPoly([x, y], geom().outline);
/** Which material is at a point on a wall (or the floor / ceiling) — for the reflection's absorption. */
function surfaceAt(kind, x, y, z, wall) {
  const r = state.room, G = geom(), f = state.finish, t = state.tune;
  const near = (spots, rad) => spots.some((s) => Math.hypot(s.x - x, s.y - y) < rad && Math.abs((s.z ?? z) - z) < 26);
  if (kind === 'floor') return state.items.some((it) => it.type === 'rug' && footprint(it) && pointInPoly([x, y], footprint(it))) ? 'rug' : 'laminate';
  if (kind === 'ceiling') { const m = mainSeat(); return t.cloud && m && Math.abs(x - m.x) < 36 && Math.abs(y - (m.y + 20)) < 24 ? 'panel4' : 'ceiling'; }
  for (const it of state.items) if (it.type === 'acousticPanel') {
    const p = { ...CATALOG.acousticPanel.defaults, ...it.p };
    if (Math.hypot(it.x - x, it.y - y) < p.w / 2 + 2 && Math.abs(z - p.h) < p.hgt / 2 + 2) return resolveSpec(it).variant === 'slat' ? 'slatPanel' : 'panel2';
  }
  if (t.reflPanels && near(acReflectionPanelSpots(), 14)) return 'panel2';
  if (t.rearPanels && near(acRearSpots(), 14)) return 'panel4';
  if (wall && wall.name === 'left wall' && x < 2) {                          // the fireplace wall
    const fp = state.fireplace;
    if (Math.abs(y - fp.center) < fp.width / 2 && z > fp.bottom && z < fp.bottom + fp.height) return 'stone';
    const u = Math.abs(y - fp.center);
    if (z > r.transomBottom && z < r.transomBottom + r.transomH && u > r.transomGap / 2 && u < r.transomGap / 2 + r.transomW) return f.transoms === 'hidden' ? 'drywall' : f.transoms === 'slatted' || f.fireplaceSlats ? 'slats' : 'glass';
  }
  if (wall && wall.name === 'TV wall') {
    const d = state.tv.screen && state.light.screenDown ? { ...tvDims(state.tv.screenSize), c: 50 } : { ...tvDims(state.tv.size), c: state.tv.center };
    if (Math.abs(x - (G.tvX + state.tv.offset)) < d.w / 2 && Math.abs(z - d.c) < d.h / 2) return 'tv';
    if (f.tvSlats) return 'slats';
  }
  return 'drywall';
}
const MAT_NAME = { drywall: 'drywall', ceiling: 'drywall ceiling', laminate: 'laminate floor', rug: 'rug', glass: 'glass', tv: 'TV glass', stone: 'fireplace glass', slats: 'slats over felt', panel2: '2″ panel', panel4: '4″ panel', slatPanel: 'slat panel', opening: 'opening' };

// ---------------- first reflections ----------------
/** Speaker directivity at angle th off its axis (mid/high band, typical 2-way). */
const dirDb = (th) => Math.max(-18, 24 * Math.log10((1 + Math.cos(th)) / 2 + 1e-6));
/** First-order reflections from a speaker (aimed at aim) to a listener: walls, ceiling and floor. */
function firstReflections(spk, lis, aim = lis) {
  const H = state.room.ceiling, walls = roomWalls(), c = 343 / AC.IN;     // inches per second
  const d0 = Math.hypot(lis.x - spk.x, lis.y - spk.y, lis.z - spk.z);
  const ax = [aim.x - spk.x, aim.y - spk.y, aim.z - spk.z], al = Math.hypot(...ax);
  const off = (R) => { const v = [R[0] - spk.x, R[1] - spk.y, R[2] - spk.z], l = Math.hypot(...v); return Math.acos(clamp((v[0] * ax[0] + v[1] * ax[1] + v[2] * ax[2]) / (l * al), -1, 1)); };
  const out = [];
  const push = (surface, R, path, kind, wall) => {
    const mat = surfaceAt(kind, R[0], R[1], R[2], wall), a = octAt(ABS[mat].a, 2000);
    const level = 20 * Math.log10(d0 / path) + 10 * Math.log10(Math.max(0.01, 1 - a)) + dirDb(off(R));
    out.push({ surface, x: R[0], y: R[1], z: R[2], kind, mat, level, delay: (path - d0) / c * 1000, path, treated: a > 0.5 });
  };
  for (const w of walls) {
    const sd = (p) => (p.x - w.a[0]) * w.n[0] + (p.y - w.a[1]) * w.n[1];
    // both in front of the wall; a speaker on (or within 10″ of) a wall couples to it rather than reflecting off it
    const ss = sd(spk), sl = sd(lis); if (ss <= 10 || sl <= 1) continue;
    const im = [spk.x - 2 * ss * w.n[0], spk.y - 2 * ss * w.n[1]];
    const t = ss / (ss + sl), R2 = [im[0] + (lis.x - im[0]) * t, im[1] + (lis.y - im[1]) * t];
    const u = ((R2[0] - w.a[0]) * (w.b[0] - w.a[0]) + (R2[1] - w.a[1]) * (w.b[1] - w.a[1])) / (w.len * w.len);
    if (u < 0.01 || u > 0.99) continue;
    const z = spk.z + (lis.z - spk.z) * t; if (z <= 1 || z >= H - 1) continue;
    const blocked = walls.some((o) => o !== w && (segsCross([spk.x, spk.y], R2, o.a, o.b) || segsCross(R2, [lis.x, lis.y], o.a, o.b)));
    if (blocked) continue;
    const dh = Math.hypot(lis.x - im[0], lis.y - im[1]);
    push(w.name, [R2[0], R2[1], z], Math.hypot(dh, lis.z - spk.z), 'wall', w);
  }
  const dh = Math.hypot(lis.x - spk.x, lis.y - spk.y);
  for (const [kind, zz] of [['floor', 0], ['ceiling', H]]) {
    const a = Math.abs(zz - spk.z), b = Math.abs(zz - lis.z), t = a / (a + b);
    if (a < 10) continue;                                                  // mounted in the ceiling / standing on the floor
    const R = [spk.x + (lis.x - spk.x) * t, spk.y + (lis.y - spk.y) * t, zz];
    if (!inCinema(R[0], R[1])) continue;
    push(kind, R, Math.hypot(dh, a + b), kind);
  }
  return out.sort((p, q) => p.delay - q.delay);
}
/** Where 2″ panels would catch the side-wall first reflections of the front three to the main seat. */
let spotGuard = false, spotCache = null;
function acReflectionPanelSpots() {
  const m = mainSeat(); if (!m || spotGuard) return [];
  const key = JSON.stringify([state.items.map((i) => [i.type, i.x, i.y, i.rot]), state.tune.layout, state.room, state.tv]);
  if (spotCache && spotCache.key === key) return spotCache.spots;
  spotGuard = true;
  try { spotCache = { key, spots: reflSpots(m) }; } finally { spotGuard = false; }
  return spotCache.spots;
}
function reflSpots(m) {
  const lis = { x: m.x, y: m.y, z: AC.ear }, out = [];
  for (const ch of tuneLayout(state.tune.layout, true).filter((c) => ['L', 'C', 'R'].includes(c.k))) {
    const spk = { x: ch.p[0], y: ch.p[1], z: ch.z };
    for (const q of firstReflections(spk, lis)) if (q.kind === 'wall' && /left|right|alcove side/.test(q.surface) && q.delay < 20 && out.every((o) => Math.hypot(o.x - q.x, o.y - q.y) > 20)) out.push({ x: q.x, y: q.y, z: clamp(q.z, 30, 72), surface: q.surface });
  }
  return out;
}
/** Two spots on the wall behind the seats for 4″ panels (the solid part beside the stairs). */
function acRearSpots() {
  const r = state.room, G = geom(), m = mainSeat(); if (!m) return [];
  const xs = [G.wallX + (r.width - G.wallX) * 0.3, G.wallX + (r.width - G.wallX) * 0.7];
  return xs.map((x) => ({ x, y: 1, z: AC.ear + 6 }));
}

// ---------------- speaker layouts ----------------
const LAYOUTS = {
  '2.1': ['L', 'R'], '3.1': ['L', 'C', 'R'], '5.1': ['L', 'C', 'R', 'SL', 'SR'], '7.1': ['L', 'C', 'R', 'SL', 'SR', 'BL', 'BR'],
  '5.1.2': ['L', 'C', 'R', 'SL', 'SR', 'TML', 'TMR'], '5.1.4': ['L', 'C', 'R', 'SL', 'SR', 'TFL', 'TFR', 'TRL', 'TRR'],
  '7.1.4': ['L', 'C', 'R', 'SL', 'SR', 'BL', 'BR', 'TFL', 'TFR', 'TRL', 'TRR'],
  '9.1.6': ['L', 'C', 'R', 'WL', 'WR', 'SL', 'SR', 'BL', 'BR', 'TFL', 'TFR', 'TML', 'TMR', 'TRL', 'TRR'],
};
// Dolby's recommended angles from the main seat (azimuth: 0 ahead, + to the right; elevation for the tops)
const CHANNELS = {
  L: { name: 'Front left', az: -26, rng: [22, 30] }, R: { name: 'Front right', az: 26, rng: [22, 30] }, C: { name: 'Centre', az: 0, rng: [0, 5] },
  WL: { name: 'Wide left', az: -60, rng: [50, 70] }, WR: { name: 'Wide right', az: 60, rng: [50, 70] },
  SL: { name: 'Surround left', az: -100, rng: [90, 110], rng5: [110, 120], az5: -115 }, SR: { name: 'Surround right', az: 100, rng: [90, 110], rng5: [110, 120], az5: 115 },
  BL: { name: 'Rear surround left', az: -142, rng: [135, 150] }, BR: { name: 'Rear surround right', az: 142, rng: [135, 150] },
  TFL: { name: 'Top front left', el: 45, side: -1, erng: [30, 55] }, TFR: { name: 'Top front right', el: 45, side: 1, erng: [30, 55] },
  TML: { name: 'Top middle left', el: 80, side: -1, erng: [65, 100] }, TMR: { name: 'Top middle right', el: 80, side: 1, erng: [65, 100] },
  TRL: { name: 'Top rear left', el: 135, side: -1, erng: [125, 150] }, TRR: { name: 'Top rear right', el: 135, side: 1, erng: [125, 150] },
};
const SPK_CLASSES = {
  bookshelf: { label: 'Bookshelf / on-wall', sens: 86 }, tower: { label: 'Towers in front', sens: 89 },
  inwall: { label: 'In-wall', sens: 88 }, reference: { label: 'High-sensitivity (horn-loaded)', sens: 95 },
};
/** Place a layout's channels in this room from the main seat. quick: positions only. */
function tuneLayout(key = state.tune.layout, quick = false) {
  const m = mainSeat(); if (!m) return [];
  const r = state.room, G = geom(), H = r.ceiling, ear = AC.ear, walls = roomWalls();
  const T = [G.tvX + state.tv.offset, r.depth], fv = [T[0] - m.x, T[1] - m.y], fl = Math.hypot(...fv); fv[0] /= fl; fv[1] /= fl;
  const rt = [fv[1], -fv[0]];
  const ang = (deg) => { const a = deg * DEG; return [fv[0] * Math.cos(a) + rt[0] * Math.sin(a), fv[1] * Math.cos(a) + rt[1] * Math.sin(a)]; };
  const ceilAt = (x, y) => (x < r.beamDepth && y < G.westY && y > G.westY - 40 ? r.beamBottom : y > G.mainY + G.ret - r.soffitDepth && y > G.mainY ? r.soffitBottom : H);
  const towers = state.items.filter((i) => i.type === 'towerSpeaker');
  const five = !(LAYOUTS[key] || []).includes('BL');
  const out = [];
  // the front pair: towers if the layout has them, else in the alcove at about 26°
  const frontY = G.mainY + G.ret - 4, along = frontY - m.y;
  const frontAt = (side) => {
    const tw = towers.map((t) => ({ x: t.x, y: t.y })).sort((a, b) => a.x - b.x);
    if (tw.length >= 2) return { p: [side < 0 ? tw[0].x : tw[tw.length - 1].x, side < 0 ? tw[0].y : tw[tw.length - 1].y], z: 36, how: 'tower', mount: 'floor' };
    const lat = along * Math.tan(26 * DEG);
    return { p: [clamp(m.x + side * lat, r.bayLeft + 8, r.bayRight - 8), frontY], z: 40, how: 'on stands or on the wall', mount: 'stand' };
  };
  for (const k of LAYOUTS[key] || []) {
    const ch = CHANNELS[k]; let pos;
    if (k === 'L' || k === 'R') pos = frontAt(k === 'L' ? -1 : 1);
    else if (k === 'C') {
      const scr = state.tv.screen && state.light.screenDown;
      pos = { p: [G.tvX + state.tv.offset, r.depth - 8], z: scr ? 50 : Math.max(14, state.tv.center - tvDims(state.tv.size).h / 2 - 8), how: scr ? 'behind the acoustically transparent screen' : 'under the TV', mount: 'stand' };
    } else if (ch.az != null) {
      const az = five && ch.az5 ? ch.az5 : ch.az, d = ang(az);
      // cast from the seat to the first wall in that direction
      let best = null;
      for (const w of walls) {
        const ex = w.b[0] - w.a[0], ey = w.b[1] - w.a[1], den = d[0] * ey - d[1] * ex; if (Math.abs(den) < 1e-9) continue;
        const tt = ((w.a[0] - m.x) * ey - (w.a[1] - m.y) * ex) / den, u = ((w.a[0] - m.x) * d[1] - (w.a[1] - m.y) * d[0]) / den;
        if (tt > 6 && u >= 0 && u <= 1 && (!best || tt < best.t)) best = { t: tt, w };
      }
      // does the ray leave through the opening to the stairs first?
      const tOpen = d[1] < -1e-6 ? -m.y / d[1] : Infinity, xo = m.x + d[0] * tOpen;
      const throughOpening = tOpen < (best ? best.t : Infinity) && xo > r.boxX && xo < G.wallX;
      if (best && !throughOpening) {
        const pt = [m.x + d[0] * (best.t - 3), m.y + d[1] * (best.t - 3)];
        pos = { p: pt, z: ear + (Math.abs(az) >= 90 ? 18 : 6), how: `on the ${best.w.name}, ${ftin(ear + (Math.abs(az) >= 90 ? 18 : 6))} up`, mount: 'wall' };
      } else {
        const dd = Math.min(tOpen - 6, 60), pt = [m.x + d[0] * dd, m.y + d[1] * dd];
        pos = { p: pt, z: ceilAt(pt[0], pt[1]), how: 'no wall there (stair opening): in-ceiling, angled toward the seats', mount: 'ceiling', fallback: true };
      }
    } else {
      // overhead: in line with the front pair, at the elevation Dolby recommends
      const lat = Math.max(30, along * Math.tan(26 * DEG)) * ch.side, el = ch.el * DEG;
      const fwd = Math.abs(ch.el - 90) < 1 ? 0 : (H - ear) / Math.tan(el);
      let pt = [m.x + fv[0] * fwd + rt[0] * lat, m.y + fv[1] * fwd + rt[1] * lat], note = 'in-ceiling';
      if (!inCinema(pt[0], pt[1])) { pt = [clamp(pt[0], 6, r.width - 6), clamp(pt[1], 6, G.mainY + G.ret - 6)]; note = 'in-ceiling (pulled in from over the stair opening)'; }
      pos = { p: pt, z: ceilAt(pt[0], pt[1]), how: note, mount: 'ceiling' };
    }
    out.push({ k, name: ch.name, ...pos });
  }
  if (quick) return out;
  // actual angles, distances, delays and trims
  const far = Math.max(...out.map((c) => Math.hypot(c.p[0] - m.x, c.p[1] - m.y, c.z - ear)));
  const cls = SPK_CLASSES[state.tune.spk] || SPK_CLASSES.bookshelf, P = state.tune.amp || 100;
  for (const c of out) {
    const v = [c.p[0] - m.x, c.p[1] - m.y], hd = Math.hypot(...v), dist = Math.hypot(hd, c.z - ear);
    const az = Math.atan2(v[0] * rt[0] + v[1] * rt[1], v[0] * fv[0] + v[1] * fv[1]) / DEG;
    const elRaw = Math.atan2(c.z - ear, hd) / DEG, fwd = v[0] * fv[0] + v[1] * fv[1];
    const ch = CHANNELS[c.k];
    c.az = az; c.dist = dist; c.delay = (far - dist) * AC.IN / 343 * 1000; c.trim = -20 * Math.log10(far / dist);
    // Dolby's elevation for the tops is seen from the side: 0° ahead, 90° overhead, 180° behind
    if (ch.erng) { c.el = Math.atan2(c.z - ear, fwd) / DEG; c.target = `${ch.erng[0]}–${ch.erng[1]}° up`; c.ok = c.el >= ch.erng[0] - 3 && c.el <= ch.erng[1] + 3; c.actual = `${Math.round(c.el)}° up`; }
    else { const rng = five && ch.rng5 ? ch.rng5 : ch.rng; c.target = c.k === 'C' ? 'on axis' : `${rng[0]}–${rng[1]}°`; c.ok = Math.abs(az) >= rng[0] - 3 && Math.abs(az) <= rng[1] + 3; c.actual = `${Math.round(Math.abs(az))}° ${az < -1 ? 'left' : az > 1 ? 'right' : ''}`.trim(); c.el = elRaw; }
    const sens = c.how === 'tower' ? SPK_CLASSES.tower.sens : cls.sens;
    c.maxSpl = sens + 10 * Math.log10(P) - 20 * Math.log10(Math.max(0.3, dist * AC.IN)) + 2 - 1;  // + room field, − power compression
    c.headroom = c.maxSpl - (105 + (state.tune.refLvl ?? -5));
  }
  return out;
}

// ---------------- the whole analysis ----------------
let TA = null;                                         // last analysis
function analyseRoom() {
  const ctx = bassCtx(); if (!ctx) return null;
  const t = state.tune, subs = currentSubs(), F = ctx.F;
  const raw = bassResponses(ctx, subs, { eq: null }), mRaw = bassMetrics(raw, F);
  const eq = t.eqOn ? (t.eq && t.eq.length ? t.eq : autoEQ(ctx, subs)) : [];
  const resp = eq.length ? bassResponses(ctx, subs, { eq }) : raw, m = eq.length ? bassMetrics(resp, F) : mRaw;
  // headroom at the main seat: in-room maximum vs 115 dB LFE peaks
  const mlpSeat = ctx.seats.find((s) => s.mlp) || ctx.seats[0];
  const lfe = bassResponses(ctx, subs, { eq: eq.length ? eq : null, signal: 'lfe', seats: [mlpSeat] })[0];
  const gmax = Math.max(...subs.map((s) => 10 ** ((s.g || 0) / 20)));
  const maxSpl = F.map((f, i) => { const boost = eq.length ? Math.max(0, 20 * Math.log10(Math.hypot(...eqResp(eq, f)))) : 0; return lfe.db[i] - 20 * Math.log10(Math.hypot(...lr4('lp', 120, f)) + 1e-9) + subMax(t.sub, f) - boost - 20 * Math.log10(gmax); });
  const hrIdx = F.map((f, i) => i).filter((i) => F[i] >= 25 && F[i] <= 80);
  const headroom = Math.min(...hrIdx.map((i) => smoothDb(maxSpl, 6)[i])) - (115 + (t.refLvl ?? -5));
  const rt = rtModel();
  const ir = bassImpulse(ctx, subs, mlpSeat, eq.length ? eq : null), decay = bandDecay(ir);
  const lay = tuneLayout(t.layout);
  const mlp = { x: mlpSeat.x, y: mlpSeat.y, z: AC.ear };
  const refl = lay.filter((c) => !c.k.startsWith('T')).map((c) => ({ ch: c, list: firstReflections({ x: c.p[0], y: c.p[1], z: c.z }, mlp) }));
  const early = refl.flatMap((r) => r.list.filter((q) => q.delay < 15).map((q) => ({ ...q, ch: r.ch.k })));
  // the floor bounce is graded on its own: only a rug treats it, and every room has one
  const worstOf = (l) => (l.length ? l.reduce((a, b) => (b.level > a.level ? b : a)) : null);
  const worst = worstOf(early.filter((q) => q.kind !== 'floor')), floorWorst = worstOf(early.filter((q) => q.kind === 'floor'));
  const sweep = rowSweep(ctx, subs);
  // modal ringing: decay of the bass third-octaves vs target
  const ring = decay.filter((d) => d.t60 && d.fc <= 125).map((d) => d.t60 - decayTarget(d.fc, rt.rtMid));
  TA = { ctx, subs, raw, mRaw, eq, resp, m, maxSpl, headroom, rt, ir, decay, ring: ring.length ? Math.max(...ring) : 0, lay, refl, early, worst, floorWorst, sweep, mlp: mlpSeat, at: Date.now() };
  TA.score = tuneScore(TA); TA.advice = tuneAdvice(TA);
  return TA;
}
const REF_LEVELS = { 0: 'Reference', '-5': 'Reference −5 dB', '-10': 'Reference −10 dB' };
const refName = () => `${REF_LEVELS[state.tune.refLvl ?? -5] || 'Reference'}`;
const grade = (v, cuts) => (v <= cuts[0] ? 'A' : v <= cuts[1] ? 'B' : v <= cuts[2] ? 'C' : 'D');
const GRADE_PTS = { A: 100, B: 78, C: 55, D: 30 };
/** The scorecard: each line as a pro would grade it. */
function tuneScore(A) {
  const t = state.tune, rows = [];
  const rtDev = Math.max(0, A.rt.rtMid - 0.4, 0.2 - A.rt.rtMid);
  const lay = A.lay, okN = lay.filter((c) => c.ok).length, minHr = Math.min(...lay.map((c) => c.headroom));
  rows.push({ key: 'ssv', label: 'Bass, seat to seat', value: `±${A.m.ssv.toFixed(1)} dB`, g: grade(A.m.ssv, [2.5, 3.5, 5]), note: 'How alike the bass sounds across the sofa (20–100 Hz). Fixed by sub placement, not EQ.' });
  rows.push({ key: 'flat', label: 'Bass smoothness', value: `±${A.m.flat.toFixed(1)} dB`, g: grade(A.m.flat, [2, 3, 4.5]), note: `Seating-area average against the ${TARGETS[t.target].label.toLowerCase()}${A.eq.length ? `, with ${A.eq.length} EQ filters` : ''}.` });
  rows.push({ key: 'ring', label: 'Bass decay (ringing)', value: `${A.ring > 0 ? '+' : ''}${A.ring.toFixed(2)} s`, g: grade(A.ring, [0, 0.1, 0.25]), note: 'Worst third octave below 125 Hz against the decay target. Bass traps shorten it.' });
  rows.push({ key: 'head', label: 'Bass headroom', value: `${A.headroom >= 0 ? '+' : ''}${A.headroom.toFixed(1)} dB`, g: grade(-A.headroom, [-3, 0, 4]), note: `${115 + (t.refLvl ?? -5)} dB LFE peaks at the main seat (${refName()}), 25–80 Hz, after EQ.` });
  rows.push({ key: 'rt', label: 'Reverberation', value: `${A.rt.rtMid.toFixed(2)} s`, g: grade(rtDev, [0, 0.05, 0.15]), note: 'Mid-band RT60 (500 Hz–2 kHz, Eyring). Target 0.2–0.4 s for a room this size.' });
  rows.push({ key: 'refl', label: 'Early reflections', value: A.worst ? `${A.worst.level.toFixed(1)} dB` : 'none', g: grade(A.worst ? A.worst.level : -30, [-15, -10, -6]), note: A.worst ? `Loudest in the first 15 ms: ${CHANNELS[A.worst.ch].name.toLowerCase()} off the ${A.worst.surface}, ${A.worst.delay.toFixed(1)} ms late.` : 'No early reflections at the main seat.' });
  rows.push({ key: 'angles', label: 'Speaker placement', value: `${okN} of ${lay.length}`, g: grade(lay.length - okN, [0, 1, 3]), note: `Channels inside Dolby's recommended angles for ${t.layout}.` });
  rows.push({ key: 'spl', label: 'Speaker headroom', value: `${minHr >= 0 ? '+' : ''}${minHr.toFixed(1)} dB`, g: grade(-minHr, [-3, 0, 4]), note: `${105 + (t.refLvl ?? -5)} dB peaks at the main seat from every channel (${refName()}; ${SPK_CLASSES[t.spk].label.toLowerCase()}, ${t.amp} W).` });
  rows.push({ key: 'iso', label: 'Sound to the floor above', value: t.door ? 'door' : 'open stairwell', g: t.door ? 'B' : 'D', note: t.door ? 'A solid-core door with seals at the stairs: roughly 25–30 dB less sound upstairs.' : 'The stairwell is open to the main floor: bass and dialogue go straight up.' });
  rows.forEach((r) => { r.pts = GRADE_PTS[r.g]; });
  const W = { ssv: 2, flat: 1.5, ring: 1, head: 1, rt: 1.2, refl: 1.2, angles: 1, spl: 0.8, iso: 0.5 };
  const total = rows.reduce((s, r) => s + r.pts * W[r.key], 0) / rows.reduce((s, r) => s + W[r.key], 0);
  return { rows, total: Math.round(total) };
}
/** Prioritised advice, each with its predicted effect. */
function tuneAdvice(A) {
  const t = state.tune, out = [], ctx = A.ctx;
  // subs: what would two or more, placed well, do?
  const presets = compareConfigs(subPresets());
  const best = presets.slice().sort((a, b) => a.score - b.score)[0];
  if (best && best.ssv < A.m.ssv - 1) out.push({ pri: A.m.ssv - best.ssv, title: `Subwoofers: ${best.label.replace(/^\d · /, `${best.subs.length} `)}`, detail: `Seat-to-seat variation ${A.m.ssv.toFixed(1)} → ${best.ssv.toFixed(1)} dB. ${best.subs.map((s) => s.label).join(' + ')}. The optimiser on the Bass tab can do better still.`, act: { kind: 'subs', subs: best.subs, label: 'Place them' } });
  if (A.sweep && A.sweep.best && A.sweep.best.off !== 0 && A.sweep.cur && A.sweep.cur.score - A.sweep.best.score > 0.8) {
    const b = A.sweep.best; out.push({ pri: (A.sweep.cur.score - b.score) * 0.8, title: `Move the sofa ${Math.abs(b.off)}″ ${b.off > 0 ? 'forward' : 'back'}`, detail: `Main-seat bass ±${A.sweep.cur.flat.toFixed(1)} → ±${b.flat.toFixed(1)} dB: the seats move off a null.`, act: { kind: 'row', off: b.off, label: 'Move it' } });
  }
  if (A.ring > 0.08 && (t.traps || 0) < 4) out.push({ pri: A.ring * 8, title: `Bass traps in the ${(t.traps || 0) < 2 ? 'two front corners' : 'rear corners'}`, detail: `Modal ringing is ${A.ring.toFixed(2)} s over target. Floor-to-ceiling corner traps damp almost every mode at once.`, act: { kind: 'traps', n: Math.min(4, (t.traps || 0) + 2), label: 'Add traps' } });
  if (A.worst && A.worst.level > -10 && !t.reflPanels) out.push({ pri: (A.worst.level + 10) * 0.6 + 1, title: '2″ panels at the side-wall reflection points', detail: `Worst early reflection ${A.worst.level.toFixed(1)} dB (${A.worst.surface}). Panels there bring the side walls below −10 dB and sharpen dialogue and imaging.`, act: { kind: 'refl', label: 'Add panels' } });
  if (A.floorWorst && A.floorWorst.level > -6) out.push({ pri: 0.9, title: 'Rug between the speakers and the seats', detail: `The floor bounce from the ${CHANNELS[A.floorWorst.ch].name.toLowerCase()} lands ${ftin(Math.hypot(A.floorWorst.x - A.mlp.x, A.floorWorst.y - A.mlp.y))} in front of the main seat at ${A.floorWorst.level.toFixed(1)} dB. A thick rug with a felt pad there takes the edge off it.` });
  if (A.early.some((q) => q.kind === 'ceiling' && q.level > -10) && !t.cloud) out.push({ pri: 1.2, title: 'A ceiling cloud over the seats', detail: 'The ceiling bounce from the front speakers arrives within 5 ms. A 4″ cloud (4 × 6 ft) absorbs it.', act: { kind: 'cloud', label: 'Add a cloud' } });
  if (A.rt.rtMid > 0.42) out.push({ pri: (A.rt.rtMid - 0.4) * 10, title: 'Add absorption: the room is live', detail: `RT60 ${A.rt.rtMid.toFixed(2)} s. Rear-wall 4″ panels and a large rug bring it toward 0.3 s.`, act: !t.rearPanels ? { kind: 'rear', label: 'Add rear panels' } : null });
  if (A.rt.rtMid < 0.18) out.push({ pri: 1, title: 'The room is too dead', detail: `RT60 ${A.rt.rtMid.toFixed(2)} s: swap some absorption for diffusion (slats, bookshelves) to keep it lively.` });
  if (A.m.flat > 2.5 && !t.eqOn) out.push({ pri: 2, title: 'Turn on the room EQ', detail: 'Automatic parametric EQ cuts the room\'s peaks at the seats.', act: { kind: 'eq', label: 'Turn on' } });
  const fb = A.lay.filter((c) => c.fallback);
  if (fb.length) out.push({ pri: 0.8, title: `${fb.map((c) => c.name).join(' and ')}: no wall at the right angle`, detail: 'Those directions point into the stair opening; the plan uses angled in-ceiling speakers there.' });
  const lowHr = A.lay.filter((c) => c.headroom < 0);
  if (lowHr.length) out.push({ pri: 1, title: 'More amplifier or more sensitive speakers', detail: `${lowHr.map((c) => c.k).join(', ')} can't reach 105 dB peaks. Try ${t.amp < 200 ? '200 W per channel' : 'higher-sensitivity speakers'}.` });
  if (A.headroom < 0) out.push({ pri: -A.headroom / 3 + 0.5, title: 'More bass output', detail: `${(-A.headroom).toFixed(1)} dB short of 115 dB LFE peaks between 25 and 80 Hz. A second sub adds about 6 dB; a larger model adds more.` });
  if (!t.door) out.push({ pri: 0.3, title: 'Keep the movie downstairs', detail: 'A solid-core door with seals at the top or bottom of the stairs cuts sound to the main floor by roughly 25–30 dB.', act: { kind: 'door', label: 'Plan a door' } });
  return out.sort((a, b) => b.pri - a.pri);
}
