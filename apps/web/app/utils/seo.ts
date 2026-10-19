import { formatPhone } from './masks';
import { streetLine, type StorePublic } from './store';

const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Days of the week that share one time slot, in schema.org day names. */
interface SchemaSlot {
  opens: string;
  closes: string;
  days: string[];
}

function groupSlotsByTime(hours: StorePublic['openingHours']): SchemaSlot[] {
  const slots = new Map<string, SchemaSlot>();
  for (const [day, slot] of Object.entries(hours)) {
    if (!slot) continue;
    const key = `${slot.opens}-${slot.closes}`;
    const entry = slots.get(key) ?? { ...slot, days: [] };
    slots.set(key, { ...entry, days: [...entry.days, SCHEMA_DAYS[Number(day)]!] });
  }
  return [...slots.values()];
}

/** Opening hours as schema.org specifications, one per distinct time slot. */
function openingHoursSpecification(hours: StorePublic['openingHours']) {
  return groupSlotsByTime(hours).map((slot) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: slot.days,
    opens: slot.opens,
    closes: slot.closes,
  }));
}

function storeIdentityJsonLd(store: StorePublic, origin: string) {
  return {
    '@id': `${origin}/#loja`,
    name: store.name,
    legalName: store.legalName,
    url: origin,
    image: `${origin}/brand/fachada-foto.jpg`,
    logo: `${origin}/icon-512.png`,
    telephone: `+55 ${formatPhone(store.phone)}`,
    email: store.email,
    priceRange: '$$',
  };
}

function postalAddressJsonLd(address: StorePublic['address']) {
  return {
    '@type': 'PostalAddress',
    streetAddress: streetLine(address),
    addressLocality: address.city,
    addressRegion: address.state,
    postalCode: address.cep,
    addressCountry: 'BR',
  };
}

/** Structured data of the store for search engines (schema.org HVACBusiness, a LocalBusiness). */
export function localBusinessJsonLd(store: StorePublic, origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HVACBusiness',
    ...storeIdentityJsonLd(store, origin),
    address: postalAddressJsonLd(store.address),
    areaServed: { '@type': 'City', name: store.address.city },
    openingHoursSpecification: openingHoursSpecification(store.openingHours),
  };
}

/** Adds the store structured data to the page head. */
export function useLocalBusinessJsonLd(store: ComputedRef<StorePublic>): void {
  const origin = useRequestURL().origin;
  useHead({
    script: [
      {
        key: 'jsonld-store',
        type: 'application/ld+json',
        innerHTML: computed(() => JSON.stringify(localBusinessJsonLd(store.value, origin))),
      },
    ],
  });
}
