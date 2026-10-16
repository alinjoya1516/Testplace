import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { strToU8, zipSync } from 'fflate';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

export async function createTestApp(env: Record<string, string> = {}): Promise<INestApplication> {
  const previous = { ...process.env };
  Object.assign(process.env, env);
  try {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    return app;
  } finally {
    process.env = previous;
  }
}

/** Empties every table except users, which the app creates at startup. */
export async function resetDatabase(app: INestApplication): Promise<void> {
  await app.get(PrismaService).$executeRawUnsafe(
    'TRUNCATE "Step", "TestCaseVersion", "TestCase", "Requirement", "ImportRevision" RESTART IDENTITY CASCADE',
  );
}

const samplesDir = join(__dirname, '../../../samples/features');

/** The sample `.feature` files, keyed by their path in the archive. */
export function sampleFiles(): Record<string, string> {
  return Object.fromEntries(
    readdirSync(samplesDir, { recursive: true, encoding: 'utf8' })
      .filter((path) => path.endsWith('.feature'))
      .map((path) => [path, readFileSync(join(samplesDir, path), 'utf8')]),
  );
}

export async function importFiles(app: INestApplication, files: Record<string, string>): Promise<void> {
  await request(app.getHttpServer()).post('/api/imports').attach('archive', zipFiles(files), 'cases.zip').expect(201);
}

export function zipFiles(files: Record<string, string>): Buffer {
  return Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([p, c]) => [p, strToU8(c)]))));
}
