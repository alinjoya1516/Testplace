import { testDatabaseUrl } from './test-database';

process.env['DATABASE_URL'] = testDatabaseUrl();
process.env['NODE_ENV'] = 'test';
process.env['AUTH_MODE'] = 'dev';
