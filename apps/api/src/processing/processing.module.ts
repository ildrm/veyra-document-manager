import { Module } from '@nestjs/common';

import { AiProcessingClient } from './ai-processing.client.js';
import { InternalApiKeyGuard } from './internal-api-key.guard.js';
import { ProcessingController } from './processing.controller.js';
import { ProcessingDispatchService } from './processing-dispatch.service.js';
import { ProcessingService } from './processing.service.js';

@Module({
  controllers: [ProcessingController],
  providers: [
    AiProcessingClient,
    ProcessingDispatchService,
    ProcessingService,
    InternalApiKeyGuard,
  ],
  exports: [AiProcessingClient, ProcessingDispatchService, ProcessingService],
})
export class ProcessingModule {}
