// ===================================================================
// 62 · Furniture style study UI: Style tab, per-piece style controls,
//      compare view (rendered thumbnails, scorecard, ratings, notes,
//      shortlist, final pick) and the spec sheet (FF&E schedule).
// ===================================================================
const stars = (n) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
function scoreBar(value, max = 5, cls = '') {
  return h('span', { class: 'sbar ' + cls, title: `${value.toFixed(1)} / ${max}` }, h('i', { style: `width:${clamp(value / max, 0, 1) * 100}%` }));
}
function paletteStrip(colors) { return h('span', { class: 'palette' }, ...colors.map((c) => h('i', { style: `background:${c}` }))); }

/** Apply a whole set: every piece takes the set's style (overrides cleared; Undo goes back). */
function applySet(id, quiet = false) {
  if (!STYLE_SETS[id]) return;
  pushHistory();
  state.style.set = id;
  for (const it of state.items) delete it.s;
  buildAllItems(); updateLighting(); drawOutline(); commit(false);
  renderStyleTab(); if (!quiet) toast(`${STYLE_SETS[id].name} applied · Undo goes back`);
}

// ---------------- Style tab ----------------
function renderStyleTab() {
  const root = $('#tab-style'); if (!root) return;
  root.replaceChildren();
  const cur = activeSetId(), study = state.study, custom = isCustomised();
  const evals = Object.fromEntries(SET_IDS.map((id) => [id, evaluateSet(id)]));
  const ranked = [...SET_IDS].sort((a, b) => evals[b].total - evals[a].total);
  const cards = h('div', { class: 'setlist' });
  if (custom) {
    const e = evaluateSet(cur, true);
    cards.append(h('div', { class: 'setcard on custom' },
      h('span', { class: 'row' }, h('b', {}, 'Your mix'), h('span', { class: 'score' }, String(e.total))),
      h('span', { class: 'sub' }, `${STYLE_SETS[cur].name} with your changes to some pieces`),
      h('span', { class: 'meta' }, `${moneyRange(e.lo, e.hi)} · up to ${e.weeks} wk`)));
  }
  for (const id of SET_IDS) {
    const set = STYLE_SETS[id], e = evals[id], rank = ranked.indexOf(id) + 1, on = id === cur && !custom;
    const rating = study.ratings[id] || 0, listed = study.shortlist.includes(id);
    cards.append(h('button', { class: 'setcard' + (on ? ' on' : ''), 'aria-pressed': String(on), title: set.tagline, onclick: () => applySet(id) },
      h('span', { class: 'row' }, h('b', {}, set.name),
        study.pick === id ? h('span', { class: 'pill pick' }, 'Your pick') : listed ? h('span', { class: 'pill' }, 'Shortlist') : null,
        h('span', { class: 'score', title: `#${rank} of ${SET_IDS.length} with your priorities` }, String(e.total))),
      h('span', { class: 'sub' }, set.tagline),
      paletteStrip(set.palette),
      h('span', { class: 'meta' }, `${moneyRange(e.lo, e.hi)} · up to ${e.weeks} wk`, rating ? h('span', { class: 'stars' }, ' · ' + stars(rating)) : null)));
  }
  root.append(group('Furniture sets', cards,
    h('div', { class: 'btnrow' },
      h('button', { class: 'btn primary', onclick: () => openCompare() }, 'Compare all six'),
      h('button', { class: 'btn', onclick: () => openSpec(custom ? 'mine' : cur) }, 'Spec sheet')),
    h('p', { class: 'note' }, 'Click a set to dress the whole room in it. Scores out of 100 use your priorities below; prices are indicative for this layout.')));

  // priorities
  const W = study.weights, pr = h('div', { class: 'prio' });
  for (const c of CRITERIA) {
    const out = h('span', { class: 'val' }, String(W[c.key]));
    const input = h('input', { type: 'range', min: 0, max: 5, step: 1, value: String(W[c.key]), 'aria-label': c.label });
    input.addEventListener('input', () => { W[c.key] = +input.value; out.textContent = input.value; });
    input.addEventListener('change', () => { save(); renderStyleTab(); if (!$('#compareModal').hidden) renderCompare(); });
    pr.append(h('label', { class: 'prow', title: c.note }, h('span', {}, c.label), input, out));
  }
  root.append(group('Your priorities', pr,
    h('div', { class: 'btnrow' }, ...Object.entries(WEIGHT_PRESETS)
      .map(([label, w]) => h('button', { class: 'btn', onclick: () => { Object.assign(study.weights, w); save(); renderStyleTab(); toast(`Priorities: ${label.toLowerCase()}`); } }, label))),
    h('p', { class: 'note' }, '0 ignores a criterion, 5 makes it count most. Hover a row for what it measures.')));

  // the current set in detail
  const set = STYLE_SETS[cur], e = custom ? evaluateSet(cur, true) : evals[cur];
  const bars = h('div', { class: 'crit' });
  for (const c of CRITERIA) bars.append(h('div', { class: 'crow', title: c.note }, h('span', {}, c.label), scoreBar(e.scores[c.key]), h('span', { class: 'num' }, e.scores[c.key].toFixed(1))));
  root.append(group(custom ? `Your mix · ${set.name}` : set.name, h('p', { class: 'note' }, set.fitNote), bars,
    h('div', { class: 'proscons' },
      h('div', {}, h('b', {}, 'Strengths'), h('ul', {}, ...set.pros.map((t) => h('li', {}, t)))),
      h('div', {}, h('b', {}, 'Watch-outs'), h('ul', {}, ...set.cons.map((t) => h('li', {}, t))))),
    custom ? h('button', { class: 'btn', onclick: () => applySet(cur) }, `Reset every piece to ${set.name}`) : null,
    h('p', { class: 'note' }, 'Select any piece in the room to change its style, cover, colour or finish on its own.')));
}

// ---------------- per-piece style controls (in the details panel) ----------------
const WOOD_PARTS = { roundTable: ['pedestal', 'slab', 'frame'], console: ['slatted', 'credenza', 'fluted', 'frame', 'cane'], sideTable: ['drum', 'stump', 'ctable'],
  barCart: ['classic', 'oak'], ottoman: ['tufted', 'tray'], loungeChair: ['frame', 'low'], floorLamp: ['tripod'] };
const METAL_PARTS = { floorLamp: ['drum', 'arc', 'tripod', 'globe'], roundTable: ['tulip', 'frame'], console: ['fluted', 'frame', 'credenza'], sideTable: ['ctable'],
  loungeChair: ['sling', 'swivel'], barCart: ['classic'] };
const STONE_PARTS = { roundTable: ['tulip', 'drum'], sideTable: ['pedestal'], floorLamp: ['arc'] };
function styleControls(it) {
  const s = resolveSpec(it), base = resolveSpec(it, activeSetId(), false), vars = VARIANTS[it.type];
  const setKey = (k, v) => {
    it.s = { ...(it.s || {}) };
    if (v === base[k]) delete it.s[k]; else it.s[k] = v;
    if (k === 'cover' && COVER_COLORS[v] && !COVER_COLORS[v].some(([c]) => c === s.color)) {   // keep a colour the new cover comes in
      const c = COVER_COLORS[v][0][0]; if (c === base.color) delete it.s.color; else it.s.color = c;
    }
    if (!Object.keys(it.s).length) delete it.s;
    buildItem(it); updateLighting(); drawOutline(); renderStyleTab();
  };
  const row = (label, el) => h('div', { class: 'slider' }, h('div', { class: 'row' }, h('label', {}, label)), el);
  const out = [];
  if (vars) out.push(row('Style', chips('Style', Object.entries(vars).map(([k, v]) => [k, v.label]), s.variant, (v) => setKey('variant', v))));
  if (UPHOLSTERED[it.type]) {
    const covers = Object.keys(COVERS).filter((k) => it.type === 'pouf' || k !== 'knit');
    out.push(row('Cover', chips('Cover', covers.map((k) => [k, COVERS[k].label]), s.cover, (v) => setKey('cover', v))));
    const list = [...(COVER_COLORS[s.cover] || [])]; if (!list.some(([c]) => c === s.color)) list.unshift([s.color, colorName(s.color)]);
    out.push(row('Colour', swatches('Colour', list, s.color, (c) => setKey('color', c))));
  }
  if (it.type === 'rug') out.push(row('Colour', swatches('Colour', RUG_COLORS, s.color, (c) => setKey('color', c))));
  if ((WOOD_PARTS[it.type] || []).includes(s.variant)) out.push(row('Wood', chips('Wood', Object.entries(WOOD_FINISHES).map(([k, v]) => [k, v.label]), s.wood || 'walnut', (v) => setKey('wood', v))));
  if ((METAL_PARTS[it.type] || []).includes(s.variant)) out.push(row('Metal', chips('Metal', Object.entries(METAL_FINISHES), s.metal || 'black', (v) => setKey('metal', v))));
  if ((STONE_PARTS[it.type] || []).includes(s.variant)) out.push(row('Stone', chips('Stone', Object.entries(STONE_FINISHES), s.stone || 'marble', (v) => setKey('stone', v))));
  if (AV_TYPES[it.type]) out.push(row('Cabinet', chips('Cabinet', Object.entries(AV_FINISHES), s.finish || 'black', (v) => setKey('finish', v))));
  const price = piecePrice(it, s), weeks = pieceWeeks(it, s);
  out.push(h('p', { class: 'note' }, pieceSpecText(it, s)));
  if (price) out.push(h('div', { class: 'stat' }, h('span', { class: 'k' }, 'Indicative price'), h('span', { class: 'v' }, `${moneyRange(...price)}${weeks ? ` · ${weeks[0]}–${weeks[1]} wk` : ''}`)));
  out.push(hasOverrides(it)
    ? h('div', { class: 'btnrow' }, h('span', { class: 'badge warn' }, `Differs from ${STYLE_SETS[activeSetId()].name}`),
      h('button', { class: 'btn', onclick: () => { pushHistory(); delete it.s; buildItem(it); updateLighting(); drawOutline(); commit(false); renderStyleTab(); } }, 'Reset to set'))
    : h('span', { class: 'badge ok' }, `From the ${STYLE_SETS[activeSetId()].name} set`));
  return group('Style', ...out);
}

// ---------------- compare view ----------------
const thumbCache = new Map();                              // `${view}|${layout}` -> { setId: dataURL }
let compareView = 'lounge', compareMode = 'cards', compareSort = 'score', compareOnlyShortlist = false, thumbJob = 0;
const COMPARE_VIEWS = { lounge: 'Fireplace lounge', tv: 'Sofa to screen', sofa: 'Sectional', overview: 'Whole room' };
function layoutKey() {
  return JSON.stringify([state.items.map((i) => [i.type, i.x, i.y, i.rot, i.p]), state.room, state.finish, state.light.scene, state.tv, quality]);
}
function thumbPose(view) {
  if (view === 'overview') return { pos: P(300, -70, 255), target: P(112, 72, 0) };
  if (view === 'sofa') return { pos: P(118, 150, 62), target: P(175, 45, 18) };
  return presetPose(view === 'tv' ? 'sofa' : 'lounge');
}
/** Render every set from one viewpoint into small JPEGs, then put the room back exactly as it was. */
async function renderThumbs(view, onEach) {
  const job = ++thumbJob, out = {};
  const keep = { pos: camera.position.clone(), tgt: controls.target.clone(), aspect: camera.aspect, labels: labelsGroup.visible, helpers: helpersGroup.visible };
  const W = 640, H = 360, pose = thumbPose(view);
  labelsGroup.visible = false; helpersGroup.visible = false;
  try {
    for (const id of SET_IDS) {
      if (job !== thumbJob) break;                           // a newer request took over
      previewSetId = id; buildAllItems(); updateLighting();
      renderer.setPixelRatio(1); renderer.setSize(W, H, false); composer.setPixelRatio(1); composer.setSize(W, H);
      camera.aspect = W / H; camera.updateProjectionMatrix();
      camera.position.copy(pose.pos); camera.up.set(0, 1, 0); camera.lookAt(pose.target); camera.updateMatrixWorld();
      const above = camera.position.y > state.room.ceiling + 1;
      if (FX.stairwell) FX.stairwell.visible = !above;
      if (FX.screen) FX.screen.ceilingKit.visible = !above;
      ghostBulkheads(above);
      const glow = !isFast() && state.light.bloom;
      flameUniforms.uDirect.value = glow ? 0 : 1;
      if (glow) { renderPass.camera = camera; composer.render(0.016); } else renderer.render(scene, camera);
      const cv = mkCanvas(W, H); cv.getContext('2d').drawImage(renderer.domElement, 0, 0, W, H);
      out[id] = cv.toDataURL('image/jpeg', 0.85);
      onEach && onEach(id, out[id]);
      await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    previewSetId = null; buildAllItems(); updateLighting(); drawOutline();
    labelsGroup.visible = keep.labels; helpersGroup.visible = keep.helpers;
    camera.position.copy(keep.pos); controls.target.copy(keep.tgt); camera.lookAt(keep.tgt);
    resize(); controls.update(); invalidate(3);
  }
  return job === thumbJob ? out : null;
}
function openCompare() {
  $('#compareModal').hidden = false;
  renderCompare();
  $('#compareClose').focus();
}
function closeCompare() { $('#compareModal').hidden = true; thumbJob++; save(); }
function renderCompare() {
  const body = $('#compareBody'), study = state.study; body.replaceChildren();
  const evals = Object.fromEntries(SET_IDS.map((id) => [id, evaluateSet(id)]));
  const pool = compareOnlyShortlist && study.shortlist.length ? SET_IDS.filter((id) => study.shortlist.includes(id)) : SET_IDS;
  const order = [...pool].sort(compareSort === 'budget' ? (a, b) => (evals[a].lo + evals[a].hi) - (evals[b].lo + evals[b].hi)
    : compareSort === 'name' ? (a, b) => STYLE_SETS[a].name.localeCompare(STYLE_SETS[b].name) : (a, b) => evals[b].total - evals[a].total);
  const rankOf = [...SET_IDS].sort((a, b) => evals[b].total - evals[a].total);
  // toolbar
  const seg = (name, opts, cur, pick) => h('div', { class: 'seg', role: 'group', 'aria-label': name },
    ...opts.map(([k, label]) => h('button', { 'aria-pressed': String(k === cur), onclick: () => pick(k) }, label)));
  $('#compareTools').replaceChildren(...[
    seg('Show', [['cards', 'Cards'], ['table', 'Scorecard']], compareMode, (k) => { compareMode = k; renderCompare(); }),
    compareMode === 'cards' ? seg('View', Object.entries(COMPARE_VIEWS), compareView, (k) => { compareView = k; renderCompare(); }) : null,
    seg('Sort', [['score', 'Score'], ['budget', 'Budget'], ['name', 'Name']], compareSort, (k) => { compareSort = k; renderCompare(); }),
    study.shortlist.length ? seg('Filter', [['all', 'All six'], ['short', `Shortlist (${study.shortlist.length})`]], compareOnlyShortlist ? 'short' : 'all',
      (k) => { compareOnlyShortlist = k === 'short'; renderCompare(); }) : null].filter(Boolean));
  if (compareMode === 'table') { body.append(scorecardTable(order, evals, rankOf)); return; }
  const grid = h('div', { class: 'cgrid' }), key = `${compareView}|${layoutKey()}`, cached = thumbCache.get(key) || {};
  for (const id of order) {
    const set = STYLE_SETS[id], e = evals[id], rank = rankOf.indexOf(id) + 1;
    const img = cached[id] ? h('img', { src: cached[id], alt: `${set.name}: ${COMPARE_VIEWS[compareView].toLowerCase()} view` }) : h('div', { class: 'shimmer' }, 'Rendering…');
    const rate = h('div', { class: 'rate', role: 'group', 'aria-label': `Your rating for ${set.name}` });
    for (let n = 1; n <= 5; n++) {
      rate.append(h('button', { 'aria-pressed': String((study.ratings[id] || 0) >= n), title: `${n} of 5`, onclick: () => {
        study.ratings[id] = study.ratings[id] === n ? n - 1 : n; save(); renderCompare(); renderStyleTab(); } }, '★'));
    }
    const notes = h('textarea', { rows: 2, placeholder: 'Your notes (fabric samples, what the family thought…)', 'aria-label': `Notes on ${set.name}` });
    notes.value = study.notes[id] || '';
    notes.addEventListener('input', () => { study.notes[id] = notes.value.trim(); });
    notes.addEventListener('change', save);
    const listed = study.shortlist.includes(id), picked = study.pick === id;
    const crit = h('div', { class: 'crit' });
    for (const c of CRITERIA) crit.append(h('div', { class: 'crow', title: c.note }, h('span', {}, c.label), scoreBar(e.scores[c.key]), h('span', { class: 'num' }, e.scores[c.key].toFixed(1))));
    grid.append(h('article', { class: 'ccard' + (picked ? ' picked' : ''), 'data-set': id },
      h('div', { class: 'thumb', 'data-thumb': id }, img, h('span', { class: 'rank' }, `#${rank}`), picked ? h('span', { class: 'pill pick' }, 'Your pick') : null),
      h('div', { class: 'chead' }, h('div', {}, h('h3', {}, set.name), h('p', {}, set.tagline)), h('div', { class: 'total' }, h('b', {}, String(e.total)), h('small', {}, '/ 100'))),
      paletteStrip(set.palette), crit,
      h('div', { class: 'facts' }, h('span', {}, h('small', {}, 'Furniture'), moneyRange(e.lo, e.hi)), h('span', {}, h('small', {}, 'Longest wait'), `${e.weeks} weeks`)),
      h('div', { class: 'proscons' }, h('div', {}, h('b', {}, 'Strengths'), h('ul', {}, ...set.pros.map((t) => h('li', {}, t)))),
        h('div', {}, h('b', {}, 'Watch-outs'), h('ul', {}, ...set.cons.map((t) => h('li', {}, t))))),
      rate, notes,
      h('div', { class: 'btnrow' },
        h('button', { class: 'btn', onclick: () => { applySet(id); toast(`${set.name} applied: close to look around · Undo goes back`); renderCompare(); } }, 'Try in the room'),
        h('button', { class: 'btn', 'aria-pressed': String(listed), onclick: () => {
          study.shortlist = listed ? study.shortlist.filter((x) => x !== id) : [...study.shortlist, id]; save(); renderCompare(); renderStyleTab(); } }, listed ? '✓ Shortlisted' : 'Shortlist'),
        h('button', { class: 'btn', onclick: () => openSpec(id) }, 'Spec sheet'),
        h('button', { class: 'btn primary', onclick: () => { study.pick = picked ? null : id; if (!picked) { if (!study.shortlist.includes(id)) study.shortlist.push(id); applySet(id, true); toast(`${set.name} is your pick`); } save(); renderCompare(); renderStyleTab(); } },
          picked ? 'Unpick' : 'Make my pick'))));
  }
  body.append(grid, h('p', { class: 'fine' }, 'Scores are a planning aid built from typical material properties and the shape of each piece, weighted by your priorities in the Style tab; they are not lab measurements. Prices are indicative 2026 CAD ranges for mid-market retail, before tax and delivery, for the pieces in this layout; AV gear is budgeted separately. Confirm prices, lead times and fabric performance with suppliers.'));
  if (Object.keys(cached).length < SET_IDS.length) {
    renderThumbs(compareView, (id, url) => { const el = $(`#compareBody [data-thumb="${id}"]`); if (el) el.firstChild.replaceWith(h('img', { src: url, alt: `${STYLE_SETS[id].name}` })); })
      .then((all) => { if (all) thumbCache.set(key, all); });
  }
}
function scorecardTable(order, evals, rankOf) {
  const cls = (v) => (v >= 4 ? 'hi' : v >= 3 ? 'mid' : 'lo');
  const head = h('tr', {}, h('th', {}, 'Criterion'), h('th', { class: 'w' }, 'Weight'), ...order.map((id) => h('th', {}, STYLE_SETS[id].name)));
  const rows = CRITERIA.map((c) => h('tr', {}, h('th', { title: c.note }, c.label), h('td', { class: 'w' }, String(state.study.weights[c.key])),
    ...order.map((id) => { const v = evals[id].scores[c.key]; return h('td', { class: cls(v) }, v.toFixed(1)); })));
  const extra = [
    ['Score / 100', (id) => h('b', {}, String(evals[id].total))],
    ['Rank', (id) => `#${rankOf.indexOf(id) + 1}`],
    ['Furniture budget', (id) => moneyRange(evals[id].lo, evals[id].hi)],
    ['Longest wait', (id) => `${evals[id].weeks} weeks`],
    ['Your rating', (id) => (state.study.ratings[id] ? stars(state.study.ratings[id]) : '—')],
  ].map(([label, f]) => h('tr', { class: 'sum' }, h('th', {}, label), h('td', { class: 'w' }), ...order.map((id) => h('td', {}, f(id)))));
  return h('div', { class: 'tablewrap' }, h('table', { class: 'scorecard' }, h('thead', {}, head), h('tbody', {}, ...rows, ...extra)),
    h('p', { class: 'fine' }, 'Each criterion is scored 1–5. The total weights them by your priorities and scales to 100. Green 4+, amber 3–4, red under 3.'));
}

// ---------------- spec sheet (FF&E schedule) ----------------
let specSet = 'mine';
function openSpec(id) { specSet = id; $('#specModal').hidden = false; renderSpec(); $('#specClose').focus(); }
function closeSpec() { $('#specModal').hidden = true; }
function specData() {
  const mine = specSet === 'mine', setId = mine ? activeSetId() : specSet;
  const rows = specRows(setId, mine);
  let lo = 0, hi = 0;
  for (const r of rows) if (r.unit) { lo += r.unit[0] * r.qty; hi += r.unit[1] * r.qty; }
  return { rows, lo, hi, title: mine ? `Your layout · ${STYLE_SETS[setId].name}${isCustomised() ? ' (your mix)' : ''}` : STYLE_SETS[setId].name };
}
function renderSpec() {
  const { rows, lo, hi, title } = specData();
  const pickSet = h('select', { 'aria-label': 'Which set', onchange: (e) => { specSet = e.target.value; renderSpec(); } },
    h('option', { value: 'mine', selected: specSet === 'mine' }, 'Your layout as it stands'),
    ...SET_IDS.map((id) => h('option', { value: id, selected: specSet === id }, STYLE_SETS[id].name)));
  $('#specTools').replaceChildren(pickSet,
    h('button', { class: 'btn', onclick: copySpecCsv }, 'Copy as CSV'),
    h('button', { class: 'btn', onclick: () => window.print() }, 'Print'));
  $('#specTitle').textContent = `Spec sheet · ${title}`;
  const tr = (r) => h('tr', {},
    h('td', { class: 'tag' }, r.tag), h('td', {}, h('b', {}, r.item), h('div', { class: 'spec' }, r.spec), r.care ? h('div', { class: 'care' }, r.care) : null),
    h('td', {}, r.size), h('td', { class: 'n' }, String(r.qty)),
    h('td', { class: 'n' }, r.unit ? moneyRange(...r.unit) : 'AV budget'), h('td', { class: 'n' }, r.unit ? moneyRange(r.unit[0] * r.qty, r.unit[1] * r.qty) : '—'),
    h('td', { class: 'n' }, r.weeks ? `${r.weeks[0]}–${r.weeks[1]} wk` : '—'));
  $('#specBody').replaceChildren(
    h('div', { class: 'tablewrap' }, h('table', { class: 'spec' },
      h('thead', {}, h('tr', {}, ...['Tag', 'Item and specification', 'Size', 'Qty', 'Unit (CAD)', 'Total (CAD)', 'Lead time'].map((t) => h('th', {}, t)))),
      h('tbody', {}, ...rows.map(tr)),
      h('tfoot', {}, h('tr', {}, h('td', { colspan: 5 }, 'Furniture total, indicative'), h('td', { class: 'n' }, h('b', {}, moneyRange(lo, hi))), h('td', {}))))),
    h('p', { class: 'fine' }, 'Indicative 2026 CAD ranges for mid-market retail, before tax, delivery and installation. Upholstery lead times are for made-to-order; in-stock pieces ship sooner. Order cover samples and check them in the room at night under the 2700K lights before committing.'));
}
function specCsv() {
  const { rows, lo, hi, title } = specData(), q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [['Tag', 'Item', 'Specification', 'Care and performance', 'Size', 'Qty', 'Unit low', 'Unit high', 'Total low', 'Total high', 'Lead time (weeks)'].map(q).join(',')];
  for (const r of rows) lines.push([r.tag, r.item, r.spec, r.care, r.size, r.qty, r.unit ? r.unit[0] : '', r.unit ? r.unit[1] : '', r.unit ? r.unit[0] * r.qty : '', r.unit ? r.unit[1] * r.qty : '', r.weeks ? `${r.weeks[0]}-${r.weeks[1]}` : ''].map(q).join(','));
  lines.push(['', `Furniture total (${title})`, '', '', '', '', '', '', lo, hi, ''].map(q).join(','));
  return lines.join('\n');
}
async function copySpecCsv() {
  const csv = specCsv();
  try { await navigator.clipboard.writeText(csv); toast('Spec sheet copied as CSV: paste it into a spreadsheet'); }
  catch (e) {                                              // clipboard blocked: show it for manual copy
    $('#codeText').value = csv; $('#codeModal').hidden = false; $('#codeText').select();
    toast('Copy the CSV from the box');
  }
}
function initStyleUI() {
  $('#compareClose').addEventListener('click', closeCompare);
  $('#specClose').addEventListener('click', closeSpec);
  for (const id of ['#compareModal', '#specModal']) $(id).addEventListener('click', (e) => { if (e.target.id === id.slice(1)) (id === '#compareModal' ? closeCompare : closeSpec)(); });
}
