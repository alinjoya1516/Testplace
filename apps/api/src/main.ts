import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Outside docker compose the variables come from the .env file at the repo root.
const envFile = join(__dirname, '../../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(process.env['PORT'] ?? 3000);
}
void bootstrap();
