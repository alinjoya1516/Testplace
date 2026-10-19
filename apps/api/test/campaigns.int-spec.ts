import type { INestApplication } from '@nestjs/common';
import type { CampaignDetail, CampaignSummary, SelectionPreview, UserSummary } from '@testplace/shared';
import request from 'supertest';
import type { ResultStatus } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, importFiles, resetDatabase, sampleFiles } from './test-app';

const CRITERION_3 = '@critical and not @quarantine';
const CRITICAL_IDS = ['TC-CRT-01', 'TC-LOG-01.1', 'TC-LOG-01.2', 'TC-LOG-01.3', 'TC-PRF-01'];

describe('Campaigns (integration)', () => {
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
    await importFiles(app, sampleFiles());
  });

  const api = () => request(app.getHttpServer());

  function campaignInput(overrides: Record<string, unknown> = {}) {
    return {
      name: 'Release 2.4 regression',
      build: '2.4.0-rc1',
      environment: 'Recette',
      tagExpression: CRITERION_3,
      includeDrafts: false,
      plannedStart: '2026-10-20',
      plannedEnd: '2026-10-24',
      ...overrides,
    };
  }

  async function createCampaign(overrides: Record<string, unknown> = {}): Promise<CampaignDetail> {
    return (await api().post('/api/campaigns').send(campaignInput(overrides)).expect(201)).body as CampaignDetail;
  }

  async function launch(id: number): Promise<CampaignDetail> {
    return (await api().post(`/api/campaigns/${id}/launch`).expect(200)).body as CampaignDetail;
  }

  async function setStatuses(campaignId: number, statuses: ResultStatus[]): Promise<void> {
    const executions = await prisma.execution.findMany({ where: { campaignId }, orderBy: { position: 'asc' } });
    for (const [index, status] of statuses.entries()) {
      await prisma.execution.update({ where: { id: executions[index].id }, data: { status } });
    }
  }

  async function executor(name: string): Promise<UserSummary> {
    const users = (await api().get('/api/users/assignable').expect(200)).body as UserSummary[];
    const found = users.find((u) => u.name === name);
    if (!found) throw new Error(`No user ${name}`);
    return found;
  }

  describe('selection preview (EF-06)', () => {
    async function preview(tagExpression: string, includeDrafts = false) {
      return (await api().post('/api/campaigns/preview').send({ tagExpression, includeDrafts }).expect(200))
        .body as SelectionPreview;
    }

    it('selects the critical cases outside quarantine (criterion 3)', async () => {
      expect(await preview(CRITERION_3)).toEqual({ count: 5, caseIds: CRITICAL_IDS });
    });

    it('excludes draft cases unless asked, and retired cases always', async () => {
      expect((await preview('')).count).toBe(8);
      expect((await preview('', true)).count).toBe(9);
      const withoutCart = sampleFiles();
      delete withoutCart['orders/cart.feature'];
      await importFiles(app, withoutCart);
      expect((await preview('', true)).caseIds).not.toContain('TC-CRT-01');
    });

    it('rejects an invalid expression or a tag without @', async () => {
      const syntax = await api().post('/api/campaigns/preview').send({ tagExpression: '@a and' }).expect(400);
      expect((syntax.body as { message: string }).message).toMatch(/Expression de tags invalide/);
      const noAt = await api().post('/api/campaigns/preview').send({ tagExpression: 'critical' }).expect(400);
      expect((noAt.body as { message: string }).message).toBe(
        'Expression de tags invalide : « critical » doit commencer par @.',
      );
    });
  });

  describe('creation and edition', () => {
    it('creates a draft campaign showing its live selection', async () => {
      const campaign = await createCampaign();
      expect(campaign).toMatchObject({
        status: 'DRAFT',
        name: 'Release 2.4 regression',
        plannedStart: '2026-10-20',
        plannedEnd: '2026-10-24',
        createdByName: 'Dev Admin',
        selection: { count: 5 },
        executions: [],
      });
    });

    it('validates the fields', async () => {
      await api().post('/api/campaigns').send(campaignInput({ name: '  ' })).expect(400);
      await api().post('/api/campaigns').send(campaignInput({ plannedStart: '2026-10-24', plannedEnd: '2026-10-20' })).expect(400);
      await api().post('/api/campaigns').send(campaignInput({ plannedStart: '20/10/2026' })).expect(400);
      await api().post('/api/campaigns').send(campaignInput({ tagExpression: '(@a' })).expect(400);
      expect(await prisma.campaign.count()).toBe(0);
    });

    it('can be edited while in draft only', async () => {
      const campaign = await createCampaign();
      const edited = (await api().put(`/api/campaigns/${campaign.id}`).send(campaignInput({ tagExpression: '@smoke' })).expect(200))
        .body as CampaignDetail;
      expect(edited.selection?.count).toBe(4);
      await launch(campaign.id);
      await api().put(`/api/campaigns/${campaign.id}`).send(campaignInput()).expect(409);
    });
  });

  describe('launch (EF-07)', () => {
    it('creates one execution per selected case, in natural order', async () => {
      const campaign = await launch((await createCampaign()).id);
      expect(campaign.status).toBe('RUNNING');
      expect(campaign.selection).toBeNull();
      expect(campaign.executions.map((e) => [e.position, e.testCaseId, e.status])).toEqual(
        CRITICAL_IDS.map((id, index) => [index + 1, id, 'NOT_RUN']),
      );
      expect(campaign.stats).toMatchObject({ total: 5, notRun: 5, executionRate: 0, passRate: null });
    });

    it('cannot be launched twice', async () => {
      const { id } = await createCampaign();
      await launch(id);
      await api().post(`/api/campaigns/${id}/launch`).expect(409);
    });

    it('refuses an empty selection and stays in draft', async () => {
      const { id } = await createCampaign({ tagExpression: '@nonexistent' });
      await api().post(`/api/campaigns/${id}/launch`).expect(400);
      expect((await prisma.campaign.findUniqueOrThrow({ where: { id } })).status).toBe('DRAFT');
    });

    it('keeps its frozen versions when cases are imported again, and flags newer versions', async () => {
      const { id } = await launch((await createCampaign()).id);
      const changed = sampleFiles();
      changed['account/user-profile.feature'] = changed['account/user-profile.feature'].replace(
        'When I change my display name',
        'When I change my display name to "Sample User"',
      );
      delete changed['orders/cart.feature'];
      await importFiles(app, changed);

      const campaign = (await api().get(`/api/campaigns/${id}`).expect(200)).body as CampaignDetail;
      expect(campaign.executions.map((e) => e.testCaseId)).toEqual(CRITICAL_IDS);
      const prf01 = campaign.executions.find((e) => e.testCaseId === 'TC-PRF-01');
      expect(prf01).toMatchObject({ versionNumber: 1, newerVersionAvailable: true });
      expect(campaign.executions.filter((e) => e.newerVersionAvailable)).toHaveLength(1);
    });
  });

  describe('assignment (EF-08)', () => {
    it('assigns several cases at once and removes an assignment', async () => {
      const campaign = await launch((await createCampaign()).id);
      const a = await executor('Exécutant A');
      const ids = campaign.executions.slice(0, 3).map((e) => e.id);
      const assigned = (await api().post(`/api/campaigns/${campaign.id}/assignments`).send({ executionIds: ids, assigneeId: a.id }).expect(200))
        .body as CampaignDetail;
      expect(assigned.executions.map((e) => e.assignee?.name ?? null)).toEqual([
        'Exécutant A',
        'Exécutant A',
        'Exécutant A',
        null,
        null,
      ]);
      const unassigned = (await api().post(`/api/campaigns/${campaign.id}/assignments`).send({ executionIds: [ids[0]], assigneeId: null }).expect(200))
        .body as CampaignDetail;
      expect(unassigned.executions[0].assignee).toBeNull();
    });

    it('refuses a reader, an unknown execution or a campaign not running', async () => {
      const reader = await prisma.user.create({
        data: { directoryId: 'reader', name: 'Lecteur', email: 'reader@example.test', role: 'READER' },
      });
      const campaign = await launch((await createCampaign()).id);
      const executionIds = [campaign.executions[0].id];
      await api().post(`/api/campaigns/${campaign.id}/assignments`).send({ executionIds, assigneeId: reader.id }).expect(400);
      await api().post(`/api/campaigns/${campaign.id}/assignments`).send({ executionIds: [99_999], assigneeId: null }).expect(400);
      const draft = await createCampaign();
      await api().post(`/api/campaigns/${draft.id}/assignments`).send({ executionIds, assigneeId: null }).expect(409);
      await prisma.user.delete({ where: { id: reader.id } });
    });

    it('lists the people who can be assigned, without readers', async () => {
      const users = (await api().get('/api/users/assignable').expect(200)).body as UserSummary[];
      expect(users.map((u) => u.name)).toEqual(['Dev Admin', 'Exécutant A', 'Exécutant B']);
    });
  });

  describe('closing (EF-09)', () => {
    it('flags the campaign for replay above 10 % of blocked cases', async () => {
      const { id } = await launch((await createCampaign()).id);
      await setStatuses(id, ['PASSED', 'PASSED', 'FAILED', 'BLOCKED', 'NOT_RUN']);
      const closed = (await api().post(`/api/campaigns/${id}/close`).expect(200)).body as CampaignDetail;
      expect(closed).toMatchObject({
        status: 'CLOSED',
        needsReplay: true,
        stats: { total: 5, passed: 2, failed: 1, blocked: 1, notRun: 1, executionRate: 0.8, passRate: 2 / 3, blockedShare: 0.2 },
      });
      expect(closed.closedAt).not.toBeNull();
      await api().post(`/api/campaigns/${id}/close`).expect(409);
    });

    it('does not flag a campaign without enough blocked cases', async () => {
      const { id } = await launch((await createCampaign()).id);
      await setStatuses(id, ['PASSED', 'PASSED', 'PASSED', 'FAILED', 'PASSED']);
      const closed = (await api().post(`/api/campaigns/${id}/close`).expect(200)).body as CampaignDetail;
      expect(closed).toMatchObject({ needsReplay: false, stats: { passRate: 0.8, executionRate: 1 } });
    });

    it('cannot close a draft', async () => {
      const { id } = await createCampaign();
      await api().post(`/api/campaigns/${id}/close`).expect(409);
    });
  });

  describe('duplication (EF-10)', () => {
    it('creates a draft for another build and reuses the assignments at launch', async () => {
      const source = await launch((await createCampaign()).id);
      const b = await executor('Exécutant B');
      await api()
        .post(`/api/campaigns/${source.id}/assignments`)
        .send({ executionIds: [source.executions[4].id], assigneeId: b.id })
        .expect(200);
      await api().post(`/api/campaigns/${source.id}/close`).expect(200);

      const copy = (await api().post(`/api/campaigns/${source.id}/duplicate`).send({ build: '2.4.0-rc2' }).expect(201))
        .body as CampaignDetail;
      expect(copy).toMatchObject({
        status: 'DRAFT',
        name: 'Release 2.4 regression (copie)',
        build: '2.4.0-rc2',
        environment: 'Recette',
        tagExpression: CRITERION_3,
        duplicatedFromId: source.id,
        plannedStart: null,
        selection: { count: 5 },
      });
      const launched = await launch(copy.id);
      expect(launched.executions.find((e) => e.testCaseId === 'TC-PRF-01')?.assignee?.name).toBe('Exécutant B');
      expect(launched.executions.filter((e) => e.assignee !== null)).toHaveLength(1);
    });

    it('requires a build', async () => {
      const { id } = await createCampaign();
      await api().post(`/api/campaigns/${id}/duplicate`).send({}).expect(400);
    });
  });

  it('lists campaigns, newest first, with their statistics', async () => {
    const first = await launch((await createCampaign({ name: 'First' })).id);
    await createCampaign({ name: 'Second' });
    await setStatuses(first.id, ['PASSED']);
    const list = (await api().get('/api/campaigns').expect(200)).body as CampaignSummary[];
    expect(list.map((c) => [c.name, c.status, c.stats.total, c.stats.passed])).toEqual([
      ['Second', 'DRAFT', 0, 0],
      ['First', 'RUNNING', 5, 1],
    ]);
  });
});
