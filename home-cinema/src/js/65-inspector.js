// ===================================================================
// 65 · Details panel (selection inspector + viewing report), commit,
//      layout-code dialog, narrow-screen panel toggles
// ===================================================================
const TV_SIZES = [65, 75, 77, 83, 85, 98];

function viewingReport() {
  const v = viewingStats();
  if (!v) return group('Viewing', h('p', { class: 'empty' }, 'Add a sofa, sectional or recliner to see viewing distance and angle.'));
  const pct = clamp(v.hAngle / 50, 0, 1) * 100;
  const verdict = v.hAngle >= 36 ? ['ok', 'Cinema immersion (THX 36°+)'] : v.hAngle >= 30 ? ['ok', 'Meets SMPTE 30° minimum'] : v.hAngle >= 24 ? ['warn', 'Comfortable, a bit small for cinema'] : ['bad', 'Small for this distance'];
  const fits = v.onScreen ? (v.screenFits ? ['ok', 'Screen fits inside the alcove'] : ['bad', 'Screen is wider than the alcove at the bulkhead']) : v.fit >= 4 ? ['ok', `Fits the alcove with ${inch(v.fit / 2)} each side`] : v.fit >= 0 ? ['warn', `Tight: ${inch(v.fit / 2)} each side`] : ['bad', `${inch(-v.fit)} wider than the TV wall`];
  const tilt = Math.abs(v.tilt) <= 15 ? ['ok', `Eyes ${v.tilt >= 0 ? 'look up' : 'look down'} ${Math.abs(v.tilt).toFixed(0)}° to centre`] : ['warn', `Neck tilt ${v.tilt.toFixed(0)}° (aim under 15°)`];
  const stat = (k, val) => h('div', { class: 'stat' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, val));
  const meter = h('div', { class: 'meter', title: 'Horizontal field of view, 0–50°' }, h('i', { style: `width:${pct}%` }),
    h('b', { style: 'left:60%', title: '30° SMPTE' }), h('b', { style: 'left:72%', title: '36° THX' }));
  const sizes = h('div', { class: 'chips' });
  for (const s of TV_SIZES) {
    sizes.append(h('button', { class: 'chip', 'aria-pressed': String(state.tv.size === s), onclick: () => { pushHistory(); state.tv.size = s; rebuildTV(); commit(false); } }, `${s}″`));
  }
  return group(v.onScreen ? `Viewing the ${state.tv.screenSize}″ screen` : `Viewing from the prime seat`,
    stat('Eye to screen', ftin(v.dist)),
    stat(`Screen fills`, `${v.hAngle.toFixed(1)}° of view`),
    meter,
    h('span', { class: 'badge ' + verdict[0] }, verdict[1]),
    stat(v.onScreen ? 'Screen picture' : 'TV picture', `${inch(v.w)} × ${inch(v.h)}`),
    h('span', { class: 'badge ' + fits[0] }, fits[1]),
    h('span', { class: 'badge ' + tilt[0] }, tilt[1]),
    v.clearance == null ? null : v.clearance >= 1.5
      ? h('span', { class: 'badge ok' }, `Clears the soundbar by ${inch(v.clearance)}`)
      : h('span', { class: 'badge bad' }, `Hits the soundbar: raise the centre to ${ftin(state.tv.center - v.clearance + 2)}`),
    stat('30° needs', `${Math.round(v.size30)}″ TV`),
    stat('36° needs', `${Math.round(v.size30 * Math.tan(18 * DEG) / Math.tan(15 * DEG))}″ TV`),
    h('p', { class: 'note' }, 'Try a size:'), sizes);
}

function roomFacts() {
  const r = state.room, o = geom().outline;
  let a = 0; for (let i = 0; i < o.length; i++) { const [x0, y0] = o[i], [x1, y1] = o[(i + 1) % o.length]; a += x0 * y1 - x1 * y0; }
  const stat = (k, val) => h('div', { class: 'stat' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, val));
  return group('Room',
    stat('Floor area (incl. stair landing)', `${Math.round(Math.abs(a) / 2 / 144)} ft²`),
    stat('Ceiling', ftin(r.ceiling)),
    stat('Alcove bulkhead', ftin(r.soffitBottom)),
    stat('Fireplace bulkhead', ftin(r.beamBottom)));
}

function inspHead(eyebrow, title, dims) {
  $('#inspHead').replaceChildren(h('span', { class: 'eyebrow' }, eyebrow), h('h2', {}, title), dims ? h('span', { class: 'dims', id: 'inspDims' }, dims) : null);
}
function itemDims(it) {
  const obj = itemObjects.get(it.id);
  const size = obj ? `${ftin(obj.w)} × ${ftin(obj.d)}` : '';
  return `${size} · centre ${ftin(it.x)} from fireplace wall, ${ftin(it.y)} from stairs · turned ${Math.round(it.rot)}°`;
}

function renderInspector() {
  const body = $('#inspBody'); body.replaceChildren();
  if (!selected) {
    inspHead('Nothing selected', 'Home cinema', 'Click a piece of furniture, the TV or the fireplace');
    body.append(viewingReport(), roomFacts());
    renderFurnishSelection();
    return;
  }
  if (selected.kind === 'fixture' && selected.name === 'tv') {
    const t = state.tv, { w, h: ht } = tvDims(t.size);
    inspHead('Wall-mounted', `${t.size}″ TV`, `${inch(w)} × ${inch(ht)} picture · centre ${ftin(t.center)} high`);
    body.append(group('Mounting',
      slider('tv-center', 'Centre height', 30, 64, 0.5, t.center, ftin, (v) => { t.center = v; queue(rebuildTV); }),
      slider('tv-offset', 'Shift along wall', -12, 12, 0.5, t.offset, (v) => `${v > 0 ? '+' : ''}${v}″`, (v) => { t.offset = v; queue(rebuildTV); }),
      toggle('tv-on', 'Playing', state.light.tv, (v) => { state.light.tv = v; updateLighting(); renderLighting(); }),
      toggle('tv-screen', 'Drop-down screen in the bulkhead', t.screen, (v) => { t.screen = v; if (!v) state.light.screenDown = false; queue(() => { buildFixtures(); buildLights(); updateLighting(); drawOutline(); updateLabels(); renderLighting(); renderInspector(); }); }),
      t.screen ? chips('Screen size', [[100, '100″'], [110, '110″'], [120, '120″']], t.screenSize, (v) => { t.screenSize = v; queue(() => { buildFixtures(); buildLights(); updateLighting(); updateLabels(); renderInspector(); }); }) : null,
      t.screen ? toggle('tv-screen-down', 'Screen down', state.light.screenDown, (v) => { state.light.screenDown = v; updateLighting(); updateLabels(); renderLighting(); renderInspector(); }) : null,
      t.screen ? (() => { const d = screenDims(); return h('span', { class: 'badge ' + (d.fits ? 'ok' : 'bad') }, d.fits ? `${t.screenSize}″ screen fits the alcove (${inch(d.avail - d.w)} spare)` : `${t.screenSize}″ screen is ${inch(d.w + 6 - d.avail)} too wide for the alcove`); })() : null,
      h('p', { class: 'note' }, 'Seated eyes sit about 40″ off the floor; a centre near 42–46″ keeps the neck relaxed.')), viewingReport());
    return;
  }
  if (selected.kind === 'fixture' && selected.name === 'fireplace') {
    const f = state.fireplace;
    inspHead('Built-in', 'Linear electric fireplace', `${inch(f.width)} wide · ${ftin(f.bottom)} off the floor`);
    body.append(group('Fireplace',
      slider('f-width', 'Width', 36, 74, 1, f.width, inch, (v) => { f.width = v; queue(rebuildAll); }),
      slider('f-bottom', 'Height off floor', 12, 48, 1, f.bottom, ftin, (v) => { f.bottom = v; queue(rebuildAll); }),
      slider('f-center', 'Centre along wall', 30, Math.round(geom().mainY - 30), 1, f.center, ftin, (v) => { f.center = v; queue(rebuildAll); }),
      toggle('f-on', 'Flame on', state.light.fire, (v) => { state.light.fire = v; updateLighting(); renderLighting(); }),
      h('p', { class: 'note' }, 'The two windows above stay centred on the fireplace.')));
    return;
  }
  const it = itemById(selected.id); if (!it) { selected = null; renderInspector(); return; }
  const def = CATALOG[it.type];
  inspHead(def.note, def.label, itemDims(it));
  const controls = [];
  for (const [k, label, min, max] of def.params || []) {
    controls.push(slider(`p-${k}`, label, min, max, 1, it.p[k], inch, (v) => { it.p[k] = v; queue(() => { buildItem(it); updateLighting(); drawOutline(); updateLabels(); renderInspectorLive(); }); }));
  }
  for (const [k, label, opts] of def.options || []) {
    controls.push(h('div', { class: 'slider' }, h('div', { class: 'row' }, h('label', {}, label)),
      chips(label, opts, it.p[k], (v) => { it.p[k] = v; buildItem(it); updateLighting(); drawOutline(); updateLabels(); })));
  }
  if (def.colors) controls.push(h('div', { class: 'slider' }, h('div', { class: 'row' }, h('label', {}, 'Colour')),
    swatches('Colour', def.colors, it.p.color, (c) => { it.p.color = c; buildItem(it); updateLighting(); })));
  if (controls.length) body.append(group('Size and finish', ...controls));
  body.append(group('Arrange',
    h('div', { class: 'btnrow' },
      h('button', { class: 'btn', onclick: () => rotateSelected(15), title: 'Q' }, '⟲ 15°'),
      h('button', { class: 'btn', onclick: () => rotateSelected(-15), title: 'E' }, '⟳ 15°'),
      h('button', { class: 'btn', onclick: () => rotateSelected(90), title: 'R' }, 'Turn 90°')),
    h('div', { class: 'btnrow' },
      h('button', { class: 'btn', onclick: duplicateSelected }, 'Duplicate'),
      h('button', { class: 'btn danger', onclick: removeSelected }, 'Remove')),
    h('p', { class: 'note' }, 'Drag on the floor to move · arrow keys nudge 1″ (Shift: 6″).')));
  if (['sectional', 'sofa', 'recliner'].includes(it.type)) body.append(viewingReport());
  renderFurnishSelection();
}
function renderInspectorLive() {
  if (selected && selected.kind === 'item') { const it = itemById(selected.id), d = $('#inspDims'); if (it && d) d.textContent = itemDims(it); }
}
function renderFurnishSelection() { if (!$('#tab-furnish').hidden) renderFurnish(); }

/** After an edit: persist, refresh overlays and the details panel. */
function commit() {
  save(); updateLabels(); renderInspector(); updateRoomSub();
}

// ---------------- layout code dialog ----------------
function openCode() {
  $('#codeText').value = JSON.stringify(state);
  $('#codeModal').hidden = false; $('#codeText').focus(); $('#codeText').select();
}
function closeCode() { $('#codeModal').hidden = true; }
function initCodeDialog() {
  $('#codeBtn').addEventListener('click', openCode);
  $('#codeClose').addEventListener('click', closeCode);
  $('#codeModal').addEventListener('click', (e) => { if (e.target.id === 'codeModal') closeCode(); });
  $('#codeCopy').addEventListener('click', async () => {
    const ta = $('#codeText');
    try { await navigator.clipboard.writeText(ta.value); toast('Layout code copied'); } catch (e) { ta.focus(); ta.select(); toast('Press Ctrl+C to copy the selected code'); }
  });
  $('#codeApply').addEventListener('click', () => {
    let obj; try { obj = JSON.parse($('#codeText').value); } catch (e) { toast('That code is not valid. Paste the whole code, from { to }.'); return; }
    if (!applyState(obj, true)) { toast('That code has no furniture list, so it was not applied.'); return; }
    select(null); rebuildAll(); refreshPanels(); save(); closeCode(); toast('Layout applied');
  });
  $('#codeReset').addEventListener('click', () => {
    applyState(clone(DEFAULT_STATE), true); select(null); rebuildAll(); refreshPanels(); save(); closeCode(); toast('Starting layout restored · Ctrl+Z to undo');
  });
}

// ---------------- narrow screens: one panel at a time ----------------
const isNarrow = () => window.matchMedia('(max-width: 900px)').matches;
/** Narrow screens show one panel at a time; 'left' | 'right' | null. */
function openPanel(which) {
  $('#leftPanel').classList.toggle('collapsed', which !== 'left');
  $('#rightPanel').classList.toggle('collapsed', which !== 'right');
  $('#toggleLeft').setAttribute('aria-expanded', String(which === 'left'));
  $('#toggleRight').setAttribute('aria-expanded', String(which === 'right'));
}
function initPanels() {
  const apply = () => {
    const open = !isNarrow();
    for (const [p, b] of [['#leftPanel', '#toggleLeft'], ['#rightPanel', '#toggleRight']]) {
      $(p).classList.toggle('collapsed', !open); $(b).setAttribute('aria-expanded', String(open));
    }
    if (typeof mode !== 'undefined' && mode === 'plan') fitPlan();
  };
  apply();
  window.matchMedia('(max-width: 900px)').addEventListener('change', apply);
  const isOpen = (id) => !$(id).classList.contains('collapsed');
  const flip = (sel, btn) => {
    const open = !isOpen(sel); $(sel).classList.toggle('collapsed', !open); $(btn).setAttribute('aria-expanded', String(open));
  };
  // narrow: one sheet at a time; wide: each panel toggles on its own
  $('#toggleLeft').addEventListener('click', () => { if (isNarrow()) openPanel(isOpen('#leftPanel') ? null : 'left'); else flip('#leftPanel', '#toggleLeft'); if (mode === 'plan') fitPlan(); });
  $('#toggleRight').addEventListener('click', () => { if (isNarrow()) openPanel(isOpen('#rightPanel') ? null : 'right'); else flip('#rightPanel', '#toggleRight'); if (mode === 'plan') fitPlan(); });
}
