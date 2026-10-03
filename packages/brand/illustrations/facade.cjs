// Storefront illustrations: desktop hero (1600 x 900) and mobile (900 x 1100).
const L = require('./lib.cjs');
const { C, doc, stdDefs, lin, rad, shadow, g, air, logo, logoHeight } = L;

function wallDefs(p) {
  // Plaster texture: a tile of low contrast specks.
  let specks = '';
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < 34; i++) {
    const light = i % 2 === 0;
    specks += `<circle cx="${(rnd() * 160).toFixed(0)}" cy="${(rnd() * 160).toFixed(0)}" r="${(0.8 + rnd() * 1.8).toFixed(1)}" fill="${light ? '#fff' : C.b950}" opacity="${light ? 0.07 : 0.1}"/>`;
  }
  return [
    stdDefs(p),
    L.drumDef(p),
    lin(`${p}sky`, 0, 0, 0, 1, [
      [0, C.b300],
      [1, C.b100],
    ]),
    lin(`${p}wall`, 0, 0, 1, 1, [
      [0, C.b500],
      [0.5, C.b600],
      [1, C.b700],
    ]),
    lin(`${p}pan`, 0, 0, 0, 1, [
      [0, C.w],
      [0.7, C.s50],
      [1, C.s200],
    ]),
    lin(`${p}sof`, 0, 0, 0, 1, [
      [0, C.s200],
      [1, C.s50],
    ]),
    lin(`${p}top`, 0, 0, 0, 1, [
      [0, C.b950, 0.35],
      [1, C.b950, 0],
    ]),
    rad(`${p}sun`, [
      [0, C.w, 0.16],
      [1, C.w, 0],
    ]),
    rad(`${p}blot`, [
      [0, C.b950, 0.12],
      [1, C.b950, 0],
    ]),
    rad(`${p}lamp`, [
      [0, C.w, 0.9],
      [0.4, C.f200, 0.35],
      [1, C.f200, 0],
    ]),
    `<pattern id="${p}tex" width="160" height="160" patternUnits="userSpaceOnUse">${specks}</pattern>`,
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

function floodlight(x, top, len) {
  return [
    `<rect x="${x - 3}" y="${top}" width="7" height="${len}" rx="3" fill="${C.s800}"/>`,
    `<rect x="${x + 6}" y="${top + 6}" width="4" height="${len - 10}" rx="2" fill="${C.b950}" opacity=".18"/>`,
    `<rect x="${x - 11}" y="${top + len - 22}" width="22" height="26" rx="3" fill="${C.s800}"/><circle cx="${x}" cy="${top + len - 15}" r="2.5" fill="${C.s400}"/><circle cx="${x}" cy="${top + len - 3}" r="2.5" fill="${C.s400}"/>`,
    `<path d="M${x - 46} ${top + 4}H${x + 46}" stroke="${C.s800}" stroke-width="6" stroke-linecap="round"/>`,
    g(
      `translate(${x - 52} ${top - 6}) rotate(-12)`,
      `<rect x="-22" y="-14" width="44" height="30" rx="5" fill="${C.s300}"/><rect x="-22" y="-14" width="44" height="8" rx="4" fill="${C.s100}"/><rect x="-18" y="12" width="36" height="6" rx="2" fill="#fff"/>`,
    ),
    g(
      `translate(${x + 52} ${top - 6}) rotate(12)`,
      `<rect x="-22" y="-14" width="44" height="30" rx="5" fill="${C.s300}"/><rect x="-22" y="-14" width="44" height="8" rx="4" fill="${C.s100}"/><rect x="-18" y="12" width="36" height="6" rx="2" fill="#fff"/>`,
    ),
  ].join('');
}

// Ledge plus soffit of the marquee.
function marquee(p, W, y, H) {
  const s = [];
  s.push(`<rect y="${y}" width="${W}" height="30" fill="${C.s200}"/>`);
  s.push(`<rect y="${y}" width="${W}" height="4" fill="${C.s50}"/>`);
  s.push(`<rect y="${y + 26}" width="${W}" height="4" fill="${C.s400}"/>`);
  for (let x = 90; x < W; x += 260)
    s.push(
      `<rect x="${x}" y="${y + 8}" width="46" height="12" rx="3" fill="${C.s300}"/><rect x="${x + 4}" y="${y + 10}" width="38" height="3" rx="1.5" fill="${C.s100}"/>`,
    );
  const sy = y + 30;
  s.push(`<rect y="${sy}" width="${W}" height="${H - sy}" fill="url(#${p}sof)"/>`);
  s.push(`<rect y="${sy}" width="${W}" height="22" fill="url(#${p}top)" opacity=".35"/>`);
  const span = H - sy;
  [0.2, 0.43, 0.7].forEach((k) =>
    s.push(
      `<rect y="${(sy + span * k).toFixed(0)}" width="${W}" height="${(2 + k * 2).toFixed(1)}" fill="${C.s300}" opacity=".8"/>`,
    ),
  );
  for (let x = W / 8; x < W; x += W / 4) {
    const ly = sy + span * 0.56;
    s.push(
      `<ellipse cx="${x}" cy="${ly + 10}" rx="70" ry="20" fill="url(#${p}lamp)" opacity=".8"/><ellipse cx="${x}" cy="${ly}" rx="22" ry="6" fill="${C.s300}"/><ellipse cx="${x}" cy="${ly}" rx="16" ry="4" fill="#fff"/>`,
    );
  }
  return s.join('');
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

function hero() {
  const p = 'fh';
  const W = 1600,
    H = 900,
    top = 132,
    bottom = 752;
  const S = 220,
    gap = 40,
    x0 = 800,
    py = 182;
  const c = contents(p);
  const o = [];
  o.push(`<rect width="${W}" height="${top}" fill="url(#${p}sky)"/>`);
  o.push(`<ellipse cx="200" cy="0" rx="520" ry="150" fill="url(#${p}sun)" opacity="1"/>`);
  o.push(wall(p, W, top, bottom));
  o.push(floodlight(x0 + 2 * S + 1.5 * gap, 64, 200));
  for (let i = 0; i < 3; i++) o.push(panel(p, x0 + i * (S + gap), py, S, c[i]));
  const lw = 650,
    lh = logoHeight('logo-silver', lw);
  o.push(logo('logo-silver', x0 + (3 * S + 2 * gap) / 2 - lw / 2, 452, lw, `${p}L`));
  o.push(air('M560 722C760 690 900 735 1100 700S1420 690 1600 668', C.f300, 2.5, 0.35));
  o.push(air('M700 740C880 716 1020 752 1220 722S1480 716 1600 702', C.f200, 2, 0.3));
  o.push(marquee(p, W, bottom, H));
  void lh;
  return doc(W, H, 'Fachada da Refrigeração Castro', wallDefs(p), o.join(''));
}

function mobile() {
  const p = 'fm';
  const W = 900,
    H = 1100,
    top = 100,
    bottom = 905;
  const S = 236,
    gap = 26,
    x0 = (W - (3 * S + 2 * gap)) / 2,
    py = 164;
  const c = contents(p);
  const o = [];
  o.push(`<rect width="${W}" height="${top}" fill="url(#${p}sky)"/>`);
  o.push(`<ellipse cx="120" cy="0" rx="380" ry="120" fill="url(#${p}sun)"/>`);
  o.push(wall(p, W, top, bottom));
  o.push(floodlight(x0 + 2 * S + 1.5 * gap, 46, 170));
  for (let i = 0; i < 3; i++) o.push(panel(p, x0 + i * (S + gap), py, S, c[i]));
  const lw = 760;
  o.push(logo('logo-silver', (W - lw) / 2, 470, lw, `${p}L`));
  o.push(air('M0 820C180 790 320 834 500 806S760 790 900 772', C.f300, 2.5, 0.35));
  o.push(air('M120 852C280 828 420 862 600 836S800 826 900 816', C.f200, 2, 0.3));
  o.push(marquee(p, W, bottom, H));
  return doc(W, H, 'Fachada da Refrigeração Castro', wallDefs(p), o.join(''));
}

module.exports = { 'fachada-hero.svg': hero, 'fachada-mobile.svg': mobile };
