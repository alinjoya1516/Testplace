import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// npm scripts run from apps/api; the .env file is shared with docker compose at the repo root.
if (existsSync('../../.env')) process.loadEnvFile('../../.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
