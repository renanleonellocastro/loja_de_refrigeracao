import { z } from 'zod';

const DEV_DATABASE_URL = 'postgres://castro:castro@localhost:5433/castro';
const DEV_JWT_SECRET = 'development-only-secret-change-me-0123456789';

const booleanFromString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().positive().default(3001),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    APP_ORIGIN: z.url().default('http://localhost:3000'),
    DATABASE_URL: z.string().min(1).default(DEV_DATABASE_URL),
    JWT_SECRET: z.string().min(32).default(DEV_JWT_SECRET),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    COOKIE_SECURE: booleanFromString,
    TRUST_PROXY: booleanFromString,
    SMTP_URL: z.string().min(1).default('smtp://localhost:1025'),
    MAIL_FROM: z.string().min(1).default('Refrigeração Castro <nao-responda@refrigeracaocastro.com.br>'),
    STORAGE_PATH: z.string().min(1).default('./storage'),
  })
  .transform((config) => ({
    ...config,
    COOKIE_SECURE: config.COOKIE_SECURE ?? config.NODE_ENV === 'production',
    TRUST_PROXY: config.TRUST_PROXY ?? config.NODE_ENV === 'production',
  }))
  .superRefine((config, ctx) => {
    if (config.NODE_ENV !== 'production') return;
    if (config.JWT_SECRET === DEV_JWT_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'must be set in production' });
    }
    if (config.DATABASE_URL === DEV_DATABASE_URL) {
      ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'must be set in production' });
    }
  });

export type Config = z.infer<typeof configSchema>;

export class InvalidConfigError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid configuration: ${issues.join('; ')}`);
    this.name = 'InvalidConfigError';
  }
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    throw new InvalidConfigError(
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return parsed.data;
}
