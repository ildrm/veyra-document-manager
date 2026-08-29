import type { Principal } from '../auth/auth.types.js';

export const relations = [
  'can_view',
  'can_comment',
  'can_edit',
  'can_manage',
  'can_share',
  'can_approve',
] as const;

export type Relation = (typeof relations)[number];
export type ResourceType = 'organization' | 'workspace' | 'document';

export interface AuthorizationCheck {
  readonly principal: Principal;
  readonly resourceType: ResourceType;
  readonly resourceId: string;
  readonly relation: Relation;
}

export interface AuthorizationScope {
  readonly workspaceIds: readonly string[];
  readonly documentIds: readonly string[];
}

export interface AuthorizationAdapter {
  check(input: AuthorizationCheck): Promise<boolean>;
  listAuthorizedScope(principal: Principal, relation: Relation): Promise<AuthorizationScope>;
}

export const AUTHORIZATION_ADAPTER = Symbol('AUTHORIZATION_ADAPTER');
