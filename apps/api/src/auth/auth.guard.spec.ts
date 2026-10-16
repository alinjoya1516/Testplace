import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { loadAppConfig } from '../config/app-config';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest, CurrentUserInfo } from './current-user';
import type { DevUserService } from './dev-user.service';

const devUserInfo: CurrentUserInfo = { id: 'u1', name: 'Dev Admin', role: 'ADMIN' };

function run(authMode: string, isPublic: boolean) {
  const reflector = { getAllAndOverride: () => isPublic } as unknown as Reflector;
  const devUser = { get: () => devUserInfo } as unknown as DevUserService;
  const guard = new AuthGuard(reflector, devUser, loadAppConfig({ AUTH_MODE: authMode }));
  const request: AuthenticatedRequest = {} as AuthenticatedRequest;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { allowed: () => guard.canActivate(context), request };
}

describe('AuthGuard', () => {
  it('lets public routes through without a user', () => {
    const { allowed, request } = run('none', true);
    expect(allowed()).toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('attaches the dev user in dev mode', () => {
    const { allowed, request } = run('dev', false);
    expect(allowed()).toBe(true);
    expect(request.user).toEqual(devUserInfo);
  });

  it('rejects protected routes when no authentication is configured', () => {
    expect(run('none', false).allowed).toThrow(UnauthorizedException);
  });
});
