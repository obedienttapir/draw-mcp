// ===================================================================
// 60 · Design panel: Furnish / Lighting / Finishes / Room tabs
// ===================================================================
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
};
const group = (title, ...kids) => h('div', { class: 'group' }, title ? h('h3', {}, title) : null, ...kids);

let _rebuildQueued = null;
/** Coalesce heavy rebuilds to one per frame while a slider is dragged. */
function queue(fn) {
  if (_rebuildQueued) { _rebuildQueued.fns.add(fn); return; }
  _rebuildQueued = { fns: new Set([fn]) };
  requestAnimationFrame(() => { const q = _rebuildQueued; _rebuildQueued = null; q.fns.forEach((f) => f()); });
}

/** Range control. onInput runs live; history is recorded once per gesture. */
function slider(id, labelText, min, max, step, value, fmt, onInput) {
  const out = h('span', { class: 'val', id: id + '-v' }, fmt(value));
  const input = h('input', { type: 'range', id, min, max, step, value: String(value) });
  let dirty = false;
  input.addEventListener('input', () => {
    if (!dirty) { pushHistory(); dirty = true; }
    const v = parseFloat(input.value); out.textContent = fmt(v); onInput(v);
  });
  input.addEventListener('change', () => { dirty = false; commit(false); });
  return h('div', { class: 'slider' }, h('div', { class: 'row' }, h('label', { for: id }, labelText), out), input);
}
function toggle(id, labelText, checked, onChange) {
  const input = h('input', { type: 'checkbox', id, role: 'switch', checked: !!checked });
  input.addEventListener('change', () => { pushHistory(); onChange(input.checked); commit(false); });
  return h('label', { class: 'toggle', for: id }, h('span', {}, labelText), input);
}
function chips(name, options, current, onPick) {
  const wrap = h('div', { class: 'chips', role: 'group', 'aria-label': name });
  for (const [val, text] of options) {
    const b = h('button', { class: 'chip', 'aria-pressed': String(val === current), onclick: () => {
      pushHistory(); $$('.chip', wrap).forEach((c) => c.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true'); onPick(val); commit(false);
    } }, text);
    wrap.append(b);
  }
  return wrap;
}
function swatches(name, list, current, onPick) {
  const wrap = h('div', { class: 'swatches', role: 'group', 'aria-label': name });
  for (const [color, text] of list) {
    const b = h('button', { class: 'swatch', title: text, 'aria-label': text, 'aria-pressed': String(color.toLowerCase() === String(current).toLowerCase()), style: `background:${color}` });
    b.addEventListener('click', () => {
      pushHistory(); $$('.swatch', wrap).forEach((c) => c.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true'); onPick(color); commit(false);
    });
    wrap.append(b);
  }
  return wrap;
}

// ---------------- tabs ----------------
function initTabs() {
  $$('#leftPanel .tabs button').forEach((b) => b.addEventListener('click', () => {
    $$('#leftPanel .tabs button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    $$('#leftPanel .scroll').forEach((s) => (s.hidden = s.id !== 'tab-' + b.dataset.tab));
  }));
}

function loadOption(which) {
  applyState(clone(which === 'recommended' ? RECOMMENDED_STATE : DEFAULT_STATE), true);
  select(null); rebuildAll(); refreshPanels(); save();
  toast(which === 'recommended' ? 'Recommended design loaded · Undo goes back' : 'Original plan loaded · Undo goes back');
}
function renderFurnish() {
  const root = $('#tab-furnish'); root.replaceChildren();
  root.append(group('Design option',
    h('div', { class: 'chips' },
      h('button', { class: 'chip', 'aria-pressed': String(state.option !== 'recommended'), onclick: () => loadOption('original') }, 'Original plan'),
      h('button', { class: 'chip', 'aria-pressed': String(state.option === 'recommended'), onclick: () => loadOption('recommended') }, 'Recommended')),
    h('p', { class: 'note' }, 'Recommended: slats across the fireplace windows, floating hearth bench, 85″ TV with a 110″ drop-down screen, bias and step lights, and a clear path from the stairs.')));
  const grid = h('div', { class: 'catalog' });
  for (const [type, def] of Object.entries(CATALOG)) {
    grid.append(h('button', { onclick: () => addItem(type), title: 'Add ' + def.label }, h('b', {}, def.label), h('small', {}, def.note)));
  }
  root.append(group('Add to the room', grid));
  const list = h('div', { class: 'chips' });
  for (const it of state.items) {
    const sel = selected && selected.kind === 'item' && selected.id === it.id;
    list.append(h('button', { class: 'chip', 'aria-pressed': String(!!sel), onclick: () => select({ kind: 'item', id: it.id }) }, CATALOG[it.type]?.label || it.type));
  }
  list.append(h('button', { class: 'chip', onclick: () => select({ kind: 'fixture', name: 'tv' }) }, 'TV (wall-mounted)'));
  list.append(h('button', { class: 'chip', onclick: () => select({ kind: 'fixture', name: 'fireplace' }) }, 'Fireplace'));
  root.append(group('In the room', list, h('p', { class: 'note' }, 'Select a piece to resize, recolour or rotate it. Drag pieces on the floor in 3D or Plan view.')));
}

function renderLighting() {
  const root = $('#tab-light'), L = state.light; root.replaceChildren();
  root.append(group('Scene', chips('Lighting scene', Object.entries(SCENES).map(([k, s]) => [k, s.label]), L.scene, (v) => { applyScene(v); renderLighting(); })));
  root.append(group('Dimmers',
    slider('potDim', 'Pot lights', 0, 1, 0.01, L.pots, (v) => `${Math.round(v * 100)}%`, (v) => { L.pots = v; L.scene = 'custom'; updateLighting(); }),
    slider('ledDim', 'LED channels (2700K)', 0, 1, 0.01, L.leds, (v) => `${Math.round(v * 100)}%`, (v) => { L.leds = v; L.scene = 'custom'; updateLighting(); })));
  root.append(group('Sources',
    toggle('tvOn', 'TV playing', L.tv, (v) => { L.tv = v; updateLighting(); }),
    toggle('fireOn', 'Fireplace flame', L.fire, (v) => { L.fire = v; updateLighting(); }),
    toggle('lampOn', 'Floor lamps', L.lamp, (v) => { L.lamp = v; updateLighting(); }),
    toggle('biasOn', 'Bias light behind TV (6500K)', L.bias, (v) => { L.bias = v; updateLighting(); }),
    toggle('stepsOn', 'Stair step lights', L.steps, (v) => { L.steps = v; updateLighting(); }),
    toggle('bayPotsOn', 'Pot lights over the TV', L.bayPots, (v) => { L.bayPots = v; queue(() => { buildLights(); updateLighting(); }); }),
    state.tv.screen ? toggle('screenDownOn', 'Projector screen down', L.screenDown, (v) => { L.screenDown = v; updateLighting(); updateLabels(); renderInspector(); }) : null,
    isFast() ? null : toggle('bloomOn', 'Glow effect', L.bloom, (v) => { L.bloom = v; invalidate(3); }),
    h('p', { class: 'note' }, 'Movie dims the pots and leaves a little LED glow around the TV alcove to ease eye strain.')));
  // display quality is a device preference, kept out of layouts and undo
  const q = h('div', { class: 'chips', role: 'group', 'aria-label': 'Display quality' });
  for (const [val, text] of [['fast', 'Fast'], ['high', 'High quality']]) {
    q.append(h('button', { class: 'chip', 'aria-pressed': String(quality === val), onclick: () => { if (quality !== val) setQuality(val); } }, text));
  }
  root.append(group('Display', q, h('p', { class: 'note' }, isFast()
    ? 'Fast runs smoothly on any laptop or phone. High quality adds glow and soft area light, for a strong graphics card.'
    : 'High quality adds glow and soft area light. Switch back to Fast if moving around feels slow.')));
}

// one-click fireplace wall combinations: windows + surround + slats
const FIRE_LOOKS = {
  glow: { label: 'Glow band + bench', transoms: 'slatted', mantel: 'bench', slats: true, note: 'Slats run across both windows with one LED band behind; the bench draws a long low line under the fire.' },
  frame: { label: 'Black frame + ledge', transoms: 'framed', mantel: 'ledge', slats: true, note: 'One steel frame makes the pair a single window; the mantel splits the eyes from the mouth.' },
  stone: { label: 'Hidden windows + stone', transoms: 'hidden', mantel: 'slab', slats: true, note: 'Slats close over both windows and a tall stone panel makes the fireplace the one feature.' },
  band: { label: 'Black band + art', transoms: 'band', mantel: 'picture', slats: true, note: 'A wall-to-wall black band turns the windows into slots; a picture ledge below breaks the symmetry.' },
  shade: { label: 'Linen shade + shelves', transoms: 'shade', mantel: 'shelves', slats: false, note: 'One wide shade reads as a single soft window; shelves either side widen the fireplace into a wall of storage.' },
};
const TRANSOM_NOTES = {
  windows: 'As cut: two equal windows over the fireplace read as eyes over a mouth.',
  slatted: 'Slats run straight across both windows with one LED band behind; light still shows through the gaps.',
  hidden: 'Slats and black felt close over both windows: from the room they are gone. Add privacy film so no light leaks from the next room.',
  framed: 'One 2″ black steel frame around both panes, with a black mullion over the wall between: one window, not two eyes.',
  band: 'A matte-black band runs wall to wall at window height, with tinted film on the glass: the windows become two slots in one stripe.',
  shade: 'One linen roller shade covers both windows: a single soft rectangle, and privacy from the next room.',
};
const MANTEL_NOTES = {
  none: 'Just the fireplace.',
  ledge: 'A floating walnut ledge between the windows and the fire splits the face in two.',
  bench: 'A full-width floating bench under the fire: extra seats and one long horizontal line.',
  picture: 'A full-width picture ledge between the fire and the windows; art leaned off-centre stops the wall being symmetric. Check your fireplace’s mantel clearance.',
  slab: 'A tall porcelain or stone panel around the fireplace, up to the windows: the fire becomes the one feature.',
  shelves: 'Open shelves either side make the fireplace part of a wider built-in wall.',
};
function renderFinishes() {
  const root = $('#tab-finish'), f = state.finish; root.replaceChildren();
  root.append(group('Wall paint', swatches('Wall paint', WALL_COLORS, f.wall, (c) => { f.wall = c; applyFinishes(); queue(rebuildRoomOnly); })));
  root.append(group('TV alcove walls', chips('TV alcove walls', [['paint-dark', 'Charcoal'], ['paint-navy', 'Navy'], ['paint-green', 'Forest'], ['paint-wall', 'Same as walls']], f.bayAccent,
    (v) => { f.bayAccent = v; applyFinishes(); queue(rebuildRoomOnly); }),
  h('p', { class: 'note' }, 'A dark alcove cuts screen reflections and makes the picture look deeper.')));
  root.append(group('Fireplace wall looks',
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Fireplace wall looks' },
      ...Object.entries(FIRE_LOOKS).map(([k, lk]) => h('button', { class: 'chip', title: lk.note,
        'aria-pressed': String(f.transoms === lk.transoms && f.mantel === lk.mantel && f.fireplaceSlats === lk.slats),
        onclick: () => { pushHistory(); f.transoms = lk.transoms; f.mantel = lk.mantel; f.fireplaceSlats = lk.slats; rebuildAll(); renderFinishes(); commit(false); toast(lk.label + ' · Undo goes back'); } }, lk.label))),
    h('p', { class: 'note' }, 'Two equal windows over a centred fireplace read as a face. Every look keeps the openings as cut; each one either joins the windows into one shape, hides them, or gives the eye something off-centre to land on.')));
  root.append(group('Windows above the fireplace',
    chips('Windows above the fireplace', [['windows', 'As built'], ['slatted', 'Slats across + glow band'], ['framed', 'One black frame'],
      ['hidden', 'Hidden behind slats'], ['band', 'Black band, wall to wall'], ['shade', 'One linen shade']], f.transoms,
    (v) => { f.transoms = v; if (v === 'slatted' || v === 'hidden') f.fireplaceSlats = true; queue(rebuildAll); renderFinishes(); }),
    h('p', { class: 'note' }, TRANSOM_NOTES[f.transoms] || '')));
  root.append(group('Around the fireplace',
    chips('Around the fireplace', [['none', 'Nothing'], ['ledge', 'Mantel ledge'], ['bench', 'Floating bench'],
      ['picture', 'Picture ledge + art'], ['slab', 'Stone slab surround'], ['shelves', 'Shelves either side']], f.mantel,
    (v) => { f.mantel = v; queue(rebuildFixturesAndLights); renderFinishes(); }),
    h('p', { class: 'note' }, MANTEL_NOTES[f.mantel] || '')));
  root.append(group('Floor', chips('Floor', Object.entries(FLOORS).map(([k, d]) => [k, d.label]), f.floor, (v) => { f.floor = v; applyFinishes(); })));
  root.append(group('Wood slats', chips('Slat finish', Object.entries(SLATS).map(([k, d]) => [k, d.label]), f.slat, (v) => { f.slat = v; applyFinishes(); }),
    toggle('slatFire', 'Slats on fireplace wall', f.fireplaceSlats, (v) => { f.fireplaceSlats = v; queue(rebuildFixturesAndLights); }),
    toggle('slatTv', 'Slats behind the TV', f.tvSlats, (v) => { f.tvSlats = v; queue(rebuildFixturesAndLights); })));
}

function renderRoomTab() {
  const root = $('#tab-room'), r = state.room, f = state.fireplace; root.replaceChildren();
  const rs = (k, label, min, max, step = 1) => slider('room-' + k, label, min, max, step, r[k], ftin, (v) => { r[k] = v; queue(rebuildAll); });
  const fs = (k, label, min, max) => slider('fp-' + k, label, min, max, 1, f[k], ftin, (v) => { f[k] = v; queue(rebuildAll); });
  root.append(group('Measured',
    slider('room-width', 'Fireplace wall → exterior wall', 180, 280, 1, r.width, ftin, (v) => {
      const d = v - r.width; r.width = v; r.bayLeft += d; r.bayRight += d; queue(rebuildAll);   // keep the 2′-2″ jog
    }),
    rs('depth', 'Stairs → TV wall', 150, 230),
    rs('ceiling', 'Ceiling height', 90, 120),
    h('p', { class: 'note' }, 'Your tape numbers: 228″, 185″ and a 9′ ceiling.')));
  root.append(group('From the plan and photos',
    rs('bayDepth', 'TV alcove depth', 36, 80),
    rs('bayFace', 'TV wall width', 60, 110),
    rs('soffitBottom', 'Alcove bulkhead height', 80, r.ceiling),
    rs('soffitDepth', 'Alcove bulkhead depth', 0, 24),
    rs('beamBottom', 'Fireplace bulkhead height', 80, r.ceiling),
    rs('beamDepth', 'Fireplace bulkhead depth', 0, 84),
    rs('beamX', 'Steel beam from fireplace wall', 12, 60),
    h('p', { class: 'note' }, 'These are estimates. Set them to your measurements and everything rebuilds.')));
  root.append(group('Fireplace + windows',
    fs('center', 'Centre along wall', 30, Math.round(geom().mainY - 30)),
    fs('width', 'Fireplace width', 36, 74),
    fs('bottom', 'Fireplace height off floor', 12, 48),
    rs('transomBottom', 'Window sill height', 60, Math.max(61, r.beamBottom - r.transomH - 1)),
    rs('transomW', 'Window width', 24, 54)));
  root.append(group('Overlays',
    toggle('sightOn', 'Sightline from the sofa', state.showSightline, (v) => { state.showSightline = v; updateLabels(); }),
    toggle('spkOn', 'Speaker pre-wire plan (5.1.2)', state.showSpeakers, (v) => { state.showSpeakers = v; updateLabels(); }),
    h('p', { class: 'note' }, 'Blue dots show where to run speaker wire while the ceiling is open. Hover a dot for its role.')));
  root.append(group('Save or share', h('p', { class: 'note' }, 'Your layout is kept in this browser. Copy the layout code to keep versions or move it to another device.'),
    h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: () => openCode() }, 'Layout code'))));
}

function rebuildRoomOnly() { buildRoom(); buildLights(); updateLighting(); }
function rebuildFixturesAndLights() { buildFixtures(); buildLights(); updateLighting(); drawOutline(); updateLabels(); }
function rebuildTV() {
  if (FX.tv) { fixturesGroup.remove(FX.tv.group); disposeGroup(FX.tv.group); }
  buildTV(); updateLighting(); drawOutline(); updateLabels();
}
function rebuildAll() {
  applyFinishes(); buildRoom(); buildFixtures(); buildLights(); buildAllItems(); updateLighting();
  updateLabels(); drawOutline(); updateRoomSub();
}
function refreshPanels() { renderFurnish(); renderLighting(); renderFinishes(); renderRoomTab(); renderInspector(); }
function updateRoomSub() {
  const r = state.room;
  $('#roomSub').textContent = `Room 1 · ${ftin(r.width)} × ${ftin(r.depth)} · ${ftin(r.ceiling)} ceiling`;
}
