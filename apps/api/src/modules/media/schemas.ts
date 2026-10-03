import { z } from 'zod';

export const imageSchema = z
  .object({
    width: z.number().int(),
    height: z.number().int(),
    url: z.string().describe('Maior variante WebP'),
    srcset: z.string().describe('Variantes para o atributo srcset'),
  })
  .meta({ id: 'Image' });
