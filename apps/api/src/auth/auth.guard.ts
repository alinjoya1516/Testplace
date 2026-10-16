import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { type AuthenticatedRequest, IS_PUBLIC } from './current-user';
import { DevUserService } from './dev-user.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly devUser: DevUserService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    if (this.config.authMode === 'dev') {
      context.switchToHttp().getRequest<AuthenticatedRequest>().user = this.devUser.get();
      return true;
    }
    throw new UnauthorizedException();
  }
}
