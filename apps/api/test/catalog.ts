import { categories } from '../src/infra/db/schema.js';
import type { useTestApp } from './harness.js';

type Harness = ReturnType<typeof useTestApp>;
type Headers = Record<string, string>;

export async function createCategory(t: Harness, name: string, position = 0) {
  const [row] = await t.db.insert(categories).values({ name, position }).returning();
  return row!;
}

export interface ProductFixture {
  name?: string;
  categoryId: number;
  brand?: string | null;
  model?: string | null;
  condition?: 'NEW' | 'USED';
  description?: string;
  priceCents?: number;
  initialStock?: number;
  stockMin?: number | null;
}

/** Creates a product through the API and returns its detail. */
export async function createProduct(t: Harness, headers: Headers, fixture: ProductFixture) {
  const response = await t.app.inject({
    method: 'POST',
    url: '/api/v1/products',
    headers,
    payload: { name: 'Produto de teste', priceCents: 10_000, ...fixture },
  });
  if (response.statusCode !== 201) throw new Error(`createProduct failed: ${response.body}`);
  return response.json<{ id: number; slug: string; version: number; stockAvailable: number }>();
}
