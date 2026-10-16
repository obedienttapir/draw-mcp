// Prints the composed review to a 17 x 11 in PDF with Chromium. Usage: node print.cjs review.html review.pdf
const { chromium } = require('./lib.cjs').playwright();
const path = require('path');
(async () => {
  const [src, out] = [path.resolve(process.argv[2]), path.resolve(process.argv[3])];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text()); });
  page.on('requestfailed', (r) => console.log('FAILED', r.url()));
  await page.goto('file://' + src, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const missing = await page.evaluate(() => [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src));
  if (missing.length) console.log('missing images', missing);
  // flag any content that overflows its page or its box
  const over = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('.page').forEach((p, i) => {
      const pr = p.getBoundingClientRect();
      p.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width && (r.bottom > pr.bottom + 0.5 || r.right > pr.right + 0.5) && !el.closest('.cover,.divider,.copen') && getComputedStyle(el).position !== 'absolute') bad.push(`p${i + 1} ${el.tagName}.${el.className}`);
      });
    });
    return [...new Set(bad)].slice(0, 40);
  });
  if (over.length) console.log('overflow:', over.join(' | '));
  await page.pdf({ path: out, width: '17in', height: '11in', printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log('wrote', out);
})().catch((e) => { console.error(e); process.exit(1); });
