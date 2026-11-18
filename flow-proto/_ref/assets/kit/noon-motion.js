/*
 * noon motion standard for the prototype pages (from the noon-ui-skill repo, .claude/skills/noon-motion,
 * assets/noon_sas_motion.js). Plain script: exposes window.NM.
 *
 *   MOVE  anything that changes position, size or scale: Spring(300, 28) = stiffness 280.6, damping 27.14
 *         (ω 16.75, ζ 0.81), 544 ms, 1.3 % overshoot. One spring for push, sheet, rows, cards, chips, scale.
 *   FADE  opacity in: ease-out cubic 200 ms (300 reveal, 400 scrim); out: in-out cubic 200 ms.
 *   STAGGER 60 ms in (top→bottom), 40 ms out (bottom→top). TRAVEL rows 20, cards 16, headings 10.
 *   PRESS 0.96 controls, 0.98 wide rows / CTAs; press-in fast, release on the spring.
 *   Task UI never bounces visibly (ζ ≥ 0.8); rewards (like, pop) may use ζ 0.45–0.55.
 */
(function () {
  const SPRING = {
    noon: { w: 16.751, z: 0.81 },     // every movement
    soft: { w: 16.751, z: 0.868 },    // Spring(300, 30): radius, page drops
    ret: { w: 15.5, z: 1 },           // return from a held offset
    reward: { w: 20, z: 0.45 },       // heart fill, like (rewards only)
    pop: { w: 14.96, z: 0.52 },       // badge / coin pop (rewards only)
  };
  const EASE = {
    fadeIn: 'cubic-bezier(0.33, 1, 0.68, 1)',
    fadeOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    soft: 'cubic-bezier(0.22, 1, 0.36, 1)',
    ios: 'cubic-bezier(0.32, 0.72, 0, 1)',     // sheet close 280 ms
    shake: 'cubic-bezier(0.36, 0.07, 0.19, 0.97)',
  };
  const T = { move: 544, fade: 200, reveal: 300, ground: 400, staggerIn: 60, staggerOut: 40, micro: 20, follow: 100, sheetClose: 280 };

  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function springAt(t, { w, z }, x0 = 1, v0 = 0) {
    if (z < 1) {
      const wd = w * Math.sqrt(1 - z * z);
      return Math.exp(-z * w * t) * (x0 * Math.cos(wd * t) + ((v0 + z * w * x0) / wd) * Math.sin(wd * t));
    }
    return Math.exp(-w * t) * (x0 + (v0 + w * x0) * t);
  }
  // seconds until visually done (0.02 px) for a travel of d px
  const settle = (d, s = SPRING.noon) => Math.max(0.2, Math.log(Math.max(Math.abs(d), 0.02) / 0.02) / (Math.min(s.z, 1) * s.w) + 0.05);
  // CSS / WAAPI linear() easing sampled from a spring at rest
  function linear(s = SPRING.noon, ms = T.move, stops = 40) {
    const v = [];
    for (let i = 0; i <= stops; i++) v.push(i === stops ? 1 : +(1 - springAt((i / stops) * ms / 1000, s)).toFixed(4));
    return `linear(${v.join(', ')})`;
  }
  const supportsLinear = CSS.supports('animation-timing-function', 'linear(0, 1)');
  const MOVE = supportsLinear ? linear(SPRING.noon, T.move) : 'cubic-bezier(0.2, 0.9, 0.1, 1)';
  const REWARD_MS = 620, POP_MS = 600;
  const REWARD = supportsLinear ? linear(SPRING.reward, REWARD_MS) : 'cubic-bezier(0.3, 1.5, 0.5, 1)';
  const POP = supportsLinear ? linear(SPRING.pop, POP_MS) : 'cubic-bezier(0.3, 1.4, 0.5, 1)';

  // WAAPI helpers. All of them start from the element's current state when given only the end (interruptible)
  const run = (el, frames, opts) => el.animate(frames, { fill: 'both', ...opts }).finished.catch(() => {});
  const move = (el, frames, { delay = 0, ms = T.move } = {}) =>
    run(el, frames, { duration: reduced() ? 1 : ms, delay: reduced() ? 0 : delay, easing: MOVE });
  const fade = (el, to, { delay = 0, ms = T.fade, from } = {}) => {
    const start = from ?? +getComputedStyle(el).opacity;
    return run(el, [{ opacity: start }, { opacity: to }], {
      duration: reduced() ? Math.min(ms, 200) : ms, delay: reduced() ? 0 : delay, easing: to > start ? EASE.fadeIn : EASE.fadeOut,
    });
  };
  // arrive as content: small rise + fade, on MOVE / FADE IN
  const arrive = (el, { y = 16, delay = 0, scale } = {}) => Promise.all([
    move(el, [{ transform: `translateY(${y}px)${scale ? ` scale(${scale})` : ''}` }, { transform: 'none' }], { delay }),
    fade(el, 1, { from: 0, delay, ms: T.fade }),
  ]);
  // replaced in place (label / photo / bar state): old lifts 5 px + blurs out 160 ms, new rises 5 px + sharpens in 260 ms at +40
  function replace(oldEl, newEl) {
    if (reduced()) { oldEl?.remove(); return Promise.resolve(); }
    oldEl && run(oldEl, [{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translateY(-5px)', filter: 'blur(2px)' }],
      { duration: 160, easing: EASE.fadeOut }).then(() => oldEl.remove());
    return run(newEl, [{ opacity: 0, transform: 'translateY(5px)', filter: 'blur(2px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
      { duration: 260, delay: 40, easing: EASE.fadeIn }).then(() => newEl.getAnimations().forEach(a => a.cancel()));
  }
  // selection / hotspot press dip: 1 → 0.96 → 1 over 340 ms
  const dip = (el, k = 0.96) => run(el, [{ transform: 'none' }, { transform: `scale(${k})`, offset: 0.3 }, { transform: 'none' }],
    { duration: reduced() ? 1 : 340, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'none' });
  // error: decaying 4 / 3 / 2 / 1 px shake, 340 ms
  const shake = el => run(el, [{ transform: 'none' }, { transform: 'translateX(-4px)', offset: 0.18 }, { transform: 'translateX(3px)', offset: 0.4 },
    { transform: 'translateX(-2px)', offset: 0.62 }, { transform: 'translateX(1px)', offset: 0.82 }, { transform: 'none' }],
    { duration: reduced() ? 1 : 340, easing: EASE.shake, fill: 'none' });

  // haptics: native bridge → Android vibrate → nothing (one per beat, 40 ms merge window)
  const VIBE = { tap: 12, tick: 8, soft: 10, land: 10, pop: 18, medium: 18, success: [14, 50, 22], error: [45, 40, 45, 40, 45] };
  let lastAt = 0;
  function haptic(kind = 'tap') {
    const now = performance.now();
    if (now - lastAt < 40) return;
    lastAt = now;
    const bridge = window.webkit?.messageHandlers?.haptic;
    if (bridge) return bridge.postMessage({ type: kind === 'tap' ? 'light' : kind });
    if (navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate(VIBE[kind] ?? 12);
  }

  window.NM = { SPRING, EASE, T, MOVE, REWARD, REWARD_MS, POP, POP_MS, reduced, springAt, settle, linear, move, fade, arrive, replace, dip, shake, haptic };
})();
