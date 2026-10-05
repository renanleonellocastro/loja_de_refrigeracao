// Builds the Refrigeração Castro logo as SVG from font outlines plus a hand built mascot.
import fs from 'node:fs';
import opentype from 'opentype.js';
import { Resvg } from '@resvg/resvg-js';

const here = new URL('.', import.meta.url);
const load = (f) => {
  const b = fs.readFileSync(new URL(`../fonts/${f}`, here));
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};

const big = load('montserrat-900.woff');
const small = load('montserrat-800.woff');

const F = 300; // CASTRO font size
const capH = (big.tables.os2.sCapHeight / big.unitsPerEm) * F;
const H = capH;
const baseline = 400;
const capTop = baseline - H;
const fmt = (n) => Math.round(n * 100) / 100;

function glyphPath(font, ch, x, y, size) {
  const p = font.getPath(ch, x, y, size);
  return { d: p.toPathData(2), box: p.getBoundingBox(), adv: font.getAdvanceWidth(ch, size) };
}

// Stem width of the heavy font measured from the I glyph.
const iBox = big.getPath('I', 0, 0, F).getBoundingBox();
const stem = iBox.x2 - iBox.x1;

// ---- CASTRO ----
const tracking = 0.02 * F;
let x = 0;
const letters = {};
for (const ch of 'CASTRO') {
  const g = glyphPath(big, ch, x, baseline, F);
  letters[ch] = g;
  x += g.adv + tracking;
}
const A = letters.A;
const ax = (A.box.x1 + A.box.x2) / 2; // apex x, the mascot axis
const u = (k) => k * H; // helper in cap height units

// ---- mascot ----
const torsoW = stem * 1.02;
const torsoTop = capTop - u(0.62);
const torso = `M${fmt(ax - torsoW / 2)} ${fmt(capTop + 2)}V${fmt(torsoTop + torsoW / 2)}a${fmt(torsoW / 2)} ${fmt(torsoW / 2)} 0 0 1 ${fmt(torsoW)} 0V${fmt(capTop + 2)}Z`;
// Custom A: its apex is the bottom of the torso, so the mascot stands on the A legs.
const legW = stem * 1.12;
const aL = A.box.x1;
const aR = A.box.x2;
const tw = torsoW;
const apexIn = [ax, capTop + tw * 1.35];
const lineX = (from, to, y) => from[0] + ((to[0] - from[0]) * (y - from[1])) / (to[1] - from[1]);
const BLi = [aL + legW, baseline];
const BRi = [aR - legW, baseline];
const cbTop = baseline - u(0.36);
const cbBot = baseline - u(0.2);
const aPath = [
  `M${fmt(ax - tw / 2)} ${fmt(capTop - 1)}H${fmt(ax + tw / 2)}`,
  `L${fmt(aR)} ${fmt(baseline)}H${fmt(BRi[0])}`,
  `L${fmt(lineX(BRi, apexIn, cbBot))} ${fmt(cbBot)}H${fmt(lineX(BLi, apexIn, cbBot))}`,
  `L${fmt(BLi[0])} ${fmt(baseline)}H${fmt(aL)}Z`,
  `M${fmt(apexIn[0])} ${fmt(apexIn[1])}L${fmt(lineX(BRi, apexIn, cbTop))} ${fmt(cbTop)}H${fmt(lineX(BLi, apexIn, cbTop))}Z`,
].join('');
const head = { cx: ax + u(0.05), cy: capTop - u(0.83), r: u(0.17) };

// R bowl attached to the right of the torso, aligned with the small word.
const smallSize = F * 0.3;
const smallCap = (small.tables.os2.sCapHeight / small.unitsPerEm) * smallSize;
const smallBase = capTop - u(0.08);
// R of REFRIGERAÇÃO: the real glyph, slightly taller than the word, grafted onto the torso so the torso is its stem.
const rCap = smallCap * 1.32;
const rSize = (rCap * small.unitsPerEm) / small.tables.os2.sCapHeight;
const rProbe = small.getPath('R', 0, 0, rSize).getBoundingBox();
const rStem = small.getPath('I', 0, 0, rSize).getBoundingBox();
const rStemW = rStem.x2 - rStem.x1;
const rX = ax + torsoW / 2 - rStemW - rProbe.x1;
const rGlyph = small.getPath('R', rX, smallBase, rSize);
const rBox = rGlyph.getBoundingBox();
const bowl = rGlyph.toPathData(2);
const bx = ax + torsoW / 2;
const bw = rBox.x2 - bx;

// Arm: shoulder, elbow, hand, as a thick round polyline.
const P = (dx, dy) => [ax + u(dx), capTop + u(dy)];
const shoulder = P(-0.02, -0.5);
const elbow = P(-0.42, -0.2);
const hand = P(-0.66, -0.62);
const armW = u(0.15);
const arm = `M${shoulder.map(fmt).join(' ')}L${elbow.map(fmt).join(' ')}L${hand.map(fmt).join(' ')}`;

// Open end wrench across the hand.
const w1 = P(-0.92, -0.44);
const w2 = P(-0.4, -0.86);
const barW = u(0.085);
const jawR = u(0.105);
const angle = Math.atan2(w2[1] - w1[1], w2[0] - w1[0]);
const deg = (angle * 180) / Math.PI;
function jaw([cx, cy], outward) {
  // A disc with a slot opening away from the bar.
  const slotW = jawR * 1.05;
  const slotL = jawR * 1.4;
  const rot = deg + (outward ? 15 : 195);
  return `<g transform="translate(${fmt(cx)} ${fmt(cy)}) rotate(${fmt(rot)})"><path fill-rule="evenodd" d="M${fmt(-jawR)} 0a${fmt(jawR)} ${fmt(jawR)} 0 1 0 ${fmt(2 * jawR)} 0a${fmt(jawR)} ${fmt(jawR)} 0 1 0 ${fmt(-2 * jawR)} 0Z M${fmt(jawR * 0.15)} ${fmt(-slotW / 2)}h${fmt(slotL)}v${fmt(slotW)}h${fmt(-slotL)}Z"/></g>`;
}
const wrenchBar = `M${w1.map(fmt).join(' ')}L${w2.map(fmt).join(' ')}`;

// ---- EFRIGERAÇÃO ----
const word = 'EFRIGERAÇÃO';
const smallTracking = 0.02 * smallSize;
let sx = rBox.x2 + smallSize * 0.05;
const smallPaths = [];
for (const ch of word) {
  const g = glyphPath(small, ch, sx, smallBase, smallSize);
  smallPaths.push(g.d);
  sx += g.adv + smallTracking;
}
const wordEnd = sx - smallTracking;
const castroEnd = letters.O.box.x2;

const minX = Math.min(letters.C.box.x1, w1[0] - jawR) - 8;
const minY = head.cy - head.r - 8;
const maxX = Math.max(wordEnd, castroEnd) + 8;
const maxY = baseline + 8;
const viewBox = [minX, minY, maxX - minX, maxY - minY].map(fmt).join(' ');

function mascot(fill) {
  return [
    `<circle cx="${fmt(head.cx)}" cy="${fmt(head.cy)}" r="${fmt(head.r)}"/>`,
    `<path d="${torso}"/>`,
    `<path fill-rule="evenodd" d="${bowl}"/>`,
    `<path d="${arm}" fill="none" stroke="${fill}" stroke-width="${fmt(armW)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<path d="${wrenchBar}" fill="none" stroke="${fill}" stroke-width="${fmt(barW)}" stroke-linecap="butt"/>`,
    jaw(w1, false),
    jaw(w2, true),
  ].join('');
}

// Silver letters with the drop shadow of the sign, for the blue header, hero and footer.
const RELIEF_DEFS = `<defs><linearGradient id="silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.55" stop-color="#E9ECEF"/><stop offset="1" stop-color="#C8CCD2"/></linearGradient><filter id="relief" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="2.5" dy="4" stdDeviation="2.2" flood-color="#06162A" flood-opacity="0.55"/></filter></defs>`;

function logo({ fill, background, relief, title = 'Refrigeração Castro' }) {
  const defs = relief ? RELIEF_DEFS : '';
  const paint = relief ? 'url(#silver)' : fill;
  const bg = background
    ? `<rect x="${fmt(minX - 40)}" y="${fmt(minY - 40)}" width="${fmt(maxX - minX + 80)}" height="${fmt(maxY - minY + 80)}" fill="${background}"/>`
    : '';
  const vb = background
    ? [minX - 40, minY - 40, maxX - minX + 80, maxY - minY + 80].map(fmt).join(' ')
    : viewBox;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${title}"><title>${title}</title>${defs}${bg}<g fill="${paint}"${relief ? ' filter="url(#relief)"' : ''}>${['C', 'S', 'T', 'R', 'O'].map((c) => `<path d="${letters[c].d}"/>`).join('')}<path fill-rule="evenodd" d="${aPath}"/>${mascot(paint)}${smallPaths.map((d) => `<path d="${d}"/>`).join('')}</g></svg>\n`;
}

function symbol({ fill, background, relief, shadow = false, maskable = false }) {
  const pad = 30;
  const sMinX = w1[0] - jawR - pad;
  const sMaxX = Math.max(bx + bw, A.box.x2) + pad;
  const sMinY = head.cy - head.r - pad;
  const sMaxY = baseline + pad;
  const side = Math.max(sMaxX - sMinX, sMaxY - sMinY) / (maskable ? 0.72 : 1);
  const cx = (sMinX + sMaxX) / 2;
  const cy = (sMinY + sMaxY) / 2;
  const vb = [cx - side / 2, cy - side / 2, side, side].map(fmt).join(' ');
  const paint = relief ? 'url(#silver)' : fill;
  const defs = shadow
    ? RELIEF_DEFS
    : relief
      ? `<defs><linearGradient id="silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D5D9DE"/></linearGradient></defs>`
      : '';
  const bg = background
    ? `<rect x="${fmt(cx - side / 2)}" y="${fmt(cy - side / 2)}" width="${fmt(side)}" height="${fmt(side)}" rx="${maskable ? 0 : fmt(side * 0.22)}" fill="${background}"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="Refrigeração Castro"><title>Refrigeração Castro</title>${defs}${bg}<g fill="${paint}"${shadow ? ' filter="url(#relief)"' : ''}><path fill-rule="evenodd" d="${aPath}"/>${mascot(paint)}</g></svg>\n`;
}

const out = new URL('../../../apps/web/public/brand/', here);
fs.mkdirSync(out, { recursive: true });
const files = {
  'logo-relevo-azul.svg': logo({ background: '#184E86', relief: true }),
  'logo-prata.svg': logo({ relief: true }),
  'logo-azul.svg': logo({ fill: '#184E86' }),
  'logo-branco.svg': logo({ fill: '#FFFFFF' }),
  'logo-mono.svg': logo({ fill: '#000000' }),
  'simbolo-azul.svg': symbol({ fill: '#184E86' }),
  'simbolo-branco.svg': symbol({ fill: '#FFFFFF' }),
  'simbolo-prata.svg': symbol({ relief: true, shadow: true }),
  'icone-app.svg': symbol({ background: '#184E86', relief: true }),
};
for (const [name, svg] of Object.entries(files)) fs.writeFileSync(new URL(name, out), svg);

function png(svgName, file, width) {
  const svg = fs.readFileSync(new URL(svgName, out), 'utf8');
  fs.writeFileSync(file, new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng());
}
const pub = new URL('../../../apps/web/public/', here);
png('icone-app.svg', new URL('icon-192.png', pub), 192);
png('icone-app.svg', new URL('icon-512.png', pub), 512);
png('icone-app.svg', new URL('apple-touch-icon.png', pub), 180);
png('icone-app.svg', new URL('favicon-32.png', pub), 32);
// Emails cannot rely on SVG: a white PNG logo for the blue email header.
png('logo-branco.svg', new URL('logo-email.png', out), 440);
fs.copyFileSync(new URL('icone-app.svg', out), new URL('favicon.svg', pub));

// Maskable icon: symbol inside the safe zone on a full bleed blue square.
const maskable = symbol({ fill: '#FFFFFF', background: '#184E86', maskable: true });
fs.writeFileSync(new URL('icon-maskable.svg', out), maskable);
png('icon-maskable.svg', new URL('icon-maskable-512.png', pub), 512);
console.warn('brand assets written');
