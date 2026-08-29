import { Module } from '@nestjs/common';

import { SearchController } from './search.controller.js';
import { SearchRepository } from './search.repository.js';
import { SearchService } from './search.service.js';

@Module({
  controllers: [SearchController],
  providers: [SearchRepository, SearchService],
  exports: [SearchService, SearchRepository],
})
export class SearchModule {}
