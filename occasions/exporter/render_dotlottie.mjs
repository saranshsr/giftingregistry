// Renders hero .lottie files with dotLottie (ThorVG wasm, the player the app uses) at the verify frames, to catch what
// lottie-web forgives (precomps, image raster paths). Adapted from sheet-illos/gen/render_dotlottie.mjs (20 Nov 2026).
// usage: node render_dotlottie.mjs [substr ...]   (default: one hero per screen)
//   -> exporter/lw_thorvg<_TAG>/<base>__lottie__f<N>.png ; compare: TAG=icons python3 diff.py thorvg
import fs from 'fs'; import path from 'path'; import http from 'http';
import { createRequire } from 'module';
const require = createRequire('/Users/ssrawat/claude/india-reel/node_modules/');
const puppeteer = require('puppeteer-core');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const EXP = process.env.EXP_DIR || path.join(HERE, '..', 'export');
const DL = '/Users/ssrawat/claude/gifting-registry-lottie/sheet-illos/verify/blendtest/dl';     // dotlottie-web build (from gr-kit)
const OUT = path.join(HERE, 'lw_thorvg' + (process.env.LW_TAG ? '_' + process.env.LW_TAG : '')); fs.mkdirSync(OUT, { recursive: true });
const FR = (process.env.FR ? process.env.FR.split(',').map(Number) : [27, 45, 60, 96, 203]);
const PICK = process.argv.slice(2).length ? process.argv.slice(2) : ['1-1-occasion-default', '1-1-occasion-birthday', '1-3-when-is-it-birthday',
  '1-4-delivery-details-birthday', '2-3-whose-is-it-birthday', '2-5-due-date-baby-shower', 'name-your-registry-birthday'];
const PAGE = `<!doctype html><html><body style="margin:0;background:transparent">
<canvas id="dl" width="1125" height="528" style="width:1125px;height:528px;display:block"></canvas>
<script type="module">
import { DotLottie } from './dl/index.js';
DotLottie.setWasmUrl(new URL('./dl/dotlottie-player.wasm', location.href).href);
window.load = async (src) => {
  if (window.p) window.p.destroy();
  window.p = new DotLottie({ canvas: document.getElementById('dl'), src, autoplay: false, loop: false, renderConfig: { devicePixelRatio: 1 } });
  await new Promise(r => window.p.addEventListener('load', r)); return window.p.totalFrames;
};
window.frame = async (f) => { window.p.setFrame(f); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); await new Promise(r => setTimeout(r, 80)); };
window.ready = true;
</script></body></html>`;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.lottie': 'application/zip' };
const files = {};
for (const dir of fs.readdirSync(EXP).sort()) { const dp = path.join(EXP, dir); if (!fs.statSync(dp).isDirectory() || dir.startsWith('_')) continue;
  for (const f of fs.readdirSync(dp)) if (f.endsWith('.lottie') && PICK.some(p => f.includes(p))) files[f] = path.join(dp, f); }
const srv = http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/dl.html') { s.writeHead(200, { 'Content-Type': 'text/html' }); return s.end(PAGE); }
  const f = u.startsWith('/export/') ? files[u.slice(8)] : (u.startsWith('/dl/') ? path.join(DL, u.slice(4)) : null);
  if (!f || !fs.existsSync(f)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s);
}).listen(0, '127.0.0.1');
await new Promise(r => srv.on('listening', r));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage(); await page.setViewport({ width: 1125, height: 528, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${srv.address().port}/dl.html`); await page.waitForFunction('window.ready === true');
for (const f of Object.keys(files).sort()) {
  const base = f.replace('.lottie', ''); const n = await page.evaluate(s => window.load(s), '/export/' + f);
  for (const fr of FR) { await page.evaluate(x => window.frame(x), fr);
    await page.screenshot({ path: path.join(OUT, `${base}__lottie__f${fr}.png`), omitBackground: true, clip: { x: 0, y: 0, width: 1125, height: 528 } }); }
  console.log(base, 'frames', n);
}
await browser.close(); srv.close();
