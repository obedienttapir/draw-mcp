// Builds the single-file app from src/.
//   node build.mjs            -> index.html (complete page, open it in a browser)
//   node build.mjs --fragment -> also writes dist/artifact.html (body-only, for hosts that add their own <html> shell)
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(root, 'src', p), 'utf8');
const THREE_VERSION = '0.160.0';

const js = readdirSync(join(root, 'src', 'js')).filter((f) => f.endsWith('.js')).sort()
  .map((f) => `// ---- ${f} ----\n${src('js/' + f)}`).join('\n');

const head = `<title>Basement Cinema Planner</title>
<meta name="description" content="Interactive 3D planner for a basement home cinema: TV alcove, L-sectional, fireplace lounge.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&family=Italiana&display=swap">
<style>
${src('styles.css')}
</style>
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/"
} }
</script>`;

const body = `${src('body.html')}
<script type="module">
${js}
</script>`;

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
</head>
<body>
${body}
</body>
</html>
`;
writeFileSync(join(root, 'index.html'), page);
console.log(`index.html  ${(page.length / 1024).toFixed(1)} KB`);

if (process.argv.includes('--fragment')) {
  mkdirSync(join(root, 'dist'), { recursive: true });
  const frag = `${head}\n${body}\n`;
  writeFileSync(join(root, 'dist', 'artifact.html'), frag);
  console.log(`dist/artifact.html  ${(frag.length / 1024).toFixed(1)} KB`);
}
