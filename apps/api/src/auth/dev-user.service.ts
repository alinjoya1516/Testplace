import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserInfo } from './current-user';

const DEV_ADMIN = {
  directoryId: 'dev-admin',
  name: 'Dev Admin',
  email: 'dev.admin@example.test',
  role: 'ADMIN',
} as const;

/** Synthetic executors, so that assignment can be tried before the directory is connected. */
const DEV_EXECUTORS = [
  { directoryId: 'dev-executor-a', name: 'Exécutant A', email: 'executor.a@example.test', role: 'EXECUTOR' },
  { directoryId: 'dev-executor-b', name: 'Exécutant B', email: 'executor.b@example.test', role: 'EXECUTOR' },
] as const;

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
    for (const executor of DEV_EXECUTORS) {
      await this.prisma.user.upsert({ where: { directoryId: executor.directoryId }, create: executor, update: {} });
    }
    const { id, name, role } = await this.prisma.user.upsert({
      where: { directoryId: DEV_ADMIN.directoryId },
      create: DEV_ADMIN,
      update: {},
    });
    this.user = { id, name, role };
  }

  get(): CurrentUserInfo {
    if (!this.user) throw new Error('Dev user is not available: AUTH_MODE is not "dev"');
    return this.user;
  }
}
