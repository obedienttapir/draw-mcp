// Shared helpers for the review renders: serve the built planner with a local copy of three.js (headless Chromium
// renders with SwiftShader), configure a scene, capture frames through the planner's print hooks.
const http = require('http'), fs = require('fs'), path = require('path');
const WORK = process.env.REVIEW_WORK || path.resolve(__dirname, '../.work');
const vendor = process.env.THREE_DIR || path.join(WORK, 'vendor/three/package');
function playwright() {
  for (const p of [process.env.PLAYWRIGHT, 'playwright', '/opt/node22/lib/node_modules/playwright'].filter(Boolean)) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('Playwright not found: npm i -g playwright, or set PLAYWRIGHT to its path');
}
const { chromium } = playwright();

async function start(htmlPath, { width = 1280, height = 720 } = {}) {
  const html = fs.readFileSync(htmlPath, 'utf8').replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\//g, '/three/').replace(/<link[^>]+fonts\.(googleapis|gstatic)[^>]*>/g, '');
  const srv = await new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html); }
      const f = path.join(vendor, u.replace(/^\/three\//, ''));
      if (u.startsWith('/three/') && fs.existsSync(f)) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(fs.readFileSync(f)); }
      res.writeHead(404); res.end();
    }).listen(0, () => ok(s));
  });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ' + m.text()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/`);
  await page.waitForFunction(() => window.__cinema);
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const c = window.__cinema; c.setQuality('high');
    document.querySelectorAll('.panel,.topbar,.dock,.hint,#toast,#restoreBtn,#labels').forEach((p) => p.style.display = 'none');
    c.loadOption('recommended');
    c.state().showSightline = false; c.rebuild();
    c.pause(true);
  });
  return { page, browser, srv, close: async () => { await browser.close(); srv.close(); } };
}

/** Apply one job's architecture / style / lighting / camera. Returns what changed (for logging). */
async function configure(page, job) {
  return page.evaluate((job) => {
    const c = window.__cinema, s = c.state(), f = s.finish; let arch = false;
    for (const k of ['transoms', 'mantel', 'tvSlats', 'fireplaceSlats', 'slat', 'floor', 'bayAccent'])
      if (job[k] !== undefined && f[k] !== job[k]) { f[k] = job[k]; arch = true; }
    if (job.tvScreen !== undefined && s.tv.screen !== job.tvScreen) { s.tv.screen = job.tvScreen; arch = true; }
    if (job.speakers !== undefined && s.showSpeakers !== job.speakers) { s.showSpeakers = job.speakers; arch = true; }
    if (arch) c.rebuild();
    let styled = false;
    if (job.set && (s.style.set !== job.set || job.mix || s.items.some((i) => i.s))) { c.setStyle(job.set); styled = true; }
    if (job.mix) {                                  // per-piece overrides on top of the set
      for (const [id, o] of Object.entries(job.mix)) { const it = s.items.find((i) => i.id === id); if (it) it.s = { ...o }; }
      c.rebuild(); styled = true;
    }
    c.showItems(job.items !== false);
    s.light.bias = job.bias ?? (job.scene === 'movie' || job.scene === 'game');
    s.light.bloom = job.bloom ?? job.scene !== 'work';     // no bloom haze on pale surfaces under full pot lights
    c.applyScene(job.scene || 'evening');
    c.settle();
    c.view(...job.view, job.fov || 50);
    c.exposure(job.exposure ?? 1.05);
    return { arch, styled };
  }, job);
}

async function shoot(page, file, { pr = 2, type = 'image/jpeg', q = 0.94, flameT = 3.7 } = {}) {
  await page.evaluate((pr) => window.__cinema.pixelRatio(pr), pr);
  const url = await page.evaluate(([type, q, t]) => window.__cinema.capture(type, q, t), [type, q, flameT]);
  if (!url || url.length < 100) throw new Error('empty capture for ' + file);
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  return url.length;
}

module.exports = { start, configure, shoot, playwright, WORK };
