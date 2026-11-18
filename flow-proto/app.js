// Gift Registry creation flow (Figma Zs6qEAZ1Uaej4LcKst0sbp, section 843:719902 "Updated Visuals").
// Account -> My Lists (push) -> Create sheet -> "What is a Gift Registry" sheet (v2 proto) -> registry steps (modal):
// 1.1 Occasion -> 2.3 Whose <occasion> is it? -> Name your registry -> 1.3 When is it? (2.5 due date for Baby shower)
// -> 1.4 Delivery details -> back on My Lists with the new registry card at the front of the strip.
// Each step plays its occasion's hero lottie once (1.1 always plays the Default set) and holds the last frame.
// Motion values are the initial proto's (_ref/index.html: go, back, stepTo, stepOut, playStep, openSheet, closeSheet).
(() => {
  const $ = (id) => document.getElementById(id);
  const Q = new URLSearchParams(location.search);
  const root = document.documentElement;
  const PUSH_MS = 520, POP_MS = 440, SHEET_IN_MS = 460, SHEET_OUT_MS = 300;
  const EASE_OUT = 'cubic-bezier(0.2, 0.9, 0.1, 1)';
  const EASE_IN = 'cubic-bezier(0.4, 0, 0.8, 0.2)';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // touch devices type with the native keyboard; desktop shows the drawn iOS keyboard (?kb=drawn / ?kb=native to force)
  const TOUCH = Q.get('kb') === 'native' || (Q.get('kb') !== 'drawn' && matchMedia('(pointer: coarse)').matches);

  // ---------- fit the 375x812 screen (v2/proto stage) ----------
  let scale = 1;
  function fit() {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;   // never rescale under a keyboard
    const vw = innerWidth, vh = innerHeight;
    const mobile = vw <= 600 && matchMedia('(pointer: coarse), (max-width: 480px)').matches;
    root.classList.toggle('is-mobile', mobile);
    scale = mobile ? Math.min(vw / 375, vh / 812) : Math.min(1, (vw - 24) / 375, (vh - 32) / 812);
    $('screen').style.setProperty('--scale', scale);
    $('phone').style.setProperty('--pw', 375 * scale + 'px');
    $('phone').style.setProperty('--ph', 812 * scale + 'px');
  }
  addEventListener('resize', fit);
  fit();

  // ---------- helpers ----------
  function anim(el, frames, ms, easing, extra = {}) {
    if (reduceMotion) ms = 1;
    const a = el.animate(frames, { duration: ms, easing, fill: 'forwards', ...extra });
    // a hidden pane can stall the animation clock; never leave navigation locked
    setTimeout(() => { if (a.playState === 'running') a.finish(); }, ms + (extra.delay || 0) + 150);
    return a.finished.catch(() => {});
  }
  const settle = (el) => el.getAnimations().forEach((a) => { try { a.commitStyles(); } catch (e) {} a.cancel(); });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let toastTimer = 0;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    // sit above the CTA (and the keyboard, when one is up)
    const kbUp = where === 'steps' && $('kb').dataset.mode !== 'none';
    t.style.bottom = (where === 'steps' ? (kbUp ? 384 : 100) : 40) + 'px';
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 1600);
  }
  function shake(el, msg) {
    el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' },
      { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: 320, easing: 'ease-out' });
    toast(msg);
  }
  const dip = (el) => el.animate([{ transform: 'none' }, { transform: 'scale(0.96)', offset: 0.3 }, { transform: 'none' }],
    { duration: reduceMotion ? 1 : 340, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });

  // ---------- occasions + themes ----------
  // swoosh gradients per occasion = Figma board 946:196141 (same values the hero lotties were recoloured with,
  // occasions/gen/prep_occ.py). Birthday, Baby shower and Default backgrounds/accents are Figma's own values; the others
  // follow the rule Figma's two drawn themes share: bg top = mid of the swoosh stops, beams = light stop,
  // bg bottom = light stop 71% to white, accent/tints/CTA = the swoosh hue at Figma's lightness.
  const OCC = {
    eid:          { label: 'Eid-ul-fitr',   name: 'Eid ul fitr',  file: 'eid',           sw: ['ffcf8d', 'ffebd1'] },
    birthday:     { label: 'Birthday',      name: 'Birthday',     file: 'birthday',      sw: ['ff7ea9', 'ffcbdb'],
      fig: { top: 'ffa5c2', beams: ['ffcbdb', 'ffcbdb', 'ffcbdb', 'ffcbdb'], bot: 'fff0f5', accent: 'df4075', tintA: 'fff7f9', tintB: 'ffdae7', cta: ['4f0214', '83001f'] } },
    babyshower:   { label: 'Baby shower',   name: 'Baby shower',  file: 'baby-shower',   sw: ['97cfff', 'd5ebff'],
      fig: { top: 'b6ddff', beams: ['d5ebff', 'd5ebff', 'd5ebff', 'd5ebff'], bot: 'f3f9ff', accent: '4794d8', tintA: 'f8fbfe', tintB: 'e1edf9' } },
    mothersday:   { label: 'Mother’s day',  name: 'Mother’s day', file: 'other',         sw: ['ffc68d', 'ffe8d1'] },  // no own lottie set: plays Other
    wedding:      { label: 'Wedding',       name: 'Wedding',      file: 'wedding',       sw: ['ffada3', 'ffddda'] },
    housewarming: { label: 'House warming', name: 'House warming', file: 'house-warming', sw: ['ffc092', 'ffe5d3'] },
    anniversary:  { label: 'Anniversary',   name: 'Anniversary',  file: 'anniversary',   sw: ['ffada3', 'ffddda'] },
    other:        { label: 'Other',         name: 'Celebration',  file: 'other',         sw: ['ffc68d', 'ffe8d1'] },
  };
  // 1.1 tile slots (Figma 843:769332 at x28 y302)
  const TILES = [['eid', 0.5, 0], ['birthday', 110.5, 0], ['babyshower', 220.5, 0], ['mothersday', 0.5, 132],
    ['wedding', 110.5, 132], ['housewarming', 220.5, 132], ['anniversary', 55.5, 264], ['other', 165.5, 264]];

  const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const toHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  function hueOf([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return 0;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  }
  const hsl = (h, s, l) => `hsl(${h.toFixed(1)} ${s}% ${l}%)`;
  function themeOf(key) {
    const o = OCC[key];
    const s0 = hex(o.sw[0]), s1 = hex(o.sw[1]), h = hueOf(s0);
    const t = {
      top: toHex(mix(s0, s1, 0.5)), beams: Array(4).fill(toHex(s1)), bot: toHex(mix(s1, [255, 255, 255], 0.71)),
      accent: hsl(h, 68, 56), tintA: hsl(h, 90, 98.4), tintB: hsl(h, 80, 93), cta: [hsl(h, 95, 16), hsl(h, 100, 26)],
    };
    if (o.fig) for (const k in o.fig) {
      const v = o.fig[k];
      t[k] = Array.isArray(v) ? v.map((x) => '#' + x) : '#' + v;
    }
    return t;
  }
  // Default (1.1, before an occasion is picked): Figma 843:769327
  const DEFAULT_THEME = { top: '#a2c0f5', beams: ['#a2c0f5', '#a2c0f5', '#dbe8ff', '#dbe8ff'], bot: '#fff0f5',
    accent: hsl(hueOf(hex('9dbdfc')), 68, 56), tintA: '#f8fbfe', tintB: '#e1edf9', cta: ['#14161c', '#2b3140'] };

  // "Onboarding background" (Figma component 2:22802, 375x235) with the theme's colours
  let bgSeq = 0;
  function bgSVG(t) {
    const n = 'b' + (++bgSeq);
    const lg = (id, y1, y2, a, b, extra = '') =>
      `<linearGradient id="${n}${id}" x1="187.6" y1="${y1}" x2="187.6" y2="${y2}" gradientUnits="userSpaceOnUse"><stop stop-color="${a}"${extra}/><stop offset="1" stop-color="${b}"/></linearGradient>`;
    const blur = (id, x, y, w, h, s) => `<filter id="${n}${id}" x="${x}" y="${y}" width="${w}" height="${h}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${s}"/></filter>`;
    return `<svg width="375" height="235" viewBox="0 0 375 235" fill="none" xmlns="http://www.w3.org/2000/svg"><defs>
${blur('f0', -21.07, 23.58, 417.39, 196.81, 3.5)}${blur('f1', 83.66, -37.3, 207.94, 257.68, 2.5)}${blur('f2', 13.94, -41.85, 347.37, 272.61, 2.5)}
${lg('p0', 20.88, 270.23, t.top, t.bot)}${lg('p1', 40.58, 203.38, t.beams[0], '#FEFCFF')}${lg('p2', -20.3, 203.38, t.beams[1], '#FEFCFF')}
${lg('p3', 0, 188.9, t.beams[2], '#fff')}${lg('p4', 24.16, 171.49, t.beams[3], '#fff')}${lg('p5', 82.88, 187.88, '#fff', '#fff', ' stop-opacity="0"')}
<clipPath id="${n}c"><rect width="375" height="235"/></clipPath></defs>
<g clip-path="url(#${n}c)"><rect width="375" height="235" fill="url(#${n}p0)"/>
<g opacity="0.4" filter="url(#${n}f0)"><path d="M282.16 178.408L377.507 40.5803L-2.25 40.5771L93.0978 178.408C103.918 194.05 121.726 203.384 140.746 203.384H234.512C253.531 203.384 271.339 194.05 282.16 178.408Z" stroke="url(#${n}p1)" stroke-width="4"/></g>
<g opacity="0.8" filter="url(#${n}f1)"><path d="M230.664 169.099L274.085 -20.2916L101.172 -20.2959L144.593 169.098C149.192 189.161 167.045 203.384 187.629 203.384C208.212 203.384 226.065 189.161 230.664 169.099Z" stroke="url(#${n}p2)" stroke-width="4"/></g>
<g opacity="0.5" filter="url(#${n}f2)"><path d="M253.113 151.836L311.738 0.00460756L63.5195 0.000976562L122.145 151.836C130.77 174.174 152.248 188.904 176.194 188.904H199.065C223.01 188.904 244.488 174.174 253.113 151.836Z" stroke="url(#${n}p3)" stroke-width="33.71"/></g>
<g opacity="0.4"><path d="M192.009 167.197L194.935 24.162L180.32 24.1592L183.246 167.197C183.295 169.582 185.242 171.49 187.628 171.49C190.013 171.49 191.96 169.582 192.009 167.197Z" stroke="url(#${n}p4)" stroke-width="33.71"/></g>
<rect x="0.128" y="82.879" width="375" height="152.121" fill="url(#${n}p5)"/></g></svg>`;
  }

  // ---------- state ----------
  const S = { occ: null, name: '', regName: '', regEdited: false, digits: '' };
  let busy = false;
  let sheetOpen = null;            // 'drawer' | 'xp' | null
  let where = 'account';           // 'account' | 'lists' | 'steps'
  let cur = null;                  // current step id
  let field = null;                // the current step's <input>
  let fieldFocused = false;
  let nativeKb = 0;                // native keyboard height (screen pt), touch devices only

  const STEPS = {
    occ:   { lottie: '1-1-occasion',         progress: 14, kb: 'none' },
    whose: { lottie: '2-3-whose-is-it',      progress: 44, kb: 'text' },
    name:  { lottie: 'name-your-registry',   progress: 48, kb: 'text' },
    when:  { lottie: '1-3-when-is-it',       progress: 51, kb: 'num' },
    due:   { lottie: '2-5-due-date',         progress: 56, kb: 'num' },
    deliv: { lottie: '1-4-delivery-details', progress: 64, kb: 'none', home: true, cta: 'Create' },
  };
  const flow = () => ['occ', 'whose', 'name', S.occ === 'babyshower' ? 'due' : 'when', 'deliv'];
  const lottieUrl = (id) => `lottie/gr-hero-${STEPS[id].lottie}-${id === 'occ' ? 'default' : OCC[S.occ].file}.json`;

  // ---------- lottie (fetched once as text; parsed per play since lottie-web mutates its data) ----------
  if (lottie.setLocationHref) lottie.setLocationHref('');
  const cache = new Map();
  const getText = (url) => {
    if (!cache.has(url)) cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.text(); }));
    return cache.get(url);
  };
  const heroEl = $('hero');
  let hero = null, heroUrl = '', heroSeq = 0;
  function killHero(h) { if (!h) return; try { h.anim.destroy(); } catch (e) {} h.el.remove(); }
  function hideHero() {
    const h = hero;
    hero = null;
    heroSeq++;
    if (!h) return Promise.resolve();
    return anim(h.el, [{ opacity: 1 }, { opacity: 0 }], 200, EASE_IN).then(() => killHero(h));
  }
  async function playHero(url, delay) {
    const seq = ++heroSeq;
    let txt;
    try { txt = await getText(url); } catch (e) { console.error(e); return; }
    if (seq !== heroSeq) return;
    killHero(hero);
    const el = document.createElement('div');
    heroEl.appendChild(el);
    const a = lottie.loadAnimation({ container: el, renderer: 'svg', loop: false, autoplay: false, animationData: JSON.parse(txt),
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } });
    hero = { el, anim: a, url };
    heroUrl = url;
    a.goToAndStop(0, true);
    const ready = new Promise((r) => { if (a.isLoaded) r(); else { a.addEventListener('DOMLoaded', r); setTimeout(r, 600); } });
    await Promise.all([ready, wait(delay)]);
    if (hero && hero.anim === a) a.goToAndPlay(0, true);
  }

  // ---------- theme ----------
  const stepsEl = $('steps');
  let bgKey = '';
  function applyTheme(t, key) {
    const st = stepsEl.style;
    st.setProperty('--accent', t.accent); st.setProperty('--tint-a', t.tintA); st.setProperty('--tint-b', t.tintB);
    st.setProperty('--cta-a', t.cta[0]); st.setProperty('--cta-b', t.cta[1]);
    if (key === bgKey) return;
    bgKey = key;
    const bg = $('bg');
    bg.insertAdjacentHTML('beforeend', bgSVG(t));
    const fresh = bg.lastElementChild;
    const old = [...bg.children].filter((c) => c !== fresh);
    if (!old.length) return;
    fresh.style.opacity = 0;
    void fresh.getBoundingClientRect();
    fresh.style.opacity = 1;
    setTimeout(() => old.forEach((o) => o.remove()), 460);
  }
  function themeFor(step) {
    const occT = S.occ ? themeOf(S.occ) : DEFAULT_THEME;
    // 1.1 keeps the Default page (its lottie is the Default set); the picked occasion only tints the CTA + selection
    if (step === 'occ') return [{ ...DEFAULT_THEME, accent: occT.accent, cta: occT.cta }, 'default'];
    return [occT, S.occ];
  }

  // ---------- step bodies ----------
  const bodyEl = $('body');
  const part = (cls, style = '') => {
    const d = document.createElement('div');
    d.className = 'part ' + cls;
    d.dataset.part = 'body';
    if (style) d.style.cssText = style;
    return d;
  };
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function buildStep(id) {
    bodyEl.textContent = '';
    field = null;
    const wrap = document.createElement('div');
    if (id === 'occ') {
      for (const [key, x, y] of TILES) {
        const b = part('tile press', `left:${28 + x}px; top:${302 + y}px`);
        const btn = document.createElement('button');
        btn.className = 'tile';
        btn.style.cssText = 'position:absolute; inset:0';
        btn.dataset.occ = key;
        btn.setAttribute('aria-label', OCC[key].label);
        btn.innerHTML = `<p>${esc(OCC[key].label)}</p><img src="img/occ/${key}.png" alt="">`;
        btn.classList.toggle('sel', S.occ === key);
        btn.addEventListener('click', () => pickOccasion(key, btn));
        b.style.background = 'none';
        b.appendChild(btn);
        wrap.appendChild(b);
      }
    } else if (id === 'whose' || id === 'name') {
      const p = part('field', `top:${id === 'whose' ? 333 : 318}px`);
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.autocomplete = 'off';
      inp.spellcheck = false;
      inp.setAttribute('autocapitalize', 'words');
      inp.setAttribute('enterkeyhint', 'next');
      inp.maxLength = 40;
      inp.value = id === 'whose' ? S.name : S.regName;
      inp.placeholder = id === 'whose' ? 'Name' : 'Registry name';
      inp.addEventListener('input', () => {
        if (id === 'whose') { S.name = inp.value; S.regEdited = false; } else { S.regName = inp.value; S.regEdited = true; }
        updateCta();
      });
      inp.addEventListener('focus', () => { fieldFocused = true; updateFooter(); });
      inp.addEventListener('blur', () => { fieldFocused = false; setTimeout(updateFooter, 0); });
      p.appendChild(inp);
      wrap.appendChild(p);
      field = inp;
    } else if (id === 'when' || id === 'due') {
      const p = part('date');
      p.id = 'dateText';
      wrap.appendChild(p);
      const c = part('', 'left:0; top:356px; width:375px; display:flex; justify-content:center');
      c.innerHTML = '<button class="chip press" id="chip" style="position:relative; left:auto; top:auto"><span class="ico-mask" style="--m:url(img/calendar.svg)"></span>Pick from calendar</button>';
      wrap.appendChild(c);
    } else if (id === 'deliv') {
      const a = part('addr');
      a.innerHTML = `<div class="a-ico"><span class="ico-mask" style="--m:url(img/home.svg)"></span></div>
        <p class="a-t1">Home</p><p class="a-t2">676D, Downtown, Dubai</p>
        <button class="a-edit press" aria-label="Edit address"><img src="img/edit.svg" width="20" height="20" alt=""></button>
        <img class="a-dash" src="img/dash.svg" width="322" height="1" alt="">
        <p class="a-t3">${esc((S.name.trim() || 'Prasanna'))}  • +971 (0) 412 3456</p>`;
      a.querySelector('.a-edit').addEventListener('click', () => toast('Address editing isn’t in this prototype'));
      wrap.appendChild(a);
      const n = part('note');
      n.innerHTML = '<div class="n-tip"></div><div class="n-box"><b>This can’t be changed later.</b> Your address stays private.</div>';
      wrap.appendChild(n);
    }
    while (wrap.firstChild) bodyEl.appendChild(wrap.firstChild);
    if (id === 'when' || id === 'due') {
      renderDate();
      $('chip').addEventListener('click', () => {
        const d = new Date(Date.now() + 30 * 864e5);
        S.digits = String(d.getDate()).padStart(2, '0') + String(d.getMonth() + 1).padStart(2, '0') + d.getFullYear();
        renderDate();
        updateCta();
      });
    }
    $('ctaLabel').textContent = STEPS[id].cta || 'Continue';
    $('progress').style.width = STEPS[id].progress + 'px';
    updateCta();
  }

  // date: dd mm yyyy, digits typed on the numpad picture (or the physical keyboard)
  function renderDate() {
    const el = $('dateText');
    if (!el) return;
    const d = S.digits, ph = 'ddmmyyyy';
    let html = '';
    const caretAt = d.length;
    for (let i = 0; i < 8; i++) {
      if (i === caretAt) html += '<span class="caret"></span>';
      html += i < d.length ? `<span class="dg">${d[i]}</span>` : `<span class="ph">${ph[i]}</span>`;
      if (i === 1 || i === 3) html += '<span class="ph">  </span>';
    }
    if (caretAt === 8) html += '<span class="caret"></span>';
    el.innerHTML = html;
  }
  function dateValid() {
    if (S.digits.length !== 8) return false;
    const dd = +S.digits.slice(0, 2), mm = +S.digits.slice(2, 4), yy = +S.digits.slice(4);
    const dt = new Date(yy, mm - 1, dd);
    return dt.getFullYear() === yy && dt.getMonth() === mm - 1 && dt.getDate() === dd && yy >= 2000 && yy <= 2100;
  }
  function typeDigit(k) {
    if (cur !== 'when' && cur !== 'due') return;
    if (k === 'del') S.digits = S.digits.slice(0, -1);
    else if (S.digits.length < 8) S.digits += k;
    renderDate();
    updateCta();
  }
  // numpad hotspots over the Figma picture (keys measured from the 2x export)
  (function buildNumpad() {
    const pad = $('numpad');
    const cols = [7.5, 129.5, 251.5], rows = [22.5, 75, 127, 179];
    const keys = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], [null, '0', 'del']];
    rows.forEach((y, r) => cols.forEach((x, c) => {
      const k = keys[r][c];
      if (!k) return;
      const b = document.createElement('button');
      b.className = 'numkey';
      b.style.cssText = `left:${x}px; top:${y}px; width:115.5px; height:46px`;
      b.setAttribute('aria-label', k === 'del' ? 'Delete' : k);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); typeDigit(k); });
      pad.appendChild(b);
    }));
  })();

  function stepValid() {
    switch (cur) {
      case 'occ': return S.occ ? '' : 'Pick an occasion first';
      case 'whose': return S.name.trim() ? '' : 'Add a name first';
      case 'name': return S.regName.trim() ? '' : 'Give your registry a name';
      case 'when': return dateValid() ? '' : (S.digits.length === 8 ? 'Enter a valid date' : 'Add the date first');
      case 'due': return dateValid() ? '' : (S.digits.length === 8 ? 'Enter a valid date' : 'Add the due date first');
      default: return '';
    }
  }
  function updateCta() { $('cta').classList.toggle('off', !!stepValid()); }

  function pickOccasion(key, btn) {
    if (busy) return;
    if (S.occ !== key) { S.digits = ''; S.regEdited = false; }
    S.occ = key;
    bodyEl.querySelectorAll('.tile[data-occ]').forEach((t) => t.classList.toggle('sel', t === btn));
    dip(btn);
    applyTheme(...themeFor('occ'));
    updateCta();
    // warm the picked occasion's lotties so each step's hero starts on time
    flow().slice(1).forEach((id) => getText(lottieUrl(id)).catch(() => {}));
  }

  // ---------- footer / keyboards ----------
  function updateFooter() {
    if (!cur) return;
    const st = STEPS[cur];
    let mode = 'none';
    if (st.kb === 'num') mode = 'num';
    else if (st.kb === 'text' && fieldFocused && !TOUCH) mode = 'text';
    $('kb').dataset.mode = mode;
    const rest = st.home ? 272 : 296;           // CTA at y724 with the home bar (1.4) / y748 (1.1)
    let fy = mode === 'none' ? rest : 0;
    if (TOUCH && st.kb === 'text') fy = fieldFocused && nativeKb > 0 ? Math.max(0, 296 - nativeKb) : 272;
    const showHome = st.home || (TOUCH && st.kb === 'text' && !(fieldFocused && nativeKb > 0));
    $('footer').toggleAttribute('data-home', !!showHome);
    $('footer').style.setProperty('--fy', fy + 'px');
  }
  if (window.visualViewport) {
    const onVV = () => {
      const k = Math.max(0, innerHeight - visualViewport.height - visualViewport.offsetTop);
      nativeKb = k > 80 ? k / scale : 0;
      updateFooter();
    };
    visualViewport.addEventListener('resize', onVV);
    visualViewport.addEventListener('scroll', onVV);
  }
  // keep the field focused when tapping the drawn keyboard, the CTA or the back button
  ['kb', 'cta', 'back'].forEach((id) => $(id).addEventListener('mousedown', (e) => e.preventDefault()));
  // iOS raises the keyboard only for a focus made inside the tap: hold it on a stand-in field until the step is built
  function focusProxy() { if (TOUCH) $('proxy').focus({ preventScroll: true }); }
  function focusField() {
    if (!field) { if (document.activeElement === $('proxy')) $('proxy').blur(); return; }
    field.focus({ preventScroll: true });
    const n = field.value.length;
    try { field.setSelectionRange(n, n); } catch (e) {}
  }

  // ---------- steps: enter, between, back, close, finish ----------
  const bodyParts = () => [...bodyEl.querySelectorAll('[data-part="body"]')];
  function playStep(dir, delay) {
    playHero(lottieUrl(cur), delay);
    if (reduceMotion) return;
    bodyParts().forEach((n, i) => n.animate([{ opacity: 0, transform: dir ? `translateX(${28 * dir}px)` : 'translateY(14px)' },
      { opacity: 1, transform: 'none' }], { duration: 440, delay: delay + 140 + i * 40, easing: EASE_OUT, fill: 'backwards' }));
  }
  function stepOut(dir) {
    return Promise.all([hideHero(), ...bodyParts().map((n) =>
      anim(n, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-28 * dir}px)` }], 200, EASE_IN))]);
  }
  async function stepTo(id, dir) {
    busy = true;
    const wasText = STEPS[cur].kb === 'text', toText = STEPS[id].kb === 'text';
    if (!(wasText && toText) && field) field.blur();
    if (id === 'name' && !S.regEdited) S.regName = `${S.name.trim()}’s ${OCC[S.occ].name}`;
    const [t, k] = themeFor(id);
    applyTheme(t, k);
    await stepOut(dir);
    cur = id;
    buildStep(id);
    updateFooter();
    playStep(dir, 0);
    if (toText) TOUCH ? focusField() : setTimeout(() => { if (cur === id) focusField(); }, 120);
    else if (document.activeElement === $('proxy')) $('proxy').blur();
    busy = false;
  }

  async function enterSteps() {
    if (busy) return;
    busy = true;
    Object.assign(S, { occ: null, name: '', regName: '', regEdited: false, digits: '' });
    cur = 'occ';
    fieldFocused = false;
    applyTheme(...themeFor('occ'));
    buildStep('occ');
    updateFooter();
    stepsEl.classList.add('on');
    where = 'steps';
    const lists = $('lists');
    const jobs = [
      anim(stepsEl, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], PUSH_MS * 1.1, EASE_OUT),
      anim(lists, [{ '--dim': 0 }, { '--dim': 0.12 }], PUSH_MS, EASE_OUT),
    ];
    if (sheetOpen) jobs.push(closeSheet(true));
    playStep(0, PUSH_MS * 0.45);
    await Promise.all(jobs);
    settle(stepsEl);
    lists.classList.add('parked');
    busy = false;
  }

  async function closeSteps(done) {
    busy = true;
    if (field) field.blur();
    const lists = $('lists');
    lists.classList.remove('parked');
    await Promise.all([
      anim(stepsEl, [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], POP_MS, EASE_OUT),
      anim(lists, [{ '--dim': 0.12 }, { '--dim': 0 }], POP_MS, EASE_OUT),
    ]);
    settle(stepsEl); settle(lists);
    stepsEl.classList.remove('on');
    killHero(hero); hero = null; heroSeq++;
    cur = null;
    where = 'lists';
    busy = false;
    if (done) await addRegistryCard();
  }

  // ending: the new registry rides in at the front of the My Lists strip
  let created = 0;
  async function addRegistryCard() {
    const card = $('newCard'), strip = $('stripImg');
    $('newCardArt').src = `img/occ/${S.occ}.png`;
    $('newCardTitle').textContent = S.regName.trim();
    const shift = 142 * (created ? 0 : 1);
    created++;
    card.hidden = false;
    const mv = window.CSS && CSS.supports('animation-timing-function', 'linear(0, 1)')
      ? 'linear(0, 0.0311, 0.1073, 0.2084, 0.3197, 0.4312, 0.5364, 0.6314, 0.7143, 0.7845, 0.8425, 0.8891, 0.9258, 0.9538, 0.9747, 0.9896, 0.9999, 1.0066, 1.0105, 1.0125, 1.013, 1.0126, 1.0116, 1.0103, 1.0088, 1.0074, 1.006, 1.0048, 1.0037, 1.0028, 1.002, 1.0014, 1.001, 1.0006, 1)'
      : EASE_OUT;
    const jobs = [anim(card, [{ opacity: 0, transform: 'scale(0.9)' }, { opacity: 1, transform: 'none' }], 544, mv, { delay: 120 })];
    if (shift) jobs.push(anim(strip, [{ transform: 'translateX(0)' }, { transform: `translateX(${shift}px)` }], 544, mv));
    toast(`“${S.regName.trim()}” created`);
    await Promise.all(jobs);
  }

  async function onCta() {
    if (busy || !cur) return;
    const msg = stepValid();
    if (msg) return shake($('cta'), msg);
    const f = flow(), i = f.indexOf(cur);
    if (i === f.length - 1) return closeSteps(true);
    const next = f[i + 1];
    if (STEPS[next].kb === 'text' && !(field && document.activeElement === field)) focusProxy();
    stepTo(next, 1);
  }
  $('cta').addEventListener('click', onCta);

  // ---------- account <-> my lists (push / back) ----------
  const account = $('account'), listsEl = $('lists');
  listsEl.classList.add('parked');
  listsEl.style.transform = 'translateX(100%)';
  async function pushLists() {
    if (busy || where !== 'account') return;
    busy = true;
    listsEl.classList.remove('parked');
    await Promise.all([
      anim(listsEl, [{ transform: 'translateX(100%)', boxShadow: '-12px 0 32px rgba(0,0,0,0)' },
        { transform: 'translateX(0)', boxShadow: '-12px 0 32px rgba(0,0,0,.12)' }], PUSH_MS, EASE_OUT),
      anim(account, [{ transform: 'translateX(0)', '--dim': 0 }, { transform: 'translateX(-30%)', '--dim': 0.12 }], PUSH_MS, EASE_OUT),
    ]);
    settle(listsEl);
    listsEl.style.boxShadow = 'none';
    account.classList.add('parked');
    where = 'lists';
    busy = false;
  }
  async function popLists() {
    busy = true;
    account.classList.remove('parked');
    await Promise.all([
      anim(listsEl, [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }], POP_MS, EASE_OUT),
      anim(account, [{ transform: 'translateX(-30%)', '--dim': 0.12 }, { transform: 'translateX(0)', '--dim': 0 }], POP_MS, EASE_OUT),
    ]);
    settle(listsEl); settle(account);
    listsEl.classList.add('parked');
    where = 'account';
    busy = false;
  }

  // ---------- sheets ----------
  const layer = $('layer'), scrim = $('scrim'), drawer = $('drawer'), wrapEl = $('sheetWrap'), sheetEl = $('sheet');
  async function openDrawer() {
    if (busy || sheetOpen) return;
    busy = true;
    sheetOpen = 'drawer';
    layer.classList.add('on');
    drawer.classList.add('on');
    await Promise.all([
      anim(scrim, [{ opacity: 0 }, { opacity: 1 }], SHEET_IN_MS * 0.8, 'ease-out'),
      anim(drawer, [{ transform: 'translateY(342px)' }, { transform: 'translateY(0)' }], SHEET_IN_MS, EASE_OUT),
    ]);
    settle(scrim); settle(drawer);
    busy = false;
  }
  function currentY(el) { return new DOMMatrixReadOnly(getComputedStyle(el).transform).m42; }
  // close the open sheet; keepScrim leaves the backdrop up for the next sheet
  async function closeSheet(alongside = false, keepScrim = false) {
    if (!sheetOpen) return;
    if (busy && !alongside) return;
    const which = sheetOpen;
    sheetOpen = null;
    if (!alongside) busy = true;
    const jobs = [];
    if (!keepScrim) {
      const o = +getComputedStyle(scrim).opacity;
      settle(scrim);
      jobs.push(anim(scrim, [{ opacity: o }, { opacity: 0 }], SHEET_OUT_MS, 'ease-in'));
    }
    if (which === 'drawer') {
      const y = currentY(drawer);
      drawer.getAnimations().forEach((a) => a.cancel());
      jobs.push(anim(drawer, [{ transform: `translateY(${y}px)` }, { transform: 'translateY(342px)' }], SHEET_OUT_MS, EASE_IN));
    } else {
      closeExplainer();
      jobs.push(wait(SHEET_OUT_MS));
    }
    await Promise.all(jobs);
    if (which === 'drawer') { settle(drawer); drawer.classList.remove('on'); }
    if (!keepScrim && !sheetOpen) { settle(scrim); layer.classList.remove('on'); }
    if (!alongside) busy = false;
  }

  // explainer (v2/proto motion): sheet rises on the MOVE spring, hero lottie 120 ms later, columns cascade, Continue rises
  const XP = { lottie: 120, cols: [[760, 820, 860, 880], [850, 910, 950, 970], [940, 1000, 1040, null]], button: 1080 };
  const setD = (sel, ms) => document.querySelector(sel).style.setProperty('--d', ms + 'ms');
  XP.cols.forEach(([i, n, t, d], k) => {
    setD(`.c${k + 1} .ico`, i); setD(`.c${k + 1} .num`, n); setD(`.c${k + 1} .txt`, t);
    if (d) setD(`.d${k + 1}`, d);
  });
  setD('.cta', XP.button);
  const xpHero = lottie.loadAnimation({ container: $('xpHero'), renderer: 'svg', loop: false, autoplay: false,
    path: 'lottie/gift-hero-v2-nobg.json', rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } });
  let xpTimer = 0, xpReset = 0;
  function openExplainer() {
    clearTimeout(xpTimer); clearTimeout(xpReset);
    sheetEl.classList.remove('in');
    xpHero.goToAndStop(0, true);
    wrapEl.style.transform = '';
    void sheetEl.offsetWidth;
    layer.classList.add('on', 'xp');
    sheetEl.classList.add('in');
    sheetOpen = 'xp';
    xpTimer = setTimeout(() => xpHero.goToAndPlay(0, true), XP.lottie);
  }
  function closeExplainer() {
    clearTimeout(xpTimer);
    wrapEl.style.transition = `transform ${SHEET_OUT_MS}ms ${EASE_IN}`;
    wrapEl.style.transform = '';
    layer.classList.remove('xp');
    xpReset = setTimeout(() => { xpHero.pause(); sheetEl.classList.remove('in'); wrapEl.style.transition = ''; }, SHEET_OUT_MS + 60);
  }
  async function drawerToExplainer() {
    if (busy) return;
    busy = true;
    const closing = closeSheet(true, true);
    await wait(120);
    openExplainer();
    await closing;
    await wait(200);
    busy = false;
  }

  // drag a sheet down to dismiss
  function enableDrag(el, isOpen, getBase, setY, release) {
    let y0 = null, last = 0, lastT = 0, vy = 0, dy = 0, dragging = false, swallow = false;
    el.addEventListener('click', (e) => { if (swallow) { e.stopPropagation(); e.preventDefault(); swallow = false; } }, true);
    el.addEventListener('pointerdown', (e) => {
      if (busy || !isOpen()) return;
      y0 = e.clientY; last = e.clientY; lastT = e.timeStamp; vy = 0; dy = 0; dragging = false;
    });
    el.addEventListener('pointermove', (e) => {
      if (y0 === null) return;
      dy = (e.clientY - y0) / scale;
      if (!dragging && Math.abs(dy) > 6) { dragging = true; el.setPointerCapture(e.pointerId); }
      if (!dragging) return;
      vy = (e.clientY - last) / Math.max(1, e.timeStamp - lastT) / scale;
      last = e.clientY; lastT = e.timeStamp;
      setY(Math.max(0, dy) + getBase() * 0);
    });
    const end = () => {
      if (y0 === null) return;
      y0 = null;
      if (!dragging) return;
      swallow = true;
      setTimeout(() => { swallow = false; }, 50);
      release(dy > 110 || vy > 0.5, Math.max(0, dy));
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  enableDrag(drawer, () => sheetOpen === 'drawer', () => 0,
    (y) => { drawer.getAnimations().forEach((a) => a.cancel()); drawer.style.transform = `translateY(${y}px)`; },
    (dismiss, y) => {
      if (dismiss) { closeSheet(); return; }
      anim(drawer, [{ transform: `translateY(${y}px)` }, { transform: 'translateY(0)' }], 300, EASE_OUT).then(() => settle(drawer));
    });
  enableDrag(wrapEl, () => sheetOpen === 'xp', () => 0,
    (y) => { wrapEl.classList.add('drag'); wrapEl.style.transform = `translateY(${y}px)`; },
    (dismiss) => {
      wrapEl.classList.remove('drag');
      if (dismiss) { closeSheet(); return; }
      wrapEl.style.transform = '';
    });

  // ---------- back ----------
  async function back() {
    if (busy) return;
    if (sheetOpen) return closeSheet();
    if (where === 'steps') {
      const f = flow(), i = f.indexOf(cur);
      if (i <= 0) return closeSteps(false);
      const prev = f[i - 1];
      if (STEPS[prev].kb === 'text' && !(field && document.activeElement === field)) focusProxy();
      return stepTo(prev, -1);
    }
    if (where === 'lists') return popLists();
    toast('Start of flow');
  }

  // ---------- wiring ----------
  $('hotLists').addEventListener('click', pushLists);
  $('hotListsBack').addEventListener('click', back);
  $('hotCreate').addEventListener('click', openDrawer);
  $('hotCreateRegistry').addEventListener('click', drawerToExplainer);
  $('hotNewCollection').addEventListener('click', () => toast('Collections aren’t in this prototype'));
  $('scrim').addEventListener('click', () => closeSheet());
  $('xpCta').addEventListener('click', enterSteps);
  $('back').addEventListener('click', back);
  $('restart').addEventListener('click', () => location.reload());
  $('kb').addEventListener('click', () => { if (field) focusField(); });
  bodyEl.addEventListener('click', (e) => { if ((cur === 'whose' || cur === 'name') && field && !e.target.closest('input')) focusField(); });

  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (where !== 'steps' || !cur) {
      if (e.key === 'Escape') back();
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); onCta(); return; }
    if (e.key === 'Escape') { back(); return; }
    if (cur === 'when' || cur === 'due') {
      if (/^[0-9]$/.test(e.key)) { typeDigit(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { typeDigit('del'); e.preventDefault(); }
      return;
    }
    if (field && document.activeElement !== field && e.key.length === 1) focusField();
  });

  // test hooks (headless checks)
  window.proto = {
    S, get where() { return where; }, get cur() { return cur; }, get busy() { return busy; },
    get hero() { return hero && hero.anim; }, get heroUrl() { return heroUrl; }, xpHero, themeOf, flow,
  };
})();
