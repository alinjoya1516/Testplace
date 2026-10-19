import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { CampaignsModule } from './campaigns/campaigns.module';
import { CasesModule } from './cases/cases.module';
import { CoreModule } from './core.module';
import { HealthController } from './health/health.controller';
import { ImportsModule } from './imports/imports.module';
import { UsersController } from './users/users.controller';

const webDist = process.env['WEB_DIST_PATH'] ?? join(__dirname, '../../web/dist/web/browser');

@Module({
  imports: [
    CoreModule,
    ImportsModule,
    CasesModule,
    CampaignsModule,
    // In development the front is served by `ng serve`, so the build may not exist.
    ...(existsSync(webDist)
      ? [ServeStaticModule.forRoot({ rootPath: webDist, exclude: ['/api/{*path}'] })]
      : []),
  ],
  controllers: [HealthController, UsersController],
})
export class AppModule {}
