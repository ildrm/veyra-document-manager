import { HttpStatus, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';

import { ApiException } from '../common/api-error.js';
import { AppConfigService } from '../config/config.module.js';
import { DatabaseService } from '../database/database.service.js';
import type { AuthenticationAdapter, Principal } from './auth.types.js';

const OidcClaimsSchema = z.object({
  sub: z.string().min(1),
  org_id: z.uuid(),
  user_id: z.uuid().optional(),
  email: z.email(),
  name: z.string().min(1),
  roles: z.array(z.string()).default([]),
});

const DiscoverySchema = z.object({
  issuer: z.url(),
  jwks_uri: z.url(),
});

/** Production identity adapter using OIDC discovery and asymmetric JWT verification. */
@Injectable()
export class OidcAuthenticationAdapter implements AuthenticationAdapter {
  private readonly issuer: string;
  private readonly audience: string;
  private keySetPromise?: Promise<JWTVerifyGetKey>;

  public constructor(
    config: AppConfigService,
    private readonly database: DatabaseService,
  ) {
    if (!config.values.AUTH_ISSUER_URL) throw new Error('AUTH_ISSUER_URL is required');
    this.issuer = config.values.AUTH_ISSUER_URL.replace(/\/$/, '');
    this.audience = config.values.AUTH_AUDIENCE;
  }

  public async authenticate(request: { headers: Record<string, unknown> }): Promise<Principal> {
    const authorization = request.headers.authorization;
    const value = Array.isArray(authorization) ? authorization[0] : authorization;
    if (typeof value !== 'string' || !value.startsWith('Bearer ')) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'BEARER_TOKEN_REQUIRED',
        'Bearer token required',
      );
    }

    let claims: z.infer<typeof OidcClaimsSchema>;
    try {
      const verified = await jwtVerify(value.slice(7), await this.keySet(), {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['RS256', 'PS256', 'ES256'],
        clockTolerance: 5,
      });
      claims = OidcClaimsSchema.parse(verified.payload);
    } catch {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_ACCESS_TOKEN',
        'Access token is invalid',
      );
    }

    const user = await this.database.withTenant(claims.org_id, async (client) => {
      const result = await client.query<{
        readonly id: string;
        readonly external_subject: string;
        readonly email: string;
        readonly display_name: string;
        readonly roles: string[];
      }>(
        `SELECT id, external_subject, email::text, display_name, roles
         FROM users
         WHERE organization_id = $1 AND external_subject = $2 AND status = 'active'`,
        [claims.org_id, claims.sub],
      );
      return result.rows[0];
    });
    if (!user || (claims.user_id && claims.user_id !== user.id)) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'IDENTITY_NOT_PROVISIONED',
        'The identity is not provisioned or active in this organization',
      );
    }
    return {
      userId: user.id,
      organizationId: claims.org_id,
      subject: user.external_subject,
      email: user.email,
      displayName: user.display_name,
      roles: user.roles,
    };
  }

  private keySet(): Promise<JWTVerifyGetKey> {
    this.keySetPromise ??= this.discoverKeySet();
    return this.keySetPromise;
  }

  private async discoverKeySet(): Promise<JWTVerifyGetKey> {
    const response = await fetch(`${this.issuer}/.well-known/openid-configuration`, {
      signal: AbortSignal.timeout(5_000),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`OIDC discovery failed with ${response.status}`);
    const discovery = DiscoverySchema.parse(await response.json());
    if (discovery.issuer.replace(/\/$/, '') !== this.issuer) {
      throw new Error('OIDC discovery issuer mismatch');
    }
    return createRemoteJWKSet(new URL(discovery.jwks_uri), {
      timeoutDuration: 5_000,
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
    });
  }
}
