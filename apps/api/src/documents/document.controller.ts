import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/auth.types.js';
import { ApiException } from '../common/api-error.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { DocumentService } from './document.service.js';
import {
  ListDocumentsQuerySchema,
  type CursorPage,
  type DocumentDetail,
  type DocumentSummary,
  type ListDocumentsQuery,
} from './document.schemas.js';
import type { UploadReceipt } from './document.repository.js';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('/v1/documents')
export class DocumentController {
  public constructor(private readonly documents: DocumentService) {}

  @Get()
  @ApiOkResponse({ description: 'A permission-filtered cursor page of documents' })
  public list(
    @CurrentPrincipal() principal: Principal,
    @Query(new ZodPipe(ListDocumentsQuerySchema)) query: ListDocumentsQuery,
  ): Promise<CursorPage<DocumentSummary>> {
    return this.documents.list(principal, query);
  }

  @Get(':documentId')
  @ApiOkResponse({ description: 'Document detail with evidence citations' })
  public detail(
    @CurrentPrincipal() principal: Principal,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ): Promise<DocumentDetail> {
    return this.documents.detail(principal, documentId);
  }

  @Post('upload')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiConsumes('multipart/form-data')
  @ApiAcceptedResponse({ description: 'Quarantined upload accepted for asynchronous processing' })
  public async upload(
    @CurrentPrincipal() principal: Principal,
    @Req() request: FastifyRequest,
  ): Promise<UploadReceipt> {
    const file = await request.file();
    if (!file) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'FILE_REQUIRED',
        'A multipart file is required',
      );
    }
    return this.documents.upload(principal, file);
  }

  @Get(':documentId/download')
  public download(
    @CurrentPrincipal() principal: Principal,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ): Promise<{ readonly url: string; readonly expiresInSeconds: 60 }> {
    return this.documents.download(principal, documentId);
  }
}
