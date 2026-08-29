import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface RequestContextValue {
  readonly correlationId: string;
}

const requestContext = new AsyncLocalStorage<RequestContextValue>();

export function validCorrelationId(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate && /^[A-Za-z0-9._:-]{1,128}$/.test(candidate)) {
    return candidate;
  }
  return randomUUID();
}

export function runWithRequestContext(value: RequestContextValue, next: () => void): void {
  requestContext.run(value, next);
}

export function currentCorrelationId(): string {
  return requestContext.getStore()?.correlationId ?? 'outside-request-context';
}
