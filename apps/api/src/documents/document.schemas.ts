import { z } from 'zod';

export const DocumentClassificationSchema = z.enum([
  'public',
  'internal',
  'confidential',
  'restricted',
]);

export const ListDocumentsQuerySchema = z.object({
  workspaceId: z.uuid().optional(),
  status: z.enum(['draft', 'processing', 'verified', 'needs_review']).optional(),
  cursor: z.string().max(1_024).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const UploadFieldsSchema = z.object({
  workspaceId: z.uuid(),
  classification: DocumentClassificationSchema.default('internal'),
});

export type ListDocumentsQuery = z.infer<typeof ListDocumentsQuerySchema>;
export type UploadFields = z.infer<typeof UploadFieldsSchema>;

export interface DocumentSummary {
  readonly id: string;
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly mimeType: string;
  readonly status: 'draft' | 'processing' | 'verified' | 'needs_review';
  readonly processingState:
    'queued' | 'scanning' | 'extracting' | 'analyzing' | 'indexing' | 'ready' | 'failed';
  readonly processingProgress: number;
  readonly versionLabel: string;
  readonly owner: { readonly id: string; readonly name: string };
  readonly updatedAt: string;
  readonly renewalAt: string | null;
  readonly classification: z.infer<typeof DocumentClassificationSchema>;
  readonly favorite: boolean;
}

export interface EvidenceCitation {
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
  readonly verificationStatus: 'verified' | 'machine_extracted' | 'needs_review';
  readonly matchType: 'exact' | 'semantic' | 'hybrid';
}

export interface DocumentDetail extends DocumentSummary {
  readonly pageCount: number;
  readonly currentVersionId: string;
  readonly extractedText: string;
  readonly customer: string | null;
  readonly project: string | null;
  readonly summary: string | null;
  readonly citations: readonly EvidenceCitation[];
}

export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}
