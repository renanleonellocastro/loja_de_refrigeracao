// Service illustrations, 400 x 400.
const L = require('./lib.cjs');
const { C, doc, stdDefs, gradientDefs, HORIZONTAL, DIAGONAL, blob, shadow, g, air, snowflake, lin } = L;

const bg = (seed) =>
  blob(200, 206, 172, 160, seed, C.b50) +
  `<circle cx="338" cy="92" r="10" fill="${C.b100}"/><circle cx="62" cy="318" r="7" fill="${C.b100}"/>`;
const sparkle = (x, y, r, c = C.f400) => g(`translate(${x} ${y})`, snowflake(r, c, 2.4));

const SERVICE_SIZE = 400;
const serviceDoc = (title, defs, body) => doc(SERVICE_SIZE, SERVICE_SIZE, title, defs, body);
// Each cold air line is the argument list of `air`: path, color, width and optional opacity.
const airLines = (lines) => lines.map((line) => air(...line)).join('');

function geladeiraDefs(p) {
  return (
    stdDefs(p) +
    lin(`${p}cav`, 0, 0, 0, 1, [
      [0, C.f200],
      [0.35, C.b50],
      [1, C.b100],
    ])
  );
}

function openFridgeCabinet(p) {
  return [
    `<ellipse cx="70" cy="190" rx="150" ry="175" fill="url(#${p}glow)" opacity=".75"/>`,
    `<rect width="140" height="300" rx="10" fill="url(#${p}st)"/>`,
    `<rect x="131" y="3" width="9" height="294" rx="4.5" fill="${C.s500}" opacity=".28"/>`,
    `<rect y="94" width="140" height="4" fill="${C.s500}"/>`,
    `<rect x="12" y="7" width="8" height="82" rx="4" fill="#fff" opacity=".7"/>`,
    `<rect x="115" y="30" width="8" height="48" rx="4" fill="${C.s600}"/><rect x="116.5" y="32" width="2.5" height="44" rx="1.2" fill="${C.s200}"/>`,
    `<rect x="52" y="18" width="36" height="4" rx="2" fill="${C.s400}"/>`,
    `<rect x="7" y="102" width="126" height="191" rx="6" fill="url(#${p}cav)"/>`,
    `<rect x="45" y="104" width="50" height="5" rx="2.5" fill="#fff"/>`,
  ].join('');
}

const fridgeShelf = (y) =>
  `<rect x="9" y="${y}" width="122" height="5" rx="2" fill="${C.f200}"/><rect x="9" y="${y}" width="122" height="1.6" fill="#fff"/>`;

function upperShelfGroceries() {
  return [
    `<rect x="22" y="124" width="14" height="34" rx="4" fill="${C.b400}"/><rect x="25" y="114" width="8" height="12" rx="2" fill="${C.b500}"/><rect x="24" y="128" width="3" height="24" rx="1.5" fill="#fff" opacity=".5"/>`,
    `<rect x="44" y="128" width="28" height="30" rx="7" fill="${C.f300}"/><rect x="47" y="122" width="10" height="8" rx="2" fill="${C.b300}"/>`,
    `<rect x="82" y="138" width="38" height="20" rx="4" fill="#fff"/><rect x="80" y="133" width="42" height="7" rx="3" fill="${C.b300}"/>`,
    fridgeShelf(158),
  ].join('');
}

function lowerShelfGroceries() {
  return [
    `<rect x="18" y="186" width="42" height="28" rx="5" fill="#fff"/><rect x="18" y="182" width="42" height="7" rx="3" fill="${C.b200}"/>`,
    `<rect x="70" y="186" width="12" height="28" rx="3" fill="${C.b500}"/><rect x="86" y="186" width="12" height="28" rx="3" fill="${C.f400}"/><rect x="102" y="186" width="12" height="28" rx="3" fill="${C.s300}"/>`,
    `<rect x="70" y="186" width="12" height="4" fill="#fff" opacity=".45"/><rect x="86" y="186" width="12" height="4" fill="#fff" opacity=".45"/><rect x="102" y="186" width="12" height="4" fill="#fff" opacity=".55"/>`,
    fridgeShelf(214),
  ].join('');
}

function crisperDrawer() {
  return [
    `<rect x="13" y="226" width="114" height="60" rx="8" fill="${C.f200}" opacity=".7"/>`,
    `<rect x="13" y="262" width="114" height="24" rx="8" fill="${C.b200}"/><rect x="50" y="270" width="40" height="5" rx="2.5" fill="#fff" opacity=".8"/>`,
    `<path d="M24 240Q40 232 56 240T88 240" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>`,
  ].join('');
}

const OPEN_FRIDGE_DOOR_PATH = 'M140 98L202 82Q208 81 208 87V315Q208 321 202 320L140 302Z';

function openFridgeDoor(p) {
  return [
    `<path d="${OPEN_FRIDGE_DOOR_PATH}" fill="url(#${p}wh)"/>`,
    `<path d="${OPEN_FRIDGE_DOOR_PATH}" fill="none" stroke="${C.b200}" stroke-width="3" stroke-linejoin="round"/>`,
    `<rect x="158" y="118" width="10" height="28" rx="3" fill="${C.b400}"/><rect x="172" y="122" width="10" height="24" rx="3" fill="${C.s300}"/><rect x="186" y="116" width="9" height="28" rx="3" fill="${C.f400}"/>`,
    `<rect x="160" y="180" width="14" height="26" rx="3" fill="#fff" stroke="${C.s200}"/><rect x="178" y="184" width="14" height="20" rx="3" fill="${C.b300}"/>`,
    `<path d="M148 142L200 132V150L148 158Z" fill="${C.f300}" opacity=".85"/><path d="M148 200L200 196V214L148 216Z" fill="${C.f300}" opacity=".85"/><path d="M148 256L200 258V276L148 272Z" fill="${C.f300}" opacity=".85"/>`,
  ].join('');
}

const OPEN_FRIDGE_AIR_LINES = [
  ['M6 180C-30 170 -44 204 -76 196', C.f300, 4.5],
  ['M6 228C-24 232 -30 262 -64 258', C.f400, 4],
  ['M30 296C10 318 -30 312 -46 330', C.f300, 3.5, 0.8],
  ['M-40 150C-56 140 -70 152 -84 146', C.f400, 3, 0.7],
];

function openFridge(p) {
  return [
    openFridgeCabinet(p),
    upperShelfGroceries(),
    lowerShelfGroceries(),
    crisperDrawer(),
    openFridgeDoor(p),
    airLines(OPEN_FRIDGE_AIR_LINES),
  ].join('');
}

function geladeira() {
  const p = 'sg';
  const body = [
    bg(1),
    shadow(p, 212, 330, 115, 13),
    g('translate(116 56) scale(.9)', openFridge(p)),
    sparkle(70, 120, 11) + sparkle(330, 170, 8, C.f300) + sparkle(318, 290, 6),
  ].join('');
  return serviceDoc('Conserto de geladeira', geladeiraDefs(p), body);
}

const SPLIT_AIR_LINES = [
  ['M90 178C80 212 110 230 96 262', C.f300, 5],
  ['M140 180C134 222 168 240 156 290', C.f400, 5],
  ['M196 180C194 226 226 248 218 300', C.f300, 5],
  ['M252 180C256 222 286 236 282 280', C.f400, 5],
  ['M304 178C312 206 334 218 332 248', C.f300, 4.5, 0.8],
  ['M118 214C116 232 128 240 124 252', C.f200, 3.5],
  ['M226 212C228 232 244 238 240 254', C.f200, 3.5],
];

function remoteControl() {
  return g(
    'translate(302 262) rotate(14)',
    `<rect width="44" height="88" rx="12" fill="${C.b700}"/><rect x="2" y="2" width="20" height="84" rx="10" fill="${C.b600}"/><rect x="8" y="10" width="28" height="18" rx="4" fill="${C.f300}"/><rect x="12" y="15" width="12" height="7" rx="2" fill="${C.b900}"/><circle cx="16" cy="44" r="5" fill="${C.b300}"/><circle cx="30" cy="44" r="5" fill="${C.b300}"/><rect x="11" y="58" width="22" height="6" rx="3" fill="${C.b400}"/><rect x="11" y="70" width="22" height="6" rx="3" fill="${C.b400}"/>`,
  );
}

function arCondicionado() {
  const p = 'sa';
  const body = [
    bg(2),
    `<rect x="44" y="70" width="312" height="10" rx="5" fill="${C.b100}"/>`,
    g('translate(50 74)', L.split(p)),
    airLines(SPLIT_AIR_LINES),
    sparkle(176, 316, 12) + sparkle(110, 300, 7, C.f300) + sparkle(270, 312, 8, C.f300),
    remoteControl(),
  ].join('');
  return serviceDoc('Conserto de ar-condicionado', stdDefs(p), body);
}

function instalacaoArDefs(p) {
  return (
    stdDefs(p) +
    lin(`${p}lv`, 0, 0, 0, 1, [
      [0, C.b400],
      [1, C.b600],
    ])
  );
}

const WALL_BRACKET_POSITIONS = [140, 282];

function wallBracket(x) {
  return `<rect x="${x}" y="290" width="14" height="64" rx="4" fill="${C.s600}"/><rect x="${x}" y="290" width="5" height="64" rx="2.5" fill="${C.s400}"/><path d="M${x + 7} 344L${x + 44} 296" stroke="${C.s600}" stroke-width="8" stroke-linecap="round"/><circle cx="${x + 7}" cy="304" r="3" fill="${C.s200}"/><circle cx="${x + 7}" cy="340" r="3" fill="${C.s200}"/>`;
}

function mountedCondenser(p) {
  return [
    WALL_BRACKET_POSITIONS.map(wallBracket).join(''),
    `<rect x="126" y="282" width="220" height="12" rx="5" fill="${C.s500}"/><rect x="126" y="282" width="220" height="4" rx="2" fill="${C.s300}"/>`,
    g('translate(126 128) scale(.95)', L.condenser(p)),
    `<path d="M334 214C352 214 356 228 356 244V300" fill="none" stroke="${C.s300}" stroke-width="13" stroke-linecap="round"/><path d="M334 214C352 214 356 228 356 244V300" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M334 198C362 198 368 214 368 236V290" fill="none" stroke="${C.s300}" stroke-width="6" stroke-linecap="round"/>`,
  ].join('');
}

// Spirit level resting on top of the condenser.
function spiritLevel(p) {
  return g(
    'translate(160 106)',
    `<rect width="140" height="22" rx="6" fill="url(#${p}lv)"/><rect width="140" height="6" rx="3" fill="${C.b300}" opacity=".7"/><rect x="51" y="5" width="38" height="12" rx="6" fill="${C.f200}"/><ellipse cx="70" cy="11" rx="7" ry="4" fill="#fff"/><path d="M61 5V17M79 5V17" stroke="${C.b700}" stroke-width="2"/><rect width="14" height="22" rx="5" fill="${C.s800}"/><rect x="126" width="14" height="22" rx="5" fill="${C.s800}"/><circle cx="30" cy="11" r="4" fill="${C.b800}"/><circle cx="110" cy="11" r="4" fill="${C.b800}"/>`,
  );
}

function instalacaoAr() {
  const p = 'si';
  const body = [
    bg(3),
    `<g fill="${C.b100}"><rect x="56" y="96" width="64" height="20" rx="6"/><rect x="74" y="124" width="40" height="20" rx="6"/><rect x="300" y="300" width="56" height="20" rx="6"/></g>`,
    mountedCondenser(p),
    spiritLevel(p),
    g('translate(68 326) rotate(115) scale(.74)', L.wrench()),
    sparkle(328, 92, 9, C.f300) + sparkle(96, 196, 7),
  ].join('');
  return serviceDoc('Instalação de ar-condicionado', instalacaoArDefs(p), body);
}

function lavadora() {
  const p = 'sl';
  const body = [
    bg(4) + shadow(p, 200, 362, 110, 12),
    g('translate(115 126)', L.washerOpen(p)),
    `<circle cx="166" cy="176" r="5" fill="#fff" stroke="${C.f300}" stroke-width="2"/><circle cx="236" cy="168" r="4" fill="#fff" stroke="${C.f300}" stroke-width="2"/><circle cx="214" cy="150" r="3" fill="#fff" stroke="${C.f300}" stroke-width="2"/>`,
    air('M98 150C78 164 86 194 64 206', C.f300, 4.5) + air('M302 150C322 164 314 194 336 206', C.f300, 4.5),
    `<path d="M330 270q8 -14 0 -26q-8 12 0 26z" fill="${C.f400}"/><path d="M72 280q7 -12 0 -22q-7 10 0 22z" fill="${C.f300}"/>`,
  ].join('');
  return serviceDoc('Conserto de máquina de lavar', stdDefs(p) + L.drumDef(p), body);
}

const DISPENSER_AIR_LINES = [
  ['M110 116C88 130 92 160 70 170', C.f300, 4.5],
  ['M122 168C104 184 112 208 92 220', C.f400, 4],
  ['M292 112C312 126 306 154 330 164', C.f300, 4.5],
  ['M282 170C300 184 292 206 314 218', C.f400, 4],
];

const cupUnderColdTap = () =>
  `<path d="M171 216H191L188 238H174Z" fill="${C.f200}" opacity=".9"/><path d="M172.5 224H189.5L188 238H174Z" fill="${C.f400}" opacity=".7"/><path d="M180 197V214" stroke="${C.f400}" stroke-width="3" stroke-linecap="round"/>`;

function bebedouro() {
  const p = 'sb';
  const body = [
    bg(5) + shadow(p, 200, 340, 90, 11),
    g('translate(152 44) scale(.96)', L.dispenser(p)),
    cupUnderColdTap(),
    airLines(DISPENSER_AIR_LINES),
    sparkle(88, 260, 9) + sparkle(318, 270, 7, C.f300),
    `<path d="M302 96q10 -18 0 -32q-10 14 0 32z" fill="${C.f400}"/><path d="M98 98q7 -12 0 -22q-7 10 0 22z" fill="${C.f300}"/>`,
  ].join('');
  return serviceDoc('Conserto de bebedouro e purificador', stdDefs(p), body);
}

const COMMERCIAL_LINEAR_GRADIENTS = [
  {
    suffix: 'gl',
    vector: DIAGONAL,
    stops: [
      [0, C.b800],
      [1, C.b950],
    ],
  },
  {
    suffix: 'bd',
    vector: HORIZONTAL,
    stops: [
      [0, C.b500],
      [0.5, C.b600],
      [1, C.b800],
    ],
  },
  {
    suffix: 'hd',
    vector: HORIZONTAL,
    stops: [
      [0, C.b400],
      [1, C.b600],
    ],
  },
];

const COOLER = { x: 112, y: 34, width: 176, height: 318 };
const COOLER_GLASS = { x: COOLER.x + 14, y: COOLER.y + 64, width: COOLER.width - 28, height: 222 };
const COOLER_SHELF_OFFSETS = [74, 142, 210];
const COOLER_ITEMS_PER_SHELF = 6;
const COOLER_ITEM_PITCH = 22;
const COOLER_ITEM_COLORS = [C.f400, C.b300, C.w, C.b400, C.f300, C.s300];
// The one bottle with a warning cap, so the eye finds a detail on the shelf.
const WARNING_BOTTLE = { shelf: 1, slot: 2 };
const COOLER_GRILLE_SLOT_COUNT = 7;

function coolerHeader(p) {
  const { x, y, width } = COOLER;
  return [
    `<rect x="${x + 8}" y="${y + 8}" width="${width - 16}" height="46" rx="8" fill="url(#${p}hd)"/>`,
    `<path d="M${x + 26} ${y + 31}C${x + 56} ${y + 18} ${x + 86} ${y + 44} ${x + 116} ${y + 28}S${x + 146} ${y + 26} ${x + 152} ${y + 32}" fill="none" stroke="${C.f200}" stroke-width="4" stroke-linecap="round"/>`,
    `<path d="M${x + 26} ${y + 41}C${x + 56} ${y + 30} ${x + 86} ${y + 52} ${x + 116} ${y + 40}" fill="none" stroke="${C.f300}" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>`,
  ].join('');
}

function coolerGlass(p) {
  const { x, y, width, height } = COOLER_GLASS;
  return [
    `<rect x="${x - 4}" y="${y - 4}" width="${width + 8}" height="${height + 8}" rx="10" fill="${C.s300}"/>`,
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="7" fill="url(#${p}gl)"/>`,
    `<rect x="${x}" y="${y}" width="${width}" height="10" rx="5" fill="${C.f300}" opacity=".85"/>`,
    `<ellipse cx="${x + width / 2}" cy="${y + 20}" rx="${width / 2}" ry="40" fill="url(#${p}glow)" opacity=".55"/>`,
  ].join('');
}

function coolerBottle(itemX, shelfY, color, capColor) {
  return [
    `<path d="M${itemX + 4} ${shelfY}V${shelfY - 34}Q${itemX + 4} ${shelfY - 40} ${itemX + 7} ${shelfY - 44}V${shelfY - 52}H${itemX + 11}V${shelfY - 44}Q${itemX + 14} ${shelfY - 40} ${itemX + 14} ${shelfY - 34}V${shelfY}Z" fill="${color}"/>`,
    `<rect x="${itemX + 6.5}" y="${shelfY - 55}" width="5" height="4" rx="1" fill="${capColor}"/>`,
    `<rect x="${itemX + 5}" y="${shelfY - 26}" width="8" height="10" rx="1.5" fill="${C.b900}" opacity=".35"/>`,
  ].join('');
}

function coolerCan(itemX, shelfY, color) {
  return `<rect x="${itemX + 2}" y="${shelfY - 32}" width="15" height="32" rx="3" fill="${color}"/><rect x="${itemX + 3}" y="${shelfY - 32}" width="13" height="4" rx="1.5" fill="${C.s200}"/><rect x="${itemX + 4}" y="${shelfY - 24}" width="3" height="20" rx="1.5" fill="#fff" opacity=".45"/>`;
}

// Bottles and cans alternate along the shelf, shifting by one slot on each shelf.
function coolerItem(shelf, slot, shelfY) {
  const itemX = COOLER_GLASS.x + 10 + slot * COOLER_ITEM_PITCH;
  const color = COOLER_ITEM_COLORS[(slot + shelf * 2) % COOLER_ITEM_COLORS.length];
  if ((slot + shelf) % 2 !== 0) return coolerCan(itemX, shelfY, color);
  const isWarning = shelf === WARNING_BOTTLE.shelf && slot === WARNING_BOTTLE.slot;
  return coolerBottle(itemX, shelfY, color, isWarning ? C.warn : C.s400);
}

function coolerShelf(shelfOffset, shelf) {
  const shelfY = COOLER_GLASS.y + shelfOffset;
  const items = Array.from({ length: COOLER_ITEMS_PER_SHELF }, (_, slot) => coolerItem(shelf, slot, shelfY));
  const board = `<rect x="${COOLER_GLASS.x + 4}" y="${shelfY}" width="${COOLER_GLASS.width - 8}" height="5" rx="2" fill="${C.s400}"/>`;
  return items.join('') + board;
}

function coolerBaseGrille() {
  const { x, y, height } = COOLER;
  return Array.from(
    { length: COOLER_GRILLE_SLOT_COUNT },
    (_, index) =>
      `<rect x="${x + 30 + index * 18}" y="${y + height - 26}" width="10" height="14" rx="3" fill="${C.b900}" opacity=".55"/>`,
  ).join('');
}

function coolerFinish() {
  const { x, y, width, height } = COOLER;
  const glass = COOLER_GLASS;
  return [
    `<path d="M${glass.x + 18} ${glass.y + glass.height}L${glass.x + 86} ${glass.y}H${glass.x + 112}L${glass.x + 44} ${glass.y + glass.height}Z" fill="#fff" opacity=".09"/>`,
    `<rect x="${x + width - 24}" y="${glass.y + 60}" width="7" height="100" rx="3.5" fill="${C.s200}"/>`,
    coolerBaseGrille(),
    `<rect x="${x + 4}" y="${y + 6}" width="5" height="${height - 12}" rx="2.5" fill="#fff" opacity=".25"/>`,
  ].join('');
}

function displayCooler(p) {
  const { x, y, width, height } = COOLER;
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="14" fill="url(#${p}bd)"/>`,
    coolerHeader(p),
    coolerGlass(p),
    COOLER_SHELF_OFFSETS.map(coolerShelf).join(''),
    coolerFinish(),
  ].join('');
}

const COOLER_AIR_LINES = [
  ['M100 120C70 130 74 160 48 168', C.f300, 4.5],
  ['M98 210C74 222 82 246 58 256', C.f400, 4],
  ['M302 150C328 160 324 188 350 196', C.f300, 4.5],
  ['M300 240C322 252 316 276 340 286', C.f400, 4],
];

function comercial() {
  const p = 'sc';
  const body = [
    bg(6) + shadow(p, 200, 356, 120, 12),
    displayCooler(p),
    airLines(COOLER_AIR_LINES),
    sparkle(76, 76, 8, C.f300) + sparkle(334, 100, 10),
  ].join('');
  return serviceDoc(
    'Refrigeração comercial',
    stdDefs(p) + gradientDefs(p, COMMERCIAL_LINEAR_GRADIENTS, []),
    body,
  );
}

const FREEZER_AIR_LINES = [
  ['M110 150C100 120 130 104 120 76', C.f300, 4.5],
  ['M170 146C162 116 196 100 186 64', C.f400, 5],
  ['M236 146C230 120 260 106 252 80', C.f300, 4.5],
  ['M296 148C296 128 316 118 312 100', C.f400, 4, 0.8],
];

function freezer() {
  const p = 'sf';
  const body = [
    bg(7) + shadow(p, 200, 322, 160, 12),
    g('translate(56 150) scale(.96)', L.freezer(p)),
    airLines(FREEZER_AIR_LINES),
    sparkle(150, 96, 10) + sparkle(224, 58, 13, C.f300) + sparkle(286, 82, 8),
  ].join('');
  return serviceDoc('Conserto de freezer', stdDefs(p), body);
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
