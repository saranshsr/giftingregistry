/*
 * Live form controls for the gifting registry prototype:
 *   createKeyboard   – iOS-style on-screen keyboard (one per phone)
 *   createTextField  – Field-Box input (Resting / Active / Typing / Filled) that drives the keyboard
 *   createCalendar   – "When is the event?" date picker content for a bottom sheet
 *   createCheckbox   – toggles a checked image over a baked unchecked box
 *
 * Field styling follows the Figma _Input/Field-Box component: #F9F9FB fill, 12px radius,
 * 12px 16px padding, B14/Regular (Noontree → Figtree on the web), placeholder #989FB3.
 */
(function () {
  // typed text is B14/Medium; the placeholder is B14/Regular
  const FIELD_FONT = '500 14px Figtree, -apple-system, system-ui, sans-serif';
  const KEYBOARD_H = 336;   // suggestion bar + 4 key rows + globe/mic row with home indicator
  const ACCENT = '#0f7eff';

  /* ---------------- keyboard ---------------- */

  const ROWS = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'backspace'],
    ['123', 'emoji', 'space', 'return'],
  ];
  const ICONS = {
    shift: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 4 3.5 13H8v6h8v-6h4.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    shiftOn: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 4 3.5 13H8v6h8v-6h4.5z" fill="currentColor"/></svg>',
    backspace: '<svg viewBox="0 0 26 20" width="25" height="19"><path d="M8 2h15a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 23 18H8l-6.5-8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m11.5 6.5 7 7m0-7-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    emoji: '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="9" cy="10" r="1.2" fill="currentColor"/><circle cx="15" cy="10" r="1.2" fill="currentColor"/><path d="M8 14.2c1 1.6 2.3 2.3 4 2.3s3-.7 4-2.3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    globe: '<svg viewBox="0 0 24 24" width="25" height="25"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    mic: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  };

  const KB_CSS = `
    .kb { position: absolute; left: 0; bottom: 0; width: 375px; height: ${KEYBOARD_H}px; z-index: 35;
      background: rgba(209, 212, 219, 0.97); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      transform: translateY(100%); font-family: -apple-system, "SF Pro Text", system-ui, sans-serif;
      user-select: none; -webkit-user-select: none; touch-action: manipulation; }
    .kb-suggest { height: 44px; display: flex; align-items: center; }
    .kb-suggest span { flex: 1; text-align: center; font-size: 16px; color: #1d2539; position: relative; }
    .kb-suggest span + span::before { content: ""; position: absolute; left: 0; top: -6px; bottom: -6px; width: 1px; background: rgba(60,60,67,.25); }
    .kb-rows { padding: 0 3px; }
    .kb-row { display: flex; justify-content: center; gap: 6px; height: 42px; margin-bottom: 12px; }
    .kb-row:last-child { margin-bottom: 0; }
    .kb-key { position: relative; flex: 0 0 31.5px; height: 42px; border: 0; padding: 0; border-radius: 5px;
      background: #fff; color: #000; font: 400 22.5px/42px -apple-system, "SF Pro Text", system-ui, sans-serif;
      box-shadow: 0 1px 0 rgba(0,0,0,.3); cursor: pointer; display: grid; place-items: center; }
    .kb-key.fn { background: #abb0bc; flex-basis: 42px; font-size: 16px; }
    .kb-row.r3 .kb-key.fn:first-child { margin-right: 8px; }
    .kb-row.r3 .kb-key.fn:last-child { margin-left: 8px; }
    .kb-key.wide { flex-basis: 87px; }
    .kb-key.emoji { flex-basis: 42px; }
    .kb-key.space { flex: 1 1 auto; font-size: 16px; }
    .kb-key.pressed { background: #abb0bc; }
    .kb-key.fn.pressed, .kb-key.fn.on { background: #fff; }
    .kb-pop { position: absolute; left: 50%; bottom: 0; width: 46px; height: 98px; transform: translateX(-50%);
      background: #fff; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.3); pointer-events: none;
      font: 400 32px/58px -apple-system, "SF Pro Text", system-ui, sans-serif; text-align: center; color: #000; z-index: 2; }
    .kb-foot { position: absolute; left: 0; right: 0; bottom: 0; height: 76px; }
    .kb-foot .globe, .kb-foot .mic { position: absolute; top: 10px; color: #50555c; }
    .kb-foot .globe { left: 22px; } .kb-foot .mic { right: 22px; }
    .kb-foot .home { position: absolute; left: 50%; bottom: 8px; width: 134px; height: 5px; margin-left: -67px; border-radius: 3px; background: #000; }
  `;

  function injectCSS(id, css) {
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = css;
    document.head.appendChild(s);
  }

  function createKeyboard(phone) {
    injectCSS('kb-css', KB_CSS);
    const el = document.createElement('div');
    el.className = 'kb';
    el.innerHTML = '<div class="kb-suggest"><span></span><span></span><span></span></div><div class="kb-rows"></div>' +
      `<div class="kb-foot"><span class="globe">${ICONS.globe}</span><span class="mic">${ICONS.mic}</span><span class="home"></span></div>`;
    const rows = el.querySelector('.kb-rows');
    const suggest = el.querySelectorAll('.kb-suggest span');
    const listeners = new Set();
    let field = null, shift = false, open = false, anim = null, repeat = null;

    ROWS.forEach((keys, r) => {
      const row = document.createElement('div');
      row.className = 'kb-row r' + (r + 1);
      for (const k of keys) {
        const b = document.createElement('button');
        b.type = 'button';
        b.tabIndex = -1;
        b.dataset.key = k;
        b.className = 'kb-key' + (k.length > 1 ? ' fn' : '') + (k === '123' || k === 'return' ? ' wide' : '') + (k === 'space' ? ' space' : '') + (k === 'emoji' ? ' emoji' : '');
        if (k === 'space') b.textContent = 'space';
        else if (k === '123') b.textContent = '123';
        else if (k === 'return') b.textContent = 'return';
        else if (ICONS[k]) b.innerHTML = ICONS[k];
        else b.textContent = k;
        row.appendChild(b);
      }
      rows.appendChild(row);
    });

    function setShift(on) {
      shift = on;
      el.querySelectorAll('.kb-key').forEach(b => {
        const k = b.dataset.key;
        if (k.length === 1) b.textContent = on ? k.toUpperCase() : k;
      });
      const s = el.querySelector('[data-key=shift]');
      s.innerHTML = on ? ICONS.shiftOn : ICONS.shift;
      s.classList.toggle('on', on);
    }

    function autoShift() {
      const v = field?.input.value || '';
      setShift(v.length === 0 || /[.!?]\s$/.test(v));
    }

    function updateSuggestions() {
      const word = (field?.input.value || '').split(/\s+/).pop();
      suggest[0].textContent = '';
      suggest[1].textContent = word ? `“${word}”` : '';
      suggest[2].textContent = '';
    }

    function insert(text) {
      const input = field?.input;
      if (!input) return;
      const s = input.selectionStart ?? input.value.length, e = input.selectionEnd ?? s;
      input.setRangeText(text, s, e, 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function erase() {
      const input = field?.input;
      if (!input) return;
      let s = input.selectionStart ?? input.value.length, e = input.selectionEnd ?? s;
      if (s === e) { if (s === 0) return; s -= 1; }
      input.setRangeText('', s, e, 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function press(k) {
      if (k === 'shift') return setShift(!shift);
      if (k === 'backspace') return erase();
      if (k === 'return') return field?.blur();
      if (k === 'space') return insert(' ');
      if (k === '123' || k === 'emoji') return;
      insert(shift ? k.toUpperCase() : k);
    }

    // pointerdown + preventDefault keeps focus (and the caret) in the text field
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      const b = e.target.closest('.kb-key');
      if (!b) return;
      const k = b.dataset.key;
      b.classList.add('pressed');
      if (k.length === 1) {
        const pop = document.createElement('div');
        pop.className = 'kb-pop';
        pop.textContent = shift ? k.toUpperCase() : k;
        b.appendChild(pop);
      }
      press(k);
      if (k === 'backspace') {
        repeat = setTimeout(function again() { erase(); repeat = setTimeout(again, 80); }, 450);
      }
      const up = () => {
        b.classList.remove('pressed');
        b.querySelector('.kb-pop')?.remove();
        clearTimeout(repeat);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
      };
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
    el.addEventListener('click', e => e.stopPropagation());

    function slide(to) {
      anim?.cancel();
      const from = getComputedStyle(el).transform;
      anim = el.animate([{ transform: from === 'none' ? 'translateY(100%)' : from }, { transform: to }],
        { duration: to === 'translateY(0)' ? 360 : 260, easing: to === 'translateY(0)' ? 'cubic-bezier(0.2, 0.9, 0.1, 1)' : 'cubic-bezier(0.4, 0, 0.8, 0.2)', fill: 'forwards' });
      // background tabs can stall the animation clock
      setTimeout(() => { if (anim?.playState === 'running') anim.finish(); }, 420);
    }

    const api = {
      el,
      height: KEYBOARD_H,
      get isOpen() { return open; },
      get field() { return field; },
      attach(f) {
        field = f;
        autoShift();
        updateSuggestions();
        if (!open) { open = true; slide('translateY(0)'); listeners.forEach(fn => fn(true)); }
      },
      detach(f) {
        if (f && f !== field) return;
        field = null;
        if (open) { open = false; slide('translateY(100%)'); listeners.forEach(fn => fn(false)); }
      },
      // called by fields on every input so shift + suggestions follow the text
      sync() { autoShift(); updateSuggestions(); },
      onToggle(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      reset() { anim?.cancel(); el.style.transform = 'translateY(100%)'; field = null; open = false; listeners.forEach(fn => fn(false)); },
    };
    phone.appendChild(el);
    return api;
  }

  /* ---------------- text field ---------------- */

  const FIELD_CSS = `
    .tf { position: absolute; border-radius: 12px; background: #f9f9fb; cursor: text; overflow: hidden; }
    .tf input, .tf textarea { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; outline: 0; margin: 0;
      padding: 0 16px; background: transparent; font: ${FIELD_FONT}; letter-spacing: -0.0071em;
      color: #1d2539; caret-color: transparent; }
    .tf input::placeholder, .tf textarea::placeholder { color: #989fb3; opacity: 1; font-weight: 400; }
    .tf textarea { resize: none; overflow: hidden; display: block; }
    .tf.multiline { transition: box-shadow .2s ease, height .22s cubic-bezier(0.2, 0.9, 0.1, 1); }
    .tf .caret { position: absolute; top: 12px; width: 2px; height: 20px; border-radius: 1px; background: ${ACCENT};
      opacity: 0; pointer-events: none; }
    .tf.active .caret { animation: tf-blink 1.06s steps(1) infinite; }
    /* Field-Box "Error" state: red border */
    .tf { transition: box-shadow .2s ease; }
    .tf.error { box-shadow: inset 0 0 0 1px #d92626; }
    /* Gift Registry flow (variant 2) input: 56pt, #F2F3F7, Medium placeholder */
    .tf.tf-v2 { background: #f2f3f7; }
    .tf.tf-v2 input::placeholder { font-weight: 500; }
    @keyframes tf-blink { 0%, 50% { opacity: 1; } 50.01%, 100% { opacity: 0; } }
  `;
  let measureCtx;
  function textWidth(t) {
    measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
    measureCtx.font = FIELD_FONT;
    return measureCtx.measureText(t).width - t.length * 0.0071 * 14;   // letter-spacing -0.0071em
  }

  // `pad` is the text inset; `className` adds a look (e.g. the Gift Registry flow's taller grey field).
  // `maxLines` > 1 makes it a textarea that wraps and grows a line at a time (h per line) up to that many lines.
  function createTextField({ keyboard, x, y, w = 319, h = 44, pad = 16, className = '', placeholder = '', value = '', maxLines = 1, onInput, onFocusChange }) {
    injectCSS('tf-css', FIELD_CSS);
    const el = document.createElement('div');
    el.className = 'tf' + (className ? ' ' + className : '') + (maxLines > 1 ? ' multiline' : '');
    Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    const input = document.createElement(maxLines > 1 ? 'textarea' : 'input');
    if (maxLines > 1) input.rows = 1; else input.type = 'text';
    input.placeholder = placeholder;
    input.value = value;
    input.autocomplete = 'off';
    input.spellcheck = false;
    // with the drawn keyboard, keep the device's own keyboard down; on touch devices use the native one
    if (!keyboard.native) input.setAttribute('inputmode', 'none');
    input.style.padding = `0 ${pad}px`;
    const caret = document.createElement('span');
    caret.className = 'caret';
    caret.style.top = (h - 20) / 2 + 'px';
    el.append(input, caret);

    // activate directly as well as on `focus`: the focus event never fires while the page's
    // window is unfocused (e.g. right after the link opens), but the field should still look active
    function activate() {
      if (el.classList.contains('active')) return;
      el.classList.add('active');
      placeCaret();
      keyboard.attach(field);
      onFocusChange?.(true);
    }
    function deactivate() {
      if (!el.classList.contains('active')) return;
      el.classList.remove('active');
      // let a focus move to another field keep the keyboard up
      setTimeout(() => { if (keyboard.field === field && !el.classList.contains('active')) keyboard.detach(field); }, 0);
      onFocusChange?.(false);
    }

    const field = {
      el, input,
      focus() { input.focus({ preventScroll: true }); activate(); },
      blur() { input.blur(); deactivate(); },
      setError(on) { el.classList.toggle('error', !!on); },
      get value() { return input.value; },
    };

    function placeCaret() {
      const pos = input.selectionStart ?? input.value.length;
      const x = pad + textWidth(input.value.slice(0, pos)) - input.scrollLeft;
      caret.style.left = Math.min(w - 4, Math.max(pad - 1, x)) + 'px';
      // restart the blink so the caret is solid while typing
      caret.style.animation = 'none';
      void caret.offsetWidth;
      caret.style.animation = '';
    }

    input.addEventListener('focus', activate);
    input.addEventListener('blur', () => {
      // a window losing focus also blurs; keep the field active unless something else on the page took focus
      if (!document.hasFocus() && document.activeElement === input) return;
      deactivate();
    });
    // multi-line: as tall as the wrapped text needs (measured on an invisible copy in the same font), up to maxLines
    let mirror;
    function fit() {
      if (maxLines < 2) return;
      const cs = getComputedStyle(input);
      mirror = mirror || document.createElement('div');
      Object.assign(mirror.style, { position: 'absolute', left: '-9999px', top: '0', visibility: 'hidden',
        width: w - 2 * pad + 'px', font: cs.font, letterSpacing: cs.letterSpacing, lineHeight: h + 'px',
        textAlign: cs.textAlign, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' });
      mirror.textContent = input.value || ' ';
      document.body.appendChild(mirror);
      const lines = Math.min(maxLines, Math.max(1, Math.round(mirror.offsetHeight / h)));
      mirror.remove();
      el.style.height = lines * h + 'px';
      if (input.scrollHeight > lines * h) input.scrollTop = input.scrollHeight;
    }
    input.addEventListener('input', () => { fit(); placeCaret(); keyboard.sync(); field.setError(false); onInput?.(input.value); });
    if (value) requestAnimationFrame(fit);
    ['keyup', 'click', 'select'].forEach(ev => input.addEventListener(ev, placeCaret));
    // a prefilled value starts with the caret at the end
    if (value) requestAnimationFrame(() => input.setSelectionRange(value.length, value.length));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); e.stopPropagation(); });
    el.addEventListener('click', e => { e.stopPropagation(); field.focus(); });
    return field;
  }

  /* ---------------- calendar (July 2026, days after the 15th are unavailable) ---------------- */

  const CAL = { firstWeekday: 3, days: 31, lastAvailable: 15, x0: 28, y0: 178, colStep: 45.8333, rowStep: 50, cell: 44 };
  const CAL_CSS = `
    .cal { position: absolute; left: 0; top: 0; width: 375px; height: 540px; }
    .cal > img { position: absolute; left: 0; top: 0; width: 375px; height: 540px; pointer-events: none; }
    .cal .day, .cal .btn { position: absolute; border: 0; padding: 0; background: none; cursor: pointer; border-radius: 22px;
      -webkit-tap-highlight-color: transparent; }
    .cal .day:active { background: rgba(15,126,255,.08); }
    .cal .sel { position: absolute; width: 44px; height: 44px; border-radius: 50%; background: ${ACCENT};
      pointer-events: none; opacity: 0; transform: scale(.6);
      transition: opacity .18s ease, transform .3s cubic-bezier(0.2, 0.9, 0.1, 1), left .3s cubic-bezier(0.2, 0.9, 0.1, 1), top .3s cubic-bezier(0.2, 0.9, 0.1, 1); }
    .cal .sel.on { opacity: 1; transform: none; }
    /* white page -> black, dark digit -> white; "screen" then drops the black over the blue */
    .cal .sel i { position: absolute; inset: 0; border-radius: 50%; background-repeat: no-repeat; background-size: 375px 540px;
      filter: grayscale(1) invert(1) contrast(4); mix-blend-mode: screen; }
    .cal .confirm-on { position: absolute; left: 193.5px; top: 438px; width: 157.5px; height: 48px; pointer-events: none;
      opacity: 0; transition: opacity .2s ease; }
    .cal.picked .confirm-on { opacity: 1; }
    .cal .btn:active { filter: brightness(.95); transform: scale(.98); }
  `;

  function dayCell(d) {
    const i = d - 1 + CAL.firstWeekday;
    return { x: CAL.x0 + (i % 7) * CAL.colStep, y: CAL.y0 + Math.floor(i / 7) * CAL.rowStep };
  }

  // `accent` / `confirmSrc` restyle the selected day and the enabled Confirm button (e.g. in an occasion's theme)
  function createCalendar({ base, selected = null, accent, confirmSrc, onConfirm, onClose, onYear }) {
    injectCSS('cal-css', CAL_CSS);
    const el = document.createElement('div');
    el.className = 'cal';
    const sheetImg = new Image();
    sheetImg.src = base + 'calendar-sheet.png';
    sheetImg.alt = '';
    const confirmOn = new Image();
    confirmOn.src = confirmSrc || base + 'calendar-confirm-enabled.png';
    confirmOn.className = 'confirm-on';
    confirmOn.alt = '';
    const sel = document.createElement('div');
    sel.className = 'sel';
    if (accent) sel.style.background = accent;
    // the digit is the calendar image itself, cropped to the cell and turned white
    const digit = document.createElement('i');
    digit.style.backgroundImage = `url(${base}calendar-sheet.png)`;
    sel.appendChild(digit);
    el.append(sheetImg, sel, confirmOn);

    let pick = null;
    function choose(d, instant) {
      pick = d;
      const c = dayCell(d);
      if (instant) sel.style.transition = 'none';
      Object.assign(sel.style, { left: c.x + 'px', top: c.y + 'px' });
      digit.style.backgroundPosition = `${-c.x}px ${-c.y}px`;
      sel.classList.add('on');
      el.classList.add('picked');
      if (instant) { void sel.offsetWidth; sel.style.transition = ''; }
    }

    for (let d = 1; d <= CAL.lastAvailable; d++) {
      const c = dayCell(d);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'day';
      b.title = `July ${d}, 2026`;
      Object.assign(b.style, { left: c.x + 'px', top: c.y + 'px', width: CAL.cell + 'px', height: CAL.cell + 'px' });
      b.addEventListener('click', e => { e.stopPropagation(); choose(d); });
      el.appendChild(b);
    }

    const btn = (title, x, y, w, h, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.title = title;
      Object.assign(b.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', borderRadius: '12px' });
      b.addEventListener('click', e => { e.stopPropagation(); fn(); });
      el.appendChild(b);
    };
    btn('Close', 24, 438, 157.5, 48, () => onClose?.());
    btn('Confirm', 193.5, 438, 157.5, 48, () => { if (pick) onConfirm?.(new Date(2026, 6, pick)); });
    btn('Year', 255, 44, 92, 40, () => onYear?.());

    if (selected) choose(selected.getDate(), true);
    return { el };
  }

  /* ---------------- occasion tile ---------------- */

  // Figma "Option BG" (1379:1094064) + occasion illustration, 98×120.
  // Default: #F6F7F9 fill, B12/Medium #475067 label.
  // Selected: white fill, 1px #D6E9FF stroke, 202pt glow ellipse at (-52,-16) with a
  // #F9F9FB 20% → #C3DFFF 66% gradient, B12/Bold #0F61FF label.
  const OCC_CSS = `
    .occ { position: absolute; width: 98px; height: 120px; padding: 0; border: 0; border-radius: 12px; overflow: hidden;
      background: #f6f7f9; cursor: pointer; isolation: isolate; -webkit-tap-highlight-color: transparent;
      transition: background-color .2s ease, filter .18s; }
    .occ:active { filter: brightness(0.96); }
    .occ .occ-bg { position: absolute; inset: 0; border-radius: 12px; box-shadow: inset 0 0 0 1px transparent; transition: box-shadow .2s ease; }
    .occ .occ-glow { position: absolute; left: -52px; top: -16px; width: 202px; height: 202px; border-radius: 50%;
      background: linear-gradient(180deg, #f9f9fb 20%, #c3dfff 66%); opacity: 0; transform: translateY(16px);
      transition: opacity .25s ease, transform .35s cubic-bezier(0.2, 0.9, 0.1, 1); }
    .occ .occ-label { position: absolute; left: 6px; top: 12px; width: 86px; text-align: center; white-space: nowrap;
      font: 500 12px/18px Figtree, -apple-system, system-ui, sans-serif; letter-spacing: -0.0083em; color: #475067;
      transition: color .2s ease; }
    .occ .occ-art { position: absolute; display: block; pointer-events: none; transition: transform .35s cubic-bezier(0.2, 0.9, 0.1, 1); }
    .occ.selected { background: #fff; }
    .occ.selected .occ-bg { box-shadow: inset 0 0 0 1px #d6e9ff; }
    .occ.selected .occ-glow { opacity: 1; transform: none; }
    .occ.selected .occ-label { font-weight: 700; color: #0f61ff; }
    .occ.selected .occ-art { transform: translateY(-2px) scale(1.04); }
    /* Gift Registry flow (variant 2): 104×127 tiles; the selected state takes the occasion's theme from
       --occ-stroke / --occ-glow / --occ-label (defaults: the design's pink, #FFE5ED / #FFCBDB / #DF4075) */
    .occ.occ-v2 { width: 104px; height: 127px; }
    .occ.occ-v2 .occ-label { left: 9px; }
    .occ.occ-v2 .occ-glow { background: linear-gradient(180deg, #f9f9fb 0%, var(--occ-glow, #ffcbdb) 100%); }
    .occ.occ-v2.selected .occ-bg { box-shadow: inset 0 0 0 1px var(--occ-stroke, #ffe5ed); }
    .occ.occ-v2.selected .occ-label { color: var(--occ-label, #df4075); }
    /* flow 4 fresh tiles (Figma 8572:49342): 98×120 on #F9F9FB */
    .occ.occ-v2.occ-v5 { width: 98px; height: 120px; background: #f9f9fb; }
    .occ.occ-v2.occ-v5 .occ-label { left: 6px; }
    .occ.occ-v2.occ-v5.selected { background: #fff; }
  `;

  function createOccasionTile({ label, art, x, y, className = '', onSelect }) {
    injectCSS('occ-css', OCC_CSS);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'occ' + (className ? ' ' + className : '');
    el.title = label;
    Object.assign(el.style, { left: x + 'px', top: y + 'px' });
    el.innerHTML = '<span class="occ-bg"></span><span class="occ-glow"></span><span class="occ-label"></span>';
    el.querySelector('.occ-label').textContent = label;
    const pic = new Image();
    pic.src = art.src;
    pic.alt = '';
    pic.className = 'occ-art';
    Object.assign(pic.style, { left: art.x + 'px', top: art.y + 'px', width: art.w + 'px', height: art.h + 'px' });
    el.appendChild(pic);
    el.addEventListener('click', e => { e.stopPropagation(); onSelect?.(); });
    return {
      el,
      setSelected(on) { el.classList.toggle('selected', !!on); el.setAttribute('aria-pressed', !!on); },
    };
  }

  /* ---------------- checkbox ---------------- */

  function createCheckbox({ src, x, y, size = 24, hit, checked = false, onChange }) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'tap cb';
    el.title = 'Leave at door';
    Object.assign(el.style, { left: hit.x + 'px', top: hit.y + 'px', width: hit.w + 'px', height: hit.h + 'px', borderRadius: '12px' });
    const box = new Image();
    box.src = src;
    box.alt = '';
    Object.assign(box.style, {
      position: 'absolute', left: x - hit.x + 'px', top: y - hit.y + 'px', width: size + 'px', height: size + 'px',
      transition: 'opacity .15s ease, transform .25s cubic-bezier(0.2, 0.9, 0.1, 1)',
    });
    el.appendChild(box);
    function render() {
      box.style.opacity = checked ? 1 : 0;
      box.style.transform = checked ? 'scale(1)' : 'scale(.6)';
    }
    el.addEventListener('click', e => { e.stopPropagation(); checked = !checked; render(); onChange?.(checked); });
    render();
    return { el, get checked() { return checked; } };
  }

  Object.assign(window, { createKeyboard, createTextField, createCalendar, createCheckbox, createOccasionTile, KEYBOARD_H });
})();
