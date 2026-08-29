import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';

import { AskModule } from './ask/ask.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthorizationModule } from './authorization/authorization.module.js';
import { CorrelationMiddleware } from './common/correlation.middleware.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DocumentModule } from './documents/document.module.js';
import { HealthModule } from './health/health.module.js';
import { ProcessingModule } from './processing/processing.module.js';
import { SearchModule } from './search/search.module.js';
import { StorageModule } from './storage/storage.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    StorageModule,
    AuthModule,
    AuthorizationModule,
    ProcessingModule,
    DocumentModule,
    SearchModule,
    AskModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
