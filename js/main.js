/* ==========================================================================
   tazzedimerda — interfaccia, regia, shop, carrello, configuratore, audio
   La scena 3D (js/stage.js) è un miglioramento progressivo: se WebGL non c'è,
   tutto funziona con le tazze SVG di js/data.js.
   ========================================================================== */
(() => {
  'use strict';

  const { PRODUCTS, CATEGORIES, GLAZES, SHAPES, EMBLEMS, mugSVG, esc } = window.TDM;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const money = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage non disponibile */ } }
  };
  const has3D = () => !!(window.TDM3D && window.TDM3D.ready);
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  const piecewise = (pts, x) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      if (x <= x1) return y0 + (y1 - y0) * clamp((x - x0) / (x1 - x0));
    }
    return pts[pts.length - 1][1];
  };

  /* ------------------------------------------------------------------ *
   * Scroll morbido (Lenis)
   * ------------------------------------------------------------------ */
  let lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new window.Lenis({ lerp: .085, smoothWheel: true });
    const loop = (t) => { lenis.raf(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    lenis.stop();
  }
  function scrollToTarget(target) {
    if (lenis) lenis.scrollTo(target, { duration: 1.8, easing: (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) });
    else if (typeof target === 'number') scrollTo({ top: target, behavior: reduceMotion ? 'auto' : 'smooth' });
    else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id === '#') { e.preventDefault(); return; }
    const el = id === '#top' ? 0 : document.querySelector(id);
    if (el === null) return;
    e.preventDefault();
    scrollToTarget(el);
  });

  /* ------------------------------------------------------------------ *
   * Toast
   * ------------------------------------------------------------------ */
  const toastEl = $('#toast');
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  }

  /* ------------------------------------------------------------------ *
   * Immagini delle tazze: render 3D se disponibile, altrimenti SVG
   * ------------------------------------------------------------------ */
  function art(cfg, alt = '') {
    if (has3D()) {
      try { return `<img src="${window.TDM3D.renderStill(cfg)}" alt="${esc(alt)}" draggable="false">`; } catch { /* fallback SVG */ }
    }
    return mugSVG(cfg);
  }
  const turntables = new Map();
  function getTurntable(key, cfg) {
    if (!has3D()) return null;
    if (!turntables.has(key)) turntables.set(key, window.TDM3D.renderTurntable(cfg, 24, 520));
    return turntables.get(key);
  }

  /* ------------------------------------------------------------------ *
   * Titoli di testa: avanzamento reale (scena 3D + foto prodotto)
   * ------------------------------------------------------------------ */
  const loader = { asset: 0, done: false, t0: performance.now() };
  const loaderMsgs = ['Accendo il forno…', 'Impasto l’argilla…', 'Monto il set ad Arena…', 'Fotografo le tazze…', 'Si gira.'];
  function setAsset(p) { loader.asset = Math.max(loader.asset, p); }
  (function loaderLoop() {
    const minDur = reduceMotion ? 300 : 2600;
    const tp = clamp((performance.now() - loader.t0) / minDur);
    const shown = Math.min(tp, loader.asset);
    $('#loaderNum').textContent = String(Math.round(shown * 100)).padStart(3, '0');
    $('#loaderBar').style.width = shown * 100 + '%';
    $('#loaderMsg').textContent = loaderMsgs[Math.min(loaderMsgs.length - 1, Math.floor(shown * (loaderMsgs.length - .01)))];
    if (shown >= 1) return finishLoading();
    requestAnimationFrame(loaderLoop);
  })();
  setTimeout(() => setAsset(1), 14000); // rete di sicurezza

  window.addEventListener('tdm:progress', (e) => setAsset(e.detail * .45));
  window.addEventListener('tdm:3d-fail', () => { setAsset(1); renderFallbacks(); });
  window.addEventListener('tdm:3d-ready', async () => {
    setAsset(.45);
    // pre-render delle foto prodotto durante i titoli di testa
    for (let i = 0; i < PRODUCTS.length; i++) {
      try { window.TDM3D.renderStill(PRODUCTS[i]); } catch { /* ignora */ }
      setAsset(.45 + .55 * ((i + 1) / PRODUCTS.length));
      await raf();
    }
    renderGrid(); renderCart(); renderCfg();
    $('#emptyMug').innerHTML = art({ glaze: 'osso', shape: 'classica', emblem: 'nessuno' }, 'Tazza vuota');
  });
  if (!document.getElementById('stage')) setAsset(1);

  function finishLoading() {
    if (loader.done) return;
    loader.done = true;
    document.body.classList.remove('is-loading');
    document.body.classList.add('intro');
    if (has3D()) window.TDM3D.intro();
    if (lenis) lenis.start();
    setTimeout(() => document.body.classList.remove('intro'), 3400);
    if (!has3D()) renderFallbacks();
  }
  function renderFallbacks() {
    $('#heroFallback').innerHTML = mugSVG({ glaze: 'oro', shape: 'classica', emblem: 'swirl' });
    $('#labFallback').innerHTML = mugSVG({ glaze: 'oro', shape: 'classica', emblem: 'swirl' });
    $('#emptyMug').innerHTML = mugSVG({ glaze: 'osso', shape: 'classica', emblem: 'nessuno', steam: false });
    renderCfg();
  }

  /* ------------------------------------------------------------------ *
   * HUD: timecode + capitolo
   * ------------------------------------------------------------------ */
  const tcEl = $('#tc'), chapterEl = $('#hudChapter');
  const chapters = $$('[data-chapter]');
  let lastChapter = '';
  (function hudLoop() {
    const s = (performance.now() - loader.t0) / 1000;
    const f = Math.floor((s % 1) * 24), p2 = (n) => String(n).padStart(2, '0');
    tcEl.textContent = `${p2(Math.floor(s / 3600))}:${p2(Math.floor(s / 60) % 60)}:${p2(Math.floor(s) % 60)}:${p2(f)}`;
    requestAnimationFrame(hudLoop);
  })();
  function updateChapter() {
    const c = innerHeight / 2;
    const cur = chapters.find((el) => { const r = el.getBoundingClientRect(); return r.top <= c && r.bottom >= c; });
    const label = cur ? cur.dataset.chapter : lastChapter;
    if (label && label !== lastChapter) { lastChapter = label; chapterEl.textContent = label; }
    document.body.classList.toggle('hud-full', !!cur && ['hero', 'manifesto', 'lab', 'fine'].includes(cur.id));
  }

  /* ------------------------------------------------------------------ *
   * Navigazione, progresso, menu
   * ------------------------------------------------------------------ */
  const nav = $('#nav'), progress = $('#progress'), burger = $('#burger'), menu = $('#menu');
  let lastY = 0;
  function onScroll() {
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav.classList.toggle('is-solid', y > 40);
    nav.classList.toggle('is-hidden', y > lastY + 2 && y > 400 && !menu.classList.contains('is-open'));
    if (y < lastY - 2) nav.classList.remove('is-hidden');
    lastY = y;
  }
  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
    lock();
  }
  burger.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  $('#toTop').addEventListener('click', () => scrollToTarget(0));
  $('#year').textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------ *
   * Cursore + pulsanti magnetici
   * ------------------------------------------------------------------ */
  if (finePointer) {
    const cur = $('#cursor'), dot = $('span', cur);
    let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
    addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function loop() { cx += (tx - cx) * .2; cy += (ty - cy) * .2; cur.style.transform = `translate(${cx}px, ${cy}px)`; requestAnimationFrame(loop); })();
    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest('[data-cursor]');
      cur.classList.toggle('is-hover', !!t);
      if (t) dot.dataset.label = t.dataset.cursor;
    });
    $$('.magnetic').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px, ${(e.clientY - r.top - r.height / 2) * .35}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  /* ------------------------------------------------------------------ *
   * Hero: scalda la tazza
   * ------------------------------------------------------------------ */
  $('#heatBtn').addEventListener('click', () => { if (has3D()) window.TDM3D.burst(); audio.crack(6); });
  $('#hero').addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    if (has3D()) window.TDM3D.burst();
    audio.crack(4);
  });

  /* ------------------------------------------------------------------ *
   * Reveal, contatori, manifesto parola per parola
   * ------------------------------------------------------------------ */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: .15, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach((el, i) => { el.style.setProperty('--d', (i % 4) * .09 + 's'); io.observe(el); });

  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      countIO.unobserve(en.target);
      const el = en.target, end = +el.dataset.count, suf = el.dataset.suffix || '', t0 = performance.now(), dur = reduceMotion ? 1 : 2200;
      (function step(t) {
        const p = clamp((t - t0) / dur), e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        el.textContent = Math.round(end * e).toLocaleString('it-IT') + suf;
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }, { threshold: .6 });
  $$('[data-count]').forEach((el) => countIO.observe(el));

  const mText = $('#manifestoText');
  mText.innerHTML = mText.textContent.trim().split(/\s+/).map((w) => `<span class="w">${esc(w)}</span>`).join(' ');
  const words = $$('.w', mText);
  function updateManifesto() {
    const r = mText.getBoundingClientRect();
    const p = clamp((innerHeight * .8 - r.top) / (r.height + innerHeight * .3));
    const n = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle('on', i < n));
  }

  /* ------------------------------------------------------------------ *
   * Laboratorio: fasi, letture strumenti, barre cinema
   * ------------------------------------------------------------------ */
  const lab = $('#lab'), steps = $$('.step'), dots = $$('#labDots li');
  const STEP_AT = [.07, .3, .5, .72, .93];
  let labP = 0, labStep = -1;
  function updateLab() {
    const r = lab.getBoundingClientRect();
    labP = clamp(-r.top / Math.max(1, r.height - innerHeight));
    const inView = r.top < innerHeight * .25 && r.bottom > innerHeight * .75;
    document.body.classList.toggle('cine', inView && !document.body.classList.contains('intro'));
    $('#labBar').style.transform = `scaleX(${labP})`;
    const st = Math.min(4, Math.floor(labP * 5));
    if (st !== labStep) {
      labStep = st;
      steps.forEach((s, i) => s.classList.toggle('is-on', i === st));
      dots.forEach((d, i) => { d.classList.toggle('is-on', i === st); d.classList.toggle('is-done', i < st); });
      $('#roPhase').textContent = `0${st + 1}/05`;
    }
    const temp = piecewise([[0, 22], [.55, 22], [.62, 320], [.71, 1240], [.8, 1190], [.88, 64], [1, 64]], labP);
    const rpm = piecewise([[0, 0], [.16, 0], [.24, 240], [.36, 240], [.43, 0], [1, 0]], labP);
    const hum = piecewise([[0, 24], [.36, 18], [.44, 4], [.6, 0], [1, 0]], labP);
    const t = $('#roTemp');
    t.textContent = Math.round(temp).toLocaleString('it-IT') + ' °C';
    t.classList.toggle('hot', temp > 250);
    $('#roRpm').textContent = Math.round(rpm) + ' rpm';
    $('#roHum').textContent = Math.round(hum) + '%';
  }
  $('#labDots').addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]'); if (!b) return;
    const top = lab.getBoundingClientRect().top + scrollY;
    scrollToTarget(top + STEP_AT[+b.dataset.step] * (lab.offsetHeight - innerHeight));
  });

  /* ------------------------------------------------------------------ *
   * Shop
   * ------------------------------------------------------------------ */
  const grid = $('#grid'), filtersEl = $('#filters'), sortEl = $('#sort');
  let activeCat = 'tutte';
  const catLabel = (k) => (CATEGORIES.find((c) => c.key === k) || {}).label || k;

  filtersEl.innerHTML = CATEGORIES.map((c) => `<button role="tab" data-cat="${c.key}" class="${c.key === activeCat ? 'is-active' : ''}" aria-selected="${c.key === activeCat}">${c.label}</button>`).join('');
  filtersEl.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    activeCat = b.dataset.cat;
    $$('button', filtersEl).forEach((x) => { const on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-selected', on); });
    renderGrid();
  });
  sortEl.addEventListener('change', renderGrid);

  const cardIO = new IntersectionObserver((entries) => {
    let i = 0;
    entries.forEach((en) => { if (en.isIntersecting) { const el = en.target; setTimeout(() => el.classList.add('in'), i++ * 100); cardIO.unobserve(el); } });
  }, { threshold: .1 });

  function renderGrid() {
    let list = PRODUCTS.filter((p) => activeCat === 'tutte' || p.cat === activeCat);
    const s = sortEl.value;
    if (s === 'asc') list = [...list].sort((a, b) => a.price - b.price);
    if (s === 'desc') list = [...list].sort((a, b) => b.price - a.price);
    if (s === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'it'));
    grid.innerHTML = list.map((p) => `
      <article class="card" data-id="${p.id}">
        ${p.badge ? `<span class="card__badge">${esc(p.badge)}</span>` : ''}
        <button class="card__open" data-open="${p.id}" data-cursor="360°" aria-label="Vedi ${esc(p.name)}"></button>
        <div class="card__art" data-hint="${has3D() ? 'Gira a 360°' : 'Guarda da vicino'}">${art(p, p.name)}</div>
        <div class="card__info">
          <span class="card__cat">${esc(catLabel(p.cat))} · ${esc(p.cap)}</span>
          <h3 class="card__name">${esc(p.name)}</h3>
          <div class="card__row"><span class="card__price">${money(p.price)}</span>
            <button class="card__add" data-add="${p.id}" aria-label="Aggiungi ${esc(p.name)} al carrello" data-cursor="aggiungi">+</button></div>
        </div>
      </article>`).join('');
    $$('.card', grid).forEach((c) => { cardIO.observe(c); if (finePointer && !reduceMotion) enhanceCard(c); });
  }
  function enhanceCard(card) {
    const p = PRODUCTS.find((x) => x.id === card.dataset.id);
    let spinning = false, frameI = 0, timer = null;
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      card.style.transform = `perspective(1000px) rotateY(${x * 7}deg) rotateX(${-y * 7}deg)`;
    });
    card.addEventListener('mouseenter', async () => {
      const tt = getTurntable(p.id, p); if (!tt) return;
      spinning = true;
      const frames = await tt;
      const img = $('.card__art img', card);
      if (!spinning || !img) return;
      clearInterval(timer);
      timer = setInterval(() => { frameI = (frameI + 1) % frames.length; img.src = frames[frameI]; }, 1000 / 18);
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = ''; spinning = false; clearInterval(timer);
      const img = $('.card__art img', card);
      if (img && has3D()) img.src = window.TDM3D.renderStill(p);
      frameI = 0;
    });
  }
  grid.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) { addToCart(add.dataset.add); return; }
    const open = e.target.closest('[data-open]');
    if (open) openProduct(open.dataset.open);
  });
  renderGrid();

  /* ------------------------------------------------------------------ *
   * Modali / drawer
   * ------------------------------------------------------------------ */
  const overlay = $('#overlay'), drawer = $('#drawer');
  let lastFocus = null;
  const openLayers = [];
  function lock() {
    const locked = openLayers.length > 0 || menu.classList.contains('is-open');
    document.body.classList.toggle('no-scroll', locked);
    if (lenis && loader.done) locked ? lenis.stop() : lenis.start();
  }
  function openModal(el) {
    lastFocus = document.activeElement;
    el.classList.add('is-open'); el.setAttribute('aria-hidden', 'false'); openLayers.push(el); lock();
    setTimeout(() => ($('[data-close], input, button', el) || el).focus({ preventScroll: true }), 80);
  }
  function closeModal(el) {
    el.classList.remove('is-open'); el.setAttribute('aria-hidden', 'true');
    const i = openLayers.indexOf(el); if (i > -1) openLayers.splice(i, 1);
    if (el === pm) stopModalSpin();
    lock(); if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) closeModal(m); }));
  function openDrawer() {
    lastFocus = document.activeElement;
    drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false'); overlay.classList.add('is-on'); openLayers.push(drawer); lock();
    setTimeout(() => $('#cartClose').focus({ preventScroll: true }), 80);
  }
  function closeDrawer() {
    drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); overlay.classList.remove('is-on');
    const i = openLayers.indexOf(drawer); if (i > -1) openLayers.splice(i, 1);
    lock();
  }
  overlay.addEventListener('click', closeDrawer);
  $('#cartClose').addEventListener('click', closeDrawer);
  $('#cartBtn').addEventListener('click', openDrawer);
  $('#emptyGo').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (menu.classList.contains('is-open')) return setMenu(false);
    const top = openLayers[openLayers.length - 1];
    if (!top) return;
    top === drawer ? closeDrawer() : closeModal(top);
  });

  /* Dettaglio prodotto con rotazione a 360° */
  const pm = $('#productModal'), pmArt = $('#pmArt');
  let pmId = null, pmQty = 1, pmFrames = null, pmFrame = 0, pmAuto = null, pmDrag = null;
  function stopModalSpin() { clearInterval(pmAuto); pmAuto = null; }
  function showFrame() { const img = $('img', pmArt); if (img && pmFrames) img.src = pmFrames[((pmFrame % pmFrames.length) + pmFrames.length) % pmFrames.length]; }
  async function openProduct(id) {
    const p = PRODUCTS.find((x) => x.id === id); if (!p) return;
    pmId = id; pmQty = 1; $('#pmQty').textContent = 1; pmFrames = null; pmFrame = 0;
    pmArt.innerHTML = art(p, p.name) + `<span class="modal__hint mono" id="pmHint">${has3D() ? 'trascina per ruotare · 360°' : ''}</span>`;
    $('#pmCat').textContent = catLabel(p.cat);
    $('#pmName').textContent = p.name;
    $('#pmPrice').textContent = money(p.price);
    $('#pmDesc').textContent = p.desc;
    $('#pmSpecs').innerHTML = [`Capacità ${p.cap}`, `Peso ${p.peso}`, GLAZES[p.glaze].name, p.finish === 'opaco' ? 'Finitura opaca' : 'Finitura lucida', 'Fatta ad Arena'].map((s) => `<li>${esc(s)}</li>`).join('');
    openModal(pm);
    const tt = getTurntable(p.id, p);
    if (tt) {
      $('#pmHint').textContent = 'preparo il giro a 360°…';
      pmFrames = await tt;
      if (pmId !== id || !pm.classList.contains('is-open')) return;
      $('#pmHint').textContent = 'trascina per ruotare · 360°';
      stopModalSpin();
      if (!reduceMotion) pmAuto = setInterval(() => { pmFrame++; showFrame(); }, 1000 / 14);
    }
  }
  pmArt.addEventListener('pointerdown', (e) => { if (!pmFrames) return; stopModalSpin(); pmDrag = { x: e.clientX, f: pmFrame }; pmArt.setPointerCapture(e.pointerId); });
  pmArt.addEventListener('pointermove', (e) => { if (!pmDrag) return; pmFrame = pmDrag.f + Math.round((pmDrag.x - e.clientX) / 14); showFrame(); });
  pmArt.addEventListener('pointerup', () => { pmDrag = null; });
  $('#pmMinus').addEventListener('click', () => { pmQty = Math.max(1, pmQty - 1); $('#pmQty').textContent = pmQty; });
  $('#pmPlus').addEventListener('click', () => { pmQty = Math.min(20, pmQty + 1); $('#pmQty').textContent = pmQty; });
  $('#pmAdd').addEventListener('click', () => { addToCart(pmId, pmQty); closeModal(pm); });

  /* ------------------------------------------------------------------ *
   * Carrello
   * ------------------------------------------------------------------ */
  const CART_KEY = 'tdm-cart-v1', FREE_SHIP = 60, SHIP_COST = 5.9;
  const COUPONS = { ARENA10: 0.10 };
  let cart = store.get(CART_KEY, []);
  let coupon = store.get('tdm-coupon-v1', null);
  if (!Array.isArray(cart)) cart = [];
  cart = cart.filter((l) => l && typeof l.key === 'string' && Number.isInteger(l.qty) && l.qty > 0 &&
    (l.custom ? (SHAPES[l.custom.shape] && GLAZES[l.custom.glaze] && EMBLEMS[l.custom.emblem]) : PRODUCTS.some((p) => p.id === l.key)));
  if (coupon && !COUPONS[coupon]) coupon = null;

  const itemInfo = (l) => {
    if (l.custom) {
      const c = l.custom;
      return { name: 'Tazza su misura', price: c.price, cfg: c, meta: `${SHAPES[c.shape].label} · ${GLAZES[c.glaze].name}${c.label ? ' · “' + c.label + '”' : ''}` };
    }
    const p = PRODUCTS.find((x) => x.id === l.key);
    return { name: p.name, price: p.price, cfg: p, meta: `${p.cap} · ${GLAZES[p.glaze].name}` };
  };
  function totals() {
    const sub = cart.reduce((s, l) => s + itemInfo(l).price * l.qty, 0);
    const disc = coupon ? Math.round(sub * COUPONS[coupon] * 100) / 100 : 0;
    const net = sub - disc;
    const ship = cart.length === 0 || net >= FREE_SHIP ? 0 : SHIP_COST;
    return { sub, disc, net, ship, total: net + ship };
  }
  function saveCart() { store.set(CART_KEY, cart); store.set('tdm-coupon-v1', coupon); }

  function renderCart() {
    const count = cart.reduce((s, l) => s + l.qty, 0);
    const badge = $('#cartCount');
    badge.textContent = count;
    badge.classList.add('bump'); setTimeout(() => badge.classList.remove('bump'), 300);
    drawer.classList.toggle('is-empty', cart.length === 0);
    $('#cartItems').innerHTML = cart.map((l) => {
      const i = itemInfo(l);
      return `<li class="ci" data-key="${esc(l.key)}">
        <div class="ci__art">${art({ ...i.cfg, steam: false }, i.name)}</div>
        <div><div class="ci__name">${esc(i.name)}</div><div class="ci__meta">${esc(i.meta)}</div>
          <div class="qty"><button data-dec aria-label="Meno">−</button><span>${l.qty}</span><button data-inc aria-label="Più">+</button></div></div>
        <div><div class="ci__price">${money(i.price * l.qty)}</div><button class="ci__rm" data-rm>Rimuovi</button></div>
      </li>`;
    }).join('');
    const t = totals();
    $('#tSub').textContent = money(t.sub);
    $('#tDiscRow').hidden = !t.disc;
    $('#tDisc').textContent = '−' + money(t.disc);
    $('#tShip').textContent = t.ship ? money(t.ship) : 'Gratis';
    $('#tTot').textContent = money(t.total);
    const left = FREE_SHIP - t.net;
    $('#shipMsg').innerHTML = left > 0 ? `Ti mancano <b>${money(left)}</b> per la spedizione gratuita` : 'Hai la <b>spedizione gratuita</b> 🎉';
    $('#shipBar').style.width = clamp(t.net / FREE_SHIP) * 100 + '%';
    if (coupon) $('#couponInput').value = coupon;
  }
  function addToCart(key, qty = 1, custom) {
    const line = cart.find((l) => l.key === key);
    if (line) line.qty = Math.min(20, line.qty + qty); else cart.push({ key, qty, ...(custom ? { custom } : {}) });
    saveCart(); renderCart();
    const name = custom ? 'Tazza su misura' : PRODUCTS.find((p) => p.id === key).name;
    toast(`${name} aggiunta al carrello ✓`);
    audio.clink();
  }
  $('#cartItems').addEventListener('click', (e) => {
    const li = e.target.closest('.ci'); if (!li) return;
    const l = cart.find((x) => x.key === li.dataset.key); if (!l) return;
    if (e.target.closest('[data-inc]')) l.qty = Math.min(20, l.qty + 1);
    else if (e.target.closest('[data-dec]')) l.qty -= 1;
    else if (e.target.closest('[data-rm]')) l.qty = 0;
    else return;
    if (l.qty <= 0) cart = cart.filter((x) => x !== l);
    saveCart(); renderCart();
  });
  $('#couponBtn').addEventListener('click', () => {
    const code = $('#couponInput').value.trim().toUpperCase();
    if (COUPONS[code]) { coupon = code; toast(`Codice ${code} applicato: −${COUPONS[code] * 100}%`); }
    else { coupon = null; toast(code ? 'Codice non valido' : 'Inserisci un codice'); }
    saveCart(); renderCart();
  });

  /* Checkout (demo, solo front-end) */
  const co = $('#checkoutModal'), coForm = $('#checkoutForm'), coDone = $('#checkoutDone');
  $('#checkoutBtn').addEventListener('click', () => {
    if (!cart.length) return;
    closeDrawer();
    coForm.hidden = false; coDone.hidden = true; coForm.reset();
    $('#coTotal').textContent = money(totals().total);
    openModal(co);
  });
  coForm.addEventListener('submit', (e) => {
    e.preventDefault();
    $('#orderNum').textContent = 'TDM-' + String(Math.floor(Math.random() * 900000) + 100000);
    $('#doneMug').innerHTML = art({ glaze: 'oro', shape: 'classica', emblem: 'swirl' }, 'Tazza oro');
    cart = []; coupon = null; $('#couponInput').value = ''; saveCart(); renderCart();
    coForm.hidden = true; coDone.hidden = false;
    audio.crack(8);
  });
  renderCart();

  /* ------------------------------------------------------------------ *
   * Configuratore (la tazza 3D della scena si posiziona nel riquadro)
   * ------------------------------------------------------------------ */
  const cfg = { shape: 'classica', glaze: 'cioccolato', emblem: 'swirl', label: '' };
  const cfgPrice = () => 29 + { classica: 0, alta: 3, bowl: 4 }[cfg.shape] + (cfg.label.trim() ? 4 : 0) + (cfg.emblem === 'fiamma' ? 2 : 0);
  const chips = (el, items, key) => {
    el.innerHTML = items.map(([v, l]) => `<button type="button" data-v="${v}">${esc(l)}</button>`).join('');
    el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; cfg[key] = b.dataset.v; renderCfg(); });
  };
  chips($('#cfgShape'), Object.entries(SHAPES).map(([k, s]) => [k, s.label]), 'shape');
  chips($('#cfgEmblem'), Object.entries(EMBLEMS), 'emblem');
  $('#cfgGlaze').innerHTML = Object.entries(GLAZES).map(([k, g]) => `<button type="button" data-v="${k}" aria-label="${esc(g.name)}" title="${esc(g.name)}" style="background:radial-gradient(circle at 35% 30%, ${g.light}, ${g.base} 55%, ${g.dark})"></button>`).join('');
  $('#cfgGlaze').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; cfg.glaze = b.dataset.v; renderCfg(); });
  $('#cfgLabel').addEventListener('input', (e) => { cfg.label = e.target.value.replace(/[^\p{L}\p{N} '’!?.,\-]/gu, '').slice(0, 18); renderCfg(); });
  let cfgDebounce;
  function renderCfg() {
    const map = { cfgShape: 'shape', cfgEmblem: 'emblem', cfgGlaze: 'glaze' };
    Object.entries(map).forEach(([id, key]) => $$('button', $('#' + id)).forEach((b) => {
      b.classList.toggle('is-active', b.dataset.v === cfg[key]);
      b.setAttribute('aria-pressed', String(b.dataset.v === cfg[key]));
    }));
    $('#cfgGlazeName').textContent = GLAZES[cfg.glaze].name;
    $('#cfgCount').textContent = cfg.label.length;
    $('#cfgPrice').textContent = money(cfgPrice());
    if (has3D()) {
      clearTimeout(cfgDebounce);
      cfgDebounce = setTimeout(() => window.TDM3D.setCustom({ ...cfg, label: cfg.label.trim() }), 120);
    } else $('#cfgFallback').innerHTML = mugSVG(cfg);
  }
  (function cfgDrag() {
    const box = $('#cfgPreview'); let last = null;
    box.addEventListener('pointerdown', (e) => { last = e.clientX; box.setPointerCapture(e.pointerId); });
    box.addEventListener('pointermove', (e) => { if (last === null || !has3D()) return; window.TDM3D.drag(e.clientX - last); last = e.clientX; });
    box.addEventListener('pointerup', () => { last = null; });
    box.addEventListener('pointercancel', () => { last = null; });
  })();
  $('#cfgForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const label = cfg.label.trim();
    const key = ['custom', cfg.shape, cfg.glaze, cfg.emblem, label].join('|');
    addToCart(key, 1, { shape: cfg.shape, glaze: cfg.glaze, emblem: cfg.emblem, label, price: cfgPrice() });
  });
  renderCfg();

  /* ------------------------------------------------------------------ *
   * Recensioni trascinabili
   * ------------------------------------------------------------------ */
  (function dragScroll() {
    const el = $('#vociTrack'); let down = false, sx = 0, sl = 0, moved = false;
    el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = el.scrollLeft; });
    addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 4) { moved = true; el.classList.add('drag'); }
      el.scrollLeft = sl - dx;
    });
    addEventListener('pointerup', () => { down = false; el.classList.remove('drag'); });
    el.addEventListener('click', (e) => { if (moved) e.preventDefault(); }, true);
  })();

  /* FAQ: una sola risposta aperta */
  const faqs = $$('.faq details');
  faqs.forEach((d) => d.addEventListener('toggle', () => { if (d.open) faqs.forEach((o) => { if (o !== d) o.open = false; }); }));

  /* Newsletter (demo: nessun invio reale) */
  $('#newsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const mail = $('#newsEmail').value.trim();
    $('#newsMsg').textContent = `Benvenuto nel club! Codice ARENA10 per ${mail.replace(/^(.).*(@.*)$/, '$1•••$2')} (demo).`;
    e.target.reset();
  });

  /* ------------------------------------------------------------------ *
   * Audio d'ambiente sintetizzato (nessun file): stanza, bordone, forno
   * ------------------------------------------------------------------ */
  const audio = (() => {
    let ctx = null, master = null, on = false, timer = null, noiseBuf = null;
    function build() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      const len = ctx.sampleRate * 4, brown = ctx.createBuffer(1, len, ctx.sampleRate), d = brown.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
      const room = ctx.createBufferSource(); room.buffer = brown; room.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      const rg = ctx.createGain(); rg.gain.value = .5;
      room.connect(lp).connect(rg).connect(master); room.start();
      [[55, .05], [82.4, .022], [110.6, .012]].forEach(([f, g]) => {
        const o = ctx.createOscillator(); o.frequency.value = f;
        const lfo = ctx.createOscillator(); lfo.frequency.value = .07 + Math.random() * .05;
        const lg = ctx.createGain(); lg.gain.value = f * .004; lfo.connect(lg).connect(o.frequency); lfo.start();
        const og = ctx.createGain(); og.gain.value = g; o.connect(og).connect(master); o.start();
      });
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .05, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (nd.length * .12));
      return true;
    }
    function pop(gain = .25) {
      if (!ctx || !on) return;
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = .6 + Math.random() * 1.2;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 3500; bp.Q.value = 1.4;
      const g = ctx.createGain(); g.gain.value = gain * (.3 + Math.random());
      s.connect(bp).connect(g).connect(master); s.start();
    }
    function heat() {
      const h = has3D() ? window.TDM3D.heat : 0;
      return Math.max(h, labP > .6 && labP < .82 ? .8 : 0);
    }
    return {
      toggle() {
        if (!ctx && !build()) { toast('Audio non supportato da questo browser'); return false; }
        on = !on;
        if (on) {
          ctx.resume();
          master.gain.cancelScheduledValues(ctx.currentTime);
          master.gain.linearRampToValueAtTime(.8, ctx.currentTime + 1.5);
          timer = setInterval(() => { if (Math.random() < .03 + heat() * .55) pop(.12 + heat() * .25); }, 55);
        } else {
          master.gain.cancelScheduledValues(ctx.currentTime);
          master.gain.linearRampToValueAtTime(0, ctx.currentTime + .6);
          clearInterval(timer);
        }
        return on;
      },
      crack(n = 4) { for (let i = 0; i < n; i++) setTimeout(() => pop(.35), i * (40 + Math.random() * 90)); },
      clink() {
        if (!ctx || !on) return;
        [1320, 1980, 2640].forEach((f, i) => {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * (1 + Math.random() * .01);
          const g = ctx.createGain(); g.gain.setValueAtTime(.08 / (i + 1), ctx.currentTime); g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + 1.2);
          o.connect(g).connect(master); o.start(); o.stop(ctx.currentTime + 1.3);
        });
      }
    };
  })();
  $('#soundBtn').addEventListener('click', (e) => {
    const on = audio.toggle();
    e.currentTarget.setAttribute('aria-pressed', String(!!on));
    e.currentTarget.setAttribute('aria-label', on ? "Disattiva l'audio d'ambiente" : "Attiva l'audio d'ambiente");
  });

  /* ------------------------------------------------------------------ *
   * Loop scroll unificato
   * ------------------------------------------------------------------ */
  let ticking = false;
  function onFrameScroll() { onScroll(); updateManifesto(); updateLab(); updateChapter(); ticking = false; }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onFrameScroll); } }, { passive: true });
  addEventListener('resize', onFrameScroll);
  onFrameScroll();
})();
