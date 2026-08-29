import { z } from 'zod';

const booleanFromEnvironment = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const optionalUrl = z.preprocess((value) => (value === '' ? undefined : value), z.url().optional());

export const AppConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(4_000),
    WEB_ORIGIN: z.url().default('http://localhost:3000'),
    DATABASE_URL: z.string().min(1),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(20),
    AUTH_ADAPTER: z.enum(['oidc', 'development']).default('development'),
    AUTH_ISSUER_URL: optionalUrl,
    AUTH_AUDIENCE: z.string().min(1).default('veyra-api'),
    OPENFGA_ADAPTER: z.enum(['openfga', 'development']).default('development'),
    OPENFGA_API_URL: z.url().default('http://localhost:8081'),
    OPENFGA_STORE_ID: z.string().default(''),
    OPENFGA_MODEL_ID: z.string().default(''),
    S3_ENDPOINT: z.url().default('http://localhost:9000'),
    S3_REGION: z.string().min(1).default('us-east-1'),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(8),
    S3_QUARANTINE_BUCKET: z.string().min(3).default('veyra-quarantine'),
    S3_TRUSTED_BUCKET: z.string().min(3).default('veyra-trusted'),
    S3_FORCE_PATH_STYLE: booleanFromEnvironment.default(true),
    MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(5 * 1_024 * 1_024 * 1_024)
      .default(50 * 1_024 * 1_024),
    AI_SERVICE_URL: z.url().default('http://localhost:8000'),
    AI_INTERNAL_API_TOKEN: z.string().min(16),
    AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
  })
  .superRefine((config, context) => {
    if (config.AUTH_ADAPTER === 'oidc' && !config.AUTH_ISSUER_URL) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_ISSUER_URL'],
        message: 'AUTH_ISSUER_URL is required when AUTH_ADAPTER=oidc',
      });
    }

    if (
      config.OPENFGA_ADAPTER === 'openfga' &&
      (!config.OPENFGA_STORE_ID || !config.OPENFGA_MODEL_ID)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['OPENFGA_STORE_ID'],
        message: 'OPENFGA_STORE_ID and OPENFGA_MODEL_ID are required for OpenFGA',
      });
    }

    if (
      config.NODE_ENV === 'production' &&
      (config.AUTH_ADAPTER === 'development' || config.OPENFGA_ADAPTER === 'development')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['NODE_ENV'],
        message: 'Development identity and authorization adapters are forbidden in production',
      });
    }
  });

export type AppConfig = z.infer<typeof AppConfigSchema>;

export function parseAppConfig(environment: NodeJS.ProcessEnv): AppConfig {
  return AppConfigSchema.parse(environment);
}
