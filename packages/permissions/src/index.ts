export const documentRelations = [
  'can_view',
  'can_comment',
  'can_edit',
  'can_manage',
  'can_share',
  'can_approve',
] as const;

export type DocumentRelation = (typeof documentRelations)[number];
export type ResourceType = 'organization' | 'workspace' | 'folder' | 'document';

export interface PermissionCheck {
  userId: string;
  organizationId: string;
  resourceType: ResourceType;
  resourceId: string;
  relation: DocumentRelation;
}

export interface AuthorizationAdapter {
  check(input: PermissionCheck): Promise<boolean>;
  filterAuthorized(
    checks: readonly Omit<PermissionCheck, 'relation'>[],
    relation: DocumentRelation,
  ): Promise<Set<string>>;
}

export const navigationRequirements = {
  home: null,
  ask: 'can_view',
  search: 'can_view',
  library: 'can_view',
  knowledge: 'can_view',
  workflows: 'can_edit',
  administration: 'can_manage',
} as const satisfies Record<string, DocumentRelation | null>;
