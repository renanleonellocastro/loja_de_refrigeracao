import { AppError } from '../../shared/errors.js';

export interface CepAddress {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
}

/** Where looked up addresses are remembered between requests (port). */
export interface CepCache {
  find(cep: string): CepAddress | undefined;
  remember(cep: string, address: CepAddress): void;
}

/** What a CEP lookup needs from the outside: outbound HTTP and the cache. */
export interface CepLookupDependencies {
  fetch: typeof globalThis.fetch;
  cache: CepCache;
}

type ViaCepBody = Record<string, string>;

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

async function fetchCepAddress(fetchFn: typeof globalThis.fetch, cep: string): Promise<CepAddress> {
  const body = await fetchViaCep(fetchFn, cep);
  if (body.erro) throw cepNotFound();
  return toCepAddress(cep, body);
}

/** Looks up a CEP on ViaCEP (free), answering from the cache when it already knows the CEP. */
export async function lookupCep({ fetch, cache }: CepLookupDependencies, cep: string): Promise<CepAddress> {
  const cached = cache.find(cep);
  if (cached) return cached;
  const address = await fetchCepAddress(fetch, cep);
  cache.remember(cep, address);
  return address;
}
