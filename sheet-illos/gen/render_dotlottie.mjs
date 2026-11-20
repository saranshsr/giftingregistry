// Renders ../export/*.lottie with dotLottie (ThorVG wasm, @lottiefiles/dotlottie-web copied from gr-kit) at the verify frames
// -> ../verify/dl_thorvg/<base>__lottie__f<N>.png  (compare with diff.py thorvg)
import fs from 'fs'; import path from 'path'; import http from 'http';
import { createRequire } from 'module';
const require = createRequire('/Users/ssrawat/claude/india-reel/node_modules/');
const puppeteer = require('puppeteer-core');
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const BT = path.join(ROOT, 'verify', 'blendtest'), EXP = path.join(ROOT, 'export'), OUT = path.join(ROOT, 'verify', 'lw_thorvg');
fs.mkdirSync(OUT, { recursive: true });
const FR = (process.env.FR ? process.env.FR.split(',').map(Number) : [4, 8, 12, 16, 20, 24, 32, 40, 48, 60, 66, 70, 120, 180, 240, 275]);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.lottie': 'application/zip' };
const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = u.startsWith('/export/') ? path.join(EXP, u.slice(8)) : path.join(BT, u);
  if (!fs.existsSync(f)) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); }).listen(0, '127.0.0.1');
await new Promise(r => srv.on('listening', r));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage(); await page.setViewport({ width: 600, height: 360, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${srv.address().port}/dl.html`); await page.waitForFunction('window.ready === true');
for (const f of fs.readdirSync(EXP).filter(x => x.endsWith('.lottie')).sort()) {
  const base = f.replace('.lottie', ''); const n = await page.evaluate(s => window.load(s), '/export/' + f);
  for (const fr of FR) { await page.evaluate(x => window.frame(x), fr);
    await page.screenshot({ path: path.join(OUT, `${base}__lottie__f${fr}.png`), omitBackground: true, clip: { x: 0, y: 0, width: 600, height: 360 } }); }
  console.log(base, 'frames', n);
}
await browser.close(); srv.close();
