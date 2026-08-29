import { HttpStatus, Injectable } from '@nestjs/common';
import { z } from 'zod';

import { ApiException } from '../common/api-error.js';
import { AppConfigService } from '../config/config.module.js';
import { DatabaseService } from '../database/database.service.js';
import type { AuthenticationAdapter, Principal } from './auth.types.js';

const DevelopmentHeadersSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
});

interface UserRow {
  readonly id: string;
  readonly external_subject: string;
  readonly email: string;
  readonly display_name: string;
  readonly roles: string[];
}

/** Local-only identity adapter. It resolves seeded users from PostgreSQL; it never trusts role headers. */
@Injectable()
export class DevelopmentAuthenticationAdapter implements AuthenticationAdapter {
  public constructor(
    config: AppConfigService,
    private readonly database: DatabaseService,
  ) {
    if (config.values.NODE_ENV === 'production') {
      throw new Error('DevelopmentAuthenticationAdapter cannot run in production');
    }
  }

  public async authenticate(request: { headers: Record<string, unknown> }): Promise<Principal> {
    const parsed = DevelopmentHeadersSchema.safeParse({
      organizationId: request.headers['x-dev-organization-id'],
      userId: request.headers['x-dev-user-id'],
    });
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'DEVELOPMENT_IDENTITY_REQUIRED',
        'Development requests require x-dev-organization-id and x-dev-user-id',
      );
    }

    const user = await this.database.withTenant(parsed.data.organizationId, async (client) => {
      const result = await client.query<UserRow>(
        `SELECT id, external_subject, email::text, display_name, roles
         FROM users
         WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
        [parsed.data.userId, parsed.data.organizationId],
      );
      return result.rows[0];
    });
    if (!user) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'INVALID_IDENTITY', 'The user is not active');
    }

    return {
      userId: user.id,
      organizationId: parsed.data.organizationId,
      subject: user.external_subject,
      email: user.email,
      displayName: user.display_name,
      roles: user.roles,
    };
  }
}
