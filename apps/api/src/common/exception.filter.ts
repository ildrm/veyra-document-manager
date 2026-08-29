import {
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
  Logger,
  type ArgumentsHost,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ZodError } from 'zod';

import { ApiException } from './api-error.js';
import type { CorrelatedIncomingMessage } from './correlation.middleware.js';
import { currentCorrelationId } from './request-context.js';
import type { FastifyRequest } from 'fastify';

@Catch()
export class StructuredExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(StructuredExceptionFilter.name);

  public constructor(private readonly adapterHost: HttpAdapterHost) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<FastifyRequest>();
    const raw = request.raw as CorrelatedIncomingMessage;
    const correlationId = raw.correlationId ?? currentCorrelationId();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: Readonly<Record<string, unknown>> | undefined;

    if (exception instanceof ApiException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = 'The request is invalid';
      details = { issues: exception.issues };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = codeForStatus(status);
      message = exception.message;
    } else if (hasHttpStatus(exception)) {
      status = exception.statusCode;
      code = codeForStatus(status);
      message = status >= 500 ? message : exception.message;
    }

    const logFields = {
      correlationId,
      method: request.method,
      url: request.url,
      status,
      code,
      ...(status >= 500 && exception instanceof Error ? { stack: exception.stack } : {}),
    };
    if (status >= 500) this.logger.error(logFields);
    else this.logger.warn(logFields);

    this.adapterHost.httpAdapter.reply(
      host.switchToHttp().getResponse(),
      {
        error: {
          code,
          message,
          correlationId,
          ...(details ? { details } : {}),
        },
      },
      status,
    );
  }
}

function hasHttpStatus(
  value: unknown,
): value is { readonly statusCode: number; readonly message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    typeof value.statusCode === 'number' &&
    value.statusCode >= 400 &&
    value.statusCode <= 599 &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

function codeForStatus(status: number): string {
  return (
    {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
      [HttpStatus.FORBIDDEN]: 'PERMISSION_DENIED',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
      [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
      [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
    }[status] ?? 'HTTP_ERROR'
  );
}
