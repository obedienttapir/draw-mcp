// ===================================================================
// 67 · Hear it: the bass at a seat, rendered from the room model.
// The model's response at the seat (subs, crossover, DSP and EQ, every room mode with its decay) is turned
// into an impulse response at audio rate and a test track is played through it: the low end goes through
// the room, everything above the crossover plays dry, as it would through the main speakers. Each version is
// level-matched on the sofa's average (as a calibrated system would be), so what you hear is the evenness,
// the boom and the ringing, not a volume change. A/B: today · with the plan · an ideal room.
// ===================================================================
const LISTEN = { ac: null, src: null, g: {}, which: 'now', track: 'music', seat: 'MLP', playing: false, key: '', busy: false, sweepT0: 0, sweepTimer: 0 };
const TRACKS = { music: 'Bass line and drums', rumble: 'Movie rumble', sweep: 'Slow bass sweep' };
const SWEEP = { f0: 18, f1: 180, dur: 12 };

/** Test tracks, synthesised (mono). */
function synthTrack(kind, sr) {
  let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x3fffffff - 1; };
  if (kind === 'sweep') {
    const n = Math.round(SWEEP.dur * sr), y = new Float32Array(n), k = Math.log(SWEEP.f1 / SWEEP.f0) / SWEEP.dur;
    for (let i = 0; i < n; i++) { const t = i / sr, ph = 2 * Math.PI * SWEEP.f0 * (Math.exp(k * t) - 1) / k, fade = Math.min(1, t / 0.3, (SWEEP.dur - t) / 0.3); y[i] = 0.45 * fade * Math.sin(ph); }
    return y;
  }
  const beat = 0.6, len = kind === 'rumble' ? 9.6 : 16 * beat, n = Math.round(len * sr), y = new Float32Array(n);
  const add = (t0, dur, fn) => { const i0 = Math.round(t0 * sr), m = Math.min(n - i0, Math.round(dur * sr)); for (let i = 0; i < m; i++) y[i0 + i] += fn(i / sr); };
  if (kind === 'rumble') {
    for (const t0 of [0.2, 4.9]) {
      let a = 0, b = 0, c = 0; const lp = 2 * Math.PI * 55 / sr;
      add(t0, 4.4, (t) => { a += lp * (rnd() - a); b += lp * (a - b); c += lp * (b - c); const env = Math.min(1, t / 0.03) * Math.exp(-t / 1.4); return 9 * c * env; });
      let ph = 0; add(t0 + 0.05, 3, (t) => { const f = 28 + 30 * Math.exp(-t / 0.7); ph += 2 * Math.PI * f / sr; return 0.42 * Math.sin(ph) * Math.min(1, t / 0.02) * Math.exp(-t / 1.1); });
      add(t0, 0.25, (t) => 0.35 * rnd() * Math.exp(-t / 0.03));                         // the crack on top
    }
  } else {
    const notes = [55, 55, 65.41, 73.42, 41.2, 41.2, 49, 61.74, 43.65, 43.65, 55, 65.41, 49, 49, 61.74, 73.42];
    notes.forEach((f, b) => {
      const t0 = b * beat;
      add(t0, beat * 0.97, (t) => { const env = (1 - Math.exp(-t / 0.004)) * Math.exp(-t / 0.5) * Math.min(1, (beat * 0.97 - t) / 0.01); return 0.32 * env * (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t + 0.3) + 0.18 * Math.sin(6 * Math.PI * f * t)); });
      if (b % 2 === 0) { let ph = 0; add(t0, 0.45, (t) => { ph += 2 * Math.PI * (46 + 110 * Math.exp(-t / 0.03)) / sr; return 0.55 * Math.sin(ph) * Math.exp(-t / 0.17) + 0.12 * rnd() * Math.exp(-t / 0.002); }); }
      else add(t0, 0.3, (t) => 0.16 * rnd() * Math.exp(-t / 0.08) + 0.1 * Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t / 0.05));
      for (const hh of [0, 0.5]) { let last = 0; add(t0 + hh * beat, 0.08, (t) => { const x = rnd(), d = x - last; last = x; return 0.05 * d * Math.exp(-t / 0.014); }); }
    });
  }
  return y;
}

/** Impulse response of the low end at a seat (the current state), sample rate sr. norm: dB to subtract. */
function seatIR(subs, eq, seat, sr) {
  const ctx = bassCtx(), t = state.tune, N = 65536, df = sr / N, kMax = Math.ceil(260 / df);
  const F = Array.from({ length: kMax }, (_, i) => (i + 1) * df);
  const inv = acInv(ctx.S, ctx.damp, F), cr = acCoef(ctx.S, seat.x, seat.y, seat.z || AC.ear);
  const H = new Float64Array(kMax * 2);
  for (const s of subs) {
    const tr = acTransfer(inv, acCoef(ctx.S, s.x, s.y, AC.subZ), cr);
    F.forEach((f, i) => {
      let w = cmul(subW(s, f), cmul(subResp(t.sub, f), lr4('lp', t.xo, f))); if (eq && eq.length) w = cmul(w, eqResp(eq, f));
      const taper = f < 200 ? 1 : 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (f - 200) / 60)), a = tr[2 * i] * FF * taper, b = tr[2 * i + 1] * FF * taper;
      H[2 * i] += a * w[0] - b * w[1]; H[2 * i + 1] += a * w[1] + b * w[0];
    });
  }
  return { H, F, N };
}
/** Calibrate a set of seat responses on the sofa's average power, 30–80 Hz, against the target shape. */
function calibDb(list) {
  let s = 0, n = 0;
  for (const { H, F } of list) F.forEach((f, i) => { if (f >= 30 && f <= 80) { s += (H[2 * i] ** 2 + H[2 * i + 1] ** 2) / 10 ** (targetAt(f) / 10); n++; } });
  return 10 * Math.log10(s / n);
}
function irBuffer(ac, { H, F, N }, normDb) {
  const re = new Float64Array(N), im = new Float64Array(N), g = 10 ** (-normDb / 20);
  F.forEach((f, i) => { re[i + 1] = H[2 * i] * g; im[i + 1] = H[2 * i + 1] * g; re[N - i - 1] = re[i + 1]; im[N - i - 1] = -im[i + 1]; });
  fft(re, im, true);
  const len = N, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0), fadeN = Math.round(0.15 * ac.sampleRate);
  for (let i = 0; i < len; i++) d[i] = re[i] * (i > len - fadeN ? (len - i) / fadeN : 1);
  return buf;
}
/** The ideal room: the target curve and the crossover, nothing else. */
function idealResp(sr) {
  const N = 65536, df = sr / N, kMax = Math.ceil(260 / df), F = Array.from({ length: kMax }, (_, i) => (i + 1) * df), H = new Float64Array(kMax * 2);
  F.forEach((f, i) => { const w = cmul(subResp(state.tune.sub, f), lr4('lp', state.tune.xo, f)), g = 10 ** (targetAt(f) / 20); H[2 * i] = w[0] * g; H[2 * i + 1] = w[1] * g; });
  return { H, F, N };
}
/** Build the three impulse responses for the chosen seat. */
function listenBuffers(ac) {
  const sr = ac.sampleRate, seatOf = (label) => { const all = acSeats(); return all.find((s) => s.label === label) || all.find((s) => s.mlp) || all[0]; };
  const build = (A) => {
    const main = acSeats().filter((s) => s.main), rs = main.map((s) => seatIR(A.subs, A.eq, s, sr)), norm = calibDb(rs);
    return irBuffer(ac, seatIR(A.subs, A.eq, seatOf(LISTEN.seat), sr), norm);
  };
  const out = { now: build(TA) };
  if (PLAN && PLAN.key === planKey()) out.plan = withState(PLAN.work, () => build(PLAN.after));
  const ideal = idealResp(sr); out.ideal = irBuffer(ac, ideal, calibDb([ideal]));
  return out;
}
async function listenPlay() {
  if (LISTEN.playing) { listenStop(); return; }
  if (!TA) return;
  const AC2 = window.AudioContext || window.webkitAudioContext; if (!AC2) { toast('This browser cannot play audio'); return; }
  LISTEN.busy = true; renderListen();
  await tick();
  try {
    const ac = LISTEN.ac || (LISTEN.ac = new AC2());
    if (ac.state === 'suspended') await ac.resume();
    const irs = listenBuffers(ac), data = synthTrack(LISTEN.track, ac.sampleRate);
    const buf = ac.createBuffer(1, data.length, ac.sampleRate); buf.getChannelData(0).set(data);
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const lim = ac.createDynamicsCompressor(); lim.threshold.value = -6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.25;
    const master = ac.createGain(); master.gain.value = 0.75; lim.connect(master); master.connect(ac.destination);
    // above the crossover: dry, through a Linkwitz–Riley high-pass (two Butterworth sections)
    const hp1 = ac.createBiquadFilter(), hp2 = ac.createBiquadFilter();
    for (const f of [hp1, hp2]) { f.type = 'highpass'; f.frequency.value = state.tune.xo; f.Q.value = Math.SQRT1_2; }
    src.connect(hp1); hp1.connect(hp2); hp2.connect(lim);
    LISTEN.g = {};
    for (const [k, ir] of Object.entries(irs)) {
      const cv = ac.createConvolver(); cv.normalize = false; cv.buffer = ir;
      const g = ac.createGain(); g.gain.value = k === LISTEN.which ? 1 : 0;
      src.connect(cv); cv.connect(g); g.connect(lim); LISTEN.g[k] = g;
    }
    if (!LISTEN.g[LISTEN.which]) { LISTEN.which = 'now'; LISTEN.g.now.gain.value = 1; }
    src.start(); LISTEN.src = src; LISTEN.playing = true; LISTEN.key = planKey() + LISTEN.seat + LISTEN.track;
    LISTEN.sweepT0 = ac.currentTime;
    clearInterval(LISTEN.sweepTimer);
    if (LISTEN.track === 'sweep') LISTEN.sweepTimer = setInterval(() => {
      const t = (ac.currentTime - LISTEN.sweepT0) % SWEEP.dur, f = SWEEP.f0 * (SWEEP.f1 / SWEEP.f0) ** (t / SWEEP.dur);
      const o = $('#listenNow'); if (o) o.textContent = `${hz(f)} · ${noteName(f)}`;
      if (TV.open && (TV.tab === 'bass' || TV.tab === 'summary') && f <= 200) { TV.f = f; TV.mapKind = 'note'; drawTuneOverlay(); }
    }, 160);
  } catch (err) { console.error(err); toast('Could not start the audio'); }
  LISTEN.busy = false; renderListen();
}
function listenStop() {
  try { if (LISTEN.src) LISTEN.src.stop(); } catch (e) { /* already stopped */ }
  LISTEN.src = null; LISTEN.playing = false; clearInterval(LISTEN.sweepTimer);
  renderListen();
}
function listenSwitch(which) {
  LISTEN.which = which;
  if (LISTEN.playing && LISTEN.ac) for (const [k, g] of Object.entries(LISTEN.g)) g.gain.setTargetAtTime(k === which ? 1 : 0, LISTEN.ac.currentTime, 0.04);
  renderListen();
}
/** Restart with new settings if playing (seat or track changed). */
function listenRestart() { if (LISTEN.playing) { listenStop(); listenPlay(); } else renderListen(); }
function listenCard() {
  return h('div', { class: 'listen', id: 'listenCard' });
}
function renderListen() {
  const box = $('#listenCard'); if (!box) return;
  const seats = TA ? TA.ctx.seats.filter((s) => s.main).map((s) => s.label) : ['MLP'];
  const planReady = PLAN && PLAN.key === planKey();
  const ab = [['now', 'Today'], ['plan', 'With the plan'], ['ideal', 'Ideal room']];
  box.replaceChildren(...[
    h('div', { class: 'lhead' }, h('button', { class: 'lplay' + (LISTEN.playing ? ' on' : ''), 'aria-label': LISTEN.playing ? 'Stop' : 'Play', disabled: LISTEN.busy, onclick: listenPlay }, LISTEN.busy ? '…' : LISTEN.playing ? '■' : '▶'),
      h('div', {}, h('b', {}, 'Hear the difference'), h('small', {}, 'Headphones or a good speaker: laptop and phone speakers can\'t play this low.'))),
    h('div', { class: 'seg lab', role: 'group' }, ab.map(([k, l]) => h('button', { 'aria-pressed': String(LISTEN.which === k), disabled: k === 'plan' && !planReady, onclick: () => listenSwitch(k) }, l))),
    h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Track'), tchips(Object.entries(TRACKS), LISTEN.track, (v) => { LISTEN.track = v; listenRestart(); })),
    h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Seat'), tchips(seats.map((s) => [s, s]), LISTEN.seat, (v) => { LISTEN.seat = v; listenRestart(); })),
    LISTEN.track === 'sweep' ? h('p', { class: 'note' }, 'The sweep climbs from 18 to 180 Hz over 12 seconds. Where it swells or fades is a peak or a null at this seat; the floor map follows it: ', h('b', { id: 'listenNow' }, LISTEN.playing ? '' : '—')) : null].filter(Boolean));
}
