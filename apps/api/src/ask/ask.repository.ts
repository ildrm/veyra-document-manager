import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

import type { Principal } from '../auth/auth.types.js';
import type { AuthorizationScope } from '../authorization/authorization.types.js';
import { currentCorrelationId } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import type { AskCitation, AskRequest } from './ask.schemas.js';
import type { AuthorizedEvidence } from './grounded-ai.client.js';

interface EvidenceRow {
  readonly chunk_id: string;
  readonly document_id: string;
  readonly document_version_id: string;
  readonly document_title: string;
  readonly version_label: string;
  readonly page_id: string;
  readonly page_number: number;
  readonly section: string | null;
  readonly content: string;
  readonly start_offset: number;
  readonly status: string;
  readonly customer: string | null;
}

export interface PersistAnswerInput {
  readonly conversationId: string;
  readonly userMessageId: string;
  readonly assistantMessageId: string;
  readonly principal: Principal;
  readonly request: AskRequest;
  readonly answer: string;
  readonly sufficientEvidence: boolean;
  readonly conflictingEvidence: boolean;
  readonly provider: string;
  readonly latencyMs: number;
  readonly citations: readonly (AskCitation & {
    readonly pageId: string;
    readonly chunkId: string;
  })[];
  readonly authorizationDecisionId: string;
  readonly searchedDocumentCount: number;
}

@Injectable()
export class AskRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async retrieveEvidence(
    principal: Principal,
    scope: AuthorizationScope,
    request: AskRequest,
    authorizationDecisionId: string,
  ): Promise<AuthorizedEvidence[]> {
    if (scope.workspaceIds.length === 0 && scope.documentIds.length === 0) return [];

    return this.database.withTenant(principal.organizationId, async (client) => {
      const values: unknown[] = [
        principal.organizationId,
        request.question,
        [...scope.workspaceIds],
        [...scope.documentIds],
      ];
      const filters = [
        'd.organization_id = $1',
        'd.deleted_at IS NULL',
        "d.processing_state = 'ready'",
        '(d.workspace_id = ANY($3::uuid[]) OR d.id = ANY($4::uuid[]))',
        'ch.search_vector @@ q.query',
      ];
      if (request.workspaceId) {
        values.push(request.workspaceId);
        filters.push(`d.workspace_id = $${values.length}`);
      }
      if (request.documentIds) {
        values.push(request.documentIds);
        filters.push(`d.id = ANY($${values.length}::uuid[])`);
      }

      const result = await client.query<EvidenceRow>(
        `WITH q AS (SELECT websearch_to_tsquery('english', $2) AS query)
         SELECT ch.id AS chunk_id, d.id AS document_id, v.id AS document_version_id,
                d.name AS document_title, v.version_label, p.id AS page_id, p.page_number,
                ch.section, ch.content, ch.page_start_offset AS start_offset, d.status, d.customer
         FROM q, documents d
         JOIN document_versions v
           ON v.organization_id = d.organization_id AND v.id = d.current_version_id
         JOIN document_chunks ch
           ON ch.organization_id = v.organization_id AND ch.document_version_id = v.id
         JOIN document_pages p ON p.organization_id = ch.organization_id AND p.id = ch.page_id
         WHERE ${filters.join(' AND ')}
         ORDER BY ts_rank_cd(ch.search_vector, q.query, 32) DESC,
                  d.updated_at DESC, ch.ordinal ASC
         LIMIT 12`,
        values,
      );

      return result.rows.map((row) => ({
        chunkId: row.chunk_id,
        documentId: row.document_id,
        documentVersionId: row.document_version_id,
        documentTitle: row.document_title,
        versionLabel: row.version_label,
        pageId: row.page_id,
        pageNumber: row.page_number,
        section: row.section,
        text: row.content,
        startOffset: row.start_offset,
        endOffset: row.start_offset + codePointLength(row.content),
        authority: row.status === 'verified' && row.customer ? 'signed_contract' : 'reviewed',
        authorizationDecisionId,
      }));
    });
  }

  public async persistAnswer(input: PersistAnswerInput): Promise<void> {
    await this.database.withTenant(input.principal.organizationId, async (client) => {
      await client.query(
        `INSERT INTO ai_conversations (id, organization_id, user_id, workspace_id, title)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          input.conversationId,
          input.principal.organizationId,
          input.principal.userId,
          input.request.workspaceId ?? null,
          input.request.question.slice(0, 160),
        ],
      );
      await client.query(
        `INSERT INTO ai_messages (id, organization_id, conversation_id, role, content)
         VALUES ($1, $2, $3, 'user', $4)`,
        [
          input.userMessageId,
          input.principal.organizationId,
          input.conversationId,
          input.request.question,
        ],
      );
      await client.query(
        `INSERT INTO ai_messages (
           id, organization_id, conversation_id, role, content, sufficient_evidence,
           conflicting_evidence, provider, latency_ms
         ) VALUES ($1, $2, $3, 'assistant', $4, $5, $6, $7, $8)`,
        [
          input.assistantMessageId,
          input.principal.organizationId,
          input.conversationId,
          input.answer,
          input.sufficientEvidence,
          input.conflictingEvidence,
          input.provider,
          input.latencyMs,
        ],
      );
      for (const citation of input.citations) {
        await client.query(
          `INSERT INTO ai_citations (
             id, organization_id, message_id, document_id, document_version_id, page_id,
             chunk_id, quote, page_start_offset, page_end_offset, confidence,
             verification_status, match_type
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                     'machine_extracted', 'hybrid')`,
          [
            citation.id,
            input.principal.organizationId,
            input.assistantMessageId,
            citation.documentId,
            citation.documentVersionId,
            citation.pageId,
            citation.chunkId,
            citation.quote,
            citation.startOffset,
            citation.endOffset,
            citation.confidence,
          ],
        );
      }
      await client.query(
        `INSERT INTO audit_events (
           id, organization_id, actor_user_id, event_type, resource_type, resource_id,
           correlation_id, payload
         ) VALUES ($1, $2, $3, 'ai.answer.created', 'ai_conversation', $4, $5, $6::jsonb)`,
        [
          randomUUID(),
          input.principal.organizationId,
          input.principal.userId,
          input.conversationId,
          currentCorrelationId(),
          JSON.stringify({
            authorizationDecisionId: input.authorizationDecisionId,
            searchedDocumentCount: input.searchedDocumentCount,
            citationCount: input.citations.length,
            sufficientEvidence: input.sufficientEvidence,
          }),
        ],
      );
    });
  }
}

function codePointLength(value: string): number {
  return Array.from(value).length;
}
