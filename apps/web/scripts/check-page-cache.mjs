// Checks the production server cache against a running build (CI lighthouse job): public pages come from
// the cache with a fresh CSP nonce per response, compressed and without validators; private pages are never
// stored. Usage: node scripts/check-page-cache.mjs http://localhost:3000
const base = process.argv[2] ?? 'http://localhost:3000';
const PUBLIC_PAGES = ['/', '/produtos', '/servicos'];
const PRIVATE_PAGES = ['/perfil', '/carrinho', '/minha-conta/pedidos', '/produtos/gerenciar', '/painel'];
const failures = [];

const fetchPage = (path) => fetch(new URL(path, base), { headers: { 'accept-encoding': 'br, gzip' } });
const policyNonce = (response) =>
  /'nonce-([^']+)'/.exec(response.headers.get('content-security-policy') ?? '')?.[1];
const check = (ok, message) => ok || failures.push(message);

async function checkNonce(path) {
  const [first, second] = [await fetchPage(path), await fetchPage(path)];
  const html = await second.text();
  check(policyNonce(first) !== policyNonce(second), `${path}: two responses share the CSP nonce`);
  check(
    html.includes(`nonce="${policyNonce(second)}"`),
    `${path}: script nonce does not match the CSP header`,
  );
}

async function checkPublic(path) {
  await checkNonce(path);
  const response = await fetchPage(path);
  check(response.headers.get('content-encoding') !== null, `${path}: cached page not compressed`);
  check(!response.headers.get('etag'), `${path}: page has an etag`);
  check(response.headers.get('cache-control') === 'private, no-cache', `${path}: unexpected cache-control`);
}

async function checkPrivate(path) {
  const response = await fetchPage(path);
  check(response.headers.get('cache-control') === 'no-store', `${path}: private page without no-store`);
  check(!response.headers.get('etag'), `${path}: private page has an etag`);
}

for (const path of PUBLIC_PAGES) await checkPublic(path);
for (const path of PRIVATE_PAGES) await checkPrivate(path);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
process.stdout.write(
  `Page cache ok: ${PUBLIC_PAGES.length} public and ${PRIVATE_PAGES.length} private pages.\n`,
);
