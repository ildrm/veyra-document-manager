import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/auth.types.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { SearchService } from './search.service.js';
import { SearchRequestSchema, type SearchPage, type SearchRequest } from './search.schemas.js';

@ApiTags('search')
@ApiBearerAuth()
@Controller('/v1/search')
export class SearchController {
  public constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOkResponse({ description: 'Permission-aware PostgreSQL full-text results' })
  public search(
    @CurrentPrincipal() principal: Principal,
    @Query(new ZodPipe(SearchRequestSchema)) request: SearchRequest,
  ): Promise<SearchPage> {
    return this.searchService.search(principal, request);
  }
}
