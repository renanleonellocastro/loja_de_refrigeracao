import { digits } from '@rc/contracts';
import type { AddressSnapshot } from '../../infra/db/schema.js';
import type { StoreFooter } from './templates.js';

/** Store settings the footer is built from, as configured in "Configurar a Loja". */
export interface StoreContact {
  name: string;
  phone: string;
  whatsapp: string | null;
  address: AddressSnapshot;
}

/** Shown only for a footer field the store settings leave empty; WhatsApp is optional, so it has none. */
export const FALLBACK_FOOTER: Omit<StoreFooter, 'appOrigin'> = {
  name: 'Refrigeração Castro',
  phone: '(19) 3804-1658',
  whatsapp: '',
  address: 'Rua Doutor Ulhôa Cintra, 91, Centro, Mogi Mirim/SP',
};

const LANDLINE_DIGITS = 10;
const MOBILE_DIGITS = 11;

/** `(19) 3804-1658` or `(19) 99876-5432`; anything else is kept as typed. */
export function formatPhone(value: string): string {
  const phone = digits(value);
  if (phone.length !== LANDLINE_DIGITS && phone.length !== MOBILE_DIGITS) return value.trim();
  const splitAt = phone.length - 4;
  return `(${phone.slice(0, 2)}) ${phone.slice(2, splitAt)}-${phone.slice(splitAt)}`;
}

/** `Street, number, complement, district, city/state`, skipping blank parts; empty without a street. */
export function formatAddress(address: AddressSnapshot): string {
  if (!address.street.trim()) return '';
  const cityState = [address.city, address.state]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/');
  return [address.street, address.number, address.complement ?? '', address.district, cityState]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
}

const orFallback = (value: string, fallback: string) => value.trim() || fallback;

export function storeFooter(contact: StoreContact, appOrigin: string): StoreFooter {
  return {
    appOrigin,
    name: orFallback(contact.name, FALLBACK_FOOTER.name),
    phone: orFallback(formatPhone(contact.phone), FALLBACK_FOOTER.phone),
    whatsapp: formatPhone(contact.whatsapp ?? ''),
    address: orFallback(formatAddress(contact.address), FALLBACK_FOOTER.address),
  };
}
