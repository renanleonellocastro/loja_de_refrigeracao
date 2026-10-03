// Product placeholder (800 x 800) and social share card (1200 x 630).
const L = require('./lib.cjs');
const { C, doc, lin, rad, g, air, snowflake, logo } = L;

function semFoto() {
  const S = C.s300,
    w = 14;
  const o = [];
  o.push(`<rect width="800" height="800" fill="${C.s100}"/>`);
  o.push(`<ellipse cx="400" cy="640" rx="190" ry="16" fill="${C.s200}"/>`);
  o.push(
    `<g fill="none" stroke="${S}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">` +
      `<rect x="270" y="160" width="260" height="470" rx="28"/>` +
      `<path d="M270 320H530M482 210V270M482 370V460"/>` +
      `<rect x="318" y="372" width="70" height="92" rx="12"/>` +
      `<path d="M300 630V650M500 630V650"/></g>`,
  );
  o.push(logo('symbol-blue', 650, 650, 110, 'pfS').replace('<svg ', '<svg opacity=".2" '));
  return doc(800, 800, 'Produto sem foto', '', o.join(''));
}

function og() {
  const p = 'og';
  const defs =
    rad(`${p}hl`, [
      [0, C.b500, 0.9],
      [1, C.b500, 0],
    ]) +
    rad(`${p}lo`, [
      [0, C.b900, 0.7],
      [1, C.b900, 0],
    ]);
  const o = [];
  o.push(`<rect width="1200" height="630" fill="${C.b700}"/>`);
  o.push(`<ellipse cx="260" cy="80" rx="620" ry="380" fill="url(#${p}hl)"/>`);
  o.push(`<ellipse cx="1060" cy="640" rx="560" ry="300" fill="url(#${p}lo)"/>`);
  o.push(air('M-20 560C180 520 340 590 560 552S900 520 1220 548', C.f300, 3, 0.55));
  o.push(air('M-20 596C220 566 380 622 620 590S960 566 1220 590', C.f200, 2.5, 0.4));
  o.push(air('M-20 524C160 500 300 540 470 520', C.f400, 2.5, 0.45));
  o.push(air('M760 70C860 40 960 90 1060 62S1180 50 1220 44', C.f300, 3, 0.5));
  o.push(air('M820 104C900 84 980 118 1080 96S1180 88 1220 84', C.f200, 2.5, 0.35));
  o.push(air('M-20 92C60 70 120 104 200 84', C.f300, 2.5, 0.35));
  o.push(g('translate(1080 170)', snowflake(18, C.f300, 3), ' opacity=".7"'));
  o.push(g('translate(120 470)', snowflake(12, C.f200, 2.5), ' opacity=".6"'));
  o.push(logo('logo-silver', 230, 110, 740, `${p}L`));
  return doc(1200, 630, 'Refrigeração Castro', defs, o.join(''));
}

module.exports = { 'produto-sem-foto.svg': semFoto, 'og-image.svg': og };
