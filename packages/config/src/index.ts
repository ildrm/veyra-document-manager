import { z } from 'zod';

export const RuntimeEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  AUTH_ADAPTER: z.enum(['oidc', 'development']).default('development'),
  OPENFGA_ADAPTER: z.enum(['openfga', 'development']).default('development'),
  OPENFGA_API_URL: z.url().default('http://localhost:8081'),
  OPENFGA_STORE_ID: z.string().default(''),
  OPENFGA_MODEL_ID: z.string().default(''),
  S3_ENDPOINT: z.url().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(8),
  S3_QUARANTINE_BUCKET: z.string().default('veyra-quarantine'),
  S3_TRUSTED_BUCKET: z.string().default('veyra-trusted'),
  AI_SERVICE_URL: z.url().default('http://localhost:8000'),
  VALKEY_URL: z.string().default('redis://localhost:6379'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().default('http://localhost:4318'),
});

export type RuntimeEnvironment = z.infer<typeof RuntimeEnvironmentSchema>;

export function parseRuntimeEnvironment(input: Record<string, string | undefined>) {
  return RuntimeEnvironmentSchema.parse(input);
}
