/* ==========================================================================
   tazzedimerda — catalogo prodotti + generatore SVG delle tazze
   ========================================================================== */

const GLAZES = {
  cioccolato: { name: 'Cioccolato Fondente', base: '#6b3f1d', light: '#9a6234', dark: '#3f2410', emblem: '#f4ead8' },
  oro:        { name: 'Oro di Arena',        base: '#e3a72f', light: '#f7d77a', dark: '#a8731a', emblem: '#3f2410' },
  acido:      { name: 'Verde Acido',         base: '#9bdc2a', light: '#d4ff7a', dark: '#5f9412', emblem: '#16110d' },
  notte:      { name: 'Nero Pece',           base: '#1d1712', light: '#4a3b2e', dark: '#0a0705', emblem: '#e3a72f' },
  osso:       { name: 'Bianco Osso',         base: '#efe4d0', light: '#fffaf0', dark: '#b9a98c', emblem: '#6b3f1d' },
  nduja:      { name: 'Rosso ’Nduja',   base: '#c8381b', light: '#f0735a', dark: '#7e1d0a', emblem: '#f4ead8' }
};

const SHAPES = {
  classica: { ty: 70, by: 206, tw: 74, bw: 60, label: 'Classica 350 ml' },
  alta:     { ty: 52, by: 206, tw: 62, bw: 54, label: 'Alta 450 ml' },
  bowl:     { ty: 88, by: 206, tw: 86, bw: 56, label: 'Bowl 500 ml' }
};

const EMBLEMS = { swirl: 'Il Classico', fiamma: 'Fiamma Calabra', nessuno: 'Nessuno' };

const PRODUCTS = [
  { id: 'classica',   name: 'La Classica',            cat: 'classiche', price: 24, glaze: 'cioccolato', shape: 'classica', emblem: 'swirl',  label: '',               badge: 'Best seller',
    desc: 'Il nostro manifesto in ceramica. Gres smaltato a mano, finitura lucida, un emblema che parla da solo. Perfetta per il caffè del mattino e per far tacere i colleghi.', cap: '350 ml', peso: '380 g' },
  { id: 'capolavoro', name: 'Il Capolavoro Solido',   cat: 'classiche', price: 29, glaze: 'oro',        shape: 'alta',     emblem: 'swirl',  label: 'CAPOLAVORO',     badge: 'Nuovo',
    desc: 'Smalto oro lavorato in tre passaggi e cotto a 1.240 °C. Pesa il giusto, brilla il giusto, scandalizza il giusto.', cap: '450 ml', peso: '450 g' },
  { id: 'nduja',      name: 'Overdose di ’Nduja', cat: 'calabresi', price: 27, glaze: 'nduja',      shape: 'classica', emblem: 'fiamma', label: 'PICCANTE',       badge: 'Calabria',
    desc: 'Rosso ’nduja, emblema a fiamma. Ispirata al piatto che ti fa dire “non sento più la lingua” e, dopo, qualcos’altro.', cap: '350 ml', peso: '390 g' },
  { id: 'peperoncino',name: 'Dopo il Peperoncino',    cat: 'calabresi', price: 26, glaze: 'osso',       shape: 'bowl',     emblem: 'fiamma', label: 'DOPO',           badge: '',
    desc: 'Bowl bianco osso per chi ha capito che in Calabria il peperoncino non si assaggia: si sopravvive. Ottima anche per la zuppa.', cap: '500 ml', peso: '470 g' },
  { id: 'lunedi',     name: 'Lunedì Mattina',         cat: 'classiche', price: 22, glaze: 'notte',      shape: 'classica', emblem: 'swirl',  label: 'LUNEDI',         badge: '',
    desc: 'Nero pece, nessuna speranza. L’unica tazza onesta quando suona la sveglia.', cap: '350 ml', peso: '380 g' },
  { id: 'excapo',     name: 'Regalo per l’Ex Capo', cat: 'limited', price: 34, glaze: 'acido',    shape: 'alta',     emblem: 'swirl',  label: 'GRAZIE DI TUTTO', badge: 'Edizione limitata',
    desc: 'Verde acido, serie numerata a 300 esemplari. Il dono perfetto per chi ti ha insegnato tanto. Soprattutto cosa non fare.', cap: '450 ml', peso: '440 g' },
  { id: 'stitica',    name: 'Stitichezza Deluxe',     cat: 'limited', price: 39, glaze: 'oro',        shape: 'bowl',     emblem: 'swirl',  label: 'CI STO PROVANDO', badge: 'Edizione limitata',
    desc: 'Bowl oro firmato dal Mastro, ogni pezzo ha una piccola imperfezione unica. Come i migliori sforzi.', cap: '500 ml', peso: '520 g' },
  { id: 'notturna',   name: 'Turno di Notte',         cat: 'limited', price: 31, glaze: 'cioccolato', shape: 'alta',     emblem: 'nessuno',label: 'ANCORA SVEGLIO', badge: '',
    desc: 'Cioccolato opaco, scritta in rilievo. Per chi ha già perso il conto dei caffè.', cap: '450 ml', peso: '430 g' },
  { id: 'coppia',     name: 'Set Coppia “Amore Vero”', cat: 'set', price: 44, glaze: 'osso', shape: 'classica', emblem: 'swirl', label: 'AMORE VERO',     badge: 'Set da 2',
    desc: 'Due tazze, una scatola in cartone riciclato e un biglietto scritto a mano. Perché i sentimenti, come tutto il resto, vanno condivisi.', cap: '2 × 350 ml', peso: '800 g' },
  { id: 'famiglia',   name: 'Set Famiglia (4 pezzi)', cat: 'set', price: 79, glaze: 'cioccolato', shape: 'bowl',     emblem: 'swirl',  label: 'FAMIGLIA',       badge: 'Set da 4',
    desc: 'Quattro bowl, una sola verità. Spediti in scatola rinforzata con paglia compostabile.', cap: '4 × 500 ml', peso: '1,9 kg' }
];

const CATEGORIES = [
  { key: 'tutte', label: 'Tutte' },
  { key: 'classiche', label: 'Classiche' },
  { key: 'calabresi', label: 'Calabresi' },
  { key: 'limited', label: 'Edizioni limitate' },
  { key: 'set', label: 'Set regalo' }
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let _svgId = 0;

/**
 * Disegna una tazza in SVG.
 * opts: { glaze, shape, emblem, label, steam }
 */
function mugSVG(opts = {}) {
  const g = GLAZES[opts.glaze] || GLAZES.cioccolato;
  const s = SHAPES[opts.shape] || SHAPES.classica;
  const id = 'm' + (++_svgId);
  const cx = 120;
  const { ty, by, tw, bw } = s;
  const r = 14; // curvatura del fondo
  const body = `M${cx - tw} ${ty} L${cx + tw} ${ty} L${cx + bw} ${by - r} Q${cx + bw - 2} ${by} ${cx + bw - r} ${by} L${cx - bw + r} ${by} Q${cx - bw + 2} ${by} ${cx - bw} ${by - r} Z`;
  const hy1 = ty + 24, hy2 = by - 32;
  const handle = `M${cx + tw - 4} ${hy1} C ${cx + tw + 48} ${hy1 - 6}, ${cx + tw + 46} ${hy2 + 14}, ${cx + bw - 2} ${hy2}`;
  const midY = (ty + by) / 2 + 6;
  const em = opts.emblem || 'swirl';
  const ec = g.emblem;

  let emblem = '';
  if (em === 'swirl') {
    const oy = opts.label ? midY - 12 : midY;
    emblem = `
      <g transform="translate(${cx} ${oy})" fill="${ec}">
        <path d="M-24 14c0-8 11-12 24-12s24 4 24 12-11 10-24 10-24-2-24-10z"/>
        <path d="M-17 2c0-7 8-10 17-10s17 3 17 10-8 8-17 8-17-1-17-8z" opacity=".92"/>
        <path d="M-10-8c0-6 5-8 10-8s10 2 10 8-5 6-10 6-10 0-10-6z" opacity=".85"/>
        <path d="M-3-16c0-5 2-9 3-11 2 3 4 6 3 11z" opacity=".8"/>
        <circle cx="-7" cy="12" r="2.600" fill="${g.dark}"/><circle cx="7" cy="12" r="2.600" fill="${g.dark}"/>
        <path d="M-5 18q5 4 10 0" stroke="${g.dark}" stroke-width="2" fill="none" stroke-linecap="round"/>
      </g>`;
  } else if (em === 'fiamma') {
    const oy = opts.label ? midY - 12 : midY;
    emblem = `
      <g transform="translate(${cx} ${oy})">
        <path d="M0-28c4 10 16 14 16 28a16 16 0 0 1-32 0c0-8 4-12 8-16 0 6 3 8 6 8-3-8-2-14 2-20z" fill="${ec}"/>
        <path d="M0-6c2 6 8 8 8 15a8 8 0 0 1-16 0c0-4 3-6 5-9 0 3 1 4 3 4-1-4-1-7 0-10z" fill="${g.dark}" opacity=".55"/>
      </g>`;
  }

  let label = '';
  if (opts.label) {
    const txt = esc(opts.label.toUpperCase());
    const size = txt.length > 14 ? 10 : txt.length > 9 ? 12 : 14;
    const ly = em === 'nessuno' ? midY + 4 : midY + 36;
    label = `<text x="${cx}" y="${ly}" text-anchor="middle" font-family="Unbounded, Space Grotesk, sans-serif" font-weight="800" font-size="${size}" letter-spacing="1.500" fill="${ec}">${txt}</text>`;
  }

  const steam = opts.steam === false ? '' : `
    <g class="steam" fill="none" stroke="${g.light}" stroke-width="3.500" stroke-linecap="round" opacity=".55">
      <path class="s1" d="M${cx - 30} ${ty - 14} q-12 -16 0 -30 t0 -30"/>
      <path class="s2" d="M${cx} ${ty - 14} q-12 -16 0 -30 t0 -30"/>
      <path class="s3" d="M${cx + 30} ${ty - 14} q-12 -16 0 -30 t0 -30"/>
    </g>`;

  return `
  <svg class="mug" viewBox="0 0 280 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tazza ${esc(g.name)}">
    <defs>
      <linearGradient id="${id}b" x1="0" x2="1">
        <stop offset="0" stop-color="${g.dark}"/><stop offset=".22" stop-color="${g.base}"/>
        <stop offset=".42" stop-color="${g.light}"/><stop offset=".62" stop-color="${g.base}"/>
        <stop offset="1" stop-color="${g.dark}"/>
      </linearGradient>
      <radialGradient id="${id}i" cx=".5" cy=".4" r=".7">
        <stop offset="0" stop-color="#1a0e06"/><stop offset="1" stop-color="#000"/>
      </radialGradient>
    </defs>
    <ellipse cx="${cx}" cy="${by + 6}" rx="${bw + 26}" ry="10" fill="#000" opacity=".35"/>
    <path d="${handle}" fill="none" stroke="${g.dark}" stroke-width="18" stroke-linecap="round"/>
    <path d="${handle}" fill="none" stroke="${g.base}" stroke-width="12" stroke-linecap="round"/>
    <path d="${handle}" fill="none" stroke="${g.light}" stroke-width="3" stroke-linecap="round" opacity=".55" transform="translate(-1 -2)"/>
    <path d="${body}" fill="url(#${id}b)"/>
    <ellipse cx="${cx}" cy="${ty}" rx="${tw}" ry="14" fill="${g.light}"/>
    <ellipse cx="${cx}" cy="${ty + 1}" rx="${tw - 7}" ry="10" fill="url(#${id}i)"/>
    <ellipse cx="${cx}" cy="${ty + 5}" rx="${tw - 14}" ry="6" fill="#5a3216" opacity=".85"/>
    <path d="M${cx - tw + 12} ${ty + 18} L${cx - bw + 10} ${by - 26}" stroke="#fff" stroke-opacity=".18" stroke-width="6" stroke-linecap="round"/>
    ${emblem}${label}${steam}
  </svg>`;
}

/* Esporto in globale (script classici, nessun bundler) */
window.TDM = { GLAZES, SHAPES, EMBLEMS, PRODUCTS, CATEGORIES, mugSVG, esc };
