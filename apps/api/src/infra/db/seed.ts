import { readFile } from 'node:fs/promises';
import { count } from 'drizzle-orm';
import sharp from 'sharp';
import type { Role } from '@rc/contracts';
import { hashPassword } from '../../modules/auth/passwords.js';
import { productSearchText } from '../../modules/catalog/service.js';
import { storeImage, type StoredImage } from '../../modules/media/service.js';
import { slugify } from '../../shared/text.js';
import type { Storage } from '../storage/storage.js';
import type { Database } from './client.js';
import {
  categories,
  productImages,
  products,
  serviceTypes,
  stockMovements,
  users,
} from './schema.js';

export const CATEGORIES = [
  'Geladeiras e refrigeradores',
  'Freezers',
  'Ar condicionado',
  'Lavadoras de roupa',
  'Bebedouros e purificadores',
  'Refrigeração comercial',
  'Peças e acessórios',
] as const;

export const SERVICE_TYPES = [
  {
    name: 'Conserto de geladeira',
    description: 'Diagnóstico e reparo de geladeiras, freezers e refrigeradores.',
    estimatedMinutes: 120,
  },
  {
    name: 'Manutenção de ar condicionado',
    description: 'Limpeza, carga de gás e reparo de aparelhos split e de janela.',
    estimatedMinutes: 120,
  },
  {
    name: 'Instalação de ar condicionado',
    description: 'Instalação completa de split com suporte, tubulação e dreno.',
    estimatedMinutes: 240,
  },
  { name: 'Conserto de lavadora', description: 'Reparo de lavadoras e lava e seca.', estimatedMinutes: 90 },
  {
    name: 'Conserto de bebedouro',
    description: 'Reparo de bebedouros e purificadores de água.',
    estimatedMinutes: 60,
  },
  {
    name: 'Refrigeração comercial',
    description: 'Balcões, expositores, câmaras frias e equipamentos de comércio.',
    estimatedMinutes: 180,
  },
];

/** Development password for every sample account. Never used in production. */
export const SAMPLE_PASSWORD = 'Castro-Dev-2026';

export const SAMPLE_USERS: Array<{
  role: Role;
  name: string;
  email: string;
  cpf: string | null;
  phone: string;
}> = [
  {
    role: 'ADMIN',
    name: 'Eduardo Castro',
    email: 'admin@castro.dev',
    cpf: '52998224725',
    phone: '19999990001',
  },
  {
    role: 'MANAGER',
    name: 'Marina Gerente',
    email: 'gerente@castro.dev',
    cpf: '15350946056',
    phone: '19999990002',
  },
  {
    role: 'EMPLOYEE',
    name: 'Paulo Técnico',
    email: 'tecnico@castro.dev',
    cpf: '11144477735',
    phone: '19999990003',
  },
  { role: 'CLIENT', name: 'Ana Cliente', email: 'cliente@castro.dev', cpf: null, phone: '19999990004' },
];

type Illustration =
  | 'geladeira'
  | 'freezer'
  | 'ar-condicionado'
  | 'instalacao-ar'
  | 'lavadora'
  | 'bebedouro'
  | 'refrigeracao-comercial';

export interface SampleProduct {
  name: string;
  category: (typeof CATEGORIES)[number];
  brand: string;
  model: string;
  condition: 'NEW' | 'USED';
  description: string;
  priceCents: number;
  stock: number;
  stockMin?: number;
  /** Photo rendered from apps/web/public/illustrations/servico-{illustration}.svg. */
  illustration: Illustration;
}

/** Sample catalog with Brazilian brands, new and used, some without stock. Prices in cents. */
export const SAMPLE_PRODUCTS: SampleProduct[] = [
  {
    name: 'Geladeira Brastemp Frost Free Duplex 375L',
    category: 'Geladeiras e refrigeradores',
    brand: 'Brastemp',
    model: 'BRM44HB',
    condition: 'NEW',
    description: 'Geladeira duas portas, frost free, 375 litros, cor branca. Garantia de fábrica.',
    priceCents: 359_900,
    stock: 4,
    stockMin: 2,
    illustration: 'geladeira',
  },
  {
    name: 'Geladeira Consul Frost Free 340L',
    category: 'Geladeiras e refrigeradores',
    brand: 'Consul',
    model: 'CRM39AB',
    condition: 'NEW',
    description: 'Geladeira duas portas com gavetão de hortifruti e prateleiras reguláveis.',
    priceCents: 289_900,
    stock: 0,
    illustration: 'geladeira',
  },
  {
    name: 'Refrigerador Electrolux Inverse 454L revisado',
    category: 'Geladeiras e refrigeradores',
    brand: 'Electrolux',
    model: 'IB53',
    condition: 'USED',
    description: 'Usado, revisado na nossa oficina, com 90 dias de garantia. Freezer embaixo.',
    priceCents: 249_000,
    stock: 1,
    illustration: 'geladeira',
  },
  {
    name: 'Freezer Horizontal Metalfrio 419L',
    category: 'Freezers',
    brand: 'Metalfrio',
    model: 'DA420',
    condition: 'NEW',
    description: 'Freezer e refrigerador horizontal com duas tampas, ideal para comércio.',
    priceCents: 329_900,
    stock: 2,
    illustration: 'freezer',
  },
  {
    name: 'Freezer Vertical Consul 231L revisado',
    category: 'Freezers',
    brand: 'Consul',
    model: 'CVU30',
    condition: 'USED',
    description: 'Usado, revisado, com 90 dias de garantia. Quatro gavetas.',
    priceCents: 119_000,
    stock: 1,
    illustration: 'freezer',
  },
  {
    name: 'Ar Condicionado Split Inverter Springer Midea 12000 BTUs',
    category: 'Ar condicionado',
    brand: 'Springer Midea',
    model: '42AGVCI12M5',
    condition: 'NEW',
    description: 'Split hi wall inverter, só frio, 220 V. Instalação pode ser agendada com a loja.',
    priceCents: 259_900,
    stock: 6,
    stockMin: 3,
    illustration: 'ar-condicionado',
  },
  {
    name: 'Ar Condicionado Split Gree 9000 BTUs',
    category: 'Ar condicionado',
    brand: 'Gree',
    model: 'GWC09QA',
    condition: 'NEW',
    description: 'Split hi wall, só frio, 220 V, baixo consumo de energia.',
    priceCents: 199_900,
    stock: 0,
    illustration: 'ar-condicionado',
  },
  {
    name: 'Ar Condicionado de Janela Consul 7500 BTUs revisado',
    category: 'Ar condicionado',
    brand: 'Consul',
    model: 'CCB07',
    condition: 'USED',
    description: 'Usado, com carga de gás nova e 90 dias de garantia. Controle mecânico.',
    priceCents: 89_000,
    stock: 1,
    illustration: 'instalacao-ar',
  },
  {
    name: 'Lavadora Brastemp 12 kg',
    category: 'Lavadoras de roupa',
    brand: 'Brastemp',
    model: 'BWK12AB',
    condition: 'NEW',
    description: 'Lavadora de abertura superior com ciclo antibolinha e enxágue duplo.',
    priceCents: 229_900,
    stock: 3,
    illustration: 'lavadora',
  },
  {
    name: 'Lavadora Electrolux 8,5 kg revisada',
    category: 'Lavadoras de roupa',
    brand: 'Electrolux',
    model: 'LT09E',
    condition: 'USED',
    description: 'Usada, revisada, com 90 dias de garantia.',
    priceCents: 79_000,
    stock: 0,
    illustration: 'lavadora',
  },
  {
    name: 'Bebedouro de Coluna Libell Press Flex',
    category: 'Bebedouros e purificadores',
    brand: 'Libell',
    model: 'Press Flex',
    condition: 'NEW',
    description: 'Bebedouro para garrafão com água natural e gelada.',
    priceCents: 69_900,
    stock: 5,
    illustration: 'bebedouro',
  },
  {
    name: 'Bebedouro Esmaltec de Mesa',
    category: 'Bebedouros e purificadores',
    brand: 'Esmaltec',
    model: 'EGM30',
    condition: 'NEW',
    description: 'Bebedouro de mesa para garrafão, compacto.',
    priceCents: 59_900,
    stock: 2,
    illustration: 'bebedouro',
  },
  {
    name: 'Expositor Refrigerado Vertical Metalfrio 400L revisado',
    category: 'Refrigeração comercial',
    brand: 'Metalfrio',
    model: 'VB40',
    condition: 'USED',
    description: 'Visa cooler de porta de vidro, usado e revisado, para bebidas.',
    priceCents: 349_000,
    stock: 1,
    illustration: 'refrigeracao-comercial',
  },
  {
    name: 'Compressor Embraco 1/4 HP',
    category: 'Peças e acessórios',
    brand: 'Embraco',
    model: 'EMIS30HHR',
    condition: 'NEW',
    description: 'Compressor para geladeiras e freezers domésticos, gás R600a.',
    priceCents: 49_900,
    stock: 8,
    illustration: 'geladeira',
  },
];

const ILLUSTRATIONS = new URL('../../../../web/public/illustrations/', import.meta.url);

/** Renders a store illustration as a photo, so the seed needs no external images. */
async function illustrationPhoto(storage: Storage, name: Illustration): Promise<StoredImage> {
  const svg = await readFile(new URL(`servico-${name}.svg`, ILLUSTRATIONS));
  const photo = await sharp(svg, { density: 300 })
    .resize(1200, 1200)
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 90 })
    .toBuffer();
  return storeImage(storage, photo);
}

async function seedProducts(db: Database, storage: Storage | undefined): Promise<boolean> {
  const [existing] = await db.select({ value: count() }).from(products);
  if (existing!.value > 0) return false;
  const categoryIds = new Map((await db.select().from(categories)).map((c) => [c.name, c.id]));
  const photos = new Map<Illustration, StoredImage>();
  for (const sample of SAMPLE_PRODUCTS) {
    if (storage && !photos.has(sample.illustration)) {
      photos.set(sample.illustration, await illustrationPhoto(storage, sample.illustration));
    }
  }
  await db.transaction(async (tx) => {
    for (const sample of SAMPLE_PRODUCTS) {
      const [product] = await tx
        .insert(products)
        .values({
          slug: slugify(sample.name),
          name: sample.name,
          categoryId: categoryIds.get(sample.category)!,
          brand: sample.brand,
          model: sample.model,
          condition: sample.condition,
          description: sample.description,
          priceCents: sample.priceCents,
          stockAvailable: sample.stock,
          stockMin: sample.stockMin ?? null,
          searchText: productSearchText(sample, sample.category),
        })
        .returning();
      if (sample.stock > 0) {
        await tx
          .insert(stockMovements)
          .values({ productId: product!.id, type: 'IN', quantity: sample.stock, reason: 'Estoque inicial' });
      }
      const photo = photos.get(sample.illustration);
      if (photo) {
        await tx.insert(productImages).values({
          productId: product!.id,
          storageKey: photo.key,
          width: photo.width,
          height: photo.height,
          isCover: true,
        });
      }
    }
  });
  return true;
}

/**
 * Fills a development database. The base data (accounts, categories, service types) goes
 * into an empty database; the sample catalog goes in whenever there are no products, with photos
 * when a storage is given. Returns false when there was nothing to add.
 */
export async function seedDevelopment(db: Database, storage?: Storage): Promise<boolean> {
  const [existing] = await db.select({ value: count() }).from(users);
  const seedBase = existing!.value === 0;
  if (seedBase) {
    const passwordHash = await hashPassword(SAMPLE_PASSWORD);
    await db.transaction(async (tx) => {
      await tx
        .insert(users)
        .values(SAMPLE_USERS.map((u) => ({ ...u, passwordHash, emailVerifiedAt: new Date() })));
      await tx.insert(categories).values(CATEGORIES.map((name, position) => ({ name, position })));
      await tx.insert(serviceTypes).values(SERVICE_TYPES.map((type, position) => ({ ...type, position })));
    });
  }
  const seededProducts = await seedProducts(db, storage);
  return seedBase || seededProducts;
}
