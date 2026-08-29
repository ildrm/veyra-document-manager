import { Module } from '@nestjs/common';

import { AskController } from './ask.controller.js';
import { AskRepository } from './ask.repository.js';
import { AskService } from './ask.service.js';
import { GroundedAiClient } from './grounded-ai.client.js';

@Module({
  controllers: [AskController],
  providers: [AskRepository, AskService, GroundedAiClient],
})
export class AskModule {}
