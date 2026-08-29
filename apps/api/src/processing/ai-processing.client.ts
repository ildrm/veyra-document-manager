import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { AppConfigService } from '../config/config.module.js';
import { currentCorrelationId } from '../common/request-context.js';

const ExtractionResponseSchema = z.object({
  schema_version: z.literal('1.0'),
  correlation_id: z.string(),
  document: z.object({ page_count: z.number().int().positive() }),
  normalized_text: z.string(),
  pages: z.array(
    z.object({
      page_number: z.number().int().positive(),
      text: z.string(),
      start_offset: z.number().int().nonnegative(),
      end_offset: z.number().int().nonnegative(),
    }),
  ),
  chunks: z.array(
    z.object({
      chunk_id: z.string(),
      text: z.string().min(1),
      start_offset: z.number().int().nonnegative(),
      end_offset: z.number().int().positive(),
      page_numbers: z.array(z.number().int().positive()).min(1),
      sha256: z.string().length(64),
    }),
  ),
  metadata: z.object({
    title: z.string().nullable().optional(),
    customer: z.string().nullable().optional(),
  }),
  warnings: z.array(z.string()),
});

export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;

export interface IngestionDispatch {
  readonly organizationId: string;
  readonly documentId: string;
  readonly documentVersionId: string;
  readonly processingJobId: string;
  readonly storageObjectId: string;
  readonly bucket: string;
  readonly objectKey: string;
  readonly mediaType: string;
  readonly sha256: string;
  readonly correlationId: string;
}

/** Typed HTTP seam to the FastAPI ingestion service. */
@Injectable()
export class AiProcessingClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeout: number;

  public constructor(config: AppConfigService) {
    this.baseUrl = config.values.AI_SERVICE_URL.replace(/\/$/, '');
    this.token = config.values.AI_INTERNAL_API_TOKEN;
    this.timeout = config.values.AI_REQUEST_TIMEOUT_MS;
  }

  public async extract(input: IngestionDispatch, content: Uint8Array): Promise<ExtractionResponse> {
    const response = await fetch(`${this.baseUrl}/v1/ingestion/extract`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.token}`,
        'content-type': input.mediaType,
        'x-filename': input.objectKey.split('/').at(-1) ?? 'upload',
        'x-document-id': input.documentId,
        'x-document-version-id': input.documentVersionId,
        'x-correlation-id': input.correlationId || currentCorrelationId(),
      },
      body: Buffer.from(content),
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!response.ok) throw new Error(`AI extraction service returned ${response.status}`);
    return ExtractionResponseSchema.parse(await response.json());
  }

  public async readiness(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/health/ready`, {
      headers: {
        authorization: `Bearer ${this.token}`,
        'x-correlation-id': currentCorrelationId(),
      },
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) throw new Error(`AI readiness returned ${response.status}`);
  }
}
