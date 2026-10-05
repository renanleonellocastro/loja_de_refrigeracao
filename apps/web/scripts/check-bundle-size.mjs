// JavaScript budget of the public pages (RNF-09): the scripts a server rendered page loads up front (the
// entry module and its modulepreload links) must stay under the limit, brotli compressed, as served from
// the precompressed copies of the build. Usage, with the production server running:
//   node scripts/check-bundle-size.mjs http://localhost:3000 / /produtos /servicos
import { readFileSync, existsSync } from 'node:fs';
import { brotliCompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const BUDGET_KB = Number(process.env.JS_BUDGET_KB ?? 150);
const [origin = 'http://localhost:3000', ...paths] = process.argv.slice(2);
const publicDir = fileURLToPath(new URL('../.output/public', import.meta.url));

function compressedSize(asset) {
  const file = `${publicDir}${asset}`;
  if (existsSync(`${file}.br`)) return readFileSync(`${file}.br`).length;
  return brotliCompressSync(readFileSync(file)).length;
}

let failed = false;
for (const path of paths.length > 0 ? paths : ['/']) {
  const response = await fetch(new URL(path, origin), { headers: { accept: 'text/html' } });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const html = await response.text();
  const scripts = new Set(
    [
      ...html.matchAll(
        /<(?:script[^>]*type="module"|link[^>]*rel="modulepreload")[^>]*(?:src|href)="([^"]+\.js)"/g,
      ),
    ].map((match) => match[1]),
  );
  const bytes = [...scripts].reduce((total, asset) => total + compressedSize(asset), 0);
  const kb = bytes / 1024;
  const ok = kb <= BUDGET_KB;
  failed ||= !ok;
  process.stdout.write(
    `${ok ? 'ok  ' : 'FAIL'} ${path}: ${scripts.size} scripts, ${kb.toFixed(1)} KB brotli (budget ${BUDGET_KB} KB)\n`,
  );
}
process.exit(failed ? 1 : 0);
