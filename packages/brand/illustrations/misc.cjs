// Product placeholder (800 x 800) and social share card (1200 x 630).
const L = require('./lib.cjs');
const { C, doc, rad, g, air, snowflake, logo } = L;

const PLACEHOLDER_SIZE = 800;
const PLACEHOLDER_STROKE_WIDTH = 14;

function placeholderFridgeOutline() {
  return [
    `<g fill="none" stroke="${C.s300}" stroke-width="${PLACEHOLDER_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">`,
    `<rect x="270" y="160" width="260" height="470" rx="28"/>`,
    `<path d="M270 320H530M482 210V270M482 370V460"/>`,
    `<rect x="318" y="372" width="70" height="92" rx="12"/>`,
    `<path d="M300 630V650M500 630V650"/></g>`,
  ].join('');
}

function semFoto() {
  const body = [
    `<rect width="${PLACEHOLDER_SIZE}" height="${PLACEHOLDER_SIZE}" fill="${C.s100}"/>`,
    `<ellipse cx="400" cy="640" rx="190" ry="16" fill="${C.s200}"/>`,
    placeholderFridgeOutline(),
    logo('symbol-blue', 650, 650, 110, 'pfS').replace('<svg ', '<svg opacity=".2" '),
  ].join('');
  return doc(PLACEHOLDER_SIZE, PLACEHOLDER_SIZE, 'Produto sem foto', '', body);
}

const SHARE_CARD_PREFIX = 'og';
const SHARE_CARD_WIDTH = 1200;
const SHARE_CARD_HEIGHT = 630;
const SHARE_CARD_AIR_LINES = [
  ['M-20 560C180 520 340 590 560 552S900 520 1220 548', C.f300, 3, 0.55],
  ['M-20 596C220 566 380 622 620 590S960 566 1220 590', C.f200, 2.5, 0.4],
  ['M-20 524C160 500 300 540 470 520', C.f400, 2.5, 0.45],
  ['M760 70C860 40 960 90 1060 62S1180 50 1220 44', C.f300, 3, 0.5],
  ['M820 104C900 84 980 118 1080 96S1180 88 1220 84', C.f200, 2.5, 0.35],
  ['M-20 92C60 70 120 104 200 84', C.f300, 2.5, 0.35],
];

function shareCardDefs(p) {
  const highlight = rad(`${p}hl`, [
    [0, C.b500, 0.9],
    [1, C.b500, 0],
  ]);
  const lowlight = rad(`${p}lo`, [
    [0, C.b900, 0.7],
    [1, C.b900, 0],
  ]);
  return highlight + lowlight;
}

function shareCardBackground(p) {
  return [
    `<rect width="${SHARE_CARD_WIDTH}" height="${SHARE_CARD_HEIGHT}" fill="${C.b700}"/>`,
    `<ellipse cx="260" cy="80" rx="620" ry="380" fill="url(#${p}hl)"/>`,
    `<ellipse cx="1060" cy="640" rx="560" ry="300" fill="url(#${p}lo)"/>`,
  ].join('');
}

function og() {
  const p = SHARE_CARD_PREFIX;
  const body = [
    shareCardBackground(p),
    ...SHARE_CARD_AIR_LINES.map((airLine) => air(...airLine)),
    g('translate(1080 170)', snowflake(18, C.f300, 3), ' opacity=".7"'),
    g('translate(120 470)', snowflake(12, C.f200, 2.5), ' opacity=".6"'),
    logo('logo-silver', 230, 110, 740, `${p}L`),
  ].join('');
  return doc(SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT, 'Refrigeração Castro', shareCardDefs(p), body);
}

module.exports = { 'produto-sem-foto.svg': semFoto, 'og-image.svg': og };
