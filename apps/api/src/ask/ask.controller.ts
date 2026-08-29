import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';

import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/auth.types.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { AskRequestSchema, type AskRequest, type AskResponse } from './ask.schemas.js';
import { AskService } from './ask.service.js';

@ApiTags('ask')
@ApiBearerAuth()
@Controller('/v1/ask')
export class AskController {
  public constructor(private readonly askService: AskService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Grounded answer with exact persisted evidence citations' })
  public ask(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodPipe(AskRequestSchema)) request: AskRequest,
  ): Promise<AskResponse> {
    return this.askService.ask(principal, request);
  }

  /**
   * Transport-level SSE fallback. Grounding and exact-citation validation complete before
   * the first token is emitted, so a provider failure cannot leak an unvalidated partial answer.
   */
  @Post('stream')
  @HttpCode(HttpStatus.OK)
  @ApiProduces('text/event-stream')
  public async stream(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodPipe(AskRequestSchema)) request: AskRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.askService.ask(principal, request);
    reply.hijack();
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    try {
      writeEvent(reply, 'status', {
        phase: 'grounded',
        sufficientEvidence: result.sufficientEvidence,
      });
      for (const token of tokenChunks(result.answer)) writeEvent(reply, 'token', { token });
      for (const citation of result.citations) writeEvent(reply, 'citation', citation);
      writeEvent(reply, 'complete', result);
    } catch {
      writeEvent(reply, 'error', { code: 'STREAM_WRITE_FAILED' });
    } finally {
      reply.raw.end();
    }
  }
}

function writeEvent(reply: FastifyReply, event: string, data: unknown): void {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function tokenChunks(answer: string): string[] {
  return answer.match(/.{1,48}(?:\s+|$)/gu) ?? [answer];
}
