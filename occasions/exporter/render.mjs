// Renders every export (.json and .lottie inner json) with lottie-web (canvas or svg) in headless Chrome at the 5 verify frames.
// usage: node render.mjs [canvas|svg]  -> exporter/lw_<renderer>/<base>__<json|lottie>__f<N>.png
import fs from 'fs'; import path from 'path'; import zlib from 'zlib'; import { execSync } from 'child_process';
import { createRequire } from 'module';
const require = createRequire('/Users/ssrawat/claude/india-reel/node_modules/');
const puppeteer = require('puppeteer-core');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const EXP = path.join(HERE, '..', 'export');
const R = process.argv[2] || 'canvas';
const ONLY = process.argv[3] || '';
const OUT = path.join(HERE, 'lw_' + R + (process.env.LW_TAG ? '_' + process.env.LW_TAG : '')); fs.mkdirSync(OUT, { recursive: true });   // LW_TAG=icons -> lw_canvas_icons
const FR = (process.env.FR ? process.env.FR.split(",").map(Number) : [27, 45, 60, 96, 203]);
const lw = fs.readFileSync('/Users/ssrawat/claude/duo-fullscreen-sheet/node_modules/lottie-web/build/player/lottie.min.js', 'utf8');
function readLottie(f) { // minimal zip reader (deflate) via python for robustness
  const out = execSync(`python3 -I -c "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);n=[x for x in z.namelist() if x.startswith('animations/')][0];sys.stdout.write(z.read(n).decode())" "${f}"`, { maxBuffer: 1 << 28 });
  return out.toString();
}
const jobs = [];
for (const dir of fs.readdirSync(EXP).sort()) { const dp = path.join(EXP, dir); if (!fs.statSync(dp).isDirectory()) continue;
  for (const f of fs.readdirSync(dp).sort()) { if (ONLY && !f.includes(ONLY)) continue; const base = f.replace(/\.(json|lottie)$/, ''); const kind = f.endsWith('.json') ? 'json' : 'lottie';
    jobs.push({ base, kind, data: kind === 'json' ? fs.readFileSync(path.join(dp, f), 'utf8') : readLottie(path.join(dp, f)) }); } }
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await browser.newPage(); await page.setViewport({ width: 1125, height: 528, deviceScaleFactor: 1 });
await page.setContent(`<html><body style="margin:0;background:transparent"><div id="c" style="width:1125px;height:528px"></div></body></html>`);
await page.addScriptTag({ content: lw });
for (const j of jobs) {
  const ok = await page.evaluate(async (data, R) => {
    const el = document.getElementById('c'); el.innerHTML = ''; if (window.anim) window.anim.destroy();
    window.anim = lottie.loadAnimation({ container: el, renderer: R, loop: false, autoplay: false, animationData: JSON.parse(data), rendererSettings: { clearCanvas: true, preserveAspectRatio: 'none' } });
    await new Promise(r => { window.anim.addEventListener('DOMLoaded', r); });
    // wait for images
    await new Promise(r => setTimeout(r, 500));
    return window.anim.totalFrames;
  }, j.data, R);
  for (const fr of FR) {
    await page.evaluate(async (fr) => { window.anim.goToAndStop(fr, true); await new Promise(r => setTimeout(r, 60)); }, fr);
    const png = await page.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: 1125, height: 528 } });
    fs.writeFileSync(path.join(OUT, `${j.base}__${j.kind}__f${fr}.png`), png);
  }
  console.log(j.base, j.kind, ok);
}
await browser.close();
