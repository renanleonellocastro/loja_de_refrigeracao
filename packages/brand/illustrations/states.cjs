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

function carrinho() {
  const o = [];
  o.push(`<path d="M168 128H352L326 218H190Z" fill="#fff"/>`);
  o.push(ln('M200 160H340M210 190H332', C.b100, 4));
  o.push(ln('M228 132L238 216M268 132L270 216M308 132L300 216', C.b100, 4));
  o.push(ln('M112 98H146L188 234H330'));
  o.push(ln('M156 128H352L326 218H186'));
  o.push(
    `<circle cx="204" cy="268" r="17" fill="#fff" stroke="${C.b700}" stroke-width="${SW}"/><circle cx="312" cy="268" r="17" fill="#fff" stroke="${C.b700}" stroke-width="${SW}"/>`,
  );
  o.push(ln('M188 234L196 252M330 234L322 252', C.b400));
  o.push(
    air('M250 100C246 82 262 74 258 56', C.f300, 4) + air('M282 104C280 90 292 84 290 70', C.f400, 3.5, 0.8),
  );
  o.push(flake(370, 90, 10) + flake(118, 190, 7, C.f400) + dot(390, 220, 6) + dot(98, 140, 5));
  return doc(480, 360, 'Carrinho vazio', '', base(11) + o.join(''));
}

function agenda() {
  const o = [];
  o.push(
    `<rect x="146" y="82" width="188" height="196" rx="20" fill="#fff" stroke="${C.b400}" stroke-width="${SW}"/>`,
  );
  o.push(`<path d="M149 102Q149 85 166 85H314Q331 85 331 102V128H149Z" fill="${C.b500}"/>`);
  o.push(
    `<rect x="186" y="66" width="12" height="36" rx="6" fill="${C.s400}"/><rect x="282" y="66" width="12" height="36" rx="6" fill="${C.s400}"/>`,
  );
  let cells = '';
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 5; c++) {
      const x = 168 + c * 30,
        y = 146 + r * 30;
      const hi = r === 1 && c === 2;
      cells += `<rect x="${x}" y="${y}" width="20" height="20" rx="6" fill="${hi ? C.f300 : C.b100}"/>`;
    }
  o.push(cells);
  o.push(g('translate(330 250) rotate(-40) scale(.82)', L.wrench(C.s400, C.s200, C.s600)));
  o.push(flake(110, 110, 9) + flake(380, 96, 7, C.f400) + dot(104, 230, 6) + dot(392, 300, 5));
  return doc(480, 360, 'Nenhum agendamento', '', base(12) + o.join(''));
}

function pedidos() {
  const o = [];
  // back flaps and interior
  o.push(`<path d="M176 150L200 112H280L304 150Z" fill="${C.b200}"/>`);
  o.push(`<path d="M168 150H312V170H168Z" fill="${C.b300}"/>`);
  // side flaps opening outward
  o.push(
    `<path d="M168 150L126 196L154 214L176 170Z" fill="${C.b100}" stroke="${C.b400}" stroke-width="${SW}" stroke-linejoin="round"/>`,
  );
  o.push(
    `<path d="M312 150L354 196L326 214L304 170Z" fill="${C.b100}" stroke="${C.b400}" stroke-width="${SW}" stroke-linejoin="round"/>`,
  );
  // front face
  o.push(
    `<path d="M168 156H312V284Q312 292 304 292H176Q168 292 168 284Z" fill="#fff" stroke="${C.b400}" stroke-width="${SW}" stroke-linejoin="round"/>`,
  );
  o.push(`<rect x="222" y="156" width="36" height="46" fill="${C.b100}"/>`);
  o.push(
    `<rect x="188" y="246" width="40" height="8" rx="4" fill="${C.b100}"/><rect x="188" y="262" width="26" height="8" rx="4" fill="${C.b100}"/>`,
  );
  o.push(ln('M176 150H304', C.b400));
  o.push(
    air('M222 96C214 76 236 68 228 46', C.f300, 4) + air('M256 98C252 82 268 74 262 58', C.f400, 3.5, 0.8),
  );
  o.push(flake(372, 98, 9) + flake(104, 120, 7, C.f400) + dot(390, 250, 6) + dot(92, 262, 5));
  return doc(480, 360, 'Nenhum pedido', '', base(13) + o.join(''));
}

// Simple outlined fridge, 110 x 210.
function fridgeLine(open = false) {
  const s = [];
  s.push(
    `<rect x="0" y="0" width="110" height="210" rx="14" fill="${open ? C.b100 : '#fff'}" stroke="${C.b400}" stroke-width="${SW}"/>`,
  );
  if (!open) {
    s.push(ln('M0 72H110'));
    s.push(ln('M90 30V52M90 92V132', C.b400, SW));
    s.push(`<rect x="20" y="92" width="30" height="40" rx="6" fill="${C.b100}"/>`);
  } else {
    s.push(`<rect x="10" y="10" width="90" height="190" rx="8" fill="${C.f200}" opacity=".6"/>`);
    s.push(ln('M12 72H98M12 130H98', '#fff', 5));
  }
  return s.join('');
}

function busca() {
  const o = [];
  o.push(g('translate(178 76)', fridgeLine()));
  o.push(`<circle cx="276" cy="168" r="54" fill="${C.f200}" opacity=".45"/>`);
  o.push(`<circle cx="276" cy="168" r="54" fill="none" stroke="${C.b700}" stroke-width="12"/>`);
  o.push(ln('M246 140A38 38 0 0 1 280 128', '#fff', 6));
  o.push(ln('M315 207L352 244', C.b700, 18));
  o.push(ln('M318 210L330 222', C.b500, 8));
  o.push(flake(122, 110, 9) + flake(380, 100, 7, C.f400) + dot(110, 230, 6) + dot(392, 300, 5));
  return doc(480, 360, 'Nenhum resultado encontrado', '', base(14) + o.join(''));
}

function erro404() {
  const o = [];
  o.push(g('translate(250 84)', fridgeLine(true)));
  // open door
  o.push(
    `<path d="M360 84L404 70V306L360 294Z" fill="#fff" stroke="${C.b400}" stroke-width="${SW}" stroke-linejoin="round"/>`,
  );
  o.push(ln('M372 130L394 124M372 210L394 208', C.b200, 5));
  // question mark of cold air
  const q = 'M120 128C118 96 150 82 176 88C204 94 214 124 196 144C182 158 166 160 166 184V196';
  o.push(air(q, C.f400, 9));
  o.push(air('M134 120C136 104 154 96 172 100', '#fff', 3, 0.9));
  o.push(air('M108 140C104 112 120 86 148 78', C.f300, 4, 0.8));
  o.push(air('M206 156C224 138 240 150 252 140', C.f300, 4, 0.9));
  o.push(air('M184 196C204 190 226 204 250 196', C.f200, 4));
  o.push(`<circle cx="166" cy="226" r="9" fill="${C.f400}"/>`);
  o.push(flake(90, 230, 8) + flake(222, 80, 7, C.f400) + dot(420, 262, 5));
  return doc(480, 360, 'Página não encontrada', '', base(15) + o.join(''));
}

function offline() {
  const o = [];
  o.push(
    `<path transform="translate(-24 -6)" d="M150 214C118 214 108 168 140 158C138 118 190 104 210 132C226 92 300 98 304 150C340 150 348 214 306 214Z" fill="#fff" stroke="${C.b400}" stroke-width="${SW}" stroke-linejoin="round"/>`,
  );
  o.push(g('translate(202 166)', snowflake(26, C.f400, 5)));
  // broken signal
  o.push(`<circle cx="356" cy="268" r="8" fill="${C.b700}"/>`);
  const arc = (r, a0, a1, c) => {
    const P = (a) => [
      (356 + r * Math.cos((a * Math.PI) / 180)).toFixed(1),
      (268 + r * Math.sin((a * Math.PI) / 180)).toFixed(1),
    ];
    const [x0, y0] = P(a0),
      [x1, y1] = P(a1);
    return ln(`M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}`, c, 7);
  };
  o.push(arc(28, -135, -45, C.b500));
  o.push(arc(52, -135, -104, C.b300) + arc(52, -80, -45, C.b300));
  o.push(arc(76, -135, -116, C.b200) + arc(76, -96, -72, C.b200));
  o.push(ln('M398 184L326 290', C.s500, 6));
  o.push(`<circle cx="408" cy="168" r="5" fill="${C.warn}"/>`);
  o.push(
    air('M118 254C140 246 150 262 172 254', C.f300, 4) +
      air('M96 120C110 110 124 120 134 112', C.f300, 3.5, 0.8),
  );
  o.push(flake(380, 96, 8, C.f300) + dot(110, 290, 5));
  return doc(480, 360, 'Sem conexão', '', base(16) + o.join(''));
}

module.exports = {
  'vazio-carrinho.svg': carrinho,
  'vazio-agenda.svg': agenda,
  'vazio-pedidos.svg': pedidos,
  'vazio-busca.svg': busca,
  'erro-404.svg': erro404,
  'erro-offline.svg': offline,
};
