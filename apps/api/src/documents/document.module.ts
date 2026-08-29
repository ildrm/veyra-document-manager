import { Module } from '@nestjs/common';

import { ProcessingModule } from '../processing/processing.module.js';
import { DocumentController } from './document.controller.js';
import { DocumentRepository } from './document.repository.js';
import { DocumentService } from './document.service.js';

@Module({
  imports: [ProcessingModule],
  controllers: [DocumentController],
  providers: [DocumentRepository, DocumentService],
  exports: [DocumentRepository, DocumentService],
})
export class DocumentModule {}
