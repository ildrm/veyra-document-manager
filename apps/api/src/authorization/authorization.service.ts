import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import type { Principal } from '../auth/auth.types.js';
import {
  AUTHORIZATION_ADAPTER,
  type AuthorizationAdapter,
  type AuthorizationScope,
  type Relation,
  type ResourceType,
} from './authorization.types.js';

@Injectable()
export class AuthorizationService {
  public constructor(
    @Inject(AUTHORIZATION_ADAPTER) private readonly adapter: AuthorizationAdapter,
  ) {}

  public async require(
    principal: Principal,
    resourceType: ResourceType,
    resourceId: string,
    relation: Relation,
  ): Promise<void> {
    const allowed = await this.adapter.check({ principal, resourceType, resourceId, relation });
    if (!allowed)
      throw new ForbiddenException('You do not have permission to access this resource');
  }

  /** Resolve the complete authorized retrieval scope before any content query executes. */
  public async retrievalScope(
    principal: Principal,
    relation: Relation = 'can_view',
  ): Promise<AuthorizationScope> {
    return this.adapter.listAuthorizedScope(principal, relation);
  }
}
