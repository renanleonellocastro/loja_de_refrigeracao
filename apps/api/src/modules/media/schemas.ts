import { z } from 'zod';

export const imageSchema = z
  .object({
    width: z.number().int(),
    height: z.number().int(),
    url: z.string().describe('Maior variante WebP'),
    srcset: z.string().describe('Variantes WebP para o atributo srcset'),
    avifSrcset: z.string().describe('Variantes AVIF para o srcset de um <source type="image/avif">'),
  })
  .meta({ id: 'Image' });
