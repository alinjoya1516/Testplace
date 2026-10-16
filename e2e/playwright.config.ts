import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { testDatabaseUrl } from '../apps/api/test/test-database';

const port = 3100;

export default defineConfig({
  testDir: './tests',
  // Every test empties the same database.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // The built API serves the built front: run `npm run build` first.
  webServer: {
    command: 'npx prisma migrate deploy && node dist/main',
    cwd: join(__dirname, '../apps/api'),
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL: testDatabaseUrl(),
      NODE_ENV: 'test',
      AUTH_MODE: 'dev',
      PORT: String(port),
    },
  },
});
