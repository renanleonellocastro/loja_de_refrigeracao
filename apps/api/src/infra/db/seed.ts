import { count } from 'drizzle-orm';
import type { Role } from '@rc/contracts';
import { hashPassword } from '../../modules/auth/passwords.js';
import type { Database } from './client.js';
import { categories, serviceTypes, storeSettings, users } from './schema.js';

/** Real store data from docs/LOJA.md. */
export const STORE = {
  name: 'Refrigeração Castro',
  legalName: 'Refrigeração Castro Ltda ME',
  cnpj: '63060560000151',
  phone: '1938041658',
  whatsapp: null,
  email: 'refrigeracaocastro@yahoo.com.br',
  address: {
    cep: '13800061',
    street: 'Rua Doutor Ulhoa Cintra',
    number: '91',
    complement: null,
    district: 'Centro',
    city: 'Mogi Mirim',
    state: 'SP',
  },
  openingHours: {
    '0': null,
    '1': { opens: '09:00', closes: '18:00' },
    '2': { opens: '09:00', closes: '18:00' },
    '3': { opens: '09:00', closes: '18:00' },
    '4': { opens: '09:00', closes: '18:00' },
    '5': { opens: '09:00', closes: '18:00' },
    '6': null,
  },
  notificationEmails: ['refrigeracaocastro@yahoo.com.br'],
  defaultStockMin: 1,
} as const;

export const CATEGORIES = [
  'Geladeiras e refrigeradores',
  'Freezers',
  'Ar condicionado',
  'Lavadoras de roupa',
  'Bebedouros e purificadores',
  'Refrigeração comercial',
  'Peças e acessórios',
];

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

/** Fills an empty development database. Returns false when data already exists. */
export async function seedDevelopment(db: Database): Promise<boolean> {
  const [existing] = await db.select({ value: count() }).from(storeSettings);
  if (existing!.value > 0) return false;
  const passwordHash = await hashPassword(SAMPLE_PASSWORD);
  await db.transaction(async (tx) => {
    await tx.insert(storeSettings).values({ ...STORE, notificationEmails: [...STORE.notificationEmails] });
    await tx
      .insert(users)
      .values(SAMPLE_USERS.map((u) => ({ ...u, passwordHash, emailVerifiedAt: new Date() })));
    await tx.insert(categories).values(CATEGORIES.map((name, position) => ({ name, position })));
    await tx.insert(serviceTypes).values(SERVICE_TYPES.map((type, position) => ({ ...type, position })));
  });
  return true;
}
