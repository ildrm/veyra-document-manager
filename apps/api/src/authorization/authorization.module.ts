import { Global, Module } from '@nestjs/common';

import { AppConfigService } from '../config/config.module.js';
import { DatabaseService } from '../database/database.service.js';
import { AuthorizationService } from './authorization.service.js';
import { AUTHORIZATION_ADAPTER } from './authorization.types.js';
import { DevelopmentAuthorizationAdapter } from './development-authorization.adapter.js';
import { OpenFgaAuthorizationAdapter } from './openfga.adapter.js';

@Global()
@Module({
  providers: [
    {
      provide: AUTHORIZATION_ADAPTER,
      inject: [AppConfigService, DatabaseService],
      useFactory: (config: AppConfigService, database: DatabaseService) =>
        config.values.OPENFGA_ADAPTER === 'openfga'
          ? new OpenFgaAuthorizationAdapter(config)
          : new DevelopmentAuthorizationAdapter(config, database),
    },
    AuthorizationService,
  ],
  exports: [AuthorizationService, AUTHORIZATION_ADAPTER],
})
export class AuthorizationModule {}
