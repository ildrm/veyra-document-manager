import { Module } from '@nestjs/common';

import { ProcessingModule } from '../processing/processing.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [ProcessingModule],
  controllers: [HealthController],
})
export class HealthModule {}
