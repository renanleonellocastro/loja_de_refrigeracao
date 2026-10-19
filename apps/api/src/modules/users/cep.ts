import { AppError } from '../../shared/errors.js';

export interface CepAddress {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
}

type ViaCepBody = Record<string, string>;

const cache = new Map<string, CepAddress>();
const CACHE_LIMIT = 500;
const VIACEP_TIMEOUT_MS = 3000;

export const cepNotFound = () =>
  new AppError(404, 'cep-not-found', 'CEP não encontrado', 'Confira o CEP digitado.');

const cepUnavailable = () =>
  new AppError(
    503,
    'cep-unavailable',
    'Consulta de CEP indisponível',
    'Não conseguimos consultar o CEP agora. Preencha o endereço manualmente.',
  );

function viaCepUrl(cep: string): string {
  return `https://viacep.com.br/ws/${cep}/json/`;
}

async function fetchViaCep(fetchFn: typeof globalThis.fetch, cep: string): Promise<ViaCepBody> {
  try {
    const response = await fetchFn(viaCepUrl(cep), { signal: AbortSignal.timeout(VIACEP_TIMEOUT_MS) });
    return (await response.json()) as ViaCepBody;
  } catch {
    throw cepUnavailable();
  }
}

function toCepAddress(cep: string, body: ViaCepBody): CepAddress {
  return {
    cep,
    street: body.logradouro ?? '',
    district: body.bairro ?? '',
    city: String(body.localidade),
    state: String(body.uf),
  };
}

/** Keeps the cache bounded by dropping the oldest entry (Map keeps insertion order). */
function remember(cep: string, address: CepAddress): void {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(cep, address);
}

/** Looks up a CEP on ViaCEP (free), with an in memory cache. */
export async function lookupCep(fetchFn: typeof globalThis.fetch, cep: string): Promise<CepAddress> {
  const cached = cache.get(cep);
  if (cached) return cached;
  const body = await fetchViaCep(fetchFn, cep);
  if (body.erro) throw cepNotFound();
  const address = toCepAddress(cep, body);
  remember(cep, address);
  return address;
}

export function clearCepCache(): void {
  cache.clear();
}
