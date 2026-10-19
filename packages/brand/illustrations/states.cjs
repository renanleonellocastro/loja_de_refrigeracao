// Empty and error states, 480 x 360, lighter line based style.
const L = require('./lib.cjs');
const { C, doc, blob, g, air, snowflake } = L;

const SW = 6; // main stroke width
const ln = (d, c = C.b400, w = SW, extra = '') =>
  `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
const base = (seed) =>
  blob(240, 186, 176, 138, seed, C.b50) + `<ellipse cx="240" cy="306" rx="130" ry="10" fill="${C.b100}"/>`;
const flake = (x, y, r, c = C.f300) => g(`translate(${x} ${y})`, snowflake(r, c, 2.2));
const dot = (x, y, r, c = C.b100) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;

const STATE_WIDTH = 480;
const STATE_HEIGHT = 360;
const stateDoc = (title, backgroundSeed, parts) =>
  doc(STATE_WIDTH, STATE_HEIGHT, title, '', base(backgroundSeed) + parts.join(''));

function cartBasket() {
  return [
    `<path d="M168 128H352L326 218H190Z" fill="#fff"/>`,
    ln('M200 160H340M210 190H332', C.b100, 4),
    ln('M228 132L238 216M268 132L270 216M308 132L300 216', C.b100, 4),
  ].join('');
}

function cartFrame() {
  return [
    ln('M112 98H146L188 234H330'),
    ln('M156 128H352L326 218H186'),
    `<circle cx="204" cy="268" r="17" fill="#fff" stroke="${C.b700}" stroke-width="${SW}"/><circle cx="312" cy="268" r="17" fill="#fff" stroke="${C.b700}" stroke-width="${SW}"/>`,
    ln('M188 234L196 252M330 234L322 252', C.b400),
  ].join('');
}

function cartColdAir() {
  return [
    air('M250 100C246 82 262 74 258 56', C.f300, 4) + air('M282 104C280 90 292 84 290 70', C.f400, 3.5, 0.8),
    flake(370, 90, 10) + flake(118, 190, 7, C.f400) + dot(390, 220, 6) + dot(98, 140, 5),
  ].join('');
}

function carrinho() {
  return stateDoc('Carrinho vazio', 11, [cartBasket(), cartFrame(), cartColdAir()]);
}

const CALENDAR_ROWS = 4;
const CALENDAR_COLUMNS = 5;
const CALENDAR_CELL_PITCH = 30;
const BOOKED_CELL = { row: 1, column: 2 };

function calendarCell(row, column) {
  const x = 168 + column * CALENDAR_CELL_PITCH;
  const y = 146 + row * CALENDAR_CELL_PITCH;
  const isBooked = row === BOOKED_CELL.row && column === BOOKED_CELL.column;
  return `<rect x="${x}" y="${y}" width="20" height="20" rx="6" fill="${isBooked ? C.f300 : C.b100}"/>`;
}

function calendarCells() {
  const rows = Array.from({ length: CALENDAR_ROWS }, (_, row) =>
    Array.from({ length: CALENDAR_COLUMNS }, (__, column) => calendarCell(row, column)).join(''),
  );
  return rows.join('');
}

function calendarBoard() {
  return [
    `<rect x="146" y="82" width="188" height="196" rx="20" fill="#fff" stroke="${C.b400}" stroke-width="${SW}"/>`,
    `<path d="M149 102Q149 85 166 85H314Q331 85 331 102V128H149Z" fill="${C.b500}"/>`,
    `<rect x="186" y="66" width="12" height="36" rx="6" fill="${C.s400}"/><rect x="282" y="66" width="12" height="36" rx="6" fill="${C.s400}"/>`,
    calendarCells(),
  ].join('');
}

function agenda() {
  return stateDoc('Nenhum agendamento', 12, [
    calendarBoard(),
    g('translate(330 250) rotate(-40) scale(.82)', L.wrench(C.s400, C.s200, C.s600)),
    flake(110, 110, 9) + flake(380, 96, 7, C.f400) + dot(104, 230, 6) + dot(392, 300, 5),
  ]);
}

function boxInteriorAndFlaps() {
  return [
    `<path d="M176 150L200 112H280L304 150Z" fill="${C.b200}"/>`,
    `<path d="M168 150H312V170H168Z" fill="${C.b300}"/>`,
    `<path d="M168 150L126 196L154 214L176 170Z" fill="${C.b100}" stroke="${C.b400}" stroke-width="${SW}" stroke-linejoin="round"/>`,
    `<path d="M312 150L354 196L326 214L304 170Z" fill="${C.b100}" stroke="${C.b400}" stroke-width="${SW}" stroke-linejoin="round"/>`,
  ].join('');
}

function boxFront() {
  return [
    `<path d="M168 156H312V284Q312 292 304 292H176Q168 292 168 284Z" fill="#fff" stroke="${C.b400}" stroke-width="${SW}" stroke-linejoin="round"/>`,
    `<rect x="222" y="156" width="36" height="46" fill="${C.b100}"/>`,
    `<rect x="188" y="246" width="40" height="8" rx="4" fill="${C.b100}"/><rect x="188" y="262" width="26" height="8" rx="4" fill="${C.b100}"/>`,
    ln('M176 150H304', C.b400),
  ].join('');
}

function boxColdAir() {
  return [
    air('M222 96C214 76 236 68 228 46', C.f300, 4) + air('M256 98C252 82 268 74 262 58', C.f400, 3.5, 0.8),
    flake(372, 98, 9) + flake(104, 120, 7, C.f400) + dot(390, 250, 6) + dot(92, 262, 5),
  ].join('');
}

function pedidos() {
  return stateDoc('Nenhum pedido', 13, [boxInteriorAndFlaps(), boxFront(), boxColdAir()]);
}

// Simple outlined fridge, 110 x 210.
const fridgeLineCabinet = (fill) =>
  `<rect x="0" y="0" width="110" height="210" rx="14" fill="${fill}" stroke="${C.b400}" stroke-width="${SW}"/>`;

function closedFridgeLine() {
  return [
    fridgeLineCabinet('#fff'),
    ln('M0 72H110'),
    ln('M90 30V52M90 92V132', C.b400, SW),
    `<rect x="20" y="92" width="30" height="40" rx="6" fill="${C.b100}"/>`,
  ].join('');
}

function openFridgeLine() {
  return [
    fridgeLineCabinet(C.b100),
    `<rect x="10" y="10" width="90" height="190" rx="8" fill="${C.f200}" opacity=".6"/>`,
    ln('M12 72H98M12 130H98', '#fff', 5),
  ].join('');
}

function busca() {
  return stateDoc('Nenhum resultado encontrado', 14, [
    g('translate(178 76)', closedFridgeLine()),
    `<circle cx="276" cy="168" r="54" fill="${C.f200}" opacity=".45"/>`,
    `<circle cx="276" cy="168" r="54" fill="none" stroke="${C.b700}" stroke-width="12"/>`,
    ln('M246 140A38 38 0 0 1 280 128', '#fff', 6),
    ln('M315 207L352 244', C.b700, 18),
    ln('M318 210L330 222', C.b500, 8),
    flake(122, 110, 9) + flake(380, 100, 7, C.f400) + dot(110, 230, 6) + dot(392, 300, 5),
  ]);
}

const QUESTION_MARK_PATH = 'M120 128C118 96 150 82 176 88C204 94 214 124 196 144C182 158 166 160 166 184V196';

function openFridgeWithDoor() {
  return [
    g('translate(250 84)', openFridgeLine()),
    `<path d="M360 84L404 70V306L360 294Z" fill="#fff" stroke="${C.b400}" stroke-width="${SW}" stroke-linejoin="round"/>`,
    ln('M372 130L394 124M372 210L394 208', C.b200, 5),
  ].join('');
}

// A question mark drawn with the cold air leaving the open fridge.
function coldAirQuestionMark() {
  return [
    air(QUESTION_MARK_PATH, C.f400, 9),
    air('M134 120C136 104 154 96 172 100', '#fff', 3, 0.9),
    air('M108 140C104 112 120 86 148 78', C.f300, 4, 0.8),
    air('M206 156C224 138 240 150 252 140', C.f300, 4, 0.9),
    air('M184 196C204 190 226 204 250 196', C.f200, 4),
    `<circle cx="166" cy="226" r="9" fill="${C.f400}"/>`,
  ].join('');
}

function erro404() {
  return stateDoc('Página não encontrada', 15, [
    openFridgeWithDoor(),
    coldAirQuestionMark(),
    flake(90, 230, 8) + flake(222, 80, 7, C.f400) + dot(420, 262, 5),
  ]);
}

const SIGNAL_CENTER = { x: 356, y: 268 };
function signalArcPoint(radius, degrees) {
  const radians = (degrees * Math.PI) / 180;
  return [
    (SIGNAL_CENTER.x + radius * Math.cos(radians)).toFixed(1),
    (SIGNAL_CENTER.y + radius * Math.sin(radians)).toFixed(1),
  ];
}

function signalArc(radius, startDegrees, endDegrees, color) {
  const [startX, startY] = signalArcPoint(radius, startDegrees);
  const [endX, endY] = signalArcPoint(radius, endDegrees);
  return ln(`M${startX} ${startY}A${radius} ${radius} 0 0 1 ${endX} ${endY}`, color, 7);
}

function brokenSignal() {
  return [
    `<circle cx="${SIGNAL_CENTER.x}" cy="${SIGNAL_CENTER.y}" r="8" fill="${C.b700}"/>`,
    signalArc(28, -135, -45, C.b500),
    signalArc(52, -135, -104, C.b300) + signalArc(52, -80, -45, C.b300),
    signalArc(76, -135, -116, C.b200) + signalArc(76, -96, -72, C.b200),
    ln('M398 184L326 290', C.s500, 6),
    `<circle cx="408" cy="168" r="5" fill="${C.warn}"/>`,
  ].join('');
}

function frozenCloud() {
  return [
    `<path transform="translate(-24 -6)" d="M150 214C118 214 108 168 140 158C138 118 190 104 210 132C226 92 300 98 304 150C340 150 348 214 306 214Z" fill="#fff" stroke="${C.b400}" stroke-width="${SW}" stroke-linejoin="round"/>`,
    g('translate(202 166)', snowflake(26, C.f400, 5)),
  ].join('');
}

function offline() {
  return stateDoc('Sem conexão', 16, [
    frozenCloud(),
    brokenSignal(),
    air('M118 254C140 246 150 262 172 254', C.f300, 4) +
      air('M96 120C110 110 124 120 134 112', C.f300, 3.5, 0.8),
    flake(380, 96, 8, C.f300) + dot(110, 290, 5),
  ]);
}

module.exports = {
  'vazio-carrinho.svg': carrinho,
  'vazio-agenda.svg': agenda,
  'vazio-pedidos.svg': pedidos,
  'vazio-busca.svg': busca,
  'erro-404.svg': erro404,
  'erro-offline.svg': offline,
};
