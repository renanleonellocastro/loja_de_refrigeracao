import { z } from 'zod';

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
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
