import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { count, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../test/database.js';
import {
  categories,
  productImages,
  products,
  serviceTypes,
  stockMovements,
  storeSettings,
  users,
} from './db/schema.js';
import { CATEGORIES, SAMPLE_PRODUCTS, SAMPLE_USERS, SERVICE_TYPES, seedDevelopment } from './db/seed.js';
import { createLocalStorage } from './storage/storage.js';

describe('development seed', () => {
  const database = useTestDatabase();

  const total = async (
    table:
      | typeof users
      | typeof categories
      | typeof serviceTypes
      | typeof storeSettings
      | typeof products
      | typeof productImages
      | typeof stockMovements,
  ) => (await database.db.select({ value: count() }).from(table))[0]!.value;

  it('fills an empty database once, with a sample catalog and photos', async () => {
    const storage = createLocalStorage(mkdtempSync(join(tmpdir(), 'rc-seed-')));
    expect(await seedDevelopment(database.db, storage)).toBe(true);
    expect(await seedDevelopment(database.db, storage)).toBe(false);
    expect(await total(storeSettings)).toBe(1);
    expect(await total(users)).toBe(SAMPLE_USERS.length);
    expect(await total(categories)).toBe(CATEGORIES.length);
    expect(await total(serviceTypes)).toBe(SERVICE_TYPES.length);
    expect(await total(products)).toBe(SAMPLE_PRODUCTS.length);
    expect(await total(productImages)).toBe(SAMPLE_PRODUCTS.length);
    expect(await total(stockMovements)).toBe(SAMPLE_PRODUCTS.filter((p) => p.stock > 0).length);

    const [fridge] = await database.db.select().from(products).where(eq(products.brand, 'Brastemp')).limit(1);
    expect(fridge).toMatchObject({
      slug: 'geladeira-brastemp-frost-free-duplex-375l',
      searchText: 'geladeira brastemp frost free duplex 375l brastemp brm44hb geladeiras e refrigeradores',
    });
    const [image] = await database.db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, fridge!.id));
    expect(image).toMatchObject({ isCover: true, width: 1200, height: 1200 });
    expect(await storage.get(`${image!.storageKey}/960.webp`)).not.toBeNull();
    expect(SAMPLE_PRODUCTS.some((p) => p.stock === 0)).toBe(true);
    expect(new Set(SAMPLE_PRODUCTS.map((p) => p.condition))).toEqual(new Set(['NEW', 'USED']));
  });

  it('adds the catalog to a database seeded before it existed, without photos when there is no storage', async () => {
    await database.db.delete(products);
    expect(await seedDevelopment(database.db)).toBe(true);
    expect(await total(products)).toBe(SAMPLE_PRODUCTS.length);
    expect(await total(productImages)).toBe(0);
    expect(await total(users)).toBe(SAMPLE_USERS.length);
  });
});
