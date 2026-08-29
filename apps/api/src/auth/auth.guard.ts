import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest, AuthenticationAdapter } from './auth.types.js';
import { AUTHENTICATION_ADAPTER } from './auth.types.js';
import { IS_PUBLIC_ROUTE } from './public.decorator.js';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    @Inject(AUTHENTICATION_ADAPTER) private readonly adapter: AuthenticationAdapter,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.principal = await this.adapter.authenticate(request);
    return true;
  }
}
