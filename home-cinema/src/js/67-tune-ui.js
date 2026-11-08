// ===================================================================
// 67 · Cinema tuning studio, organised around what a customer wants to know:
//  Summary  · how the room sounds today, and with the plan, in five qualities you can judge by ear
//  Plan     · the steps, in order, each with what it changes, what it costs and how long it takes
//  Bass     · every seat's bass, where in the room it's good, subwoofer options and sizing
//  Dialogue · echoes and where panels go, echo time, sound reaching the floor above
//  Speakers · the layout, where each speaker goes, and what to buy for the loudness you want
//  Report   · the shopping list and the installer's settings
// The engineering views (responses, EQ filters, waterfall, decay, modes, energy-time, RT60 tables)
// sit under "Pro detail" in each tab.
// ===================================================================
const TV = { open: false, tab: 'summary', f: 41, mapKind: 'quality', preview: null, opt: null, optN: 2, optKeep: false, optRunning: null, busy: '',
  modeSel: null, reflCh: 'front', smooth: 6, prev: null, timer: 0, planBusy: '',
  pro: (() => { try { return localStorage.getItem('basement-cinema-pro') === '1'; } catch (e) { return false; } })() };
const tuneGroup = new THREE.Group(); helpersGroup.add(tuneGroup);
const SEAT_COLORS = ['#7fb3d5', '#d6a463', '#8fbf8a', '#c89bd6', '#e07a62', '#6fc2b8', '#c9c27a', '#b9a58c'];
const TABS = [['summary', 'Summary'], ['plan', 'Plan'], ['bass', 'Bass'], ['dialogue', 'Dialogue'], ['speakers', 'Speakers'], ['report', 'Report']];
const fmtF = (f) => (f >= 100 ? f.toFixed(0) : f.toFixed(1).replace(/\.0$/, '')) + ' Hz';
const sgn = (v, d = 1) => { const r = Number(v.toFixed(d)); return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(d)}`; };
const VCLASS = { Excellent: 'qE', Good: 'qG', Fair: 'qF', Poor: 'qP' };
const SUBNOTE = (n) => (n === 2 ? 'two subwoofers' : n === 1 ? 'one subwoofer' : `${n} subwoofers`);

// ---------------- open / close ----------------
function initTune() {
  const pro = h('label', { class: 'mini-toggle pro-toggle', title: 'Show the engineering charts and tables in every tab' },
    h('input', { type: 'checkbox', checked: TV.pro, onchange: (e) => { TV.pro = e.target.checked; try { localStorage.setItem('basement-cinema-pro', TV.pro ? '1' : '0'); } catch (err) { /* ok */ } renderTune(); } }), 'Pro detail');
  const panel = h('aside', { class: 'tune', id: 'tune', 'aria-label': 'Cinema tuning', hidden: true },
    h('header', { class: 'tune-head' },
      h('div', { class: 'tune-titles' }, h('span', { class: 'tune-kicker' }, 'Cinema tuning'), h('h2', {}, 'How your room will sound'), h('p', { id: 'tuneSub' }, '')),
      pro, h('button', { class: 'tune-x', 'aria-label': 'Close tuning', onclick: () => closeTune() }, '✕')),
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
  TV.open = false; TV.preview = null; listenStop();
  $('#tune').hidden = true; $('#app').classList.remove('tuning'); $('#tuneBtn').setAttribute('aria-pressed', 'false');
  if (TV.prev) { $('#leftPanel').classList.toggle('collapsed', !TV.prev.left); $('#rightPanel').classList.toggle('collapsed', !TV.prev.right); }
  disposeTune();
  setTimeout(() => { resize(); if (mode === 'plan') fitPlan(); }, 30);
}
function tuneTab(k, quiet) {
  TV.tab = k;
  if (k !== 'bass' && TV.mapKind === 'mode') TV.mapKind = 'quality';
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
  try { TA = assess(); if (TA) TA.key = planKey(); } catch (err) { console.error(err); }
  if (LISTEN.playing && LISTEN.key.indexOf(planKey()) !== 0) listenStop();
  renderTune();
  // then the plan, in the background
  if (TA && !(PLAN && PLAN.key === TA.key)) {
    TV.planBusy = 'Working out your plan';
    buildPlan((msg) => { TV.planBusy = msg; const el = $('#planBusy'); if (el) el.textContent = `${msg}…`; })
      .then((pl) => { TV.planBusy = ''; if (pl && TV.open) renderTune(); })
      .catch((err) => { console.error(err); TV.planBusy = ''; });
  }
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
const planReady = () => PLAN && TA && PLAN.key === TA.key;

// ---------------- rendering the panel ----------------
function renderTune() {
  const body = $('#tuneBody'); if (!body || !TV.open) return;
  const nSubs = currentSubs().filter((s) => s.real).length;
  $('#tuneSub').textContent = `${state.tune.layout} · ${nSubs ? SUBNOTE(nSubs) : 'no subwoofer yet'} · listening level: ${refName().toLowerCase()}`;
  const keep = body.scrollTop;
  body.replaceChildren();
  if (TV.busy || !TA) {
    body.append(h('div', { class: 'tune-busy' }, h('div', { class: 'tprog', id: 'tuneProgress' }, h('i')), h('p', { id: 'tuneProgressMsg' }, TV.busy || 'Listening to the room…'),
      h('p', { class: 'note' }, 'The planner is solving how sound waves behave in your actual floor plan: the room, the TV alcove, the fireplace lounge, the stairs and the hall. It takes a few seconds once; after that, moving furniture or speakers updates instantly.')));
    drawTuneOverlay(); return;
  }
  const fn = { summary: tabSummary, plan: tabPlan, bass: tabBass, dialogue: tabDialogue, speakers: tabSpeakers, report: tabReport }[TV.tab];
  body.append(fn());
  body.scrollTop = keep;
  requestAnimationFrame(() => { $$('canvas[data-chart]', body).forEach((cv) => cv.offsetParent && cv._draw && cv._draw()); renderListen(); renderMapControls(); });
  drawTuneOverlay();
}
const sect = (title, ...kids) => h('section', { class: 'tsec' }, title ? h('h3', {}, title) : null, ...kids);
const tchips = (opts, cur, pick, cls = '') => h('div', { class: 'chips ' + cls }, opts.map(([v, label]) => h('button', { class: 'chip', 'aria-pressed': String(v === cur), onclick: () => pick(v) }, label)));
const vchip = (v) => h('span', { class: 'vchip ' + VCLASS[v] }, v);
/** A collapsible "Pro detail" block; its charts draw when it opens. */
function pro(title, ...kids) {
  const d = h('details', { class: 'pro', open: TV.pro }, h('summary', {}, h('span', { class: 'pro-tag' }, 'Pro'), title), h('div', { class: 'pro-body' }, ...kids));
  d.addEventListener('toggle', () => { if (d.open) requestAnimationFrame(() => $$('canvas[data-chart]', d).forEach((cv) => cv._draw && cv._draw())); });
  return d;
}
function chart(cls, draw) { const cv = h('canvas', { class: 'chart ' + cls, 'data-chart': 1 }); cv._draw = () => draw(cv); return cv; }
function loudnessChips() {
  return h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'How loud'), tchips(Object.entries(LOUDNESS).map(([k, v]) => [Number(k), v.label]), state.tune.refLvl ?? -5, (v) => setTune({ refLvl: v })),
    h('small', { class: 'tnote' }, loudness().note));
}

// ---------------- Summary ----------------
const PHRASE = { seats: 'uneven bass along the sofa', tight: 'boomy, ringing bass', clarity: 'echoes that blur dialogue', immersion: 'speakers that can\'t reach the right angles', privacy: 'sound carrying upstairs' };
function headline(A) {
  const low = QUALITIES.filter((q) => q.key !== 'privacy' && A.q[q.key] < 70).sort((a, b) => A.q[a.key] - A.q[b.key]).map((q) => PHRASE[q.key]);
  if (!low.length) return 'Your room is in good shape: even bass, clear dialogue and well-placed speakers.';
  const list = low.length === 1 ? low[0] : `${low.slice(0, -1).join(', ')} and ${low[low.length - 1]}`;
  return `${list[0].toUpperCase()}${list.slice(1)}.`;
}
function meter(today, after) {
  return h('div', { class: 'meter' }, h('i', { class: 'm-scale' }),
    after != null ? h('i', { class: 'm-gain', style: `left:${Math.min(today, after)}%;width:${Math.abs(after - today)}%` }) : null,
    h('b', { class: 'm-now', style: `left:${today}%`, title: `Today: ${Math.round(today)}` }),
    after != null ? h('b', { class: 'm-after', style: `left:${after}%`, title: `With the plan: ${Math.round(after)}` }) : null);
}
function tabSummary() {
  const A = TA, P = planReady() ? PLAN : null, after = P ? P.after : null;
  const cost = P ? planCost(P) : null, nSteps = P ? P.steps.filter((s) => !s.info).length : 0;
  const done = P && !nSteps;
  const hero = h('div', { class: 'hero' },
    h('div', { class: 'hero-col' }, h('small', {}, done ? 'Your room' : 'Today'), h('b', {}, String(A.overall)), vchip(verdictOf(A.overall))),
    done ? h('div', { class: 'hero-col' }, h('small', {}, 'Plan'), h('b', { class: 'busy' }, 'Nothing left to do: every step is in place.')) : null,
    done ? null : h('div', { class: 'hero-arrow' }, '→'),
    done ? null : h('div', { class: 'hero-col' + (P ? '' : ' wait') }, h('small', {}, 'With the plan'), P ? h('b', {}, String(after.overall)) : h('b', { id: 'planBusy', class: 'busy' }, `${TV.planBusy || 'Working out your plan'}…`), P ? vchip(verdictOf(after.overall)) : null));
  const lead = h('p', { class: 'lead' }, headline(A), P && nSteps ? ` ${nSteps} steps fix most of it` + (cost ? `, for about ${usd(cost[0], cost[1])} in all.` : '.') : '');
  const cards = h('div', { class: 'qcards' }, QUALITIES.map((q) => {
    const v = A.q[q.key], a = after ? after.q[q.key] : null;
    return h('button', { class: 'qcard', onclick: () => tuneTab(q.tab) },
      h('div', { class: 'qhead' }, h('b', {}, q.title), vchip(verdictOf(v)), a != null && Math.round(a) > Math.round(v) + 2 ? h('span', { class: 'qto' }, '→ ', vchip(verdictOf(a))) : null),
      h('small', { class: 'qask' }, q.ask), meter(v, a != null && a > v + 2 ? a : null), h('p', {}, A.say[q.key]));
  }));
  return h('div', {},
    sect(null, hero, lead, P && nSteps ? h('div', { class: 'btnrow' }, h('button', { class: 'btn primary', onclick: () => tuneTab('plan') }, 'See the plan'), h('button', { class: 'btn', onclick: () => tuneTab('report') }, 'Shopping list')) : null),
    sect('What you\'ll hear', cards, h('p', { class: 'note' }, 'Scores out of 100 from the room model. ● today · ○ with the plan. Tap a quality for the detail.')),
    sect(null, listenCard()),
    sect('What the analysis assumes', assumptions(A)));
}
function assumptions(A) {
  const nSubs = currentSubs().filter((s) => s.real).length, t = state.tune;
  return h('ul', { class: 'assume' },
    h('li', {}, nSubs ? `${SUBNOTE(nSubs)} where you placed ${nSubs > 1 ? 'them' : 'it'}.` : 'No subwoofer in the layout yet: "today" assumes one in the front-right corner, where the pre-wire plan puts it. The plan shows where it should really go.'),
    h('li', {}, `Speakers: a ${t.layout} layout placed at Dolby's angles from the main seat (change it in Speakers).`),
    h('li', {}, `The sofa's ${A.ctx.seats.filter((s) => s.main).length} seats, ears 38″ up. The main listening position (MLP) is the seat facing the TV.`),
    h('li', {}, loudnessChips()),
    h('li', {}, 'Typical absorption for drywall, laminate and upholstery. It\'s a model: confirm with a measurement microphone (REW) once the gear is in.'));
}

// ---------------- Plan ----------------
function planCost(P) {
  let lo = 0, hi = 0;
  for (const s of P.steps) { const m = String(s.cost).match(/\$([\d,]+)(?:–([\d,]+))?/); if (m) { const a = +m[1].replace(/,/g, ''), b = m[2] ? +m[2].replace(/,/g, '') : a; lo += a; hi += b; } }
  return lo || hi ? [lo, hi] : null;
}
const QSHORT = { seats: 'Bass at every seat', tight: 'Tight bass', clarity: 'Dialogue', immersion: 'Immersion', privacy: 'Privacy' };
function tabPlan() {
  if (!planReady()) return h('div', { class: 'tune-busy' }, h('div', { class: 'tprog indet' }, h('i')), h('p', { id: 'planBusy' }, `${TV.planBusy || 'Working out your plan'}…`),
    h('p', { class: 'note' }, 'Trying subwoofer layouts, the sofa\'s position, bass traps, panels and speaker layouts on a copy of your room, one after another, to find what helps most.'));
  const P = PLAN, steps = P.steps, cost = planCost(P);
  let score = P.before.overall;
  const cards = steps.map((s, i) => {
    const deltas = QUALITIES.map((q) => q.key).filter((k) => Math.round(s.after[k]) - Math.round(s.before[k]) >= 3)
      .map((k) => (verdictOf(s.before[k]) === verdictOf(s.after[k])
        ? h('span', { class: 'delta' }, QSHORT[k], ' ', vchip(verdictOf(s.after[k])), ` better (+${Math.round(s.after[k] - s.before[k])})`)
        : h('span', { class: 'delta' }, QSHORT[k], ' ', vchip(verdictOf(s.before[k])), ' → ', vchip(verdictOf(s.after[k])))));
    if (!s.info) score += s.gain;
    return h('div', { class: 'step' + (s.info ? ' info' : '') },
      h('span', { class: 'step-n' }, String(i + 1)),
      h('div', { class: 'step-b' }, h('b', {}, s.title), h('p', {}, s.why), s.note ? h('p', { class: 'step-note' }, s.note) : null,
        deltas.length ? h('div', { class: 'deltas' }, deltas) : s.info ? h('div', { class: 'deltas' }, h('span', { class: 'delta' }, 'Advice: the model can\'t score this one')) : null,
        h('div', { class: 'step-meta' }, h('span', {}, '💲 ', s.cost), h('span', {}, '⏱ ', s.effort), !s.info ? h('span', {}, `Score ${Math.round(score - s.gain)} → ${Math.round(score)}`) : null)),
      s.act ? h('div', { class: 'step-acts' },
        s.act.kind === 'subs' ? h('button', { class: 'btn', onclick: () => { TV.preview = { label: s.title, subs: s.act.subs }; tuneTab('bass'); } }, 'Preview') : null,
        h('button', { class: 'btn primary', onclick: () => { doStep(s.act); } }, 'Do it')) : null);
  });
  return h('div', {},
    sect(null, h('div', { class: 'plan-head' },
      h('div', {}, h('b', {}, `${steps.filter((s) => !s.info).length} steps · ${P.before.overall} → ${P.after.overall}`), h('small', {}, cost ? `About ${usd(cost[0], cost[1])} in all (typical retail, before installation)` : '')),
      h('button', { class: 'btn primary', onclick: applyPlan }, 'Apply the whole plan')),
      h('p', { class: 'note' }, 'In the order a pro would do them: subwoofers and seating first (they decide the bass), then treatment, then the door. Each step was tried on a copy of your room on top of the ones before it, so the effects add up as shown. Applying puts the subwoofers, panels and treatment into your layout (Undo takes them back).')),
    sect(null, h('div', { class: 'steps' }, cards)));
}
/** Apply one step of the plan to the real layout. */
function doStep(act, record = true) {
  if (act.kind === 'subs') { applySubConfig(act.subs, record); if (record) snack(`${act.subs.length} subwoofer${act.subs.length > 1 ? 's' : ''} placed`); }
  else if (act.kind === 'row') { const L = mainSeatLine(); if (L) { if (record) pushHistory(); L.it.x += L.ez[0] * act.off; L.it.y += L.ez[1] * act.off; placeItem(itemObjects.get(L.it.id).group, L.it); commit(false); if (record) snack(`Sofa moved ${Math.abs(act.off)}″`); } }
  else if (act.kind === 'refl') { if (record) pushHistory(); state.tune.reflPanels = true; save(); }
  else if (act.kind === 'tune') { if (record) pushHistory(); Object.assign(state.tune, act.patch); save(); }
  TV.preview = null;
  if (record) tuneChanged();
}
function applyPlan() {
  if (!planReady()) return;
  pushHistory();
  for (const s of PLAN.steps) if (s.act) doStep(s.act, false);
  commit(false); snack('Plan applied'); tuneChanged();
}

// ---------------- Bass ----------------
function previewOrCurrent() { return TV.preview ? TV.preview.subs : currentSubs(); }
function bassView() {
  if (!TV.preview) return { ctx: TA.ctx, subs: TA.subs, eq: TA.eq, resp: TA.resp, m: TA.m, raw: TA.raw };
  const ctx = TA.ctx, subs = TV.preview.subs, eq = state.tune.eqOn ? autoEQ(ctx, subs) : [];
  const resp = bassResponses(ctx, subs, { eq: eq.length ? eq : null });
  return { ctx, subs, eq, resp, m: bassMetrics(resp, ctx.F), raw: bassResponses(ctx, subs, { eq: null }) };
}
function tabBass() {
  const A = TA, V = bassView(), wrap = h('div', {});
  if (TV.preview) wrap.append(h('div', { class: 'preview-bar' }, h('span', {}, `Previewing: ${TV.preview.label}`),
    h('button', { class: 'btn primary', onclick: () => { applySubConfig(TV.preview.subs); TV.preview = null; snack('Subwoofers placed'); tuneChanged(); } }, 'Place them'),
    h('button', { class: 'btn', onclick: () => { TV.preview = null; renderTune(); } }, 'Cancel')));
  // verdicts
  const seatsRep = TV.preview ? seatReport({ ...A, resp: V.resp, m: V.m }) : A.seatsQ;
  wrap.append(sect('Bass at every seat', h('p', { class: 'say' }, vchip(verdictOf(lin(V.m.ssv, 2, 7))), ' ', TV.preview ? `Seat to seat the bass varies by ±${V.m.ssv.toFixed(1)} dB with this layout (today ±${A.m.ssv.toFixed(1)}).` : A.say.seats),
    h('div', { class: 'seatlist' }, seatsRep.filter((r) => r.seat.main || state.tune.allSeats).map((r) => h('div', { class: 'seatrow' },
      h('b', {}, r.seat.label), vchip(r.verdict), h('span', { class: 'sbar' }, h('i', { style: `width:${clamp(100 - r.rms * 12, 6, 100)}%` })),
      h('small', {}, r.issue ? `${r.issue.d < 0 ? 'thin' : 'boomy'} around ${hz(r.issue.f)} (${sgn(r.issue.d, 0)} dB)` : 'even all the way down')))),
    h('p', { class: 'say' }, vchip(verdictOf(TV.preview ? 0.6 * lin(V.m.flat, 1.5, 5) + 0.4 * lin(A.ring, 0, 0.35) : A.q.tight)), ' ', A.say.tight)));
  // the map
  wrap.append(sect('Where in the room the bass is good', h('div', { id: 'mapControls' })));
  // listening
  wrap.append(sect(null, listenCard()));
  // subwoofer options
  wrap.append(subOptions(V));
  // sizing
  wrap.append(sizingSection());
  // pro
  wrap.append(proBass(V));
  return wrap;
}
const NOTE_PRESETS = [[25, 'Explosions'], [41, 'Low E string'], [55, 'Kick drum'], [80, 'Bass body']];
function renderMapControls() {
  const box = $('#mapControls'); if (!box) return;
  const kinds = tchips([['quality', 'Where it\'s good'], ['note', 'One note at a time']], TV.mapKind === 'mode' ? 'note' : TV.mapKind, (v) => { TV.mapKind = v; renderMapControls(); drawTuneOverlay(); });
  if (TV.mapKind === 'quality') {
    box.replaceChildren(kinds, h('p', { class: 'note' }, 'Colours on the floor: how far the bass at each spot strays from the target across 20–100 Hz, with the room EQ, level-matched on the sofa. Green sounds even and punchy; red is boomy in some notes and thin in others.'),
      h('div', { class: 'qlegend' }, ['Excellent', 'Good', 'Fair', 'Poor'].map((v, i) => h('span', {}, h('i', { style: `background:rgb(${qualColor([1.5, 3.4, 5, 7.5][i]).map(Math.round).join(',')})` }), v))));
    return;
  }
  const lf = Math.log2(TV.f / 15) / Math.log2(200 / 15);
  const out = h('b', { class: 'mapf' }, `${fmtF(TV.f)} · ${noteName(TV.f)}`), what = h('small', { class: 'mapwhat' }, bassWhat(TV.f));
  const sl = h('input', { type: 'range', min: 0, max: 1000, value: String(Math.round(lf * 1000)), 'aria-label': 'Note' });
  sl.addEventListener('input', () => { TV.f = 15 * (200 / 15) ** (sl.value / 1000); TV.mapKind = 'note'; out.textContent = `${fmtF(TV.f)} · ${noteName(TV.f)}`; what.textContent = bassWhat(TV.f); drawTuneOverlay(); });
  box.replaceChildren(kinds, h('div', { class: 'maprow' }, out, sl), what,
    h('div', { class: 'chips' }, NOTE_PRESETS.map(([f, l]) => h('button', { class: 'chip', onclick: () => { TV.f = f; TV.mapKind = 'note'; renderMapControls(); drawTuneOverlay(); } }, `${l} · ${f} Hz`))),
    h('p', { class: 'note' }, 'How loud this one note is at each spot compared with the room average. Blue: it nearly vanishes (a null). Amber: it booms (a peak). Play the slow sweep below to watch it move.'),
    h('div', { class: 'cbar' }, h('span', {}, 'vanishes'), h('i'), h('span', {}, 'booms')));
}
function subOptions(V) {
  const real = currentSubs().filter((s) => s.real);
  const opts = [];
  if (planReady()) {
    if (PLAN.best2) opts.push({ label: `Two subs · ${subLabel(PLAN.best2.subs)}`, subs: PLAN.best2.subs, rec: PLAN.steps.some((s) => s.key === 'subs' && s.act.subs === PLAN.best2.subs) });
    if (PLAN.best1) opts.push({ label: `One sub · ${subLabel(PLAN.best1.subs)}`, subs: PLAN.best1.subs, rec: PLAN.steps.some((s) => s.key === 'subs' && s.act.subs === PLAN.best1.subs) });
  }
  for (const c of (TV.opt || [])) opts.push({ label: `Searched: ${subLabel(c.subs)}`, subs: c.subs });
  for (const c of subPresets()) opts.push({ label: c.label.replace(/^(\d) · /, (m, n) => `${n === '1' ? 'One sub' : n === '2' ? 'Two subs' : 'Four subs'} · `), subs: c.subs });
  const scored = compareConfigs(opts);
  scored.forEach((o, i) => { o.rec = opts[i].rec; });
  scored.sort((a, b) => (b.rec - a.rec) || a.score - b.score);
  const today = { ssv: TA.mRaw.ssv, flat: TA.mRaw.flat };
  const card = (o) => {
    const vs = verdictOf(lin(o.ssv, 2, 7)), vt = verdictOf(lin(o.flat, 1.5, 5));
    return h('div', { class: 'opt-card' + (o.rec ? ' rec' : '') + (TV.preview && TV.preview.label === o.label ? ' on' : '') },
      h('div', { class: 'oc-t' }, o.rec ? h('span', { class: 'rec-tag' }, 'Recommended') : null, h('b', {}, o.label)),
      h('div', { class: 'oc-v' }, h('span', {}, 'Every seat ', vchip(vs)), h('span', {}, 'Smooth ', vchip(vt)), h('small', {}, `±${o.ssv.toFixed(1)} dB seat to seat`)),
      h('div', { class: 'oc-a' }, h('button', { class: 'btn', onclick: () => { TV.preview = { label: o.label, subs: o.subs }; renderTune(); } }, 'Preview'),
        h('button', { class: 'btn primary', onclick: () => { applySubConfig(o.subs); TV.preview = null; snack('Subwoofers placed'); tuneChanged(); } }, 'Place')));
  };
  const search = h('div', { class: 'optctl' }, h('span', { class: 'tl' }, 'Search'), tchips([[1, '1 sub'], [2, '2'], [3, '3'], [4, '4 subs']], TV.optN, (v) => { TV.optN = v; renderTune(); }),
    h('button', { class: 'btn', disabled: !!TV.optRunning, onclick: runOptimiser }, TV.optRunning || 'Search every spot'));
  return sect('Subwoofer options',
    h('p', { class: 'note' }, `Today: ${real.length ? SUBNOTE(real.length) : 'no subwoofer yet (assumed in the front-right corner)'}, ±${today.ssv.toFixed(1)} dB seat to seat. Spots are along the walls and behind the seats, clear of the sofa, chairs, console and towers; a few ask you to move a small piece. Preview shows the result on the map and the seats; Place puts the subs in your layout.`),
    h('div', { class: 'opt-cards' }, scored.slice(0, 6).map(card)), search,
    h('p', { class: 'note' }, 'Why two subs? Every room has spots where a note cancels itself out. Two subs in the right places fill each other\'s gaps, so the whole sofa gets the same bass. It\'s the biggest single upgrade most rooms can make; EQ can\'t do it.'));
}
async function runOptimiser() {
  TV.optRunning = 'Starting…'; renderTune();
  const res = await optimiseSubs({ n: TV.optN, keep: TV.optKeep, onProgress: (p, msg) => { TV.optRunning = `${Math.round(p * 100)}%`; const b = $('.optctl .btn'); if (b) b.textContent = `${Math.round(p * 100)}% · ${msg}`; } });
  TV.optRunning = null; TV.opt = res ? res.slice(0, 2) : null;
  if (res && res[0]) TV.preview = { label: `Searched: ${subLabel(res[0].subs)}`, subs: res[0].subs };
  renderTune();
}
function sizingSection() {
  const S = subSizing(TA, planReady() ? PLAN : null);
  const row = (r) => h('tr', { class: r === S.pick ? 'on' : '' }, h('td', {}, r.label, r === S.pick ? h('small', {}, 'the least you need') : null),
    h('td', {}, r.margin >= 3 ? 'Plenty ✓' : r.margin >= 0 ? 'Enough ✓' : r.margin >= -3 ? 'Just short' : 'Not enough', h('small', {}, `${sgn(r.margin, 0)} dB at 25–80 Hz`)),
    h('td', {}, r.deep >= 0 ? 'Full' : r.deep >= -6 ? 'Most of it' : 'Weak', h('small', {}, `${sgn(r.deep, 0)} dB at 20 Hz`)), h('td', {}, usd(r.price[0], r.price[1])));
  return sect('How much subwoofer you need', loudnessChips(),
    h('table', { class: 'ttable' }, h('thead', {}, h('tr', {}, h('th', {}, 'Option'), h('th', {}, 'Bass peaks'), h('th', {}, 'Deepest rumble'), h('th', {}, 'Typical price'))), h('tbody', {}, S.rows.map(row))),
    h('p', { class: 'note' }, `For "${refName().toLowerCase()}" the main seat needs bass peaks of ${S.need} dB. Figures use each class's typical maximum output, your room's gain at the recommended spots and the EQ.`));
}
function proBass(V) {
  const t = state.tune, F = V.ctx.F;
  const cv = h('canvas', { class: 'chart', 'data-chart': 1 }), tip = h('div', { class: 'ctip' });
  cv._draw = () => drawResponse(cv, tip, V);
  attachHover(cv, tip, (f) => { TV.f = f; TV.mapKind = 'note'; renderMapControls(); drawTuneOverlay(); });
  const controls = h('div', { class: 'pro-ctl' },
    h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Signal'), tchips([['lfe', 'LFE (subs only)'], ['managed', 'Bass-managed L/R + subs']], t.signal, (v) => setTune({ signal: v }))),
    t.signal === 'managed' ? h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Crossover'), tchips([[60, '60'], [80, '80'], [100, '100'], [120, '120 Hz']], t.xo, (v) => setTune({ xo: v }))) : null,
    h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Sub class'), tchips(Object.entries(SUB_MODELS).map(([k, s]) => [k, s.label]), t.sub, (v) => setTune({ sub: v }))),
    h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Target'), tchips(Object.entries(TARGETS).map(([k, s]) => [k, s.label]), t.target, (v) => setTune({ target: v }))),
    h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Smoothing'), tchips([[0, 'None'], [24, '1/24'], [6, '1/6'], [3, '1/3 oct']], TV.smooth, (v) => { TV.smooth = v; renderTune(); }),
      h('label', { class: 'mini-toggle' }, h('input', { type: 'checkbox', checked: t.eqOn, onchange: (e) => setTune({ eqOn: e.target.checked }) }), 'Room EQ'),
      h('label', { class: 'mini-toggle' }, h('input', { type: 'checkbox', checked: t.allSeats, onchange: (e) => setTune({ allSeats: e.target.checked }) }), 'Chairs too')));
  const real = currentSubs().filter((s) => s.real);
  const dsp = real.length ? h('div', { class: 'sublist' }, real.map((s, i) => {
    const d = state.tune.dsp[s.id] || { g: 0, d: 0, pol: 1 };
    const set = (patch) => { pushHistory(); state.tune.dsp[s.id] = { ...d, ...patch }; save(); tuneAnalyse(); };
    return h('div', { class: 'subrow' }, h('b', {}, `SW${i + 1}`), h('span', { class: 'sname' }, spotName({ ...s, n: wallNormalAt(s.x, s.y) })), h('div', { class: 'dsp' },
      stepper('Gain', `${sgn(d.g || 0)} dB`, () => set({ g: clamp((d.g || 0) - 0.5, -12, 0) }), () => set({ g: clamp((d.g || 0) + 0.5, -12, 0) })),
      stepper('Delay', `${(d.d || 0).toFixed(1)} ms`, () => set({ d: clamp((d.d || 0) - 0.5, 0, 20) }), () => set({ d: clamp((d.d || 0) + 0.5, 0, 20) })),
      h('button', { class: 'chip', 'aria-pressed': String(d.pol === -1), onclick: () => set({ pol: d.pol === -1 ? 1 : -1 }) }, d.pol === -1 ? 'Polarity −' : 'Polarity +')));
  })) : h('p', { class: 'note' }, 'Place subwoofers to set their gain, delay and polarity here.');
  const sweep = rowSweep(V.ctx, V.subs);
  const modes = modesTable();
  return h('div', { class: 'pros' },
    pro('Frequency response at every seat', controls, h('div', { class: 'chartwrap' }, cv, tip),
      h('div', { class: 'legend' }, V.resp.map((r, i) => h('span', { class: 'lg' + (r.seat.main || t.allSeats ? '' : ' off') }, h('i', { style: `background:${seatColor(r.seat, i)}` }), r.seat.label)), h('span', { class: 'lg' }, h('i', { class: 'dash' }), 'Sofa average')),
      h('p', { class: 'note' }, `dB against the ${TARGETS[t.target].label.toLowerCase()}, level-matched on the sofa (as after calibration). Seat to seat ±${V.m.ssv.toFixed(1)} dB, sofa average ±${V.m.flat.toFixed(1)} dB, main seat ±${V.m.flatMlp.toFixed(1)} dB, 20–${bassBand()[1]} Hz. Click to map a frequency.`)),
    pro(`Room EQ · ${V.eq.length} filters`, V.eq.length ? h('table', { class: 'ttable' }, h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Frequency'), h('th', {}, 'Gain'), h('th', {}, 'Q'))),
      h('tbody', {}, V.eq.map((q, i) => h('tr', {}, h('td', {}, String(i + 1)), h('td', {}, fmtF(q.f)), h('td', {}, `${sgn(q.g)} dB`), h('td', {}, q.q.toFixed(2)))))) : h('p', { class: 'note' }, 'Room EQ is off or not needed.'),
      V.eq.length ? h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: () => copyText(eqText(V.eq), 'EQ filters copied') }, 'Copy filters (REW / miniDSP)')) : null,
      h('p', { class: 'note' }, 'Fitted to the sofa\'s average: cuts only, plus at most one broad +3 dB boost. Nulls are left alone.')),
    pro('Subwoofer DSP (gain, delay, polarity)', dsp),
    pro('Waterfall at the main seat', chart('tall', (c) => drawWaterfall(c, V)), h('p', { class: 'note' }, 'Cumulative spectral decay every 20 ms: long ridges are notes that ring on.')),
    pro('Low-frequency decay (T30) per third octave', chart('', (c) => drawDecay(c)), h('p', { class: 'note' }, 'From the modelled impulse response at the main seat; dashed: target (0.4 s down to 63 Hz, allowed to rise to 0.65 s at 20 Hz).')),
    sweep ? pro('Sofa position sweep', chart('short', (c) => drawSweep(c, sweep)), h('p', { class: 'note' }, 'Main-seat smoothness (brass) and seat-to-seat variation (blue) as the sofa slides toward (+) or away from the TV, subs fixed. Grey: it would hit a wall.')) : null,
    pro(`Room modes below 200 Hz · Schroeder ${fmtF(TA.rt.schroeder)}`, modes));
}
function modesTable() {
  const S = ACS, subs = currentSubs(), mlp = TA.mlp;
  const cs = subs.map((s) => acCoef(S, s.x, s.y, AC.subZ)), cr = acCoef(S, mlp.x, mlp.y, AC.ear);
  const list = S.modes3.map((m, i) => ({ m, i })).filter(({ m }) => m.f > 1 && m.f <= 200);
  const exc = list.map(({ i }) => { let a = 0; for (const q of cs) a += q[i]; return a * cr[i]; });
  const emax = Math.max(...exc.map(Math.abs), 1e-9);
  const rows = list.map(({ m, i }, j) => {
    const md = S.modes2[m.m], lb = md.label, T60 = 6.91 / TA.ctx.damp[i], Q = Math.PI * m.f * T60 / 6.91, nn = [lb.p, lb.q, m.nz].filter((x) => x).length;
    const shape = lb.c > 0.55 ? `${lb.p}·${lb.q}·${m.nz}` : `basement · ${m.nz}`;
    const kind = lb.c > 0.55 ? (nn === 0 ? 'room breathing against the hall' : nn === 1 ? 'axial' : nn === 2 ? 'tangential' : 'oblique') : (md.roomFrac < 0.6 ? 'mostly in the hall and stairs' : 'whole floor');
    const e = 20 * Math.log10(Math.abs(exc[j]) / emax + 1e-6);
    return h('tr', { class: TV.modeSel === i && TV.mapKind === 'mode' ? 'on' : '', onclick: () => { const on = !(TV.modeSel === i && TV.mapKind === 'mode'); TV.modeSel = i; TV.mapKind = on ? 'mode' : 'quality'; renderTune(); } },
      h('td', {}, fmtF(m.f), h('small', {}, noteName(m.f))), h('td', {}, shape, h('small', {}, kind)), h('td', {}, `${T60.toFixed(2)} s`), h('td', {}, Q.toFixed(0)),
      h('td', {}, h('span', { class: 'bar', style: `--w:${Math.max(2, 100 + e * 2.5)}%` }), `${e.toFixed(0)} dB`));
  });
  return h('div', {}, h('p', { class: 'note' }, 'From the wave solution of the real floor plan. Shape: half-waves along the length · width · height of the main room. Click a mode to see its pressure on the floor (white: its nodes). Excitation: how hard the subs drive it at the main seat.'),
    h('div', { class: 'tscroll' }, h('table', { class: 'ttable modes' }, h('thead', {}, h('tr', {}, h('th', {}, 'Freq.'), h('th', {}, 'Shape'), h('th', {}, 'Decay'), h('th', {}, 'Q'), h('th', {}, 'Excitation'))), h('tbody', {}, rows))));
}
function stepper(label, val, dec, inc) { return h('span', { class: 'step-c' }, h('small', {}, label), h('button', { onclick: dec, 'aria-label': `${label} down` }, '−'), h('b', {}, val), h('button', { onclick: inc, 'aria-label': `${label} up` }, '+')); }
function wallNormalAt(x, y) { const r = state.room, G = geom(); return [x < 30 ? 1 : x > r.width - 30 ? -1 : 0, y > G.mainY - 30 && y <= G.mainY ? -1 : y < 30 ? 1 : 0]; }
const seatColor = (s, i) => (s.mlp ? '#d6a463' : SEAT_COLORS[(i + 3) % SEAT_COLORS.length]);
const eqText = (eq) => ['Filter Settings file', '', 'Room EQ from Basement Cinema planner', '', ...eq.map((q, i) => `Filter ${i + 1}: ON PK Fc ${q.f.toFixed(1)} Hz Gain ${q.g.toFixed(1)} dB Q ${q.q.toFixed(2)}`)].join('\n');
async function copyText(txt, msg) { try { await navigator.clipboard.writeText(txt); toast(msg); } catch (e) { downloadBlob(new Blob([txt], { type: 'text/plain' }), 'cinema-tuning.txt'); } }

// ---------------- Dialogue ----------------
function tabDialogue() {
  const A = TA, t = state.tune, spots = acReflectionPanelSpots(), runs = new Map();
  for (const s of spots) { const r = runs.get(s.run.wall) || { ...s.run, z: s.z, n: 0 }; r.n++; runs.set(s.run.wall, r); }
  const rt = A.rt, band = (lo, hi) => rt.bands.filter((b) => b.f >= lo && b.f <= hi).reduce((a, b, i, arr) => a + b.eyring / arr.length, 0);
  const groups = [['Bass', band(63, 125), 0.6], ['Voices', band(500, 2000), 0.4], ['Treble', band(4000, 8000), 0.4]];
  const word = (v, hi) => (v < 0.2 ? 'dead' : v <= hi ? 'just right' : v <= hi + 0.12 ? 'a bit lively' : 'echoey');
  return h('div', {},
    sect('Clear dialogue', h('p', { class: 'say' }, vchip(verdictOf(A.q.clarity)), ' ', A.say.clarity),
      h('p', { class: 'note' }, 'Your ear blends anything that arrives within about 15 ms of the direct sound. If a wall or the ceiling bounces it back loudly in that time, voices smear and seem to come from the wall. Pros keep those bounces at least 10 dB down.')),
    sect('Where the panels go', runs.size ? h('div', { class: 'runs' }, [...runs.values()].map((r) => h('div', { class: 'run' },
      h('b', {}, `${r.n} panel${r.n > 1 ? 's' : ''} on the ${r.wall}`), h('small', {}, `a ${ftin(r.len)} zone, centred ${ftin(r.z)} up · catches the ${r.chs.join(', ')} bounce for ${r.seats.length === A.ctx.seats.filter((s) => s.main).length ? 'every seat' : r.seats.join(', ')}`)))) : h('p', { class: 'note' }, 'No side-wall bounce needs treating.'),
      h('div', { class: 'btnrow' },
        spots.length ? h('button', { class: 'btn primary', onclick: () => hangPanels(spots) }, `Hang ${spots.length} panels there`) : null,
        h('button', { class: 'btn', onclick: () => setTune({ reflPanels: !t.reflPanels }) }, t.reflPanels ? 'Remove the planned panels' : 'Plan them (outline only)'),
        h('button', { class: 'btn', onclick: () => setTune({ cloud: !t.cloud }) }, t.cloud ? 'Remove the ceiling cloud' : 'Add a ceiling cloud')),
      h('p', { class: 'note' }, 'The map shows the bounces from the front three speakers to the main seat: red ones are too loud, green are fine. The mirror trick confirms it on site: sit in each seat while a friend slides a mirror along the wall; wherever you see a speaker in it, a panel goes there.')),
    sect('Echo time', h('div', { class: 'echo' }, groups.map(([l, v, hi]) => h('div', { class: 'echo-b' }, h('small', {}, l), h('b', {}, `${v.toFixed(2)} s`), h('span', { class: 'echo-w ' + word(v, hi).replace(/ /g, '-') }, word(v, hi))))),
      h('p', { class: 'note' }, `How long the room keeps ringing after a sound stops. A room this size (${Math.round(rt.V * 35.3)} ft³) sounds best around 0.2–0.4 s for voices: clear but not dead.`),
      h('div', { class: 'treat' },
        h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Bass traps'), tchips([[0, 'None'], [2, '2 front corners'], [4, '4 corners']], t.traps, (v) => setTune({ traps: v }))),
        toggleRow('4″ panels on the wall behind the sofa', t.rearPanels, (v) => setTune({ rearPanels: v }), `${acRearSpots().length} × 2 × 4 ft at head height, on the solid wall beside the stairs`),
        h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'People'), tchips([[0, 'Empty'], [2, '2'], [4, '4'], [6, '6']], t.people, (v) => setTune({ people: v }))))),
    sect('Keeps the movie downstairs', h('p', { class: 'say' }, vchip(verdictOf(A.q.privacy)), ' ', A.say.privacy),
      toggleRow('Plan a solid-core door with seals at the stairs', t.door, (v) => setTune({ door: v }), 'typically $600–1,200 installed')),
    h('div', { class: 'pros' },
      pro('Energy-time view per speaker', reflPro()),
      pro('Reverberation time per octave (RT60)', chart('', (c) => drawRT(c, rt)), h('div', { class: 'legend' }, h('span', { class: 'lg' }, h('i', { style: 'background:#d6a463' }), 'Eyring'), h('span', { class: 'lg' }, h('i', { class: 'dot' }), 'Sabine'), h('span', { class: 'lg' }, h('i', { class: 'band' }), 'Target')),
        h('p', { class: 'note' }, `Statistical model of the room and alcove (${rt.V.toFixed(0)} m³, ${rt.S.toFixed(0)} m²), the opening to the stairs and hall counted as absorption. Schroeder frequency ${fmtF(rt.schroeder)}.`)),
      pro('What absorbs the sound', absorbTable(rt))));
}
function reflPro() {
  const lay = TA.lay.filter((c) => !c.k.startsWith('T')), ch = lay.find((c) => c.k === TV.reflCh) || lay[0];
  const list = firstReflections({ x: ch.p[0], y: ch.p[1], z: ch.z }, { x: TA.mlp.x, y: TA.mlp.y, z: AC.ear });
  return h('div', {}, h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Speaker'), tchips([['front', 'Front 3'], ...lay.map((c) => [c.k, c.k])], TV.reflCh, (v) => { TV.reflCh = v; renderTune(); })),
    TV.reflCh === 'front' ? h('p', { class: 'note' }, 'Pick a speaker for its energy-time chart.') : h('div', {}, chart('', (c) => drawETC(c, list)),
      h('table', { class: 'ttable' }, h('thead', {}, h('tr', {}, h('th', {}, 'Surface'), h('th', {}, 'Height'), h('th', {}, 'Delay'), h('th', {}, 'Level'), h('th', {}, 'Material'))),
        h('tbody', {}, list.map((q) => h('tr', { class: q.delay < 15 && q.level > -10 ? 'warn' : '' }, h('td', {}, q.surface), h('td', {}, ftin(q.z)), h('td', {}, `${q.delay.toFixed(1)} ms`), h('td', {}, `${q.level.toFixed(1)} dB`), h('td', {}, MAT_NAME[q.mat] || q.mat)))))));
}
function absorbTable(rt) {
  const surf = rt.surf.slice().sort((a, b) => b.area * b.a[3] - a.area * a.a[3]), A500 = rt.bands[3].A;
  return h('table', { class: 'ttable' }, h('thead', {}, h('tr', {}, h('th', {}, 'Surface'), h('th', {}, 'Area'), h('th', {}, 'α 125'), h('th', {}, 'α 500'), h('th', {}, 'Share'))),
    h('tbody', {}, surf.map((s) => h('tr', {}, h('td', {}, s.label), h('td', {}, `${Math.round(s.area * 10.76)} ft²`), h('td', {}, s.a[1].toFixed(2)), h('td', {}, s.a[3].toFixed(2)),
      h('td', {}, h('span', { class: 'bar', style: `--w:${Math.max(1, s.area * s.a[3] / A500 * 100)}%` }), `${(s.area * s.a[3] / A500 * 100).toFixed(0)}%`))),
    rt.units.map((u) => h('tr', {}, h('td', {}, u.label), h('td', {}, '—'), h('td', {}, `${(u.a[1] * u.n * 10.76).toFixed(0)} sab.`), h('td', {}, `${(u.a[3] * u.n * 10.76).toFixed(0)} sab.`),
      h('td', {}, h('span', { class: 'bar', style: `--w:${Math.max(1, u.n * u.a[3] / A500 * 100)}%` }), `${(u.n * u.a[3] / A500 * 100).toFixed(0)}%`)))));
}
function toggleRow(label, on, fn, sub) {
  const input = h('input', { type: 'checkbox', role: 'switch', checked: !!on }); input.addEventListener('change', () => fn(input.checked));
  return h('label', { class: 'toggle trow2' }, h('span', {}, label, sub ? h('small', {}, sub) : null), input);
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
const LAYOUT_NOTE = {
  '2.1': 'Stereo and a subwoofer: music first.', '3.1': 'Adds a centre speaker that locks dialogue to the screen.',
  '5.1': 'Two surrounds beside or just behind you: the classic movie layout.', '7.1': 'Adds two rear surrounds for smoother pans behind you.',
  '5.1.2': 'Five around you and two in the ceiling just ahead: Dolby Atmos height for most rooms.', '5.1.4': 'Four ceiling speakers, front and rear: fuller overhead effects.',
  '7.1.4': 'The reference home Atmos layout: seven around, four overhead.', '9.1.6': 'Adds wide fronts and a middle ceiling pair: for big, dedicated rooms.',
};
function tabSpeakers() {
  const t = state.tune, lay = TA.lay, ss = speakerSizing(TA);
  const recLayout = planReady() ? (PLAN.steps.find((s) => s.key === 'layout') || {}).act : null;
  const cards = h('div', { class: 'layouts' }, Object.keys(LAYOUTS).map((k) => {
    const okAll = tuneLayout(k).every((c) => c.ok);
    return h('button', { class: 'lay-card', 'aria-pressed': String(k === t.layout), onclick: () => setTune({ layout: k }) },
      h('b', {}, k), h('small', {}, LAYOUT_NOTE[k]), h('span', { class: 'lay-fit ' + (okAll ? 'ok' : 'no') }, okAll ? 'fits this room' : 'compromised here'),
      recLayout && recLayout.patch.layout === k ? h('span', { class: 'rec-tag' }, 'Recommended') : null);
  }));
  const where = h('div', { class: 'spklist' }, lay.map((c) => h('div', { class: 'spk-row' + (c.ok ? '' : ' off') },
    h('b', {}, c.k), h('div', {}, h('span', {}, c.name), h('small', {}, c.how)), h('span', { class: 'spk-ang' }, c.ok ? '✓ ' : '✕ ', c.actual, h('small', {}, `Dolby ${c.target}`)))));
  const sizing = h('div', { class: 'sizing' }, ss.map((g) => h('div', { class: 'size-row' },
    h('div', {}, h('b', {}, g.label), h('small', {}, `${g.n} speaker${g.n > 1 ? 's' : ''}, up to ${ftin(g.dist)} from the main seat`)),
    h('div', { class: 'size-need' }, h('span', {}, `${g.s100} dB`, h('small', {}, 'sensitivity at 100 W')), h('span', {}, `${g.s200} dB`, h('small', {}, 'at 200 W'))),
    h('small', { class: 'size-hint' }, `${sensHint(g.s100)} on a 100 W receiver`))));
  return h('div', {},
    sect('Surround immersion', h('p', { class: 'say' }, vchip(verdictOf(TA.q.immersion)), ' ', TA.say.immersion)),
    sect('Layout', cards),
    sect('Where each speaker goes', where, h('label', { class: 'toggle' }, h('span', {}, 'Show these in the room after closing (pre-wire plan)'), (() => { const i = h('input', { type: 'checkbox', role: 'switch', checked: state.showSpeakers }); i.addEventListener('change', () => { pushHistory(); state.showSpeakers = i.checked; commit(false); }); return i; })())),
    sect('What to buy', loudnessChips(), sizing,
      h('p', { class: 'note' }, 'Sensitivity is on every speaker\'s spec sheet (dB at 1 W or 2.83 V, 1 m). Meet these and every channel reaches the peaks your listening level asks for at the main seat, with a little room to spare.')),
    h('div', { class: 'pros' }, pro('Angles, delays, trims and headroom', spkTable(lay),
      h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Speakers'), tchips(Object.entries(SPK_CLASSES).map(([k, s]) => [k, s.label]), t.spk, (v) => setTune({ spk: v }))),
      h('div', { class: 'trow' }, h('span', { class: 'tl' }, 'Amplifier'), tchips([[50, '50 W'], [100, '100 W'], [200, '200 W'], [400, '400 W']], t.amp, (v) => setTune({ amp: v }))),
      h('p', { class: 'note' }, 'Delay and trim are what an AV receiver sets so every channel arrives together and equally loud at the main seat. Headroom: against the peaks for your listening level, with the speaker class and amplifier above.'))));
}
function spkTable(lay) {
  const head = h('thead', {}, h('tr', {}, ...['Ch.', 'Where', 'Angle', 'Distance', 'Delay · trim', 'Headroom'].map((x) => h('th', {}, x))));
  const rows = lay.map((c) => h('tr', { class: c.ok ? '' : 'warn' },
    h('td', {}, h('b', {}, c.k), h('small', {}, c.name)), h('td', {}, c.how), h('td', {}, `${c.actual}${c.ok ? ' ✓' : ' ✕'}`, h('small', {}, `Dolby ${c.target}`)),
    h('td', {}, ftin(c.dist)), h('td', {}, `${c.delay.toFixed(1)} ms`, h('small', {}, `${sgn(c.trim)} dB`)), h('td', { class: c.headroom < 0 ? 'bad' : '' }, `${sgn(c.headroom)} dB`)));
  return h('div', { class: 'tscroll' }, h('table', { class: 'ttable spk' }, head, h('tbody', {}, rows)));
}

// ---------------- Report ----------------
function shoppingList() {
  const out = [], P = planReady() ? PLAN : null, ss = speakerSizing(TA), S = subSizing(TA, P);
  const subsStep = P && P.steps.find((s) => s.key === 'subs');
  const nSub = subsStep ? subsStep.act.subs.length : Math.max(1, currentSubs().filter((s) => s.real).length);
  const subRow = S.rows.find((r) => r.n === nSub && r.margin >= 0) || S.pick;
  out.push({ what: `${nSub === 2 ? 'Two' : 'One'} ${SUB_MODELS[subRow.model].label} subwoofer${nSub > 1 ? 's' : ''}`, spec: `${SUB_MODELS[subRow.model].note}; reaches ${S.need} dB bass peaks at the main seat`, cost: usd(SUB_PRICE[subRow.model][0] * nSub, SUB_PRICE[subRow.model][1] * nSub) });
  for (const g of ss) out.push({ what: `${g.label} (${g.n})`, spec: `≥ ${g.s100} dB sensitivity on 100 W (or ≥ ${g.s200} dB on 200 W)`, cost: '' });
  out.push({ what: 'AV receiver', spec: `${LAYOUTS[state.tune.layout].length + 1}+ channels for ${state.tune.layout}${nSub > 1 ? ', two independent sub outputs' : ''}, room correction (Dirac Live or Audyssey MultEQ XT32)`, cost: '' });
  if (P) for (const s of P.steps) {
    if (s.key === 'treat') for (const q of s.parts) out.push({ what: q.text[0].toUpperCase() + q.text.slice(1), spec: q.flag === 'reflPanels' ? '2″ fabric-wrapped mineral wool or fibreglass' : '4″ thick, or 2″ on a 2″ air gap', cost: usd(q.lo, q.hi) });
    else if (['traps', 'rug', 'door'].includes(s.key)) out.push({ what: s.title, spec: s.note || '', cost: s.cost });
  }
  out.push({ what: 'Measurement microphone', spec: 'a calibrated USB mic (e.g. UMIK-1) with REW, to confirm the model and fine-tune', cost: usd(80, 120) });
  return out;
}
function settingsText() {
  const A = TA, t = state.tune, P = planReady() ? PLAN : null, subs = currentSubs();
  const L = [`Basement Cinema · acoustic plan · ${new Date().toLocaleDateString()}`, '',
    `Today ${A.overall}/100 (${verdictOf(A.overall)})${P ? ` · with the plan ${P.after.overall}/100 (${verdictOf(P.after.overall)})` : ''}`,
    ...QUALITIES.map((q) => `  ${q.title}: ${verdictOf(A.q[q.key])}${P ? ` → ${verdictOf(P.after.q[q.key])}` : ''} · ${A.say[q.key]}`), ''];
  if (P) L.push('Plan:', ...P.steps.map((s, i) => `  ${i + 1}. ${s.title} (${s.cost}, ${s.effort}). ${s.why}${s.note ? ' ' + s.note : ''}`), '');
  L.push('Shopping list:', ...shoppingList().map((r) => `  · ${r.what}: ${r.spec}${r.cost ? ` (${r.cost})` : ''}`), '',
    'Installer settings (as the layout stands now):',
    ...subs.map((s, i) => `  SW${i + 1}: ${ftin(s.x)} from the fireplace wall, ${ftin(s.y)} from the stair wall · gain ${sgn(s.g || 0)} dB · delay ${(s.d || 0).toFixed(1)} ms · polarity ${s.pol === -1 ? 'inverted' : 'normal'}${s.real ? '' : ' (assumed)'}`),
    `  Room EQ: ${A.eq.length ? A.eq.map((q) => `PK ${q.f.toFixed(1)} Hz ${sgn(q.g)} dB Q ${q.q.toFixed(2)}`).join(' · ') : 'none'}`,
    `  Speakers (${t.layout}): ` + A.lay.map((c) => `${c.k} ${ftin(c.dist)} ${c.delay.toFixed(1)} ms ${sgn(c.trim)} dB`).join(' · '),
    `  Crossover ${t.xo} Hz · target ${TARGETS[t.target].label.toLowerCase()} · listening level ${refName().toLowerCase()}`);
  return L.join('\n');
}
function tabReport() {
  const list = shoppingList();
  return h('div', {},
    sect('Shopping list', h('table', { class: 'ttable shop' }, h('thead', {}, h('tr', {}, h('th', {}, 'What'), h('th', {}, 'Spec'), h('th', {}, 'Typical'))),
      h('tbody', {}, list.map((r) => h('tr', {}, h('td', {}, r.what), h('td', {}, r.spec), h('td', {}, r.cost || '—'))))),
      h('p', { class: 'note' }, 'Prices are rough typical retail, before installation, to help budget. The specs are what matters: anything that meets them will do.')),
    sect('For your installer', h('p', { class: 'note' }, 'Everything on one page: the scores and what they mean, the plan, the shopping list, subwoofer positions and DSP, the room EQ, and every speaker\'s distance, delay and trim, with the charts.'),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn primary', onclick: downloadReport }, 'Download the report'), h('button', { class: 'btn', onclick: () => copyText(settingsText(), 'Plan and settings copied') }, 'Copy as text'))),
    h('div', { class: 'pros' }, pro('How the model works', h('ul', { class: 'method' },
      h('li', {}, h('b', {}, 'Bass (below ~200 Hz): '), 'the floor plan is cut into 5″ cells and the room\'s modes are solved from the wave equation (shift-invert Lanczos), including the alcove, the fireplace lounge, the pilaster and the open stairs and hall; the 9′ ceiling adds the vertical modes. Each mode is damped by what its pressure meets: drywall, floor, openings, seats, traps and panels. Checked against a rectangle: modes within 0.4 % of the exact values.'),
      h('li', {}, h('b', {}, 'At the seats: '), 'responses, maps, impulse responses (and what you hear in "Hear the difference") all come from the same modal sum, with each sub\'s roll-off, the crossover, DSP and EQ, level-matched on the sofa as after calibration.'),
      h('li', {}, h('b', {}, 'Echoes: '), 'image sources on the real walls, ceiling and floor with speaker directivity and the absorption where each bounce lands; reverberation from Sabine and Eyring per octave.'),
      h('li', {}, h('b', {}, 'Scores: '), 'each quality maps a measurable (seat-to-seat variation, smoothness and decay, early-reflection level and echo time, Dolby angles) onto 0–100 using targets common in professional home-cinema design, in the spirit of the CEDIA/CTA RP22 levels. Not a certification.'),
      h('li', {}, h('b', {}, 'Limits: '), 'walls are modelled as rigid with an absorption-based loss, furniture doesn\'t block bass, absorption figures are typical. Confirm with a measurement microphone; the EQ and DSP workflow is the same.')))));
}
function downloadReport() {
  const shot = (fn) => { const cv = document.createElement('canvas'); cv.style.width = '720px'; cv.style.height = '260px'; document.body.append(cv); fn(cv); const url = cv.toDataURL('image/png'); cv.remove(); return url; };
  const V = bassView(), P = planReady() ? PLAN : null;
  const imgs = [['Bass at each seat, against the target', shot((cv) => drawResponse(cv, null, V))], ['How the bass dies away at the main seat', shot((cv) => drawWaterfall(cv, V))],
    ['Echo time per octave', shot((cv) => drawRT(cv, TA.rt))]];
  const plan = (() => { try { return window.__cinema.capture('image/jpeg', 0.85); } catch (e) { return ''; } })();
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const qRows = QUALITIES.map((q) => `<tr><td><b>${esc(q.title)}</b><br><small>${esc(q.ask)}</small></td><td>${verdictOf(TA.q[q.key])}</td><td>${P ? verdictOf(P.after.q[q.key]) : ''}</td><td>${esc(TA.say[q.key])}</td></tr>`).join('');
  const steps = P ? P.steps.map((s, i) => `<tr><td>${i + 1}</td><td><b>${esc(s.title)}</b><br>${esc(s.why)}${s.note ? `<br><small>${esc(s.note)}</small>` : ''}</td><td>${esc(s.cost)}</td><td>${esc(s.effort)}</td></tr>`).join('') : '';
  const shop = shoppingList().map((r) => `<tr><td>${esc(r.what)}</td><td>${esc(r.spec)}</td><td>${esc(r.cost || '—')}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Basement Cinema · acoustic plan</title><style>
body{font:14px/1.5 system-ui,sans-serif;max-width:860px;margin:32px auto;padding:0 16px;color:#1c1814;background:#fff}h1{font-weight:400;font-size:28px;margin:0}h2{font-size:14px;text-transform:uppercase;letter-spacing:.08em;margin:30px 0 8px;color:#7a5a2e}
table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #e6dfd2;padding:7px 6px;vertical-align:top;text-align:left}small{color:#6b6257}img{width:100%;border-radius:8px;background:#151210}pre{background:#f6f2ea;padding:12px;border-radius:8px;white-space:pre-wrap;font-size:12px}.big{font-size:40px;color:#b07a33}</style></head><body>
<h1>Basement Cinema · how your room will sound</h1><p>${new Date().toLocaleDateString()} · today <span class="big">${TA.overall}</span> ${verdictOf(TA.overall)}${P ? ` → with the plan <span class="big">${P.after.overall}</span> ${verdictOf(P.after.overall)}` : ''}</p>
<h2>What you'll hear</h2><table><tr><th>Quality</th><th>Today</th><th>With the plan</th><th>Why</th></tr>${qRows}</table>
${P ? `<h2>The plan</h2><table><tr><th>#</th><th>Step</th><th>Cost</th><th>Time</th></tr>${steps}</table>` : ''}
<h2>Shopping list</h2><table><tr><th>What</th><th>Spec</th><th>Typical</th></tr>${shop}</table>
${plan ? `<h2>The room</h2><img src="${plan}">` : ''}
${imgs.map(([t, u]) => `<h2>${esc(t)}</h2><img src="${u}">`).join('')}
<h2>Installer settings</h2><pre>${esc(settingsText())}</pre></body></html>`;
  downloadBlob(new Blob([html], { type: 'text/html' }), 'basement-cinema-acoustics.html');
  toast('Report downloaded');
}
