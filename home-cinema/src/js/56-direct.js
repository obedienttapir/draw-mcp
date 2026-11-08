// ===================================================================
// 56 · Direct manipulation: the way pieces are picked, moved and turned.
//  - tap (or click) a piece to select it: an outline, a turning ring on the floor and a small toolbar
//    floating above it (Turn 90°, Face TV, Copy, Delete, Edit)
//  - drag a selected piece to move it (with a mouse, any piece); dragging an unselected piece on a touch
//    screen moves the camera, so nothing gets bumped by accident; a long press picks it up straight away
//  - drag the knob on the ring to turn it, in 15° steps, with the angle shown as you go
//  - while it moves, the distances to the nearest walls show on the floor and a piece that comes within 3″
//    of a wall snaps flush against it
//  - Copy and Delete leave an Undo button for a few seconds
// ===================================================================
const ICONS = {
  turn: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
  fire: '<path d="M12 21c-3.9 0-6-2.6-6-5.6 0-3.6 3-5.4 3.6-9.4 2.5 1.6 3.4 4 3.4 5.6.9-.7 1.4-1.8 1.5-3 1.9 1.6 3.5 4 3.5 6.8 0 3-2.1 5.6-6 5.6z"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  left: '<path d="M19 12H5M11 6l-6 6 6 6"/>', right: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
};
/** An inline line icon (24 × 24, drawn in the current text colour). */
function icon(name, size = 20) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'ic');
  s.innerHTML = ICONS[name] || '';
  return s;
}

// ---------------- the floating toolbar ----------------
let ctxEl = null, chipEl = null, snackEl = null, snackTimer = 0, selTop = 30;
function initDirect() {
  ctxEl = h('div', { class: 'ctx', role: 'toolbar', 'aria-label': 'Selected piece' }); $('#app').append(ctxEl);
  chipEl = h('div', { class: 'ctx-chip', 'aria-live': 'polite' }); $('#app').append(chipEl);
  snackEl = h('div', { class: 'snack', role: 'status' }); $('#app').append(snackEl);
  // hover cue on a mouse: a hand over pieces, a grabbing hand over the selected one
  let lastHover = 0;
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons || drag || rot || viewOnly() || mode === 'walk' || measure.on) return;
    const now = performance.now(); if (now - lastHover < 60) return; lastHover = now;
    if (knobHit(e)) { el.style.cursor = 'grab'; return; }
    setRay(e); const hit = pick();
    el.style.cursor = hit && hit.kind === 'item' ? (selected && selected.id === hit.id ? 'move' : 'pointer') : hit && hit.kind === 'fixture' ? 'pointer' : '';
  });
}
function ctxButton(name, label, fn, cls = '') {
  return h('button', { class: 'ctx-b ' + cls, title: label, 'aria-label': label, onclick: (e) => { e.stopPropagation(); fn(); } }, icon(name), cls.includes('wide') ? h('span', {}, label) : null);
}
/** Rebuild the toolbar for the current selection. */
function renderCtx() {
  if (!ctxEl) return;
  ctxEl.replaceChildren();
  if (!selected) { ctxEl.classList.remove('on'); return; }
  if (selected.kind === 'fixture') {
    ctxEl.append(h('span', { class: 'ctx-name' }, selected.name === 'tv' ? 'TV' : 'Fireplace'),
      h('div', { class: 'ctx-row' }, ctxButton('edit', 'Edit', () => { if (isNarrow()) openPanel('right'); else { $('#rightPanel').classList.remove('collapsed'); $('#toggleRight').setAttribute('aria-expanded', 'true'); } }, 'wide')));
  } else {
    const it = itemById(selected.id); if (!it) return;
    const G = geom(), wall = isWallType(it.type);
    const row = h('div', { class: 'ctx-row' },
      wall ? null : ctxButton('turn', 'Turn 90°', () => rotateSelected(-90)),            // clockwise, like the icon
      SEATING[it.type] ? ctxButton('tv', 'Face the TV', () => turnTo(squareFacing(it, G.tvX + state.tv.offset, state.room.depth))) : null,
      ctxButton('copy', 'Copy', duplicateSelected),
      ctxButton('trash', 'Delete', removeSelected, 'danger'),
      h('span', { class: 'ctx-sep' }),
      ctxButton('edit', 'Edit', () => openItemSheet(it.id), 'wide primary'));
    ctxEl.append(h('span', { class: 'ctx-name' }, CATALOG[it.type].label), row);
  }
  ctxEl.classList.add('on');
  invalidate(1);
}
/** Keep the toolbar just clear of the selected piece and its ring (called after every drawn frame): above it,
 *  or below it when there's no room above. It never covers the piece or the knob. */
const _cv = new THREE.Vector3();
function placeCtx() {
  if (!ctxEl) return;
  const busy = !!(drag && drag.moved) || !!(rot && rot.moved);
  const sheetUp = sheet && sheet.kind === 'item' && sheet.view !== 'peek';
  let show = !!selected && !busy && !sheetUp && mode !== 'walk' && !viewOnly() && !measure.on;
  const pts = [];
  if (show) {
    if (selected.kind === 'item') {
      const obj = itemObjects.get(selected.id), it = itemById(selected.id);
      if (!obj || !it) show = false;
      else {
        const g = obj.group.position, r = knobR || Math.max(obj.w, obj.d) / 2 + 4;
        if (isWallType(it.type)) {                       // a wall piece: its upright box
          const b = new THREE.Box3().setFromObject(obj.group, true);
          for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new THREE.Vector3(x, y, z));
        } else for (let k = 0; k < 12; k++) {             // the ring on the floor and a circle at the top of the piece
          const a = (k / 12) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
          pts.push(new THREE.Vector3(g.x + c * (r + 4), g.y + 1, g.z + sn * (r + 4)));
          pts.push(new THREE.Vector3(g.x + c * Math.max(obj.w, obj.d) / 2, g.y + selTop, g.z + sn * Math.max(obj.w, obj.d) / 2));
        }
        pts.centre = g.clone().setY(g.y + selTop);
      }
    } else {
      const grp = selected.name === 'tv' ? FX.tv?.group : FX.fire?.group;
      if (grp) {
        const b = new THREE.Box3().setFromObject(grp, true);
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new THREE.Vector3(x, y, z));
        pts.centre = b.getCenter(new THREE.Vector3());
      } else show = false;
    }
  }
  if (show) {
    activeCam.updateMatrixWorld();
    const W = stage.clientWidth, H = stage.clientHeight, bottom = H - viewInset;
    const scr = (v) => { _cv.copy(v).project(activeCam); return { x: ((_cv.x + 1) / 2) * W, y: (1 - (_cv.y + 1) / 2) * H, z: _cv.z }; };
    const c = scr(pts.centre);
    let y0 = Infinity, y1 = -Infinity;
    for (const v of pts) { const q = scr(v); if (q.z < 1) { y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); } }
    const bw = ctxEl.offsetWidth || 220, bh = ctxEl.offsetHeight || 70, TOP = 112;
    if (c.z > 1 || c.x < -40 || c.x > W + 40 || y1 < TOP || y0 > bottom) show = false;
    else {
      let below = false, y = y0 - 10;
      if (y - bh < TOP) { below = y1 + 10 + bh < bottom; y = below ? y1 + 10 : TOP + bh; }
      ctxEl.classList.toggle('below', below);
      ctxEl.style.left = `${clamp(c.x, bw / 2 + 8, W - bw / 2 - 8)}px`;
      ctxEl.style.top = `${y}px`;
    }
  }
  ctxEl.classList.toggle('on', show);
}
/** A small label that follows the gesture (the angle while turning). */
function showChip(text, e) {
  if (!chipEl) return;
  if (!text) { chipEl.classList.remove('on'); return; }
  chipEl.textContent = text; chipEl.classList.add('on');
  if (e) { chipEl.style.left = `${e.clientX}px`; chipEl.style.top = `${e.clientY - 46}px`; }
}
/** A message with an Undo button, for a few seconds. */
function snack(msg, undoable = true) {
  if (!snackEl) { toast(msg); return; }
  clearTimeout(snackTimer);
  snackEl.replaceChildren(h('span', {}, msg), undoable ? h('button', { onclick: () => { snackEl.classList.remove('on'); undo(); } }, icon('undo', 16), 'Undo') : null);
  const sh = $('#sheet'), app = $('#app').getBoundingClientRect();
  snackEl.style.bottom = sh.classList.contains('open') ? `${app.bottom - sh.getBoundingClientRect().top + 12}px` : '';
  snackEl.classList.add('on');
  snackTimer = setTimeout(() => snackEl.classList.remove('on'), undoable ? 4500 : 2200);
}

// ---------------- the turning ring ----------------
const RING_MAT = new THREE.LineBasicMaterial({ color: '#d6a463', depthTest: false, transparent: true, opacity: 0.45 });
const KNOB_MAT = new THREE.MeshBasicMaterial({ color: '#d6a463', depthTest: false, transparent: true });
const KNOB_DOT = new THREE.MeshBasicMaterial({ color: '#1c1814', depthTest: false, transparent: true });
let knobR = 0;
/** Draw the ring and its knob in the outline group (local frame of the piece: +Z is its front). */
function drawRing(obj) {
  knobR = Math.max(obj.w, obj.d) / 2 + 12;
  const pts = []; for (let k = 0; k <= 72; k++) { const a = (k / 72) * Math.PI * 2; pts.push(new THREE.Vector3(Math.sin(a) * knobR, 0.9, Math.cos(a) * knobR)); }
  const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), RING_MAT); ring.renderOrder = 20; outline.add(ring);
  const knob = new THREE.Mesh(new THREE.CircleGeometry(3.4, 28), KNOB_MAT); knob.rotation.x = -Math.PI / 2; knob.position.set(0, 1, knobR); knob.renderOrder = 22;
  const dot = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.9, 24), KNOB_DOT); dot.rotation.x = -Math.PI / 2; dot.position.set(0, 1.05, knobR); dot.renderOrder = 23;
  outline.add(knob, dot);
  const b = new THREE.Box3().setFromObject(obj.group, true); selTop = Math.max(8, b.max.y - obj.group.position.y);
}
/** Is the pointer on the knob of the selected piece's ring? (screen distance, generous for fingers) */
function knobHit(e) {
  if (!selected || selected.kind !== 'item' || !knobR) return false;
  const it = itemById(selected.id); if (!it || isWallType(it.type)) return false;
  const p = outline.localToWorld(new THREE.Vector3(0, 1, knobR)); activeCam.updateMatrixWorld();
  const v = p.project(activeCam), r = renderer.domElement.getBoundingClientRect();
  const x = r.left + ((v.x + 1) / 2) * r.width, y = r.top + (1 - (v.y + 1) / 2) * r.height;
  // a finger gets a generous target, but never one that reaches the middle of a piece that looks small on screen
  const m = outline.position.clone().project(activeCam), mx = r.left + ((m.x + 1) / 2) * r.width, my = r.top + (1 - (m.y + 1) / 2) * r.height;
  const reach = Math.min(e.pointerType === 'mouse' ? 16 : 30, Math.max(10, Math.hypot(x - mx, y - my) * 0.55));
  return Math.hypot(e.clientX - x, e.clientY - y) < reach;
}
let rot = null;                                       // { id, snap, rot0, moved }
function startRotate(e) {
  const it = itemById(selected.id);
  rot = { id: it.id, snap: snapshot(), rot0: it.rot, x0: it.x, y0: it.y, moved: false };
  controls.enabled = false; planControls.enabled = false;
  try { el.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
  el.style.cursor = 'grabbing';
}
function moveRotate(e) {
  const it = itemById(rot.id), obj = itemObjects.get(rot.id); if (!it || !obj) return;
  setRay(e); const fp = floorPoint(); if (!fp) return;
  const target = ((Math.round(facing(it, fp.x, -fp.z) / 15) * 15) % 360 + 360) % 360;
  if (target !== it.rot) {
    // turn about where it started; near a wall it steps out just enough to clear it (and back when turned square again)
    const spot = !fitsRoom(it, rot.x0, rot.y0, it.rot) ? [rot.x0, rot.y0] : nearestFit(it, rot.x0, rot.y0, target);
    if (!spot || Math.hypot(spot[0] - rot.x0, spot[1] - rot.y0) > 30) { showChip(`${it.rot}°`, e); return; }
    if (target % 90 === 0) buzz(6);
    it.rot = target; it.x = Math.round(spot[0] * 4) / 4; it.y = Math.round(spot[1] * 4) / 4; rot.moved = true;
    placeItem(obj.group, it); syncOutline(); updateDims(); renderInspectorLive(); invalidate(1);
  }
  showChip(`${it.rot}°`, e);
}
function endRotate() {
  const r = rot; rot = null; showChip(null); el.style.cursor = ''; updateDims(); renderCtx();
  controls.enabled = mode === 'orbit'; planControls.enabled = mode === 'plan';
  if (r.moved) { history.push(r.snap); if (history.length > 60) history.shift(); $('#undoBtn').disabled = false; commit(false); }
}

// ---------------- distances to the walls, and snapping flush ----------------
const dimsGroup = new THREE.Group(); helpersGroup.add(dimsGroup);
const DIM_MAT = new THREE.LineDashedMaterial({ color: '#d6a463', dashSize: 2, gapSize: 1.5, depthTest: false, transparent: true });
const SNAP_IN = 3;
/** The piece's plan bounding box and the free distance from each side to the nearest wall or obstacle. */
function wallGaps(it, x = it.x, y = it.y) {
  const fp = footprint(it, x, y); if (!fp) return null;
  const xs = fp.map((p) => p[0]), ys = fp.map((p) => p[1]);
  const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  const edges = [], o = geom().outline;
  for (let i = 0; i < o.length; i++) edges.push([o[i], o[(i + 1) % o.length]]);
  for (const ob of floorObstacles()) for (let i = 0; i < 4; i++) edges.push([ob[i], ob[(i + 1) % 4]]);
  const cast = (ox, oy, dx, dy) => {                   // nearest edge hit along an axis ray
    let best = Infinity;
    for (const [a, b] of edges) {
      const ex = b[0] - a[0], ey = b[1] - a[1], den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) continue;
      const t = ((a[0] - ox) * ey - (a[1] - oy) * ex) / den, u = ((a[0] - ox) * dy - (a[1] - oy) * dx) / den;
      if (t > -0.01 && u >= 0 && u <= 1 && t < best) best = t;
    }
    return best;
  };
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  return { box, cx, cy, gaps: { e: cast(box.x1, cy, 1, 0), w: cast(box.x0, cy, -1, 0), n: cast(cx, box.y1, 0, 1), s: cast(cx, box.y0, 0, -1) } };
}
/** Pull a square-on piece flush against a wall it has come within 3″ of. Returns the snapped position. */
function snapToWalls(it, x, y) {
  if (isWallType(it.type) || ((it.rot % 90) + 90) % 90 !== 0) return [x, y, false];
  const g = wallGaps(it, x, y); if (!g) return [x, y, false];
  let nx = x, ny = y, hit = false;
  // the collision footprint is WALL_SKIN smaller than the piece: stop with the piece's real edge on the wall
  const k = WALL_SKIN, near = (d) => d < SNAP_IN && d > k + 0.05;
  if (near(g.gaps.e)) { nx += g.gaps.e - k; hit = true; } else if (near(g.gaps.w)) { nx -= g.gaps.w - k; hit = true; }
  if (near(g.gaps.n)) { ny += g.gaps.n - k; hit = true; } else if (near(g.gaps.s)) { ny -= g.gaps.s - k; hit = true; }
  nx = Math.round(nx * 100) / 100; ny = Math.round(ny * 100) / 100;
  if (hit && fitsRoom(it, nx, ny)) return [nx, ny, true];
  return [x, y, false];
}
/** Dashed lines with their lengths from each side of the selected piece to the nearest wall (shown while it moves). */
function updateDims(force = false) {
  disposeGroup(dimsGroup);
  const active = force || (drag && drag.moved) || (rot && rot.moved);
  if (!active || !selected || selected.kind !== 'item') return;
  const it = itemById(selected.id); if (!it || isWallType(it.type)) return;
  const g = wallGaps(it); if (!g) return;
  const z = 1.2, seg = (a, b, d) => {
    if (!(d < 260)) return;
    const gap = Math.max(0, d - WALL_SKIN);                // the footprint is WALL_SKIN inside the real edge
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([P(a[0], a[1], z), P(b[0], b[1], z)]), DIM_MAT);
    l.computeLineDistances(); l.renderOrder = 21; dimsGroup.add(l);
    const tag = document.createElement('div'); tag.className = 'dim brass live'; tag.textContent = gap < 0.3 ? 'flush' : ftin(gap);
    if (gap < 0.3) tag.classList.add('flush');
    const o = new CSS2DObject(tag); o.position.copy(P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z)); dimsGroup.add(o);
  };
  const { box, cx, cy, gaps } = g;
  seg([box.x1, cy], [box.x1 + gaps.e, cy], gaps.e); seg([box.x0, cy], [box.x0 - gaps.w, cy], gaps.w);
  seg([cx, box.y1], [cx, box.y1 + gaps.n], gaps.n); seg([cx, box.y0], [cx, box.y0 - gaps.s], gaps.s);
  invalidate(1);
}
