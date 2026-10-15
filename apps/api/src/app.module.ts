import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { HealthController } from './health/health.controller';
import { PrismaService } from './prisma/prisma.service';

const webDist = process.env['WEB_DIST_PATH'] ?? join(__dirname, '../../web/dist/web/browser');

@Module({
  // In development the front is served by `ng serve`, so the build may not exist.
  imports: existsSync(webDist)
    ? [ServeStaticModule.forRoot({ rootPath: webDist, exclude: ['/api/{*path}'] })]
    : [],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
