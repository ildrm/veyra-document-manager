import { Controller, Get, HttpStatus, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/public.decorator.js';
import { ApiException } from '../common/api-error.js';
import { DatabaseService } from '../database/database.service.js';
import { AiProcessingClient } from '../processing/ai-processing.client.js';
import { STORAGE_ADAPTER, type StorageAdapter } from '../storage/storage.types.js';

@ApiTags('health')
@Public()
@Controller('/health')
export class HealthController {
  public constructor(
    private readonly database: DatabaseService,
    private readonly ai: AiProcessingClient,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  @Get('live')
  @ApiOkResponse({ description: 'Process liveness' })
  public live(): { readonly status: 'live' } {
    return { status: 'live' };
  }

  @Get('ready')
  @ApiOkResponse({ description: 'Required dependencies are reachable' })
  @ApiServiceUnavailableResponse({ description: 'At least one dependency is unavailable' })
  public async ready(): Promise<{
    readonly status: 'ready';
    readonly checks: Record<string, 'ready'>;
  }> {
    const names = ['postgres', 'objectStorage', 'aiService'] as const;
    const results = await Promise.allSettled([
      this.database.readiness(),
      this.storage.readiness(),
      this.ai.readiness(),
    ]);
    const checks = Object.fromEntries(
      names.map((name, index) => [
        name,
        results[index]?.status === 'fulfilled' ? 'ready' : 'not_ready',
      ]),
    );
    if (results.some((result) => result.status === 'rejected')) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'NOT_READY',
        'One or more required dependencies are unavailable',
        { checks },
      );
    }
    return { status: 'ready', checks: checks as Record<string, 'ready'> };
  }
}
