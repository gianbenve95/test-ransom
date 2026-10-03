/* ==========================================================================
   tazzedimerda — STAGE 3D
   Scena WebGL a tutto schermo: tazza in ceramica PBR, vapore volumetrico,
   particelle bokeh, post-produzione cinematografica e regia legata allo scroll.
   Sorgente: viene impacchettato in js/stage.js con `npm run build`.
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const { GLAZES } = window.TDM;

/* ---------------------------------------------------------------- utils */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const isMobile = () => innerWidth < 760;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
const linColor = (hex) => new THREE.Color(hex).toArray();

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
function mulberry(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ------------------------------------------------------------ GLSL noise */
const NOISE = /* glsl */`
  float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
  float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p=p*2.03+vec2(17.1,9.2); a*=.5; } return v; }
`;

/* ===================================================================== *
 *  GEOMETRIA DELLA TAZZA
 * ===================================================================== */
const SHAPE3D = {
  classica: { H: 1.0,  rB: .39, rT: .44, belly: .012, h1: .80, h2: .30, out: .30 },
  alta:     { H: 1.22, rB: .34, rT: .37, belly: .010, h1: .80, h2: .30, out: .28 },
  bowl:     { H: .80,  rB: .34, rT: .56, belly: .045, h1: .80, h2: .36, out: .22, curve: .62 }
};
const WALL = .05, BOT = .085;
const rAt = (s, y) => { const t = clamp(y / s.H); const e = s.curve ? Math.pow(t, s.curve) : t; return s.rB + (s.rT - s.rB) * e + s.belly * Math.sin(Math.PI * t); };

/** Profilo per il tornio (LatheGeometry): esterno dal basso verso l'alto, bordo, interno verso il fondo. */
function mugProfile(s) {
  const P = [];
  const V = (x, y) => P.push(new THREE.Vector2(Math.max(x, 1e-4), y));
  const rb = rAt(s, 0);
  V(0, .016); V(rb * .5, .016); V(rb * .74, .012); V(rb * .8, .003); V(rb * .86, 0); V(rb * .95, .002); V(rb * .99, .012);
  const wallStart = P.length;
  const N = 30, y0 = .03, y1 = s.H - WALL / 2;
  for (let i = 0; i <= N; i++) { const y = lerp(y0, y1, i / N); V(rAt(s, y), y); }
  const wallEnd = P.length - 1;
  const cR = rAt(s, y1) - WALL / 2;
  for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI; V(cR + Math.cos(a) * WALL / 2, y1 + Math.sin(a) * WALL / 2); }
  const rimMid = wallEnd + 4;
  const M = 24, yb = BOT + .03;
  for (let i = 1; i <= M; i++) { const y = lerp(y1, yb, i / M); V(rAt(s, y) - WALL, y); }
  const rIn = rAt(s, yb) - WALL;
  V(rIn * .93, BOT + .006); V(rIn * .75, BOT); V(rIn * .4, BOT); V(0, BOT);
  return { P, wallStart, wallEnd, rimMid, y0, y1 };
}

/** Stesso numero di punti, ma a forma di blocco d'argilla grezza (per il morph argilla → tazza). */
function lumpProfile(info, s) {
  const n = info.P.length, R = .47 * (s.rB / .39) ** .5, Ry = .36, cy = Ry * .78;
  return info.P.map((_, i) => {
    if (i <= info.rimMid) {
      const u = i / info.rimMid, th = -Math.PI / 2 + u * Math.PI;
      const wob = 1 + .07 * Math.sin(u * Math.PI * 5) + .03 * Math.sin(u * 23);
      const sy = Math.sin(th);
      return new THREE.Vector2(Math.max(1e-4, R * Math.cos(th) * wob), Math.max(0, cy + Ry * sy * (sy < 0 ? .78 : 1)));
    }
    return new THREE.Vector2(1e-4 + (n - i) * 1e-4, cy + Ry - .02 - (i - info.rimMid) * .0004);
  });
}

function handleGeometry(s) {
  const ya = s.H * s.h1, yb = s.H * s.h2, ra = rAt(s, ya) - .025, rb = rAt(s, yb) - .025, o = s.out;
  const cy = (ya + yb) / 2, ry = (ya - yb) / 2, pts = [];
  for (let i = 0; i <= 14; i++) {
    const a = Math.PI / 2 - (i / 14) * Math.PI;           // da sopra a sotto, passando all'esterno
    const base = lerp(ra, rb, i / 14);
    const bulge = Math.pow(Math.cos(a), .75);              // più pieno di un'ellisse: manico "a orecchio"
    pts.push(new THREE.Vector3(base + o * bulge, cy + Math.sin(a) * (ry + .03 * Math.cos(a)), 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  return new THREE.TubeGeometry(curve, 90, .05, 24, false);
}

/* ---------------------------------------------- emblemi (stessi dell'SVG) */
const EMBLEM_PATHS = {
  swirl: {
    w: 48, cy: 2,
    fill: ['M-24 14c0-8 11-12 24-12s24 4 24 12-11 10-24 10-24-2-24-10z', 'M-17 2c0-7 8-10 17-10s17 3 17 10-8 8-17 8-17-1-17-8z',
      'M-10-8c0-6 5-8 10-8s10 2 10 8-5 6-10 6-10 0-10-6z', 'M-3-16c0-5 2-9 3-11 2 3 4 6 3 11z'],
    holes: [['circle', -7, 12, 2.6], ['circle', 7, 12, 2.6]],
    stroke: ['M-5 18q5 4 10 0'],
    tiers: ['M-17 6c4 3 10 4 17 4s13-1 17-4', 'M-10-4c3 2 6 3 10 3s7-1 10-3', 'M-4-13c1 1 3 1 4 1s3 0 4-1']
  },
  fiamma: {
    w: 34, cy: -4,
    fill: ['M0-28c4 10 16 14 16 28a16 16 0 0 1-32 0c0-8 4-12 8-16 0 6 3 8 6 8-3-8-2-14 2-20z'],
    holes: [], stroke: [],
    cut: ['M0-6c2 6 8 8 8 15a8 8 0 0 1-16 0c0-4 3-6 5-9 0 3 1 4 3 4-1-4-1-7 0-10z']
  }
};

/**
 * Maschera dati della tazza (non è un'immagine a colori):
 *  R = emblema/scritta, G = piede non smaltato, B = puntinatura ferrosa del gres.
 */
function makeMask(info, s, cfg) {
  const W = 2048, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const rnd = mulberry(7);
  for (let i = 0; i < 3600; i++) {
    ctx.fillStyle = `rgba(0,0,255,${.2 + rnd() * .8})`;
    ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, .5 + rnd() * rnd() * 2.6, 0, 6.283); ctx.fill();
  }
  const n = info.P.length, v = (i) => i / (n - 1), yPx = (vv) => (1 - vv) * H;
  const footTop = yPx(v(info.wallStart + .6));
  ctx.fillStyle = '#0f0'; ctx.fillRect(0, footTop, W, H - footTop);

  const bandTop = yPx(v(info.wallEnd)), bandBot = yPx(v(info.wallStart));
  const pxY = (bandBot - bandTop) / (info.y1 - info.y0);
  const rMid = rAt(s, s.H * .5);
  const a = (W / (2 * Math.PI * rMid)) / pxY; // compressione orizzontale
  const yAt = (yUnits) => bandBot - (yUnits - info.y0) * pxY;
  const label = (cfg.label || '').toUpperCase().slice(0, 18);
  const em = EMBLEM_PATHS[cfg.emblem];
  const emY = s.H * (label ? .58 : .5);

  const uFront = .1; // la tazza è ruotata di ~-0.6 rad: l'emblema deve guardare la camera
  for (const x0 of [W * uFront, W * (uFront + 1), W * (uFront - 1)]) {
    if (em) {
      const k = (.34 * pxY) / em.w;
      ctx.setTransform(a * k, 0, 0, k, x0, yAt(emY));
      // disegno su canvas separato per poter "bucare" occhi e bocca
      const size = Math.ceil(em.w * 1.6 * k * Math.max(1, a)) + 8;
      const ec = document.createElement('canvas'); ec.width = ec.height = size;
      const e = ec.getContext('2d');
      e.setTransform(a * k, 0, 0, k, size / 2, size / 2);
      e.translate(0, -em.cy);
      e.fillStyle = '#f00';
      em.fill.forEach((d) => e.fill(new Path2D(d)));
      e.globalCompositeOperation = 'destination-out';
      em.holes.forEach(([, x, y, r]) => { e.beginPath(); e.arc(x, y, r, 0, 6.283); e.fill(); });
      (em.cut || []).forEach((d) => { e.globalAlpha = .55; e.fill(new Path2D(d)); e.globalAlpha = 1; });
      e.lineWidth = 2; e.lineCap = 'round';
      em.stroke.forEach((d) => e.stroke(new Path2D(d)));
      e.lineWidth = 1.7;
      (em.tiers || []).forEach((d) => e.stroke(new Path2D(d)));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(ec, x0 - size / 2, yAt(emY) - size / 2);
    }
    if (label) {
      const fs = Math.round(.082 * pxY * (label.length > 12 ? .72 : label.length > 8 ? .86 : 1));
      ctx.setTransform(a, 0, 0, 1, x0, yAt(em ? s.H * .3 : s.H * .5));
      ctx.font = `800 ${fs}px Unbounded, "Arial Black", Impact, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      try { ctx.letterSpacing = `${Math.round(fs * .08)}px`; } catch { /* non supportato */ }
      ctx.fillStyle = '#f00';
      ctx.fillText(label, 0, 0, 2 * Math.PI * rMid * .27 * pxY);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  return tex;
}
function speckleMask() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 512);
  const rnd = mulberry(3);
  for (let i = 0; i < 700; i++) { ctx.fillStyle = `rgba(0,0,255,${.2 + rnd() * .8})`; ctx.beginPath(); ctx.arc(rnd() * 512, rnd() * 512, .5 + rnd() * 1.6, 0, 6.283); ctx.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function cremaTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(256, 256, 10, 256, 256, 256);
  g.addColorStop(0, '#2a1308'); g.addColorStop(.55, '#3b1d0c'); g.addColorStop(.82, '#6e4122'); g.addColorStop(.93, '#8c5a32'); g.addColorStop(1, '#4a2612');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
  const rnd = mulberry(11);
  for (let i = 0; i < 900; i++) { const r = 120 + rnd() * 130, a = rnd() * 6.283; ctx.fillStyle = `rgba(190,140,90,${rnd() * .12})`; ctx.beginPath(); ctx.arc(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 1 + rnd() * 4, 0, 6.283); ctx.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ===================================================================== *
 *  MATERIALE CERAMICO (MeshPhysicalMaterial + iniezione shader)
 * ===================================================================== */
function ceramicMaterial(U) {
  const m = new THREE.MeshPhysicalMaterial({ roughness: .15, metalness: 0, clearcoat: .8, clearcoatRoughness: .05, envMapIntensity: 1.05 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uEmblemColor; uniform float uEmblemAmt; uniform vec3 uRawColor; uniform float uRaw;
        uniform float uRawRough; uniform float uSpeckle; uniform float uFootGlaze;`)
      .replace('#include <map_fragment>', `
        vec4 mk = texture2D(map, vMapUv);
        float rawM = max(mk.g * (1.0 - uFootGlaze), uRaw);
        float speck = mk.b * uSpeckle;
        vec3 glazeC = mix(diffuseColor.rgb, uEmblemColor, mk.r * uEmblemAmt) * (1.0 - speck * 0.22);
        vec3 rawC = uRawColor * (1.0 - speck * 0.5);
        diffuseColor.rgb = mix(glazeC, rawC, rawM);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor + mk.r * uEmblemAmt * 0.12, uRawRough, rawM);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor *= (1.0 - rawM) * (1.0 - mk.r * uEmblemAmt);`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        #ifdef USE_CLEARCOAT
          material.clearcoat *= (1.0 - rawM);
        #endif`);
  };
  return m;
}

/* ===================================================================== *
 *  LA TAZZA
 * ===================================================================== */
class Mug {
  constructor() {
    this.U = {
      uEmblemColor: { value: new THREE.Color() }, uEmblemAmt: { value: 1 },
      uRawColor: { value: new THREE.Color('#8f7560') }, uRaw: { value: 0 }, uRawRough: { value: .9 },
      uSpeckle: { value: 1 }, uFootGlaze: { value: 0 }
    };
    this.mat = ceramicMaterial(this.U);
    this.hMat = ceramicMaterial(this.U);
    this.hMat.map = speckleMask();
    this.coffeeMat = new THREE.MeshPhysicalMaterial({ map: cremaTexture(), roughness: .06, clearcoat: 1, clearcoatRoughness: .02 });
    this.group = new THREE.Group();
    this.spin = new THREE.Group();
    this.group.add(this.spin);
    this.body = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.handle = new THREE.Mesh(new THREE.BufferGeometry(), this.hMat);
    this.handle.scale.z = 1.3;
    this.coffee = new THREE.Mesh(new THREE.CircleGeometry(1, 72), this.coffeeMat);
    this.coffee.rotation.x = -Math.PI / 2;
    this.spin.add(this.body, this.handle, this.coffee);
    this.key = '';
    this.H = 1;
  }
  configure(cfg) {
    const key = [cfg.shape, cfg.emblem, cfg.label].join('|');
    if (key === this.key) return;
    this.key = key;
    const s = SHAPE3D[cfg.shape] || SHAPE3D.classica;
    this.H = s.H; this.shape = s;
    const info = mugProfile(s);
    const geo = new THREE.LatheGeometry(info.P, 144);
    const lump = new THREE.LatheGeometry(lumpProfile(info, s), 144);
    geo.morphAttributes.position = [lump.attributes.position];
    geo.morphAttributes.normal = [lump.attributes.normal];
    this.body.geometry.dispose(); this.body.geometry = geo; this.body.updateMorphTargets();
    if (this.mat.map) this.mat.map.dispose();
    this.mat.map = makeMask(info, s, cfg); this.mat.needsUpdate = true;
    this.handle.geometry.dispose(); this.handle.geometry = handleGeometry(s);
    const yc = s.H - .17;
    this.coffeeY = yc; this.coffeeR = rAt(s, yc) - WALL - .003;
    this.coffee.position.y = yc;
  }
  apply(st) {
    this.mat.color.fromArray(st.glaze); this.hMat.color.fromArray(st.glaze);
    for (const m of [this.mat, this.hMat]) {
      m.roughness = st.rough; m.metalness = st.metal; m.clearcoat = Math.max(.02, st.coat);
      m.emissive.setRGB(1, .2, .03); m.emissiveIntensity = st.heat * .75;
    }
    this.U.uEmblemColor.value.fromArray(st.emblemCol);
    this.U.uEmblemAmt.value = st.emblem;
    this.U.uRaw.value = st.raw; this.U.uRawRough.value = st.rawRough;
    this.U.uRawColor.value.fromArray(st.rawCol);
    if (this.body.morphTargetInfluences) this.body.morphTargetInfluences[0] = st.morph;
    const h = Math.max(.0001, st.handle);
    this.handle.scale.set(h, h, 1.3 * h); this.handle.visible = st.handle > .01;
    const cf = clamp(st.coffee);
    this.coffee.visible = cf > .01;
    this.coffee.scale.set(this.coffeeR * cf, this.coffeeR * cf, 1);
    this.coffee.position.y = this.coffeeY - (1 - cf) * .25;
  }
}

/* -------------------------------------------- stati "finiti" per smalto */
function finishedState(glazeKey, finish) {
  const g = GLAZES[glazeKey] || GLAZES.oro;
  const opaco = finish === 'opaco';
  return {
    morph: 0, raw: 0, rawCol: linColor('#b9a58c'), rawRough: .9, handle: 1, emblem: 1, coffee: 1, heat: 0,
    glaze: linColor(g.base), emblemCol: linColor(g.emblem),
    rough: opaco ? .55 : g.rough, metal: g.metal, coat: opaco ? .05 : g.coat,
    swirl: 0, clay: 0, rise: .1, dust: 1, spin: 0, ry: -.55, vis: 1, x: .5, y: .5, s: .5, glow: .35
  };
}

/* La lavorazione: argilla → tornio → essiccazione → smalto → forno → collaudo */
const LAB_KEYS = (() => {
  const base = finishedState('oro');
  const raw = { raw: 1, emblem: 0, handle: 0, coffee: 0 };
  return [
    { p: .00, ...raw, morph: 1, rawCol: linColor('#8a6a52'), rawRough: .95, spin: .25, swirl: .25, clay: 1, rise: .05, glow: .25 },
    { p: .14, ...raw, morph: 1, rawCol: linColor('#8a6a52'), rawRough: .95, spin: .4, swirl: .3, clay: 1, rise: .05, glow: .25 },
    { p: .27, ...raw, morph: .55, rawCol: linColor('#6a4c38'), rawRough: .32, spin: 9, swirl: 1, clay: .8, rise: .1, glow: .3 },
    { p: .36, ...raw, morph: 0, rawCol: linColor('#6a4c38'), rawRough: .3, spin: 7, swirl: .9, clay: .6, glow: .3 },
    { p: .44, ...raw, morph: 0, rawCol: linColor('#bca88f'), rawRough: .92, handle: 1, spin: .6, swirl: .2, clay: .3, glow: .3 },
    { p: .55, morph: 0, raw: 0, emblem: 1, handle: 1, coffee: 0, spin: .5, swirl: .4, clay: 0, glow: .4 },
    { p: .63, morph: 0, raw: 0, emblem: 1, handle: 1, coffee: 0, heat: .15, spin: .3, glow: .5 },
    { p: .71, morph: 0, raw: 0, emblem: 1, handle: 1, coffee: 0, heat: 1, spin: .25, rise: 1, glow: 1.1, metal: .35, rough: .35, glaze: linColor('#c2541d') },
    { p: .79, morph: 0, raw: 0, emblem: 1, handle: 1, coffee: 0, heat: .85, spin: .25, rise: .9, glow: .95, metal: .4, rough: .32, glaze: linColor('#c65f22') },
    { p: .88, morph: 0, raw: 0, emblem: 1, handle: 1, coffee: 1, heat: 0, spin: .35, swirl: .5, rise: .15, glow: .55 },
    { p: 1.0, morph: 0, raw: 0, emblem: 1, handle: 1, coffee: 1, heat: 0, spin: .35, swirl: .5, rise: .15, glow: .55 }
  ].map((k) => ({ ...base, ...k }));
})();

function mixStates(a, b, t) {
  const o = {};
  for (const k in a) {
    const va = a[k], vb = b[k];
    o[k] = Array.isArray(va) ? va.map((x, i) => lerp(x, vb[i], t)) : lerp(va, vb, t);
  }
  return o;
}
function sampleLab(p) {
  for (let i = 0; i < LAB_KEYS.length - 1; i++) {
    const a = LAB_KEYS[i], b = LAB_KEYS[i + 1];
    if (p <= b.p) return mixStates(a, b, smooth(clamp((p - a.p) / (b.p - a.p))));
  }
  return { ...LAB_KEYS[LAB_KEYS.length - 1] };
}

/* ===================================================================== *
 *  SHADER: particelle, vapore, fondale, finale pellicola
 * ===================================================================== */
const PARTICLE_VS = /* glsl */`
  attribute vec4 aSeed;
  uniform float uTime, uPR, uSize, uSwirl, uHeat, uClay, uRise, uBurstT, uOpacity, uFocus;
  uniform vec3 uMug, uMouse, uBurstPos;
  varying float vA, vBlur; varying vec3 vCol;
  void main(){
    vec3 p = position;
    float sp = .25 + aSeed.y;
    p.y = mod(p.y + uTime * (.05 + uRise * .55) * sp + 3.0, 6.0) - 3.0;
    p.x += sin(uTime * .21 * sp + aSeed.z * 6.283) * .25 + uHeat * sin(uTime * 2.3 + aSeed.w * 20.) * .07;
    p.z += cos(uTime * .17 * sp + aSeed.w * 6.283) * .25;
    float rad = .7 + aSeed.x * 1.6;
    float ang = aSeed.y * 6.2831 + uTime * (.25 + aSeed.z * .9) * (1.3 / rad);
    vec3 orb = uMug + vec3(cos(ang) * rad, (aSeed.w - .5) * 2.2 + sin(uTime * .5 + aSeed.x * 9.) * .1, sin(ang) * rad * .7);
    p = mix(p, orb, uSwirl * step(aSeed.x, .7));
    vec3 dm = p - uMouse; float fm = exp(-dot(dm, dm) * 1.8);
    p += normalize(dm + 1e-4) * fm * .6;
    if (uBurstT < 5. && aSeed.z < .3) {
      vec3 dir = normalize(vec3(aSeed.x - .5, aSeed.y - .2, aSeed.w - .5) + 1e-4);
      float k = 1. - exp(-uBurstT * 2.6);
      vec3 bp = uBurstPos + dir * k * (1.1 + aSeed.y * 2.) + vec3(0., uBurstT * uBurstT * .06, 0.);
      p = mix(p, bp, exp(-uBurstT * .8));
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    float dist = -mv.z;
    vBlur = clamp(abs(dist - uFocus) / 3.2, 0., 1.);
    float tw = .6 + .4 * sin(uTime * (1.5 + aSeed.x * 3.) + aSeed.w * 30.);
    float flick = .55 + .45 * sin(uTime * 13. * aSeed.y + aSeed.x * 40.);
    vA = uOpacity * tw * (.3 + .7 * aSeed.z) * (1. - vBlur * .6);
    vec3 dust = mix(vec3(1., .74, .38), vec3(1., .93, .8), aSeed.w);
    vec3 clay = vec3(.5, .32, .2);
    vec3 ember = mix(vec3(1., .28, .04), vec3(1., .7, .2), aSeed.w) * (1.2 + flick);
    vCol = mix(mix(dust, clay, uClay), ember, uHeat);
    gl_PointSize = uSize * (.35 + aSeed.y * .9) * (1. + vBlur * 2.4) * uPR * (6. / dist);
    gl_Position = projectionMatrix * mv;
  }`;
const PARTICLE_FS = /* glsl */`
  varying float vA, vBlur; varying vec3 vCol;
  void main(){
    float r = length(gl_PointCoord - .5);
    float a = smoothstep(.5, .5 - mix(.1, .48, vBlur), r);
    a *= mix(1., .5 + .5 * smoothstep(.22, .46, r), vBlur * .7);
    if (a < .004) discard;
    gl_FragColor = vec4(vCol, a * vA);
  }`;

const STEAM_VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const STEAM_FS = /* glsl */`
  varying vec2 vUv; uniform float uTime, uAmt, uSeed;
  ${NOISE}
  void main(){
    float t = uTime * .16;
    vec2 uv = vUv;
    float bend = (fbm(vec2(uv.y * 2.2 - t * 1.4, uSeed)) - .5) * .55 * uv.y;
    float x = uv.x - .5 + bend;
    float width = mix(.05, .34, pow(uv.y, .8));
    float col = smoothstep(width, width * .1, abs(x));
    vec2 q = vec2(x * 3.2 + uSeed, uv.y * 2.4 - t * 2.2);
    float n = fbm(q + vec2(fbm(q * 1.7 + t), fbm(q * 1.3 - t)) * 1.2);
    float fade = smoothstep(0., .14, uv.y) * smoothstep(1., .4, uv.y);
    float a = col * fade * smoothstep(.38, .82, n) * uAmt;
    gl_FragColor = vec4(vec3(1., .96, .9), a * .36);
  }`;

const BACKDROP_VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, .9999, 1.); }`;
const BACKDROP_FS = /* glsl */`
  varying vec2 vUv; uniform float uTime, uGlowAmt, uAspect; uniform vec2 uGlowPos; uniform vec3 uBase, uGlow;
  ${NOISE}
  void main(){
    vec2 p = (vUv - uGlowPos) * vec2(uAspect, 1.);
    float glow = exp(-dot(p, p) * 2.6) * uGlowAmt;
    float smoke = fbm(vUv * vec2(uAspect, 1.) * 2.4 + vec2(uTime * .018, -uTime * .03));
    float smoke2 = fbm(vUv * vec2(uAspect, 1.) * 5. - vec2(uTime * .01, uTime * .05));
    vec3 col = uBase + uGlow * glow * (.45 + .9 * smoke * smoke2) + uGlow * .025 * smoke;
    gl_FragColor = vec4(col, 1.);
  }`;

const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uCA: { value: .006 }, uGrain: { value: .045 }, uVig: { value: .6 }, uRes: { value: new THREE.Vector2(1, 1) }, uFade: { value: 1 } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uCA, uGrain, uVig, uFade; uniform vec2 uRes; varying vec2 vUv;
    float rnd(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - .5; float r2 = dot(d, d);
      vec2 off = d * r2 * uCA;
      vec3 col = vec3(texture2D(tDiffuse, vUv - off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + off).b);
      float vig = smoothstep(.9, .25, length(d * vec2(1., .92)));
      col *= mix(1. - uVig, 1., vig);
      col += (rnd(floor(vUv * uRes) + fract(uTime) * 91.7) - .5) * uGrain;
      col *= uFade;
      gl_FragColor = vec4(col, 1.);
    }`
};

/* ===================================================================== *
 *  STUDIO FOTOGRAFICO (render prodotto per lo shop)
 * ===================================================================== */
class Studio {
  constructor() {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.VSMShadowMap;
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
    this.scene.environmentIntensity = .85;
    const key = new THREE.DirectionalLight('#fff0dc', 2.4);
    key.position.set(-2.2, 4.5, 2.6); key.castShadow = true;
    Object.assign(key.shadow, { radius: 14, blurSamples: 24 });
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: .5, far: 12 });
    key.shadow.bias = -.0005;
    const rim = new THREE.DirectionalLight('#ffb347', 2.2); rim.position.set(3, 2.2, -3);
    this.scene.add(key, rim);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: .5 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    this.scene.add(floor);
    this.mug = new Mug();
    this.mug.body.castShadow = this.mug.handle.castShadow = true;
    this.scene.add(this.mug.group);
    this.cam = new THREE.PerspectiveCamera(24, 1, .1, 40);
  }
  shot(cfg, angle = 0, size = 640, type = 'image/webp') {
    this.mug.configure(cfg);
    this.mug.apply(finishedState(cfg.glaze, cfg.finish));
    const s = SHAPE3D[cfg.shape] || SHAPE3D.classica;
    this.mug.spin.rotation.y = -.62 + angle; // emblema frontale, manico a 3/4
    this.mug.group.position.x = -s.out * .32;
    const fit = Math.max(s.H, (s.rT + s.out) * 2) * 1.32;
    const d = fit / (2 * Math.tan(THREE.MathUtils.degToRad(12)));
    this.cam.position.set(0, s.H * .5 + d * .32, d);
    this.cam.lookAt(0, s.H * .44, 0);
    this.renderer.setSize(size, size, false);
    this.renderer.render(this.scene, this.cam);
    return this.renderer.domElement.toDataURL(type, .9);
  }
}

/* ===================================================================== *
 *  STAGE PRINCIPALE
 * ===================================================================== */
async function init() {
  if (!webglOK()) throw new Error('WebGL non disponibile');
  const canvas = document.getElementById('stage');
  const mobile = isMobile();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const DPR = Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.6);
  renderer.setPixelRatio(DPR);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .92;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, .1, 60);
  camera.position.set(0, 0, 6);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .62;
  emit('tdm:progress', .15);

  /* luci */
  const key = new THREE.DirectionalLight('#fff1dc', 1.7); key.position.set(-3, 4, 4);
  const rim = new THREE.DirectionalLight('#ffb347', 2.2); rim.position.set(3.5, 2, -3);
  const heatLight = new THREE.PointLight('#ff5a1f', 0, 7, 1.5);
  scene.add(key, rim, heatLight);

  /* fondale atmosferico */
  const backdropU = { uTime: { value: 0 }, uGlowAmt: { value: .35 }, uAspect: { value: innerWidth / innerHeight }, uGlowPos: { value: new THREE.Vector2(.7, .5) }, uBase: { value: new THREE.Color('#0a0705') }, uGlow: { value: new THREE.Color('#e3a72f') } };
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: backdropU, vertexShader: BACKDROP_VS, fragmentShader: BACKDROP_FS, depthWrite: false, depthTest: false }));
  backdrop.frustumCulled = false; backdrop.renderOrder = -10;
  scene.add(backdrop);

  /* particelle */
  const N = mobile ? 1800 : 4200;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N * 4);
  const rnd = mulberry(42);
  for (let i = 0; i < N; i++) {
    pos.set([(rnd() - .5) * 11, (rnd() - .5) * 6, -4.5 + rnd() * 7.2], i * 3);
    seed.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const PU = {
    uTime: { value: 0 }, uPR: { value: DPR }, uSize: { value: mobile ? 7 : 6 }, uSwirl: { value: 0 }, uHeat: { value: 0 }, uClay: { value: 0 },
    uRise: { value: .1 }, uBurstT: { value: 99 }, uOpacity: { value: .62 }, uFocus: { value: 6 },
    uMug: { value: new THREE.Vector3() }, uMouse: { value: new THREE.Vector3(99, 99, 99) }, uBurstPos: { value: new THREE.Vector3() }
  };
  const particles = new THREE.Points(pGeo, new THREE.ShaderMaterial({ uniforms: PU, vertexShader: PARTICLE_VS, fragmentShader: PARTICLE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  particles.frustumCulled = false;
  scene.add(particles);

  /* la tazza */
  const mug = new Mug();
  const DEFAULT_CFG = { shape: 'classica', emblem: 'swirl', label: '', glaze: 'oro' };
  mug.configure(DEFAULT_CFG);
  scene.add(mug.group);

  /* vapore */
  const steam = new THREE.Group();
  const steamMats = [0, 1, 2, 3].map((i) => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAmt: { value: 1 }, uSeed: { value: i * 3.7 + 1.3 } },
    vertexShader: STEAM_VS, fragmentShader: STEAM_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide
  }));
  steamMats.forEach((m, i) => {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.7), m);
    pl.position.set((i - 1.5) * .07, .85, (i % 2 ? -.05 : .05));
    pl.rotation.y = (i - 1.5) * .5;
    pl.renderOrder = 5;
    steam.add(pl);
  });
  scene.add(steam);
  emit('tdm:progress', .3);

  /* post-produzione */
  const rt = new THREE.WebGLRenderTarget(innerWidth * DPR, innerHeight * DPR, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(DPR);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .32, .6, .95);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const final = new ShaderPass(FinalShader);
  composer.addPass(final);
  final.uniforms.uRes.value.set(innerWidth * DPR, innerHeight * DPR);

  renderer.compile(scene, camera);
  emit('tdm:progress', .4);

  /* ---------------------------------------------------- input */
  const mouse = { x: 0, y: 0, sx: 0, sy: 0, inside: false };
  addEventListener('pointermove', (e) => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = e.clientY / innerHeight * 2 - 1; mouse.inside = true; }, { passive: true });
  document.addEventListener('pointerleave', () => { mouse.inside = false; });
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -.5), hit = new THREE.Vector3();

  let custom = { ...DEFAULT_CFG, glaze: 'cioccolato' };
  let dragVel = 0, dragAcc = 0, spinAcc = 0, baseRy = -.55, burstT = 99, introT = reduceMotion ? 1 : 0, introOn = reduceMotion;
  let lastScroll = scrollY, vel = 0, heatNow = 0;

  /* ---------------------------------------------------- regia */
  const SECTIONS = ['hero', 'manifesto', 'lab', 'shop', 'custom', 'voci', 'faq', 'contatti', 'fine'];
  const hidden = (m) => ({ x: .5, y: -.42, s: m ? .3 : .38, vis: 0, ry: 1.2 });
  const PLACES = {
    hero:      (m) => (m ? { x: .72, y: .4, s: .19, ry: -.55 } : { x: .72, y: .52, s: .45, ry: -.55 }),
    manifesto: (m) => (m ? { x: .8, y: .14, s: .2, ry: 2.4, swirl: .6 } : { x: .85, y: .5, s: .4, ry: 2.4, swirl: 1 }),
    lab:       (m) => (m ? { x: .54, y: .44, s: .25 } : { x: .62, y: .52, s: .5 }),
    shop: hidden, voci: hidden, faq: hidden, contatti: hidden,
    custom:    () => ({}),
    fine:      (m) => (m ? { x: .5, y: .17, s: .15, ry: -.55, spin: .35 } : { x: .5, y: .155, s: .2, ry: -.55, spin: .35 })
  };
  const els = SECTIONS.map((id) => document.getElementById(id));
  const cfgBox = () => document.getElementById('cfgPreview');

  function targetState(labP) {
    const vh = innerHeight, c = vh * .5, m = isMobile();
    const ws = [], states = [];
    let sum = 0;
    els.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const d = c >= r.top && c <= r.bottom ? 0 : Math.min(Math.abs(r.top - c), Math.abs(r.bottom - c));
      const w = 1 - smooth(clamp(d / (vh * .45)));
      if (w <= 0) return;
      const id = SECTIONS[i];
      let st;
      if (id === 'lab') st = { ...sampleLab(labP), ...PLACES.lab(m) };
      else if (id === 'custom') {
        const b = cfgBox();
        const br = b ? b.getBoundingClientRect() : { left: 0, width: innerWidth, top: 0, height: vh };
        st = { ...finishedState(custom.glaze), x: (br.left + br.width / 2) / innerWidth, y: (br.top + br.height * .53) / vh, s: (br.height / vh) * .5, ry: -.55, spin: 0 };
      } else st = { ...finishedState('oro'), ...PLACES[id](m) };
      ws.push({ w, id }); states.push(st); sum += w;
    });
    if (!states.length) return { st: { ...finishedState('oro'), ...hidden(m) }, customW: 0 };
    let st = states[0], acc = ws[0].w;
    for (let i = 1; i < states.length; i++) { acc += ws[i].w; st = mixStates(st, states[i], ws[i].w / acc); }
    const customW = ws.filter((x) => x.id === 'custom').reduce((a, x) => a + x.w, 0) / sum;
    return { st, customW };
  }

  /* stato corrente (smorzato) */
  let cur = { ...finishedState('oro'), ...PLACES.hero(mobile) };

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    backdropU.uAspect.value = w / h;
    final.uniforms.uRes.value.set(w * DPR, h * DPR);
  }
  addEventListener('resize', resize);

  const timer = new THREE.Timer();
  timer.connect(document);
  let snap = 0, introStart = 0;

  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    timer.update(ts);
    const dt = snap > 0 ? 10 : Math.min(timer.getDelta(), 1 / 20);
    if (snap > 0) snap--;
    const t = timer.getElapsed();

    // scroll / velocità
    const sy = scrollY; vel = damp(vel, (sy - lastScroll) / Math.max(dt, 1e-3), 6, dt); lastScroll = sy;
    const labEl = els[2];
    let labP = 0;
    if (labEl) { const r = labEl.getBoundingClientRect(); labP = clamp(-r.top / Math.max(1, r.height - innerHeight)); }

    const { st: tgt, customW } = targetState(labP);
    const want = customW > .5 ? custom : DEFAULT_CFG;
    mug.configure(want);

    // smorzamento verso il target
    const L = 5.5;
    for (const k in tgt) {
      if (Array.isArray(tgt[k])) cur[k] = cur[k].map((v, i) => damp(v, tgt[k][i], L, dt));
      else cur[k] = damp(cur[k] ?? tgt[k], tgt[k], k === 'x' || k === 'y' || k === 's' ? 4.2 : L, dt);
    }
    mug.apply(cur);
    heatNow = cur.heat;

    // intro: carrellata all'indietro
    if (introOn && introT < 1) { introStart ||= performance.now(); introT = Math.min(1, (performance.now() - introStart) / 3400); }
    const it = easeInOut(introT);
    mouse.sx = damp(mouse.sx, mouse.inside ? mouse.x : 0, 3, dt);
    mouse.sy = damp(mouse.sy, mouse.inside ? mouse.y : 0, 3, dt);

    // layout schermo → mondo (riferito alla camera a z = 6)
    const visH = 2 * 6 * Math.tan(THREE.MathUtils.degToRad(16)), visW = visH * camera.aspect;
    const wx = (cur.x - .5) * visW, wy = (.5 - cur.y) * visH;
    const scale = Math.max(.001, (cur.s * visH) / mug.H) * lerp(.7, 1, clamp(cur.vis * 1.5));
    const float = Math.sin(t * 1.1) * .035;
    mug.group.position.set(wx, wy - (mug.H * scale) / 2 + float, 0);
    mug.group.scale.setScalar(scale);
    mug.group.visible = cur.vis > .02;

    spinAcc += cur.spin * dt;
    if (cur.spin < .06) { const TAU = Math.PI * 2; spinAcc = damp(spinAcc, Math.round(spinAcc / TAU) * TAU, 1.6, dt); }
    dragVel *= Math.exp(-3 * dt); dragAcc += dragVel * dt;
    baseRy = damp(baseRy, cur.ry + mouse.sx * .45, 3, dt);
    mug.spin.rotation.y = baseRy + spinAcc + dragAcc + (1 - it) * 1.4;
    mug.group.rotation.x = mouse.sy * .12 + Math.sin(t * .7) * .025;
    mug.group.rotation.z = Math.sin(t * .5) * .02 - clamp(vel / 6000, -.08, .08);

    // vapore
    steam.position.set(mug.group.position.x, mug.group.position.y + mug.H * scale, 0);
    steam.scale.setScalar(scale);
    const steamAmt = clamp(cur.coffee) * clamp(cur.vis) * (1 - cur.heat);
    steamMats.forEach((m) => { m.uniforms.uTime.value = t; m.uniforms.uAmt.value = steamAmt; });
    steam.visible = steamAmt > .01;

    // camera: intro + respiro "a mano"
    const mugC = new THREE.Vector3(wx, wy, 0);
    const camZ = lerp(2.2, 6, it);
    camera.position.set(lerp(mugC.x, 0, it) + mouse.sx * .22 + Math.sin(t * .31) * .025, lerp(mugC.y + .15, 0, it) - mouse.sy * .12 + Math.sin(t * .23) * .02, camZ);
    camera.lookAt(lerp(mugC.x, 0, it), lerp(mugC.y, 0, it), 0);

    // luci
    heatLight.position.set(wx, wy - .2, .9);
    heatLight.intensity = cur.heat * 7;
    rim.intensity = 2.2 + cur.heat * 1.5;

    // particelle
    PU.uTime.value = t; PU.uSwirl.value = cur.swirl; PU.uHeat.value = cur.heat; PU.uClay.value = cur.clay; PU.uRise.value = cur.rise;
    PU.uMug.value.set(wx, wy, 0);
    burstT += dt; PU.uBurstT.value = burstT;
    ray.setFromCamera({ x: mouse.sx, y: -mouse.sy }, camera);
    if (mouse.inside && ray.ray.intersectPlane(plane, hit)) PU.uMouse.value.copy(hit); else PU.uMouse.value.set(99, 99, 99);
    PU.uFocus.value = camZ;

    // fondale
    backdropU.uTime.value = t;
    backdropU.uGlowPos.value.set(cur.x, 1 - cur.y);
    backdropU.uGlowAmt.value = cur.glow * lerp(.4, 1, clamp(cur.vis));
    backdropU.uGlow.value.setRGB(lerp(.75, 1, cur.heat), lerp(.42, .22, cur.heat), lerp(.1, .03, cur.heat));
    backdropU.uBase.value.setRGB(.0032 + cur.heat * .006, .0022, .0016);

    // pellicola
    final.uniforms.uTime.value = t;
    final.uniforms.uCA.value = .006 + Math.min(Math.abs(vel) / 90000, .018);
    bloom.strength = .3 + cur.heat * .35;

    composer.render(dt);
  }
  requestAnimationFrame(frame);
  setTimeout(() => { introOn = true; }, 9000); // rete di sicurezza se il loader non chiama intro()

  /* ---------------------------------------------------- studio + API */
  let studio = null;
  const getStudio = () => (studio ||= new Studio());
  const stillCache = new Map();
  const keyOf = (c) => [c.shape, c.glaze, c.emblem, c.label || '', c.finish || ''].join('|');

  window.TDM3D = {
    ready: true,
    get heat() { return heatNow; },
    intro() { introOn = true; },
    burst() {
      burstT = 0;
      PU.uBurstPos.value.set(mug.group.position.x, mug.group.position.y + mug.H * mug.group.scale.y * .9, 0);
      dragVel += 9;
    },
    drag(dx) { dragVel += dx * .02; },
    snap() { snap = 2; introT = 1; introOn = true; },
    setCustom(cfg) { custom = { ...custom, ...cfg }; },
    renderStill(cfg, size = 640) {
      const k = keyOf(cfg) + '|' + size;
      if (!stillCache.has(k)) stillCache.set(k, getStudio().shot(cfg, 0, size));
      return stillCache.get(k);
    },
    async renderTurntable(cfg, frames = 24, size = 440) {
      const out = [];
      for (let i = 0; i < frames; i++) {
        out.push(getStudio().shot(cfg, (i / frames) * Math.PI * 2, size));
        await new Promise((r) => requestAnimationFrame(r));
      }
      return out;
    }
  };
  document.documentElement.classList.add('has-3d');
  emit('tdm:3d-ready');
}

init().catch((err) => {
  console.warn('[tazzedimerda] 3D non disponibile, uso il fallback SVG.', err);
  const c = document.getElementById('stage'); if (c) c.remove();
  emit('tdm:3d-fail');
});
