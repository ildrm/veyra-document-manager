import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

import type { Principal } from '../auth/auth.types.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { AskRepository } from './ask.repository.js';
import type { AskRequest, AskResponse } from './ask.schemas.js';
import { validateExactCitations } from './citation-validator.js';
import { GroundedAiClient } from './grounded-ai.client.js';

const insufficientAnswer =
  "I don't have enough authorized evidence to answer that question. Try narrowing the scope or adding a relevant source.";

@Injectable()
export class AskService {
  public constructor(
    private readonly authorization: AuthorizationService,
    private readonly repository: AskRepository,
    private readonly ai: GroundedAiClient,
  ) {}

  public async ask(principal: Principal, request: AskRequest): Promise<AskResponse> {
    const started = performance.now();
    const authorizationDecisionId = randomUUID();

    // Critical ordering: resolve authorization, then retrieve scoped evidence, then invoke AI.
    const scope = await this.authorization.retrievalScope(principal, 'can_view');
    const evidence = await this.repository.retrieveEvidence(
      principal,
      scope,
      request,
      authorizationDecisionId,
    );
    const searchedDocumentCount = new Set(evidence.map((chunk) => chunk.documentId)).size;
    const grounded =
      evidence.length > 0
        ? await this.ai.answer(request.question, evidence)
        : {
            schema_version: '1.0' as const,
            correlation_id: randomUUID(),
            status: 'insufficient_evidence' as const,
            answer: insufficientAnswer,
            confidence: 0,
            conflict: false,
            citations: [],
            conflicting_claims: [],
            provider: 'local-insufficient-evidence-guard',
          };
    const citations = validateExactCitations(grounded, evidence);
    const publicCitations = citations.map(
      ({ pageId: _pageId, chunkId: _chunkId, ...citation }) => citation,
    );
    const latencyMs = Math.round(performance.now() - started);
    const conversationId = randomUUID();
    const sufficientEvidence = grounded.status === 'answered';
    const answer = sufficientEvidence ? grounded.answer : grounded.answer || insufficientAnswer;

    await this.repository.persistAnswer({
      conversationId,
      userMessageId: randomUUID(),
      assistantMessageId: randomUUID(),
      principal,
      request,
      answer,
      sufficientEvidence,
      conflictingEvidence: grounded.conflict,
      provider: grounded.provider,
      latencyMs,
      citations,
      authorizationDecisionId,
      searchedDocumentCount,
    });

    return {
      conversationId,
      answer,
      sufficientEvidence,
      conflictingEvidence: grounded.conflict,
      citations: publicCitations,
      searchedDocumentCount,
      latencyMs,
    };
  }
}
