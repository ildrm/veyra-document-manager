import { Injectable } from '@nestjs/common';

import type { Principal } from '../auth/auth.types.js';
import { AppConfigService } from '../config/config.module.js';
import { DatabaseService } from '../database/database.service.js';
import type {
  AuthorizationAdapter,
  AuthorizationCheck,
  AuthorizationScope,
  Relation,
} from './authorization.types.js';

interface MembershipRow {
  readonly workspace_id: string;
  readonly role: 'viewer' | 'contributor' | 'editor' | 'manager';
}

const roleRelations: Readonly<Record<MembershipRow['role'], readonly Relation[]>> = {
  viewer: ['can_view'],
  contributor: ['can_view', 'can_comment'],
  editor: ['can_view', 'can_comment', 'can_edit'],
  manager: ['can_view', 'can_comment', 'can_edit', 'can_manage', 'can_share', 'can_approve'],
};

/**
 * Local-only authorization. It is intentionally conservative: workspace membership and
 * document ownership only. Production relationship inheritance belongs in OpenFGA.
 */
@Injectable()
export class DevelopmentAuthorizationAdapter implements AuthorizationAdapter {
  public constructor(
    config: AppConfigService,
    private readonly database: DatabaseService,
  ) {
    if (config.values.NODE_ENV === 'production') {
      throw new Error('DevelopmentAuthorizationAdapter cannot run in production');
    }
  }

  public async check(input: AuthorizationCheck): Promise<boolean> {
    if (input.resourceType === 'organization') {
      return (
        input.resourceId === input.principal.organizationId &&
        this.isOrganizationAdmin(input.principal)
      );
    }

    return this.database.withTenant(input.principal.organizationId, async (client) => {
      if (input.resourceType === 'workspace') {
        const result = await client.query<MembershipRow>(
          `SELECT w.id AS workspace_id, COALESCE(wm.role, 'viewer') AS role
           FROM workspaces w
           LEFT JOIN workspace_members wm
             ON wm.organization_id = w.organization_id
            AND wm.workspace_id = w.id
            AND wm.user_id = $2
           WHERE w.organization_id = $1
             AND w.id = $3
             AND (wm.user_id IS NOT NULL OR $4::boolean)`,
          [
            input.principal.organizationId,
            input.principal.userId,
            input.resourceId,
            this.isOrganizationAdmin(input.principal),
          ],
        );
        const row = result.rows[0];
        return Boolean(
          row &&
          (this.isOrganizationAdmin(input.principal) ||
            roleRelations[row.role].includes(input.relation)),
        );
      }

      const result = await client.query<MembershipRow & { readonly owner_id: string }>(
        `SELECT d.owner_id, d.workspace_id, COALESCE(wm.role, 'viewer') AS role
         FROM documents d
         LEFT JOIN workspace_members wm
           ON wm.organization_id = d.organization_id
          AND wm.workspace_id = d.workspace_id
          AND wm.user_id = $2
         WHERE d.organization_id = $1
           AND d.id = $3
           AND d.deleted_at IS NULL
           AND (wm.user_id IS NOT NULL OR d.owner_id = $2 OR $4::boolean)`,
        [
          input.principal.organizationId,
          input.principal.userId,
          input.resourceId,
          this.isOrganizationAdmin(input.principal),
        ],
      );
      const row = result.rows[0];
      return Boolean(
        row &&
        (this.isOrganizationAdmin(input.principal) ||
          row.owner_id === input.principal.userId ||
          roleRelations[row.role].includes(input.relation)),
      );
    });
  }

  public async listAuthorizedScope(
    principal: Principal,
    relation: Relation,
  ): Promise<AuthorizationScope> {
    return this.database.withTenant(principal.organizationId, async (client) => {
      if (this.isOrganizationAdmin(principal)) {
        const result = await client.query<{ readonly id: string }>(
          'SELECT id FROM workspaces WHERE organization_id = $1',
          [principal.organizationId],
        );
        return { workspaceIds: result.rows.map((row) => row.id), documentIds: [] };
      }

      const memberships = await client.query<MembershipRow>(
        `SELECT workspace_id, role
         FROM workspace_members
         WHERE organization_id = $1 AND user_id = $2`,
        [principal.organizationId, principal.userId],
      );
      const workspaceIds = memberships.rows
        .filter((membership) => roleRelations[membership.role].includes(relation))
        .map((membership) => membership.workspace_id);
      const owned = await client.query<{ readonly id: string }>(
        `SELECT id FROM documents
         WHERE organization_id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
        [principal.organizationId, principal.userId],
      );
      return { workspaceIds, documentIds: owned.rows.map((row) => row.id) };
    });
  }

  private isOrganizationAdmin(principal: Principal): boolean {
    return (
      principal.roles.includes('organization-admin') || principal.roles.includes('knowledge-admin')
    );
  }
}
