import { Injectable } from '@nestjs/common';

import type { Principal } from '../auth/auth.types.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { SearchRepository } from './search.repository.js';
import type { SearchPage, SearchRequest } from './search.schemas.js';

@Injectable()
export class SearchService {
  public constructor(
    private readonly authorization: AuthorizationService,
    private readonly repository: SearchRepository,
  ) {}

  public async search(principal: Principal, request: SearchRequest): Promise<SearchPage> {
    // This network/database authorization resolution completes before PostgreSQL sees the query text.
    const scope = await this.authorization.retrievalScope(principal, 'can_view');
    return this.repository.search(principal, scope, request);
  }
}
