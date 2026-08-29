import { describe, expect, it, vi } from 'vitest';

import type { Principal } from '../src/auth/auth.types.js';
import { DevelopmentAuthorizationAdapter } from '../src/authorization/development-authorization.adapter.js';
import type { AppConfigService } from '../src/config/config.module.js';
import type { DatabaseService } from '../src/database/database.service.js';

const principal: Principal = {
  userId: '20000000-0000-4000-8000-000000000001',
  organizationId: '10000000-0000-4000-8000-000000000001',
  subject: 'dev:alice',
  email: 'alice@northstar.example',
  displayName: 'Alice Morgan',
  roles: [],
};

describe('DevelopmentAuthorizationAdapter tenant boundary', () => {
  it('denies a document ID that RLS cannot resolve inside the principal tenant', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const withTenant = vi.fn(
      async (organizationId: string, operation: (client: unknown) => unknown) => {
        expect(organizationId).toBe(principal.organizationId);
        return operation({ query });
      },
    );
    const config = {
      values: { NODE_ENV: 'test' },
    } as unknown as AppConfigService;
    const database = { withTenant } as unknown as DatabaseService;
    const adapter = new DevelopmentAuthorizationAdapter(config, database);

    await expect(
      adapter.check({
        principal,
        resourceType: 'document',
        resourceId: '50000000-0000-4000-8000-000000000099',
        relation: 'can_view',
      }),
    ).resolves.toBe(false);
    expect(withTenant).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledOnce();
  });
});
