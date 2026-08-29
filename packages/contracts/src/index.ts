import { z } from 'zod';

export const processingStates = [
  'queued',
  'scanning',
  'extracting',
  'analyzing',
  'indexing',
  'ready',
  'failed',
] as const;

export const ProcessingStateSchema = z.enum(processingStates);
export type ProcessingState = z.infer<typeof ProcessingStateSchema>;

export const documentStatuses = ['draft', 'processing', 'verified', 'needs_review'] as const;
export const DocumentStatusSchema = z.enum(documentStatuses);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const PrincipalSchema = z.object({
  userId: z.uuid(),
  organizationId: z.uuid(),
  email: z.email(),
  displayName: z.string().min(1),
  roles: z.array(z.string()).default([]),
});
export type Principal = z.infer<typeof PrincipalSchema>;

export const DocumentSummarySchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  workspaceId: z.uuid(),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  status: DocumentStatusSchema,
  processingState: ProcessingStateSchema,
  processingProgress: z.number().int().min(0).max(100),
  versionLabel: z.string(),
  owner: z.object({ id: z.uuid(), name: z.string() }),
  updatedAt: z.iso.datetime(),
  renewalAt: z.iso.datetime().nullable(),
  classification: z.enum(['public', 'internal', 'confidential', 'restricted']),
  favorite: z.boolean().default(false),
});
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;

export const EvidenceCitationSchema = z.object({
  id: z.uuid(),
  documentId: z.uuid(),
  documentVersionId: z.uuid(),
  documentName: z.string(),
  versionLabel: z.string(),
  pageNumber: z.number().int().positive(),
  section: z.string().nullable(),
  quote: z.string().min(1),
  startOffset: z.number().int().nonnegative().nullable(),
  endOffset: z.number().int().positive().nullable(),
  confidence: z.number().min(0).max(1),
  verificationStatus: z.enum(['verified', 'machine_extracted', 'needs_review']),
  matchType: z.enum(['exact', 'semantic', 'hybrid']),
});
export type EvidenceCitation = z.infer<typeof EvidenceCitationSchema>;

export const DocumentDetailSchema = DocumentSummarySchema.extend({
  pageCount: z.number().int().positive(),
  currentVersionId: z.uuid(),
  extractedText: z.string(),
  customer: z.string().nullable(),
  project: z.string().nullable(),
  summary: z.string().nullable(),
  citations: z.array(EvidenceCitationSchema),
});
export type DocumentDetail = z.infer<typeof DocumentDetailSchema>;

export const SearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(500),
  workspaceId: z.uuid().optional(),
  type: z.string().optional(),
  status: DocumentStatusSchema.optional(),
  customer: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const SearchResultSchema = z.object({
  document: DocumentSummarySchema,
  score: z.number().min(0).max(1),
  snippet: z.string(),
  pageNumber: z.number().int().positive(),
  section: z.string().nullable(),
  matchedTerms: z.array(z.string()),
  authorizationReason: z.string(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const AskRequestSchema = z.object({
  question: z.string().trim().min(3).max(2_000),
  workspaceId: z.uuid().optional(),
  documentIds: z.array(z.uuid()).max(50).optional(),
  mode: z.enum(['quick_answer', 'summarize', 'compare', 'timeline']).default('quick_answer'),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

export const AskResponseSchema = z.object({
  conversationId: z.uuid(),
  answer: z.string(),
  sufficientEvidence: z.boolean(),
  conflictingEvidence: z.boolean(),
  citations: z.array(EvidenceCitationSchema),
  searchedDocumentCount: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
});
export type AskResponse = z.infer<typeof AskResponseSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    correlationId: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ProcessingEvent {
  documentId: string;
  state: ProcessingState;
  progress: number;
  message: string;
  occurredAt: string;
}
