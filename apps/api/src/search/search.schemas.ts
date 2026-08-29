import { z } from 'zod';

export const SearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(500),
  workspaceId: z.uuid().optional(),
  status: z.enum(['draft', 'processing', 'verified', 'needs_review']).optional(),
  customer: z.string().trim().min(1).max(200).optional(),
  cursor: z.string().max(1_024).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export interface SearchResult {
  readonly document: {
    readonly id: string;
    readonly organizationId: string;
    readonly workspaceId: string;
    readonly name: string;
    readonly mimeType: string;
    readonly status: 'draft' | 'processing' | 'verified' | 'needs_review';
    readonly processingState: string;
    readonly processingProgress: number;
    readonly versionLabel: string;
    readonly owner: { readonly id: string; readonly name: string };
    readonly updatedAt: string;
    readonly renewalAt: string | null;
    readonly classification: 'public' | 'internal' | 'confidential' | 'restricted';
    readonly favorite: false;
  };
  readonly score: number;
  readonly snippet: string;
  readonly pageNumber: number;
  readonly section: string | null;
  readonly matchedTerms: readonly string[];
  readonly authorizationReason: string;
}

export interface SearchPage {
  readonly items: readonly SearchResult[];
  readonly nextCursor: string | null;
}
