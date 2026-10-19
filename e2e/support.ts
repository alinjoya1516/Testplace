import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { Client } from 'pg';
import { testDatabaseUrl } from '../apps/api/test/test-database';

/** Empties every table except users, which the API creates at startup. */
export async function resetDatabase(): Promise<void> {
  const client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  try {
    await client.query(
      'TRUNCATE "ExecutionStatusChange", "StepResult", "Execution", "Campaign", "Step", "TestCaseVersion", "TestCase", "Requirement", "ImportRevision" RESTART IDENTITY CASCADE',
    );
  } finally {
    await client.end();
  }
}

const samplesDir = join(__dirname, '../samples/features');

export function sampleFiles(): Record<string, string> {
  return Object.fromEntries(
    readdirSync(samplesDir, { recursive: true, encoding: 'utf8' })
      .filter((path) => path.endsWith('.feature'))
      .map((path) => [path, readFileSync(join(samplesDir, path), 'utf8')]),
  );
}

export function zipArchive(name: string, files: Record<string, string>) {
  const entries = Object.fromEntries(Object.entries(files).map(([path, content]) => [path, strToU8(content)]));
  return { name, mimeType: 'application/zip', buffer: Buffer.from(zipSync(entries)) };
}
