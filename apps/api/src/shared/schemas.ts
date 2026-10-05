import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[Zz]|[+-]\d{2}:?\d{2})?)?$/;

/** An ISO 8601 date or date-time input; anything else (a bare number, free text) is rejected. */
export const dateInput = (error = 'Data inválida.') =>
  z
    .string({ error })
    .regex(ISO_DATE, { error })
    .pipe(z.coerce.date({ error }))
    .meta({ type: 'string', format: 'date-time' });

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const problemSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string().optional(),
    instance: z.string().optional(),
    requestId: z.string().optional(),
    errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  })
  .loose()
  .meta({ id: 'Problem' });

export const emailSchema = z
  .string({ error: 'Informe um email válido.' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Informe um email válido.' }).max(254, { error: 'Email longo demais.' }));

export const noContentSchema = z.undefined();

/** A file answer (image, PDF, JSON download) documented with its media type. */
export const fileResponse = (mediaType: string, description: string) => ({
  description,
  content: { [mediaType]: { schema: z.custom<Buffer>().meta({ type: 'string', format: 'binary' }) } },
});

/** Standard error responses documented on every route. */
export const errorResponses = {
  400: problemSchema,
  401: problemSchema,
  403: problemSchema,
  404: problemSchema,
  409: problemSchema,
  422: problemSchema,
  429: problemSchema,
} as const;
