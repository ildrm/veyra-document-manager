import { describe, expect, it } from 'vitest';

import { validateExactCitations } from '../src/ask/citation-validator.js';
import type { AuthorizedEvidence, GroundedAnswer } from '../src/ask/grounded-ai.client.js';

const evidence: AuthorizedEvidence = {
  chunkId: '80000000-0000-4000-8000-000000000001',
  documentId: '50000000-0000-4000-8000-000000000001',
  documentVersionId: '60000000-0000-4000-8000-000000000001',
  documentTitle: 'Acme Master Services Agreement',
  versionLabel: 'v7.0',
  pageId: '70000000-0000-4000-8000-000000000001',
  pageNumber: 14,
  section: 'Schedule A — Service Levels',
  text: '99.95% monthly uptime',
  startOffset: 47,
  endOffset: 68,
  authority: 'signed_contract',
  authorizationDecisionId: 'decision-1',
};

function answer(overrides: Partial<GroundedAnswer> = {}): GroundedAnswer {
  return {
    schema_version: '1.0',
    correlation_id: 'ai-1',
    status: 'answered',
    answer: 'The commitment is 99.95% monthly uptime.',
    confidence: 0.99,
    conflict: false,
    citations: [
      {
        chunk_id: evidence.chunkId,
        document_id: evidence.documentId,
        document_version_id: evidence.documentVersionId,
        document_title: evidence.documentTitle,
        page_number: evidence.pageNumber,
        section: evidence.section,
        start_offset: 47,
        end_offset: 68,
        quote: evidence.text,
      },
    ],
    conflicting_claims: [],
    provider: 'evidence-only',
    ...overrides,
  };
}

describe('validateExactCitations', () => {
  it('accepts an exact end-exclusive evidence span', () => {
    const [citation] = validateExactCitations(answer(), [evidence]);
    expect(citation).toMatchObject({
      documentId: evidence.documentId,
      quote: evidence.text,
      startOffset: 47,
      endOffset: 68,
    });
  });

  it('rejects a quote that is not the cited evidence span', () => {
    const tampered = answer({
      citations: [{ ...answer().citations[0]!, quote: '99.9% monthly uptime' }],
    });
    expect(() => validateExactCitations(tampered, [evidence])).toThrow(
      'does not exactly match authorized evidence',
    );
  });

  it('rejects citations to chunks outside the authorized retrieval scope', () => {
    expect(() => validateExactCitations(answer(), [])).toThrow(
      'does not exactly match authorized evidence',
    );
  });
});
