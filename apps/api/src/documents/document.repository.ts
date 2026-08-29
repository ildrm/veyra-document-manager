import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

import type { Principal } from '../auth/auth.types.js';
import type { AuthorizationScope } from '../authorization/authorization.types.js';
import { currentCorrelationId } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import type {
  CursorPage,
  DocumentDetail,
  DocumentSummary,
  EvidenceCitation,
  ListDocumentsQuery,
} from './document.schemas.js';

interface DocumentRow {
  readonly id: string;
  readonly organization_id: string;
  readonly workspace_id: string;
  readonly name: string;
  readonly media_type: string;
  readonly status: DocumentSummary['status'];
  readonly processing_state: DocumentSummary['processingState'];
  readonly processing_progress: number;
  readonly version_label: string;
  readonly owner_id: string;
  readonly owner_name: string;
  readonly updated_at: Date;
  readonly renewal_at: Date | null;
  readonly classification: DocumentSummary['classification'];
  readonly page_count: number | null;
  readonly current_version_id: string;
  readonly extracted_text: string | null;
  readonly customer: string | null;
  readonly project: string | null;
  readonly summary: string | null;
}

interface CitationRow {
  readonly id: string;
  readonly document_id: string;
  readonly document_version_id: string;
  readonly document_name: string;
  readonly version_label: string;
  readonly page_number: number;
  readonly section: string | null;
  readonly quote: string;
  readonly page_start_offset: number;
  readonly page_end_offset: number;
  readonly confidence: number;
  readonly verification_status: EvidenceCitation['verificationStatus'];
  readonly match_type: EvidenceCitation['matchType'];
}

export interface CreateUploadInput {
  readonly documentId: string;
  readonly versionId: string;
  readonly storageObjectId: string;
  readonly processingJobId: string;
  readonly outboxEventId: string;
  readonly workspaceId: string;
  readonly filename: string;
  readonly mediaType: string;
  readonly classification: DocumentSummary['classification'];
  readonly bucket: string;
  readonly objectKey: string;
  readonly byteSize: number;
  readonly sha256: string;
}

export interface UploadReceipt {
  readonly documentId: string;
  readonly versionId: string;
  readonly processingJobId: string;
  readonly processingState: 'queued';
}

@Injectable()
export class DocumentRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async list(
    principal: Principal,
    scope: AuthorizationScope,
    query: ListDocumentsQuery,
  ): Promise<CursorPage<DocumentSummary>> {
    if (scope.workspaceIds.length === 0 && scope.documentIds.length === 0) {
      return { items: [], nextCursor: null };
    }
    const cursor = decodeCursor(query.cursor);

    return this.database.withTenant(principal.organizationId, async (client) => {
      const values: unknown[] = [
        principal.organizationId,
        [...scope.workspaceIds],
        [...scope.documentIds],
      ];
      const conditions = [
        'd.organization_id = $1',
        'd.deleted_at IS NULL',
        '(d.workspace_id = ANY($2::uuid[]) OR d.id = ANY($3::uuid[]))',
      ];
      if (query.workspaceId) {
        values.push(query.workspaceId);
        conditions.push(`d.workspace_id = $${values.length}`);
      }
      if (query.status) {
        values.push(query.status);
        conditions.push(`d.status = $${values.length}`);
      }
      if (cursor) {
        values.push(cursor.updatedAt, cursor.id);
        conditions.push(
          `(d.updated_at, d.id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`,
        );
      }
      values.push(query.limit + 1);

      const result = await client.query<DocumentRow>(
        `SELECT d.id, d.organization_id, d.workspace_id, d.name, d.media_type, d.status,
                d.processing_state, d.processing_progress, d.classification, d.renewal_at,
                d.updated_at, d.current_version_id, d.customer, d.project, d.summary,
                u.id AS owner_id, u.display_name AS owner_name,
                v.version_label, v.page_count, v.extracted_text
         FROM documents d
         JOIN users u ON u.organization_id = d.organization_id AND u.id = d.owner_id
         JOIN document_versions v
           ON v.organization_id = d.organization_id AND v.id = d.current_version_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY d.updated_at DESC, d.id DESC
         LIMIT $${values.length}`,
        values,
      );
      const hasMore = result.rows.length > query.limit;
      const rows = result.rows.slice(0, query.limit);
      const last = rows.at(-1);
      return {
        items: rows.map(mapSummary),
        nextCursor:
          hasMore && last
            ? encodeCursor({ updatedAt: last.updated_at.toISOString(), id: last.id })
            : null,
      };
    });
  }

  public async detail(organizationId: string, documentId: string): Promise<DocumentDetail | null> {
    return this.database.withTenant(organizationId, async (client) => {
      const result = await client.query<DocumentRow>(
        `SELECT d.id, d.organization_id, d.workspace_id, d.name, d.media_type, d.status,
                d.processing_state, d.processing_progress, d.classification, d.renewal_at,
                d.updated_at, d.current_version_id, d.customer, d.project, d.summary,
                u.id AS owner_id, u.display_name AS owner_name,
                v.version_label, v.page_count, v.extracted_text
         FROM documents d
         JOIN users u ON u.organization_id = d.organization_id AND u.id = d.owner_id
         JOIN document_versions v
           ON v.organization_id = d.organization_id AND v.id = d.current_version_id
         WHERE d.organization_id = $1 AND d.id = $2 AND d.deleted_at IS NULL`,
        [organizationId, documentId],
      );
      const row = result.rows[0];
      if (!row) return null;

      const citations = await client.query<CitationRow>(
        `SELECT c.id, c.document_id, c.document_version_id, d.name AS document_name,
                v.version_label, p.page_number, ch.section, c.quote, c.page_start_offset,
                c.page_end_offset, c.confidence, c.verification_status, c.match_type
         FROM ai_citations c
         JOIN documents d ON d.organization_id = c.organization_id AND d.id = c.document_id
         JOIN document_versions v
           ON v.organization_id = c.organization_id AND v.id = c.document_version_id
         JOIN document_pages p ON p.organization_id = c.organization_id AND p.id = c.page_id
         JOIN document_chunks ch ON ch.organization_id = c.organization_id AND ch.id = c.chunk_id
         WHERE c.organization_id = $1 AND c.document_id = $2
         ORDER BY c.created_at DESC
         LIMIT 25`,
        [organizationId, documentId],
      );
      return {
        ...mapSummary(row),
        pageCount: row.page_count ?? 0,
        currentVersionId: row.current_version_id,
        extractedText: row.extracted_text ?? '',
        customer: row.customer,
        project: row.project,
        summary: row.summary,
        citations: citations.rows.map(mapCitation),
      };
    });
  }

  public async createUpload(
    principal: Principal,
    input: CreateUploadInput,
  ): Promise<UploadReceipt> {
    return this.database.withTenant(principal.organizationId, async (client) => {
      await client.query(
        `INSERT INTO storage_objects (
           id, organization_id, bucket, object_key, state, media_type, byte_size, sha256
         ) VALUES ($1, $2, $3, $4, 'quarantined', $5, $6, $7)`,
        [
          input.storageObjectId,
          principal.organizationId,
          input.bucket,
          input.objectKey,
          input.mediaType,
          input.byteSize,
          input.sha256,
        ],
      );
      await client.query(
        `INSERT INTO documents (
           id, organization_id, workspace_id, owner_id, name, media_type, classification
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          input.documentId,
          principal.organizationId,
          input.workspaceId,
          principal.userId,
          input.filename,
          input.mediaType,
          input.classification,
        ],
      );
      await client.query(
        `INSERT INTO document_versions (
           id, organization_id, document_id, storage_object_id, version_number, version_label,
           original_filename, media_type, byte_size, sha256, created_by
         ) VALUES ($1, $2, $3, $4, 1, 'v1.0', $5, $6, $7, $8, $9)`,
        [
          input.versionId,
          principal.organizationId,
          input.documentId,
          input.storageObjectId,
          input.filename,
          input.mediaType,
          input.byteSize,
          input.sha256,
          principal.userId,
        ],
      );
      await client.query('UPDATE documents SET current_version_id = $1 WHERE id = $2', [
        input.versionId,
        input.documentId,
      ]);
      await client.query(
        `INSERT INTO processing_jobs (
           id, organization_id, document_id, document_version_id
         ) VALUES ($1, $2, $3, $4)`,
        [input.processingJobId, principal.organizationId, input.documentId, input.versionId],
      );
      await client.query(
        `INSERT INTO outbox_events (
           id, organization_id, aggregate_type, aggregate_id, event_type, payload
         ) VALUES ($1, $2, 'document', $3, 'document.uploaded', $4::jsonb)`,
        [
          input.outboxEventId,
          principal.organizationId,
          input.documentId,
          JSON.stringify({
            documentId: input.documentId,
            documentVersionId: input.versionId,
            processingJobId: input.processingJobId,
            storageObjectId: input.storageObjectId,
            bucket: input.bucket,
            objectKey: input.objectKey,
            mediaType: input.mediaType,
            sha256: input.sha256,
            correlationId: currentCorrelationId(),
          }),
        ],
      );
      await client.query(
        `INSERT INTO audit_events (
           id, organization_id, actor_user_id, event_type, resource_type, resource_id,
           correlation_id, payload
         ) VALUES ($1, $2, $3, 'document.uploaded', 'document', $4, $5, $6::jsonb)`,
        [
          randomUUID(),
          principal.organizationId,
          principal.userId,
          input.documentId,
          currentCorrelationId(),
          JSON.stringify({ versionId: input.versionId, sha256: input.sha256 }),
        ],
      );
      return {
        documentId: input.documentId,
        versionId: input.versionId,
        processingJobId: input.processingJobId,
        processingState: 'queued',
      };
    });
  }

  public async trustedDownload(
    organizationId: string,
    documentId: string,
  ): Promise<{ readonly objectKey: string; readonly filename: string } | null> {
    return this.database.withTenant(organizationId, async (client) => {
      const result = await client.query<{
        readonly object_key: string;
        readonly original_filename: string;
      }>(
        `SELECT s.object_key, v.original_filename
         FROM documents d
         JOIN document_versions v
           ON v.organization_id = d.organization_id AND v.id = d.current_version_id
         JOIN storage_objects s
           ON s.organization_id = v.organization_id AND s.id = v.storage_object_id
         WHERE d.organization_id = $1 AND d.id = $2 AND d.deleted_at IS NULL
           AND s.state = 'trusted' AND s.scan_status = 'clean'`,
        [organizationId, documentId],
      );
      const row = result.rows[0];
      return row ? { objectKey: row.object_key, filename: row.original_filename } : null;
    });
  }
}

function mapSummary(row: DocumentRow): DocumentSummary {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    name: row.name,
    mimeType: row.media_type,
    status: row.status,
    processingState: row.processing_state,
    processingProgress: row.processing_progress,
    versionLabel: row.version_label,
    owner: { id: row.owner_id, name: row.owner_name },
    updatedAt: row.updated_at.toISOString(),
    renewalAt: row.renewal_at?.toISOString() ?? null,
    classification: row.classification,
    favorite: false,
  };
}

function mapCitation(row: CitationRow): EvidenceCitation {
  return {
    id: row.id,
    documentId: row.document_id,
    documentVersionId: row.document_version_id,
    documentName: row.document_name,
    versionLabel: row.version_label,
    pageNumber: row.page_number,
    section: row.section,
    quote: row.quote,
    startOffset: row.page_start_offset,
    endOffset: row.page_end_offset,
    confidence: row.confidence,
    verificationStatus: row.verification_status,
    matchType: row.match_type,
  };
}
