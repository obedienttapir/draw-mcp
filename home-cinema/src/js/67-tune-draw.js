// ===================================================================
// 67 · Cinema tuning: canvas charts and the overlays drawn in the room (the bass map on the floor,
// seats with their level, subwoofers, planned treatment, speakers and reflection points).
// ===================================================================
const CH_INK = { grid: 'rgba(232,214,190,0.08)', axis: 'rgba(232,214,190,0.35)', text: '#a99c8a', bg: '#151210' };
/** Size a canvas for its CSS box and return a 2D context in CSS pixels. */
function chartCtx(cv) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth || parseFloat(cv.style.width) || 600, H = cv.clientHeight || parseFloat(cv.style.height) || 220;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = CH_INK.bg; c.fillRect(0, 0, W, H);
  c.font = '10.5px "IBM Plex Mono", ui-monospace, monospace'; c.textBaseline = 'middle';
  return { c, W, H };
}
/** Axes for a log-frequency chart. Returns mapping functions. */
function freqAxes(c, W, H, { f0 = 15, f1 = 200, y0, y1, ystep = 5, unit = 'dB', pad = [36, 10, 8, 20] }) {
  const [l, r, t, b] = pad, X = (f) => l + (W - l - r) * Math.log(f / f0) / Math.log(f1 / f0), Y = (v) => t + (H - t - b) * (1 - (v - y0) / (y1 - y0));
  c.strokeStyle = CH_INK.grid; c.lineWidth = 1; c.fillStyle = CH_INK.text;
  for (let v = Math.ceil(y0 / ystep) * ystep; v <= y1; v += ystep) { c.beginPath(); c.moveTo(l, Y(v)); c.lineTo(W - r, Y(v)); c.stroke(); c.textAlign = 'right'; c.fillText(`${v}`, l - 5, Y(v)); }
  for (const f of [20, 30, 40, 50, 60, 80, 100, 150, 200].filter((q) => q >= f0 && q <= f1)) { c.beginPath(); c.moveTo(X(f), t); c.lineTo(X(f), H - b); c.stroke(); c.textAlign = 'center'; c.fillText(String(f), X(f), H - b + 11); }
  c.textAlign = 'left'; c.fillText(unit, 4, t + 4);
  return { X, Y, l, r, t, b, inv: (px) => f0 * (f1 / f0) ** ((px - l) / (W - l - r)) };
}
function polyline(c, xs, ys, X, Y, color, width = 1.4, dash = null) {
  c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash || []); c.beginPath();
  xs.forEach((x, i) => { const px = X(x), py = Y(ys[i]); if (i) c.lineTo(px, py); else c.moveTo(px, py); }); c.stroke(); c.setLineDash([]);
}
/** Hover readout and click-to-pick on a frequency chart. */
function attachHover(cv, tip, onPick) {
  cv.addEventListener('pointermove', (e) => {
    if (!cv._ax || !cv._read) return; const r = cv.getBoundingClientRect(), x = e.clientX - r.left;
    if (x < cv._ax.l) { tip.classList.remove('on'); return; }
    const f = cv._ax.inv(x); tip.innerHTML = cv._read(f); tip.classList.add('on');
    tip.style.left = `${clamp(x + 12, 0, r.width - 150)}px`; tip.style.top = '6px';
  });
  cv.addEventListener('pointerleave', () => tip.classList.remove('on'));
  cv.addEventListener('click', (e) => { if (!cv._ax) return; const r = cv.getBoundingClientRect(); const f = cv._ax.inv(e.clientX - r.left); if (f >= 15 && f <= 200) onPick(f); });
}
function drawResponse(cv, tip, V) {
  const { c, W, H } = chartCtx(cv), F = V.ctx.F, t = state.tune, sm = (d) => smoothDb(d, TV.smooth);
  const series = V.resp.map((r) => sm(r.db)), mean = sm(V.m.mean);
  const all = series.flat ? [].concat(...series.map((s) => Array.from(s))) : [];
  const hi = Math.ceil((Math.max(...all) + 3) / 5) * 5, lo = Math.max(hi - 45, Math.floor((Math.min(...all) - 2) / 5) * 5);
  const ax = freqAxes(c, W, H, { y0: lo, y1: hi });
  // target band ±3 dB around the level
  c.fillStyle = 'rgba(214,164,99,0.10)'; c.beginPath();
  F.forEach((f, i) => { const y = ax.Y(V.m.level + targetAt(f) + 3); if (i) c.lineTo(ax.X(f), y); else c.moveTo(ax.X(f), y); });
  for (let i = F.length - 1; i >= 0; i--) c.lineTo(ax.X(F[i]), ax.Y(V.m.level + targetAt(F[i]) - 3)); c.closePath(); c.fill();
  const [b0, b1] = bassBand(); c.fillStyle = 'rgba(255,255,255,0.03)'; c.fillRect(ax.l, ax.t, ax.X(b0) - ax.l, H - ax.t - ax.b); c.fillRect(ax.X(b1), ax.t, W - ax.r - ax.X(b1), H - ax.t - ax.b);
  V.resp.forEach((r, i) => { if (!r.seat.mlp) polyline(c, F, series[i], ax.X, ax.Y, seatColor(r.seat, i) + (r.seat.main || t.allSeats ? 'cc' : '44'), 1.1); });
  const mi = V.resp.findIndex((r) => r.seat.mlp); if (mi >= 0) polyline(c, F, series[mi], ax.X, ax.Y, '#d6a463', 2.2);
  polyline(c, F, mean, ax.X, ax.Y, '#efe6d8', 1.4, [5, 4]);
  if (!TV.band) { c.strokeStyle = 'rgba(239,230,216,0.5)'; c.beginPath(); c.moveTo(ax.X(TV.f), ax.t); c.lineTo(ax.X(TV.f), H - ax.b); c.stroke(); }
  cv._ax = ax;
  cv._read = (f) => { const i = Math.min(F.length - 1, Math.max(0, Math.round(AC.ppo * Math.log2(f / F[0])))); return `<b>${fmtF(F[i])}</b>` + V.resp.map((r, k) => `<span style="color:${seatColor(r.seat, k)}">${r.seat.label} ${series[k][i].toFixed(1)}</span>`).join('') + `<span>avg ${mean[i].toFixed(1)} dB</span>`; };
}
function drawWaterfall(cv, V) {
  const { c, W, H } = chartCtx(cv), mlp = V.ctx.seats.find((s) => s.mlp) || V.ctx.seats[0];
  const ir = bassImpulse(V.ctx, V.subs, mlp, V.eq.length ? V.eq : null);
  const F = logFreqs(15, 200, 24), sl = waterfall(ir, F, Array.from({ length: 12 }, (_, i) => i * 20), 0.3);
  const top = Math.max(...sl[0].db), n = sl.length, dx = Math.min(6, (W - 80) * 0.28 / n), dy = 8;
  const ax = { l: 36, r: 10 + dx * n, t: 10 + dy * n, b: 20 }, X = (f) => ax.l + (W - ax.l - ax.r) * Math.log(f / 15) / Math.log(200 / 15), Y = (v) => ax.t + (H - ax.t - ax.b) * (1 - (v - (top - 30)) / 32);
  c.fillStyle = CH_INK.text; c.textAlign = 'center';
  for (const f of [20, 30, 50, 80, 100, 150, 200]) c.fillText(String(f), X(f), H - 9);
  c.textAlign = 'right'; for (let v = 0; v >= -30; v -= 10) c.fillText(String(v), ax.l - 5, Y(top + v));
  for (let k = n - 1; k >= 0; k--) {
    const ox = dx * k, oy = -dy * k, s = sl[k], a = 1 - k / n;
    c.beginPath(); c.moveTo(X(F[0]) + ox, Y(top - 30) + oy);
    F.forEach((f, i) => c.lineTo(X(f) + ox, Y(Math.max(top - 30, s.db[i])) + oy));
    c.lineTo(X(F[F.length - 1]) + ox, Y(top - 30) + oy); c.closePath();
    c.fillStyle = CH_INK.bg; c.fill();
    c.strokeStyle = `rgba(${Math.round(lerp(120, 214, a))},${Math.round(lerp(150, 164, a))},${Math.round(lerp(190, 99, a))},${0.35 + 0.65 * a})`; c.lineWidth = k === 0 ? 1.8 : 1.1; c.stroke();
  }
  c.fillStyle = CH_INK.text; c.textAlign = 'left'; c.fillText(`0 → ${sl[n - 1].t} ms`, W - ax.r + 6, ax.t - 4);
}
function drawDecay(cv) {
  const { c, W, H } = chartCtx(cv), d = TA.decay, n = d.length, l = 36, b = 20, t = 10, r = 10;
  const ymax = Math.max(1, ...d.map((q) => q.t60 || 0)) * 1.1, Y = (v) => t + (H - t - b) * (1 - v / ymax), bw = (W - l - r) / n;
  c.strokeStyle = CH_INK.grid; c.fillStyle = CH_INK.text;
  for (let v = 0; v <= ymax; v += 0.2) { c.beginPath(); c.moveTo(l, Y(v)); c.lineTo(W - r, Y(v)); c.stroke(); c.textAlign = 'right'; c.fillText(v.toFixed(1), l - 5, Y(v)); }
  c.textAlign = 'left'; c.fillText('s', 4, t + 4);
  d.forEach((q, i) => {
    const x = l + i * bw, tg = decayTarget(q.fc, TA.rt.rtMid);
    if (q.t60) { c.fillStyle = q.t60 > tg + 0.1 ? '#e07a62' : q.t60 > tg ? '#e2b55a' : '#8fbf8a'; c.fillRect(x + bw * 0.2, Y(q.t60), bw * 0.6, Y(0) - Y(q.t60)); }
    c.strokeStyle = '#efe6d8'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(x + 2, Y(tg)); c.lineTo(x + bw - 2, Y(tg)); c.stroke(); c.setLineDash([]);
    c.fillStyle = CH_INK.text; c.textAlign = 'center'; c.fillText(String(q.fc), x + bw / 2, H - 9);
  });
}
function drawSweep(cv) {
  const { c, W, H } = chartCtx(cv), s = TA.sweep, pts = s.pts, l = 36, r = 10, t = 10, b = 20;
  const ymax = Math.ceil(Math.max(...pts.map((p) => Math.max(p.flat, p.ssv))) + 1), X = (o) => l + (W - l - r) * (o + 42) / 84, Y = (v) => t + (H - t - b) * (1 - v / ymax);
  c.fillStyle = 'rgba(255,255,255,0.05)'; for (const p of pts) if (!p.fits) c.fillRect(X(p.off) - (W - l - r) / 56, t, (W - l - r) / 28, H - t - b);
  c.strokeStyle = CH_INK.grid; c.fillStyle = CH_INK.text;
  for (let v = 0; v <= ymax; v += 2) { c.beginPath(); c.moveTo(l, Y(v)); c.lineTo(W - r, Y(v)); c.stroke(); c.textAlign = 'right'; c.fillText(`±${v}`, l - 5, Y(v)); }
  c.textAlign = 'center'; for (const o of [-36, -24, -12, 0, 12, 24, 36]) c.fillText(o === 0 ? 'now' : `${o > 0 ? '+' : ''}${o}″`, X(o), H - 9);
  polyline(c, pts.map((p) => p.off), pts.map((p) => p.ssv), X, Y, '#7fb3d5', 1.4);
  polyline(c, pts.map((p) => p.off), pts.map((p) => p.flat), X, Y, '#d6a463', 2);
  if (s.best) { c.fillStyle = '#8fbf8a'; c.beginPath(); c.arc(X(s.best.off), Y(s.best.flat), 4.5, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = '#efe6d8'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(X(0), t); c.lineTo(X(0), H - b); c.stroke(); c.setLineDash([]);
}
function drawRT(cv, rt) {
  const { c, W, H } = chartCtx(cv), n = OCT.length, l = 36, r = 10, t = 10, b = 20, bw = (W - l - r) / n;
  const ymax = Math.max(0.8, ...rt.bands.map((q) => Math.max(q.eyring, q.sabine))) * 1.1, Y = (v) => t + (H - t - b) * (1 - v / ymax);
  c.strokeStyle = CH_INK.grid; c.fillStyle = CH_INK.text;
  for (let v = 0; v <= ymax; v += 0.2) { c.beginPath(); c.moveTo(l, Y(v)); c.lineTo(W - r, Y(v)); c.stroke(); c.textAlign = 'right'; c.fillText(v.toFixed(1), l - 5, Y(v)); }
  c.textAlign = 'left'; c.fillText('s', 4, t + 4);
  rt.bands.forEach((q, i) => {
    const x = l + i * bw, tg = rtTarget(q.f);
    c.fillStyle = 'rgba(214,164,99,0.12)'; c.fillRect(x + 2, Y(tg.hi), bw - 4, Y(tg.lo) - Y(tg.hi));
    c.fillStyle = q.eyring > tg.hi ? '#e2b55a' : q.eyring < tg.lo ? '#7fb3d5' : '#d6a463'; c.fillRect(x + bw * 0.25, Y(q.eyring), bw * 0.5, Y(0) - Y(q.eyring));
    c.fillStyle = '#efe6d8'; c.beginPath(); c.arc(x + bw / 2, Y(q.sabine), 3, 0, Math.PI * 2); c.fill();
    c.fillStyle = CH_INK.text; c.textAlign = 'center'; c.fillText(OCT_LABEL[i], x + bw / 2, H - 9);
  });
}
function drawETC(cv, list) {
  const { c, W, H } = chartCtx(cv), l = 36, r = 10, t = 10, b = 20, xmax = 40, X = (ms) => l + (W - l - r) * ms / xmax, Y = (v) => t + (H - t - b) * (-v / 30);
  c.fillStyle = 'rgba(224,122,98,0.13)'; c.fillRect(X(0), Y(0), X(15) - X(0), Y(-10) - Y(0));
  c.strokeStyle = CH_INK.grid; c.fillStyle = CH_INK.text;
  for (let v = 0; v >= -30; v -= 5) { c.beginPath(); c.moveTo(l, Y(v)); c.lineTo(W - r, Y(v)); c.stroke(); c.textAlign = 'right'; c.fillText(String(v), l - 5, Y(v)); }
  c.textAlign = 'center'; for (let ms = 0; ms <= xmax; ms += 5) c.fillText(`${ms}`, X(ms), H - 9);
  c.textAlign = 'left'; c.fillText('dB', 4, t + 4); c.textAlign = 'right'; c.fillText('ms', W - 4, H - 9);
  const stem = (ms, v, col, label) => { c.strokeStyle = col; c.lineWidth = 2.2; c.beginPath(); c.moveTo(X(ms), Y(-30)); c.lineTo(X(ms), Y(Math.max(-30, v))); c.stroke(); c.fillStyle = col; c.beginPath(); c.arc(X(ms), Y(Math.max(-30, v)), 3, 0, Math.PI * 2); c.fill(); if (label) { c.fillStyle = CH_INK.text; c.textAlign = 'left'; c.fillText(label, X(ms) + 5, Y(Math.max(-30, v)) - 7); } };
  stem(0, 0, '#d6a463', 'direct');
  list.forEach((q) => { if (q.delay <= xmax) stem(q.delay, q.level, q.delay < 15 && q.level > -10 ? '#e07a62' : q.treated ? '#8fbf8a' : '#7fb3d5', q.surface); });
}

// ---------------- the overlays in the room ----------------
const MAP_STOPS = [[-15, [27, 42, 74]], [-9, [47, 111, 143]], [-4, [95, 179, 165]], [0, [233, 227, 201]], [4, [232, 168, 92]], [10, [200, 85, 61]]];
function mapColor(v) {
  if (v <= MAP_STOPS[0][0]) return MAP_STOPS[0][1];
  for (let i = 1; i < MAP_STOPS.length; i++) if (v <= MAP_STOPS[i][0]) { const [a, ca] = MAP_STOPS[i - 1], [b, cb] = MAP_STOPS[i], u = (v - a) / (b - a); return ca.map((x, k) => x + (cb[k] - x) * u); }
  return MAP_STOPS[MAP_STOPS.length - 1][1];
}
/** Pressure (complex) at every cell for the given subs at frequency f, height z. */
function fieldAt(S, damp, subs, f, z) {
  const g = S.grid, V = g.N * acM(g.g) ** 2 * acM(g.H), k = 2 * Math.PI * f / AC.c, k2 = k * k;
  const cm = S.modes2.map(() => [0, 0]);
  const srcs = subs.map((s) => ({ c: acCoef(S, s.x, s.y, AC.subZ), w: subW(s, f) }));
  S.modes3.forEach((md, n) => {
    const a = md.lam - k2, b = 2 * k * damp[n] / AC.c, d = V * md.L * (a * a + b * b), ir = a / d, ii = -b / d;
    let sr = 0, si = 0; for (const s of srcs) { sr += s.c[n] * s.w[0]; si += s.c[n] * s.w[1]; }
    const vz = Math.cos(md.nz * Math.PI * z / g.H), pr = (sr * ir - si * ii) * vz, pi = (sr * ii + si * ir) * vz;
    cm[md.m][0] += pr; cm[md.m][1] += pi;
  });
  const re = new Float32Array(g.N), im = new Float32Array(g.N);
  S.modes2.forEach((md, m) => { const [a, b] = cm[m]; if (!a && !b) return; for (let i = 0; i < g.N; i++) { re[i] += md.psi[i] * a; im[i] += md.psi[i] * b; } });
  return { re, im };
}
/** dB relative to the room average (cinema cells) for one frequency or a band. */
function mapDb(S, damp, subs, z) {
  const g = S.grid, pw = new Float64Array(g.N);
  const fs = TV.band ? logFreqs(20, 80, 12) : [TV.f];
  for (const f of fs) { const { re, im } = fieldAt(S, damp, subs, f, z); for (let i = 0; i < g.N; i++) pw[i] += re[i] * re[i] + im[i] * im[i]; }
  let m = 0, n = 0; for (let i = 0; i < g.N; i++) if (g.room[i]) { m += pw[i]; n++; }
  const ref = m / n, out = new Float32Array(g.N); for (let i = 0; i < g.N; i++) out[i] = 10 * Math.log10(pw[i] / ref + 1e-12);
  return out;
}
/** Paint per-cell values onto a canvas texture covering the grid (bilinear, with contour lines). */
function paintGrid(S, val, colorOf, contour = 3) {
  const g = S.grid, sc = 8, W = g.nx * sc, H = g.ny * sc;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), img = c.createImageData(W, H), d = img.data;
  const at = (i, j) => { if (i < 0 || j < 0 || i >= g.nx || j >= g.ny) return null; const k = g.id[j * g.nx + i]; return k < 0 ? null : val[k]; };
  const band = new Int16Array(W * H).fill(-999);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const fx = (px + 0.5) / sc - 0.5, fy = (H - py - 0.5) / sc - 0.5, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    const self = at(Math.round(fx), Math.round(fy)); if (self == null) continue;
    let s = 0, w = 0;
    for (const [di, dj, ww] of [[0, 0, (1 - u) * (1 - v)], [1, 0, u * (1 - v)], [0, 1, (1 - u) * v], [1, 1, u * v]]) { const q = at(i + di, j + dj); if (q != null) { s += q * ww; w += ww; } }
    const val2 = w ? s / w : self, [r, gg, b] = colorOf(val2), o = (py * W + px) * 4;
    d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 218; band[py * W + px] = Math.floor(val2 / contour);
  }
  if (contour) for (let py = 1; py < H; py++) for (let px = 1; px < W; px++) {
    const k = py * W + px, a = band[k]; if (a === -999) continue;
    if ((band[k - 1] !== -999 && band[k - 1] !== a) || (band[k - W] !== -999 && band[k - W] !== a)) { const o = k * 4; d[o] *= 0.55; d[o + 1] *= 0.55; d[o + 2] *= 0.55; d[o + 3] = 240; }
  }
  c.putImageData(img, 0, 0);
  return cv;
}
const TUNE_LINE = new THREE.LineBasicMaterial({ color: '#7fb3d5', transparent: true, opacity: 0.6, depthTest: false });
/** Rebuild everything the tuning studio draws in the room for the current tab. */
function disposeTune() {
  tuneGroup.traverse((o) => { if (o.material && !o.material.isShared) { if (o.material.map) o.material.map.dispose(); if (o.material !== TUNE_LINE) o.material.dispose(); } });
  disposeGroup(tuneGroup); invalidate(2);
}
function drawTuneOverlay() {
  disposeTune();
  if (!TV.open || !ACS || !TA) return;
  const S = ACS, g = S.grid, plan = mode === 'plan', ctx = TA.ctx, subs = previewOrCurrent();
  const top = plan ? state.room.ceiling + 6 : null;
  const addLabel = (text, pos, cls) => { const el = document.createElement('div'); const inner = document.createElement('div'); inner.className = cls; inner.textContent = text; el.append(inner); const o = new CSS2DObject(el); o.position.copy(pos); tuneGroup.add(o); return inner; };
  // floor map: bass (overview, bass) or a mode shape (modes)
  let vals = null, color = mapColor, contour = 3;
  if (TV.tab === 'modes' && TV.modeSel != null) {
    const md = S.modes3[TV.modeSel], psi = S.modes2[md.m].psi, mx = Math.max(...Array.from(psi, Math.abs));
    vals = Float32Array.from(psi, (v) => v / mx); contour = 0;
    color = (v) => (Math.abs(v) < 0.04 ? [240, 236, 226] : v > 0 ? mapColor(lerp(0, 10, v)) : mapColor(lerp(0, -15, -v)));
  } else if (TV.tab === 'bass' || TV.tab === 'overview') vals = mapDb(S, ctx.damp, subs, AC.ear);
  if (vals) {
    const tex = new THREE.CanvasTexture(paintGrid(S, vals, color, contour)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const w = g.nx * g.g, hh = g.ny * g.g;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: !plan, opacity: plan ? 0.82 : 0.85, toneMapped: false }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.copy(P(g.x0 + w / 2, g.y0 + hh / 2, plan ? state.room.ceiling + 2 : 0.7)); mesh.renderOrder = plan ? 30 : 2; mesh.userData.noShadow = true;
    tuneGroup.add(mesh);
    // seat values
    if (TV.tab !== 'modes') {
      const probe = (x, y) => { const pr = acProbe(g, x, y); let s = 0; for (const [k, w2] of pr) s += w2 * vals[k]; return s; };
      ctx.seats.forEach((s) => { const v = probe(s.x, s.y), txt = sgn(v, 0) || '0'; addLabel(s.mlp ? `MLP ${txt}` : txt, P(s.x, s.y, plan ? top : AC.ear + 4), 'dim tseat' + (s.mlp ? ' mlp' : '') + (v < -6 ? ' null' : v > 4 ? ' peak' : '')).title = s.label; });
    }
  }
  // subwoofers
  if (TV.tab === 'bass' || TV.tab === 'overview' || TV.tab === 'modes') subs.forEach((s, i) => addLabel(`SW${i + 1}${TV.preview ? '?' : ''}`, P(s.x, s.y, plan ? top : 18), 'dim tsub'));
  // planned treatment (outlines)
  const t = state.tune, mat = new THREE.MeshBasicMaterial({ color: '#d6a463', transparent: true, opacity: 0.28, depthWrite: false });
  const edge = new THREE.LineBasicMaterial({ color: '#d6a463', transparent: true, opacity: 0.9 });
  const box = (x, y, z, w, d, hh, rotY = 0) => { const geo = new THREE.BoxGeometry(w, hh, d), m = new THREE.Mesh(geo, mat); m.position.copy(P(x, y, z)); m.rotation.y = rotY; m.userData.noShadow = true; const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edge); m.add(e); tuneGroup.add(m); };
  if (TV.tab !== 'speakers') {
    for (const s of acTrapSpots().slice(0, t.traps || 0)) box(s.x, s.y, state.room.ceiling / 2, 16, 16, state.room.ceiling - 2, Math.PI / 4);
    const wallBox = (s, thick) => { const w = roomWalls().reduce((b, q) => { const d = Math.abs((s.x - q.a[0]) * q.n[0] + (s.y - q.a[1]) * q.n[1]); return d < b.d ? { d, q } : b; }, { d: Infinity }).q; if (!w) return; box(s.x + w.n[0] * thick / 2, s.y + w.n[1] * thick / 2, s.z, 24, thick, 48, Math.atan2(w.n[0], w.n[1])); };
    if (t.reflPanels) for (const s of acReflectionPanelSpots()) wallBox(s, 2);
    if (t.rearPanels) for (const s of acRearSpots()) wallBox(s, 4);
    if (t.cloud) { const m = mainSeat(); if (m) box(m.x, m.y + 20, state.room.ceiling - 4, 72, 48, 4); }
  }
  // speakers
  if (TV.tab === 'speakers' || TV.tab === 'refl') {
    const disc = new THREE.MeshBasicMaterial({ color: '#7fb3d5', depthTest: false, transparent: true, opacity: 0.95 });
    const mlp = TA.mlp, eye = P(mlp.x, mlp.y, plan ? top : AC.ear);
    for (const ch of TA.lay) {
      const pos = P(ch.p[0], ch.p[1], plan ? top : ch.z), sp = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 12), disc); sp.position.copy(pos); sp.renderOrder = 31; tuneGroup.add(sp);
      const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([eye, pos]), TUNE_LINE); ln.renderOrder = 30; tuneGroup.add(ln);
      addLabel(ch.k, pos, 'dim spk' + (ch.ok ? '' : ' bad'));
    }
    const dot = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 12), new THREE.MeshBasicMaterial({ color: '#d6a463', depthTest: false })); dot.position.copy(eye); dot.renderOrder = 31; tuneGroup.add(dot);
  }
  // reflection points of the chosen speaker
  if (TV.tab === 'refl') {
    const ch = TA.lay.find((c) => c.k === TV.reflCh) || TA.lay[0], spk = P(ch.p[0], ch.p[1], plan ? top : ch.z), eye = P(TA.mlp.x, TA.mlp.y, plan ? top : AC.ear);
    for (const q of firstReflections({ x: ch.p[0], y: ch.p[1], z: ch.z }, { x: TA.mlp.x, y: TA.mlp.y, z: AC.ear })) {
      if (q.delay > 25) continue;
      const bad = q.delay < 15 && q.level > -10, pt = P(q.x, q.y, plan ? top : q.z);
      const lm = new THREE.LineDashedMaterial({ color: bad ? '#e07a62' : '#8fbf8a', dashSize: 3, gapSize: 2, transparent: true, opacity: 0.8, depthTest: false });
      const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([spk, pt, eye]), lm); ln.computeLineDistances(); ln.renderOrder = 30; tuneGroup.add(ln);
      addLabel(`${q.surface} ${q.level.toFixed(0)} dB`, pt, 'dim trefl' + (bad ? ' bad' : ''));
    }
  }
}
