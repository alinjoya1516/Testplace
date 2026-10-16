import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      // No storage option: the archive stays in memory and is never written to disk.
      useFactory: (config: AppConfig) => ({
        limits: { fileSize: config.importLimits.maxArchiveBytes, files: 1 },
      }),
      inject: [APP_CONFIG],
    }),
  ],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
