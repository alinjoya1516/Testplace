import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import { DevUserService } from './auth/dev-user.service';
import { APP_CONFIG, type AppConfig, loadAppConfig } from './config/app-config';
import { IMPORT_CONVENTIONS, loadImportConventions } from './imports/import-conventions';
import { PrismaService } from './prisma/prisma.service';

/** Services every module needs. The guard makes every route private unless marked @Public(). */
@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadAppConfig(process.env) },
    {
      provide: IMPORT_CONVENTIONS,
      useFactory: (config: AppConfig) => loadImportConventions(config.importConventionsPath),
      inject: [APP_CONFIG],
    },
    PrismaService,
    DevUserService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [APP_CONFIG, IMPORT_CONVENTIONS, PrismaService],
})
export class CoreModule {}
