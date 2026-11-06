// ===================================================================
// 55 · Editing: pick, select, drag on the floor, rotate, measure, keys
// (pointer listeners are attached before OrbitControls so a press on
//  furniture can switch the camera controls off for that gesture)
// ===================================================================
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let selected = null;            // { kind: 'item', id } | { kind: 'fixture', name: 'tv' | 'fireplace' }
let drag = null, down = null;
const outline = new THREE.Group(); helpersGroup.add(outline);
const OUTLINE_MAT = new THREE.LineBasicMaterial({ color: '#d6a463', depthTest: false, transparent: true });

function setRay(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  activeCam.updateMatrixWorld();                     // the camera may have moved since the last drawn frame
  ray.setFromCamera(ndc, activeCam);
}
function pick() {
  const hits = ray.intersectObjects([roomGroup, fixturesGroup, itemsGroup], true);
  for (const h of hits) {
    let o = h.object, vis = true;
    for (let q = o; q; q = q.parent) if (!q.visible) vis = false;
    if (!vis || (o.material && o.material.opacity < 0.5)) continue;
    while (o && !o.userData.itemId && !o.userData.fixture && o.parent) o = o.parent;
    if (o.userData.itemId) return { kind: 'item', id: o.userData.itemId, point: h.point };
    if (o.userData.fixture) return { kind: 'fixture', name: o.userData.fixture, point: h.point };
    return { kind: 'room', point: h.point };
  }
  return null;
}
function floorPoint() { const v = new THREE.Vector3(); return ray.ray.intersectPlane(floorPlane, v) ? v : null; }
const itemById = (id) => state.items.find((i) => i.id === id);

function select(sel) {
  selected = sel && sel.kind !== 'room' ? sel : null;
  drawOutline();
  renderInspector();
  if (selected && isNarrow() && !(holdMode() && selected.kind === 'item')) openPanel('right');
  syncSheet();
}
function drawOutline() {
  disposeGroup(outline); invalidate(2);
  if (!selected) return;
  if (selected.kind === 'item') {
    const it = itemById(selected.id), obj = itemObjects.get(selected.id); if (!it || !obj) { selected = null; return; }
    if (isWallType(it.type)) {                              // a wall piece: an upright outline just in front of it
      const w = obj.w / 2 + 2, hv = obj.hv / 2 + 2, z = obj.d / 2 + 0.6;
      const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-w, -hv], [w, -hv], [w, hv], [-w, hv]].map(([a, b]) => new THREE.Vector3(a, b, z))), OUTLINE_MAT);
      loop.renderOrder = 20; outline.add(loop); syncOutline(); return;
    }
    const w = obj.w + 5, d = obj.d + 5, rr = 3, pts = [];
    for (const [cx, cz, a0] of [[w / 2 - rr, d / 2 - rr, 0], [-w / 2 + rr, d / 2 - rr, 90], [-w / 2 + rr, -d / 2 + rr, 180], [w / 2 - rr, -d / 2 + rr, 270]]) {
      for (let k = 0; k <= 6; k++) { const a = (a0 + k * 15) * DEG; pts.push(new THREE.Vector3(cx + Math.cos(a) * rr, 0.8, cz + Math.sin(a) * rr)); }
    }
    const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), OUTLINE_MAT);
    loop.renderOrder = 20; outline.add(loop);
    // facing arrow
    const ar = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-5, 0.8, d / 2 + 4), new THREE.Vector3(0, 0.8, d / 2 + 10), new THREE.Vector3(5, 0.8, d / 2 + 4)]), OUTLINE_MAT);
    ar.renderOrder = 20; outline.add(ar);
    syncOutline();
  } else {
    const g = selected.name === 'tv' ? FX.tv?.group : FX.fire?.group; if (!g) return;
    const box = new THREE.Box3().setFromObject(g, true).expandByScalar(1.5);
    const helper = new THREE.Box3Helper(box, '#d6a463'); helper.material.depthTest = false; helper.renderOrder = 20;
    outline.position.set(0, 0, 0); outline.rotation.set(0, 0, 0); outline.add(helper);
  }
}
function syncOutline() {
  if (!selected || selected.kind !== 'item') return;
  const obj = itemObjects.get(selected.id); if (!obj) return;
  outline.position.copy(obj.group.position); outline.rotation.copy(obj.group.rotation);
}

// ---------------- measuring ----------------
const measure = { on: false, pts: [], group: new THREE.Group() };
helpersGroup.add(measure.group);
function setMeasure(on) {
  measure.on = on; if (!on) measure.pts = [];
  $('#measureBtn').setAttribute('aria-pressed', String(on));
  renderer.domElement.style.cursor = on ? 'crosshair' : '';
  if (on) toast('Click two points to measure');
  updateMeasureLabels();
}
function updateMeasureLabels() {
  disposeGroup(measure.group);
  const mk = new THREE.MeshBasicMaterial({ color: '#d6a463', depthTest: false });
  for (const p of measure.pts) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), mk); s.position.copy(p); s.renderOrder = 21; measure.group.add(s);
  }
  if (measure.pts.length === 2) {
    const [a, b] = measure.pts;
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), OUTLINE_MAT); l.renderOrder = 21; measure.group.add(l);
    const el = document.createElement('div'); el.className = 'dim brass';
    const dz = Math.abs(a.y - b.y), dh = Math.hypot(a.x - b.x, a.z - b.z);
    el.textContent = `${ftin(a.distanceTo(b))}` + (dz > 3 && dh > 3 ? `  (↔ ${ftin(dh)} · ↕ ${ftin(dz)})` : '');
    const o = new CSS2DObject(el); o.position.copy(a).lerp(b, 0.5); measure.group.add(o);
  }
}

// ---------------- pointer ----------------
const el = renderer.domElement;
el.addEventListener('pointerdown', (e) => {
  el.focus({ preventScroll: true });
  touches.add(e.pointerId);
  if (touches.size > 1) { holdCancel(); return; }                     // pinch / two-finger pan: camera only
  down = { x: e.clientX, y: e.clientY, button: e.button, id: e.pointerId };
  if (mode === 'walk') { walk.dragging = true; walk.lx = e.clientX; walk.ly = e.clientY; el.setPointerCapture(e.pointerId); return; }
  if (e.button !== 0 || measure.on || viewOnly()) return;             // menus hidden: every touch just moves the camera
  if (holdMode()) { sheetYieldToCanvas(); holdStart(e); return; }                           // press and hold picks up; a tap never selects
  setRay(e);
  const hit = pick();
  if (hit && hit.kind === 'item') {
    const it = itemById(hit.id), fp = floorPoint();
    if (it && fp) {
      drag = { id: it.id, x0: it.x, y0: it.y, f0: fp, moved: false, snap: snapshot() };
      controls.enabled = false; planControls.enabled = false;
      el.setPointerCapture(e.pointerId);
      if (!selected || selected.id !== it.id) select({ kind: 'item', id: it.id });
    }
  }
});
el.addEventListener('pointermove', (e) => {
  if (mode === 'walk' && walk.dragging) {
    walk.yaw -= (e.clientX - walk.lx) * 0.0042; walk.pitch = clamp(walk.pitch - (e.clientY - walk.ly) * 0.0042, -1.2, 1.2);
    walk.lx = e.clientX; walk.ly = e.clientY; return;
  }
  if (holdMove(e)) return;
  if (!drag) return;
  setRay(e);
  const fp = floorPoint(); if (!fp) return;
  const it = itemById(drag.id), obj = itemObjects.get(drag.id); if (!it || !obj) return;
  const nx = Math.round((drag.x0 + (fp.x - drag.f0.x)) * 2) / 2, ny = Math.round((drag.y0 - (fp.z - drag.f0.z)) * 2) / 2;
  if (!drag.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) return;
  drag.moved = true;
  if (isWallType(it.type)) { dragOnWall(it, obj); return; }
  // walls stop the piece; it slides along them instead of passing through
  [it.x, it.y] = resolveMove(it, clamp(nx, -40, state.room.width + 40), clamp(ny, -state.room.stairWidth - 40, state.room.depth + 40));
  placeItem(obj.group, it); if (drag.fromHold) obj.group.position.y = 1.5;
  syncOutline();
  renderInspectorLive();
});
el.addEventListener('pointerup', (e) => {
  touches.delete(e.pointerId);
  const click = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5 && down.button === 0;
  if (mode === 'walk') { walk.dragging = false; down = null; return; }
  const tapped = holdEnd(e);
  if (drag) {
    const d = drag;
    if (d.moved) { history.push(d.snap); if (history.length > 60) history.shift(); $('#undoBtn').disabled = false; }
    drag = null;
    controls.enabled = mode === 'orbit'; planControls.enabled = mode === 'plan';
    if (d.fromHold) { liftItem(d.id, false); buzz(8); }
    if (d.moved) commit(false);
    if (d.fromHold) openItemSheet(d.id);
  } else if (holdMode() && !measure.on) {
    if (tapped && click && !viewOnly()) holdTap(e);
  } else if (click && !viewOnly()) {
    setRay(e);
    const hit = pick();
    if (measure.on) {
      const p = mode === 'plan' ? floorPoint() : hit && hit.point.clone();
      if (p) { if (measure.pts.length >= 2) measure.pts = []; measure.pts.push(p); updateMeasureLabels(); }
    } else select(hit);
  }
  down = null;
});
el.addEventListener('pointercancel', (e) => { touches.delete(e.pointerId); holdCancel(); if (drag && drag.fromHold) liftItem(drag.id, false); drag = null; down = null; walk.dragging = false; controls.enabled = mode === 'orbit'; planControls.enabled = mode === 'plan'; });

/** Drag a wall piece: follow the wall under the finger (sliding along it, up and down), or the nearest wall to the floor point. */
function dragOnWall(it, obj) {
  const hits = ray.intersectObjects([roomGroup, fixturesGroup], true);
  let hit = null;
  for (const h of hits) {
    let vis = true; for (let q = h.object; q; q = q.parent) if (!q.visible) vis = false;
    if (!vis || (h.object.material && h.object.material.opacity < 0.5)) continue;
    hit = h; break;
  }
  if (hit && hit.point.y > 2 && hit.point.y < state.room.ceiling - 1) {
    if (drag.dh == null) drag.dh = it.p.h - hit.point.y;            // keep the finger where it grabbed the piece
    placeOnWall(it, hit.point.x, -hit.point.z, hit.point.y + drag.dh);
  } else {
    const fp = floorPoint(); if (!fp) return;
    placeOnWall(it, fp.x, -fp.z);
  }
  placeItem(obj.group, it); syncOutline(); renderInspectorLive();
}

// ---------------- item operations ----------------
function rotateSelected(deg) {
  if (!selected || selected.kind !== 'item') return;
  const it = itemById(selected.id); if (!it) return;
  if (isWallType(it.type)) { toast('Wall pieces turn with the wall: drag it onto another wall'); return; }
  const rot = ((it.rot + deg) % 360 + 360) % 360;
  let x = it.x, y = it.y;
  if (fitsRoom(it) && !fitsRoom(it, x, y, rot)) {          // turning would swing it into a wall: shift it out a little, or refuse
    const p = nearestFit(it, x, y, rot);
    if (!p || Math.hypot(p[0] - x, p[1] - y) > 30) { toast('No room to turn it here: move it away from the wall first'); return; }
    [x, y] = p;
  }
  pushHistory(); it.rot = rot; it.x = x; it.y = y;
  placeItem(itemObjects.get(it.id).group, it); syncOutline(); commit(false);
}
function nudgeSelected(dx, dy) {
  if (!selected || selected.kind !== 'item') return;
  const it = itemById(selected.id); if (!it) return;
  if (isWallType(it.type)) {                              // left/right slide along the wall, up/down change the height
    pushHistory(); const c = Math.cos(it.rot * DEG), s = Math.sin(it.rot * DEG);
    placeOnWall(it, it.x - c * dx, it.y - s * dx, it.p.h + dy);
    placeItem(itemObjects.get(it.id).group, it); syncOutline(); commit(false); return;
  }
  const [x, y] = resolveMove(it, it.x + dx, it.y + dy);
  if (x === it.x && y === it.y) { toast('Against a wall'); return; }
  pushHistory(); it.x = x; it.y = y; placeItem(itemObjects.get(it.id).group, it); syncOutline(); commit(false);
}
function removeSelected() {
  if (!selected || selected.kind !== 'item') return;
  const it = itemById(selected.id); if (!it) return;
  pushHistory();
  state.items = state.items.filter((i) => i.id !== it.id);
  const obj = itemObjects.get(it.id); if (obj) { itemsGroup.remove(obj.group); disposeGroup(obj.group); itemObjects.delete(it.id); }
  select(null); commit(false); toast(`${CATALOG[it.type].label} removed · Ctrl+Z to undo`);
}
function duplicateSelected() {
  if (!selected || selected.kind !== 'item') return;
  const it = itemById(selected.id); if (!it) return;
  pushHistory();
  const copy = { ...clone(it), id: uid(it.type), x: it.x + 12, y: it.y - 12 };
  state.items.push(copy); buildItem(copy);
  if (isWallType(copy.type)) {
    const w = itemObjects.get(copy.id).w + 4, c = Math.cos(it.rot * DEG), s = Math.sin(it.rot * DEG);
    placeOnWall(copy, it.x - c * w, it.y - s * w); placeItem(itemObjects.get(copy.id).group, copy);
  } else { const spot = nearestFit(copy, copy.x, copy.y); if (spot) { [copy.x, copy.y] = spot; placeItem(itemObjects.get(copy.id).group, copy); } }
  updateLighting(); select({ kind: 'item', id: copy.id }); commit(false);
}
/** Add a piece at plan point `at` (default: middle of the room). Seats turn to face the TV; it lands where it fits. */
function addItem(type, at, style) {
  const def = CATALOG[type]; if (!def) return;
  pushHistory();
  const G = geom(), pos = at || { x: state.room.width * 0.55, y: G.mainY * 0.5 };
  const it = { id: uid(type), type, x: pos.x, y: pos.y, rot: 0, p: clone(def.defaults) };
  if (SEATING[type]) it.rot = facing(it, G.tvX + state.tv.offset, state.room.depth);
  else if (type === 'console') it.rot = 180;
  state.items.push(it);
  if (style) for (const [k, v] of Object.entries(style)) setStyleKey(it, k, v);
  buildItem(it);
  if (def.wall) {                                         // hang it on the nearest wall, at the held height if a wall was held
    placeOnWall(it, pos.x, pos.y, at && at.wall ? at.wall.h : it.p.h); it.rot = it.rot || 0;
    placeItem(itemObjects.get(it.id).group, it); updateLighting();
    select({ kind: 'item', id: it.id }); commit(false);
    toast(`${def.label} hung · ${holdMode() ? 'hold it to slide it along the wall or up and down' : 'drag it along the wall'}`);
    return;
  }
  let spot = nearestFit(it, it.x, it.y);
  if (!spot && it.rot) { it.rot = 0; spot = nearestFit(it, it.x, it.y); }
  if (spot) { [it.x, it.y] = spot; placeItem(itemObjects.get(it.id).group, it); }
  updateLighting();
  select({ kind: 'item', id: it.id }); commit(false);
  toast(spot || fitsRoom(it) ? `${def.label} added · ${holdMode() ? 'press and hold to move it' : 'drag it into place'}` : `${def.label} added, but it is too big for this room`);
}
function undo() {
  const prev = history.pop(); $('#undoBtn').disabled = history.length === 0;
  if (!prev) return;
  const keepSel = selected, study = state.study;          // ratings and notes are not part of undo
  applyState(JSON.parse(prev), false); state.study = study;
  rebuildAll(); refreshPanels(); save();
  if (keepSel && (keepSel.kind === 'fixture' || itemById(keepSel.id))) select(keepSel); else select(null);
  toast('Undone');
}

// ---------------- keyboard ----------------
window.addEventListener('keydown', (e) => {
  const t = e.target || {}, tag = t.tagName || '';
  // only text entry keeps its own keys; switches, sliders and buttons still get Ctrl+Z, Q/E, etc.
  const typing = tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !['checkbox', 'radio', 'range', 'button'].includes(t.type));
  if (e.key === 'Escape') {                                // dialogs close even while you type in them
    if (!$('#codeModal').hidden) { closeCode(); return; }
    if (!$('#specModal').hidden) { closeSpec(); return; }
    if (!$('#compareModal').hidden) { closeCompare(); return; }
  }
  if (typing) return;
  if (t.type === 'range' && e.key.startsWith('Arrow')) return;
  if ((!$('#compareModal').hidden || !$('#specModal').hidden) && e.key !== 'Escape') return;   // a sheet is open: keys stay with it
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); return; }
  if (mode === 'walk') {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) { walk.keys.add(e.code); e.preventDefault(); }
  }
  if (mod || e.altKey) return;
  switch (e.key) {
    case '1': setMode('orbit'); break;
    case '2': setMode('plan'); break;
    case '3': setMode('walk'); break;
    case 'm': case 'M': if (!viewOnly()) setMeasure(!measure.on); break;
    case 'h': case 'H': setFocus(!viewOnly()); break;
    case 'Escape': if (viewOnly()) setFocus(false); else if (measure.on) setMeasure(false); else select(null); break;
    case 'q': case 'Q': rotateSelected(e.shiftKey ? 45 : 15); break;
    case 'e': case 'E': rotateSelected(e.shiftKey ? -45 : -15); break;
    case 'r': case 'R': rotateSelected(90); break;
    case 'Delete': case 'Backspace': if (selected && selected.kind === 'item') { e.preventDefault(); removeSelected(); } break;
    default:
      if (mode !== 'walk' && selected && selected.kind === 'item' && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const st = e.shiftKey ? 6 : 1;
        // screen-relative nudge in plan; world-axis nudge otherwise
        nudgeSelected(e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, e.key === 'ArrowUp' ? st : e.key === 'ArrowDown' ? -st : 0);
      }
  }
});
window.addEventListener('keyup', (e) => walk.keys.delete(e.code));
window.addEventListener('blur', () => walk.keys.clear());
