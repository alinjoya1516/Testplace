import type { INestApplication } from '@nestjs/common';
import type { TestCaseDetail, TestCaseList } from '@testplace/shared';
import request from 'supertest';
import { createTestApp, importFiles, resetDatabase, sampleFiles } from './test-app';

describe('Cases (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    await importFiles(app, sampleFiles());
  });

  async function listIds(query: string): Promise<string[]> {
    const response = await request(app.getHttpServer()).get(`/api/cases${query}`).expect(200);
    return (response.body as TestCaseList).items.map((c) => c.id);
  }

  it('lists cases in natural order with the values available for filters', async () => {
    const response = await request(app.getHttpServer()).get('/api/cases').expect(200);
    const list = response.body as TestCaseList;
    expect(list.items.map((c) => c.id)).toEqual([
      'TC-CRT-01',
      'TC-CRT-02',
      'TC-LOG-01.1',
      'TC-LOG-01.2',
      'TC-LOG-01.3',
      'TC-LOG-02',
      'TC-LOG-03',
      'TC-PRF-01',
      'TC-PRF-02',
    ]);
    expect(list.items.find((c) => c.id === 'TC-PRF-02')).toEqual({
      id: 'TC-PRF-02',
      title: 'A profile picture can be replaced',
      status: 'READY',
      priority: 'standard',
      tags: ['@JIRA-DEMO-42', '@REQ-12', '@REQ-13', '@TC-PRF-02', '@manual', '@standard'],
      requirementIds: ['REQ-12', 'REQ-13'],
      versionNumber: 1,
    });
    expect(list.facets).toEqual({
      tags: ['@critical', '@manual', '@quarantine', '@smoke', '@standard'],
      priorities: ['critical', 'standard'],
      requirementIds: ['REQ-12', 'REQ-13', 'REQ-20', 'REQ-21', 'REQ-22', 'REQ-30'],
    });
  });

  it('searches the identifier, the title and the steps, ignoring case', async () => {
    expect(await listIds('?q=prf')).toEqual(['TC-PRF-01', 'TC-PRF-02']);
    expect(await listIds('?q=DISCOUNT%20code')).toEqual(['TC-CRT-02']);
    expect(await listIds('?q=unlock%20link')).toEqual(['TC-LOG-02', 'TC-LOG-03']);
    expect(await listIds('?q=nothing%20matches')).toEqual([]);
  });

  it('filters by tags (all required, @ optional), priority, status and requirement', async () => {
    expect(await listIds('?tag=critical&tag=@manual')).toEqual([
      'TC-CRT-01',
      'TC-LOG-01.1',
      'TC-LOG-01.2',
      'TC-LOG-01.3',
      'TC-PRF-01',
    ]);
    expect(await listIds('?tag=critical&tag=smoke')).toEqual(['TC-LOG-01.1', 'TC-LOG-01.2', 'TC-LOG-01.3']);
    expect(await listIds('?priority=standard')).toEqual(['TC-CRT-02', 'TC-LOG-02', 'TC-LOG-03', 'TC-PRF-02']);
    expect(await listIds('?status=DRAFT')).toEqual(['TC-LOG-03']);
    expect(await listIds('?requirement=REQ-21')).toEqual(['TC-LOG-01.3']);
    expect(await listIds('?q=log&priority=standard&status=READY')).toEqual(['TC-LOG-02']);
  });

  it('hides retired cases unless that status is asked for', async () => {
    const withoutCart = sampleFiles();
    delete withoutCart['orders/cart.feature'];
    await importFiles(app, withoutCart);
    expect(await listIds('')).not.toContain('TC-CRT-01');
    expect(await listIds('?status=RETIRED')).toEqual(['TC-CRT-01', 'TC-CRT-02']);
  });

  it('rejects an unknown status', async () => {
    await request(app.getHttpServer()).get('/api/cases?status=DONE').expect(400);
  });

  it('returns the case sheet of the specification example (§4.2)', async () => {
    const response = await request(app.getHttpServer()).get('/api/cases/TC-PRF-01').expect(200);
    const detail = response.body as TestCaseDetail;
    expect(detail).toMatchObject({ id: 'TC-PRF-01', status: 'READY', currentVersionNumber: 1 });
    expect(detail.versions.map((v) => v.number)).toEqual([1]);
    expect(detail.version).toMatchObject({
      number: 1,
      title: 'A new display name is kept after logging in again',
      objective: 'Check that a profile change is saved and shown everywhere.',
      testData: 'A test account with a known display name.',
      preconditions: ['I am logged in with a test account'],
      steps: [
        { position: 1, action: 'I change my display name', expectedResult: '' },
        {
          position: 2,
          action: 'I log out and log in again',
          expectedResult:
            'the new display name is shown in the header\nthe new display name is shown on the profile page',
        },
      ],
      priority: 'critical',
      requirementIds: ['REQ-12'],
      sourceFile: 'account/user-profile.feature',
      sourceLine: 5,
    });
  });

  it('keeps older versions readable', async () => {
    const changed = sampleFiles();
    changed['account/user-profile.feature'] = changed['account/user-profile.feature'].replace(
      'When I change my display name',
      'When I change my display name to "Sample User"',
    );
    await importFiles(app, changed);

    const current = (await request(app.getHttpServer()).get('/api/cases/TC-PRF-01').expect(200))
      .body as TestCaseDetail;
    expect(current.currentVersionNumber).toBe(2);
    expect(current.versions.map((v) => v.number)).toEqual([2, 1]);
    expect(current.version.steps[0].action).toBe('I change my display name to "Sample User"');

    const first = (await request(app.getHttpServer()).get('/api/cases/TC-PRF-01?version=1').expect(200))
      .body as TestCaseDetail;
    expect(first.version.number).toBe(1);
    expect(first.version.steps[0].action).toBe('I change my display name');
  });

  it('answers 404 for an unknown case or version, 400 for an invalid version', async () => {
    await request(app.getHttpServer()).get('/api/cases/TC-NOPE').expect(404);
    await request(app.getHttpServer()).get('/api/cases/TC-PRF-01?version=9').expect(404);
    await request(app.getHttpServer()).get('/api/cases/TC-PRF-01?version=abc').expect(400);
  });
});
