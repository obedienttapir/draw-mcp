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
  if (selected && isNarrow()) openPanel('right');
}
function drawOutline() {
  disposeGroup(outline);
  if (!selected) return;
  if (selected.kind === 'item') {
    const it = itemById(selected.id), obj = itemObjects.get(selected.id); if (!it || !obj) { selected = null; return; }
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
  down = { x: e.clientX, y: e.clientY, button: e.button, id: e.pointerId };
  if (mode === 'walk') { walk.dragging = true; walk.lx = e.clientX; walk.ly = e.clientY; el.setPointerCapture(e.pointerId); return; }
  if (e.button !== 0 || measure.on) return;
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
  if (!drag) return;
  setRay(e);
  const fp = floorPoint(); if (!fp) return;
  const it = itemById(drag.id), obj = itemObjects.get(drag.id); if (!it || !obj) return;
  const nx = Math.round((drag.x0 + (fp.x - drag.f0.x)) * 2) / 2, ny = Math.round((drag.y0 - (fp.z - drag.f0.z)) * 2) / 2;
  if (!drag.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) return;
  drag.moved = true;
  it.x = clamp(nx, -40, state.room.width + 40); it.y = clamp(ny, -state.room.stairWidth - 40, state.room.depth + 40);
  placeItem(obj.group, it); syncOutline();
  renderInspectorLive();
});
el.addEventListener('pointerup', (e) => {
  const click = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5 && down.button === 0;
  if (mode === 'walk') { walk.dragging = false; down = null; return; }
  if (drag) {
    if (drag.moved) { history.push(drag.snap); if (history.length > 60) history.shift(); $('#undoBtn').disabled = false; commit(false); }
    drag = null;
    controls.enabled = mode === 'orbit'; planControls.enabled = mode === 'plan';
  } else if (click) {
    setRay(e);
    const hit = pick();
    if (measure.on) {
      const p = mode === 'plan' ? floorPoint() : hit && hit.point.clone();
      if (p) { if (measure.pts.length >= 2) measure.pts = []; measure.pts.push(p); updateMeasureLabels(); }
    } else select(hit);
  }
  down = null;
});
el.addEventListener('pointercancel', () => { drag = null; down = null; walk.dragging = false; controls.enabled = mode === 'orbit'; planControls.enabled = mode === 'plan'; });

// ---------------- item operations ----------------
function rotateSelected(deg) {
  if (!selected || selected.kind !== 'item') return;
  const it = itemById(selected.id); if (!it) return;
  pushHistory(); it.rot = ((it.rot + deg) % 360 + 360) % 360;
  placeItem(itemObjects.get(it.id).group, it); syncOutline(); commit(false);
}
function nudgeSelected(dx, dy) {
  if (!selected || selected.kind !== 'item') return;
  const it = itemById(selected.id); if (!it) return;
  pushHistory(); it.x += dx; it.y += dy; placeItem(itemObjects.get(it.id).group, it); syncOutline(); commit(false);
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
  state.items.push(copy); buildItem(copy); updateLighting(); select({ kind: 'item', id: copy.id }); commit(false);
}
function addItem(type) {
  const def = CATALOG[type]; if (!def) return;
  pushHistory();
  const G = geom();
  const it = { id: uid(type), type, x: state.room.width * 0.55, y: G.mainY * 0.5, rot: 0, p: clone(def.defaults) };
  state.items.push(it); buildItem(it); updateLighting();
  select({ kind: 'item', id: it.id }); commit(false);
  toast(`${def.label} added · drag it into place`);
}
function undo() {
  const prev = history.pop(); $('#undoBtn').disabled = history.length === 0;
  if (!prev) return;
  const keepSel = selected;
  applyState(JSON.parse(prev), false);
  rebuildAll(); refreshPanels(); save();
  if (keepSel && (keepSel.kind === 'fixture' || itemById(keepSel.id))) select(keepSel); else select(null);
  toast('Undone');
}

// ---------------- keyboard ----------------
window.addEventListener('keydown', (e) => {
  const t = e.target || {}, tag = t.tagName || '';
  // only text entry keeps its own keys; switches, sliders and buttons still get Ctrl+Z, Q/E, etc.
  const typing = tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !['checkbox', 'radio', 'range', 'button'].includes(t.type));
  if (typing) return;
  if (t.type === 'range' && e.key.startsWith('Arrow')) return;
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
    case 'm': case 'M': setMeasure(!measure.on); break;
    case 'Escape': if ($('#codeModal').hidden === false) closeCode(); else if (measure.on) setMeasure(false); else select(null); break;
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
