// GR FTUX (from sheet-illos/gen/render.mjs): renders ../export/gr-ftux-explainer.json and the .lottie's inner json with lottie-web
// in headless Chrome at the verify frames. usage: FR=6,12,.. node render.mjs [canvas|svg] -> ../verify/lw_<renderer>/<base>__<json|lottie>__f<N>.png
import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process';
import { createRequire } from 'module';
const require = createRequire('/Users/ssrawat/claude/india-reel/node_modules/');
const puppeteer = require('puppeteer-core');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const EXP = path.join(HERE, '..', 'export'), VER = path.join(HERE, '..', 'verify');
const R = process.argv[2] || 'canvas';
const OUT = path.join(VER, 'lw_' + R); fs.mkdirSync(OUT, { recursive: true });
export const FRAMES = [6, 12, 18, 24, 30, 36, 45, 60, 75, 90, 120, 150, 180, 210, 240, 270, 300, 329];
const FR = process.env.FR ? process.env.FR.split(',').map(Number) : FRAMES;
const W = 1053, H = 1252;
const lw = fs.readFileSync('/Users/ssrawat/claude/duo-fullscreen-sheet/node_modules/lottie-web/build/player/lottie.min.js', 'utf8');
function readLottie(f) {
  return execSync(`python3 -c "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);n=[x for x in z.namelist() if x.startswith('animations/')][0];sys.stdout.write(z.read(n).decode())" "${f}"`, { maxBuffer: 1 << 28 }).toString();
}
const jobs = [];
for (const f of fs.readdirSync(EXP).sort()) { if (!/^gr-ftux-explainer\.(json|lottie)$/.test(f)) continue; const kind = f.endsWith('.json') ? 'json' : 'lottie';
  jobs.push({ base: 'gr-ftux-explainer', kind, data: kind === 'json' ? fs.readFileSync(path.join(EXP, f), 'utf8') : readLottie(path.join(EXP, f)) }); }
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage(); await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.setContent(`<html><body style="margin:0;background:transparent"><div id="c" style="width:${W}px;height:${H}px"></div></body></html>`);
await page.addScriptTag({ content: lw });
for (const j of jobs) {
  const n = await page.evaluate(async (data, R) => {
    const el = document.getElementById('c'); el.innerHTML = ''; if (window.anim) window.anim.destroy();
    window.anim = lottie.loadAnimation({ container: el, renderer: R, loop: false, autoplay: false, animationData: JSON.parse(data), rendererSettings: { clearCanvas: true, preserveAspectRatio: 'none' } });
    await new Promise(r => window.anim.addEventListener('DOMLoaded', r)); await new Promise(r => setTimeout(r, 800)); return window.anim.totalFrames;
  }, j.data, R);
  for (const fr of FR) {
    await page.evaluate(async fr => { window.anim.goToAndStop(fr, true); await new Promise(r => setTimeout(r, 60)); }, fr);
    fs.writeFileSync(path.join(OUT, `${j.base}__${j.kind}__f${fr}.png`), await page.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: W, height: H } }));
  }
  console.log(j.base, j.kind, n);
}
await browser.close();
