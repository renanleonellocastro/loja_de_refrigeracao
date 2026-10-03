// Service illustrations, 400 x 400.
const L = require('./lib.cjs');
const { C, doc, stdDefs, blob, shadow, g, air, snowflake, lin } = L;

const bg = (seed) =>
  blob(200, 206, 172, 160, seed, C.b50) +
  `<circle cx="338" cy="92" r="10" fill="${C.b100}"/><circle cx="62" cy="318" r="7" fill="${C.b100}"/>`;
const sparkle = (x, y, r, c = C.f400) => g(`translate(${x} ${y})`, snowflake(r, c, 2.4));

function geladeira() {
  const p = 'sg';
  const defs =
    stdDefs(p) +
    lin(`${p}cav`, 0, 0, 0, 1, [
      [0, C.f200],
      [0.35, C.b50],
      [1, C.b100],
    ]);
  const o = [];
  o.push(`<ellipse cx="70" cy="190" rx="150" ry="175" fill="url(#${p}glow)" opacity=".75"/>`);
  o.push(`<rect width="140" height="300" rx="10" fill="url(#${p}st)"/>`);
  o.push(`<rect x="131" y="3" width="9" height="294" rx="4.5" fill="${C.s500}" opacity=".28"/>`);
  o.push(`<rect y="94" width="140" height="4" fill="${C.s500}"/>`);
  o.push(`<rect x="12" y="7" width="8" height="82" rx="4" fill="#fff" opacity=".7"/>`);
  o.push(
    `<rect x="115" y="30" width="8" height="48" rx="4" fill="${C.s600}"/><rect x="116.5" y="32" width="2.5" height="44" rx="1.2" fill="${C.s200}"/>`,
  );
  o.push(`<rect x="52" y="18" width="36" height="4" rx="2" fill="${C.s400}"/>`);
  // cavity
  o.push(`<rect x="7" y="102" width="126" height="191" rx="6" fill="url(#${p}cav)"/>`);
  o.push(`<rect x="45" y="104" width="50" height="5" rx="2.5" fill="#fff"/>`);
  // shelf 1 items
  o.push(
    `<rect x="22" y="124" width="14" height="34" rx="4" fill="${C.b400}"/><rect x="25" y="114" width="8" height="12" rx="2" fill="${C.b500}"/><rect x="24" y="128" width="3" height="24" rx="1.5" fill="#fff" opacity=".5"/>`,
  );
  o.push(
    `<rect x="44" y="128" width="28" height="30" rx="7" fill="${C.f300}"/><rect x="47" y="122" width="10" height="8" rx="2" fill="${C.b300}"/>`,
  );
  o.push(
    `<rect x="82" y="138" width="38" height="20" rx="4" fill="#fff"/><rect x="80" y="133" width="42" height="7" rx="3" fill="${C.b300}"/>`,
  );
  o.push(
    `<rect x="9" y="158" width="122" height="5" rx="2" fill="${C.f200}"/><rect x="9" y="158" width="122" height="1.6" fill="#fff"/>`,
  );
  // shelf 2 items
  o.push(
    `<rect x="18" y="186" width="42" height="28" rx="5" fill="#fff"/><rect x="18" y="182" width="42" height="7" rx="3" fill="${C.b200}"/>`,
  );
  o.push(
    `<rect x="70" y="186" width="12" height="28" rx="3" fill="${C.b500}"/><rect x="86" y="186" width="12" height="28" rx="3" fill="${C.f400}"/><rect x="102" y="186" width="12" height="28" rx="3" fill="${C.s300}"/>`,
  );
  o.push(
    `<rect x="70" y="186" width="12" height="4" fill="#fff" opacity=".45"/><rect x="86" y="186" width="12" height="4" fill="#fff" opacity=".45"/><rect x="102" y="186" width="12" height="4" fill="#fff" opacity=".55"/>`,
  );
  o.push(
    `<rect x="9" y="214" width="122" height="5" rx="2" fill="${C.f200}"/><rect x="9" y="214" width="122" height="1.6" fill="#fff"/>`,
  );
  // crisper
  o.push(`<rect x="13" y="226" width="114" height="60" rx="8" fill="${C.f200}" opacity=".7"/>`);
  o.push(
    `<rect x="13" y="262" width="114" height="24" rx="8" fill="${C.b200}"/><rect x="50" y="270" width="40" height="5" rx="2.5" fill="#fff" opacity=".8"/>`,
  );
  o.push(
    `<path d="M24 240Q40 232 56 240T88 240" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>`,
  );
  // open door
  o.push(`<path d="M140 98L202 82Q208 81 208 87V315Q208 321 202 320L140 302Z" fill="url(#${p}wh)"/>`);
  o.push(
    `<path d="M140 98L202 82Q208 81 208 87V315Q208 321 202 320L140 302Z" fill="none" stroke="${C.b200}" stroke-width="3" stroke-linejoin="round"/>`,
  );
  o.push(
    `<rect x="158" y="118" width="10" height="28" rx="3" fill="${C.b400}"/><rect x="172" y="122" width="10" height="24" rx="3" fill="${C.s300}"/><rect x="186" y="116" width="9" height="28" rx="3" fill="${C.f400}"/>`,
  );
  o.push(
    `<rect x="160" y="180" width="14" height="26" rx="3" fill="#fff" stroke="${C.s200}"/><rect x="178" y="184" width="14" height="20" rx="3" fill="${C.b300}"/>`,
  );
  o.push(
    `<path d="M148 142L200 132V150L148 158Z" fill="${C.f300}" opacity=".85"/><path d="M148 200L200 196V214L148 216Z" fill="${C.f300}" opacity=".85"/><path d="M148 256L200 258V276L148 272Z" fill="${C.f300}" opacity=".85"/>`,
  );
  // cold air
  const a = [];
  a.push(air('M6 180C-30 170 -44 204 -76 196', C.f300, 4.5));
  a.push(air('M6 228C-24 232 -30 262 -64 258', C.f400, 4));
  a.push(air('M30 296C10 318 -30 312 -46 330', C.f300, 3.5, 0.8));
  a.push(air('M-40 150C-56 140 -70 152 -84 146', C.f400, 3, 0.7));
  const fridgeG = g('translate(116 56) scale(.9)', o.join('') + a.join(''));
  const body =
    bg(1) +
    shadow(p, 212, 330, 115, 13) +
    fridgeG +
    sparkle(70, 120, 11) +
    sparkle(330, 170, 8, C.f300) +
    sparkle(318, 290, 6);
  return doc(400, 400, 'Conserto de geladeira', defs, body);
}

function arCondicionado() {
  const p = 'sa';
  const defs = stdDefs(p);
  const o = [];
  o.push(`<rect x="44" y="70" width="312" height="10" rx="5" fill="${C.b100}"/>`);
  o.push(g('translate(50 74)', L.split(p)));
  o.push(air('M90 178C80 212 110 230 96 262', C.f300, 5));
  o.push(air('M140 180C134 222 168 240 156 290', C.f400, 5));
  o.push(air('M196 180C194 226 226 248 218 300', C.f300, 5));
  o.push(air('M252 180C256 222 286 236 282 280', C.f400, 5));
  o.push(air('M304 178C312 206 334 218 332 248', C.f300, 4.5, 0.8));
  o.push(air('M118 214C116 232 128 240 124 252', C.f200, 3.5));
  o.push(air('M226 212C228 232 244 238 240 254', C.f200, 3.5));
  o.push(sparkle(176, 316, 12) + sparkle(110, 300, 7, C.f300) + sparkle(270, 312, 8, C.f300));
  // remote
  o.push(
    g(
      'translate(302 262) rotate(14)',
      `<rect width="44" height="88" rx="12" fill="${C.b700}"/><rect x="2" y="2" width="20" height="84" rx="10" fill="${C.b600}"/><rect x="8" y="10" width="28" height="18" rx="4" fill="${C.f300}"/><rect x="12" y="15" width="12" height="7" rx="2" fill="${C.b900}"/><circle cx="16" cy="44" r="5" fill="${C.b300}"/><circle cx="30" cy="44" r="5" fill="${C.b300}"/><rect x="11" y="58" width="22" height="6" rx="3" fill="${C.b400}"/><rect x="11" y="70" width="22" height="6" rx="3" fill="${C.b400}"/>`,
    ),
  );
  return doc(400, 400, 'Conserto de ar-condicionado', defs, bg(2) + o.join(''));
}

function instalacaoAr() {
  const p = 'si';
  const defs =
    stdDefs(p) +
    lin(`${p}lv`, 0, 0, 0, 1, [
      [0, C.b400],
      [1, C.b600],
    ]);
  const o = [];
  o.push(
    `<g fill="${C.b100}"><rect x="56" y="96" width="64" height="20" rx="6"/><rect x="74" y="124" width="40" height="20" rx="6"/><rect x="300" y="300" width="56" height="20" rx="6"/></g>`,
  );
  const br = (x) =>
    `<rect x="${x}" y="290" width="14" height="64" rx="4" fill="${C.s600}"/><rect x="${x}" y="290" width="5" height="64" rx="2.5" fill="${C.s400}"/><path d="M${x + 7} 344L${x + 44} 296" stroke="${C.s600}" stroke-width="8" stroke-linecap="round"/><circle cx="${x + 7}" cy="304" r="3" fill="${C.s200}"/><circle cx="${x + 7}" cy="340" r="3" fill="${C.s200}"/>`;
  o.push(br(140) + br(282));
  o.push(
    `<rect x="126" y="282" width="220" height="12" rx="5" fill="${C.s500}"/><rect x="126" y="282" width="220" height="4" rx="2" fill="${C.s300}"/>`,
  );
  o.push(g('translate(126 128) scale(.95)', L.condenser(p)));
  o.push(
    `<path d="M334 214C352 214 356 228 356 244V300" fill="none" stroke="${C.s300}" stroke-width="13" stroke-linecap="round"/><path d="M334 214C352 214 356 228 356 244V300" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M334 198C362 198 368 214 368 236V290" fill="none" stroke="${C.s300}" stroke-width="6" stroke-linecap="round"/>`,
  );
  o.push(
    g(
      'translate(160 106)',
      `<rect width="140" height="22" rx="6" fill="url(#${p}lv)"/><rect width="140" height="6" rx="3" fill="${C.b300}" opacity=".7"/><rect x="51" y="5" width="38" height="12" rx="6" fill="${C.f200}"/><ellipse cx="70" cy="11" rx="7" ry="4" fill="#fff"/><path d="M61 5V17M79 5V17" stroke="${C.b700}" stroke-width="2"/><rect width="14" height="22" rx="5" fill="${C.s800}"/><rect x="126" width="14" height="22" rx="5" fill="${C.s800}"/><circle cx="30" cy="11" r="4" fill="${C.b800}"/><circle cx="110" cy="11" r="4" fill="${C.b800}"/>`,
    ),
  );
  o.push(g('translate(68 326) rotate(115) scale(.74)', L.wrench()));
  o.push(sparkle(328, 92, 9, C.f300) + sparkle(96, 196, 7));
  return doc(400, 400, 'Instalação de ar-condicionado', defs, bg(3) + o.join(''));
}

function lavadora() {
  const p = 'sl';
  const defs =
    stdDefs(p) +
    L.rad(`${p}drum`, [
      [0, C.b600],
      [1, C.b950],
    ]);
  const o = [];
  o.push(g('translate(115 126)', L.washerOpen(p)));
  o.push(
    `<circle cx="166" cy="176" r="5" fill="#fff" stroke="${C.f300}" stroke-width="2"/><circle cx="236" cy="168" r="4" fill="#fff" stroke="${C.f300}" stroke-width="2"/><circle cx="214" cy="150" r="3" fill="#fff" stroke="${C.f300}" stroke-width="2"/>`,
  );
  o.push(
    air('M98 150C78 164 86 194 64 206', C.f300, 4.5) + air('M302 150C322 164 314 194 336 206', C.f300, 4.5),
  );
  o.push(
    `<path d="M330 270q8 -14 0 -26q-8 12 0 26z" fill="${C.f400}"/><path d="M72 280q7 -12 0 -22q-7 10 0 22z" fill="${C.f300}"/>`,
  );
  return doc(
    400,
    400,
    'Conserto de máquina de lavar',
    defs,
    bg(4) + shadow(p, 200, 362, 110, 12) + o.join(''),
  );
}

function bebedouro() {
  const p = 'sb';
  const defs = stdDefs(p);
  const o = [];
  o.push(g('translate(152 44) scale(.96)', L.dispenser(p)));
  // cup under cold tap
  o.push(
    `<path d="M171 216H191L188 238H174Z" fill="${C.f200}" opacity=".9"/><path d="M172.5 224H189.5L188 238H174Z" fill="${C.f400}" opacity=".7"/><path d="M180 197V214" stroke="${C.f400}" stroke-width="3" stroke-linecap="round"/>`,
  );
  o.push(air('M110 116C88 130 92 160 70 170', C.f300, 4.5));
  o.push(air('M122 168C104 184 112 208 92 220', C.f400, 4));
  o.push(air('M292 112C312 126 306 154 330 164', C.f300, 4.5));
  o.push(air('M282 170C300 184 292 206 314 218', C.f400, 4));
  o.push(sparkle(88, 260, 9) + sparkle(318, 270, 7, C.f300));
  o.push(
    `<path d="M302 96q10 -18 0 -32q-10 14 0 32z" fill="${C.f400}"/><path d="M98 98q7 -12 0 -22q-7 10 0 22z" fill="${C.f300}"/>`,
  );
  return doc(
    400,
    400,
    'Conserto de bebedouro e purificador',
    defs,
    bg(5) + shadow(p, 200, 340, 90, 11) + o.join(''),
  );
}

function comercial() {
  const p = 'sc';
  const defs =
    stdDefs(p) +
    lin(`${p}gl`, 0, 0, 1, 1, [
      [0, C.b800],
      [1, C.b950],
    ]) +
    lin(`${p}bd`, 0, 0, 1, 0, [
      [0, C.b500],
      [0.5, C.b600],
      [1, C.b800],
    ]) +
    lin(`${p}hd`, 0, 0, 1, 0, [
      [0, C.b400],
      [1, C.b600],
    ]);
  const o = [];
  const X = 112,
    Y = 34,
    W = 176,
    H = 318;
  o.push(`<rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="14" fill="url(#${p}bd)"/>`);
  o.push(`<rect x="${X + 8}" y="${Y + 8}" width="${W - 16}" height="46" rx="8" fill="url(#${p}hd)"/>`);
  o.push(
    `<path d="M${X + 26} ${Y + 31}C${X + 56} ${Y + 18} ${X + 86} ${Y + 44} ${X + 116} ${Y + 28}S${X + 146} ${Y + 26} ${X + 152} ${Y + 32}" fill="none" stroke="${C.f200}" stroke-width="4" stroke-linecap="round"/>`,
  );
  o.push(
    `<path d="M${X + 26} ${Y + 41}C${X + 56} ${Y + 30} ${X + 86} ${Y + 52} ${X + 116} ${Y + 40}" fill="none" stroke="${C.f300}" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>`,
  );
  // glass door
  const gx = X + 14,
    gy = Y + 64,
    gw = W - 28,
    gh = 222;
  o.push(`<rect x="${gx - 4}" y="${gy - 4}" width="${gw + 8}" height="${gh + 8}" rx="10" fill="${C.s300}"/>`);
  o.push(`<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" rx="7" fill="url(#${p}gl)"/>`);
  o.push(`<rect x="${gx}" y="${gy}" width="${gw}" height="10" rx="5" fill="${C.f300}" opacity=".85"/>`);
  o.push(
    `<ellipse cx="${gx + gw / 2}" cy="${gy + 20}" rx="${gw / 2}" ry="40" fill="url(#${p}glow)" opacity=".55"/>`,
  );
  const shelfY = [gy + 74, gy + 142, gy + 210];
  const cols = [C.f400, C.b300, C.w, C.b400, C.f300, C.s300];
  let items = '';
  shelfY.forEach((sy, r) => {
    for (let i = 0; i < 6; i++) {
      const ix = gx + 10 + i * 22;
      const c = cols[(i + r * 2) % cols.length];
      if ((i + r) % 2 === 0) {
        items += `<path d="M${ix + 4} ${sy}V${sy - 34}Q${ix + 4} ${sy - 40} ${ix + 7} ${sy - 44}V${sy - 52}H${ix + 11}V${sy - 44}Q${ix + 14} ${sy - 40} ${ix + 14} ${sy - 34}V${sy}Z" fill="${c}"/>`;
        items += `<rect x="${ix + 6.5}" y="${sy - 55}" width="5" height="4" rx="1" fill="${r === 1 && i === 2 ? C.warn : C.s400}"/>`;
        items += `<rect x="${ix + 5}" y="${sy - 26}" width="8" height="10" rx="1.5" fill="${C.b900}" opacity=".35"/>`;
      } else {
        items += `<rect x="${ix + 2}" y="${sy - 32}" width="15" height="32" rx="3" fill="${c}"/><rect x="${ix + 3}" y="${sy - 32}" width="13" height="4" rx="1.5" fill="${C.s200}"/><rect x="${ix + 4}" y="${sy - 24}" width="3" height="20" rx="1.5" fill="#fff" opacity=".45"/>`;
      }
    }
    items += `<rect x="${gx + 4}" y="${sy}" width="${gw - 8}" height="5" rx="2" fill="${C.s400}"/>`;
  });
  o.push(items);
  o.push(
    `<path d="M${gx + 18} ${gy + gh}L${gx + 86} ${gy}H${gx + 112}L${gx + 44} ${gy + gh}Z" fill="#fff" opacity=".09"/>`,
  );
  o.push(`<rect x="${X + W - 24}" y="${gy + 60}" width="7" height="100" rx="3.5" fill="${C.s200}"/>`);
  // base grille
  let gr = '';
  for (let i = 0; i < 7; i++)
    gr += `<rect x="${X + 30 + i * 18}" y="${Y + H - 26}" width="10" height="14" rx="3" fill="${C.b900}" opacity=".55"/>`;
  o.push(gr);
  o.push(`<rect x="${X + 4}" y="${Y + 6}" width="5" height="${H - 12}" rx="2.5" fill="#fff" opacity=".25"/>`);
  const a =
    air('M100 120C70 130 74 160 48 168', C.f300, 4.5) +
    air('M98 210C74 222 82 246 58 256', C.f400, 4) +
    air('M302 150C328 160 324 188 350 196', C.f300, 4.5) +
    air('M300 240C322 252 316 276 340 286', C.f400, 4);
  return doc(
    400,
    400,
    'Refrigeração comercial',
    defs,
    bg(6) +
      shadow(p, 200, 356, 120, 12) +
      o.join('') +
      a +
      sparkle(76, 76, 8, C.f300) +
      sparkle(334, 100, 10),
  );
}

function freezer() {
  const p = 'sf';
  const defs = stdDefs(p);
  const o = [];
  o.push(g('translate(56 150) scale(.96)', L.freezer(p)));
  o.push(air('M110 150C100 120 130 104 120 76', C.f300, 4.5));
  o.push(air('M170 146C162 116 196 100 186 64', C.f400, 5));
  o.push(air('M236 146C230 120 260 106 252 80', C.f300, 4.5));
  o.push(air('M296 148C296 128 316 118 312 100', C.f400, 4, 0.8));
  o.push(sparkle(150, 96, 10) + sparkle(224, 58, 13, C.f300) + sparkle(286, 82, 8));
  return doc(400, 400, 'Conserto de freezer', defs, bg(7) + shadow(p, 200, 322, 160, 12) + o.join(''));
}

module.exports = {
  'servico-geladeira.svg': geladeira,
  'servico-ar-condicionado.svg': arCondicionado,
  'servico-instalacao-ar.svg': instalacaoAr,
  'servico-lavadora.svg': lavadora,
  'servico-bebedouro.svg': bebedouro,
  'servico-refrigeracao-comercial.svg': comercial,
  'servico-freezer.svg': freezer,
};
