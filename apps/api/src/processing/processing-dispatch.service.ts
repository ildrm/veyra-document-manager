import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { AppConfigService } from '../config/config.module.js';
import { STORAGE_ADAPTER, type StorageAdapter } from '../storage/storage.types.js';
import {
  AiProcessingClient,
  type ExtractionResponse,
  type IngestionDispatch,
} from './ai-processing.client.js';

interface OutboxRow {
  readonly id: string;
  readonly payload: IngestionDispatch;
  readonly attempt: number;
}

@Injectable()
export class ProcessingDispatchService {
  private readonly logger = new Logger(ProcessingDispatchService.name);

  public constructor(
    private readonly database: DatabaseService,
    private readonly client: AiProcessingClient,
    private readonly config: AppConfigService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  /** Best-effort immediate dispatch. The durable outbox remains pending for an external worker on failure. */
  public async dispatch(organizationId: string, eventId: string): Promise<boolean> {
    const event = await this.database.withTenant(organizationId, async (client) => {
      const result = await client.query<OutboxRow>(
        `SELECT id, payload, attempt
         FROM outbox_events
         WHERE organization_id = $1 AND id = $2 AND processed_at IS NULL`,
        [organizationId, eventId],
      );
      return result.rows[0];
    });
    if (!event) return true;

    try {
      const content = await this.storage.readQuarantined(
        event.payload.objectKey,
        this.config.values.MAX_UPLOAD_BYTES,
      );
      const extraction = await this.client.extract(event.payload, content);
      await this.persistExtraction(organizationId, event.payload, extraction);
      await this.database.withTenant(organizationId, async (client) => {
        await client.query(
          `UPDATE outbox_events SET processed_at = now(), attempt = attempt + 1, last_error = NULL
           WHERE organization_id = $1 AND id = $2 AND processed_at IS NULL`,
          [organizationId, eventId],
        );
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 2_000) : 'Unknown dispatch error';
      await this.database.withTenant(organizationId, async (client) => {
        await client.query(
          `UPDATE outbox_events
           SET attempt = attempt + 1,
               last_error = $3,
               available_at = now() + LEAST(interval '15 minutes', interval '5 seconds' * power(2, LEAST(attempt, 8)))
           WHERE organization_id = $1 AND id = $2 AND processed_at IS NULL`,
          [organizationId, eventId, message],
        );
      });
      this.logger.warn({ event: 'processing.dispatch.failed', organizationId, eventId, message });
      return false;
    }
  }

  private async persistExtraction(
    organizationId: string,
    dispatch: IngestionDispatch,
    extraction: ExtractionResponse,
  ): Promise<void> {
    await this.database.withTenant(organizationId, async (client) => {
      await client.query(
        'DELETE FROM document_chunks WHERE organization_id = $1 AND document_version_id = $2',
        [organizationId, dispatch.documentVersionId],
      );
      await client.query(
        'DELETE FROM document_pages WHERE organization_id = $1 AND document_version_id = $2',
        [organizationId, dispatch.documentVersionId],
      );
      const pageIds = new Map<number, string>();
      for (const page of extraction.pages) {
        const pageId = randomUUID();
        pageIds.set(page.page_number, pageId);
        await client.query(
          `INSERT INTO document_pages (
             id, organization_id, document_id, document_version_id, page_number,
             text_content, layout
           ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
          [
            pageId,
            organizationId,
            dispatch.documentId,
            dispatch.documentVersionId,
            page.page_number,
            page.text,
            JSON.stringify({
              normalizedStartOffset: page.start_offset,
              normalizedEndOffset: page.end_offset,
            }),
          ],
        );
      }
      for (const [ordinal, chunk] of extraction.chunks.entries()) {
        const pageNumber = chunk.page_numbers[0];
        const pageId = pageNumber === undefined ? undefined : pageIds.get(pageNumber);
        if (!pageId) throw new Error('Extraction chunk references a missing page');
        await client.query(
          `INSERT INTO document_chunks (
             id, organization_id, document_id, document_version_id, page_id, ordinal,
             content, page_start_offset, page_end_offset
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            randomUUID(),
            organizationId,
            dispatch.documentId,
            dispatch.documentVersionId,
            pageId,
            ordinal,
            chunk.text,
            chunk.start_offset,
            chunk.end_offset,
          ],
        );
      }
      await client.query(
        `UPDATE document_versions
         SET page_count = $3, extracted_text = $4, extraction_model = 'veyra-ai:1.0'
         WHERE organization_id = $1 AND id = $2`,
        [
          organizationId,
          dispatch.documentVersionId,
          extraction.document.page_count,
          extraction.normalized_text,
        ],
      );
      await client.query(
        `UPDATE documents
         SET processing_state = 'analyzing', processing_progress = 75,
             customer = COALESCE($3, customer), summary = COALESCE(summary, $4)
         WHERE organization_id = $1 AND id = $2`,
        [
          organizationId,
          dispatch.documentId,
          extraction.metadata.customer ?? null,
          extraction.metadata.title ?? null,
        ],
      );
      await client.query(
        `UPDATE processing_jobs
         SET state = 'running', stage = 'awaiting_malware_scan', progress = 75,
             started_at = COALESCE(started_at, now())
         WHERE organization_id = $1 AND id = $2`,
        [organizationId, dispatch.processingJobId],
      );
    });
  }
}
