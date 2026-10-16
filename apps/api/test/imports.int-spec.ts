import type { INestApplication } from '@nestjs/common';
import type { ImportRevisionDetail, ImportRevisionSummary } from '@testplace/shared';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDatabase, sampleFiles, zipFiles } from './test-app';

const SAMPLE_IDS = [
  'TC-CRT-01',
  'TC-CRT-02',
  'TC-LOG-01.1',
  'TC-LOG-01.2',
  'TC-LOG-01.3',
  'TC-LOG-02',
  'TC-LOG-03',
  'TC-PRF-01',
  'TC-PRF-02',
];

describe('Imports (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  function upload(files: Record<string, string>, fields: Record<string, string> = {}) {
    const req = request(app.getHttpServer()).post('/api/imports');
    for (const [name, value] of Object.entries(fields)) void req.field(name, value);
    return req.attach('archive', zipFiles(files), 'cases.zip');
  }

  it('imports the sample set, then a second identical import creates no version (criterion 1)', async () => {
    const first = await upload(sampleFiles()).expect(201);
    const firstReport = (first.body as ImportRevisionDetail).report;
    expect(first.body).toMatchObject({ status: 'APPLIED', authorName: 'Dev Admin' });
    expect(firstReport.created).toEqual(SAMPLE_IDS);
    expect(await prisma.testCaseVersion.count()).toBe(9);
    expect(await prisma.testCase.findUniqueOrThrow({ where: { id: 'TC-LOG-03' } })).toMatchObject({
      status: 'DRAFT',
    });
    expect((await prisma.requirement.findMany({ orderBy: { id: 'asc' } })).map((r) => r.id)).toEqual([
      'REQ-12',
      'REQ-13',
      'REQ-20',
      'REQ-21',
      'REQ-22',
      'REQ-30',
    ]);
    const prf01 = await prisma.testCase.findUniqueOrThrow({
      where: { id: 'TC-PRF-01' },
      include: { currentVersion: { include: { steps: { orderBy: { position: 'asc' } } } }, requirements: true },
    });
    expect(prf01.requirements.map((r) => r.id)).toEqual(['REQ-12']);
    expect(prf01.currentVersion?.steps.map((s) => s.action)).toEqual([
      'I change my display name',
      'I log out and log in again',
    ]);

    const second = await upload(sampleFiles()).expect(201);
    expect((second.body as ImportRevisionDetail).report).toMatchObject({
      created: [],
      modified: [],
      restored: [],
      retired: [],
      unchanged: 9,
    });
    expect(await prisma.testCaseVersion.count()).toBe(9);
  });

  it('versions a modified case, retires missing cases and restores them', async () => {
    await upload(sampleFiles()).expect(201);

    const changed = sampleFiles();
    changed['account/user-profile.feature'] = changed['account/user-profile.feature'].replace(
      'When I change my display name',
      'When I change my display name to "Sample User"',
    );
    delete changed['orders/cart.feature'];
    const second = await upload(changed).expect(201);
    expect((second.body as ImportRevisionDetail).report).toMatchObject({
      created: [],
      modified: ['TC-PRF-01'],
      retired: ['TC-CRT-01', 'TC-CRT-02'],
      unchanged: 6,
    });
    const prf01 = await prisma.testCase.findUniqueOrThrow({
      where: { id: 'TC-PRF-01' },
      include: { currentVersion: true, versions: true },
    });
    expect(prf01.versions).toHaveLength(2);
    expect(prf01.currentVersion?.number).toBe(2);
    const crt01 = await prisma.testCase.findUniqueOrThrow({ where: { id: 'TC-CRT-01' }, include: { versions: true } });
    expect(crt01.status).toBe('RETIRED');
    expect(crt01.versions).toHaveLength(1);

    const third = await upload(sampleFiles()).expect(201);
    expect((third.body as ImportRevisionDetail).report).toMatchObject({
      modified: ['TC-PRF-01'],
      restored: ['TC-CRT-01', 'TC-CRT-02'],
      retired: [],
      unchanged: 6,
    });
    expect(await prisma.testCase.findUniqueOrThrow({ where: { id: 'TC-CRT-01' } })).toMatchObject({
      status: 'READY',
    });
  });

  it('updates the source location without creating a version when a scenario moves', async () => {
    await upload(sampleFiles()).expect(201);
    const moved = sampleFiles();
    moved['account/user-profile.feature'] = `\n\n${moved['account/user-profile.feature']}`;
    const second = await upload(moved).expect(201);
    expect((second.body as ImportRevisionDetail).report.unchanged).toBe(9);
    const prf01 = await prisma.testCase.findUniqueOrThrow({
      where: { id: 'TC-PRF-01' },
      include: { currentVersion: true },
    });
    expect(prf01.currentVersion).toMatchObject({ number: 1, sourceLine: 7 });
  });

  it('rejects duplicate and missing identifiers with file and line, without touching cases (criterion 2)', async () => {
    await upload(sampleFiles()).expect(201);
    const invalid = {
      ...sampleFiles(),
      'other/invalid.feature': [
        'Feature: Invalid',
        '',
        '  @TC-PRF-01',
        '  Scenario: Duplicate identifier',
        '    When I act',
        '',
        '  @smoke',
        '  Scenario: Missing identifier',
        '    When I act',
        '',
      ].join('\n'),
    };
    const response = await upload(invalid).expect(422);
    const body = response.body as ImportRevisionDetail;
    expect(body.status).toBe('REJECTED');
    expect(body.report.errors).toEqual([
      { file: 'other/invalid.feature', line: 8, message: expect.stringContaining('sans identifiant') },
      {
        file: 'other/invalid.feature',
        line: 4,
        message: 'Identifiant TC-PRF-01 déjà utilisé (account/user-profile.feature, ligne 5).',
      },
    ]);
    expect(body.report.created).toEqual([]);
    expect(await prisma.testCaseVersion.count()).toBe(9);
    expect(await prisma.testCase.count({ where: { status: 'RETIRED' } })).toBe(0);

    const history = (await request(app.getHttpServer()).get('/api/imports').expect(200))
      .body as ImportRevisionSummary[];
    expect(history.map((r) => r.status)).toEqual(['REJECTED', 'APPLIED']);
    expect(history[0].counts.errors).toBe(2);
  });

  it('records a rejected revision for a file that is not a zip', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/imports')
      .attach('archive', Buffer.from('plain text'), 'notes.txt')
      .expect(422);
    expect((response.body as ImportRevisionDetail).report.errors).toEqual([
      { file: 'notes.txt', message: "Le fichier n'est pas une archive .zip." },
    ]);
  });

  it('stores the Git commit and returns a revision by id', async () => {
    const created = (await upload(sampleFiles(), { gitCommit: 'a1b2c3d' }).expect(201)).body as ImportRevisionDetail;
    const fetched = await request(app.getHttpServer()).get(`/api/imports/${created.id}`).expect(200);
    expect(fetched.body).toMatchObject({ id: created.id, gitCommit: 'a1b2c3d', report: { archiveName: 'cases.zip' } });
    await request(app.getHttpServer()).get('/api/imports/999').expect(404);
  });

  it('answers 400 without archive or with an invalid Git commit', async () => {
    await request(app.getHttpServer()).post('/api/imports').expect(400);
    await upload(sampleFiles(), { gitCommit: 'not-a-commit' }).expect(400);
    expect(await prisma.importRevision.count()).toBe(0);
  });
});

describe('Imports limits and access (integration)', () => {
  it('answers 413 when the archive exceeds the configured size', async () => {
    const app = await createTestApp({ IMPORT_MAX_ARCHIVE_BYTES: '100' });
    try {
      await request(app.getHttpServer())
        .post('/api/imports')
        .attach('archive', zipFiles(sampleFiles()), 'cases.zip')
        .expect(413);
    } finally {
      await app.close();
    }
  });

  it('refuses imports without an authenticated user, but keeps health public', async () => {
    const app = await createTestApp({ AUTH_MODE: 'none' });
    try {
      await request(app.getHttpServer()).get('/api/imports').expect(401);
      await request(app.getHttpServer()).get('/api/health').expect(200);
    } finally {
      await app.close();
    }
  });
});
