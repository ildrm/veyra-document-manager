import { randomUUID } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';

import { ApiException } from '../common/api-error.js';
import type { AskCitation } from './ask.schemas.js';
import type { AuthorizedEvidence, GroundedAnswer, GroundedCitation } from './grounded-ai.client.js';

export interface PersistableCitation extends AskCitation {
  readonly pageId: string;
  readonly chunkId: string;
}

export function validateExactCitations(
  answer: GroundedAnswer,
  evidence: readonly AuthorizedEvidence[],
): PersistableCitation[] {
  if (answer.status === 'answered' && answer.citations.length === 0) invalidCitation();
  if (
    answer.status === 'insufficient_evidence' &&
    (answer.citations.length > 0 || answer.conflict)
  ) {
    invalidCitation();
  }
  const byId = new Map(evidence.map((chunk) => [chunk.chunkId, chunk]));
  return answer.citations.map((citation) => validateOne(citation, byId, answer.confidence));
}

function validateOne(
  citation: GroundedCitation,
  evidence: ReadonlyMap<string, AuthorizedEvidence>,
  confidence: number,
): PersistableCitation {
  const chunk = evidence.get(citation.chunk_id);
  const relativeStart = chunk ? citation.start_offset - chunk.startOffset : -1;
  const relativeEnd = chunk ? citation.end_offset - chunk.startOffset : -1;
  const quoted = chunk ? sliceCodePoints(chunk.text, relativeStart, relativeEnd) : undefined;
  if (
    !chunk ||
    citation.document_id !== chunk.documentId ||
    citation.document_version_id !== chunk.documentVersionId ||
    citation.document_title !== chunk.documentTitle ||
    citation.page_number !== chunk.pageNumber ||
    relativeStart < 0 ||
    relativeEnd <= relativeStart ||
    relativeEnd > Array.from(chunk.text).length ||
    quoted !== citation.quote
  ) {
    invalidCitation();
  }
  return {
    id: randomUUID(),
    documentId: chunk.documentId,
    documentVersionId: chunk.documentVersionId,
    documentName: chunk.documentTitle,
    versionLabel: chunk.versionLabel,
    pageId: chunk.pageId,
    chunkId: chunk.chunkId,
    pageNumber: chunk.pageNumber,
    section: chunk.section,
    quote: citation.quote,
    startOffset: citation.start_offset,
    endOffset: citation.end_offset,
    confidence,
    verificationStatus: 'machine_extracted',
    matchType: 'hybrid',
  };
}

function sliceCodePoints(value: string, start: number, end: number): string {
  if (start < 0 || end < 0) return '';
  return Array.from(value).slice(start, end).join('');
}

function invalidCitation(): never {
  throw new ApiException(
    HttpStatus.BAD_GATEWAY,
    'AI_CITATION_INVALID',
    'The AI provider returned a citation that does not exactly match authorized evidence',
  );
}
