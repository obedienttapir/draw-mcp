// Renders for the printed design review: every collection x meaningful view x lighting, the fireplace-wall options,
// the TV wall, furnished plans, and the numbers the review quotes. Usage: node render.cjs path/to/index.html [name-regex]
const { start, configure, shoot, WORK } = require('./lib.cjs');
const fs = require('fs'), path = require('path');
const OUT = path.join(WORK, 'renders'); fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[3] ? new RegExp(process.argv[3]) : null;

const V = {
  room:   { view: [222, 14, 68, 40, 120, 30] },                 // stair foot, whole room: fireplace, lounge, TV alcove
  fire:   { view: [212, 122, 62, 20, 50, 38] },                 // from the bar corner to the fireplace lounge
  sofa:   { view: [138, 165, 58, 170, 40, 22] },                // from the TV alcove back to the sectional
  arrive: { view: [70, -8, 62, 150, 170, 40] },                 // stair landing to the TV (clear of an arc lamp)
  back:   { view: [214, 172, 66, 20, 40, 30] },                 // TV-side corner back to the stairs and lounge
  seat:   { view: [150, 40, 40, 137, 185, 46] },                // prime seat to the screen
  fireEl: { view: [150, 60, 47, 0, 60, 47], fov: 42, items: false },   // fireplace wall, straight on, furniture hidden
  tvEl:   { view: [137, 70, 48, 137, 185, 46], fov: 46 },       // TV wall, straight on
  lounge: { view: [150, 70, 60, 0, 62, 36] },                   // fireplace lounge, wide
};
const EXPO = { work: 1.0, evening: 1.2, fireside: 1.3, game: 1.25, movie: 1.2 };
const sw = (cover, color) => ({ variant: 'swivel', cover, color, metal: 'brass' });
const CINEMA_EDIT = { sectional: { cover: 'weave', color: '#5f5a54' }, 'chair-a': sw('linen', '#cdbfa8'), 'chair-b': sw('linen', '#cdbfa8'), 'rug-main': { color: '#3d3833' } };
const COLL = { 'cinema-edit': { set: 'warm-modern', mix: CINEMA_EDIT } };
for (const id of ['warm-modern', 'mid-century', 'japandi', 'industrial', 'luxe', 'theater']) COLL[id] = { set: id };

const PROPOSAL = { transoms: 'slatted', mantel: 'slab', tvSlats: true, fireplaceSlats: true, tvScreen: true };
const ARCH = {
  asbuilt:  { transoms: 'windows', mantel: 'none', fireplaceSlats: false, tvSlats: false },
  original: { transoms: 'windows', mantel: 'none', fireplaceSlats: true, tvSlats: false },
  A:        { transoms: 'slatted', mantel: 'slab', fireplaceSlats: true },
  B:        { transoms: 'slatted', mantel: 'none', fireplaceSlats: true },
};

const jobs = [];
const add = (name, o, pr = 1.5) => jobs.push({ name, pr, ...o });
// furniture collections (proposal architecture: slats across the windows + stone slab, slats behind the TV)
for (const [cid, c] of Object.entries(COLL)) {
  const base = { ...PROPOSAL, ...c };
  add(`${cid}-room-evening`, { ...base, ...V.room, scene: 'evening' }, 2);
  for (const sc of ['work', 'fireside', 'game', 'movie']) add(`${cid}-room-${sc}`, { ...base, ...V.room, scene: sc });
  add(`${cid}-fire-fireside`, { ...base, ...V.fire, scene: 'fireside' }, 2);
  add(`${cid}-sofa-work`, { ...base, ...V.sofa, scene: 'work' });
  add(`${cid}-arrive-game`, { ...base, ...V.arrive, scene: 'game' });
  add(`${cid}-back-evening`, { ...base, ...V.back, scene: 'evening' });
  add(`${cid}-roomB-evening`, { ...base, mantel: 'none', ...V.room, scene: 'evening' });   // Option B: slats only
}
// architecture: the fireplace wall and the TV wall, furnished with the recommended collection
const ce = COLL['cinema-edit'];
for (const [k, a] of Object.entries(ARCH)) {
  const base = { ...PROPOSAL, ...ce, ...a, tvSlats: a.tvSlats ?? true };
  add(`arch-fireEl-${k}-evening`, { ...base, ...V.fireEl, scene: 'evening' }, 2);
  if (k === 'A' || k === 'B') {
    add(`arch-fireEl-${k}-work`, { ...base, ...V.fireEl, scene: 'work' });
    add(`arch-fireEl-${k}-fireside`, { ...base, ...V.fireEl, scene: 'fireside' });
    add(`arch-fire-${k}-evening`, { ...base, ...V.fire, scene: 'evening' }, 2);
    add(`arch-lounge-${k}-fireside`, { ...base, ...V.lounge, scene: 'fireside' });
  }
}
const tvBase = { ...PROPOSAL, ...ce };
add('arch-tvEl-before-game', { ...tvBase, tvSlats: false, ...V.tvEl, scene: 'game' }, 2);
for (const sc of ['game', 'evening']) add(`arch-tvEl-after-${sc}`, { ...tvBase, ...V.tvEl, scene: sc, ...(sc === 'evening' ? { exposure: 1.8 } : {}) }, sc === 'game' ? 2 : 1.5);
add('arch-seat-movie', { ...tvBase, ...V.seat, scene: 'movie' }, 2);
add('arch-seat-game', { ...tvBase, ...V.seat, scene: 'game' }, 2);

(async () => {
  const app = await start(process.argv[2]);
  const t0 = Date.now(); let n = 0;
  for (const j of jobs) {
    if (only && !only.test(j.name)) continue;
    const t = Date.now();
    await configure(app.page, { ...j, exposure: j.exposure ?? EXPO[j.scene] });
    const bytes = await shoot(app.page, path.join(OUT, j.name + '.jpg'), { pr: j.pr, q: 0.93 });
    n++; console.log(`${j.name} ${Date.now() - t}ms ${Math.round(bytes / 1365)}KB`);
  }
  // furnished plans (orthographic, on paper) for every collection, plus the overlay data once
  if (!only || only.test('plan')) {
    await app.page.setViewportSize({ width: 1100, height: 1100 });
    await app.page.waitForTimeout(500);
    for (const [cid, c] of Object.entries(COLL)) {
      await configure(app.page, { ...PROPOSAL, ...c, ...V.room, scene: 'work', exposure: 1.0 });
      const data = await app.page.evaluate(() => window.__cinema.planShot({ cx: 114, cy: 53, scale: 0.34, bg: '#f3efe8' }));
      if (cid === 'cinema-edit') fs.writeFileSync(path.join(OUT, 'plan-data.json'), JSON.stringify(data, null, 1));
      await shoot(app.page, path.join(OUT, `plan-${cid}.png`), { pr: 2, type: 'image/png' });
      await app.page.evaluate(() => window.__cinema.endPlanShot());
      n++; console.log('plan', cid);
    }
  }
  // the study numbers, with the recommended mix applied
  await configure(app.page, { ...PROPOSAL, ...ce, ...V.room, scene: 'evening' });
  fs.writeFileSync(path.join(OUT, 'study.json'), JSON.stringify(await app.page.evaluate(() => window.__cinema.studyData()), null, 1));
  // the recommended scheme as a layout code for the planner (Layout code > Apply pasted code), with the overlays back on
  fs.writeFileSync(path.join(OUT, 'layout-cinema-edit.json'), await app.page.evaluate(() => {
    const st = JSON.parse(JSON.stringify(window.__cinema.state()));
    st.showSightline = true; st.light.bias = true;
    return JSON.stringify(st, null, 1);
  }));
  // viewing figures from the prime seat: the TV (screen up) and the drop-down screen (down)
  const extra = {};
  for (const [k, scene] of [['tv', 'game'], ['screen', 'movie']]) {
    await configure(app.page, { ...PROPOSAL, ...ce, ...V.room, scene });
    extra[k] = await app.page.evaluate(() => { const r = window.__cinema.planShot({ cx: 114, cy: 53, scale: 0.34 }); window.__cinema.endPlanShot(); return r.stats; });
  }
  fs.writeFileSync(path.join(OUT, 'extra.json'), JSON.stringify(extra, null, 1));
  console.log(`done: ${n} images in ${Math.round((Date.now() - t0) / 1000)}s`);
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
