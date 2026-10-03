// Shared palette, defs and appliance components for the Refrigeracao Castro illustrations.
const fs = require('fs');
const path = require('path');
const LOGO_DIR = path.join(__dirname, '../../../apps/web/public/brand/');
// Names used by the illustration sources mapped to the published logo files.
const LOGO_FILES = {
  'logo-silver': 'logo-prata',
  'logo-white': 'logo-branco',
  'logo-blue': 'logo-azul',
  'symbol-blue': 'simbolo-azul',
};

const C = {
  b50: '#EEF4FB',
  b100: '#DCE8F6',
  b200: '#B5CEEC',
  b300: '#86ADDD',
  b400: '#4F86C9',
  b500: '#2A6DB5',
  b600: '#1F5C9E',
  b700: '#184E86',
  b800: '#133F6D',
  b900: '#0E2E52',
  b950: '#091D35',
  s50: '#F6F7F9',
  s100: '#ECEEF1',
  s200: '#DDE0E5',
  s300: '#C8CCD2',
  s400: '#A3A9B2',
  s500: '#7D8591',
  s600: '#5B6470',
  s800: '#2E333A',
  f200: '#BAE6FD',
  f300: '#7DD3FC',
  f400: '#38BDF8',
  f500: '#0EA5E9',
  w: '#FFFFFF',
  warn: '#F59E0B',
};

function doc(w, h, title, defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}"><title>${title}</title><defs>${defs}</defs>${body}</svg>\n`;
}

const stops = (arr) =>
  arr
    .map(
      ([o, c, a]) =>
        `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`,
    )
    .join('');
const lin = (id, x1, y1, x2, y2, s) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(s)}</linearGradient>`;
const rad = (id, s, extra = '') => `<radialGradient id="${id}"${extra}>${stops(s)}</radialGradient>`;

// Standard gradients, prefixed per file so inline usage never collides.
function stdDefs(p) {
  return [
    lin(`${p}st`, 0, 0, 1, 0, [
      [0, C.s300],
      [0.07, C.s50],
      [0.32, C.s100],
      [0.72, C.s300],
      [1, C.s400],
    ]),
    lin(`${p}wh`, 0, 0, 1, 0, [
      [0, C.w],
      [0.55, C.s50],
      [1, C.s200],
    ]),
    lin(`${p}whv`, 0, 0, 0, 1, [
      [0, C.w],
      [1, C.s100],
    ]),
    lin(`${p}dk`, 0, 0, 0, 1, [
      [0, C.b800],
      [1, C.b950],
    ]),
    lin(`${p}lid`, 0, 0, 1, 1, [
      [0, C.b400],
      [1, C.b800],
    ]),
    lin(`${p}wat`, 0, 0, 1, 0, [
      [0, C.f200, 0.95],
      [0.5, C.f300, 0.85],
      [1, C.b400, 0.9],
    ]),
    rad(`${p}glow`, [
      [0, C.f200, 0.95],
      [0.55, C.f300, 0.35],
      [1, C.f300, 0],
    ]),
    rad(`${p}sh`, [
      [0, C.b900, 0.28],
      [1, C.b900, 0],
    ]),
  ].join('');
}

// Organic rounded blob (Catmull Rom through jittered radial points).
function blob(cx, cy, rx, ry, seed, fill, extra = '') {
  const n = 8,
    pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed * 0.3;
    const k = 1 + 0.035 * Math.sin(seed * 1.7 + i * 2.1) + 0.02 * Math.cos(seed + i * 3.3);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n],
      p1 = pts[i],
      p2 = pts[(i + 1) % n],
      p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `<path d="${d}Z" fill="${fill}"${extra}/>`;
}

// Embed a logo file verbatim inside a nested svg viewport, ids prefixed.
function logo(kind, x, y, width, p) {
  const src = fs.readFileSync(`${LOGO_DIR}${LOGO_FILES[kind] ?? kind}.svg`, 'utf8');
  const vb = src.match(/viewBox="([^"]+)"/)[1];
  const [, , vw, vh] = vb.split(/\s+/).map(Number);
  let inner = src.replace(/^[\s\S]*?<\/title>/, '').replace(/<\/svg>\s*$/, '');
  inner = inner.replace(/id="([^"]+)"/g, `id="${p}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`);
  const h = (width * vh) / vw;
  return `<svg x="${x}" y="${y.toFixed(1)}" width="${width}" height="${h.toFixed(1)}" viewBox="${vb}" overflow="visible">${inner}</svg>`;
}
const logoHeight = (kind, width) => {
  const src = fs.readFileSync(`${LOGO_DIR}${LOGO_FILES[kind] ?? kind}.svg`, 'utf8');
  const [, , vw, vh] = src
    .match(/viewBox="([^"]+)"/)[1]
    .split(/\s+/)
    .map(Number);
  return (width * vh) / vw;
};

const shadow = (p, cx, cy, rx, ry, op = 1) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${p}sh)" opacity="${op}"/>`;
const g = (t, s, extra = '') => `<g transform="${t}"${extra}>${s}</g>`;

// Frost air line: stroked curve with round caps.
const air = (d, color, w = 4, op = 1, extra = '') =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"${extra}/>`;

// Snowflake centered at 0,0 with arm length r.
function snowflake(r, color, w) {
  let s = '';
  for (let i = 0; i < 3; i++) {
    const a = i * 60;
    s += `<g transform="rotate(${a})"><path d="M0 ${-r}V${r}M${-r * 0.32} ${-r * 0.78}L0 ${-r * 0.5}L${r * 0.32} ${-r * 0.78}M${-r * 0.32} ${r * 0.78}L0 ${r * 0.5}L${r * 0.32} ${r * 0.78}"/></g>`;
  }
  return `<g fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${s}</g>`;
}

// ---------- Appliances (local coordinates, origin top left) ----------

// Stainless duplex fridge with dispenser, 140 x 304.
function fridge(p) {
  return [
    `<rect width="140" height="300" rx="10" fill="url(#${p}st)"/>`,
    `<rect x="131" y="3" width="9" height="294" rx="4.5" fill="${C.s500}" opacity=".28"/>`,
    `<rect y="94" width="140" height="4" fill="${C.s500}"/>`,
    `<rect y="98" width="140" height="5" fill="${C.s400}" opacity=".35"/>`,
    `<rect x="12" y="7" width="8" height="82" rx="4" fill="#fff" opacity=".7"/>`,
    `<rect x="12" y="105" width="8" height="186" rx="4" fill="#fff" opacity=".7"/>`,
    `<rect x="115" y="30" width="8" height="48" rx="4" fill="${C.s600}"/><rect x="116.5" y="32" width="2.5" height="44" rx="1.2" fill="${C.s200}"/>`,
    `<rect x="115" y="110" width="8" height="80" rx="4" fill="${C.s600}"/><rect x="116.5" y="112" width="2.5" height="76" rx="1.2" fill="${C.s200}"/>`,
    `<rect x="30" y="118" width="50" height="68" rx="8" fill="url(#${p}dk)"/>`,
    `<rect x="36" y="125" width="38" height="9" rx="3" fill="${C.f400}"/>`,
    `<rect x="40" y="128" width="8" height="3" rx="1.5" fill="${C.f200}"/><rect x="52" y="128" width="5" height="3" rx="1.5" fill="${C.f200}"/>`,
    `<rect x="49" y="141" width="12" height="15" rx="3" fill="${C.s600}"/>`,
    `<rect x="36" y="175" width="38" height="5" rx="2.5" fill="${C.s500}"/>`,
    `<rect x="52" y="18" width="36" height="4" rx="2" fill="${C.s400}"/>`,
    `<rect x="10" y="299" width="18" height="6" rx="2" fill="${C.s800}"/><rect x="112" y="299" width="18" height="6" rx="2" fill="${C.s800}"/>`,
  ].join('');
}

// Top load washer, 170 x 200 closed (deck 72) or 170 x 232 open (deck 104).
function washer(p, { open = false, swirl = '' } = {}) {
  const D = open ? 104 : 72;
  const s = [];
  s.push(`<rect x="4" y="0" width="162" height="40" rx="12" fill="url(#${p}wh)"/>`);
  s.push(`<rect x="4" y="30" width="162" height="10" fill="${C.s200}" opacity=".7"/>`);
  s.push(`<rect x="58" y="10" width="54" height="16" rx="5" fill="url(#${p}dk)"/>`);
  s.push(
    `<rect x="64" y="15" width="16" height="6" rx="2" fill="${C.f400}"/><rect x="84" y="15" width="8" height="6" rx="2" fill="${C.f300}" opacity=".7"/><circle cx="102" cy="18" r="3" fill="${C.f400}"/>`,
  );
  s.push(
    `<circle cx="28" cy="19" r="9" fill="${C.s200}"/><circle cx="27" cy="18" r="6" fill="#fff"/><circle cx="142" cy="19" r="9" fill="${C.s200}"/><circle cx="141" cy="18" r="6" fill="#fff"/>`,
  );
  s.push(`<path d="M0 50Q0 40 10 40H160Q170 40 170 50V${D}H0Z" fill="#fff"/>`);
  if (!open) {
    s.push(`<rect x="18" y="44" width="134" height="24" rx="9" fill="url(#${p}lid)"/>`);
    s.push(`<path d="M26 50H96" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>`);
    s.push(`<rect x="70" y="63" width="30" height="5" rx="2.5" fill="${C.s300}"/>`);
  } else {
    s.push(swirl);
  }
  const B = D + 126;
  s.push(
    `<path d="M0 ${D - 2}H170V${B - 10}Q170 ${B} 160 ${B}H10Q0 ${B} 0 ${B - 10}Z" fill="url(#${p}wh)"/>`,
  );
  s.push(`<rect y="${D - 2}" width="170" height="4" fill="${C.s200}"/>`);
  s.push(`<rect x="10" y="${D + 8}" width="7" height="104" rx="3.5" fill="#fff"/>`);
  s.push(`<rect x="0" y="${B - 16}" width="170" height="16" rx="6" fill="${C.s200}"/>`);
  s.push(`<rect x="60" y="${D + 22}" width="50" height="4" rx="2" fill="${C.s300}"/>`);
  return s.join('');
}

// Water dispenser with 20 L bottle, 100 x 304.
function dispenser(p) {
  const s = [];
  // bottle
  s.push(
    `<path d="M30 112V100Q12 96 10 80V22Q10 4 30 2H70Q90 4 90 22V80Q88 96 70 100V112Z" fill="url(#${p}wat)"/>`,
  );
  s.push(`<path d="M12 40H88M12 64H88" stroke="#fff" stroke-width="2.5" opacity=".45"/>`);
  s.push(`<rect x="20" y="10" width="8" height="78" rx="4" fill="#fff" opacity=".6"/>`);
  s.push(`<path d="M30 2H70Q90 4 90 22V24H10V22Q10 4 30 2Z" fill="${C.b400}" opacity=".35"/>`);
  // cabinet
  s.push(`<rect x="2" y="110" width="96" height="190" rx="10" fill="url(#${p}wh)"/>`);
  s.push(`<rect x="14" y="104" width="72" height="12" rx="5" fill="${C.s200}"/>`);
  s.push(`<rect x="14" y="136" width="72" height="66" rx="9" fill="${C.s200}"/>`);
  s.push(`<rect x="18" y="140" width="64" height="58" rx="7" fill="${C.s300}" opacity=".55"/>`);
  s.push(
    `<rect x="26" y="142" width="16" height="14" rx="4" fill="${C.b500}"/><rect x="30" y="156" width="8" height="8" rx="2" fill="${C.s500}"/>`,
  );
  s.push(
    `<rect x="58" y="142" width="16" height="14" rx="4" fill="${C.s400}"/><rect x="62" y="156" width="8" height="8" rx="2" fill="${C.s500}"/>`,
  );
  s.push(`<rect x="22" y="188" width="56" height="7" rx="3.5" fill="${C.s500}"/>`);
  s.push(`<circle cx="50" cy="124" r="3.5" fill="${C.f400}"/>`);
  s.push(`<rect x="10" y="214" width="80" height="78" rx="6" fill="${C.s100}"/>`);
  s.push(`<rect x="78" y="232" width="5" height="34" rx="2.5" fill="${C.s300}"/>`);
  s.push(`<rect x="8" y="118" width="6" height="170" rx="3" fill="#fff"/>`);
  return s.join('');
}

// Wall split indoor unit, 300 x 92.
function split(p) {
  return [
    `<rect width="300" height="86" rx="24" fill="url(#${p}whv)"/>`,
    `<rect x="0" y="54" width="300" height="32" rx="16" fill="${C.s100}"/>`,
    `<path d="M16 56H284" stroke="${C.s200}" stroke-width="2"/>`,
    `<rect x="22" y="70" width="256" height="12" rx="6" fill="${C.s600}"/>`,
    `<rect x="26" y="77" width="248" height="9" rx="4.5" fill="${C.s200}"/>`,
    `<path d="M30 10H200" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`,
    `<rect x="232" y="28" width="38" height="14" rx="5" fill="url(#${p}dk)"/>`,
    `<rect x="237" y="32" width="14" height="6" rx="2" fill="${C.f400}"/><circle cx="261" cy="35" r="2.6" fill="${C.f300}"/>`,
    `<rect x="40" y="34" width="22" height="4" rx="2" fill="${C.s300}"/>`,
  ].join('');
}

// Condenser (outdoor unit), 220 x 160.
function condenser(p) {
  const s = [];
  s.push(`<rect width="220" height="150" rx="10" fill="url(#${p}wh)"/>`);
  s.push(`<rect y="140" width="220" height="10" rx="4" fill="${C.s300}"/>`);
  s.push(`<circle cx="82" cy="74" r="56" fill="${C.s200}"/>`);
  s.push(`<circle cx="82" cy="74" r="50" fill="${C.s600}"/>`);
  let blades = '';
  for (let i = 0; i < 3; i++)
    blades += `<path transform="rotate(${i * 120} 82 74)" d="M82 74Q72 40 96 30Q104 56 82 74Z" fill="${C.s400}"/>`;
  s.push(blades);
  s.push(
    `<g fill="none" stroke="${C.s300}" stroke-width="2.4"><circle cx="82" cy="74" r="50"/><circle cx="82" cy="74" r="38"/><circle cx="82" cy="74" r="25"/><path d="M32 74H132M82 24V124"/></g>`,
  );
  s.push(`<circle cx="82" cy="74" r="8" fill="${C.s200}"/>`);
  let grille = '';
  for (let i = 0; i < 9; i++)
    grille += `<rect x="156" y="${22 + i * 12}" width="48" height="5" rx="2.5" fill="${C.s300}"/>`;
  s.push(grille);
  s.push(`<rect x="8" y="8" width="6" height="128" rx="3" fill="#fff"/>`);
  s.push(
    `<rect x="20" y="150" width="30" height="10" rx="3" fill="${C.s600}"/><rect x="170" y="150" width="30" height="10" rx="3" fill="${C.s600}"/>`,
  );
  return s.join('');
}

// Open end wrench, head centered at 0,0 pointing right; length about 150.
function wrench(fill = C.s400, hi = C.s200, dark = C.s600) {
  return [
    `<rect x="-128" y="-8" width="118" height="16" rx="8" fill="${fill}"/>`,
    `<rect x="-122" y="-6" width="104" height="5" rx="2.5" fill="${hi}"/>`,
    `<path d="M18.3 -9A21 21 0 1 0 18.3 9L5 9V-9Z" fill="${fill}"/>`,
    `<path d="M-14 -14A20 20 0 0 1 4 -19" fill="none" stroke="${hi}" stroke-width="3" stroke-linecap="round"/>`,
    `<path fill-rule="evenodd" d="M-150 0a15 15 0 1 0 30 0a15 15 0 1 0 -30 0ZM-142 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0Z" fill="${fill}"/>`,
    `<rect x="-90" y="2" width="40" height="3" rx="1.5" fill="${dark}" opacity=".5"/>`,
  ].join('');
}

// Chest freezer, 300 x 176.
function freezer(p) {
  const s = [];
  s.push(`<path d="M22 0H278L300 34H0Z" fill="url(#${p}whv)"/>`);
  s.push(`<path d="M60 10H200" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`);
  s.push(`<rect x="0" y="32" width="300" height="20" rx="5" fill="${C.s100}"/>`);
  s.push(`<rect x="120" y="40" width="60" height="8" rx="4" fill="${C.s400}"/>`);
  s.push(`<rect x="4" y="52" width="292" height="4" fill="${C.s400}"/>`);
  s.push(`<path d="M4 56H296V160Q296 170 286 170H14Q4 170 4 160Z" fill="url(#${p}wh)"/>`);
  s.push(`<rect x="14" y="64" width="7" height="94" rx="3.5" fill="#fff"/>`);
  s.push(
    `<rect x="34" y="70" width="40" height="18" rx="5" fill="url(#${p}dk)"/><circle cx="44" cy="79" r="3.5" fill="${C.f400}"/><rect x="52" y="76" width="16" height="6" rx="2" fill="${C.f300}" opacity=".8"/>`,
  );
  let vent = '';
  for (let i = 0; i < 5; i++)
    vent += `<rect x="${216 + i * 12}" y="142" width="6" height="18" rx="3" fill="${C.s300}"/>`;
  s.push(vent);
  s.push(`<rect x="4" y="164" width="292" height="6" rx="3" fill="${C.s200}"/>`);
  s.push(
    `<rect x="16" y="170" width="22" height="6" rx="2" fill="${C.s800}"/><rect x="262" y="170" width="22" height="6" rx="2" fill="${C.s800}"/>`,
  );
  return s.join('');
}

// Open top load washer with lid raised and water swirl. Local box x 0..170, y -40..230.
// Needs radial gradient `${p}drum` in defs (added by drumDef).
const drumDef = (p) =>
  `<radialGradient id="${p}drum"><stop offset="0" stop-color="${C.b600}"/><stop offset="1" stop-color="${C.b950}"/></radialGradient>`;
function washerOpen(p) {
  const swirl = [
    `<ellipse cx="85" cy="73" rx="66" ry="25" fill="${C.s200}"/>`,
    `<ellipse cx="85" cy="74" rx="60" ry="21" fill="url(#${p}drum)"/>`,
    `<ellipse cx="85" cy="78" rx="50" ry="15" fill="${C.f300}"/>`,
    `<path d="M45 78C50 68 120 66 124 78C128 90 60 92 62 80C64 72 108 72 106 79C104 86 78 86 80 80" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`,
    `<path d="M50 86C70 92 104 92 120 84" fill="none" stroke="${C.f400}" stroke-width="3" stroke-linecap="round"/>`,
  ].join('');
  return [
    `<path d="M25 26L33 -34Q34 -40 41 -40H129Q136 -40 137 -34L145 26Z" fill="${C.b300}" opacity=".55"/>`,
    `<path d="M25 26L33 -34Q34 -40 41 -40H129Q136 -40 137 -34L145 26" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>`,
    `<path d="M45 10L81 -30M69 10L99 -24" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6"/><rect x="69" y="-44" width="32" height="8" rx="4" fill="${C.s300}"/>`,
    washer(p, { open: true, swirl }),
  ].join('');
}

module.exports = {
  washerOpen,
  drumDef,
  C,
  doc,
  lin,
  rad,
  stops,
  stdDefs,
  blob,
  logo,
  logoHeight,
  shadow,
  g,
  air,
  snowflake,
  fridge,
  washer,
  dispenser,
  split,
  condenser,
  wrench,
  freezer,
};
