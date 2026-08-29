import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

import type { FastifyRequest } from 'fastify';
import { ApiException } from '../common/api-error.js';
import { AppConfigService } from '../config/config.module.js';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly expected: Buffer;

  public constructor(config: AppConfigService) {
    this.expected = Buffer.from(config.values.AI_INTERNAL_API_TOKEN);
  }

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const header = request.headers['x-internal-api-key'];
    const supplied = Buffer.from(Array.isArray(header) ? (header[0] ?? '') : (header ?? ''));
    const allowed =
      supplied.length === this.expected.length && timingSafeEqual(supplied, this.expected);
    if (!allowed) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_INTERNAL_API_KEY',
        'Invalid service credential',
      );
    }
    return true;
  }
}
