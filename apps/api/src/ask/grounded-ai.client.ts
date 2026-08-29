import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { AppConfigService } from '../config/config.module.js';
import { currentCorrelationId } from '../common/request-context.js';

export interface AuthorizedEvidence {
  readonly chunkId: string;
  readonly documentId: string;
  readonly documentVersionId: string;
  readonly documentTitle: string;
  readonly versionLabel: string;
  readonly pageId: string;
  readonly pageNumber: number;
  readonly section: string | null;
  readonly text: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly authority:
    | 'unknown'
    | 'draft'
    | 'published'
    | 'reviewed'
    | 'approved_policy'
    | 'signed_contract'
    | 'regulated_record';
  readonly authorizationDecisionId: string;
}

const GroundedCitationSchema = z.object({
  chunk_id: z.string(),
  document_id: z.string(),
  document_version_id: z.string(),
  document_title: z.string(),
  page_number: z.number().int().positive(),
  section: z.string().nullable().optional(),
  start_offset: z.number().int().nonnegative(),
  end_offset: z.number().int().positive(),
  quote: z.string().min(1),
});

const GroundedAnswerSchema = z.object({
  schema_version: z.literal('1.0'),
  correlation_id: z.string(),
  status: z.enum(['answered', 'insufficient_evidence']),
  answer: z.string(),
  confidence: z.number().min(0).max(1),
  conflict: z.boolean(),
  citations: z.array(GroundedCitationSchema),
  conflicting_claims: z.array(z.unknown()).default([]),
  provider: z.string(),
});

export type GroundedAnswer = z.infer<typeof GroundedAnswerSchema>;
export type GroundedCitation = z.infer<typeof GroundedCitationSchema>;

@Injectable()
export class GroundedAiClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeout: number;

  public constructor(config: AppConfigService) {
    this.baseUrl = config.values.AI_SERVICE_URL.replace(/\/$/, '');
    this.token = config.values.AI_INTERNAL_API_TOKEN;
    this.timeout = config.values.AI_REQUEST_TIMEOUT_MS;
  }

  public async answer(
    question: string,
    evidence: readonly AuthorizedEvidence[],
  ): Promise<GroundedAnswer> {
    const response = await fetch(`${this.baseUrl}/v1/answers/grounded`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        'x-correlation-id': currentCorrelationId(),
      },
      body: JSON.stringify({
        question,
        evidence: evidence.map((chunk) => ({
          chunk_id: chunk.chunkId,
          document_id: chunk.documentId,
          document_version_id: chunk.documentVersionId,
          document_title: chunk.documentTitle,
          text: chunk.text,
          start_offset: chunk.startOffset,
          end_offset: chunk.endOffset,
          page_number: chunk.pageNumber,
          section: chunk.section,
          authority: chunk.authority,
          authorized: true,
          authorization_decision_id: chunk.authorizationDecisionId,
        })),
      }),
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!response.ok) throw new Error(`Grounded answer service returned ${response.status}`);
    return GroundedAnswerSchema.parse(await response.json());
  }
}
