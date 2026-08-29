import type { FastifyRequest } from 'fastify';

export interface Principal {
  readonly userId: string;
  readonly organizationId: string;
  readonly subject: string;
  readonly email: string;
  readonly displayName: string;
  readonly roles: readonly string[];
}

export interface AuthenticatedRequest extends FastifyRequest {
  principal?: Principal;
  correlationId?: string;
}

export interface AuthenticationAdapter {
  authenticate(request: FastifyRequest): Promise<Principal>;
}

export const AUTHENTICATION_ADAPTER = Symbol('AUTHENTICATION_ADAPTER');
