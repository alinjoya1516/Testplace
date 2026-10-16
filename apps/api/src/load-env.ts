import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Imported first by main.ts so that every module sees the variables when it loads.
// Outside docker compose they come from the .env file at the repo root; existing variables win.
const envFile = join(__dirname, '../../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
