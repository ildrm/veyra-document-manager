import { HttpStatus, Injectable } from '@nestjs/common';
import { z } from 'zod';

import type { Principal } from '../auth/auth.types.js';
import type { AuthorizationScope } from '../authorization/authorization.types.js';
import { ApiException } from '../common/api-error.js';
import { DatabaseService } from '../database/database.service.js';
import type { SearchPage, SearchRequest, SearchResult } from './search.schemas.js';

const SearchCursorSchema = z.object({ score: z.number().min(0), id: z.uuid() });

interface SearchRow {
  readonly id: string;
  readonly organization_id: string;
  readonly workspace_id: string;
  readonly name: string;
  readonly media_type: string;
  readonly status: SearchResult['document']['status'];
  readonly processing_state: string;
  readonly processing_progress: number;
  readonly version_label: string;
  readonly owner_id: string;
  readonly owner_name: string;
  readonly updated_at: Date;
  readonly renewal_at: Date | null;
  readonly classification: SearchResult['document']['classification'];
  readonly score: number;
  readonly snippet: string;
  readonly page_number: number;
  readonly section: string | null;
}

@Injectable()
export class SearchRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async search(
    principal: Principal,
    scope: AuthorizationScope,
    request: SearchRequest,
  ): Promise<SearchPage> {
    if (scope.workspaceIds.length === 0 && scope.documentIds.length === 0) {
      return { items: [], nextCursor: null };
    }
    const cursor = decodeSearchCursor(request.cursor);

    return this.database.withTenant(principal.organizationId, async (client) => {
      const values: unknown[] = [
        principal.organizationId,
        request.query,
        [...scope.workspaceIds],
        [...scope.documentIds],
      ];
      const filters = [
        'd.organization_id = $1',
        'd.deleted_at IS NULL',
        "d.processing_state = 'ready'",
        '(d.workspace_id = ANY($3::uuid[]) OR d.id = ANY($4::uuid[]))',
        '(ch.search_vector @@ q.query OR d.search_vector @@ q.query)',
      ];
      if (request.workspaceId) {
        values.push(request.workspaceId);
        filters.push(`d.workspace_id = $${values.length}`);
      }
      if (request.status) {
        values.push(request.status);
        filters.push(`d.status = $${values.length}`);
      }
      if (request.customer) {
        values.push(request.customer);
        filters.push(`d.customer ILIKE '%' || $${values.length} || '%'`);
      }
      let cursorFilter = '';
      if (cursor) {
        values.push(cursor.score, cursor.id);
        cursorFilter = `WHERE (m.score, m.id) < ($${values.length - 1}::real, $${values.length}::uuid)`;
      }
      values.push(request.limit + 1);

      const result = await client.query<SearchRow>(
        `WITH q AS (SELECT websearch_to_tsquery('english', $2) AS query),
         ranked AS (
           SELECT DISTINCT ON (d.id)
             d.id, d.organization_id, d.workspace_id, d.name, d.media_type, d.status,
             d.processing_state, d.processing_progress, d.classification, d.renewal_at,
             d.updated_at, v.version_label, u.id AS owner_id, u.display_name AS owner_name,
             p.page_number, ch.section,
             (ts_rank_cd(ch.search_vector, q.query, 32) * 0.8 +
              ts_rank_cd(d.search_vector, q.query, 32) * 0.2)::real AS raw_score,
             ts_headline(
               'english', ch.content, q.query,
               'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=12, ShortWord=3'
             ) AS snippet
           FROM q, documents d
           JOIN document_versions v
             ON v.organization_id = d.organization_id AND v.id = d.current_version_id
           JOIN document_chunks ch
             ON ch.organization_id = v.organization_id AND ch.document_version_id = v.id
           JOIN document_pages p ON p.organization_id = ch.organization_id AND p.id = ch.page_id
           JOIN users u ON u.organization_id = d.organization_id AND u.id = d.owner_id
           WHERE ${filters.join(' AND ')}
           ORDER BY d.id, raw_score DESC, ch.ordinal ASC
         ),
         m AS (
           SELECT ranked.*, (raw_score / (1.0 + raw_score))::real AS score FROM ranked
         )
         SELECT * FROM m
         ${cursorFilter}
         ORDER BY score DESC, id DESC
         LIMIT $${values.length}`,
        values,
      );

      const hasMore = result.rows.length > request.limit;
      const rows = result.rows.slice(0, request.limit);
      const terms = matchedTerms(request.query);
      const items = rows.map((row): SearchResult => ({
        document: {
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
        },
        score: row.score,
        snippet: row.snippet,
        pageNumber: row.page_number,
        section: row.section,
        matchedTerms: terms,
        authorizationReason: 'OpenFGA scope + PostgreSQL tenant RLS',
      }));
      const last = rows.at(-1);
      return {
        items,
        nextCursor:
          hasMore && last
            ? Buffer.from(JSON.stringify({ score: last.score, id: last.id }), 'utf8').toString(
                'base64url',
              )
            : null,
      };
    });
  }
}

function decodeSearchCursor(
  cursor: string | undefined,
): z.infer<typeof SearchCursorSchema> | undefined {
  if (!cursor) return undefined;
  try {
    return SearchCursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
  } catch {
    throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_CURSOR', 'Search cursor is invalid');
  }
}

function matchedTerms(query: string): string[] {
  return [...new Set(query.toLocaleLowerCase().match(/[\p{L}\p{N}.%_-]+/gu) ?? [])].slice(0, 20);
}
