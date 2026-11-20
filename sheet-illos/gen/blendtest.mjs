// Overlay-vs-baked cloud check: renders the one-layer test lotties (verify/blendtest) over the glow backdrop with
// lottie-web canvas, lottie-web svg and dotLottie (ThorVG wasm), then diff.py-style compares with the Figma overlay look.
import fs from 'fs'; import path from 'path'; import http from 'http';
import { createRequire } from 'module';
const require = createRequire('/Users/ssrawat/claude/india-reel/node_modules/');
const puppeteer = require('puppeteer-core');
const BT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'verify', 'blendtest');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.lottie': 'application/zip' };
const srv = http.createServer((q, s) => { const f = path.join(BT, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f)) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); }).listen(0, '127.0.0.1');
await new Promise(r => srv.on('listening', r)); const port = srv.address().port;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage(); await page.setViewport({ width: 600, height: 360, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
await page.goto(`http://127.0.0.1:${port}/page.html`); await page.waitForFunction('window.ready === true');
for (const card of ['collection', 'registry']) for (const tag of ['overlay', 'baked']) for (const r of ['canvas', 'svg', 'dotlottie']) {
  await page.evaluate((a, b, c) => window.show(a, b, c), card, tag, r);
  await page.screenshot({ path: path.join(BT, `out_${card}_${tag}_${r}.png`), clip: { x: 0, y: 0, width: 600, height: 360 } });
  console.log(card, tag, r);
}
await browser.close(); srv.close();
