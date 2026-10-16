import './load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  // Localhost by default: with AUTH_MODE=dev anyone reaching the port is an administrator.
  // The Docker image sets HOST=0.0.0.0, its port being published on localhost only by compose.
  await app.listen(process.env['PORT'] ?? 3000, process.env['HOST'] ?? '127.0.0.1');
}
void bootstrap();
