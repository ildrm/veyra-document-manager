import { z } from 'zod';

export const AskRequestSchema = z.object({
  question: z.string().trim().min(3).max(2_000),
  workspaceId: z.uuid().optional(),
  documentIds: z.array(z.uuid()).max(50).optional(),
  mode: z.enum(['quick_answer', 'summarize', 'compare', 'timeline']).default('quick_answer'),
});

export type AskRequest = z.infer<typeof AskRequestSchema>;

export interface AskCitation {
  readonly id: string;
  readonly documentId: string;
  readonly documentVersionId: string;
  readonly documentName: string;
  readonly versionLabel: string;
  readonly pageNumber: number;
  readonly section: string | null;
  readonly quote: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly confidence: number;
  readonly verificationStatus: 'machine_extracted';
  readonly matchType: 'hybrid';
}

export interface AskResponse {
  readonly conversationId: string;
  readonly answer: string;
  readonly sufficientEvidence: boolean;
  readonly conflictingEvidence: boolean;
  readonly citations: readonly AskCitation[];
  readonly searchedDocumentCount: number;
  readonly latencyMs: number;
}
