import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { MultipartFile } from '@fastify/multipart';

import type { Principal } from '../auth/auth.types.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { AppConfigService } from '../config/config.module.js';
import { ProcessingDispatchService } from '../processing/processing-dispatch.service.js';
import { STORAGE_ADAPTER, type StorageAdapter } from '../storage/storage.types.js';
import { DocumentRepository, type UploadReceipt } from './document.repository.js';
import {
  UploadFieldsSchema,
  type CursorPage,
  type DocumentDetail,
  type DocumentSummary,
  type ListDocumentsQuery,
} from './document.schemas.js';
import { inspectUpload } from './upload-security.js';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  public constructor(
    private readonly config: AppConfigService,
    private readonly authorization: AuthorizationService,
    private readonly repository: DocumentRepository,
    private readonly dispatcher: ProcessingDispatchService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  public async list(
    principal: Principal,
    query: ListDocumentsQuery,
  ): Promise<CursorPage<DocumentSummary>> {
    const scope = await this.authorization.retrievalScope(principal, 'can_view');
    return this.repository.list(principal, scope, query);
  }

  public async detail(principal: Principal, documentId: string): Promise<DocumentDetail> {
    await this.authorization.require(principal, 'document', documentId, 'can_view');
    const document = await this.repository.detail(principal.organizationId, documentId);
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }

  public async upload(principal: Principal, file: MultipartFile): Promise<UploadReceipt> {
    const fields = UploadFieldsSchema.parse({
      workspaceId: multipartField(file.fields, 'workspaceId'),
      classification: multipartField(file.fields, 'classification') ?? 'internal',
    });
    await this.authorization.require(principal, 'workspace', fields.workspaceId, 'can_edit');

    const inspected = await inspectUpload(file, this.config.values.MAX_UPLOAD_BYTES);
    const documentId = randomUUID();
    const versionId = randomUUID();
    const storageObjectId = randomUUID();
    const processingJobId = randomUUID();
    const outboxEventId = randomUUID();
    const objectKey = `${principal.organizationId}/incoming/${storageObjectId}/${encodeURIComponent(
      inspected.safeFilename,
    )}`;

    let uploaded = false;
    try {
      const location = await this.storage.putQuarantine({
        organizationId: principal.organizationId,
        objectKey,
        mediaType: inspected.mediaType,
        body: inspected.body,
      });
      uploaded = true;
      const integrity = await inspected.completed;
      const receipt = await this.repository.createUpload(principal, {
        documentId,
        versionId,
        storageObjectId,
        processingJobId,
        outboxEventId,
        workspaceId: fields.workspaceId,
        filename: inspected.safeFilename,
        mediaType: inspected.mediaType,
        classification: fields.classification,
        bucket: location.bucket,
        objectKey: location.objectKey,
        byteSize: integrity.byteSize,
        sha256: integrity.sha256,
      });
      void this.dispatcher.dispatch(principal.organizationId, outboxEventId).catch((error) => {
        this.logger.warn({ event: 'processing.immediate-dispatch.failed', outboxEventId, error });
      });
      return receipt;
    } catch (error) {
      void inspected.completed.catch(() => undefined);
      if (uploaded) await this.storage.deleteQuarantined(objectKey).catch(() => undefined);
      throw error;
    }
  }

  public async download(
    principal: Principal,
    documentId: string,
  ): Promise<{ readonly url: string; readonly expiresInSeconds: 60 }> {
    await this.authorization.require(principal, 'document', documentId, 'can_view');
    const object = await this.repository.trustedDownload(principal.organizationId, documentId);
    if (!object) {
      throw new ConflictException('The document is not yet available from trusted storage');
    }
    return {
      url: await this.storage.createTrustedDownloadUrl(object.objectKey, object.filename),
      expiresInSeconds: 60,
    };
  }
}

function multipartField(fields: MultipartFile['fields'], key: string): string | undefined {
  const raw = (fields as Record<string, unknown>)[key];
  const item = Array.isArray(raw) ? raw[0] : raw;
  if (!item || typeof item !== 'object' || !('value' in item)) return undefined;
  const value = (item as { readonly value?: unknown }).value;
  return typeof value === 'string' ? value : undefined;
}
