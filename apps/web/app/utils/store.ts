import type { ApiSchemas } from '@rc/contracts';
import { formatCep, formatPhone } from './masks';

export type StorePublic = ApiSchemas['Store'];
export type OpeningHours = StorePublic['openingHours'];

/**
 * Public store data from docs/LOJA.md, for the copy that does not depend on the store settings (legal pages,
 * sign in). Contact data, address and hours on the public site come from GET /api/v1/store (useStoreInfo).
 */
export const STORE_INFO = {
  name: 'Refrigeração Castro',
  legalName: 'Refrigeração Castro Ltda ME',
  cnpj: '63.060.560/0001-51',
  street: 'Rua Doutor Ulhoa Cintra, 91',
  district: 'Centro',
  city: 'Mogi Mirim/SP',
  cep: '13800-061',
  phone: '(19) 3804-1658',
  phoneHref: 'tel:+551938041658',
  email: 'refrigeracaocastro@yahoo.com.br',
  hours: 'Segunda a sexta, das 9h às 18h',
} as const;

const WEEKDAY = { opens: '09:00', closes: '18:00' };

/** What the site shows when the API cannot answer: the same data the store settings start with. */
export const FALLBACK_STORE: StorePublic = {
  name: STORE_INFO.name,
  legalName: STORE_INFO.legalName,
  cnpj: '63060560000151',
  phone: '1938041658',
  whatsapp: null,
  email: STORE_INFO.email,
  address: {
    cep: '13800061',
    street: 'Rua Doutor Ulhoa Cintra',
    number: '91',
    complement: null,
    district: 'Centro',
    city: 'Mogi Mirim',
    state: 'SP',
  },
  openingHours: { 0: null, 1: WEEKDAY, 2: WEEKDAY, 3: WEEKDAY, 4: WEEKDAY, 5: WEEKDAY, 6: null },
  openNow: false,
};

export const PUBLIC_NAV: ReadonlyArray<{ label: string; to: string }> = [
  { label: 'Início', to: '/' },
  { label: 'Produtos', to: '/produtos' },
  { label: 'Serviços', to: '/servicos' },
  { label: 'Sobre', to: '/sobre' },
  { label: 'Contato', to: '/contato' },
];

export function phoneLabel(digits: string): string {
  return formatPhone(digits);
}

export function phoneHref(digits: string): string {
  return `tel:+55${digits}`;
}

export function whatsappHref(digits: string, message = 'Olá! Vim pelo site da Refrigeração Castro.'): string {
  return `https://wa.me/55${digits}?text=${encodeURIComponent(message)}`;
}

/** "Rua Doutor Ulhoa Cintra, 91" plus the complement when there is one. */
export function streetLine(address: StorePublic['address']): string {
  const base = `${address.street}, ${address.number}`;
  return address.complement ? `${base}, ${address.complement}` : base;
}

/** "Centro, Mogi Mirim/SP, CEP 13800-061". */
export function cityLine(address: StorePublic['address']): string {
  return `${address.district}, ${address.city}/${address.state}, CEP ${formatCep(address.cep)}`;
}

function mapsQuery(address: StorePublic['address']): string {
  return encodeURIComponent(`${streetLine(address)}, ${address.city}, ${address.state}, ${address.cep}`);
}

/** Opens the address in the maps app of the phone or in Google Maps. */
export function mapsSearchUrl(address: StorePublic['address']): string {
  return `https://www.google.com/maps/search/?api=1&query=${mapsQuery(address)}`;
}

/** Embeddable map, loaded only when the person asks for it. */
export function mapsEmbedUrl(address: StorePublic['address']): string {
  return `https://www.google.com/maps?q=${mapsQuery(address)}&output=embed`;
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
/** The week as people read it in Brazil, Monday first. */
const WEEK_ORDER = ['1', '2', '3', '4', '5', '6', '0'] as const;

/** "09:00" becomes "9h" and "09:30" becomes "9h30". */
function hourLabel(hhmm: string): string {
  const [hours, minutes] = hhmm.split(':');
  return `${Number(hours)}h${minutes === '00' ? '' : minutes}`;
}

/** Weekly hours grouped by equal consecutive days: "Segunda a sexta: das 9h às 18h", "Sábado e domingo: fechado". */
export function openingHoursLines(hours: OpeningHours): Array<{ days: string; hours: string }> {
  const groups: Array<{ first: string; last: string; key: string; count: number }> = [];
  for (const day of WEEK_ORDER) {
    const slot = hours[day] ?? null;
    const key = slot ? `das ${hourLabel(slot.opens)} às ${hourLabel(slot.closes)}` : 'fechado';
    const current = groups.at(-1);
    if (current?.key === key) {
      current.last = day;
      current.count += 1;
    } else {
      groups.push({ first: day, last: day, key, count: 1 });
    }
  }
  return groups.map(({ first, last, key, count }) => {
    const from = DAY_NAMES[Number(first)]!;
    const to = DAY_NAMES[Number(last)]!.toLowerCase();
    const days = count === 1 ? from : count === 2 ? `${from} e ${to}` : `${from} a ${to}`;
    return { days, hours: key };
  });
}

/** One line summary for footers: "Segunda a sexta, das 9h às 18h" (closed days are left out). */
export function openingHoursSummary(hours: OpeningHours): string {
  return openingHoursLines(hours)
    .filter((line) => line.hours !== 'fechado')
    .map((line) => `${line.days}, ${line.hours}`)
    .join('; ');
}
