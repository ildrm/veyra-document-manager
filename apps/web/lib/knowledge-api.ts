import {
  AskResponseSchema,
  DocumentDetailSchema,
  DocumentSummarySchema,
  SearchResultSchema,
  type AskRequest,
  type AskResponse,
  type CursorPage,
  type DocumentDetail,
  type DocumentSummary,
  type SearchRequest,
  type SearchResult,
} from '@veyra/contracts';
import { z } from 'zod';
import {
  demoAskResponse,
  demoDocumentDetail,
  demoDocuments,
  demoSearchResults,
  ids,
} from './demo-data';

const DocumentPageSchema = z.object({
  items: z.array(DocumentSummarySchema),
  nextCursor: z.string().nullable(),
});

const SearchPageSchema = z.object({
  items: z.array(SearchResultSchema),
  nextCursor: z.string().nullable(),
});

export interface UploadResult {
  documentId: string;
  versionId: string;
  processingJobId: string;
  processingState: 'queued';
}

export interface AskStreamHandlers {
  onStatus?: (status: string) => void;
  onToken?: (token: string) => void;
  onCitation?: (citation: AskResponse['citations'][number]) => void;
}

export interface KnowledgeApi {
  listDocuments(signal?: AbortSignal): Promise<CursorPage<DocumentSummary>>;
  getDocument(id: string, signal?: AbortSignal): Promise<DocumentDetail>;
  search(request: SearchRequest, signal?: AbortSignal): Promise<CursorPage<SearchResult>>;
  ask(request: AskRequest, signal?: AbortSignal): Promise<AskResponse>;
  askStream(
    request: AskRequest,
    handlers: AskStreamHandlers,
    signal?: AbortSignal,
  ): Promise<AskResponse>;
  upload(file: File, signal?: AbortSignal): Promise<UploadResult>;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly correlationId: string | null,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const headers = {
  'x-dev-user-id': ids.maya,
  'x-dev-organization-id': ids.organization,
  'x-dev-user-email': 'maya@northstar.example',
};

async function parseOrThrow(response: Response): Promise<unknown> {
  if (response.ok) return response.json();
  let message = `Request failed with status ${response.status}`;
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    message = body.error?.message ?? message;
  } catch {
    // The structured API error boundary may not have produced JSON.
  }
  throw new ApiClientError(message, response.status, response.headers.get('x-correlation-id'));
}

export class HttpKnowledgeApi implements KnowledgeApi {
  constructor(private readonly baseUrl: string) {}

  async listDocuments(signal?: AbortSignal) {
    const response = await fetch(`${this.baseUrl}/v1/documents?limit=25`, {
      headers,
      signal: signal ?? null,
      cache: 'no-store',
    });
    return DocumentPageSchema.parse(await parseOrThrow(response));
  }

  async getDocument(id: string, signal?: AbortSignal) {
    const response = await fetch(`${this.baseUrl}/v1/documents/${encodeURIComponent(id)}`, {
      headers,
      signal: signal ?? null,
      cache: 'no-store',
    });
    return DocumentDetailSchema.parse(await parseOrThrow(response));
  }

  async search(request: SearchRequest, signal?: AbortSignal) {
    const parameters = new URLSearchParams({ query: request.query, limit: String(request.limit) });
    if (request.workspaceId) parameters.set('workspaceId', request.workspaceId);
    if (request.type) parameters.set('type', request.type);
    if (request.status) parameters.set('status', request.status);
    if (request.customer) parameters.set('customer', request.customer);
    const response = await fetch(`${this.baseUrl}/v1/search?${parameters.toString()}`, {
      headers,
      signal: signal ?? null,
      cache: 'no-store',
    });
    return SearchPageSchema.parse(await parseOrThrow(response));
  }

  async ask(request: AskRequest, signal?: AbortSignal) {
    const response = await fetch(`${this.baseUrl}/v1/ask`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: signal ?? null,
    });
    return AskResponseSchema.parse(await parseOrThrow(response));
  }

  async askStream(request: AskRequest, handlers: AskStreamHandlers, signal?: AbortSignal) {
    const response = await fetch(`${this.baseUrl}/v1/ask/stream`, {
      method: 'POST',
      headers: { ...headers, accept: 'text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: signal ?? null,
    });
    if (!response.ok || !response.body) {
      if (response.status === 404 || response.status === 405) return this.ask(request, signal);
      await parseOrThrow(response);
      throw new ApiClientError('The answer stream ended unexpectedly.', response.status, null);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventName = 'message';
    let completed: AskResponse | undefined;

    const consume = (block: string) => {
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) return;
      const payload = JSON.parse(data) as unknown;
      if (
        eventName === 'status' &&
        typeof payload === 'object' &&
        payload &&
        'message' in payload
      ) {
        handlers.onStatus?.(String(payload.message));
      } else if (
        eventName === 'token' &&
        typeof payload === 'object' &&
        payload &&
        'token' in payload
      ) {
        handlers.onToken?.(String(payload.token));
      } else if (eventName === 'citation') {
        handlers.onCitation?.(AskResponseSchema.shape.citations.element.parse(payload));
      } else if (eventName === 'complete') {
        completed = AskResponseSchema.parse(payload);
      }
      eventName = 'message';
    };

    while (true) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done }).replace(/\r\n/g, '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        consume(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');
      }
      if (chunk.done) break;
    }
    if (buffer.trim()) consume(buffer);
    if (!completed)
      throw new ApiClientError('The answer stream ended before completion.', 502, null);
    return completed;
  }

  async upload(file: File, signal?: AbortSignal) {
    const payload = new FormData();
    // Fastify's streaming multipart parser resolves metadata in wire order.
    payload.set('workspaceId', ids.legalWorkspace);
    payload.set('file', file);
    const response = await fetch(`${this.baseUrl}/v1/documents`, {
      method: 'POST',
      headers,
      body: payload,
      signal: signal ?? null,
    });
    const schema = z.object({
      documentId: z.uuid(),
      versionId: z.uuid(),
      processingJobId: z.uuid(),
      processingState: z.literal('queued'),
    });
    return schema.parse(await parseOrThrow(response));
  }
}

const wait = (milliseconds: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });

export class DemoKnowledgeApi implements KnowledgeApi {
  async listDocuments(signal?: AbortSignal) {
    await wait(180, signal);
    return { items: demoDocuments, nextCursor: null };
  }

  async getDocument(id: string, signal?: AbortSignal) {
    await wait(120, signal);
    if (id !== ids.acmeDocument) return demoDocumentDetail;
    return demoDocumentDetail;
  }

  async search(_request: SearchRequest, signal?: AbortSignal) {
    await wait(210, signal);
    return { items: demoSearchResults, nextCursor: null };
  }

  async ask(_request: AskRequest, signal?: AbortSignal) {
    await wait(680, signal);
    return demoAskResponse;
  }

  async askStream(_request: AskRequest, handlers: AskStreamHandlers, signal?: AbortSignal) {
    handlers.onStatus?.('Applied permissions');
    await wait(180, signal);
    handlers.onStatus?.('Searched 24 documents');
    await wait(220, signal);
    handlers.onCitation?.(demoAskResponse.citations[0]!);
    const tokens = demoAskResponse.answer.match(/\S+\s*/g) ?? [];
    for (const token of tokens) {
      await wait(24, signal);
      handlers.onToken?.(token);
    }
    return demoAskResponse;
  }

  async upload(file: File, signal?: AbortSignal) {
    await wait(240, signal);
    return {
      documentId: crypto.randomUUID(),
      versionId: crypto.randomUUID(),
      processingJobId: crypto.randomUUID(),
      processingState: 'queued' as const,
    };
  }
}

let singleton: KnowledgeApi | undefined;

export function knowledgeApi(): KnowledgeApi {
  if (singleton) return singleton;
  const useDemo = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
  singleton = useDemo
    ? new DemoKnowledgeApi()
    : new HttpKnowledgeApi(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');
  return singleton;
}
