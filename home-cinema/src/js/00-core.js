// ===================================================================
// 00 · Core: imports, units, default design state, helpers
// World units are INCHES. Plan coords: x = east (0 = fireplace wall),
// y = north (0 = staircase wall). three.js: X = x, Y = up, Z = -y.
// ===================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const DEG = Math.PI / 180;
const LUX = 1550;            // candela scale: physical lights tuned in metres, world is in inches
const STORE_KEY = 'basement-cinema-layout-v1';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const P = (x, y, z = 0) => new THREE.Vector3(x, z, -y);   // plan (x, y) + height z -> world

/** 185 -> 15′-5″ ; halves shown as ½ */
function ftin(v) {
  const neg = v < 0; v = Math.abs(v);
  let inches = Math.round(v * 2) / 2;
  let ft = Math.floor(inches / 12);
  let rem = inches - ft * 12;
  if (rem >= 12) { ft += 1; rem -= 12; }
  const whole = Math.floor(rem), half = rem - whole >= 0.5 ? '½' : '';
  return `${neg ? '-' : ''}${ft}′-${whole}${half}″`;
}
const inch = (v) => `${Math.round(v * 2) / 2}″`;
const tvDims = (diag) => ({ w: diag * 16 / Math.hypot(16, 9), h: diag * 9 / Math.hypot(16, 9) });

let _uid = 1;
const uid = (p = 'it') => `${p}${Date.now().toString(36)}${(_uid++).toString(36)}`;

// -------------------------------------------------------------------
// Default design. Room numbers come from the owner's tape (228″ wall to
// wall, 185″ stairs → TV wall, 9′ ceiling); bay geometry from the
// foundation plan (2′-7″ / 7′-9″ / 2′-7″ bay, 2′-2″ jog, steel beam W200).
// -------------------------------------------------------------------
const DEFAULT_STATE = {
  room: {
    width: 228,            // fireplace wall -> exterior wall
    depth: 185,            // staircase wall -> TV wall (back of bay)
    ceiling: 108,          // 9'
    bayDepth: 60,          // main north wall line -> TV wall
    bayLeft: 69,           // x of bay's west return
    bayRight: 202,         // x of bay's east return (2'-2" jog to exterior wall)
    bayFace: 84,           // flat TV wall inside the bay
    soffitDepth: 12,       // bay bulkhead projection from the bay walls
    soffitBottom: 92,      // bay bulkhead underside
    beamX: 33,             // steel beam centre line (W200) from fireplace wall
    beamDepth: 48,         // fireplace-side bulkhead depth from fireplace wall
    beamBottom: 94,        // bulkhead underside over fireplace lounge
    pilasterW: 18, pilasterD: 10,
    boxX: 50,              // drywall box south of the fireplace (east face)
    stairWidth: 40, stairStart: 90, risers: 16, floorToFloor: 122,
    transomW: 42, transomH: 10, transomBottom: 80, transomGap: 6,
  },
  finish: {
    wall: '#cbc2b3', floor: 'walnut', slat: 'walnut',
    fireplaceSlats: true, tvSlats: false, bayAccent: 'paint-dark',
    fabric: '#8f877c', boucle: '#e6dccb',
    transoms: 'windows',   // windows | slatted | framed  (the two openings are already cut)
    mantel: 'none',        // none | ledge | bench
  },
  tv: { size: 75, center: 44, offset: 0, screen: false, screenSize: 110 },
  fireplace: { width: 52, height: 22, bottom: 30, center: 60 },
  light: { scene: 'evening', pots: 0.35, leds: 1, tv: false, fire: true, lamp: true, bloom: true,
    bayPots: true, bias: false, steps: false, screenDown: false },
  option: 'original',
  showSightline: true,
  showSpeakers: false,
  items: [
    { id: 'sectional', type: 'sectional', x: 160, y: 52, rot: 0,
      p: { back: 136, ret: 104, depth: 38, side: 'right', color: '#8f877c' } },
    { id: 'rug-main', type: 'rug', x: 140, y: 78, rot: 0, p: { w: 120, d: 96, color: '#6e6559', pattern: 'weave' } },
    { id: 'ottoman', type: 'ottoman', x: 136, y: 82, rot: 0, p: { w: 40, d: 30, color: '#5b4636' } },
    { id: 'console', type: 'console', x: 135.5, y: 177, rot: 180, p: { w: 70, color: '#4a3424' } },
    { id: 'rug-lounge', type: 'rug', x: 54, y: 64, rot: 90, p: { w: 96, d: 72, color: '#7d7466', pattern: 'border' } },
    { id: 'chair-a', type: 'loungeChair', x: 50, y: 30, rot: 35, p: { color: '#e6dccb' } },
    { id: 'chair-b', type: 'loungeChair', x: 50, y: 98, rot: 145, p: { color: '#e6dccb' } },
    { id: 'table', type: 'roundTable', x: 62, y: 64, rot: 0, p: { dia: 34, color: '#3b281b' } },
    { id: 'olive', type: 'plant', x: 12, y: 106, rot: 0, p: { h: 70 } },
    { id: 'lamp', type: 'floorLamp', x: 210, y: 112, rot: 0, p: {} },
  ],
};

const clone = (o) => JSON.parse(JSON.stringify(o));

/**
 * The design review's recommendation, layered on the original plan:
 * - fireplace wall: slats run across the two windows and a floating walnut
 *   bench sits under a lower fireplace, so the wall stops reading as a face
 * - TV alcove: largest TV that fits the 84″ wall, 6500K bias light, no pot
 *   lights scalloping the bulkhead, 110″ drop-down screen in the bulkhead
 * - stair step lights, lounge chairs moved off the path from the stairs,
 *   two poufs and a bar cart for hangout nights, 5.1.2 speaker pre-wire plan
 */
const RECOMMENDED_STATE = (() => {
  const s = clone(DEFAULT_STATE);
  s.option = 'recommended';
  Object.assign(s.finish, { transoms: 'slatted', mantel: 'bench' });
  Object.assign(s.tv, { size: 85, center: 46, screen: true, screenSize: 110 });
  Object.assign(s.light, { bayPots: false, bias: true, steps: true });
  const at = (id) => s.items.find((i) => i.id === id);
  // a 1′ shorter sectional and a lounge pulled north leave a 30″ path from the foot of the stairs
  Object.assign(at('sectional'), { x: 166, p: { ...at('sectional').p, back: 124 } });
  Object.assign(at('chair-a'), { x: 54, y: 48, rot: 25 });
  Object.assign(at('chair-b'), { x: 54, y: 104, rot: 155 });
  Object.assign(at('table'), { x: 58, y: 76 });
  Object.assign(at('rug-lounge'), { x: 56, y: 76 });
  s.items = s.items.filter((i) => i.id !== 'lamp');
  s.items.push(
    { id: 'pouf-a', type: 'pouf', x: 33, y: 76, rot: 0, p: { color: '#c9bba5' } },
    { id: 'pouf-b', type: 'pouf', x: 86, y: 94, rot: 0, p: { color: '#7a5f48' } },
    { id: 'bar', type: 'barCart', x: 215, y: 116, rot: 180, p: {} },
    { id: 'spk-l', type: 'towerSpeaker', x: 80, y: 157, rot: 200, p: {} },
    { id: 'spk-r', type: 'towerSpeaker', x: 191, y: 157, rot: 160, p: {} },
  );
  return s;
})();
let state = clone(DEFAULT_STATE);

/** Everything the scene needs that is derived from the editable room numbers. */
function geom(r = state.room) {
  const mainY = r.depth - r.bayDepth;
  const a = Math.max(0, (r.bayRight - r.bayLeft - r.bayFace) / 2);
  const ret = Math.max(0, r.bayDepth - a);
  const bay = [
    [r.bayLeft, mainY], [r.bayLeft, mainY + ret], [r.bayLeft + a, r.depth],
    [r.bayRight - a, r.depth], [r.bayRight, mainY + ret], [r.bayRight, mainY],
  ];
  const tvX = (bay[2][0] + bay[3][0]) / 2;
  // floor outline, counter-clockwise (interior on the left of each edge)
  const outline = [
    [0, 0], [r.boxX, 0], [r.boxX, -r.stairWidth], [r.width, -r.stairWidth], [r.width, mainY],
    [r.bayRight, mainY], bay[4], bay[3], bay[2], bay[1], bay[0], [0, mainY],
  ];
  const riserH = r.floorToFloor / r.risers;
  const treads = r.risers - 1;
  const run = Math.min((r.width - r.stairStart) / treads, 11);
  return { mainY, a, ret, bay, tvX, outline, riserH, treads, run };
}

// ---------------- persistence + history ----------------
const history = [];
function snapshot() { return JSON.stringify({ ...state, light: { ...state.light } }); }
function pushHistory() {
  history.push(snapshot());
  if (history.length > 60) history.shift();
  const b = $('#undoBtn'); if (b) b.disabled = history.length === 0;
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
}
function loadSaved() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    return applyState(JSON.parse(raw), false);
  } catch (e) { return false; }
}
/** Merge a (possibly partial / older) layout object onto the defaults. */
function applyState(obj, record = true) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.items)) return false;
  if (record) pushHistory();
  const d = clone(DEFAULT_STATE);
  state = {
    ...d, ...obj,
    room: { ...d.room, ...(obj.room || {}) },
    finish: { ...d.finish, ...(obj.finish || {}) },
    tv: { ...d.tv, ...(obj.tv || {}) },
    fireplace: { ...d.fireplace, ...(obj.fireplace || {}) },
    light: { ...d.light, ...(obj.light || {}) },
    items: obj.items.filter((it) => it && it.type).map((it) => ({ id: it.id || uid(), rot: 0, p: {}, ...it })),
  };
  return true;
}

let toastTimer = 0;
function toast(msg) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}
