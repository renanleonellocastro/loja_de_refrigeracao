import { z } from 'zod';

const DEV_DATABASE_URL = 'postgres://castro:castro@localhost:5433/castro';
const DEV_JWT_SECRET = 'development-only-secret-change-me-0123456789';

const booleanFromString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

/** Env templates leave unused settings empty (`S3_ENDPOINT=`); empty means not set. */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

const baseSchema = z.object({
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
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_PATH: z.string().min(1).default('./storage'),
  S3_BUCKET: optional(z.string()),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ENDPOINT: optional(z.url()),
  S3_FORCE_PATH_STYLE: optional(booleanFromString),
  S3_ACCESS_KEY_ID: optional(z.string()),
  S3_SECRET_ACCESS_KEY: optional(z.string()),
  SIGN_UP_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(10),
  PASSWORD_RESETS_PER_15_MINUTES: z.coerce.number().int().positive().default(5),
});

const configSchema = baseSchema
  .transform((config) => ({
    ...config,
    COOKIE_SECURE: config.COOKIE_SECURE ?? config.NODE_ENV === 'production',
    TRUST_PROXY: config.TRUST_PROXY ?? config.NODE_ENV === 'production',
    // A custom endpoint means a service other than AWS, and nearly all of them want path style URLs.
    S3_FORCE_PATH_STYLE: config.S3_FORCE_PATH_STYLE ?? config.S3_ENDPOINT !== undefined,
  }))
  .superRefine((config, ctx) => {
    for (const path of [...productionIssues(config), ...storageIssues(config)]) {
      ctx.addIssue({ code: 'custom', path: [path], message: ISSUE_MESSAGES[path] });
    }
  });

type ParsedConfig = z.output<typeof baseSchema>;

const ISSUE_MESSAGES: Record<string, string> = {
  JWT_SECRET: 'must be set in production',
  DATABASE_URL: 'must be set in production',
  S3_BUCKET: 'required when STORAGE_DRIVER is s3',
  S3_SECRET_ACCESS_KEY: 'S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY go together',
};

function productionIssues(config: ParsedConfig): string[] {
  if (config.NODE_ENV !== 'production') return [];
  return [
    ...(config.JWT_SECRET === DEV_JWT_SECRET ? ['JWT_SECRET'] : []),
    ...(config.DATABASE_URL === DEV_DATABASE_URL ? ['DATABASE_URL'] : []),
  ];
}

function storageIssues(config: ParsedConfig): string[] {
  const halfCredentials =
    (config.S3_ACCESS_KEY_ID === undefined) !== (config.S3_SECRET_ACCESS_KEY === undefined);
  return [
    ...(config.STORAGE_DRIVER === 's3' && !config.S3_BUCKET ? ['S3_BUCKET'] : []),
    ...(halfCredentials ? ['S3_SECRET_ACCESS_KEY'] : []),
  ];
}

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
