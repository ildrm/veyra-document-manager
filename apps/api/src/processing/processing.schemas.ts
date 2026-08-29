import { z } from 'zod';

export const ProcessingCallbackSchema = z
  .object({
    organizationId: z.uuid(),
    jobId: z.uuid(),
    documentId: z.uuid(),
    documentVersionId: z.uuid(),
    state: z.enum(['scanning', 'extracting', 'analyzing', 'indexing', 'ready', 'failed']),
    progress: z.number().int().min(0).max(100),
    message: z.string().max(2_000).optional(),
    scanStatus: z.enum(['pending', 'clean', 'infected', 'error']).optional(),
    errorCode: z.string().max(100).optional(),
    errorMessage: z.string().max(2_000).optional(),
  })
  .superRefine((callback, context) => {
    if (callback.scanStatus === 'infected' && callback.state !== 'failed') {
      context.addIssue({
        code: 'custom',
        path: ['state'],
        message: 'An infected object must transition to failed',
      });
    }
    if (callback.state === 'ready' && callback.progress !== 100) {
      context.addIssue({
        code: 'custom',
        path: ['progress'],
        message: 'A ready object must report 100% progress',
      });
    }
  });

export type ProcessingCallback = z.infer<typeof ProcessingCallbackSchema>;

export interface ProcessingEvent {
  readonly documentId: string;
  readonly state: string;
  readonly progress: number;
  readonly message: string;
  readonly occurredAt: string;
}
