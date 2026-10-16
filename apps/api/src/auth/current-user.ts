import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from '../generated/prisma/client';

export type CurrentUserInfo = {
  id: string;
  name: string;
  role: Role;
};

export type AuthenticatedRequest = Request & { user?: CurrentUserInfo };

export const IS_PUBLIC = 'isPublic';

/** Opens a route to unauthenticated requests: every other route requires a user. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  if (!user) throw new Error('CurrentUser used on a route without an authenticated user');
  return user;
});
