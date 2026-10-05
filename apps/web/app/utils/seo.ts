import { formatPhone } from './masks';
import { streetLine, type StorePublic } from './store';

const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Opening hours as schema.org specifications, one per distinct time slot. */
function openingHoursSpecification(hours: StorePublic['openingHours']) {
  const slots = new Map<string, { opens: string; closes: string; days: string[] }>();
  for (const [day, slot] of Object.entries(hours)) {
    if (!slot) continue;
    const key = `${slot.opens}-${slot.closes}`;
    const entry = slots.get(key) ?? { ...slot, days: [] };
    entry.days.push(SCHEMA_DAYS[Number(day)]!);
    slots.set(key, entry);
  }
  return [...slots.values()].map((slot) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: slot.days,
    opens: slot.opens,
    closes: slot.closes,
  }));
}

/** Structured data of the store for search engines (schema.org HVACBusiness, a LocalBusiness). */
export function localBusinessJsonLd(store: StorePublic, origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HVACBusiness',
    '@id': `${origin}/#loja`,
    name: store.name,
    legalName: store.legalName,
    url: origin,
    image: `${origin}/brand/fachada-foto.jpg`,
    logo: `${origin}/icon-512.png`,
    telephone: `+55 ${formatPhone(store.phone)}`,
    email: store.email,
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: streetLine(store.address),
      addressLocality: store.address.city,
      addressRegion: store.address.state,
      postalCode: store.address.cep,
      addressCountry: 'BR',
    },
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
