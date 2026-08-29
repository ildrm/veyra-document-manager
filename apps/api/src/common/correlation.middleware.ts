import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { runWithRequestContext, validCorrelationId } from './request-context.js';

export interface CorrelatedIncomingMessage extends IncomingMessage {
  correlationId?: string;
}

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  public use(request: CorrelatedIncomingMessage, response: ServerResponse, next: () => void): void {
    const correlationId = validCorrelationId(request.headers['x-correlation-id']);
    request.correlationId = correlationId;
    response.setHeader('x-correlation-id', correlationId);
    runWithRequestContext({ correlationId }, next);
  }
}
