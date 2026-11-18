/*
 * "My Lists" account widget with the Gift Lists teaser sequence (Figma: Component 225, states 01–05).
 * Built from element PNGs in assets/mylists/. Positions are pt inside the 169.5 × 136 card.
 *
 *   const w = createMyListsWidget({ base: 'assets/mylists/', onTap });
 *   container.appendChild(w.el);
 *   w.play();          // runs 01 → 05 once (page-load sequence)
 *   w.play({ loop: true });
 *   w.setState('s03'); // jump to a state without animating
 *   w.to('s04');       // animate from the current state to another
 *   w.arrive('s03');   // everything but the badge jumps (a card carrying the same art and copy has just landed on it)
 */
(function () {
  const CARD = { w: 169.5, h: 136 };

  // Thumbnails are exported unrotated (state 02). Fan centres/angles are measured from Figma's state-05 render
  // (metadata x/y of rotated layers is their rotated origin, not their centre).
  const THUMB = { w: 49.5, h: 65.5, stack: { x: 31.625, y: 91.5 } };
  const FAN = [
    { x: 33.88, y: 93.12, r: -4 },
    { x: 73.25, y: 91.62, r: 0 },
    { x: 111.62, y: 92.25, r: 2 },
    { x: 150.88, y: 92.25, r: -2 },
    { x: 189.24, y: 91.5, r: 0 },
  ];

  // Promo art sits at its state-03 placement; `hide` parks it just below the card in 02/04.
  // Travel is kept short (just clear of the card) so the rise reads as one soft motion, not a jump.
  // `lag` staggers the layers when they rise in; array order is the Figma stacking order (bouquet in front of the big box).
  // The big box uses a green-ribbon / sage-wrap recolour of the Figma export (obj-a.png is the original).
  const PROMO = [
    { name: 'glow-1', x: -27, y: 38, w: 145, h: 144, hide: { dx: -0.68, dy: 107.24, s: 0.618 }, lag: 0 },
    { name: 'glow-2', x: 52, y: -2, w: 220, h: 220, hide: { dx: -45.16, dy: 108, s: 0.618 }, lag: 20 },
    { name: 'palm', x: 64.75, y: 47.8, w: 101.5, h: 139, hide: { dx: 0, dy: 110, s: 0.85 }, lag: 50 },
    { name: 'lamp', x: 96, y: 48, w: 74, h: 104.5, hide: { dx: 0, dy: 108, s: 0.8 }, lag: 80 },
    { name: 'obj-a-green', x: 17, y: 55.5, w: 93, h: 93.5, hide: { dx: 0, dy: 104, s: 0.8 }, lag: 140 },
    { name: 'obj-b', x: 5, y: 83, w: 91, h: 103, hide: { dx: 0, dy: 74, s: 0.8 }, lag: 110 },
    { name: 'obj-c', x: 65.5, y: 81, w: 69, h: 69.5, hide: { dx: 0, dy: 76, s: 0.8 }, lag: 170 },
  ];

  const TEXT = [
    { name: 'title-mylists', x: 13, y: 15, w: 55, h: 14.5 },
    { name: 'title-giftlists', x: 12.5, y: 15, w: 61, h: 11.5 },
    { name: 'sub-mylists', x: 12, y: 37, w: 108.5, h: 8.5 },
    { name: 'sub-giftlists', x: 12.5, y: 37, w: 127.5, h: 10.5 },
    { name: 'badge', x: 75, y: 12, w: 38, h: 18 },
  ];

  // Per-state values: gift = Gift Lists copy + promo, badge = NEW visible, fan = thumbnails spread, thumbs = opacity
  const STATES = {
    s01: { gift: false, badge: false, fan: true, thumbs: 1 },
    s02: { gift: false, badge: false, fan: false, thumbs: 1 },
    s03: { gift: true, badge: true, fan: false, thumbs: 0 },
    s04: { gift: false, badge: true, fan: false, thumbs: 1 },
    s05: { gift: false, badge: true, fan: true, thumbs: 1 },
  };

  // Hold times follow the screen recording (ms after page load); motion durations are longer and springier
  const SEQUENCE = [
    { at: 800, to: 's02' },
    { at: 1400, to: 's03' },
    { at: 4700, to: 's04' },
    { at: 5350, to: 's05' },
  ];
  const LOOP_GAP = 2400;

  // Damped-spring easing sampled into CSS linear(); zeta sets the bounce (0.68 ≈ 5% overshoot, 0.5 ≈ 16%)
  function spring(zeta, span = 9) {
    const wd = Math.sqrt(1 - zeta * zeta), pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = (span * i) / 40;
      const x = 1 - Math.exp(-zeta * t) * (Math.cos(wd * t) + (zeta / wd) * Math.sin(wd * t));
      pts.push(i === 40 ? 1 : +x.toFixed(4));
    }
    return `linear(${pts.join(', ')})`;
  }
  const hasLinear = typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', 'linear(0, 1)');
  const EASE = {
    soft: hasLinear ? spring(0.68) : 'cubic-bezier(0.34, 1.25, 0.64, 1)',
    pop: hasLinear ? spring(0.5) : 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    // fast curve: arrives by half-time with a ~4% overshoot, no long settling tail
    snap: hasLinear ? spring(0.72, 7) : 'cubic-bezier(0.25, 1.15, 0.5, 1)',
    out: 'cubic-bezier(0.22, 1, 0.36, 1)',
    // smooth in-out with a gentle start, used for layers leaving with the flow
    glide: 'cubic-bezier(0.45, 0.05, 0.2, 1)',
  };

  const css = `
    .ml-card { position: absolute; width: ${CARD.w}px; height: ${CARD.h}px; border-radius: 12px; background: #fff;
      overflow: hidden; isolation: isolate; padding: 0; border: 0; cursor: pointer; -webkit-tap-highlight-color: transparent;
      transition: transform .18s cubic-bezier(0.2, 0.9, 0.1, 1); }
    .ml-card:active { transform: scale(0.97); }
    .ml-card img { position: absolute; display: block; pointer-events: none; user-select: none; -webkit-user-drag: none;
      transform-origin: 50% 50%; will-change: transform, opacity; backface-visibility: hidden; }
    .ml-card .ml-shimmer { position: absolute; pointer-events: none; opacity: 0;
      background: linear-gradient(105deg, transparent 35%, rgba(255, 255, 255, 0.95) 50%, transparent 65%) no-repeat;
      background-size: 300% 100%; background-position: 100% 0;
      -webkit-mask-size: 100% 100%; mask-size: 100% 100%; }
    /* same pink NEW pill as the gift list card in the Create sheet (.gl-new) */
    .ml-card .ml-new { position: absolute; height: 18px; padding: 0 6px; border-radius: 6px; box-sizing: border-box;
      background: linear-gradient(90deg, #ff4f7b, #e8175d); color: #fff; box-shadow: 0 2px 6px rgba(232, 23, 93, .25);
      font: 700 10px/18px Figtree, -apple-system, system-ui, sans-serif; letter-spacing: .04em;
      transform-origin: 0 50%; will-change: transform, opacity; pointer-events: none; }`;

  function injectCss() {
    if (document.getElementById('ml-css')) return;
    const s = document.createElement('style');
    s.id = 'ml-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // `text` swaps a text image for another copy: { 'title-giftlists': { src, w, h } }; `giftShift` is how far
  // the NEW badge glides right while the (wider) Gift Lists title shows
  // `softBadge`: the NEW badge fades in smoothly instead of popping with a bounce
  window.createMyListsWidget = function ({ base = 'assets/mylists/', onTap, text = {}, giftShift = 5, softBadge = false } = {}) {
    injectCss();
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'ml-card';
    el.title = 'My Lists';
    const layers = {};

    const box = t => ({ ...t, ...text[t.name] });
    const add = (name, box) => {
      const i = new Image();
      i.src = box.src || base + name + '.png';
      i.alt = '';
      i.draggable = false;
      Object.assign(i.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
      el.appendChild(i);
      layers[name] = i;
      return i;
    };

    PROMO.forEach(p => add(p.name, p));
    TEXT.filter(t => t.name !== 'badge').forEach(t => add(t.name, box(t)));
    const badgeBox = TEXT.find(t => t.name === 'badge');
    const badge = document.createElement('span');
    badge.className = 'ml-new';
    badge.textContent = 'NEW';
    Object.assign(badge.style, { left: badgeBox.x + 'px', top: badgeBox.y + 'px' });
    el.appendChild(badge);
    layers.badge = badge;
    // Highlight that sweeps across the "Gift Lists" letters; masked by the title PNG so only the glyphs light up
    const giftTitle = box(TEXT.find(t => t.name === 'title-giftlists'));
    const shimmer = document.createElement('div');
    shimmer.className = 'ml-shimmer';
    const mask = `url(${giftTitle.src || base + 'title-giftlists.png'})`;
    Object.assign(shimmer.style, {
      left: giftTitle.x + 'px', top: giftTitle.y + 'px', width: giftTitle.w + 'px', height: giftTitle.h + 'px',
      webkitMaskImage: mask, maskImage: mask,
    });
    el.appendChild(shimmer);
    let shimmerAnim = null;
    const runShimmer = () => {
      shimmerAnim?.cancel();
      shimmerAnim = shimmer.animate(
        [
          { backgroundPosition: '100% 0', opacity: 1 },
          { backgroundPosition: '0% 0', opacity: 1 },
        ],
        { duration: 1100, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' }
      );
    };

    // first thumbnail is on top (Figma "first on top" stacking), so add them last → first
    for (let n = 5; n >= 1; n--) {
      add('thumb-' + n, { x: THUMB.stack.x - THUMB.w / 2, y: THUMB.stack.y - THUMB.h / 2, w: THUMB.w, h: THUMB.h });
    }

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cur = null;

    // m = { ms, delay, ease } for transform; opacity gets its own (usually shorter) timing via `fade`
    const set = (node, transform, opacity, m, fade = m) => {
      node.style.transition = m
        ? `transform ${m.ms}ms ${m.ease} ${m.delay || 0}ms, opacity ${fade.ms}ms ${fade.ease} ${fade.delay || 0}ms`
        : 'none';
      node.style.transform = transform;
      node.style.opacity = opacity;
    };

    // instantArt: promo, thumbnails and copy take their places at once; only the badge animates
    function apply(stateId, animate = true, instantArt = false) {
      const st = STATES[stateId];
      const prev = STATES[cur] || st;
      const run = animate && !reduce && cur !== null;
      cur = stateId;
      const M = (ms, ease, delay = 0) => (run ? { ms, ease, delay } : null);

      // My Lists ⇄ Gift Lists is one continuous flow: every layer travels the same way at the same time.
      // Into Gift Lists everything moves up (old content drifts up and out, the promo rises in);
      // back to My Lists everything moves down. Outgoing and incoming overlap, so there's no empty beat.
      const promoIn = st.gift && !prev.gift, promoOut = !st.gift && prev.gift;
      const flow = promoIn ? 1 : -1; // 1 = upward, -1 = downward
      PROMO.forEach(p => {
        const h = p.hide;
        const m = instantArt ? null : promoIn ? M(900, EASE.soft, p.lag * 0.6)
          : promoOut ? M(820, EASE.glide, (170 - p.lag) * 0.25) : M(320, EASE.out);
        set(layers[p.name], st.gift ? 'none' : `translate(${h.dx}px, ${h.dy}px) scale(${h.s})`, 1, m);
      });

      // copy slides with the flow: outgoing leaves in the flow direction, incoming arrives from the other side
      const textSwap = st.gift !== prev.gift;
      // the two copies overlap in time but start 22pt apart, so one hands over to the other without smearing
      const outM = M(420, EASE.glide), outFade = M(240, EASE.out);
      const inM = M(640, EASE.soft, 60), inFade = M(360, EASE.out, 60);
      const text = (name, show) => {
        const node = layers[name];
        if (!textSwap || !run || instantArt) return set(node, 'none', show ? 1 : 0, null);
        if (!show) return set(node, `translateY(${-11 * flow}px)`, 0, outM, outFade);
        set(node, `translateY(${11 * flow}px)`, 0, null); // start on the incoming side
        node.offsetWidth;
        set(node, 'none', 1, inM, inFade);
      };
      text('title-mylists', !st.gift);
      text('sub-mylists', !st.gift);
      text('title-giftlists', st.gift);
      text('sub-giftlists', st.gift);
      // once the promo has settled, a single shimmer runs across the "Gift Lists" title
      // (not when a card has just landed on it: that title already had its shimmer)
      if (st.gift && !prev.gift && run && !instantArt) timers.push(setTimeout(runShimmer, 950));
      if (!st.gift) shimmerAnim?.cancel();

      // NEW badge pops in with a little bounce; "Gift Lists" is wider, so it glides 5pt right while that shows
      const badgeT = `${st.gift ? `translateX(${giftShift}px) ` : ''}scale(${st.badge ? 1 : softBadge ? 0.92 : 0.6})`;
      const appear = st.badge && !prev.badge;
      const badgeM = appear ? (softBadge ? M(420, EASE.out, 200) : M(620, EASE.pop, 240)) : M(520, softBadge ? EASE.glide : EASE.soft, textSwap ? 80 : 0);
      set(layers.badge, badgeT, st.badge ? 1 : 0, badgeM, appear ? (softBadge ? M(360, EASE.out, 200) : M(200, EASE.out, 240)) : badgeM);

      // thumbnails: fan out left → right, gather right → left; when the promo takes over they ride the same
      // flow (drift up and out going in, drop back in from above coming back)
      const fanChange = st.fan !== prev.fan;
      const hiding = !st.thumbs && prev.thumbs, showing = st.thumbs && !prev.thumbs;
      FAN.forEach((f, i) => {
        const node = layers['thumb-' + (i + 1)];
        const pos = st.fan ? `translate(${f.x - THUMB.stack.x}px, ${f.y - THUMB.stack.y}px) rotate(${f.r}deg)` : '';
        const away = st.thumbs ? '' : ' translateY(-22px) scale(0.92)';
        let m, fade;
        if (fanChange) {
          m = st.fan ? M(620, EASE.snap, i * 32) : M(500, EASE.snap, (4 - i) * 20);
          fade = M(240, EASE.out);
        } else if (hiding) {
          m = M(560, EASE.glide); fade = M(420, EASE.out, 40);
        } else if (showing) {
          m = M(680, EASE.soft, 140); fade = M(380, EASE.out, 140);
        } else {
          m = fade = M(320, EASE.out);
        }
        if (instantArt) m = fade = null;
        set(node, (pos + away).trim() || 'none', st.thumbs, m, fade);
      });
    }

    let timers = [];
    const clear = () => { timers.forEach(clearTimeout); timers = []; };

    function play({ loop = false } = {}) {
      clear();
      apply('s01', false);
      el.offsetWidth; // commit the reset before transitions start
      for (const step of SEQUENCE) timers.push(setTimeout(() => apply(step.to), step.at));
      if (loop) {
        const end = SEQUENCE[SEQUENCE.length - 1];
        timers.push(setTimeout(() => play({ loop }), end.at + 900 + LOOP_GAP));
      }
    }

    el.addEventListener('click', e => { e.stopPropagation(); onTap?.(); });
    apply('s01', false);

    return {
      el, play, stop: clear, size: CARD,
      setState: id => { clear(); apply(id, false); }, // jump
      to: id => { clear(); apply(id); },             // animate from the current state
      arrive: id => { clear(); apply(id, true, true); },
      // the promo art layers at their state-03 places (card pt), for a larger copy of the card to reuse
      promo: () => PROMO.map(p => ({ src: layers[p.name].src, x: p.x, y: p.y, w: p.w, h: p.h })),
      // the Gift Lists title and subtitle as placed in state 03
      giftCopy: () => ['title-giftlists', 'sub-giftlists'].map(n => ({ src: layers[n].src, ...box(TEXT.find(t => t.name === n)) })),
    };
  };
})();
