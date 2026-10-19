// Storefront illustrations: desktop hero (1600 x 900) and mobile (900 x 1100).
const L = require('./lib.cjs');
const { C, doc, stdDefs, gradientDefs, VERTICAL, DIAGONAL, shadow, g, air, logo } = L;

const FACADE_LINEAR_GRADIENTS = [
  {
    suffix: 'sky',
    vector: VERTICAL,
    stops: [
      [0, C.b300],
      [1, C.b100],
    ],
  },
  {
    suffix: 'wall',
    vector: DIAGONAL,
    stops: [
      [0, C.b500],
      [0.5, C.b600],
      [1, C.b700],
    ],
  },
  {
    suffix: 'pan',
    vector: VERTICAL,
    stops: [
      [0, C.w],
      [0.7, C.s50],
      [1, C.s200],
    ],
  },
  {
    suffix: 'sof',
    vector: VERTICAL,
    stops: [
      [0, C.s200],
      [1, C.s50],
    ],
  },
  {
    suffix: 'top',
    vector: VERTICAL,
    stops: [
      [0, C.b950, 0.35],
      [1, C.b950, 0],
    ],
  },
];
const FACADE_RADIAL_GRADIENTS = [
  {
    suffix: 'sun',
    stops: [
      [0, C.w, 0.16],
      [1, C.w, 0],
    ],
  },
  {
    suffix: 'blot',
    stops: [
      [0, C.b950, 0.12],
      [1, C.b950, 0],
    ],
  },
  {
    suffix: 'lamp',
    stops: [
      [0, C.w, 0.9],
      [0.4, C.f200, 0.35],
      [1, C.f200, 0],
    ],
  },
];

// Plaster texture: a tile of low contrast specks from a fixed seed, so every build is identical.
const PLASTER_SEED = 7;
const PLASTER_SPECK_COUNT = 34;
const PLASTER_TILE_SIZE = 160;
const LCG_MULTIPLIER = 9301;
const LCG_INCREMENT = 49297;
const LCG_MODULUS = 233280;

function createSeededRandom(initialSeed) {
  let seed = initialSeed;
  return () => {
    seed = (seed * LCG_MULTIPLIER + LCG_INCREMENT) % LCG_MODULUS;
    return seed / LCG_MODULUS;
  };
}

function plasterSpeck(random, index) {
  const isLight = index % 2 === 0;
  const cx = (random() * PLASTER_TILE_SIZE).toFixed(0);
  const cy = (random() * PLASTER_TILE_SIZE).toFixed(0);
  const radius = (0.8 + random() * 1.8).toFixed(1);
  return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${isLight ? '#fff' : C.b950}" opacity="${isLight ? 0.07 : 0.1}"/>`;
}

function plasterPattern(p) {
  const random = createSeededRandom(PLASTER_SEED);
  const specks = Array.from({ length: PLASTER_SPECK_COUNT }, (_, index) => plasterSpeck(random, index)).join(
    '',
  );
  return `<pattern id="${p}tex" width="${PLASTER_TILE_SIZE}" height="${PLASTER_TILE_SIZE}" patternUnits="userSpaceOnUse">${specks}</pattern>`;
}

function wallDefs(p) {
  return [
    stdDefs(p),
    L.drumDef(p),
    gradientDefs(p, FACADE_LINEAR_GRADIENTS, FACADE_RADIAL_GRADIENTS),
    plasterPattern(p),
  ].join('');
}

// Stainless pressure water fountain, 56 x 140.
function fountain(p) {
  return [
    `<rect x="4" y="22" width="48" height="118" rx="5" fill="url(#${p}st)"/>`,
    `<rect x="0" y="12" width="56" height="16" rx="5" fill="${C.s300}"/>`,
    `<rect x="4" y="12" width="48" height="5" rx="2.5" fill="${C.s100}"/>`,
    `<path d="M30 12V2H38" fill="none" stroke="${C.s500}" stroke-width="4" stroke-linecap="round"/>`,
    `<rect x="12" y="40" width="32" height="88" rx="4" fill="${C.s200}" opacity=".6"/>`,
    `<rect x="9" y="30" width="5" height="100" rx="2.5" fill="#fff" opacity=".7"/>`,
  ].join('');
}

// One framed square product panel at x,y with side S.
function panel(p, x, y, S, content) {
  const f = S * 0.045;
  const inner = S - 2 * f;
  return g(
    `translate(${x} ${y})`,
    [
      `<rect x="7" y="10" width="${S}" height="${S}" rx="6" fill="${C.b950}" opacity=".28"/>`,
      `<rect width="${S}" height="${S}" rx="6" fill="${C.s800}"/>`,
      `<rect x="${f}" y="${f}" width="${inner}" height="${inner}" rx="2" fill="url(#${p}pan)"/>`,
      `<rect x="${f}" y="${f}" width="${inner}" height="${inner * 0.06}" fill="${C.s300}" opacity=".35"/>`,
      g(`translate(${f} ${f}) scale(${inner / 200})`, content),
    ].join(''),
  );
}

// Panel contents drawn in a 200 x 200 box.
const contents = (p) => [
  shadow(p, 102, 188, 76, 7) +
    g('translate(34 48)', fountain(p)) +
    g('translate(102 10) scale(.58)', L.dispenser(p)),
  shadow(p, 100, 189, 58, 7) + g('translate(59 10) scale(.58)', L.fridge(p)),
  shadow(p, 100, 186, 66, 7) + g('translate(45.6 38) scale(.64)', L.washerOpen(p)),
];

const FLOODLIGHT_ARM_REACH = 52;
const FLOODLIGHT_TILT_DEGREES = 12;

function floodlightHead(x, y, rotationDegrees) {
  return g(
    `translate(${x} ${y}) rotate(${rotationDegrees})`,
    `<rect x="-22" y="-14" width="44" height="30" rx="5" fill="${C.s300}"/><rect x="-22" y="-14" width="44" height="8" rx="4" fill="${C.s100}"/><rect x="-18" y="12" width="36" height="6" rx="2" fill="#fff"/>`,
  );
}

function floodlightPole(x, top, len) {
  return [
    `<rect x="${x - 3}" y="${top}" width="7" height="${len}" rx="3" fill="${C.s800}"/>`,
    `<rect x="${x + 6}" y="${top + 6}" width="4" height="${len - 10}" rx="2" fill="${C.b950}" opacity=".18"/>`,
    `<rect x="${x - 11}" y="${top + len - 22}" width="22" height="26" rx="3" fill="${C.s800}"/><circle cx="${x}" cy="${top + len - 15}" r="2.5" fill="${C.s400}"/><circle cx="${x}" cy="${top + len - 3}" r="2.5" fill="${C.s400}"/>`,
    `<path d="M${x - 46} ${top + 4}H${x + 46}" stroke="${C.s800}" stroke-width="6" stroke-linecap="round"/>`,
  ].join('');
}

function floodlight(x, top, len) {
  return [
    floodlightPole(x, top, len),
    floodlightHead(x - FLOODLIGHT_ARM_REACH, top - 6, -FLOODLIGHT_TILT_DEGREES),
    floodlightHead(x + FLOODLIGHT_ARM_REACH, top - 6, FLOODLIGHT_TILT_DEGREES),
  ].join('');
}

const MARQUEE_LEDGE_HEIGHT = 30;
const MARQUEE_VENT_START = 90;
const MARQUEE_VENT_PITCH = 260;
const SOFFIT_BAND_POSITIONS = [0.2, 0.43, 0.7];
const SOFFIT_LAMP_POSITION = 0.56;
const SOFFIT_LAMP_COUNT = 4;

function marqueeVent(x, y) {
  return `<rect x="${x}" y="${y + 8}" width="46" height="12" rx="3" fill="${C.s300}"/><rect x="${x + 4}" y="${y + 10}" width="38" height="3" rx="1.5" fill="${C.s100}"/>`;
}

function marqueeLedge(W, y) {
  const ventCount = Math.ceil((W - MARQUEE_VENT_START) / MARQUEE_VENT_PITCH);
  const vents = Array.from({ length: ventCount }, (_, index) =>
    marqueeVent(MARQUEE_VENT_START + index * MARQUEE_VENT_PITCH, y),
  );
  return [
    `<rect y="${y}" width="${W}" height="${MARQUEE_LEDGE_HEIGHT}" fill="${C.s200}"/>`,
    `<rect y="${y}" width="${W}" height="4" fill="${C.s50}"/>`,
    `<rect y="${y + 26}" width="${W}" height="4" fill="${C.s400}"/>`,
    ...vents,
  ].join('');
}

function soffitBands(W, soffitTop, span) {
  return SOFFIT_BAND_POSITIONS.map(
    (position) =>
      `<rect y="${(soffitTop + span * position).toFixed(0)}" width="${W}" height="${(2 + position * 2).toFixed(1)}" fill="${C.s300}" opacity=".8"/>`,
  ).join('');
}

function soffitLamps(p, W, lampY) {
  const lampPitch = W / SOFFIT_LAMP_COUNT;
  return Array.from({ length: SOFFIT_LAMP_COUNT }, (_, index) => {
    const x = W / 8 + index * lampPitch;
    return `<ellipse cx="${x}" cy="${lampY + 10}" rx="70" ry="20" fill="url(#${p}lamp)" opacity=".8"/><ellipse cx="${x}" cy="${lampY}" rx="22" ry="6" fill="${C.s300}"/><ellipse cx="${x}" cy="${lampY}" rx="16" ry="4" fill="#fff"/>`;
  }).join('');
}

function marqueeSoffit(p, W, soffitTop, H) {
  const span = H - soffitTop;
  return [
    `<rect y="${soffitTop}" width="${W}" height="${span}" fill="url(#${p}sof)"/>`,
    `<rect y="${soffitTop}" width="${W}" height="22" fill="url(#${p}top)" opacity=".35"/>`,
    soffitBands(W, soffitTop, span),
    soffitLamps(p, W, soffitTop + span * SOFFIT_LAMP_POSITION),
  ].join('');
}

// Ledge plus soffit of the marquee.
function marquee(p, W, y, H) {
  return marqueeLedge(W, y) + marqueeSoffit(p, W, y + MARQUEE_LEDGE_HEIGHT, H);
}

function wall(p, W, top, bottom) {
  return [
    `<rect y="${top}" width="${W}" height="${bottom - top}" fill="url(#${p}wall)"/>`,
    `<rect y="${top}" width="${W}" height="${bottom - top}" fill="url(#${p}tex)"/>`,
    `<ellipse cx="${W * 0.18}" cy="${top + 40}" rx="${W * 0.45}" ry="${(bottom - top) * 0.55}" fill="url(#${p}sun)"/>`,
    `<ellipse cx="${W * 0.62}" cy="${bottom - 80}" rx="${W * 0.22}" ry="70" fill="url(#${p}blot)" opacity=".7"/>`,
    `<ellipse cx="${W * 0.08}" cy="${bottom - 40}" rx="${W * 0.16}" ry="60" fill="url(#${p}blot)" opacity=".6"/>`,
    `<ellipse cx="${W * 0.93}" cy="${top + 120}" rx="${W * 0.12}" ry="90" fill="url(#${p}blot)" opacity=".5"/>`,
    `<rect y="${top}" width="${W}" height="26" fill="url(#${p}top)"/>`,
    `<rect y="${top - 12}" width="${W}" height="12" fill="${C.s100}"/><rect y="${top - 3}" width="${W}" height="3" fill="${C.s300}"/>`,
  ].join('');
}

const PANEL_COUNT = 3;
const STOREFRONT_TITLE = 'Fachada da Refrigeração Castro';
const panelRowWidth = (side, gap) => PANEL_COUNT * side + (PANEL_COUNT - 1) * gap;

const HERO_LAYOUT = {
  prefix: 'fh',
  width: 1600,
  height: 900,
  wallTop: 132,
  wallBottom: 752,
  panels: { side: 220, gap: 40, left: 800, top: 182 },
  sun: { cx: 200, rx: 520, ry: 150, extra: ' opacity="1"' },
  floodlight: { top: 64, length: 200 },
  logo: { width: 650, top: 452 },
  airLines: [
    ['M560 722C760 690 900 735 1100 700S1420 690 1600 668', C.f300, 2.5, 0.35],
    ['M700 740C880 716 1020 752 1220 722S1480 716 1600 702', C.f200, 2, 0.3],
  ],
};

const MOBILE_LAYOUT = {
  prefix: 'fm',
  width: 900,
  height: 1100,
  wallTop: 100,
  wallBottom: 905,
  panels: { side: 236, gap: 26, left: (900 - panelRowWidth(236, 26)) / 2, top: 164 },
  sun: { cx: 120, rx: 380, ry: 120, extra: '' },
  floodlight: { top: 46, length: 170 },
  logo: { width: 760, top: 470 },
  airLines: [
    ['M0 820C180 790 320 834 500 806S760 790 900 772', C.f300, 2.5, 0.35],
    ['M120 852C280 828 420 862 600 836S800 826 900 816', C.f200, 2, 0.3],
  ],
};

function storefrontSky({ prefix: p, width, wallTop, sun }) {
  return [
    `<rect width="${width}" height="${wallTop}" fill="url(#${p}sky)"/>`,
    `<ellipse cx="${sun.cx}" cy="0" rx="${sun.rx}" ry="${sun.ry}" fill="url(#${p}sun)"${sun.extra}/>`,
  ].join('');
}

// The floodlight hangs over the gap between the second and the third panel.
function storefrontFloodlight({ panels, floodlight: lamp }) {
  const x = panels.left + 2 * panels.side + 1.5 * panels.gap;
  return floodlight(x, lamp.top, lamp.length);
}

function productPanels({ prefix: p, panels }) {
  const { side, gap, left, top } = panels;
  return contents(p)
    .map((content, index) => panel(p, left + index * (side + gap), top, side, content))
    .join('');
}

// The logo is centered under the row of panels.
function storefrontLogo({ prefix: p, panels, logo: sign }) {
  const rowCenter = panels.left + panelRowWidth(panels.side, panels.gap) / 2;
  return logo('logo-silver', rowCenter - sign.width / 2, sign.top, sign.width, `${p}L`);
}

function storefrontScene(layout) {
  return [
    storefrontSky(layout),
    wall(layout.prefix, layout.width, layout.wallTop, layout.wallBottom),
    storefrontFloodlight(layout),
    productPanels(layout),
    storefrontLogo(layout),
    ...layout.airLines.map((airLine) => air(...airLine)),
    marquee(layout.prefix, layout.width, layout.wallBottom, layout.height),
  ].join('');
}

function storefront(layout) {
  return doc(layout.width, layout.height, STOREFRONT_TITLE, wallDefs(layout.prefix), storefrontScene(layout));
}

const hero = () => storefront(HERO_LAYOUT);
const mobile = () => storefront(MOBILE_LAYOUT);

module.exports = { 'fachada-hero.svg': hero, 'fachada-mobile.svg': mobile };
