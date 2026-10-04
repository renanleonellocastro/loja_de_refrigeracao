import { BRAZILIAN_STATES, type ApiSchemas } from '@rc/contracts';

export type ApiAddress = ApiSchemas['Address'];
/** Address as the API accepts it: the UF is one of the 27 states. */
export type AddressInput = Omit<ApiAddress, 'state'> & { state: (typeof BRAZILIAN_STATES)[number] };

/** Address as edited in forms: every field is text, the CEP holds digits only. */
export interface AddressForm {
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
}

export const UF_OPTIONS: readonly string[] = BRAZILIAN_STATES;

export function emptyAddress(): AddressForm {
  return { cep: '', street: '', number: '', complement: '', district: '', city: '', state: '' };
}

export function addressFromApi(address: ApiAddress | null | undefined): AddressForm {
  if (!address) return emptyAddress();
  return { ...address, complement: address.complement ?? '' };
}

/** True when the person left every address field blank, which means "no address". */
export function isAddressBlank(address: AddressForm): boolean {
  return Object.values(address).every((value) => value.trim() === '');
}

/** Body for the API: null when blank, so optional addresses can be skipped or removed. */
export function addressToApi(address: AddressForm): AddressInput | null {
  if (isAddressBlank(address)) return null;
  return {
    ...address,
    state: address.state as AddressInput['state'],
    complement: address.complement.trim() || null,
  };
}

/** Checks a filled address. With `required`, a blank one is an error too. */
export function validateAddress(address: AddressForm, required: boolean, prefix = 'address'): FieldErrors {
  if (!required && isAddressBlank(address)) return {};
  const errors: FieldErrors = {};
  if (!isValidCep(address.cep)) errors[`${prefix}.cep`] = 'Digite os 8 números do CEP, como 13800-061.';
  if (address.street.trim().length < 2) errors[`${prefix}.street`] = 'Informe a rua.';
  if (!address.number.trim()) errors[`${prefix}.number`] = 'Informe o número. Sem número? Escreva S/N.';
  if (address.district.trim().length < 2) errors[`${prefix}.district`] = 'Informe o bairro.';
  if (address.city.trim().length < 2) errors[`${prefix}.city`] = 'Informe a cidade.';
  if (!UF_OPTIONS.includes(address.state)) errors[`${prefix}.state`] = 'Escolha a UF.';
  return errors;
}

/** One line address: "Rua Doutor Ulhoa Cintra, 91, Centro, Mogi Mirim/SP, CEP 13800-061". */
export function formatAddress(address: ApiAddress | null | undefined): string {
  if (!address) return 'Não informado';
  const street = [address.street, address.number, address.complement].filter(Boolean).join(', ');
  return `${street}, ${address.district}, ${address.city}/${address.state}, CEP ${formatCep(address.cep)}`;
}
