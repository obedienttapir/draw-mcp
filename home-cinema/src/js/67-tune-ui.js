// ===================================================================
// 67 · Cinema tuning studio: the panel, charts and the overlays in the room.
//  Overview (scorecard, key figures, advice) · Bass (seat responses, bass map on the floor, subwoofer
//  configurations and optimiser, per-sub DSP, room EQ, waterfall, decay, sofa position) · Modes ·
//  Reverb (RT60 and treatment) · Reflections (ETC, points on the walls) · Speakers (layouts, angles,
//  delays, trims, headroom) · Report (download / copy).
// ===================================================================
const TV = { open: false, tab: 'overview', f: 42, band: true, preview: null, opt: null, optN: 2, optKeep: false, busy: '',
  modeSel: null, reflCh: 'L', smooth: 6, prev: null, timer: 0, playing: 0 };
const tuneGroup = new THREE.Group(); helpersGroup.add(tuneGroup);
const SEAT_COLORS = ['#7fb3d5', '#d6a463', '#8fbf8a', '#c89bd6', '#e07a62', '#6fc2b8', '#c9c27a', '#b9a58c'];
const TABS = [['overview', 'Overview'], ['bass', 'Bass'], ['modes', 'Modes'], ['reverb', 'Reverb'], ['refl', 'Reflections'], ['speakers', 'Speakers'], ['report', 'Report']];
const fmtF = (f) => (f >= 100 ? f.toFixed(0) : f.toFixed(1).replace(/\.0$/, '')) + ' Hz';
const sgn = (v, d = 1) => { const r = Number(v.toFixed(d)); return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(d)}`; };

// ---------------- open / close ----------------
function initTune() {
  const panel = h('aside', { class: 'tune', id: 'tune', 'aria-label': 'Cinema tuning', hidden: true },
    h('header', { class: 'tune-head' },
      h('div', { class: 'tune-titles' }, h('span', { class: 'tune-kicker' }, 'Cinema tuning'), h('h2', {}, 'Acoustic model of the basement'), h('p', { id: 'tuneSub' }, '')),
      h('button', { class: 'tune-x', 'aria-label': 'Close tuning', onclick: () => closeTune() }, '✕')),
    h('nav', { class: 'tune-tabs', role: 'tablist' }, TABS.map(([k, label]) => h('button', { role: 'tab', 'data-tab': k, 'aria-selected': String(k === TV.tab), onclick: () => tuneTab(k) }, label))),
    h('div', { class: 'tune-body', id: 'tuneBody' }));
  $('#app').append(panel);
  $('#tuneBtn').addEventListener('click', () => (TV.open ? closeTune() : openTune()));
  window.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 't' || e.key === 'T') { if (TV.open) closeTune(); else openTune(); }
    else if (e.key === 'Escape' && TV.open && !selected && !TV.preview) closeTune();
  });
}
function openTune(tab) {
  if (photo.on) return;
  TV.open = true; if (tab) TV.tab = tab;
  TV.prev = { left: !$('#leftPanel').classList.contains('collapsed'), right: !$('#rightPanel').classList.contains('collapsed'), mode };
  $('#leftPanel').classList.add('collapsed'); $('#rightPanel').classList.add('collapsed');
  $('#tune').hidden = false; $('#app').classList.add('tuning'); $('#tuneBtn').setAttribute('aria-pressed', 'true');
  select(null);
  if (mode === 'walk') setMode('orbit');
  setMode('plan');
  tuneTab(TV.tab, true);
  ensureSolved();
  setTimeout(() => { resize(); if (mode === 'plan') fitPlan(); }, 30);
}
function closeTune() {
  TV.open = false; clearInterval(TV.playing); TV.playing = 0; TV.preview = null;
  $('#tune').hidden = true; $('#app').classList.remove('tuning'); $('#tuneBtn').setAttribute('aria-pressed', 'false');
  if (TV.prev) { $('#leftPanel').classList.toggle('collapsed', !TV.prev.left); $('#rightPanel').classList.toggle('collapsed', !TV.prev.right); }
  disposeTune();
  setTimeout(() => { resize(); if (mode === 'plan') fitPlan(); }, 30);
}
function tuneTab(k, quiet) {
  TV.tab = k; TV.modeSel = k === 'modes' ? TV.modeSel : null;
  $$('.tune-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === k)));
  renderTune(); if (!quiet) $('#tuneBody').scrollTop = 0;
}
/** Solve the room (once per room shape) and analyse, with progress in the panel. */
function ensureSolved() {
  if (ACS && ACS.grid.key === acKey()) { tuneAnalyse(); return; }
  TV.busy = 'Building the room grid'; renderTune();
  acSolve((p, msg) => { TV.busy = msg; const b = $('#tuneProgress'); if (b) { b.style.setProperty('--p', p); $('#tuneProgressMsg').textContent = msg; } })
    .then(() => { TV.busy = ''; tuneAnalyse(); })
    .catch((err) => { console.error(err); TV.busy = 'Could not solve the room'; renderTune(); });
}
function tuneAnalyse() {
  if (!TV.open) return;
  try { analyseRoom(); } catch (err) { console.error(err); }
  renderTune();
}
/** Called after any edit to the layout. */
function tuneChanged() {
  if (!TV.open) return;
  clearTimeout(TV.timer);
  TV.timer = setTimeout(() => { if (ACS && ACS.grid.key !== acKey()) ensureSolved(); else tuneAnalyse(); }, 250);
}
/** Change a tuning setting (undoable) and re-analyse. */
function setTune(patch, analyse = true) {
  pushHistory(); Object.assign(state.tune, patch); save();
  if (analyse) tuneAnalyse();
}

// ---------------- rendering the panel ----------------
function renderTune() {
  const body = $('#tuneBody'); if (!body || !TV.open) return;
  const sub = $('#tuneSub');
  if (ACS) sub.textContent = `${ACS.modes3.filter((m) => m.f <= 200).length} room modes below 200 Hz · ${ACS.grid.N.toLocaleString()} cells · ${state.tune.layout} · ${currentSubs().filter((s) => s.real).length || 'no'} sub${currentSubs().filter((s) => s.real).length === 1 ? '' : 's'}`;
  const keep = body.scrollTop;
  body.replaceChildren();
  if (TV.busy || !TA) {
    body.append(h('div', { class: 'tune-busy' }, h('div', { class: 'tprog', id: 'tuneProgress' }, h('i')), h('p', { id: 'tuneProgressMsg' }, TV.busy || 'Analysing…'),
      h('p', { class: 'note' }, 'Solving the wave equation on the real floor plan: the room, the TV alcove, the fireplace lounge, the stairs and the hall. Once per room shape; furniture and speaker changes are instant after that.')));
    drawTuneOverlay(); return;
  }
  const fn = { overview: tabOverview, bass: tabBass, modes: tabModes, reverb: tabReverb, refl: tabRefl, speakers: tabSpeakers, report: tabReport }[TV.tab];
  body.append(fn());
  body.scrollTop = keep;
  requestAnimationFrame(() => { $$('canvas[data-chart]', body).forEach((cv) => cv._draw && cv._draw()); });
  drawTuneOverlay();
}
const sect = (title, ...kids) => h('section', { class: 'tsec' }, title ? h('h3', {}, title) : null, ...kids);
const tchips = (opts, cur, pick, cls = '') => h('div', { class: 'chips ' + cls }, opts.map(([v, label]) => h('button', { class: 'chip', 'aria-pressed': String(v === cur), onclick: () => pick(v) }, label)));
const kv = (k, v, sub) => h('div', { class: 'kv' }, h('span', {}, k), h('b', {}, v), sub ? h('small', {}, sub) : null);
const gradeChip = (g) => h('span', { class: 'grade g' + g }, g);

// ---------------- Overview ----------------
function tabOverview() {
  const A = TA, sc = A.score, rt = A.rt, S = ACS;
  const ring = h('div', { class: 'scoring', style: `--s:${sc.total}` }, h('b', {}, String(sc.total)), h('small', {}, 'of 100'));
  const first = S.modes3.find((m) => m.f > 1);
  const top = h('div', { class: 'tov' }, ring, h('div', { class: 'kvs' },
    kv('Room volume', `${A.rt.V.toFixed(0)} m³`, `${(A.rt.V * 35.315).toFixed(0)} ft³, not counting the stairs and hall`),
    kv('Reverberation', `${rt.rtMid.toFixed(2)} s`, 'mid-band RT60'),
    kv('Schroeder frequency', fmtF(rt.schroeder), 'below it, room modes rule'),
    kv('Lowest mode', fmtF(first ? first.f : 0), 'the whole basement breathing through the hall')));
  const rows = h('div', { class: 'scorecard' }, sc.rows.map((r) => h('details', { class: 'srow' },
    h('summary', {}, h('span', { class: 'sl' }, r.label), h('span', { class: 'sv' }, r.value), gradeChip(r.g)), h('p', {}, r.note))));
  const adv = h('div', { class: 'advice' }, A.advice.slice(0, 7).map((a, i) => h('div', { class: 'adv' },
    h('span', { class: 'adv-n' }, String(i + 1)), h('div', {}, h('b', {}, a.title), h('p', {}, a.detail)),
    a.act ? h('button', { class: 'btn' + (i === 0 ? ' primary' : ''), onclick: () => doAdvice(a.act) }, a.act.label) : null)));
  return h('div', {}, sect(null, top), sect('Scorecard', rows, h('p', { class: 'note' }, 'Grades use targets common in professional home-cinema design (seat-to-seat bass within ±3 dB, RT60 0.2–0.4 s, no reflection above −10 dB in the first 15 ms, Dolby speaker angles). They follow the spirit of the CEDIA/CTA RP22 levels; this is a model, not a certification.')),
    sect('What to do, in order', adv));
}
function doAdvice(act) {
  if (act.kind === 'subs') { applySubConfig(act.subs); snack(`${act.subs.length} subwoofer${act.subs.length > 1 ? 's' : ''} placed`); }
  else if (act.kind === 'row') { const L = mainSeatLine(); if (L) { pushHistory(); L.it.x += L.ez[0] * act.off; L.it.y += L.ez[1] * act.off; placeItem(itemObjects.get(L.it.id).group, L.it); commit(false); snack(`Sofa moved ${Math.abs(act.off)}″`); } }
  else if (act.kind === 'traps') { setTune({ traps: act.n }); snack(`${act.n} corner bass traps added`); }
  else if (act.kind === 'refl') { setTune({ reflPanels: true }); snack('Panels added at the reflection points'); }
  else if (act.kind === 'cloud') { setTune({ cloud: true }); snack('Ceiling cloud added'); }
  else if (act.kind === 'rear') { setTune({ rearPanels: true }); snack('Rear-wall panels added'); }
  else if (act.kind === 'eq') { setTune({ eqOn: true }); }
  else if (act.kind === 'door') { setTune({ door: true }); snack('Door at the stairs planned'); }
  tuneChanged();
}

// ---------------- Bass ----------------
function previewOrCurrent() { return TV.preview ? TV.preview.subs : currentSubs(); }
function bassView() {
  const ctx = TA.ctx, subs = previewOrCurrent(), t = state.tune;
  const eq = t.eqOn ? (TV.preview ? autoEQ(ctx, subs) : TA.eq) : [];
  const resp = bassResponses(ctx, subs, { eq: eq.length ? eq : null }), m = bassMetrics(resp, ctx.F);
  return { ctx, subs, eq, resp, m };
}
function tabBass() {
  const t = state.tune, V = bassView(), { ctx, m } = V, F = ctx.F;
  const wrap = h('div', {});
  if (TV.preview) wrap.append(h('div', { class: 'preview-bar' }, h('span', {}, `Previewing: ${TV.preview.label}`),
    h('button', { class: 'btn primary', onclick: () => { applySubConfig(TV.preview.subs); TV.preview = null; snack('Subwoofers placed'); tuneChanged(); } }, 'Place them'),
    h('button', { class: 'btn', onclick: () => { TV.preview = null; renderTune(); } }, 'Cancel')));
  // controls
  wrap.append(sect(null,
    h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Signal'), tchips([['lfe', 'LFE (subs only)'], ['managed', 'Bass-managed L/R + subs']], t.signal, (v) => setTune({ signal: v }))),
    t.signal === 'managed' ? h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Crossover'), tchips([[60, '60'], [80, '80'], [100, '100'], [120, '120 Hz']], t.xo, (v) => setTune({ xo: v }))) : null,
    h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Subwoofer'), tchips(Object.entries(SUB_MODELS).map(([k, s]) => [k, s.label]), t.sub, (v) => setTune({ sub: v }))),
    h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Target'), tchips(Object.entries(TARGETS).map(([k, s]) => [k, s.label]), t.target, (v) => setTune({ target: v, eq: [] }))),
    h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Show'), tchips([[0, 'Raw'], [24, '1/24'], [6, '1/6 oct'], [3, '1/3 oct']], TV.smooth, (v) => { TV.smooth = v; renderTune(); }),
      h('label', { class: 'mini-toggle' }, h('input', { type: 'checkbox', checked: t.eqOn, onchange: (e) => setTune({ eqOn: e.target.checked }) }), 'Room EQ'),
      h('label', { class: 'mini-toggle' }, h('input', { type: 'checkbox', checked: t.allSeats, onchange: (e) => setTune({ allSeats: e.target.checked }) }), 'Chairs too'))));
  // metrics strip
  wrap.append(h('div', { class: 'metrics' },
    metric('Seat to seat', `±${m.ssv.toFixed(1)}`, 'dB', grade(m.ssv, [2.5, 3.5, 5])),
    metric('Smoothness', `±${m.flat.toFixed(1)}`, 'dB', grade(m.flat, [2, 3, 4.5])),
    metric('Main seat', `±${m.flatMlp.toFixed(1)}`, 'dB', grade(m.flatMlp, [2.5, 3.5, 5])),
    metric('Extension', m.ext < 17 ? '<16' : m.ext.toFixed(0), 'Hz', grade(m.ext, [20, 25, 32]))));
  // frequency response chart
  const cv = h('canvas', { class: 'chart', 'data-chart': 1 }), tip = h('div', { class: 'ctip' });
  cv._draw = () => drawResponse(cv, tip, V);
  attachHover(cv, tip, (x) => { TV.f = x; TV.band = false; drawTuneOverlay(); renderMapControls(); });
  wrap.append(sect('Frequency response at the seats', h('div', { class: 'chartwrap' }, cv, tip),
    h('div', { class: 'legend' }, V.resp.map((r, i) => h('span', { class: 'lg' + (r.seat.main || t.allSeats ? '' : ' off') }, h('i', { style: `background:${seatColor(r.seat, i)}` }), r.seat.label)),
      h('span', { class: 'lg' }, h('i', { class: 'dash' }), 'Average'), h('span', { class: 'lg' }, h('i', { class: 'band' }), 'Target')),
    h('p', { class: 'note' }, `dB relative to the subwoofer's own output at 1 m outdoors: the room's gain and its peaks and nulls. Click the chart to see that frequency on the floor.`)));
  // the map
  wrap.append(sect('Bass map', h('div', { id: 'mapControls' }), h('p', { class: 'note' }, 'Colours on the floor show how loud each spot is compared with the room average at ear height (38″): blue are nulls, amber are peaks. The seats show their own value.')));
  // subwoofers
  wrap.append(subSection(V));
  // EQ
  if (V.eq.length) wrap.append(sect('Room EQ (all subs)', h('table', { class: 'ttable' }, h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Frequency'), h('th', {}, 'Gain'), h('th', {}, 'Q'))),
    h('tbody', {}, V.eq.map((q, i) => h('tr', {}, h('td', {}, String(i + 1)), h('td', {}, fmtF(q.f)), h('td', {}, `${sgn(q.g)} dB`), h('td', {}, q.q.toFixed(2)))))),
    h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: () => copyText(eqText(V.eq), 'EQ filters copied') }, 'Copy filters'),
      h('span', { class: 'note' }, `Fitted to the seating area's average with the ${TARGETS[t.target].label.toLowerCase()}. Cuts only, plus at most one broad +3 dB boost; nulls are left alone: EQ can't fill them.`))));
  // waterfall
  const wf = h('canvas', { class: 'chart tall', 'data-chart': 1 });
  wf._draw = () => drawWaterfall(wf, V);
  wrap.append(sect('Waterfall at the main seat', wf, h('p', { class: 'note' }, 'How the bass dies away after the sound stops, every 25 ms: long ridges are ringing modes (boomy, one-note bass).')));
  // decay
  const dc = h('canvas', { class: 'chart', 'data-chart': 1 });
  dc._draw = () => drawDecay(dc);
  wrap.append(sect('Low-frequency decay (T30) per third octave', dc, h('p', { class: 'note' }, `From the modelled impulse response at the main seat. Target: about the mid-band reverb time + 0.1 s (${(TA.rt.rtMid + 0.1).toFixed(2)} s), allowed to rise below 63 Hz.`)));
  // sofa position
  if (TA.sweep) {
    const sw = h('canvas', { class: 'chart short', 'data-chart': 1 });
    sw._draw = () => drawSweep(sw);
    const b = TA.sweep.best;
    wrap.append(sect('Where the sofa sits', sw, h('div', { class: 'btnrow' },
      b && b.off !== 0 ? h('button', { class: 'btn', onclick: () => doAdvice({ kind: 'row', off: b.off }) }, `Move it ${Math.abs(b.off)}″ ${b.off > 0 ? 'forward' : 'back'}`) : h('span', { class: 'note' }, 'The sofa is already at the best spot it can reach.'),
      h('span', { class: 'note' }, 'Main-seat smoothness (brass) and seat-to-seat variation (blue) as the whole sofa slides toward or away from the TV, subs fixed. Grey: it would hit a wall or the stairs.'))));
  }
  requestAnimationFrame(renderMapControls);
  return wrap;
}
function metric(label, v, unit, g) { return h('div', { class: 'metric' }, h('small', {}, label), h('b', {}, v, h('i', {}, unit)), gradeChip(g)); }
const seatColor = (s, i) => (s.mlp ? '#d6a463' : SEAT_COLORS[(i + 3) % SEAT_COLORS.length]);
function renderMapControls() {
  const box = $('#mapControls'); if (!box) return;
  const lf = Math.log2(TV.f / 15) / Math.log2(200 / 15);
  const sl = h('input', { type: 'range', min: 0, max: 1000, value: String(Math.round(lf * 1000)), 'aria-label': 'Map frequency' });
  sl.addEventListener('input', () => { TV.f = 15 * (200 / 15) ** (sl.value / 1000); TV.band = false; out.textContent = TV.band ? '20–80 Hz' : fmtF(TV.f); drawTuneOverlay(); bandBtn.setAttribute('aria-pressed', 'false'); });
  const out = h('b', { class: 'mapf' }, TV.band ? '20–80 Hz average' : fmtF(TV.f));
  const bandBtn = h('button', { class: 'chip', 'aria-pressed': String(TV.band), onclick: () => { TV.band = !TV.band; renderMapControls(); drawTuneOverlay(); } }, '20–80 Hz average');
  const play = h('button', { class: 'chip', 'aria-pressed': String(!!TV.playing), onclick: () => {
    if (TV.playing) { clearInterval(TV.playing); TV.playing = 0; renderMapControls(); return; }
    TV.band = false; TV.f = 15;
    TV.playing = setInterval(() => { TV.f *= 2 ** (1 / 24); if (TV.f > 200) TV.f = 15; drawTuneOverlay(); const o = $('.mapf'); if (o) o.textContent = fmtF(TV.f); const s2 = $('#mapControls input'); if (s2) s2.value = String(Math.round(Math.log2(TV.f / 15) / Math.log2(200 / 15) * 1000)); }, 120);
    renderMapControls();
  } }, TV.playing ? 'Stop sweep' : 'Play sweep');
  box.replaceChildren(h('div', { class: 'maprow' }, out, sl), h('div', { class: 'chips' }, bandBtn, play,
    ...[30, 45, 60, 90].map((f) => h('button', { class: 'chip', onclick: () => { TV.f = f; TV.band = false; renderMapControls(); drawTuneOverlay(); } }, `${f} Hz`))),
    h('div', { class: 'cbar' }, h('span', {}, '−15 dB'), h('i'), h('span', {}, '+10 dB')));
}
function subSection(V) {
  const t = state.tune, subs = currentSubs(), real = subs.filter((s) => s.real);
  const list = h('div', { class: 'sublist' }, (real.length ? real : subs).map((s, i) => {
    const d = state.tune.dsp[s.id] || { g: 0, d: 0, pol: 1 };
    const set = (patch) => { pushHistory(); state.tune.dsp[s.id] = { ...d, ...patch }; save(); tuneAnalyse(); };
    return h('div', { class: 'subrow' }, h('b', {}, `SW${i + 1}`), h('span', { class: 'sname' }, s.real ? spotName({ ...s, n: wallNormalAt(s.x, s.y) }) : 'pre-wire spot (no sub placed yet)'),
      s.real ? h('div', { class: 'dsp' },
        stepper('Gain', `${sgn(d.g || 0)} dB`, () => set({ g: clamp((d.g || 0) - 0.5, -12, 0) }), () => set({ g: clamp((d.g || 0) + 0.5, -12, 0) })),
        stepper('Delay', `${(d.d || 0).toFixed(1)} ms`, () => set({ d: clamp((d.d || 0) - 0.5, 0, 20) }), () => set({ d: clamp((d.d || 0) + 0.5, 0, 20) })),
        h('button', { class: 'chip', 'aria-pressed': String(d.pol === -1), onclick: () => set({ pol: d.pol === -1 ? 1 : -1 }) }, d.pol === -1 ? 'Polarity −' : 'Polarity +')) : null);
  }));
  // presets
  const cmp = compareConfigs(subPresets()).sort((a, b) => a.score - b.score);
  const cur = { label: 'Current', ssv: TA.mRaw.ssv, flat: TA.mRaw.flat, level: TA.mRaw.level };
  const row = (c, i, opt) => h('tr', { class: TV.preview && TV.preview.label === c.label ? 'on' : '' },
    h('td', {}, c.label, opt ? h('small', {}, c.subs.map((s) => `${s.label}${s.g ? ` ${sgn(s.g)} dB` : ''}${s.d ? ` ${s.d} ms` : ''}${s.pol === -1 ? ' inv.' : ''}`).join(' · ')) : null),
    h('td', {}, `±${c.ssv.toFixed(1)}`), h('td', {}, `±${c.flat.toFixed(1)}`), h('td', {}, sgn(c.level - cur.level)),
    h('td', {}, c.subs ? h('button', { class: 'btn', onclick: () => { TV.preview = { label: c.label, subs: c.subs }; renderTune(); } }, 'Preview') : null));
  const table = h('table', { class: 'ttable cfg' }, h('thead', {}, h('tr', {}, h('th', {}, 'Layout'), h('th', {}, 'Seat to seat'), h('th', {}, 'Smooth'), h('th', {}, 'Output'), h('th', {}))),
    h('tbody', {}, h('tr', { class: 'cur' }, h('td', {}, real.length ? `Now: ${real.length} sub${real.length > 1 ? 's' : ''}` : 'Now: pre-wire spot'), h('td', {}, `±${cur.ssv.toFixed(1)}`), h('td', {}, `±${cur.flat.toFixed(1)}`), h('td', {}, '0'), h('td', {})),
      ...(TV.opt || []).map((c, i) => row({ ...c, label: `Optimised ${c.subs.length} · #${i + 1}` }, i, true)),
      ...cmp.map((c, i) => row(c, i))));
  const optCtl = h('div', { class: 'optctl' },
    h('span', { class: 'tl' }, 'Optimise'), tchips([[1, '1 sub'], [2, '2'], [3, '3'], [4, '4 subs']], TV.optN, (v) => { TV.optN = v; renderTune(); }),
    h('label', { class: 'mini-toggle' }, h('input', { type: 'checkbox', checked: TV.optKeep, disabled: !real.length, onchange: (e) => { TV.optKeep = e.target.checked; } }), 'Keep positions, tune DSP only'),
    h('button', { class: 'btn primary', disabled: !!TV.optRunning, onclick: runOptimiser }, TV.optRunning ? TV.optRunning : 'Run'));
  return sect('Subwoofers', list, optCtl, table, h('p', { class: 'note' }, 'Spots are along the walls (every foot, corners first) and behind the seats, clear of the sofa, chairs, console and towers. The optimiser compares every pair, grows the best to 3 or 4, moves each sub to wherever it helps most, then tunes gain, delay and polarity: lowest seat-to-seat variation first, then a smooth average, without giving up much output.'));
}
function stepper(label, val, dec, inc) { return h('span', { class: 'step' }, h('small', {}, label), h('button', { onclick: dec, 'aria-label': `${label} down` }, '−'), h('b', {}, val), h('button', { onclick: inc, 'aria-label': `${label} up` }, '+')); }
function wallNormalAt(x, y) { const r = state.room, G = geom(); return [x < 30 ? 1 : x > r.width - 30 ? -1 : 0, y > G.mainY - 30 && y <= G.mainY ? -1 : y < 30 ? 1 : 0]; }
async function runOptimiser() {
  TV.optRunning = 'Starting…'; renderTune();
  const res = await optimiseSubs({ n: TV.optN, keep: TV.optKeep, onProgress: (p, msg) => { TV.optRunning = msg; const b = $('.optctl .btn.primary'); if (b) b.textContent = `${Math.round(p * 100)}% · ${msg}`; } });
  TV.optRunning = null; TV.opt = res ? res.slice(0, 3) : null;
  if (res && res[0]) TV.preview = { label: `Optimised ${res[0].subs.length} · #1`, subs: res[0].subs };
  renderTune();
}
const eqText = (eq) => ['Filter Settings file', '', 'Room EQ from Basement Cinema planner', '', ...eq.map((q, i) => `Filter ${i + 1}: ON PK Fc ${q.f.toFixed(1)} Hz Gain ${q.g.toFixed(1)} dB Q ${q.q.toFixed(2)}`)].join('\n');
async function copyText(txt, msg) { try { await navigator.clipboard.writeText(txt); toast(msg); } catch (e) { downloadBlob(new Blob([txt], { type: 'text/plain' }), 'cinema-tuning.txt'); } }

// ---------------- Modes ----------------
function tabModes() {
  const S = ACS, ctx = TA.ctx, subs = currentSubs(), mlp = TA.mlp;
  const cs = subs.map((s) => acCoef(S, s.x, s.y, AC.subZ)), cr = acCoef(S, mlp.x, mlp.y, AC.ear);
  const list = S.modes3.map((m, i) => ({ m, i })).filter(({ m }) => m.f > 1 && m.f <= 200);
  const r = state.room, G = geom(), c = 343, inM = (v) => v * AC.IN;
  const ax = [['Length (fireplace wall to exterior wall)', r.width], ['Width (stairs to the alcove front)', G.mainY], ['Height', r.ceiling]];
  const exc = list.map(({ m, i }) => { let a = 0; for (const q of cs) a += q[i]; return a * cr[i]; });
  const emax = Math.max(...exc.map(Math.abs), 1e-9);
  const rows = list.map(({ m, i }, j) => {
    const md = S.modes2[m.m], lb = md.label, T60 = 6.91 / TA.ctx.damp[i], Q = Math.PI * m.f * T60 / 6.91;
    const shape = lb.c > 0.55 ? `${lb.p}·${lb.q}·${m.nz}` : `basement · ${m.nz}`;
    const nn = [lb.p, lb.q, m.nz].filter((x) => x).length;
    const kind = lb.c > 0.55 ? (nn === 0 ? 'room breathing against the hall and stairs' : nn === 1 ? 'axial' : nn === 2 ? 'tangential' : 'oblique') : (md.roomFrac < 0.6 ? 'mostly in the hall and stairs' : 'whole floor');
    const e = 20 * Math.log10(Math.abs(exc[j]) / emax + 1e-6);
    return h('tr', { class: TV.modeSel === i ? 'on' : '', onclick: () => { TV.modeSel = TV.modeSel === i ? null : i; renderTune(); } },
      h('td', {}, fmtF(m.f)), h('td', {}, shape, h('small', {}, kind)), h('td', {}, `${T60.toFixed(2)} s`), h('td', {}, Q.toFixed(0)),
      h('td', {}, h('span', { class: 'bar', style: `--w:${Math.max(2, 100 + e * 2.5)}%` }), `${e.toFixed(0)} dB`));
  });
  return h('div', {},
    sect('Room modes', h('p', { class: 'note' }, `${list.length} modes below 200 Hz from the wave solution. Shape = half-waves along the length · width · height of the main room (when the mode looks like one), or a mode that spreads into the hall and stairs. Click one to see its pressure on the floor (white lines are its nodes, where it vanishes). Excitation: how hard your subs drive it at the main seat.`),
      h('div', { class: 'tscroll' }, h('table', { class: 'ttable modes' }, h('thead', {}, h('tr', {}, h('th', {}, 'Freq.'), h('th', {}, 'Shape'), h('th', {}, 'Decay'), h('th', {}, 'Q'), h('th', {}, 'Excitation at the MLP'))), h('tbody', {}, rows)))),
    sect('Reference: a plain box this size', h('div', { class: 'kvs three' }, ax.map(([k, L]) => kv(k, fmtF(c / (2 * inM(L))), `${ftin(L)} · axial 1st order`))),
      h('p', { class: 'note' }, `The real room isn't a box: the TV alcove, the fireplace lounge and the open stairs and hall shift and split these. Schroeder frequency ${fmtF(TA.rt.schroeder)}: above it, modes overlap and the room behaves statistically.`)));
}

// ---------------- Reverb ----------------
function tabReverb() {
  const t = state.tune, rt = TA.rt;
  const cv = h('canvas', { class: 'chart', 'data-chart': 1 }); cv._draw = () => drawRT(cv, rt);
  const surf = rt.surf.slice().sort((a, b) => b.area * b.a[3] - a.area * a.a[3]);
  const A500 = rt.bands[3].A;
  return h('div', {},
    sect('Reverberation time (RT60)', cv, h('div', { class: 'legend' }, h('span', { class: 'lg' }, h('i', { style: 'background:#d6a463' }), 'Eyring'), h('span', { class: 'lg' }, h('i', { class: 'dot' }), 'Sabine'), h('span', { class: 'lg' }, h('i', { class: 'band' }), 'Target')),
      h('p', { class: 'note' }, `Statistical model of the room and alcove (${rt.V.toFixed(0)} m³, ${rt.S.toFixed(0)} m² of surfaces), with the opening to the stairs and hall counted as absorption. Below about ${fmtF(rt.schroeder)} the Bass tab's decay is the real answer.`)),
    sect('Treatment', h('div', { class: 'treat' },
      h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Corner bass traps'), tchips([[0, 'None'], [2, '2 front'], [4, '4 corners']], t.traps, (v) => setTune({ traps: v }))),
      toggleRow('2″ panels at the side-wall reflection points', t.reflPanels, (v) => setTune({ reflPanels: v }), `${acReflectionPanelSpots().length} panels, 2 × 4 ft`),
      toggleRow('4″ panels on the wall behind the seats', t.rearPanels, (v) => setTune({ rearPanels: v }), 'two, 2 × 4 ft, on the solid wall beside the stairs'),
      toggleRow('Ceiling cloud over the seats', t.cloud, (v) => setTune({ cloud: v }), '4″, 4 × 6 ft, hung 2″ down'),
      h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'People watching'), tchips([[0, 'Empty room'], [2, '2'], [4, '4'], [6, '6']], t.people, (v) => setTune({ people: v }))),
      toggleRow('Solid-core door at the stairs', t.door, (v) => setTune({ door: v }), 'keeps sound downstairs (not part of RT60)'),
      h('p', { class: 'note' }, 'Panels you hang from Furnish › Wall décor (Acoustic panel) count too, where they are. Treatments here appear in the room as outlines.'))),
    sect('What absorbs the sound', h('table', { class: 'ttable' }, h('thead', {}, h('tr', {}, h('th', {}, 'Surface'), h('th', {}, 'Area'), h('th', {}, 'α 125'), h('th', {}, 'α 500'), h('th', {}, 'Share at 500 Hz'))),
      h('tbody', {}, surf.map((s) => h('tr', {}, h('td', {}, s.label), h('td', {}, `${s.area.toFixed(1)} m²`), h('td', {}, s.a[1].toFixed(2)), h('td', {}, s.a[3].toFixed(2)),
        h('td', {}, h('span', { class: 'bar', style: `--w:${Math.max(1, s.area * s.a[3] / A500 * 100)}%` }), `${(s.area * s.a[3] / A500 * 100).toFixed(0)}%`))),
        rt.units.map((u) => h('tr', {}, h('td', {}, u.label), h('td', {}, '—'), h('td', {}, (u.a[1] * u.n).toFixed(1) + ' m²'), h('td', {}, (u.a[3] * u.n).toFixed(1) + ' m²'),
          h('td', {}, h('span', { class: 'bar', style: `--w:${Math.max(1, u.n * u.a[3] / A500 * 100)}%` }), `${(u.n * u.a[3] / A500 * 100).toFixed(0)}%`)))))));
}
function toggleRow(label, on, fn, sub) {
  const input = h('input', { type: 'checkbox', role: 'switch', checked: !!on }); input.addEventListener('change', () => fn(input.checked));
  return h('label', { class: 'toggle trow2' }, h('span', {}, label, sub ? h('small', {}, sub) : null), input);
}

// ---------------- Reflections ----------------
function tabRefl() {
  const lay = TA.lay.filter((c) => !c.k.startsWith('T')), ch = lay.find((c) => c.k === TV.reflCh) || lay[0];
  const spk = { x: ch.p[0], y: ch.p[1], z: ch.z }, list = firstReflections(spk, { x: TA.mlp.x, y: TA.mlp.y, z: AC.ear });
  const cv = h('canvas', { class: 'chart', 'data-chart': 1 }); cv._draw = () => drawETC(cv, list);
  const spots = acReflectionPanelSpots();
  return h('div', {},
    sect(null, h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Speaker'), tchips(lay.map((c) => [c.k, c.k]), ch.k, (v) => { TV.reflCh = v; renderTune(); }))),
    sect(`${ch.name} → main seat: first reflections`, cv,
      h('p', { class: 'note' }, 'Energy-time view: the direct sound at 0 ms and each first reflection (level after the surface\'s absorption at 2 kHz and the speaker\'s directivity). Inside the shaded box (louder than −10 dB in the first 15 ms) a reflection smears dialogue and imaging.'),
      h('table', { class: 'ttable' }, h('thead', {}, h('tr', {}, h('th', {}, 'Surface'), h('th', {}, 'Lands at'), h('th', {}, 'Delay'), h('th', {}, 'Level'), h('th', {}, 'Material'))),
        h('tbody', {}, list.map((q) => h('tr', { class: q.delay < 15 && q.level > -10 ? 'warn' : '' }, h('td', {}, q.surface), h('td', {}, `${ftin(q.z)} up`), h('td', {}, `${q.delay.toFixed(1)} ms`), h('td', {}, `${q.level.toFixed(1)} dB`), h('td', {}, MAT_NAME[q.mat] || q.mat)))))),
    sect('Treat them', h('p', { class: 'note' }, `${spots.length} side-wall points catch the first reflections of the left, centre and right speakers at the main seat. Mirror trick: where a friend's mirror on the wall shows you the speaker from your seat.`),
      h('div', { class: 'btnrow' },
        h('button', { class: 'btn primary', onclick: () => hangPanels(spots) }, `Hang ${spots.length} acoustic panels there`),
        h('button', { class: 'btn', onclick: () => setTune({ reflPanels: !state.tune.reflPanels }) }, state.tune.reflPanels ? 'Remove the planned panels' : 'Plan them (outline only)'),
        h('button', { class: 'btn', onclick: () => setTune({ cloud: !state.tune.cloud }) }, state.tune.cloud ? 'Remove the ceiling cloud' : 'Add a ceiling cloud'))));
}
function hangPanels(spots) {
  pushHistory();
  for (const s of spots) {
    const it = { id: uid('acousticPanel'), type: 'acousticPanel', x: s.x, y: s.y, rot: 0, p: { ...CATALOG.acousticPanel.defaults, h: Math.round(s.z) } };
    state.items.push(it); buildItem(it); placeOnWall(it, s.x, s.y, it.p.h); placeItem(itemObjects.get(it.id).group, it);
  }
  state.tune.reflPanels = false;
  updateLighting(); commit(false); snack(`${spots.length} acoustic panels hung`); tuneChanged();
}

// ---------------- Speakers ----------------
function tabSpeakers() {
  const t = state.tune, lay = TA.lay;
  return h('div', {},
    sect(null,
      h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Layout'), tchips(Object.keys(LAYOUTS).map((k) => [k, k]), t.layout, (v) => setTune({ layout: v }))),
      h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Speakers'), tchips(Object.entries(SPK_CLASSES).map(([k, s]) => [k, s.label]), t.spk, (v) => setTune({ spk: v }))),
      h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Amplifier'), tchips([[50, '50 W'], [100, '100 W'], [200, '200 W'], [400, '400 W']], t.amp, (v) => setTune({ amp: v }))),
      h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Loudest level'), tchips([[0, 'Reference'], [-5, '−5 dB'], [-10, '−10 dB']], t.refLvl ?? -5, (v) => setTune({ refLvl: v })))),
    sect(`${t.layout} from the main seat`, spkTable(lay),
      h('p', { class: 'note' }, `Angles after Dolby's home-theatre guidelines (tops by their elevation seen from the side). Delay and trim are what an AV receiver sets so every channel arrives together and equally loud at the main seat. Headroom: peaks of ${105 + (t.refLvl ?? -5)} dB at the main seat (${refName()}).`),
      showSpkToggle()));
}
function spkTable(lay) {
  const head = h('thead', {}, h('tr', {}, ...['Ch.', 'Where', 'Angle', 'Distance', 'Delay · trim', 'Headroom'].map((x) => h('th', {}, x))));
  const rows = lay.map((c) => h('tr', { class: c.ok ? '' : 'warn' },
    h('td', {}, h('b', {}, c.k), h('small', {}, c.name)), h('td', {}, c.how), h('td', {}, `${c.actual}${c.ok ? ' ✓' : ' ✕'}`, h('small', {}, `Dolby ${c.target}`)),
    h('td', {}, ftin(c.dist)), h('td', {}, `${c.delay.toFixed(1)} ms`, h('small', {}, `${sgn(c.trim)} dB`)), h('td', { class: c.headroom < 0 ? 'bad' : '' }, `${sgn(c.headroom)} dB`)));
  return h('div', { class: 'tscroll' }, h('table', { class: 'ttable spk' }, head, h('tbody', {}, rows)));
}
function showSpkToggle() {
  const i = h('input', { type: 'checkbox', role: 'switch', checked: state.showSpeakers });
  i.addEventListener('change', () => { pushHistory(); state.showSpeakers = i.checked; commit(false); });
  return h('label', { class: 'toggle' }, h('span', {}, 'Show the speakers in the room after closing'), i);
}

// ---------------- Report ----------------
function tabReport() {
  return h('div', {},
    sect('Report', h('p', { class: 'note' }, 'Everything on one page for an installer or calibrator: the scorecard, the subwoofer positions and settings, the room EQ, speaker distances, delays and trims, treatment, and the charts.'),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn primary', onclick: downloadReport }, 'Download report (HTML)'), h('button', { class: 'btn', onclick: () => copyText(reportText(), 'Settings copied') }, 'Copy settings as text'))),
    sect('How the model works', h('ul', { class: 'method' },
      h('li', {}, h('b', {}, 'Bass (below ~200 Hz): '), 'the floor plan is cut into 5″ cells and the room\'s modes are solved from the wave equation (shift-invert Lanczos), including the alcove, the fireplace lounge, the pilaster and the open stairs and hall. The 9′ ceiling adds the vertical modes. Each mode is damped by what its pressure meets: drywall walls and ceiling, the floor, the openings, the seats and any traps or panels, so corner traps help more than mid-wall ones, as in real rooms.'),
      h('li', {}, h('b', {}, 'Responses: '), 'every seat\'s response, the bass map, the impulse response, waterfall and decay all come from the same modal sum, with each sub\'s roll-off, the crossover, gain, delay, polarity and EQ.'),
      h('li', {}, h('b', {}, 'Reverberation: '), 'Sabine and Eyring per octave from the surfaces, furniture, people and treatment, with typical published absorption coefficients.'),
      h('li', {}, h('b', {}, 'Reflections: '), 'image sources on the real walls, ceiling and floor, with the speaker\'s directivity and the absorption where each lands.'),
      h('li', {}, h('b', {}, 'Limits: '), 'walls are modelled as rigid with an absorption-based loss (no transmission into the framing), furniture doesn\'t block bass, and absorption figures are typical rather than measured. Measure with a microphone (REW) to confirm, then use the same EQ and DSP workflow.'))));
}
function reportText() {
  const A = TA, t = state.tune, subs = currentSubs();
  const L = [`Basement Cinema · acoustic plan`, `Score ${A.score.total}/100`, '', ...A.score.rows.map((r) => `${r.label}: ${r.value} (${r.g})`), '',
    'Subwoofers:', ...subs.map((s, i) => `  SW${i + 1}: ${ftin(s.x)} from the fireplace wall, ${ftin(s.y)} from the stair wall · gain ${sgn(s.g || 0)} dB · delay ${(s.d || 0).toFixed(1)} ms · polarity ${s.pol === -1 ? 'inverted' : 'normal'}`),
    `  Model: ${SUB_MODELS[t.sub].label} · ${t.signal === 'managed' ? `crossover ${t.xo} Hz` : 'LFE'}`, '',
    'Room EQ:', ...(A.eq.length ? A.eq.map((q, i) => `  ${i + 1}. PK ${q.f.toFixed(1)} Hz ${sgn(q.g)} dB Q ${q.q.toFixed(2)}`) : ['  none']), '',
    `Speakers (${t.layout}):`, ...A.lay.map((c) => `  ${c.k.padEnd(4)} ${c.name.padEnd(22)} ${c.actual.padEnd(10)} target ${c.target.padEnd(12)} ${ftin(c.dist).padEnd(9)} delay ${c.delay.toFixed(1)} ms trim ${sgn(c.trim)} dB · ${c.how}`), '',
    `Reverberation (Eyring): ${A.rt.bands.map((b, i) => `${OCT_LABEL[i]} ${b.eyring.toFixed(2)} s`).join(' · ')}`,
    `Treatment: traps ${t.traps} · reflection panels ${t.reflPanels ? 'yes' : 'no'} · rear panels ${t.rearPanels ? 'yes' : 'no'} · cloud ${t.cloud ? 'yes' : 'no'}`, '',
    'Advice:', ...A.advice.map((a, i) => `  ${i + 1}. ${a.title}: ${a.detail}`)];
  return L.join('\n');
}
function downloadReport() {
  // render the charts off-screen at a fixed size and inline them
  const shot = (fn) => { const cv = document.createElement('canvas'); cv.style.width = '720px'; cv.style.height = '260px'; document.body.append(cv); fn(cv); const url = cv.toDataURL('image/png'); cv.remove(); return url; };
  const V = bassView();
  const imgs = [['Frequency response at the seats', shot((cv) => drawResponse(cv, null, V))], ['Waterfall at the main seat', shot((cv) => drawWaterfall(cv, V))],
    ['Low-frequency decay', shot((cv) => drawDecay(cv))], ['Reverberation time', shot((cv) => drawRT(cv, TA.rt))]];
  const plan = (() => { try { return window.__cinema.capture('image/jpeg', 0.85); } catch (e) { return ''; } })();
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Basement Cinema · acoustic plan</title><style>
body{font:14px/1.5 system-ui,sans-serif;max-width:800px;margin:32px auto;padding:0 16px;color:#1c1814;background:#fff}h1{font-weight:400;font-size:28px;margin:0}h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;margin:28px 0 8px;color:#7a5a2e}
img{width:100%;border-radius:8px;background:#151210}pre{background:#f6f2ea;padding:12px;border-radius:8px;white-space:pre-wrap;font-size:12px}.s{font-size:44px;color:#b07a33}</style></head><body>
<h1>Basement Cinema · acoustic plan</h1><p>${new Date().toLocaleDateString()} · <span class="s">${TA.score.total}</span>/100</p>
${plan ? `<h2>Bass map and layout</h2><img src="${plan}">` : ''}
${imgs.map(([t, u]) => `<h2>${esc(t)}</h2><img src="${u}">`).join('')}
<h2>Settings and advice</h2><pre>${esc(reportText())}</pre></body></html>`;
  downloadBlob(new Blob([html], { type: 'text/html' }), 'basement-cinema-acoustics.html');
  toast('Report downloaded');
}
