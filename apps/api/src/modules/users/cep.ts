import { AppError } from '../../shared/errors.js';

export interface CepAddress {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
}

const cache = new Map<string, CepAddress>();
const CACHE_LIMIT = 500;

export const cepNotFound = () =>
  new AppError(404, 'cep-not-found', 'CEP não encontrado', 'Confira o CEP digitado.');

/** Looks up a CEP on ViaCEP (free), with an in memory cache. */
export async function lookupCep(fetchFn: typeof globalThis.fetch, cep: string): Promise<CepAddress> {
  const cached = cache.get(cep);
  if (cached) return cached;
  let body: Record<string, string>;
  try {
    const response = await fetchFn(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(3000),
    });
    body = (await response.json()) as Record<string, string>;
  } catch {
    throw new AppError(
      503,
      'cep-unavailable',
      'Consulta de CEP indisponível',
      'Não conseguimos consultar o CEP agora. Preencha o endereço manualmente.',
    );
  }
  if (body.erro) throw cepNotFound();
  const address = {
    cep,
    street: body.logradouro ?? '',
    district: body.bairro ?? '',
    city: String(body.localidade),
    state: String(body.uf),
  };
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(cep, address);
  return address;
}

export function clearCepCache(): void {
  cache.clear();
}
