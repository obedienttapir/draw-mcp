// ===================================================================
// 63 · Acoustics engine (Cinema tuning): the low-frequency wave model.
//
// Below ~200 Hz a room is a set of standing waves, and what you hear at a seat is their sum. Rather than
// assume a shoebox, the planner solves the actual floor plan:
//  - the floor (main room, TV alcove, fireplace lounge, stairs, hall and the passage to the rest of the
//    basement) is cut into 5″ cells; the steel-beam pilaster is solid; the stair wall is solid
//  - the 2-D room modes (Helmholtz equation with rigid walls) are found with shift-invert Lanczos on that
//    grid; the flat 9′ ceiling gives the vertical modes exactly (cos nπz/H), so each 3-D mode is a
//    2-D mode × a vertical one (a "2.5-D" model)
//  - each mode gets its own damping from where its energy meets the boundaries: drywall walls and ceiling
//    (membrane absorbers), the floor, the open passage to the rest of the basement and the stairwell that
//    opens to the floor above, the seats, and any bass traps or panels (weighted by the mode's pressure at
//    the trap: a trap in a corner works on nearly every mode, one at a node does nothing)
//  - the pressure from a source at any point to any point is the modal sum (Green's function), so the
//    bass map, every seat's response, the impulse response and the subwoofer optimiser all come from the
//    same solution, in absolute level relative to the subwoofer's own 1 m output.
// ===================================================================
const AC = { c: 343, IN: 0.0254, g: 5, fLo: 15, fHi: 200, fMode: 300, ppo: 48, ear: 38, subZ: 8 };
const OCT = [63, 125, 250, 500, 1000, 2000, 4000, 8000];
const OCT_LABEL = ['63', '125', '250', '500', '1k', '2k', '4k', '8k'];
// random-incidence absorption coefficients, 63 Hz – 8 kHz (typical published values for these constructions)
const ABS = {
  drywall: { label: 'Drywall on studs', a: [0.28, 0.29, 0.10, 0.05, 0.04, 0.07, 0.09, 0.09] },
  ceiling: { label: 'Drywall ceiling on joists', a: [0.25, 0.29, 0.10, 0.05, 0.04, 0.07, 0.09, 0.09] },
  laminate: { label: 'Laminate on underlay over the slab', a: [0.03, 0.04, 0.04, 0.07, 0.06, 0.06, 0.07, 0.07] },
  rug: { label: 'Rug with pad', a: [0.02, 0.04, 0.12, 0.30, 0.55, 0.65, 0.70, 0.70] },
  glass: { label: 'Window glass', a: [0.30, 0.35, 0.25, 0.18, 0.12, 0.07, 0.04, 0.04] },
  tv: { label: 'TV / screen', a: [0.12, 0.10, 0.06, 0.04, 0.03, 0.03, 0.02, 0.02] },
  stone: { label: 'Fireplace glass and surround', a: [0.02, 0.02, 0.02, 0.03, 0.03, 0.03, 0.04, 0.04] },
  slats: { label: 'Wood slats over felt', a: [0.08, 0.15, 0.40, 0.75, 0.80, 0.65, 0.50, 0.40] },
  panel2: { label: '2″ fabric-wrapped panel', a: [0.05, 0.18, 0.75, 1.0, 1.0, 1.0, 0.98, 0.95] },
  panel4: { label: '4″ panel with air gap', a: [0.25, 0.75, 1.0, 1.0, 1.0, 0.98, 0.95, 0.9] },
  slatPanel: { label: 'Slatted acoustic panel', a: [0.06, 0.12, 0.45, 0.80, 0.85, 0.70, 0.55, 0.45] },
  opening: { label: 'Open to the stairs and hall', a: [0.65, 0.70, 0.80, 0.85, 0.90, 0.95, 0.95, 0.95] },
};
// absorption area (m²) per unit
const UNITS = {
  seat: { label: 'Upholstered seat', a: [0.05, 0.12, 0.25, 0.40, 0.50, 0.55, 0.55, 0.50] },
  person: { label: 'Person (seated)', a: [0.05, 0.12, 0.25, 0.35, 0.42, 0.45, 0.45, 0.42] },
  trap: { label: 'Corner bass trap, floor to ceiling', a: [0.9, 1.6, 1.9, 1.9, 1.8, 1.7, 1.6, 1.5] },
};
const AIR_M = [0, 0, 0, 0.0006, 0.001, 0.0024, 0.0074, 0.024];       // air absorption (1/m), 20 °C, 50 % RH
/** Value of a per-octave table at frequency f (log interpolation, held at the ends). */
function octAt(a, f) {
  const t = Math.log2(Math.max(f, 1) / 63);
  if (t <= 0) return a[0];
  if (t >= 7) return a[7];
  const i = Math.floor(t), u = t - i;
  return a[i] + (a[i + 1] - a[i]) * u;
}
const acM = (inches) => inches * AC.IN;
const tick = () => new Promise((res) => setTimeout(res, 0));

// ---------------- the grid ----------------
function acGrid() {
  const r = state.room, G = geom(), g = AC.g, poly = G.outline;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const nx = Math.ceil((x1 - x0) / g), ny = Math.ceil((y1 - y0) / g);
  const pil = [r.beamX - r.pilasterW / 2, G.westY - r.pilasterD, r.beamX + r.pilasterW / 2, G.westY];
  const id = new Int32Array(nx * ny).fill(-1), X = [], Y = [], I = [], J = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * g, y = y0 + (j + 0.5) * g;
    if (!pointInPoly([x, y], poly)) continue;
    if (x > pil[0] && x < pil[2] && y > pil[1] && y < pil[3]) continue;
    id[j * nx + i] = X.length; X.push(x); Y.push(y); I.push(i); J.push(j);
  }
  const N = X.length;
  // the solid wall between the room and the stairs (from wallX to the exterior wall)
  const blocked = (k, kk) => (Y[k] < 0) !== (Y[kk] < 0) && X[k] >= G.wallX - 0.01 && X[k] <= r.width;
  const edges = [], wallF = new Float32Array(N), openF = new Float32Array(N);
  const room = new Uint8Array(N), stair = new Uint8Array(N);
  const sx0 = Math.min(r.stairStart, G.topX - G.run);
  const walls = [];                                     // boundary faces: [cell, nx, ny] (outward normal) for candidates
  let bw = 0;
  for (let k = 0; k < N; k++) {
    room[k] = Y[k] >= 0 ? 1 : 0;
    stair[k] = Y[k] < 0 && Y[k] >= G.uy0 && X[k] >= sx0 ? 1 : 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i2 = I[k] + di, j2 = J[k] + dj;
      const kk = i2 >= 0 && i2 < nx && j2 >= 0 && j2 < ny ? id[j2 * nx + i2] : -1;
      if (kk >= 0 && !blocked(k, kk)) { if (kk > k) { edges.push(k, kk); bw = Math.max(bw, kk - k); } continue; }
      // a boundary face: the open end of the passage to the rest of the basement, or a wall
      const open = di === -1 && G.openEdge && Math.abs(X[k] - g / 2 - G.runX) < g * 0.75 && Y[k] < G.oy0 && Y[k] > G.oy1;
      if (open) openF[k] += 1; else { wallF[k] += 1; walls.push([k, di, dj]); }
    }
  }
  return { nx, ny, x0, y0, g, N, id, X, Y, I, J, edges, bw, wallF, openF, room, stair, walls, H: r.ceiling, key: acKey() };
}
const acKey = () => JSON.stringify(state.room);

// ---------------- banded Cholesky ----------------
function bandChol(A, N, bw) {
  const W = bw + 1;
  for (let i = 0; i < N; i++) {
    const j0 = Math.max(0, i - bw);
    for (let j = j0; j <= i; j++) {
      let s = A[i * W + (i - j)];
      const k0 = Math.max(j0, j - bw), ri = i * W + i, rj = j * W + j;
      for (let k = k0; k < j; k++) s -= A[ri - k] * A[rj - k];
      if (i === j) A[i * W] = Math.sqrt(Math.max(s, 1e-300)); else A[i * W + (i - j)] = s / A[j * W];
    }
  }
}
function bandSolve(L, N, bw, b) {
  const W = bw + 1;
  for (let i = 0; i < N; i++) { let s = b[i]; const ri = i * W + i; for (let k = Math.max(0, i - bw); k < i; k++) s -= L[ri - k] * b[k]; b[i] = s / L[i * W]; }
  for (let i = N - 1; i >= 0; i--) { let s = b[i]; const kmax = Math.min(N - 1, i + bw); for (let k = i + 1; k <= kmax; k++) s -= L[k * W + (k - i)] * b[k]; b[i] = s / L[i * W]; }
}
/** Symmetric tridiagonal eigen-decomposition (implicit QL). d: diagonal, e: off-diagonal (e[i] between i and i+1).
 *  z: n×n identity on entry, eigenvectors in its columns on exit. */
function tqli(d, e, z, n) {
  for (let l = 0; l < n; l++) {
    let iter = 0, m;
    do {
      for (m = l; m < n - 1; m++) { const dd = Math.abs(d[m]) + Math.abs(d[m + 1]); if (Math.abs(e[m]) + dd === dd) break; }
      if (m !== l) {
        if (iter++ === 80) break;
        let g = (d[l + 1] - d[l]) / (2 * e[l]), r = Math.hypot(g, 1);
        g = d[m] - d[l] + e[l] / (g + (g >= 0 ? Math.abs(r) : -Math.abs(r)));
        let s = 1, c = 1, p = 0, i;
        for (i = m - 1; i >= l; i--) {
          let f = s * e[i]; const b = c * e[i];
          e[i + 1] = (r = Math.hypot(f, g));
          if (r === 0) { d[i + 1] -= p; e[m] = 0; break; }
          s = f / r; c = g / r; g = d[i + 1] - p; r = (d[i] - g) * s + 2 * c * b; d[i + 1] = g + (p = s * r); g = c * r - b;
          for (let k = 0; k < n; k++) { const zi = k * n + i; f = z[zi + 1]; z[zi + 1] = s * z[zi] + c * f; z[zi] = c * z[zi] - s * f; }
        }
        if (r === 0 && i >= l) continue;
        d[l] -= p; e[l] = g; e[m] = 0;
      }
    } while (m !== l);
  }
}

// ---------------- room modes ----------------
let ACS = null;                                         // the solved room: { grid, modes2, modes3 } (per room geometry)
let acsJob = null;
/** Solve the room's modes (async, a second or so; cached until the room measurements change). */
function acSolve(onProgress = () => {}) {
  const key = acKey();
  if (ACS && ACS.grid.key === key) return Promise.resolve(ACS);
  if (acsJob && acsJob.key === key) return acsJob.p;
  const p = (async () => {
    const grid = acGrid(), { N, bw, edges } = grid, h = acM(grid.g), H = acM(grid.H);
    const lamMax = (2 * Math.PI * AC.fMode / AC.c) ** 2, sigma = (2 * Math.PI * 6 / AC.c) ** 2;
    // stiffness (negative Laplacian, finite volumes, rigid walls) + shift, banded, then factor
    const W = bw + 1, A = new Float64Array(N * W), ih2 = 1 / (h * h);
    for (let k = 0; k < N; k++) A[k * W] = sigma;
    for (let e = 0; e < edges.length; e += 2) {
      const a = edges[e], b = edges[e + 1];
      A[a * W] += ih2; A[b * W] += ih2; A[b * W + (b - a)] -= ih2;
    }
    onProgress(0.02, 'Factoring the room'); await tick();
    bandChol(A, N, bw);
    // how many modes to expect below fMode (Weyl's law, with the rigid-wall edge term)
    let per = 0; for (let k = 0; k < N; k++) per += grid.wallF[k] + grid.openF[k];
    const area = N * h * h, kmax = Math.sqrt(lamMax);
    const est = area * lamMax / (4 * Math.PI) + per * h * kmax / (4 * Math.PI) + 2;
    const m = Math.min(N - 1, Math.ceil(est * 2.2 + 30), 520);
    const Q = new Float64Array(m * N), alpha = new Float64Array(m), beta = new Float64Array(m);
    let q = new Float64Array(N), qPrev = null;
    let seed = 7; for (let k = 0; k < N; k++) { seed = (seed * 16807) % 2147483647; q[k] = seed / 2147483647 - 0.5; }
    let nq = 0; for (let k = 0; k < N; k++) nq += q[k] * q[k]; nq = Math.sqrt(nq); for (let k = 0; k < N; k++) q[k] /= nq;
    let steps = m;
    for (let j = 0; j < m; j++) {
      Q.set(q, j * N);
      const w = Float64Array.from(q); bandSolve(A, N, bw, w);
      let a = 0; for (let k = 0; k < N; k++) a += w[k] * q[k];
      for (let k = 0; k < N; k++) w[k] -= a * q[k] + (qPrev ? beta[j - 1] * qPrev[k] : 0);
      // full reorthogonalisation (a second pass only when the first removed most of the vector)
      let n0 = 0; for (let k = 0; k < N; k++) n0 += w[k] * w[k];
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i <= j; i++) {
          const off = i * N; let c = 0;
          for (let k = 0; k < N; k++) c += w[k] * Q[off + k];
          for (let k = 0; k < N; k++) w[k] -= c * Q[off + k];
        }
        let n1 = 0; for (let k = 0; k < N; k++) n1 += w[k] * w[k];
        if (n1 > 0.5 * n0) break; n0 = n1;
      }
      let b = 0; for (let k = 0; k < N; k++) b += w[k] * w[k]; b = Math.sqrt(b);
      alpha[j] = a; beta[j] = b;
      if (b < 1e-13) { steps = j + 1; break; }
      qPrev = q; q = w; for (let k = 0; k < N; k++) q[k] /= b;
      if (j % 16 === 15) { onProgress(0.05 + 0.8 * j / m, `Solving room modes · ${j + 1} of ${m} Lanczos steps`); await tick(); }
    }
    onProgress(0.86, 'Extracting the modes'); await tick();
    const n = steps, d = alpha.slice(0, n), e = new Float64Array(n), z = new Float64Array(n * n);
    for (let i = 0; i < n - 1; i++) e[i] = beta[i];
    for (let i = 0; i < n; i++) z[i * n + i] = 1;
    tqli(d, e, z, n);
    const found = [];
    for (let i = 0; i < n; i++) {
      const th = d[i]; if (!(th > 0)) continue;
      const lam = 1 / th - sigma; if (lam > lamMax * 1.05) continue;
      const resid = Math.abs(beta[n - 1] * z[(n - 1) * n + i]);
      if (resid / th > 2e-5) continue;
      found.push({ lam: Math.max(0, lam), i });
    }
    found.sort((p1, p2) => p1.lam - p2.lam);
    const modes2 = [];
    for (const { lam, i } of found) {
      const psi = new Float64Array(N);
      for (let j = 0; j < n; j++) { const y = z[j * n + i]; if (Math.abs(y) < 1e-14) continue; const off = j * N; for (let k = 0; k < N; k++) psi[k] += y * Q[off + k]; }
      let ss = 0, big = 0; for (let k = 0; k < N; k++) { ss += psi[k] * psi[k]; if (Math.abs(psi[k]) > Math.abs(big)) big = psi[k]; }
      const sc = Math.sqrt(N / ss) * (big < 0 ? -1 : 1);       // mean square 1 over the floor; largest lobe positive
      const ps = new Float32Array(N); for (let k = 0; k < N; k++) ps[k] = psi[k] * sc;
      // where its energy meets the boundaries (all relative to the mean square, 1)
      let wall = 0, open = 0, st = 0, rm = 0;
      for (let k = 0; k < N; k++) { const p2 = ps[k] * ps[k]; wall += p2 * grid.wallF[k]; open += p2 * grid.openF[k]; if (grid.stair[k]) st += p2; if (grid.room[k]) rm += p2; }
      modes2.push({ lam, f: AC.c * Math.sqrt(Math.max(lam, 0)) / (2 * Math.PI), psi: ps, wallW: wall / (N * h), openW: open / (N * h), stairFrac: st / N, roomFrac: rm / N });
      if (modes2.length % 20 === 0) await tick();
    }
    // 3-D modes: each 2-D mode with the vertical ones (rigid floor and ceiling)
    const modes3 = [];
    for (let mi = 0; mi < modes2.length; mi++) {
      for (let nz = 0; ; nz++) {
        const kz = nz * Math.PI / H, lam3 = modes2[mi].lam + kz * kz;
        if (lam3 > lamMax) break;
        modes3.push({ m: mi, nz, lam: lam3, f: AC.c * Math.sqrt(lam3) / (2 * Math.PI), L: nz ? 0.5 : 1 });
      }
    }
    modes3.sort((p1, p2) => p1.lam - p2.lam);
    for (const md of modes2) md.label = modeShape(grid, md);
    const res = { grid, modes2, modes3, fTop: modes2.length ? modes2[modes2.length - 1].f : 0 };
    ACS = res; acsJob = null; onProgress(1, `${modes3.length} room modes below ${AC.fMode} Hz`);
    return res;
  })();
  acsJob = { key, p };
  return p;
}
/** Name a 2-D mode by its closest match to the main room's rectangular modes (p along the room, q across). */
function modeShape(grid, md) {
  const r = state.room, G = geom(), Wd = r.width, D = G.mainY;
  let best = { p: 0, q: 0, c: 0 };
  for (let p = 0; p <= 6; p++) for (let q = 0; q <= 5; q++) {
    let s = 0, n1 = 0, n2 = 0;
    for (let k = 0; k < grid.N; k++) {
      const x = grid.X[k], y = grid.Y[k]; if (y < 0 || y > D) continue;
      const b = Math.cos(p * Math.PI * x / Wd) * Math.cos(q * Math.PI * y / D);
      s += b * md.psi[k]; n1 += b * b; n2 += md.psi[k] * md.psi[k];
    }
    const c = n1 && n2 ? (s * s) / (n1 * n2) : 0;
    if (c > best.c) best = { p, q, c };
  }
  return best;
}

// ---------------- probes: the mode values at a point ----------------
/** Bilinear weights of the cells around plan point (x, y). */
function acProbe(grid, x, y) {
  const fi = (x - grid.x0) / grid.g - 0.5, fj = (y - grid.y0) / grid.g - 0.5;
  const i0 = Math.floor(fi), j0 = Math.floor(fj), u = fi - i0, v = fj - j0, out = [];
  let tw = 0;
  for (const [di, dj, w] of [[0, 0, (1 - u) * (1 - v)], [1, 0, u * (1 - v)], [0, 1, (1 - u) * v], [1, 1, u * v]]) {
    const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= grid.nx || j >= grid.ny) continue;
    const k = grid.id[j * grid.nx + i]; if (k < 0 || w <= 0) continue;
    out.push([k, w]); tw += w;
  }
  if (!out.length) {                                   // outside the floor: the nearest cell
    let bk = 0, bd = Infinity;
    for (let k = 0; k < grid.N; k++) { const dd = (grid.X[k] - x) ** 2 + (grid.Y[k] - y) ** 2; if (dd < bd) { bd = dd; bk = k; } }
    return [[bk, 1]];
  }
  return out.map(([k, w]) => [k, w / tw]);
}
/** The coefficients ψ(x, y)·cos(nπz/H) of every 3-D mode at a point. */
function acCoef(S, x, y, z) {
  const pr = acProbe(S.grid, x, y), H = S.grid.H, c = new Float64Array(S.modes3.length);
  const v2 = S.modes2.map((md) => { let s = 0; for (const [k, w] of pr) s += w * md.psi[k]; return s; });
  S.modes3.forEach((md, i) => { c[i] = v2[md.m] * Math.cos(md.nz * Math.PI * z / H); });
  return c;
}

// ---------------- damping ----------------
/** Everything that absorbs bass, from the layout and the tuning choices. */
function acAbsorbers() {
  const t = state.tune, r = state.room, G = geom();
  const seats = acSeatCount();
  const traps = acTrapSpots().slice(0, t.traps || 0);
  const panels = [];
  for (const it of state.items) if (it.type === 'acousticPanel') {
    const p = { ...CATALOG.acousticPanel.defaults, ...it.p }, v = resolveSpec(it).variant;
    panels.push({ x: it.x, y: it.y, z: p.h, area: acM(p.w) * acM(p.hgt), mat: v === 'slat' ? 'slatPanel' : 'panel2' });
  }
  if (t.reflPanels) for (const s of acReflectionPanelSpots()) panels.push({ ...s, area: acM(24) * acM(48), mat: 'panel2', virtual: true });
  if (t.rearPanels) for (const s of acRearSpots()) panels.push({ ...s, area: acM(24) * acM(48), mat: 'panel4', virtual: true });
  const cl = t.cloud && acCloudSpot(); if (cl) { panels.push({ x: cl.x, y: cl.y, z: r.ceiling - 4, area: acM(cl.w) * acM(cl.d), mat: 'panel4', ceiling: true, virtual: true }); }
  let rugA = 0;
  for (const it of state.items) if (it.type === 'rug') rugA += acM(it.p.w || 96) * acM(it.p.d || 72);
  return { seats, people: Math.min(t.people || 0, seats), traps, panels, rugA };
}
/** Number of upholstered seats in the room. */
function acSeatCount() {
  let n = 0;
  for (const it of state.items) {
    const p = { ...(CATALOG[it.type] || {}).defaults, ...it.p };
    if (it.type === 'uSectional') n += uSectionalSize(p).n + 1;
    else if (it.type === 'prettySectional') n += 4;
    else if (it.type === 'sectional') n += Math.round((p.back + p.ret) / 32);
    else if (it.type === 'sofa') n += Math.max(2, Math.round((p.w || 84) / 30));
    else if (it.type === 'loungeChair' || it.type === 'recliner') n += 1;
    else if (it.type === 'ottoman' || it.type === 'pouf') n += 0.4;
  }
  return n;
}
/** Corners for bass traps: the room's real (convex, floor-to-ceiling) corners, front of the room first. */
function acTrapSpots() {
  const r = state.room, G = geom(), o = 6;
  return [
    { x: r.width - o, y: G.mainY - o, label: 'front right corner' },
    { x: o, y: G.westY - o, label: 'front left corner (fireplace wall)' },
    { x: r.width - o, y: o, label: 'rear right corner (by the stair wall)' },
    { x: o, y: o, label: 'rear left corner' },
  ];
}
/** Per-mode decay rate δ (1/s) for the current absorbers. */
function acDamping(S) {
  const g = S.grid, H = acM(g.H), Afl = g.N * acM(g.g) ** 2, V = Afl * H, c = AC.c;
  const ab = acAbsorbers();
  const rugFrac = clamp(ab.rugA / Afl, 0, 0.6);
  const trapC = ab.traps.map((s) => acProbe(g, s.x, s.y));
  const panC = ab.panels.map((s) => ({ ...s, pr: acProbe(g, s.x, s.y) }));
  const psiAt = (md, pr) => { let s = 0; for (const [k, w] of pr) s += w * md.psi[k]; return s; };
  return S.modes3.map((md3) => {
    const md = S.modes2[md3.m], f = Math.max(md3.f, AC.fLo), L = md3.L;
    const aw = octAt(ABS.drywall.a, f), ac = octAt(ABS.ceiling.a, f), ao = octAt(ABS.opening.a, f);
    const af = octAt(ABS.laminate.a, f) * (1 - rugFrac) + octAt(ABS.rug.a, f) * rugFrac;
    let d = (c / 16) * (aw * md.wallW + ao * md.openW);
    d += (c / 16) * (af + ac * (1 - md.stairFrac) + ao * md.stairFrac) / (H * L);
    d += c * (ab.seats * octAt(UNITS.seat.a, f) + ab.people * octAt(UNITS.person.a, f)) / (8 * V);
    for (const pr of trapC) d += c * octAt(UNITS.trap.a, f) * psiAt(md, pr) ** 2 / (8 * V);
    for (const p of panC) {
      const fz = p.ceiling ? 1 : Math.cos(md3.nz * Math.PI * p.z / g.H) ** 2;
      d += c * p.area * octAt(ABS[p.mat].a, f) * psiAt(md, p.pr) ** 2 * fz / (8 * V * L);
    }
    return d;
  });
}

// ---------------- transfer functions ----------------
const logFreqs = (lo = AC.fLo, hi = AC.fHi, ppo = AC.ppo) => { const n = Math.ceil(ppo * Math.log2(hi / lo)) + 1; return Array.from({ length: n }, (_, i) => lo * 2 ** (i / ppo)); };
/** Modal denominators 1 / (V Λ (k_N² − k² + 2ikδ/c)) at each frequency: [re, im] per mode per frequency. */
function acInv(S, damp, F) {
  const g = S.grid, V = g.N * acM(g.g) ** 2 * acM(g.H), M = S.modes3.length;
  const re = new Float64Array(F.length * M), im = new Float64Array(F.length * M);
  F.forEach((f, fi) => {
    const k = 2 * Math.PI * f / AC.c, k2 = k * k;
    for (let n = 0; n < M; n++) {
      const md = S.modes3[n], a = md.lam - k2, b = 2 * k * damp[n] / AC.c, s = V * md.L * (a * a + b * b);
      re[fi * M + n] = a / s; im[fi * M + n] = -b / s;
    }
  });
  return { re, im, M, F };
}
/** Complex transfer (1/m) from a source with coefficients cs to a receiver with coefficients cr. ×4π = re 1 m free field. */
function acTransfer(inv, cs, cr) {
  const { re, im, M, F } = inv, out = new Float64Array(F.length * 2);
  const w = new Float64Array(M); for (let n = 0; n < M; n++) w[n] = cs[n] * cr[n];
  for (let fi = 0; fi < F.length; fi++) {
    let sr = 0, si = 0; const off = fi * M;
    for (let n = 0; n < M; n++) { sr += w[n] * re[off + n]; si += w[n] * im[off + n]; }
    out[fi * 2] = sr; out[fi * 2 + 1] = si;
  }
  return out;
}
const db = (re, im) => 10 * Math.log10(re * re + im * im + 1e-30);
const FF = 4 * Math.PI;                                  // |transfer| × 4π: level re the same source at 1 m in free field

// ---------------- filters ----------------
/** Complex response of a 2nd-order section with poles at f0, Q (kind: 'lp' | 'hp'). */
function sos(kind, f0, Q, f) {
  const x = f / f0, dr = 1 - x * x, di = x / Q, den = dr * dr + di * di;
  const nr = kind === 'lp' ? 1 : -x * x;                  // (jx)² = −x²
  return [nr * dr / den, -nr * di / den];
}
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
/** Linkwitz–Riley 4th order. */
const lr4 = (kind, f0, f) => { const s = sos(kind, f0, Math.SQRT1_2, f); return cmul(s, s); };
/** RBJ peaking biquad (48 kHz) complex response. */
function peq(f0, gainDb, Q, f, fs = 48000) {
  const A = 10 ** (gainDb / 40), w0 = 2 * Math.PI * f0 / fs, al = Math.sin(w0) / (2 * Q), cw = Math.cos(w0);
  const b0 = 1 + al * A, b1 = -2 * cw, b2 = 1 - al * A, a0 = 1 + al / A, a1 = -2 * cw, a2 = 1 - al / A;
  const w = 2 * Math.PI * f / fs, c1 = Math.cos(w), s1 = -Math.sin(w), c2 = Math.cos(2 * w), s2 = -Math.sin(2 * w);
  const nr = b0 + b1 * c1 + b2 * c2, ni = b1 * s1 + b2 * s2, dr = a0 + a1 * c1 + a2 * c2, di = a1 * s1 + a2 * s2, dd = dr * dr + di * di;
  return [(nr * dr + ni * di) / dd, (ni * dr - nr * di) / dd];
}
// subwoofers: anechoic response (high-pass) and maximum output at 1 m (typical CEA-2010-style figures for the class)
const SUB_MODELS = {
  '12s': { label: '12″ sealed', note: '500 W, small cabinet', hp: [22, 0.7, 2], max: [[16, 88], [20, 95], [25, 101], [31.5, 106], [40, 110], [50, 112], [63, 113], [200, 113]] },
  '15p': { label: '15″ ported', note: '1000 W, tuned to 17 Hz', hp: [17, Math.SQRT1_2, 4], max: [[16, 96], [20, 106], [25, 111], [31.5, 114], [40, 116], [50, 117], [63, 118], [200, 118]] },
  '18p': { label: '18″ ported', note: '1500 W, reference class', hp: [15, Math.SQRT1_2, 4], max: [[16, 103], [20, 112], [25, 116], [31.5, 119], [40, 121], [50, 122], [63, 122], [200, 122]] },
};
function subMax(model, f) {
  const t = SUB_MODELS[model].max;
  if (f <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (f <= t[i][0]) { const u = Math.log(f / t[i - 1][0]) / Math.log(t[i][0] / t[i - 1][0]); return lerp(t[i - 1][1], t[i][1], u); }
  return t[t.length - 1][1];
}
function subResp(model, f) {
  const [f0, Q, order] = SUB_MODELS[model].hp;
  return order === 4 ? cmul(sos('hp', f0, 0.5412, f), sos('hp', f0, 1.3066, f)) : sos('hp', f0, Q, f);   // 4th order: Butterworth pair
}
/** The signal chain to the subwoofers at f: sub's own roll-off × low-pass (LFE 120 Hz, or the crossover). */
function subChain(f, t = state.tune) { return cmul(subResp(t.sub, f), lr4('lp', t.signal === 'lfe' ? 120 : t.xo, f)); }
/** The chain to the main speakers when bass is managed: tower roll-off × high-pass at the crossover. */
function mainChain(f, t = state.tune) { return cmul(sos('hp', 38, 0.8, f), lr4('hp', t.xo, f)); }
/** Response of the EQ filters. */
function eqResp(filters, f) { let r = [1, 0]; for (const q of filters || []) r = cmul(r, peq(q.f, q.g, q.q, f)); return r; }
