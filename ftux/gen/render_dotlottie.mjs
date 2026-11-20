// GR FTUX (from sheet-illos/gen/render_dotlottie.mjs): renders ../export/gr-ftux-explainer.lottie with dotLottie (ThorVG wasm,
// @lottiefiles/dotlottie-web copied from gr-kit via sheet-illos) -> ../verify/lw_thorvg/<base>__lottie__f<N>.png (diff.py thorvg)
import fs from 'fs'; import path from 'path'; import http from 'http';
import { createRequire } from 'module';
const require = createRequire('/Users/ssrawat/claude/india-reel/node_modules/');
const puppeteer = require('puppeteer-core');
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const BT = path.join(ROOT, 'verify', 'dlharness'), EXP = path.join(ROOT, 'export'), OUT = path.join(ROOT, 'verify', 'lw_thorvg');
fs.mkdirSync(OUT, { recursive: true });
const FR = process.env.FR ? process.env.FR.split(',').map(Number) : [6, 12, 18, 24, 30, 36, 45, 60, 75, 90, 120, 150, 180, 210, 240, 270, 300, 329];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.lottie': 'application/zip' };
const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = u.startsWith('/export/') ? path.join(EXP, u.slice(8)) : path.join(BT, u);
  if (!fs.existsSync(f)) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); }).listen(0, '127.0.0.1');
await new Promise(r => srv.on('listening', r));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage(); await page.setViewport({ width: 1053, height: 1252, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${srv.address().port}/dl.html`); await page.waitForFunction('window.ready === true');
const base = 'gr-ftux-explainer'; const n = await page.evaluate(s => window.load(s), `/export/${base}.lottie`);
for (const fr of FR) { await page.evaluate(x => window.frame(x), fr);
  await page.screenshot({ path: path.join(OUT, `${base}__lottie__f${fr}.png`), omitBackground: true, clip: { x: 0, y: 0, width: 1053, height: 1252 } }); }
console.log(base, 'frames', n);
await browser.close(); srv.close();
