import { randomUUID } from 'node:crypto';

export const correlationHeader = 'x-correlation-id';

export function correlationId(value?: string | null): string {
  const normalized = value?.trim();
  return normalized && normalized.length <= 128 ? normalized : randomUUID();
}

export interface StructuredLogger {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}
