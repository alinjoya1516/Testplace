import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Returns the URL of the integration test database. Refuses anything that could be the
 * development database, since the tests wipe it.
 */
export function testDatabaseUrl(): string {
  const envFile = join(__dirname, '../../../.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const url = process.env['TEST_DATABASE_URL'];
  if (!url) throw new Error('TEST_DATABASE_URL must be set to run integration tests (see .env.example)');
  if (url === process.env['DATABASE_URL']) throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL');
  if (!new URL(url).pathname.includes('test')) {
    throw new Error('The database name in TEST_DATABASE_URL must contain "test"');
  }
  return url;
}
