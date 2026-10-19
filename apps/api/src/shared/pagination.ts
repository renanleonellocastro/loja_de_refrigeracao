import { z } from 'zod';
import { integerInput } from './schemas.js';

// prefault, not default: zod leaves `default` out of the OpenAPI schema of a preprocessed input.
export const pageQuerySchema = z.object({
  page: integerInput(z.number().int().min(1)).prefault(1),
  pageSize: integerInput(z.number().int().min(1).max(100)).prefault(20),
});

export type PageQuery = z.infer<typeof pageQuerySchema>;

export const pageMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export function paginated<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item), meta: pageMetaSchema });
}

export function toLimitOffset({ page, pageSize }: PageQuery): { limit: number; offset: number } {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}

export function pageOf<T>(data: T[], query: PageQuery, total: number) {
  return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
}
