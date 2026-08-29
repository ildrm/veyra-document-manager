import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AppConfigService } from '../config/config.module.js';
import { DatabaseService } from '../database/database.service.js';
import { AuthenticationGuard } from './auth.guard.js';
import { AUTHENTICATION_ADAPTER } from './auth.types.js';
import { DevelopmentAuthenticationAdapter } from './development-auth.adapter.js';
import { OidcAuthenticationAdapter } from './oidc-auth.adapter.js';

@Global()
@Module({
  providers: [
    {
      provide: AUTHENTICATION_ADAPTER,
      inject: [AppConfigService, DatabaseService],
      useFactory: (config: AppConfigService, database: DatabaseService) =>
        config.values.AUTH_ADAPTER === 'oidc'
          ? new OidcAuthenticationAdapter(config, database)
          : new DevelopmentAuthenticationAdapter(config, database),
    },
    { provide: APP_GUARD, useClass: AuthenticationGuard },
  ],
  exports: [AUTHENTICATION_ADAPTER],
})
export class AuthModule {}
