import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Sse,
  UseGuards,
  type MessageEvent,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';

import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import { Public } from '../auth/public.decorator.js';
import type { Principal } from '../auth/auth.types.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { InternalApiKeyGuard } from './internal-api-key.guard.js';
import {
  ProcessingCallbackSchema,
  type ProcessingCallback,
  type ProcessingEvent,
} from './processing.schemas.js';
import { ProcessingService } from './processing.service.js';

@ApiTags('processing')
@Controller()
export class ProcessingController {
  public constructor(
    private readonly processing: ProcessingService,
    private readonly authorization: AuthorizationService,
  ) {}

  @Public()
  @UseGuards(InternalApiKeyGuard)
  @Post('/internal/v1/processing/callback')
  public async callback(
    @Body(new ZodPipe(ProcessingCallbackSchema)) body: ProcessingCallback,
  ): Promise<{ readonly accepted: true }> {
    await this.processing.applyCallback(body);
    return { accepted: true };
  }

  @ApiBearerAuth()
  @Sse('/v1/documents/:documentId/processing/events')
  public async events(
    @CurrentPrincipal() principal: Principal,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ): Promise<Observable<MessageEvent>> {
    await this.authorization.require(principal, 'document', documentId, 'can_view');
    return new Observable<MessageEvent>((subscriber) => {
      let previous = '';
      let running = false;
      const poll = async () => {
        if (running) return;
        running = true;
        try {
          const snapshot = await this.processing.snapshot(principal.organizationId, documentId);
          if (!snapshot) {
            subscriber.complete();
            return;
          }
          const serialized = JSON.stringify(snapshot);
          if (serialized !== previous) {
            previous = serialized;
            subscriber.next({ type: 'processing', data: snapshot as ProcessingEvent });
          }
          if (snapshot.state === 'ready' || snapshot.state === 'failed') subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        } finally {
          running = false;
        }
      };
      void poll();
      const interval = setInterval(() => void poll(), 1_000);
      return () => clearInterval(interval);
    });
  }
}
