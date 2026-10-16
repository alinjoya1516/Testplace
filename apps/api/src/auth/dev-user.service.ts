import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserInfo } from './current-user';

const DEV_USER = {
  directoryId: 'dev-admin',
  name: 'Dev Admin',
  email: 'dev.admin@example.test',
  role: 'ADMIN',
} as const;

/** Fixed administrator used while AUTH_MODE=dev, stored in the database so imports have an author. */
@Injectable()
export class DevUserService implements OnApplicationBootstrap {
  private user: CurrentUserInfo | undefined;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async onApplicationBootstrap() {
    if (this.config.authMode !== 'dev') return;
    const { id, name, role } = await this.prisma.user.upsert({
      where: { directoryId: DEV_USER.directoryId },
      create: DEV_USER,
      update: {},
    });
    this.user = { id, name, role };
  }

  get(): CurrentUserInfo {
    if (!this.user) throw new Error('Dev user is not available: AUTH_MODE is not "dev"');
    return this.user;
  }
}
