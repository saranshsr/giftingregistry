// Gift Registry bottom sheet (v2, blue) + hero lottie.
// Tap (or auto-open) -> scrim fades in and the sheet rises on the noon MOVE spring -> the hero lottie starts 120 ms
// later (holding frame 0 while the sheet travels: the closed box hasn't sprung up yet) -> columns cascade left to right
// (illustration pop, number pop, copy rise, divider draw) -> Continue rises. Timings: motion.js, generated with the
// AE preview by v2/gen/sheet_motion.py. Tap the scrim to close (iOS ease, 360 ms); tap the screen or Replay to reopen.
(() => {
  const $ = (id) => document.getElementById(id);
  const M = window.MOTION;
  const layer = $('layer'), sheet = $('sheet');
  const Q = new URLSearchParams(location.search);
  const SPEC = Q.has('spec');
  if (SPEC) { $('dock').remove(); document.documentElement.classList.add('in-spec'); }
  const AUTO_OPEN = 600;

  const root = document.documentElement;
  function fit() {
    const vw = innerWidth, vh = (window.visualViewport ? visualViewport.height : innerHeight);
    const mobile = Q.has('rec') || (!SPEC && vw <= 600 && matchMedia('(pointer: coarse), (max-width: 480px)').matches);
    root.classList.toggle('is-mobile', mobile);
    let s = mobile ? Math.min(vw / 375, vh / 812) : Math.min(1, (vw - 24) / 375, (vh - 32) / 812);
    if (SPEC) s = 1;
    $('screen').style.setProperty('--scale', s);
    $('phone').style.setProperty('--pw', 375 * s + 'px');
    $('phone').style.setProperty('--ph', 812 * s + 'px');
  }
  addEventListener('resize', fit);
  if (window.visualViewport) visualViewport.addEventListener('resize', fit);
  fit();

  const setD = (sel, ms) => document.querySelector(sel).style.setProperty('--d', ms + 'ms');
  M.cols.forEach((c, i) => {
    const k = i + 1;
    setD('.c' + k + ' .ico', c.icon.t);
    setD('.c' + k + ' .num', c.num.t);
    setD('.c' + k + ' .txt', c.text.t);
    if (c.div) setD('.d' + k, c.div.t);
  });
  setD('.cta', M.button.t);

  if (lottie.setLocationHref) lottie.setLocationHref('');
  const hero = lottie.loadAnimation({ container: $('hero'), renderer: 'svg', loop: false, autoplay: false, path: M.lottie.file,
    rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } });

  let heroTimer = 0, openTimer = 0, resetTimer = 0;
  function reset() { clearTimeout(heroTimer); clearTimeout(resetTimer); sheet.classList.remove('in'); hero.goToAndStop(0, true); }
  function open() {
    if (layer.classList.contains('open')) return;
    reset();
    void sheet.offsetWidth;
    layer.classList.add('open');
    sheet.classList.add('in');
    heroTimer = setTimeout(() => hero.goToAndPlay(0, true), M.lottie.t);
  }
  function close() {
    if (!layer.classList.contains('open')) return;
    layer.classList.remove('open');
    clearTimeout(heroTimer);
    resetTimer = setTimeout(() => { hero.pause(); sheet.classList.remove('in'); }, 420);
  }
  function replay() {
    clearTimeout(openTimer);
    if (layer.classList.contains('open')) { close(); openTimer = setTimeout(open, 480); } else open();
  }

  $('scrim').addEventListener('click', close);
  $('hot').addEventListener('click', open);
  if ($('replay')) $('replay').addEventListener('click', replay);

  window.proto = { open, close, replay, hero, M, ready: () => hero.isLoaded };
  if (!SPEC) openTimer = setTimeout(open, AUTO_OPEN);
})();
