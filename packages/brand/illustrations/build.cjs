// Builds every SVG and renders PNG previews. Usage: node build.cjs [filter]
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const PUBLIC = path.join(__dirname, '../../../apps/web/public');
const OUT = path.join(PUBLIC, 'illustrations');
const PREV = process.env.PREVIEW_DIR;
const mods = ['./services.cjs', './facade.cjs', './states.cjs', './misc.cjs'];
const all = Object.assign({}, ...mods.map((m) => require(m)));
const filter = process.argv[2];

for (const [name, fn] of Object.entries(all)) {
  if (filter && !name.includes(filter)) continue;
  const svg = fn();
  fs.writeFileSync(name === 'og-image.svg' ? path.join(PUBLIC, name) : path.join(OUT, name), svg);
  if (!PREV) continue;
  const vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const w = Number(vb[1]);
  const png = new Resvg(svg, {
    background: '#FFFFFF',
    fitTo: { mode: 'width', value: Math.min(w * 2, 1600) },
  })
    .render()
    .asPng();
  fs.writeFileSync(path.join(PREV, name.replace('.svg', '.png')), png);
  console.warn(name, (svg.length / 1024).toFixed(1) + ' KB');
}
