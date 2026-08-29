import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../common/api-error.js';
import { currentCorrelationId } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { STORAGE_ADAPTER, type StorageAdapter } from '../storage/storage.types.js';
import type { ProcessingCallback, ProcessingEvent } from './processing.schemas.js';

interface SnapshotRow {
  readonly document_id: string;
  readonly processing_state: string;
  readonly processing_progress: number;
  readonly updated_at: Date;
  readonly last_error_message: string | null;
}

@Injectable()
export class ProcessingService {
  public constructor(
    private readonly database: DatabaseService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  public async applyCallback(callback: ProcessingCallback): Promise<void> {
    const target = await this.database.withTenant(callback.organizationId, async (client) => {
      const result = await client.query<{
        readonly storage_object_id: string;
        readonly object_key: string;
        readonly storage_state: string;
        readonly job_state: string;
        readonly progress: number;
      }>(
        `SELECT s.id AS storage_object_id, s.object_key, s.state AS storage_state,
                j.state AS job_state, j.progress
         FROM processing_jobs j
         JOIN document_versions v
           ON v.organization_id = j.organization_id AND v.id = j.document_version_id
         JOIN storage_objects s
           ON s.organization_id = v.organization_id AND s.id = v.storage_object_id
         WHERE j.organization_id = $1 AND j.id = $2 AND j.document_id = $3
           AND j.document_version_id = $4`,
        [callback.organizationId, callback.jobId, callback.documentId, callback.documentVersionId],
      );
      return result.rows[0];
    });
    if (!target) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'PROCESSING_JOB_NOT_FOUND',
        'The processing job and document identity do not match',
      );
    }
    if (target.job_state === 'succeeded' || target.job_state === 'failed') return;
    if (callback.progress < target.progress) return;

    let promoted:
      | { readonly storageObjectId: string; readonly bucket: string; readonly objectKey: string }
      | undefined;
    if (callback.state === 'ready') {
      if (callback.scanStatus !== 'clean') {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'CLEAN_SCAN_REQUIRED',
          'A document cannot become ready until malware scanning reports clean',
        );
      }
      if (target.storage_state !== 'trusted') {
        const targetKey = target.object_key.replace('/incoming/', '/trusted/');
        const location = await this.storage.promote(target.object_key, targetKey);
        promoted = { storageObjectId: target.storage_object_id, ...location };
      }
    }

    await this.database.withTenant(callback.organizationId, async (client) => {
      const terminal = callback.state === 'ready' || callback.state === 'failed';
      const jobState =
        callback.state === 'ready'
          ? 'succeeded'
          : callback.state === 'failed'
            ? 'failed'
            : 'running';
      const scanStatus = callback.scanStatus;
      if (scanStatus === 'infected') {
        await client.query(
          `UPDATE storage_objects s
           SET state = 'rejected', scan_status = 'infected'
           FROM document_versions v
           WHERE v.organization_id = $1 AND v.id = $2
             AND s.organization_id = v.organization_id AND s.id = v.storage_object_id`,
          [callback.organizationId, callback.documentVersionId],
        );
      } else if (scanStatus) {
        await client.query(
          `UPDATE storage_objects s SET scan_status = $3
           FROM document_versions v
           WHERE v.organization_id = $1 AND v.id = $2
             AND s.organization_id = v.organization_id AND s.id = v.storage_object_id`,
          [callback.organizationId, callback.documentVersionId, scanStatus],
        );
      }
      if (promoted) {
        await client.query(
          `UPDATE storage_objects
           SET bucket = $3, object_key = $4, state = 'trusted', scan_status = 'clean', trusted_at = now()
           WHERE organization_id = $1 AND id = $2`,
          [callback.organizationId, promoted.storageObjectId, promoted.bucket, promoted.objectKey],
        );
      }
      await client.query(
        `UPDATE processing_jobs
         SET state = $5, stage = $6, progress = $7,
             started_at = COALESCE(started_at, now()),
             completed_at = CASE WHEN $8 THEN now() ELSE NULL END,
             last_error_code = $9, last_error_message = $10
         WHERE organization_id = $1 AND id = $2 AND document_id = $3 AND document_version_id = $4`,
        [
          callback.organizationId,
          callback.jobId,
          callback.documentId,
          callback.documentVersionId,
          jobState,
          callback.state,
          callback.progress,
          terminal,
          callback.errorCode ?? null,
          callback.errorMessage ?? null,
        ],
      );
      await client.query(
        `UPDATE documents
         SET processing_state = $3, processing_progress = $4,
             status = CASE WHEN $3 = 'ready' THEN 'needs_review' WHEN $3 = 'failed' THEN 'needs_review' ELSE 'processing' END
         WHERE organization_id = $1 AND id = $2 AND current_version_id = $5`,
        [
          callback.organizationId,
          callback.documentId,
          callback.state,
          callback.progress,
          callback.documentVersionId,
        ],
      );
      await client.query(
        `INSERT INTO audit_events (
           id, organization_id, event_type, resource_type, resource_id, correlation_id, payload
         ) VALUES ($1, $2, 'document.processing.updated', 'document', $3, $4, $5::jsonb)`,
        [
          randomUUID(),
          callback.organizationId,
          callback.documentId,
          currentCorrelationId(),
          JSON.stringify({
            state: callback.state,
            progress: callback.progress,
            message: callback.message,
            errorCode: callback.errorCode,
          }),
        ],
      );
    });
  }

  public async snapshot(
    organizationId: string,
    documentId: string,
  ): Promise<ProcessingEvent | null> {
    return this.database.withTenant(organizationId, async (client) => {
      const result = await client.query<SnapshotRow>(
        `SELECT d.id AS document_id, d.processing_state, d.processing_progress, d.updated_at,
                j.last_error_message
         FROM documents d
         LEFT JOIN processing_jobs j
           ON j.organization_id = d.organization_id
          AND j.document_id = d.id
          AND j.document_version_id = d.current_version_id
         WHERE d.organization_id = $1 AND d.id = $2 AND d.deleted_at IS NULL
         ORDER BY j.created_at DESC NULLS LAST
         LIMIT 1`,
        [organizationId, documentId],
      );
      const row = result.rows[0];
      return row
        ? {
            documentId: row.document_id,
            state: row.processing_state,
            progress: row.processing_progress,
            message: row.last_error_message ?? processingMessage(row.processing_state),
            occurredAt: row.updated_at.toISOString(),
          }
        : null;
    });
  }
}

function processingMessage(state: string): string {
  return (
    {
      queued: 'Waiting for secure processing',
      scanning: 'Scanning for malware',
      extracting: 'Extracting document structure',
      analyzing: 'Analyzing entities and claims',
      indexing: 'Building the search index',
      ready: 'Processing complete',
      failed: 'Processing failed',
    }[state] ?? 'Processing'
  );
}
