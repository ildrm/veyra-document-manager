import { Global, Inject, Injectable, Module } from '@nestjs/common';

import { parseAppConfig, type AppConfig } from './config.schema.js';

export const APP_CONFIG = Symbol('APP_CONFIG');

@Injectable()
export class AppConfigService {
  public constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  public get values(): Readonly<AppConfig> {
    return this.config;
  }
}

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: () => parseAppConfig(process.env),
    },
    AppConfigService,
  ],
  exports: [APP_CONFIG, AppConfigService],
})
export class ConfigModule {}
