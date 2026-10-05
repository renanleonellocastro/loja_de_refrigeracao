import { afterEach, describe, expect, it, vi } from 'vitest';
import pwaPlugin from '~/plugins/pwa.client';
import { forgetDay, readDay, readOfflineDay, saveDay } from '~/utils/offline-day';
import { registerServiceWorker } from '~/utils/pwa';
import { localBusinessJsonLd } from '~/utils/seo';
import { fetchSitemapProducts, robotsTxt, sitemapXml } from '~/utils/sitemap';
import { FALLBACK_STORE, mapsEmbedUrl, openingHoursLines, openingHoursSummary } from '~/utils/store';
import { appointment } from '../support/agenda';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('opening hours', () => {
  it('groups equal consecutive days, Monday first', () => {
    const slot = { opens: '08:30', closes: '12:00' };
    const hours = { 0: null, 1: slot, 2: slot, 3: null, 4: slot, 5: slot, 6: slot };
    expect(openingHoursLines(hours)).toEqual([
      { days: 'Segunda e terça', hours: 'das 8h30 às 12h' },
      { days: 'Quarta', hours: 'fechado' },
      { days: 'Quinta a sábado', hours: 'das 8h30 às 12h' },
      { days: 'Domingo', hours: 'fechado' },
    ]);
    expect(openingHoursSummary(hours)).toBe(
      'Segunda e terça, das 8h30 às 12h; Quinta a sábado, das 8h30 às 12h',
    );
    expect(openingHoursLines({})).toEqual([{ days: 'Segunda a domingo', hours: 'fechado' }]);
  });

  it('builds the map embed address', () => {
    expect(mapsEmbedUrl(FALLBACK_STORE.address)).toBe(
      'https://www.google.com/maps?q=Rua%20Doutor%20Ulhoa%20Cintra%2C%2091%2C%20Mogi%20Mirim%2C%20SP%2C%2013800061&output=embed',
    );
  });
});

describe('structured data', () => {
  it('describes the store as an HVACBusiness with address, phone and hours', () => {
    const data = localBusinessJsonLd(FALLBACK_STORE, 'https://castro.dev');
    expect(data).toMatchObject({
      '@type': 'HVACBusiness',
      url: 'https://castro.dev',
      telephone: '+55 (19) 3804-1658',
      address: { streetAddress: 'Rua Doutor Ulhoa Cintra, 91', postalCode: '13800061', addressCountry: 'BR' },
      openingHoursSpecification: [
        {
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '09:00',
          closes: '18:00',
        },
      ],
    });
  });
});

describe('sitemap and robots', () => {
  it('lists the public pages and the products, escaping the addresses', () => {
    const xml = sitemapXml('https://castro.dev', [{ slug: 'geladeira&cia' }]);
    expect(xml).toContain('<loc>https://castro.dev/</loc>');
    expect(xml).toContain('<loc>https://castro.dev/sobre</loc>');
    expect(xml).toContain('<loc>https://castro.dev/produtos/geladeira&amp;cia</loc>');
    const robots = robotsTxt('https://castro.dev');
    expect(robots).toContain('Disallow: /painel');
    expect(robots.match(/Disallow: \/produtos\/gerenciar\n/g)).toHaveLength(1);
    expect(robots).toContain('Sitemap: https://castro.dev/sitemap.xml');
  });

  it('reads every page of products and survives an unreachable API', async () => {
    const pages = [
      { data: [{ slug: 'a', name: 'A' }], meta: { total: 101 } },
      { data: [{ slug: 'b', name: 'B' }], meta: { total: 101 } },
    ];
    const fetcher = vi.fn(async (url: string) => {
      const page = Number(new URL(url).searchParams.get('page'));
      return new Response(JSON.stringify(pages[page - 1]), { status: 200 });
    });
    expect(await fetchSitemapProducts('http://api', fetcher as unknown as typeof fetch)).toEqual([
      { slug: 'a' },
      { slug: 'b' },
    ]);
    const failing = vi.fn(async () => new Response('{}', { status: 500 }));
    expect(await fetchSitemapProducts('http://api', failing as unknown as typeof fetch)).toEqual([]);
    const offline = vi.fn(async () => {
      throw new Error('offline');
    });
    expect(await fetchSitemapProducts('http://api', offline as unknown as typeof fetch)).toEqual([]);
  });
});

describe('PWA', () => {
  it('registers the service worker only in production browsers that support it', async () => {
    const register = vi.fn(async () => ({}));
    const navigator = { serviceWorker: { register } } as unknown as Pick<Navigator, 'serviceWorker'>;
    expect(await registerServiceWorker(navigator, true)).toBe(false);
    expect(await registerServiceWorker({}, false)).toBe(false);
    expect(await registerServiceWorker(navigator, false)).toBe(true);
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    register.mockRejectedValueOnce(new Error('denied'));
    expect(await registerServiceWorker(navigator, false)).toBe(false);
  });

  it('registers after the app becomes interactive', async () => {
    const hooks: Record<string, () => void> = {};
    const nuxtApp = { hook: vi.fn((name: string, fn: () => void) => (hooks[name] = fn)) };
    await (pwaPlugin as unknown as (app: typeof nuxtApp) => unknown)(nuxtApp);
    expect(() => hooks['app:suspense:resolve']!()).not.toThrow();
  });

  it('keeps the day of the technician for this person and day only', () => {
    const entry = {
      userId: 3,
      day: '2026-10-05',
      savedAt: '2026-10-05T12:00:00.000Z',
      visits: [appointment()],
    };
    expect(readDay(3, '2026-10-05')).toBeNull();
    saveDay(entry);
    expect(readDay(3, '2026-10-05')).toEqual(entry);
    expect(readDay(4, '2026-10-05')).toBeNull();
    expect(readDay(3, '2026-10-06')).toBeNull();
    expect(readOfflineDay('2026-10-05')).toEqual(entry);
    expect(readOfflineDay('2026-10-06')).toBeNull();
    expect(readOfflineDay()).toEqual(entry);
    forgetDay();
    expect(readDay(3, '2026-10-05')).toBeNull();
    expect(readOfflineDay('2026-10-05')).toBeNull();
    localStorage.setItem('rc-hoje', '{broken');
    expect(readDay(3, '2026-10-05')).toBeNull();
    expect(readOfflineDay('2026-10-05')).toBeNull();
  });

  it('tolerates blocked storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveDay({ userId: 1, day: 'x', savedAt: 'x', visits: [] })).not.toThrow();
    expect(() => forgetDay()).not.toThrow();
  });
});
