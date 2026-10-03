/* ==========================================================================
   tazzedimerda — interazioni, shop, carrello, configuratore
   Nessuna dipendenza: JavaScript puro.
   ========================================================================== */
(() => {
  'use strict';

  const { PRODUCTS, CATEGORIES, GLAZES, SHAPES, EMBLEMS, mugSVG, esc } = window.TDM;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const money = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage non disponibile */ } }
  };

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
   * Loader
   * ------------------------------------------------------------------ */
  $('#loaderMug').innerHTML = mugSVG({ glaze: 'oro', shape: 'classica', emblem: 'swirl' });
  const loaderMsgs = ['Accendo il forno ad Arena…', 'Impasto l’argilla…', 'Passo lo smalto…', 'Cuocio a 1.240 °C…', 'Collaudo le tazze…'];
  (function runLoader() {
    const num = $('#loaderNum'), bar = $('#loaderBar'), msg = $('#loaderMsg');
    const dur = reduceMotion ? 200 : 1900;
    const t0 = performance.now();
    function tick(t) {
      const p = clamp((t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      num.textContent = Math.round(eased * 100);
      bar.style.width = eased * 100 + '%';
      msg.textContent = loaderMsgs[Math.min(loaderMsgs.length - 1, Math.floor(p * loaderMsgs.length))];
      if (p < 1) requestAnimationFrame(tick); else done();
    }
    function done() { setTimeout(() => { document.body.classList.remove('is-loading'); }, 250); }
    requestAnimationFrame(tick);
    setTimeout(() => document.body.classList.remove('is-loading'), 5000); // rete di sicurezza
  })();

  /* ------------------------------------------------------------------ *
   * Hero: titolo, tazza e canvas particellare
   * ------------------------------------------------------------------ */
  $$('.line__in').forEach((el) => el.style.setProperty('--i', el.dataset.delay || 0));
  $('#heroMug').innerHTML = mugSVG({ glaze: 'oro', shape: 'classica', emblem: 'swirl' });

  const hero = $('#hero');
  const heroMug = $('#heroMug');
  if (finePointer && !reduceMotion) {
    hero.addEventListener('mousemove', (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      heroMug.style.transform = `rotate(${-8 + x * 14}deg) translate(${x * 30}px, ${y * 20}px)`;
    });
    hero.addEventListener('mouseleave', () => { heroMug.style.transform = ''; });
  }

  (function heroCanvas() {
    const cv = $('#heroCanvas');
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let w, h, dpr, parts = [], visible = true, mx = -999, my = -999;
    const COLORS = ['227,167,47', '182,242,58', '154,98,52', '244,234,216'];
    const make = (burst, bx, by) => {
      const a = Math.random() * Math.PI * 2, sp = Math.random() * 5 + 1;
      return {
        x: burst ? bx : Math.random() * w, y: burst ? by : h + Math.random() * 60,
        vx: burst ? Math.cos(a) * sp : (Math.random() - .5) * .3,
        vy: burst ? Math.sin(a) * sp - 1 : -(Math.random() * .6 + .15),
        r: Math.random() * 3 + .8, c: COLORS[(Math.random() * COLORS.length) | 0],
        life: burst ? 1 : Math.random() * .6 + .4, burst
      };
    };
    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = hero.clientWidth; h = hero.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(clamp(w / 14, 40, 110));
      parts = Array.from({ length: n }, () => { const p = make(); p.y = Math.random() * h; return p; });
    }
    function frame() {
      if (visible) {
        ctx.clearRect(0, 0, w, h);
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
          if (d2 < 14000) { const f = (1 - d2 / 14000) * 1.4; p.vx += (dx / Math.sqrt(d2 + 1)) * f * .35; p.vy += (dy / Math.sqrt(d2 + 1)) * f * .35; }
          p.x += p.vx + Math.sin((p.y + i * 30) * .01) * .25; p.y += p.vy;
          p.vx *= .985; p.vy = p.burst ? p.vy * .96 + .02 : p.vy * .995;
          if (p.burst) { p.life -= .012; if (p.life <= 0) { parts.splice(i, 1); continue; } }
          else if (p.y < -20) { parts[i] = make(); continue; }
          const a = p.burst ? p.life : p.life * Math.min(1, (h - p.y) / 160) * .75;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
          g.addColorStop(0, `rgba(${p.c},${a})`); g.addColorStop(1, `rgba(${p.c},0)`);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, 6.283); ctx.fill();
        }
      }
      requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener('resize', resize);
    hero.addEventListener('mousemove', (e) => { const r = hero.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
    hero.addEventListener('mouseleave', () => { mx = my = -999; });
    heroMug.addEventListener('click', (e) => {
      const r = hero.getBoundingClientRect();
      for (let i = 0; i < 46; i++) parts.push(make(true, e.clientX - r.left, e.clientY - r.top));
    });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
    if (!reduceMotion) requestAnimationFrame(frame);
  })();

  /* ------------------------------------------------------------------ *
   * Navigazione, progresso scroll, menu
   * ------------------------------------------------------------------ */
  const nav = $('#nav'), progress = $('#progress');
  let lastY = 0;
  function onScroll() {
    const y = window.scrollY, max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav.classList.toggle('is-solid', y > 40);
    nav.classList.toggle('is-hidden', y > lastY && y > 400 && !menu.classList.contains('is-open'));
    lastY = y;
  }
  const burger = $('#burger'), menu = $('#menu');
  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
    document.body.classList.toggle('no-scroll', open);
  }
  burger.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  $('#toTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
  $('#year').textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------ *
   * Cursore personalizzato + pulsanti magnetici
   * ------------------------------------------------------------------ */
  if (finePointer) {
    const cur = $('#cursor'), dot = $('span', cur);
    let cx = 0, cy = 0, tx = 0, ty = 0;
    window.addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function loop() { cx += (tx - cx) * .22; cy += (ty - cy) * .22; cur.style.transform = `translate(${cx}px, ${cy}px)`; requestAnimationFrame(loop); })();
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
   * Reveal, contatori, manifesto parola per parola
   * ------------------------------------------------------------------ */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: .15, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach((el, i) => { el.style.setProperty('--d', (i % 4) * .08 + 's'); io.observe(el); });

  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      countIO.unobserve(en.target);
      const el = en.target, end = +el.dataset.count, suf = el.dataset.suffix || '', t0 = performance.now(), dur = reduceMotion ? 1 : 2000;
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
    const p = clamp((innerHeight * .85 - r.top) / (r.height + innerHeight * .35));
    const n = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle('on', i < n));
  }

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
    entries.forEach((en) => { if (en.isIntersecting) { const el = en.target; setTimeout(() => el.classList.add('in'), i++ * 90); cardIO.unobserve(el); } });
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
        <button class="card__open" data-open="${p.id}" data-cursor="dettagli" aria-label="Vedi ${esc(p.name)}"></button>
        <div class="card__art" data-hint="Guarda da vicino">${mugSVG(p)}</div>
        <div class="card__info">
          <span class="card__cat">${esc(catLabel(p.cat))} · ${esc(p.cap)}</span>
          <h3 class="card__name">${esc(p.name)}</h3>
          <div class="card__row"><span class="card__price">${money(p.price)}</span>
            <button class="card__add" data-add="${p.id}" aria-label="Aggiungi ${esc(p.name)} al carrello" data-cursor="aggiungi">+</button></div>
        </div>
      </article>`).join('');
    $$('.card', grid).forEach((c) => cardIO.observe(c));
    if (finePointer && !reduceMotion) $$('.card', grid).forEach(tilt);
  }
  function tilt(card) {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      card.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  }
  grid.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) { addToCart(add.dataset.add); return; }
    const open = e.target.closest('[data-open]');
    if (open) openProduct(open.dataset.open);
  });
  renderGrid();

  /* ------------------------------------------------------------------ *
   * Modali / drawer (gestione comune)
   * ------------------------------------------------------------------ */
  const overlay = $('#overlay'), drawer = $('#drawer');
  let lastFocus = null;
  const openLayers = [];
  function lock() { document.body.classList.toggle('no-scroll', openLayers.length > 0 || menu.classList.contains('is-open')); }
  function openModal(el) {
    lastFocus = document.activeElement;
    el.classList.add('is-open'); el.setAttribute('aria-hidden', 'false'); openLayers.push(el); lock();
    setTimeout(() => ($('[data-close], input, button', el) || el).focus({ preventScroll: true }), 80);
  }
  function closeModal(el) {
    el.classList.remove('is-open'); el.setAttribute('aria-hidden', 'true');
    const i = openLayers.indexOf(el); if (i > -1) openLayers.splice(i, 1);
    lock(); if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  $$('.modal').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) closeModal(m); });
  });
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

  /* Dettaglio prodotto */
  const pm = $('#productModal');
  let pmId = null, pmQty = 1;
  function openProduct(id) {
    const p = PRODUCTS.find((x) => x.id === id); if (!p) return;
    pmId = id; pmQty = 1; $('#pmQty').textContent = 1;
    $('#pmArt').innerHTML = mugSVG(p);
    $('#pmCat').textContent = catLabel(p.cat);
    $('#pmName').textContent = p.name;
    $('#pmPrice').textContent = money(p.price);
    $('#pmDesc').textContent = p.desc;
    $('#pmSpecs').innerHTML = [`Capacità ${p.cap}`, `Peso ${p.peso}`, GLAZES[p.glaze].name, 'Lavastoviglie ok', 'Fatta ad Arena'].map((s) => `<li>${esc(s)}</li>`).join('');
    openModal(pm);
  }
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
  // Ripulisce eventuali righe non valide lette da localStorage
  cart = cart.filter((l) => l && typeof l.key === 'string' && Number.isInteger(l.qty) && l.qty > 0 && (l.custom || PRODUCTS.some((p) => p.id === l.key)));
  if (coupon && !COUPONS[coupon]) coupon = null;

  const itemInfo = (l) => {
    if (l.custom) {
      const c = l.custom;
      return { name: 'Tazza su misura', price: c.price, art: mugSVG({ ...c, steam: false }), meta: `${SHAPES[c.shape].label} · ${GLAZES[c.glaze].name}${c.label ? ' · “' + c.label + '”' : ''}` };
    }
    const p = PRODUCTS.find((x) => x.id === l.key);
    return { name: p.name, price: p.price, art: mugSVG({ ...p, steam: false }), meta: `${p.cap} · ${GLAZES[p.glaze].name}` };
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
        <div class="ci__art">${i.art}</div>
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
    $('#doneMug').innerHTML = mugSVG({ glaze: 'oro', shape: 'classica', emblem: 'swirl' });
    cart = []; coupon = null; $('#couponInput').value = ''; saveCart(); renderCart();
    coForm.hidden = true; coDone.hidden = false;
  });
  $('#emptyMug').innerHTML = mugSVG({ glaze: 'osso', shape: 'classica', emblem: 'nessuno', steam: false });
  renderCart();

  /* ------------------------------------------------------------------ *
   * Laboratorio: illustrazioni, mappa e scroll orizzontale
   * ------------------------------------------------------------------ */
  const ART = {
    argilla: `<svg viewBox="0 0 200 200"><ellipse cx="100" cy="168" rx="70" ry="10" fill="#000" opacity=".35"/>
      <path class="anim-pulse" d="M40 150c-6-40 10-84 60-92 52-8 78 36 62 86-6 14-30 20-60 20s-58-4-62-14z" fill="#6b3f1d"/>
      <path d="M62 112c18-10 40-8 60 4M56 132c24-8 52-6 80 4M78 90c14-6 30-4 42 4" stroke="#9a6234" stroke-width="5" fill="none" stroke-linecap="round"/>
      <circle cx="132" cy="84" r="6" fill="#9a6234" opacity=".6"/></svg>`,
    tornio: `<svg viewBox="0 0 200 200"><ellipse cx="100" cy="168" rx="72" ry="14" fill="#2a1a0e"/><ellipse class="anim-spin" cx="100" cy="150" rx="62" ry="12" fill="none" stroke="#e3a72f" stroke-width="3" stroke-dasharray="14 10"/>
      <path d="M72 150c-14-30-6-60 12-76 6-6 4-14 0-20h32c-4 6-6 14 0 20 18 16 26 46 12 76z" fill="#9a6234"/>
      <path d="M84 74c-6 12-8 30-2 48" stroke="#f7d77a" stroke-width="4" fill="none" stroke-linecap="round" opacity=".6"/>
      <path d="M142 90c10-8 22-6 30 4" stroke="#e3a72f" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`,
    smalto: `<svg viewBox="0 0 200 200"><path d="M50 70h100l-10 90a10 10 0 0 1-10 8H70a10 10 0 0 1-10-8z" fill="#3f2410"/>
      <ellipse cx="100" cy="70" rx="50" ry="12" fill="#e3a72f"/><ellipse cx="100" cy="72" rx="42" ry="8" fill="#f7d77a"/>
      <path d="M70 80v26a6 6 0 0 0 12 0V84M110 80v44a6 6 0 0 0 12 0V84M92 84v14a5 5 0 0 0 10 0V84" fill="#e3a72f"/>
      <circle class="anim-rise" cx="76" cy="132" r="5" fill="#e3a72f"/><circle class="anim-rise" style="animation-delay:-1.2s" cx="116" cy="148" r="5" fill="#b6f23a"/></svg>`,
    forno: `<svg viewBox="0 0 200 200"><path d="M30 180V90a70 70 0 0 1 140 0v90z" fill="#2a1a0e" stroke="#6b3f1d" stroke-width="6"/>
      <path d="M62 180v-60a38 38 0 0 1 76 0v60z" fill="#0a0705"/>
      <path class="anim-flicker" d="M100 178c-26 0-34-22-22-40 4 8 10 10 14 8-4-14 2-26 12-36 2 14 16 22 18 40 2 18-6 28-22 28z" fill="#e8452c"/>
      <path class="anim-flicker" style="animation-delay:-.4s" d="M100 178c-14 0-18-12-12-22 3 5 6 5 8 4-2-8 1-14 6-18 1 8 8 12 9 22 1 9-3 14-11 14z" fill="#e3a72f"/>
      <rect x="90" y="30" width="20" height="14" rx="3" fill="#6b3f1d"/></svg>`,
    collaudo: `<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="72" fill="none" stroke="#e3a72f" stroke-width="3" stroke-dasharray="3 9"/>
      <path d="M62 92h66l-4 50a10 10 0 0 1-10 9H76a10 10 0 0 1-10-9z" fill="#efe4d0"/><path d="M128 102c18-2 18 26-2 26" fill="none" stroke="#efe4d0" stroke-width="8" stroke-linecap="round"/>
      <ellipse cx="95" cy="92" rx="33" ry="7" fill="#b9a98c"/>
      <circle cx="146" cy="58" r="22" fill="#b6f23a"/><path d="M135 58l8 8 14-16" stroke="#0a0705" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };
  $$('[data-art]').forEach((el) => { el.innerHTML = ART[el.dataset.art] || ''; });

  $('#mapArt').innerHTML = `<svg viewBox="0 0 200 400" role="img" aria-label="Mappa stilizzata della Calabria con Arena evidenziata">
    <path d="M118 8L150 22 168 50 178 85 172 120 182 160 176 190 150 215 140 250 128 290 132 330 120 372 100 392 84 376 78 340 58 316 66 284 82 262 80 232 66 214 68 184 58 160 62 128 52 96 60 64 88 40Z" fill="rgba(10,7,5,.12)" stroke="#0a0705" stroke-width="3" stroke-linejoin="round"/>
    <g font-family="Space Grotesk, sans-serif" font-size="9" letter-spacing="2" fill="#0a0705" opacity=".6"><text x="4" y="150">TIRRENO</text><text x="140" y="300">IONIO</text></g>
    <g transform="translate(98 262)"><circle class="anim-pulse" r="18" fill="#0a0705" opacity=".25"/><circle r="7" fill="#0a0705"/><circle r="2.500" fill="#e3a72f"/></g>
    <g font-family="Unbounded, sans-serif" font-weight="800" font-size="12" fill="#0a0705"><text x="112" y="258">ARENA</text><text x="112" y="271" font-size="8" font-weight="500" font-family="Space Grotesk, sans-serif" letter-spacing="1.500">VIBO VALENTIA</text></g></svg>`;

  const lab = $('#lab'), labTrack = $('#labTrack'), labBar = $('#labBar'), labHead = $('.lab__head');
  const desk = window.matchMedia('(min-width: 861px)');
  let labShift = 0;
  function measureLab() {
    if (!desk.matches || reduceMotion) { lab.style.height = ''; labShift = 0; labTrack.style.transform = ''; return; }
    const visible = $('#labView').clientWidth;
    labShift = Math.max(0, labTrack.scrollWidth - visible);
    lab.style.height = innerHeight + labShift * 1.05 + 'px';
  }
  function updateLab() {
    if (!desk.matches || reduceMotion) return;
    const r = lab.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - innerHeight));
    labTrack.style.transform = `translate3d(${-p * labShift}px,0,0)`;
    labBar.style.transform = `scaleX(${p})`;
  }

  /* ------------------------------------------------------------------ *
   * Configuratore tazza su misura
   * ------------------------------------------------------------------ */
  const cfg = { shape: 'classica', glaze: 'cioccolato', emblem: 'swirl', label: '' };
  const cfgPrice = () => 29 + { classica: 0, alta: 3, bowl: 4 }[cfg.shape] + (cfg.label.trim() ? 4 : 0) + (cfg.emblem === 'fiamma' ? 2 : 0);
  const chips = (el, items, key) => {
    el.innerHTML = items.map(([v, l]) => `<button type="button" data-v="${v}" class="${cfg[key] === v ? 'is-active' : ''}">${esc(l)}</button>`).join('');
    el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; cfg[key] = b.dataset.v; renderCfg(); });
  };
  chips($('#cfgShape'), Object.entries(SHAPES).map(([k, s]) => [k, s.label]), 'shape');
  chips($('#cfgEmblem'), Object.entries(EMBLEMS), 'emblem');
  $('#cfgGlaze').innerHTML = Object.entries(GLAZES).map(([k, g]) => `<button type="button" data-v="${k}" aria-label="${esc(g.name)}" title="${esc(g.name)}" style="background:linear-gradient(135deg, ${g.light}, ${g.base} 55%, ${g.dark})"></button>`).join('');
  $('#cfgGlaze').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; cfg.glaze = b.dataset.v; renderCfg(); });
  $('#cfgLabel').addEventListener('input', (e) => { cfg.label = e.target.value.replace(/[^\p{L}\p{N} '’!?.,\-]/gu, '').slice(0, 18); renderCfg(); });
  function renderCfg() {
    $('#cfgPreview').innerHTML = mugSVG(cfg);
    ['cfgShape', 'cfgEmblem', 'cfgGlaze'].forEach((id) => {
      const key = { cfgShape: 'shape', cfgEmblem: 'emblem', cfgGlaze: 'glaze' }[id];
      $$('button', $('#' + id)).forEach((b) => b.classList.toggle('is-active', b.dataset.v === cfg[key]));
    });
    $('#cfgGlazeName').textContent = GLAZES[cfg.glaze].name;
    $('#cfgCount').textContent = cfg.label.length;
    $('#cfgPrice').textContent = money(cfgPrice());
  }
  $('#cfgPreview').addEventListener('mousemove', (e) => {
    if (reduceMotion) return;
    const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5;
    $('.mug', e.currentTarget).style.transform = `rotate(${x * 14}deg) scale(1.03)`;
  });
  $('#cfgPreview').addEventListener('mouseleave', (e) => { const m = $('.mug', e.currentTarget); if (m) m.style.transform = ''; });
  $('#cfgForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const label = cfg.label.trim();
    const key = ['custom', cfg.shape, cfg.glaze, cfg.emblem, label].join('|');
    addToCart(key, 1, { shape: cfg.shape, glaze: cfg.glaze, emblem: cfg.emblem, label, price: cfgPrice() });
  });
  renderCfg();

  /* ------------------------------------------------------------------ *
   * Recensioni: trascinamento orizzontale con il mouse
   * ------------------------------------------------------------------ */
  (function dragScroll() {
    const el = $('#vociTrack'); let down = false, sx = 0, sl = 0, moved = false;
    el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = el.scrollLeft; });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 4) { moved = true; el.classList.add('drag'); }
      el.scrollLeft = sl - dx;
    });
    window.addEventListener('pointerup', () => { down = false; el.classList.remove('drag'); });
    el.addEventListener('click', (e) => { if (moved) e.preventDefault(); }, true);
  })();

  /* ------------------------------------------------------------------ *
   * FAQ: una sola risposta aperta alla volta
   * ------------------------------------------------------------------ */
  const faqs = $$('.faq details');
  faqs.forEach((d) => d.addEventListener('toggle', () => { if (d.open) faqs.forEach((o) => { if (o !== d) o.open = false; }); }));

  /* ------------------------------------------------------------------ *
   * Newsletter (demo: nessun invio reale)
   * ------------------------------------------------------------------ */
  $('#newsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = $('#newsMsg'), mail = $('#newsEmail').value.trim();
    msg.textContent = `Benvenuto nel club! Codice ARENA10 per ${mail.replace(/^(.).*(@.*)$/, '$1•••$2')} (demo).`;
    e.target.reset();
  });

  /* ------------------------------------------------------------------ *
   * Loop scroll unificato
   * ------------------------------------------------------------------ */
  let ticking = false;
  function onFrameScroll() { onScroll(); updateManifesto(); updateLab(); ticking = false; }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onFrameScroll); } }, { passive: true });
  window.addEventListener('resize', () => { measureLab(); onFrameScroll(); });
  desk.addEventListener('change', () => { measureLab(); onFrameScroll(); });
  window.addEventListener('load', () => { measureLab(); onFrameScroll(); });
  measureLab(); onFrameScroll();
})();
