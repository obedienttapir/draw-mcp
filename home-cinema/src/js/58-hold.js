// ===================================================================
// 58 · Press and hold: the touch-first way to edit.
//  - hold a piece  -> it lifts; drag to move it (it slides along walls), release for its menu
//  - hold the floor -> "Add here" menu; the new piece lands on that spot
//  - a quick tap never selects, so a phone can orbit the room without bumping furniture
// The menu is a bottom sheet sized for thumbs: quick actions, then Colour / Fabric / Style /
// Layout / Size tabs that only appear when the piece has them.
// ===================================================================
const HOLD_KEY = 'basement-cinema-hold';
const HOLD_MS = 420, HOLD_SLOP = 10;
let holdPref = (() => { try { return localStorage.getItem(HOLD_KEY) !== 'off'; } catch (e) { return true; } })();
const holdMode = () => holdPref;
function setHoldMode(on) {
  holdPref = !!on;
  try { localStorage.setItem(HOLD_KEY, on ? 'on' : 'off'); } catch (e) { /* stays for this visit */ }
  if (!on) closeSheet();
  updateHint();
}
function updateHint() {
  const t = $('#hint'); if (!t) return;
  t.textContent = holdMode()
    ? 'Press and hold furniture to pick it up · hold the floor to add · Q / E rotate'
    : 'Click furniture to select · drag to move · Q / E rotate · Del removes';
}
const buzz = (ms = 12) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* no haptics */ } };

// ---------------- the gesture ----------------
let hold = null;                                    // { id, x, y, cx, cy, timer, hit, fired, ring }
const touches = new Set();                          // pointers currently down (a second finger cancels a hold)
function holdStart(e) {
  setRay(e);
  const hit = pick(), fp = floorPoint();
  const ring = h('div', { class: 'holdring', style: `left:${e.clientX}px;top:${e.clientY}px;--hold:${HOLD_MS}ms` });
  $('#app').append(ring);
  hold = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY, hit, fp, fired: false, ring,
    timer: setTimeout(holdFire, HOLD_MS) };
}
function holdCancel() {
  if (!hold) return;
  clearTimeout(hold.timer); hold.ring.remove(); hold = null;
}
function holdMove(e) {
  if (!hold || hold.fired || e.pointerId !== hold.id) return false;
  hold.cx = e.clientX; hold.cy = e.clientY;
  if (Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > HOLD_SLOP) holdCancel();   // it's a camera drag
  return true;
}
function holdFire() {
  if (!hold) return;
  const { hit, fp } = hold;
  hold.fired = true; hold.ring.classList.add('done');
  setTimeout(() => hold && hold.ring && hold.ring.remove(), 220);
  buzz();
  if (fp) lastHoldFloor = { x: Math.round(fp.x * 2) / 2, y: Math.round(-fp.z * 2) / 2 };
  if (hit && hit.kind === 'item') {
    const it = itemById(hit.id); if (!it) return;
    setRay({ clientX: hold.cx, clientY: hold.cy });
    const f0 = floorPoint() || fp; if (!f0) return;
    closeSheet();
    drag = { id: it.id, x0: it.x, y0: it.y, f0, moved: false, snap: snapshot(), fromHold: true };
    down = { x: hold.cx, y: hold.cy, button: 0, id: hold.id };
    controls.enabled = false; planControls.enabled = false;
    try { el.setPointerCapture(hold.id); } catch (err) { /* pointer already gone */ }
    select({ kind: 'item', id: it.id });
    liftItem(it.id, true);
    toast('Drag to move · let go for options');
  } else if (hit && hit.kind === 'fixture') {
    select({ kind: 'fixture', name: hit.name }); if (isNarrow()) openPanel('right');
  } else if (hit && hit.kind === 'room' && hit.point.y >= 3 && hit.point.y < state.room.ceiling - 2
      && wallSnap(hit.point.x, -hit.point.z).dist < 16) {          // a wall: hang something right here
    select(null);
    openAddSheet({ x: hit.point.x, y: -hit.point.z, wall: { h: Math.round(hit.point.y) } });
  } else if (fp && pointInPoly([fp.x, -fp.z], geom().outline) && (!hit || hit.point.y < 3)) {
    select(null);
    openAddSheet({ x: Math.round(fp.x * 2) / 2, y: Math.round(-fp.z * 2) / 2 });
  } else toast('Hold the floor to add furniture, or a wall to hang something');
}
/** A held piece floats a little so it reads as picked up. */
function liftItem(id, on) {
  const obj = itemObjects.get(id), it = itemById(id); if (!obj || !it) return;
  if (isWallType(it.type)) { obj.group.scale.setScalar(on ? 1.04 : 1); invalidate(2); return; }   // wall pieces swell instead of lifting
  obj.group.position.y = on ? 1.5 : 0; outline.position.y = obj.group.position.y; invalidate(2);
}
function holdEnd(e) {
  const tap = hold && !hold.fired && e.pointerId === hold.id;
  holdCancel();
  return tap;
}
let tapHints = 0, lastHoldFloor = null;
function holdTap(e) {
  setRay(e);
  const hit = pick();
  if (hit && hit.kind === 'item') {
    if (tapHints++ < 3 || sheet) toast('Press and hold to pick it up');
  } else if (hit && hit.kind === 'fixture') {
    select({ kind: 'fixture', name: hit.name });
  } else if (sheet) { closeSheet(); select(null); }
}

// ---------------- the sheet ----------------
let sheet = null;                                     // { kind: 'item', id, tab } | { kind: 'add', at }
const sheetTabs = {};                                 // last tab used per piece type
function closeSheet() {
  if (!sheet) return;
  sheet = null;
  const s = $('#sheet'); s.classList.remove('open', 'peek', 'tall'); s.setAttribute('aria-hidden', 'true');
  $('#app').classList.remove('sheet-open');
  trackInset();
}
/** peek: just the title, quick actions and tabs (the room stays in view) · open: one tab's options · tall: more of them */
function setSheetView(v) {
  if (!sheet) return;
  sheet.view = v;
  const s = $('#sheet'); s.classList.toggle('peek', v === 'peek'); s.classList.toggle('tall', v === 'tall');
  $$('.sheet-tabs button', s).forEach((b) => b.classList.toggle('current', v !== 'peek' && b.getAttribute('aria-selected') === 'true'));
  trackInset();
}
function showSheet(view) {
  const s = $('#sheet'); s.classList.add('open'); s.setAttribute('aria-hidden', 'false');
  $('#app').classList.add('sheet-open');
  if (isNarrow()) openPanel(null);
  setSheetView(view);
}
function openItemSheet(id) {
  const it = itemById(id); if (!it) return;
  sheet = { kind: 'item', id, tab: sheetTabs[it.type], view: 'peek' };
  renderSheet(); showSheet('peek'); revealSelected();
}
function openAddSheet(at) {
  sheet = { kind: 'add', at, view: 'open' };
  renderSheet(); showSheet('open');
}
/** A touch on the room while the sheet is open folds it down to the peek strip (or closes Add here). */
function sheetYieldToCanvas() {
  if (!sheet) return;
  if (sheet.kind === 'add') { closeSheet(); return; }
  if (sheet.view !== 'peek') setSheetView('peek');
}
// ---- keep the room visible above the sheet: shift the picture up by half the sheet's height ----
let insetJob = 0;
function trackInset(ms = 420) {
  const job = ++insetJob, t0 = performance.now();
  const step = () => {
    if (job !== insetJob) return;
    const s = $('#sheet'), r = s.getBoundingClientRect(), st = stage.getBoundingClientRect();
    const full = r.width >= st.width * 0.9;                                 // a phone-width sheet covers the room; a desktop card doesn't
    const px = s.classList.contains('open') && full ? Math.max(0, st.bottom - r.top) : 0;
    if (Math.abs(px - viewInset) > 0.5) applyViewInset(px);
    if (performance.now() - t0 < ms) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
/** If the selected piece is hidden behind the sheet or off screen, glide the camera so it sits in the visible part. */
function revealSelected() {
  setTimeout(() => {
    if (!selected || selected.kind !== 'item' || mode === 'walk') return;
    const obj = itemObjects.get(selected.id); if (!obj) return;
    const pos = obj.group.position.clone(), v = pos.clone().project(activeCam);
    const H = stage.clientHeight, W = stage.clientWidth, y = (1 - (v.y + 1) / 2) * H, x = ((v.x + 1) / 2) * W;
    if (y > 110 && y < H - viewInset - 30 && x > 20 && x < W - 20 && v.z < 1) return;
    if (mode === 'plan') {
      const d = new THREE.Vector3(pos.x - planControls.target.x, 0, pos.z - planControls.target.z);
      ortho.position.add(d); planControls.target.add(d); planControls.update(); invalidate(3);
    } else {
      const d = new THREE.Vector3(pos.x - controls.target.x, 0, pos.z - controls.target.z);
      tween = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: camera.position.clone().add(d), t1: controls.target.clone().add(d) };
      invalidate(2);
    }
  }, 380);
}
/** Keep the sheet in step with the selection (undo, the Furnish list, keyboard). */
function syncSheet() {
  if (!holdMode()) return;
  if (selected && selected.kind === 'item') {
    if (!sheet || sheet.kind !== 'item' || sheet.id !== selected.id) { if (!drag) openItemSheet(selected.id); }
    else renderSheet();
  } else if (sheet && sheet.kind === 'item') closeSheet();
}
function renderSheet() {
  const body = $('#sheetBody'); if (!sheet) return;
  const keep = $('.sheet-pane', body)?.scrollTop || 0;
  body.replaceChildren(sheet.kind === 'add' ? addSheet(sheet.at) : itemSheet());
  const pane = $('.sheet-pane', body); if (pane) pane.scrollTop = keep;
}

const SEATING = { uSectional: 1, sectional: 1, sofa: 1, recliner: 1, loungeChair: 1 };
/** The turn (degrees) that points a piece's front at plan point (tx, ty). */
const facing = (it, tx, ty) => ((Math.round(Math.atan2(-(tx - it.x), ty - it.y) / DEG) % 360) + 360) % 360;
function turnTo(rot) {
  if (!selected || selected.kind !== 'item') return;
  const it = itemById(selected.id); if (!it) return;
  rotateSelected(rot - it.rot);
}
/** After a change of size or layout: if the piece now pokes into a wall, nudge it to the nearest spot that fits. */
function settleItem(it) {
  if (fitsRoom(it)) return;
  const p = nearestFit(it, it.x, it.y);
  if (p) { it.x = p[0]; it.y = p[1]; placeItem(itemObjects.get(it.id).group, it); syncOutline(); toast('Moved off the wall so it fits'); }
}
function afterEdit(it) {
  buildItem(it);
  if (isWallType(it.type)) { placeOnWall(it, it.x, it.y); placeItem(itemObjects.get(it.id).group, it); }   // new size: stay flat on the wall
  else settleItem(it);
  updateLighting(); drawOutline(); updateLabels();
}

function sheetHead(title, sub, extra) {
  return h('header', { class: 'sheet-head' },
    h('div', { class: 'sheet-titles' }, h('h2', {}, title), sub ? h('p', {}, sub) : null),
    extra || null,
    h('button', { class: 'sheet-x', 'aria-label': 'Close', onclick: () => { closeSheet(); select(null); } }, '✕'));
}
const act = (icon, label, fn, cls = '') => h('button', { class: 'act ' + cls, onclick: fn, 'aria-label': label }, h('span', { class: 'ico', 'aria-hidden': 'true' }, icon), h('small', {}, label));

function itemSheet() {
  const it = itemById(sheet.id); if (!it) { closeSheet(); return h('div'); }
  const def = CATALOG[it.type], s = resolveSpec(it), vars = VARIANTS[it.type] || {}, v = vars[s.variant];
  const obj = itemObjects.get(it.id);
  const sub = [v && v.label, UPHOLSTERED[it.type] || it.type === 'rug' ? colorName(s.color) : null, obj ? `${ftin(obj.w)} × ${ftin(obj.d)}` : null].filter(Boolean).join(' · ');
  const fits = fitsRoom(it);
  const status = isWallType(it.type) ? h('span', { class: 'badge ok' }, `On the wall · ${ftin(it.p.h)} up`)
    : h('span', { class: 'badge ' + (fits ? 'ok' : 'bad') }, fits ? 'Clear of walls' : 'Overlaps a wall: drag it free');

  const G = geom(), tv = [G.tvX + state.tv.offset, state.room.depth];
  const acts = h('div', { class: 'sheet-acts' },
    ...(isWallType(it.type) ? [
      act('▲', 'Up 2″', () => nudgeSelected(0, 2)),
      act('▼', 'Down 2″', () => nudgeSelected(0, -2)),
      act('◀', 'Slide', () => nudgeSelected(-4, 0)),
      act('▶', 'Slide', () => nudgeSelected(4, 0)),
      ['frame', 'gallery', 'mirror'].includes(it.type) ? act('◎', '57″ eye', () => nudgeSelected(0, 57 - it.p.h)) : null,
    ] : [
      act('⟲', '15°', () => rotateSelected(15)),
      act('⟳', '15°', () => rotateSelected(-15)),
      act('↻', '90°', () => rotateSelected(90)),
    ]),
    SEATING[it.type] ? act('▣', 'Face TV', () => turnTo(facing(it, ...tv))) : null,
    SEATING[it.type] ? act('♨', 'Face fire', () => turnTo(facing(it, 0, state.fireplace.center))) : null,
    it.type === 'rug' ? act('＋', 'Add here', () => { const at = lastHoldFloor || { x: it.x, y: it.y }; select(null); openAddSheet(at); }) : null,
    act('⧉', 'Copy', duplicateSelected),
    act('⤓', '3D file', () => exportItemGLB(it)),
    act('↶', 'Undo', undo),
    act('🗑', 'Delete', removeSelected, 'danger'));

  // ---- which tabs this piece has ----
  const tabs = [];
  const colours = UPHOLSTERED[it.type] ? [...(COVER_COLORS[s.cover] || [])] : it.type === 'rug' ? RUG_COLORS : null;
  if (colours) tabs.push(['colour', 'Colour']);
  const hasMat = UPHOLSTERED[it.type] || (WOOD_PARTS[it.type] || []).includes(s.variant) || (METAL_PARTS[it.type] || []).includes(s.variant)
    || (STONE_PARTS[it.type] || []).includes(s.variant) || AV_TYPES[it.type];
  if (hasMat) tabs.push(['material', UPHOLSTERED[it.type] ? 'Fabric' : 'Finish']);
  if (Object.keys(vars).length > 1) tabs.push(['style', 'Style']);
  const counts = (def.params || []).filter((q) => q[4] === 'n'), sizes = (def.params || []).filter((q) => q[4] !== 'n');
  if ((def.options || []).length || counts.length) tabs.push(['layout', 'Layout']);
  if (sizes.length) tabs.push(['size', 'Size']);
  let tab = sheet.tab && tabs.some(([k]) => k === sheet.tab) ? sheet.tab : tabs[0] && tabs[0][0];

  const edit = (fn) => { pushHistory(); fn(); afterEdit(it); commit(false); renderStyleTab(); };
  const style = (pairs) => edit(() => { for (const [k, val] of pairs) setStyleKey(it, k, val); });
  const big = (val, text, cur, fn, swatch) => h('button', { class: 'opt' + (swatch ? ' has-sw' : ''), 'aria-pressed': String(val === cur), onclick: fn },
    swatch ? h('i', { class: 'sw', style: `background:${swatch}` }) : null, h('span', {}, text));
  const pane = h('div', { class: 'sheet-pane' });
  const fill = () => {
    pane.replaceChildren();
    if (tab === 'colour') {
      const list = [...colours]; if (!list.some(([c]) => c.toLowerCase() === String(s.color).toLowerCase())) list.unshift([s.color, colorName(s.color)]);
      pane.append(h('div', { class: 'bigswatches' }, list.map(([c, name]) => h('button', {
        class: 'bigsw', style: `--c:${c}`, 'aria-pressed': String(c.toLowerCase() === String(s.color).toLowerCase()), 'aria-label': name,
        onclick: () => style([['color', c]]) }, h('i'), h('small', {}, name)))));
      if (UPHOLSTERED[it.type]) pane.append(h('p', { class: 'note' }, `${COVERS[s.cover].label} colours. More covers under Fabric.`));
    } else if (tab === 'material') {
      if (it.type === 'uSectional') {
        pane.append(h('h4', {}, 'Wayfair fabric options'), h('div', { class: 'opts cards' }, WAYFAIR_FABRICS.map((f) =>
          big(`${f.cover}|${f.color}`, f.label, `${s.cover}|${String(s.color).toLowerCase()}`, () => style([['cover', f.cover], ['color', f.color]]), f.color))));
        pane.append(h('h4', {}, 'Any cover'));
      }
      if (UPHOLSTERED[it.type]) {
        const covers = Object.keys(COVERS).filter((k) => it.type === 'pouf' || k !== 'knit');
        pane.append(h('div', { class: 'opts' }, covers.map((k) => big(k, COVERS[k].label, s.cover, () => style([['cover', k]]), (COVER_COLORS[k] || [[s.color]])[0][0]))));
      }
      if ((WOOD_PARTS[it.type] || []).includes(s.variant)) pane.append(h('h4', {}, 'Wood'), h('div', { class: 'opts' },
        Object.entries(WOOD_FINISHES).map(([k, w]) => big(k, w.label, s.wood || 'walnut', () => style([['wood', k]]), w.color))));
      if ((METAL_PARTS[it.type] || []).includes(s.variant)) pane.append(h('h4', {}, 'Metal'), h('div', { class: 'opts' },
        Object.entries(METAL_FINISHES).map(([k, label]) => big(k, label, s.metal || 'black', () => style([['metal', k]]), { brass: '#b48a52', black: '#1d1c1a', nickel: '#b9b6ae' }[k]))));
      if ((STONE_PARTS[it.type] || []).includes(s.variant)) pane.append(h('h4', {}, 'Stone'), h('div', { class: 'opts' },
        Object.entries(STONE_FINISHES).map(([k, label]) => big(k, label, s.stone || 'marble', () => style([['stone', k]]), { marble: '#e8e4dc', travertine: '#d8c7ad', nero: '#1b1a19' }[k]))));
      if (AV_TYPES[it.type]) pane.append(h('h4', {}, 'Cabinet'), h('div', { class: 'opts' },
        Object.entries(AV_FINISHES).map(([k, label]) => big(k, label, s.finish || 'black', () => style([['finish', k]])))));
    } else if (tab === 'style') {
      pane.append(h('div', { class: 'opts cards' }, Object.entries(vars).map(([k, vv]) =>
        h('button', { class: 'opt card', 'aria-pressed': String(k === s.variant), onclick: () => style([['variant', k]]) }, h('b', {}, vv.label), h('small', {}, vv.desc)))));
    } else if (tab === 'layout') {
      for (const [k, label, min, max] of counts) {
        const set = (d) => { const nv = clamp(it.p[k] + d, min, max); if (nv !== it.p[k]) edit(() => { it.p[k] = nv; }); };
        pane.append(h('div', { class: 'stepper' }, h('span', {}, label),
          h('button', { 'aria-label': 'Fewer', onclick: () => set(-1), disabled: it.p[k] <= min }, '−'),
          h('b', {}, String(it.p[k])),
          h('button', { 'aria-label': 'More', onclick: () => set(1), disabled: it.p[k] >= max }, '+')));
      }
      if (it.type === 'uSectional') {
        const cur = { ...def.defaults, ...it.p }, match = (c) => Object.entries(c).every(([k, val]) => cur[k] === val);
        pane.append(h('h4', {}, 'Configurations'), h('div', { class: 'opts cards' }, TREMEE_CONFIGS.map((c) =>
          h('button', { class: 'opt card', 'aria-pressed': String(match(c.p)), onclick: () => edit(() => Object.assign(it.p, c.p)) },
            h('b', {}, c.label), h('small', {}, c.note)))));
        const u = uSectionalSize({ ...def.defaults, ...it.p });
        pane.append(h('span', { class: 'badge ' + (u.nOtt <= TREMEE.ottomans && it.p.seats === 5 ? 'ok' : 'warn') },
          u.nOtt <= TREMEE.ottomans && it.p.seats === 5 ? `Uses the boxed set: 5 seats, ${u.nOtt} of 3 ottomans` : `Needs ${it.p.seats} seats and ${u.nOtt} ottomans (the box has 5 and 3)`));
      }
      for (const [k, label, opts] of def.options || []) {
        if (k === 'art') {                                    // artwork: picture buttons
          pane.append(h('h4', {}, label), h('div', { class: 'artpick' }, opts.map(([val, text]) => h('button', {
            class: 'artopt', 'aria-pressed': String(val === it.p[k]), onclick: () => edit(() => { it.p[k] = val; }) },
            h('i', { style: `background-image:url(${artThumb(val)})` }), h('small', {}, text)))));
          continue;
        }
        pane.append(h('h4', {}, label), h('div', { class: 'opts' }, opts.map(([val, text]) => big(val, text, it.p[k], () => edit(() => { it.p[k] = val; })))));
      }
    } else if (tab === 'size') {
      for (const [k, label, min, max] of sizes) {
        const sl = slider(`sh-${k}`, label, min, max, 1, it.p[k], inch, (val) => { it.p[k] = val; queue(() => { buildItem(it); updateLighting(); drawOutline(); updateLabels(); }); });
        $('input', sl).addEventListener('change', () => { settleItem(it); renderSheet(); });
        pane.append(sl);
      }
    }
    const price = piecePrice(it, s), weeks = pieceWeeks(it, s);
    if (price) pane.append(h('p', { class: 'note' }, `Indicative ${moneyRange(...price)}${weeks ? ` · ${weeks[0]}–${weeks[1]} wk` : ''}`));
    if (it.type === 'uSectional') pane.append(h('p', { class: 'note' }, `Sizes from Wayfair's dimension sheet: ${pieceSize(it, s).text}. 24.8″ modules, 5.1″ arms, 17.7″ seat height, 18.9″ usable seat depth.`));
    if (hasOverrides(it)) pane.append(h('button', { class: 'btn', onclick: () => edit(() => { delete it.s; }) }, `Reset to the ${STYLE_SETS[activeSetId()].name} look`));
  };
  const tabbar = h('nav', { class: 'sheet-tabs', role: 'tablist' }, tabs.map(([k, label]) => {
    const b = h('button', { role: 'tab', 'aria-selected': String(k === tab), class: k === tab && sheet.view !== 'peek' ? 'current' : '', onclick: () => {
      if (k === tab && sheet.view !== 'peek') { setSheetView('peek'); return; }     // tap the open tab again to fold the sheet
      tab = sheet.tab = sheetTabs[it.type] = k;
      $$('button', tabbar).forEach((x) => x.setAttribute('aria-selected', String(x === b))); fill();
      setSheetView(sheet.view === 'tall' ? 'tall' : 'open');
    } }, label);
    return b;
  }));
  fill();
  return h('div', { class: 'sheet-inner' }, sheetHead(def.label, sub, status), acts, tabs.length ? tabbar : null, pane);
}

// ---------------- add here ----------------
const ADD_ORDER = ['uSectional', 'sectional', 'sofa', 'loungeChair', 'recliner', 'ottoman', 'pouf', 'roundTable', 'sideTable', 'rug', 'console', 'floorLamp', 'plant', 'barCart', 'towerSpeaker', 'subwoofer'];
const artThumbs = {};
const artThumb = (kind) => artThumbs[kind] || (artThumbs[kind] = artCanvas(kind === 'mixed' ? 'abstract' : kind, 0.75, kind === 'mixed' ? 3 : 1).toDataURL('image/jpeg', 0.7));
const DECOR_ICON = { frame: '▭', gallery: '▦', mirror: '◯', shelf: '⎯', sconce: '✺', acousticPanel: '▥' };
function addSheet(at) {
  const pick = (type, extra) => { closeSheet(); addItem(type, at, extra); };
  const decorGrid = () => h('div', { class: 'addgrid' }, DECOR_TYPES.map((t) =>
    h('button', { class: 'opt card', onclick: () => pick(t) }, h('b', {}, `${DECOR_ICON[t]}  ${CATALOG[t].label}`), h('small', {}, CATALOG[t].note))));
  if (at.wall) return h('div', { class: 'sheet-inner' },
    sheetHead('Hang on this wall', `${ftin(at.wall.h)} up · it lands flat on the wall, facing the room`),
    h('div', { class: 'sheet-pane' }, decorGrid(), h('p', { class: 'note' }, 'Hold a hung piece to slide it along the wall or up and down; drag it across to another wall.')));
  const featured = h('div', { class: 'feature' },
    h('button', { class: 'feature-main', onclick: () => pick('uSectional') },
      h('span', { class: 'tag' }, 'From Wayfair'), h('b', {}, 'Tremee U-sectional'), h('small', {}, '134″ × 80″ · 5 storage seats, 3 ottomans · sleeper')),
    h('div', { class: 'feature-sw' }, WAYFAIR_FABRICS.map((f) => h('button', { class: 'bigsw mini', style: `--c:${f.color}`, 'aria-label': `Add in ${f.label}`, title: f.label,
      onclick: () => pick('uSectional', { cover: f.cover, color: f.color }) }, h('i'), h('small', {}, f.label.replace(' Corduroy', ' cord.'))))));
  const grid = h('div', { class: 'addgrid' }, ADD_ORDER.filter((t) => CATALOG[t] && t !== 'uSectional').map((t) =>
    h('button', { class: 'opt card', onclick: () => pick(t) }, h('b', {}, CATALOG[t].label), h('small', {}, CATALOG[t].note))));
  return h('div', { class: 'sheet-inner' },
    sheetHead('Add here', `${ftin(at.x)} from the fireplace wall · ${ftin(at.y)} from the stairs`),
    h('div', { class: 'sheet-pane' }, featured, grid, h('p', { class: 'note' }, 'Seats turn to face the TV. If a piece is too big for the spot, it lands at the nearest place it fits.'),
      h('h4', {}, 'Wall décor · goes on the nearest wall'), decorGrid(), h('p', { class: 'note' }, 'Tip: hold a wall to hang something exactly there.')));
}

function initSheet() {
  const s = $('#sheet'), grip = $('.sheet-grip', s);
  // swipe the grip down to dismiss
  let y0 = null;
  grip.addEventListener('pointerdown', (e) => { y0 = e.clientY; grip.setPointerCapture(e.pointerId); });
  grip.addEventListener('pointermove', (e) => { if (y0 != null) s.style.transform = `translateY(${Math.max(0, e.clientY - y0)}px)`; });
  const end = (e) => {
    if (y0 == null) return;
    const dy = e.clientY - y0; y0 = null; s.style.transform = '';
    if (!sheet) return;
    const order = ['closed', 'peek', 'open', 'tall'], i = order.indexOf(sheet.view || 'open');
    let next = i;
    if (dy > 50) next = i - 1; else if (dy < -40) next = Math.min(3, i + 1); else if (Math.abs(dy) < 6) next = sheet.view === 'peek' ? 2 : 1;
    if (sheet.kind === 'add' && next === 1) next = dy > 50 ? 0 : 2;          // Add here has no peek strip
    if (next <= 0) { closeSheet(); select(null); } else setSheetView(order[next]);
  };
  grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end);
  el.addEventListener('contextmenu', (e) => e.preventDefault());   // a long press must not open the browser menu
  updateHint();
}
