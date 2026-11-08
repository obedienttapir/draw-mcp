// ===================================================================
// 66 · Cinema tuning, the customer's view of the analysis.
//  - five qualities anyone can judge by ear (bass at every seat, tight bass, clear dialogue, surround
//    immersion, keeping the movie downstairs), each scored, with plain sentences about what you'd hear
//  - a plan: the steps that fix the most for the least, simulated one after another on a copy of the
//    layout, so every step shows what it changes, what it costs and how long it takes
//  - what to buy: subwoofer and speaker sizing for the loudness you want, and a shopping list
// The engineering numbers behind all of it stay available as "Pro detail".
// ===================================================================
const LOUDNESS = {
  0: { label: 'Cinema loud', note: 'reference level: dialogue as loud as a commercial cinema, 105 dB peaks per speaker and 115 dB bass peaks' },
  '-5': { label: 'Loud', note: '5 dB under reference: how most enthusiasts watch at home' },
  '-10': { label: 'Comfortable', note: '10 dB under reference: family evenings and late nights' },
};
const loudness = () => LOUDNESS[state.tune.refLvl ?? -5] || LOUDNESS['-5'];
const refName = () => loudness().label;
const QUALITIES = [
  { key: 'seats', title: 'Bass at every seat', ask: 'Does everyone on the sofa get the same bass?', tab: 'bass' },
  { key: 'tight', title: 'Tight, clean bass', ask: 'Punchy and tuneful, or boomy and one-note?', tab: 'bass' },
  { key: 'clarity', title: 'Clear dialogue', ask: 'Can you follow every word without turning it up?', tab: 'dialogue' },
  { key: 'immersion', title: 'Surround immersion', ask: 'Does each sound come from the right place?', tab: 'speakers' },
  { key: 'privacy', title: 'Keeps the movie downstairs', ask: 'How much of it reaches the main floor?', tab: 'dialogue' },
];
const Q_WEIGHT = { seats: 1.4, tight: 1.2, clarity: 1.2, immersion: 1, privacy: 0.4 };
const lin = (v, good, bad) => clamp(100 - 90 * (v - good) / (bad - good), 10, 100);
/** One spot's bass, from how far it strays from the target (rms dB, 20–100 Hz, 1/6 octave): same scale for seats and the map. */
const spotWord = (rms) => (rms <= 2.5 ? 'Excellent' : rms <= 4 ? 'Good' : rms <= 6 ? 'Fair' : 'Poor');
const verdictOf = (s) => (s >= 85 ? 'Excellent' : s >= 70 ? 'Good' : s >= 50 ? 'Fair' : 'Poor');
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
/** Musical note nearest to f (E1 is a bass guitar's open low string, 41 Hz). */
function noteName(f) { const m = Math.round(69 + 12 * Math.log2(f / 440)); return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`; }
/** What lives at that frequency, in words. */
const bassWhat = (f) => (f < 31 ? 'the deep rumble of explosions and organ pedals' : f < 45 ? 'the lowest bass-guitar and synth notes' : f < 70 ? 'kick drums and the body of bass lines'
  : f < 110 ? 'upper bass: the warmth of cellos and male voices' : 'the low end of voices and instruments');
const hz = (f) => `${Math.round(f)} Hz`;
const usd = (a, b) => (b == null ? `$${a.toLocaleString()}` : a === b ? `$${a.toLocaleString()}` : `$${a.toLocaleString()}–${b.toLocaleString()}`);
const SUB_PRICE = { '12s': [500, 900], '15p': [800, 1500], '18p': [1500, 2500] };

/** Run fn with the planner looking at another state (a what-if copy), then put everything back. */
function withState(st, fn) {
  const saved = state, savedCtx = BCTX;
  state = st; BCTX = null;
  try { return fn(); } finally { state = saved; BCTX = savedCtx; }
}

// ---------------- the assessment ----------------
let TA = null;                                         // the current assessment (see assess)
/** Everything the studio shows, for the current state. */
function assess() {
  const ctx = bassCtx(); if (!ctx) return null;
  const t = state.tune, subs = currentSubs(), F = ctx.F;
  const raw = bassResponses(ctx, subs, { eq: null }), mRaw = bassMetrics(raw, F);
  const eq = t.eqOn ? autoEQ(ctx, subs) : [];
  const resp = eq.length ? bassResponses(ctx, subs, { eq }) : raw, m = eq.length ? bassMetrics(resp, F) : mRaw;
  const mlp = ctx.seats.find((s) => s.mlp) || ctx.seats[0];
  const ir = bassImpulse(ctx, subs, mlp, eq.length ? eq : null), decay = bandDecay(ir);
  const rt = rtModel();
  const rings = decay.filter((d) => d.t60 && d.fc <= 125).map((d) => ({ ...d, over: d.t60 - decayTarget(d.fc) }));
  const ringWorst = rings.length ? rings.reduce((a, b) => (b.over > a.over ? b : a)) : null;
  const ring = ringWorst ? Math.max(0, ringWorst.over) : 0;
  const lay = tuneLayout(t.layout);
  // early reflections at every seat on the sofa from the dialogue speakers (left, centre, right): that's what
  // decides clarity; bounces of the surrounds add envelopment and aren't treated in a home cinema
  const early = [];
  for (const c of lay.filter((q) => ['L', 'C', 'R'].includes(q.k))) for (const s of ctx.seats.filter((q) => q.main)) {
    for (const q of firstReflections({ x: c.p[0], y: c.p[1], z: c.z }, { x: s.x, y: s.y, z: AC.ear })) if (q.delay < 15) early.push({ ...q, ch: c.k, seat: s.label });
  }
  const worstOf = (l) => (l.length ? l.reduce((a, b) => (b.level > a.level ? b : a)) : null);
  const worst = worstOf(early.filter((q) => q.kind !== 'floor')), floorWorst = worstOf(early.filter((q) => q.kind === 'floor'));
  const sideWorst = worstOf(early.filter((q) => q.kind === 'wall' && q.surface !== 'back wall')), ceilWorst = worstOf(early.filter((q) => q.kind === 'ceiling'));
  const backWorst = worstOf(early.filter((q) => q.surface === 'back wall'));
  const rtDev = Math.max(0, rt.rtMid - 0.4, 0.2 - rt.rtMid);
  const eSum = (l) => { const v = l.reduce((a, q) => a + 10 ** (q.level / 10), 0); return v ? 10 * Math.log10(v) : -30; };
  const nfl = early.filter((q) => q.kind !== 'floor'), others = ctx.seats.filter((q) => q.main && !q.mlp);
  const eMlp = eSum(nfl.filter((q) => q.seat === 'MLP')), eRest = others.length ? others.reduce((a, s) => a + eSum(nfl.filter((q) => q.seat === s.label)), 0) / others.length : eMlp;
  const q = {
    seats: lin(m.ssv, 2, 7),
    tight: 0.6 * lin(m.flat, 1.5, 5) + 0.4 * lin(ring, 0, 0.35),
    // early reflected energy against the direct sound (all bounces in the first 15 ms, not the floor): the main seat
    // counts most (70 %), the rest of the sofa too (30 %)
    clarity: 0.65 * (0.7 * lin(eMlp, -10, 2) + 0.3 * lin(eRest, -10, 2)) + 0.35 * lin(rtDev, 0, 0.25),
    immersion: clamp(100 * lay.filter((c) => c.ok).length / Math.max(1, lay.length) - 4 * lay.filter((c) => c.fallback).length, 10, 100),
    privacy: t.door ? 72 : 22,
  };
  const overall = Math.round(Object.entries(q).reduce((s, [k, v]) => s + v * Q_WEIGHT[k], 0) / Object.values(Q_WEIGHT).reduce((a, b) => a + b, 0));
  const A = { ctx, subs, raw, mRaw, eq, resp, m, mlp, ir, decay, ring, ringWorst, rt, lay, early, worst, floorWorst, sideWorst, ceilWorst, backWorst, q, overall };
  A.seatsQ = seatReport(A);
  A.say = findings(A);
  return A;
}
/** Each seat's bass: how far it strays from the target (after EQ), and its biggest problem. */
function seatReport(A) {
  const F = A.ctx.F, [lo, hi] = [20, 100];
  return A.resp.map((r) => {
    const sm = smoothDb(r.db, 6), dev = []; F.forEach((f, i) => { if (f >= lo && f <= hi) dev.push({ f, d: sm[i] - A.m.level - targetAt(f) }); });
    const rms = Math.sqrt(dev.reduce((a, b) => a + b.d * b.d, 0) / dev.length);
    const big = dev.reduce((a, b) => (Math.abs(b.d) > Math.abs(a.d) ? b : a));
    return { seat: r.seat, rms, score: lin(rms, 1.5, 7), verdict: spotWord(rms), issue: Math.abs(big.d) >= 3 ? big : null };
  });
}
/** Plain sentences for each quality. */
function findings(A) {
  const F = A.ctx.F, t = state.tune, out = {};
  // bass at every seat: the seat and note that differ most from the rest of the sofa
  const main = A.resp.filter((r) => r.seat.main || t.allSeats);
  if (A.m.ssv <= 2.5 || main.length < 2) out.seats = `Everyone on the sofa hears much the same bass: within ±${A.m.ssv.toFixed(1)} dB of each other (pros aim for ±3).`;
  else {
    const sm = main.map((r) => smoothDb(r.db, 3)); let best = { d: 0 };
    F.forEach((f, i) => { if (f < 25 || f > 100) return; const avg = 10 * Math.log10(sm.reduce((a, s) => a + 10 ** (s[i] / 10), 0) / sm.length); sm.forEach((s, k) => { const d = s[i] - avg; if (Math.abs(d) > Math.abs(best.d)) best = { d, f, seat: main[k].seat }; }); });
    out.seats = `${best.seat.mlp ? 'The main seat' : best.seat.label} gets ${Math.abs(best.d).toFixed(0)} dB ${best.d < 0 ? 'less' : 'more'} bass than the rest of the sofa around ${hz(best.f)} (${noteName(best.f)}: ${bassWhat(best.f)}). Seat to seat the bass varies by ±${A.m.ssv.toFixed(1)} dB; pros aim for ±3.`;
  }
  // tight bass: the worst peak, null and ring at the main seat, as you'd hear them (after the room EQ)
  const mi = Math.max(0, A.resp.findIndex((r) => r.seat.mlp)), s0 = smoothDb(A.resp[mi].db, 12), s1 = smoothDb(A.raw[mi].db, 12);
  let pk = { d: -99 }, nl = { d: 99 }, pk0 = { d: -99 };
  F.forEach((f, i) => { if (f < 20 || f > 120) return; const d = s0[i] - A.m.level - targetAt(f), d0 = s1[i] - A.mRaw.level - targetAt(f); if (d > pk.d) pk = { d, f }; if (d < nl.d) nl = { d, f }; if (d0 > pk0.d) pk0 = { d: d0, f }; });
  const tightOk = A.q.tight >= 85, parts = [];
  if (tightOk) parts.push(`Tight and even at the main seat (±${A.m.flatMlp.toFixed(1)} dB)${A.eq.length && pk0.d > 4 ? `: the room EQ takes care of its ${hz(pk0.f)} peak` : ''}.`);
  else {
    if (pk.d > 4) parts.push(`At the main seat ${hz(pk.f)} (${noteName(pk.f)}) is ${pk.d.toFixed(0)} dB too loud, even with room EQ: bass lines boom on that note.`);
    else if (A.eq.length && pk0.d > 4) parts.push(`The room EQ tames a ${pk0.d.toFixed(0)} dB peak at ${hz(pk0.f)} (${noteName(pk0.f)}).`);
    if (A.ringWorst && A.ring > 0.08) parts.push(`Around ${hz(A.ringWorst.fc)} the bass keeps ringing for ${A.ringWorst.t60.toFixed(2)} s after the note stops (${A.ring.toFixed(2)} s too long): kick drums blur into a hum.`);
    if (nl.d < -8) parts.push(`${hz(nl.f)} drops ${(-nl.d).toFixed(0)} dB: notes there go missing. EQ can't fill a hole like that; sub placement can.`);
    if (!parts.length) parts.push(`Mostly even at the main seat (±${A.m.flatMlp.toFixed(1)} dB).`);
  }
  out.tight = parts.join(' ');
  // dialogue
  const w = A.worst, rtTxt = A.rt.rtMid < 0.2 ? 'very dead: it can feel lifeless' : A.rt.rtMid <= 0.4 ? 'just right for a room this size' : 'lively: dialogue blurs as you turn it up';
  const who = w ? (w.seat === 'MLP' ? 'the main seat' : w.seat.toLowerCase()) : '';
  const effect = !w ? '' : w.kind === 'ceiling' ? 'Your ear can\'t separate the two, so voices sound harder and flatter.'
    : w.surface === 'back wall' ? 'Heads close to the wall get its bounce almost with the direct sound, which colours voices and makes them boxy.'
      : /TV|front/.test(w.surface) ? 'It bounces back from behind the speakers and softens the attack of voices.'
        : 'Your ear can\'t separate the two, so voices smear and seem to come from the wall instead of the screen.';
  const cq = A.q.clarity;
  out.clarity = cq >= 85 ? `Voices stay clear and anchored to the screen: early bounces are well under control${w ? ` (the strongest left, off the ${w.kind === 'ceiling' ? 'ceiling' : w.surface} at ${who}, is ${(-w.level).toFixed(0)} dB down)` : ''}. The echo time (${A.rt.rtMid.toFixed(2)} s) is ${rtTxt}.`
    : (w && w.level > -10
    ? `${cq >= 70 ? 'Mostly clear, but s' : 'S'}ound from the ${CHANNELS[w.ch].name.toLowerCase()} bounces off the ${w.kind === 'ceiling' ? 'ceiling' : w.surface} and reaches ${who} ${w.delay.toFixed(0)} ms after the direct sound, only ${(-w.level).toFixed(0)} dB quieter. ${effect} `
    : 'No strong early echoes reach the sofa: voices stay crisp and anchored to the screen. ') + `The echo time (${A.rt.rtMid.toFixed(2)} s) is ${rtTxt}.`;
  // immersion
  const bad = A.lay.filter((c) => !c.ok), n = A.lay.length;
  if (!bad.length) out.immersion = `All ${n} speakers of the ${t.layout} layout sit at the angles Dolby recommends from the main seat, so effects move smoothly around and over you.`;
  else {
    const why = bad.map((c) => (c.k.startsWith('TR') ? `${c.name.toLowerCase()} (the sofa is too close to the back wall to put them far enough behind you)` : c.fallback ? `${c.name.toLowerCase()} (that direction points into the stair opening, so it goes in the ceiling)` : `${c.name.toLowerCase()} (${c.actual} instead of ${c.target})`));
    out.immersion = `${n - bad.length} of ${n} speakers sit at Dolby's angles. Off: ${why.join('; ')}.`;
  }
  out.privacy = t.door ? 'A solid-core door with seals at the stairs keeps most of the movie downstairs (roughly 25–30 dB quieter upstairs).'
    : 'The stairwell is open to the main floor, so dialogue and bass carry straight up: anyone upstairs hears the movie almost as well as you do.';
  return out;
}

// ---------------- the plan ----------------
let PLAN = null, planJob = null;
const planKey = () => JSON.stringify([state.items.map((i) => [i.id, i.type, i.x, i.y, i.rot, i.p]), state.tune, state.room, state.tv, state.finish]);
function subLabel(subs) { return subs.map((s) => s.label).join(' and '); }
/** Work out the plan (async: the subwoofer search takes a moment). Resolves to null if the layout changed meanwhile. */
function buildPlan(onProgress = () => {}) {
  const key = planKey();
  if (PLAN && PLAN.key === key) return Promise.resolve(PLAN);
  if (planJob && planJob.key === key) return planJob.p;
  const p = (async () => {
    const before = TA && TA.key === key ? TA : assess(); if (!before) return null;
    onProgress('Comparing subwoofer layouts'); await tick();
    const presets = compareConfigs(subPresets());
    const o1 = await optimiseSubs({ n: 1 }); onProgress('Searching spots for two subwoofers'); await tick();
    const o2 = await optimiseSubs({ n: 2 });
    if (planKey() !== key) return null;
    const pick = (list) => list.filter(Boolean).sort((a, b) => a.score - b.score)[0];
    const best1 = pick([...(o1 || []).slice(0, 1), ...presets.filter((c) => c.subs.length === 1)]);
    const best2 = pick([...(o2 || []).slice(0, 1), ...presets.filter((c) => c.subs.length === 2)]);
    const work = clone(state), steps = [];
    let prev = before;
    const sim = (mutate) => withState(work, () => { mutate(work); return assess(); });
    const step = (s, after) => { s.before = prev.q; s.after = after.q; s.gain = after.overall - prev.overall; steps.push(s); prev = after; };
    const realSubs = state.items.filter((i) => i.type === 'subwoofer').length;
    // 1 · subwoofers
    {
      const two = best2 && best1 && best2.ssv < best1.ssv - 0.8, cfg = two ? best2 : best1;
      if (cfg && (!realSubs || cfg.ssv < before.m.ssv - 1)) {
        const n = cfg.subs.length, ids = [];
        const after = sim((w) => {
          w.items = w.items.filter((i) => i.type !== 'subwoofer');
          cfg.subs.forEach((s) => { const id = uid('sub'); ids.push(id); w.items.push({ id, type: 'subwoofer', x: s.x, y: s.y, rot: 0, p: {} }); w.tune.dsp[id] = { g: s.g || 0, d: s.d || 0, pol: s.pol || 1 }; });
        });
        const dsp = cfg.subs.map((s, i) => (s.g || s.d || s.pol === -1 ? `SW${i + 1}: ${s.g ? `${sgn(s.g)} dB` : ''}${s.d ? ` ${s.d} ms delay` : ''}${s.pol === -1 ? ' polarity inverted' : ''}`.trim() : null)).filter(Boolean);
        const more = Math.max(0, n - realSubs), price = SUB_PRICE[state.tune.sub];
        step({ key: 'subs', icon: 'sub', title: realSubs ? `Move the subwoofer${n > 1 ? 's' : ''}: ${subLabel(cfg.subs)}` : n === 2 ? `Two subwoofers: ${subLabel(cfg.subs)}` : `One subwoofer: ${subLabel(cfg.subs)}`,
          why: n === 2 ? 'Two subs at these spots drive the room\'s standing waves against each other, so one sub fills the dips the other leaves. That evens out the bass along the whole sofa, which no EQ can do.'
            : 'From this spot the subwoofer drives the room\'s standing waves evenly enough that every seat gets similar bass.',
          note: [dsp.length ? `Settings: ${dsp.join(' · ')} (on your receiver's sub outputs, or a miniDSP).` : '', 'Then let the receiver\'s room correction (or the EQ in the report) tidy what\'s left.'].filter(Boolean).join(' '),
          cost: more ? `${usd(price[0] * more, price[1] * more)} for ${more === 1 ? 'a' : more === 2 ? 'two' : more} ${SUB_MODELS[state.tune.sub].label} sub${more > 1 ? 's' : ''}` : 'free', effort: '1 hour', act: { kind: 'subs', subs: cfg.subs } }, after);
      }
    }
    // 2 · room EQ
    if (!state.tune.eqOn) step({ key: 'eq', icon: 'eq', title: 'Turn on room EQ', why: 'Cuts the room\'s bass peaks at the seats so no note booms.', note: 'Dirac Live or Audyssey in most AV receivers does this; the filters are in the report.', cost: '$0–250', effort: '30 minutes', act: { kind: 'tune', patch: { eqOn: true } } }, sim((w) => { w.tune.eqOn = true; }));
    // 3 · the sofa's position
    {
      const L = withState(work, () => mainSeatLine()), sw = L && withState(work, () => rowSweep(bassCtx(), currentSubs()));
      if (sw && sw.best && sw.best.off !== 0 && sw.cur && sw.cur.score - sw.best.score > 0.6) {
        const off = sw.best.off;
        const after = sim((w) => { const it = w.items.find((i) => i.id === L.it.id); it.x += L.ez[0] * off; it.y += L.ez[1] * off; });
        step({ key: 'sofa', icon: 'sofa', title: `Slide the sofa ${Math.abs(off)}″ ${off > 0 ? 'toward the TV' : 'back'}`, why: `The seats move out of a spot where the room's standing waves cancel: main-seat bass goes from ±${sw.cur.flat.toFixed(1)} to ±${sw.best.flat.toFixed(1)} dB.`, cost: 'free', effort: '10 minutes', act: { kind: 'row', off } }, after);
      }
    }
    // 4 · bass traps
    if (prev.ring > 0.05 || prev.q.tight < 75) {
      let n = 2, after = sim((w) => { w.tune.traps = Math.max(w.tune.traps || 0, 2); });
      if (after.ring > 0.1) { const a4 = sim((w) => { w.tune.traps = 4; }); if (a4.q.tight > after.q.tight + 3) { n = 4; after = a4; } else work.tune.traps = 2; }
      if (after.q.tight > prev.q.tight + 2 || after.ring < prev.ring - 0.04) {
        step({ key: 'traps', icon: 'trap', title: `Bass traps in the ${n === 2 ? 'two front corners' : 'four corners'}`, why: `Corners are where every standing wave is loudest, so thick floor-to-ceiling traps there soak up the ringing${prev.ringWorst ? `: the ${hz(prev.ringWorst.fc)} hang goes from ${prev.ringWorst.t60.toFixed(2)} s toward ${decayTarget(prev.ringWorst.fc).toFixed(2)} s` : ''}.`, cost: usd(150 * n, 300 * n), effort: 'an afternoon', act: { kind: 'tune', patch: { traps: n } } }, after);
      } else work.tune.traps = state.tune.traps;
    }
    // 5 · treatment for dialogue: the early bounces add up, so treating one of several barely helps and treating all
    // of them helps a lot. Like a pro, it's one package: side-wall panels, a ceiling cloud, thick panels behind the sofa
    {
      const parts = [];
      if (prev.sideWorst && prev.sideWorst.level > -10 && !work.tune.reflPanels) {
        const spots = withState(work, () => acReflectionPanelSpots()), walls = [...new Set(spots.map((s) => s.run.wall))];
        const where = walls.filter((w) => /left|right/.test(w)).length === 2 && walls.length === 2 ? 'left and right walls' : walls.length > 2 ? `${walls.slice(0, -1).join(', ')} and ${walls[walls.length - 1]}` : walls.join(' and ');
        parts.push({ flag: 'reflPanels', text: `${spots.length} 2″ panels (2 × 4 ft) on the ${where}, where the front speakers' first bounce lands for every seat`, lo: 60 * spots.length, hi: 150 * spots.length });
      }
      if (prev.ceilWorst && prev.ceilWorst.level > -10 && !work.tune.cloud) {
        const c = withState(work, () => acCloudSpot());
        parts.push({ flag: 'cloud', text: `a 4″ ceiling cloud${c ? `, ${Math.round(c.w / 12)} × ${Math.round(c.d / 12)} ft, halfway between the screen and the sofa` : ''}`, lo: 250, hi: c && c.w > 72 ? 800 : 500 });
      }
      if (((prev.backWorst && prev.backWorst.level > -10) || prev.rt.rtMid > 0.42) && !work.tune.rearPanels) {
        const n = withState(work, () => acRearSpots()).length;
        parts.push({ flag: 'rearPanels', text: `${n} thick (4″) panels on the wall right behind your heads`, lo: 100 * n, hi: 200 * n });
      }
      if (parts.length) {
        const why = [prev.backWorst && prev.backWorst.level > -10 ? 'The sofa sits against the back wall, so its bounce arrives almost with the direct sound and colours voices.' : '',
          prev.sideWorst && prev.sideWorst.level > -10 ? 'The side walls and ceiling bounce the front speakers back within a few milliseconds, which smears dialogue and pulls voices off the screen.' : '',
          'Several bounces of similar strength add up, so they\'re treated together: fixing one alone barely helps.'].filter(Boolean).join(' ');
        const lo = parts.reduce((a, q) => a + q.lo, 0), hi = parts.reduce((a, q) => a + q.hi, 0);
        const patch = Object.fromEntries(parts.map((q) => [q.flag, true]));
        step({ key: 'treat', icon: 'panel', title: 'Acoustic treatment for clear dialogue', why, note: `What goes where: ${parts.map((q) => `${q.text} (${usd(q.lo, q.hi)})`).join('; ')}. The Dialogue tab shows each spot.`,
          parts, cost: usd(lo, hi), effort: 'a weekend', act: { kind: 'tune', patch } }, sim((w) => Object.assign(w.tune, patch)));
      }
    }
    // 8 · the floor bounce (a rug can't be simulated as a spot treatment: advice only)
    if (prev.floorWorst && prev.floorWorst.level > -6 && prev.floorWorst.mat !== 'rug') steps.push({ key: 'rug', icon: 'rug', title: 'Rug between the screen and the sofa', why: `The bounce off the bare floor ${ftin(Math.hypot(prev.floorWorst.x - prev.mlp.x, prev.floorWorst.y - prev.mlp.y))} in front of the main seat is loud (${prev.floorWorst.level.toFixed(0)} dB). A thick rug with a felt pad there softens it.`, cost: usd(150, 400), effort: '10 minutes', before: prev.q, after: prev.q, gain: 0, info: true });
    // 9 · a layout that fits
    if (prev.lay.some((c) => !c.ok)) {
      const order = ['9.1.6', '7.1.4', '5.1.4', '7.1', '5.1.2', '5.1'];
      const cur = work.tune.layout, okCount = (k) => withState(work, () => tuneLayout(k)).filter((c) => c.ok).length;
      const alt = order.find((k) => k !== cur && withState(work, () => tuneLayout(k)).every((c) => c.ok) && LAYOUTS[k].length >= okCount(cur) - 1);
      if (alt) step({ key: 'layout', icon: 'spk', title: `Use a ${alt} layout instead of ${cur}`, why: `Every speaker of ${alt} can sit at Dolby's angles in this room; ${prev.lay.filter((c) => !c.ok).map((c) => c.k).join(', ')} of ${cur} can't.`, cost: LAYOUTS[alt].length < LAYOUTS[cur].length ? 'saves speakers' : 'more speakers', effort: 'planning', act: { kind: 'tune', patch: { layout: alt } } }, sim((w) => { w.tune.layout = alt; }));
    }
    // 10 · the door
    if (!work.tune.door) step({ key: 'door', icon: 'door', title: 'A solid-core door at the stairs', why: 'An open stairwell carries the movie to the main floor. A solid-core door with perimeter seals and a drop seal cuts it by roughly 25–30 dB.', cost: usd(600, 1200) + ' installed', effort: 'a day (pro)', act: { kind: 'tune', patch: { door: true } } }, sim((w) => { w.tune.door = true; }));
    const res = { key, before, after: prev, steps, work, best1, best2, presets };
    PLAN = res; planJob = null;
    return res;
  })();
  planJob = { key, p };
  p.catch(() => { planJob = null; });
  return p;
}

// ---------------- what to buy ----------------
/** In-room maximum bass at the main seat for a subwoofer model and positions (dB SPL per frequency). */
function inRoomMax(ctx, subs, model, eq) {
  const F = ctx.F, seat = ctx.seats.find((s) => s.mlp) || ctx.seats[0], gmax = Math.max(...subs.map((s) => 10 ** ((s.g || 0) / 20)));
  const tr = subs.map((s) => ctxTransfer(ctx, s.x, s.y, AC.subZ, seat));
  const out = F.map((f, i) => {
    let re = 0, im = 0;
    subs.forEach((s, k) => { const w = subW(s, f); re += (tr[k][2 * i] * w[0] - tr[k][2 * i + 1] * w[1]) / gmax; im += (tr[k][2 * i] * w[1] + tr[k][2 * i + 1] * w[0]) / gmax; });
    const boost = eq && eq.length ? Math.max(0, 20 * Math.log10(Math.hypot(...eqResp(eq, f)))) : 0;
    return subMax(model, f) + db(re * FF, im * FF) - boost;
  });
  return smoothDb(out, 6);
}
/** Which subwoofers (one or two of each class) reach the bass peaks the chosen loudness asks for. */
function subSizing(A, plan) {
  const need = 115 + (state.tune.refLvl ?? -5), F = A.ctx.F, rows = [];
  const pos = { 1: plan && plan.best1 ? plan.best1.subs : A.subs.slice(0, 1), 2: plan && plan.best2 ? plan.best2.subs : null };
  for (const n of [1, 2]) for (const [k, mdl] of Object.entries(SUB_MODELS)) {
    if (!pos[n]) continue;
    const mx = inRoomMax(A.ctx, pos[n], k, A.eq);
    const band = F.map((f, i) => [f, mx[i]]).filter(([f]) => f >= 25 && f <= 80), low = Math.min(...band.map((b) => b[1]));
    const at20 = mx[F.findIndex((f) => f >= 20)];
    rows.push({ n, model: k, label: `${n === 2 ? 'Two' : 'One'} ${mdl.label}`, margin: low - need, deep: at20 - need, price: SUB_PRICE[k].map((v) => v * n) });
  }
  rows.sort((a, b) => a.price[0] - b.price[0]);
  const pickRow = rows.find((r) => r.margin >= 0 && r.deep >= -6) || rows.find((r) => r.margin >= 0) || rows.reduce((a, b) => (b.margin > a.margin ? b : a));
  return { need, rows, pick: pickRow };
}
/** Speaker sensitivity needed per group for the chosen loudness, at 100 W and 200 W. */
function speakerSizing(A) {
  const need = 105 + (state.tune.refLvl ?? -5), groups = [
    ['Front left and right', (c) => c.k === 'L' || c.k === 'R'], ['Centre', (c) => c.k === 'C'],
    ['Surrounds', (c) => /^(S|B|W)/.test(c.k)], ['Ceiling (Atmos)', (c) => c.k.startsWith('T')],
  ];
  return groups.map(([label, f]) => {
    const cs = A.lay.filter(f); if (!cs.length) return null;
    const d = Math.max(...cs.map((c) => c.dist)), dm = d * AC.IN;
    const sens = (P) => Math.ceil(need - 10 * Math.log10(P) + 20 * Math.log10(Math.max(0.3, dm)) - 1);
    return { label, n: cs.length, dist: d, s100: sens(100), s200: sens(200) };
  }).filter(Boolean);
}
const sensHint = (s) => (s <= 85 ? 'almost any speaker' : s <= 88 ? 'most bookshelf and in-wall speakers' : s <= 91 ? 'towers and efficient bookshelves' : s <= 95 ? 'high-sensitivity designs' : 'horn-loaded or pro cinema speakers');
