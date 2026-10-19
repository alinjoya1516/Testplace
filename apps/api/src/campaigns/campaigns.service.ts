import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CampaignDetail,
  CampaignInput,
  CampaignStatus,
  CampaignSummary,
  SelectionPreview,
} from '@testplace/shared';
import { naturalOrder } from '../common/natural-order';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeCampaignStats, needsReplay } from './campaign-stats';
import { InvalidTagExpression, compileTagExpression } from './tag-selection';

const STATUS_NAMES: Record<CampaignStatus, string> = {
  DRAFT: 'en préparation',
  RUNNING: 'en cours',
  CLOSED: 'clôturée',
};

const summaryInclude = {
  executions: { select: { status: true } },
} satisfies Prisma.CampaignInclude;

const detailInclude = {
  createdBy: { select: { name: true } },
  executions: {
    orderBy: { position: 'asc' },
    include: {
      assignee: { select: { id: true, name: true, role: true } },
      testCaseVersion: { select: { number: true, title: true } },
      testCase: { select: { currentVersion: { select: { number: true } } } },
    },
  },
} satisfies Prisma.CampaignInclude;

type CampaignWithSummary = Prisma.CampaignGetPayload<{ include: typeof summaryInclude }>;
type CampaignWithDetail = Prisma.CampaignGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async preview(tagExpression: string, includeDrafts: boolean): Promise<SelectionPreview> {
    const caseIds = (await this.select(this.prisma, tagExpression, includeDrafts)).map((c) => c.id);
    return { count: caseIds.length, caseIds };
  }

  async list(): Promise<CampaignSummary[]> {
    const campaigns = await this.prisma.campaign.findMany({ orderBy: { id: 'desc' }, include: summaryInclude });
    return campaigns.map(toSummary);
  }

  async get(id: number): Promise<CampaignDetail> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id }, include: detailInclude });
    if (!campaign) throw new NotFoundException(`Campagne ${id} introuvable.`);
    const selection =
      campaign.status === 'DRAFT' ? await this.preview(campaign.tagExpression, campaign.includeDrafts) : null;
    return toDetail(campaign, selection);
  }

  async create(input: CampaignInput, userId: string): Promise<CampaignDetail> {
    compile(input.tagExpression);
    const { id } = await this.prisma.campaign.create({ data: { ...toData(input), createdById: userId } });
    return this.get(id);
  }

  async update(id: number, input: CampaignInput): Promise<CampaignDetail> {
    compile(input.tagExpression);
    await this.requireStatus(id, 'DRAFT', 'modifier');
    await this.prisma.campaign.update({ where: { id }, data: toData(input) });
    return this.get(id);
  }

  /** Freezes the selection (EF-07): each case is executed in its version current at launch. */
  async launch(id: number): Promise<CampaignDetail> {
    await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.findUnique({ where: { id } });
      if (!campaign) throw new NotFoundException(`Campagne ${id} introuvable.`);
      // The conditional update makes two simultaneous launches impossible.
      const { count } = await tx.campaign.updateMany({
        where: { id, status: 'DRAFT' },
        data: { status: 'RUNNING', launchedAt: new Date() },
      });
      if (count === 0) throw wrongStatus(campaign.status, 'lancer');

      const cases = await this.select(tx, campaign.tagExpression, campaign.includeDrafts);
      if (cases.length === 0) {
        throw new BadRequestException('Aucun cas ne correspond à la sélection : la campagne ne peut pas être lancée.');
      }
      const previousAssignees = new Map<string, string | null>();
      if (campaign.duplicatedFromId !== null) {
        const previous = await tx.execution.findMany({
          where: { campaignId: campaign.duplicatedFromId },
          select: { testCaseId: true, assigneeId: true },
        });
        for (const execution of previous) previousAssignees.set(execution.testCaseId, execution.assigneeId);
      }
      await tx.execution.createMany({
        data: cases.map((c, index) => ({
          campaignId: id,
          testCaseId: c.id,
          testCaseVersionId: c.currentVersionId,
          position: index + 1,
          assigneeId: previousAssignees.get(c.id) ?? null,
        })),
      });
    });
    return this.get(id);
  }

  /** EF-08: assigns one or several executions; a null assignee removes the assignment. */
  async assign(id: number, executionIds: number[], assigneeId: string | null): Promise<CampaignDetail> {
    await this.requireStatus(id, 'RUNNING', 'affecter les cas d’une campagne');
    if (assigneeId !== null) {
      const assignee = await this.prisma.user.findUnique({ where: { id: assigneeId } });
      if (!assignee) throw new BadRequestException('Exécutant introuvable.');
      if (assignee.role === 'READER') {
        throw new BadRequestException(`${assignee.name} est lecteur et ne peut pas exécuter de cas.`);
      }
    }
    const { count } = await this.prisma.execution.updateMany({
      where: { campaignId: id, id: { in: executionIds } },
      data: { assigneeId },
    });
    if (count !== new Set(executionIds).size) {
      throw new BadRequestException("Certaines exécutions n'appartiennent pas à cette campagne.");
    }
    return this.get(id);
  }

  /** EF-09: closing flags the campaign for replay above the share of Blocked cases. */
  async close(id: number): Promise<CampaignDetail> {
    await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.findUnique({ where: { id }, include: summaryInclude });
      if (!campaign) throw new NotFoundException(`Campagne ${id} introuvable.`);
      const stats = computeCampaignStats(campaign.executions.map((e) => e.status));
      const { count } = await tx.campaign.updateMany({
        where: { id, status: 'RUNNING' },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          needsReplay: needsReplay(stats, this.config.campaignReplayThreshold),
        },
      });
      if (count === 0) throw wrongStatus(campaign.status, 'clôturer');
    });
    return this.get(id);
  }

  /** EF-10: a new draft on another build; the selection is evaluated again at its launch. */
  async duplicate(id: number, build: string, name: string | undefined, userId: string): Promise<CampaignDetail> {
    const source = await this.prisma.campaign.findUnique({ where: { id } });
    if (!source) throw new NotFoundException(`Campagne ${id} introuvable.`);
    const copy = await this.prisma.campaign.create({
      data: {
        name: name ?? `${source.name} (copie)`,
        build,
        environment: source.environment,
        tagExpression: source.tagExpression,
        includeDrafts: source.includeDrafts,
        createdById: userId,
        duplicatedFromId: source.id,
      },
    });
    return this.get(copy.id);
  }

  private async select(
    db: Prisma.TransactionClient,
    tagExpression: string,
    includeDrafts: boolean,
  ): Promise<{ id: string; currentVersionId: string }[]> {
    const matches = compile(tagExpression);
    const cases = await db.testCase.findMany({
      where: { status: { in: includeDrafts ? ['READY', 'DRAFT'] : ['READY'] }, currentVersionId: { not: null } },
      select: { id: true, tags: true, currentVersionId: true },
    });
    return cases
      .filter((c) => matches(c.tags))
      .map((c) => ({ id: c.id, currentVersionId: c.currentVersionId as string }))
      .sort((a, b) => naturalOrder(a.id, b.id));
  }

  private async requireStatus(id: number, expected: CampaignStatus, action: string): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id }, select: { status: true } });
    if (!campaign) throw new NotFoundException(`Campagne ${id} introuvable.`);
    if (campaign.status !== expected) throw wrongStatus(campaign.status, action);
  }
}

function compile(tagExpression: string) {
  try {
    return compileTagExpression(tagExpression);
  } catch (error) {
    if (error instanceof InvalidTagExpression) throw new BadRequestException(error.message);
    throw error;
  }
}

function wrongStatus(status: CampaignStatus, action: string): ConflictException {
  return new ConflictException(`Impossible de ${action} : la campagne est ${STATUS_NAMES[status]}.`);
}

function toData(input: CampaignInput) {
  return {
    name: input.name,
    build: input.build,
    environment: input.environment,
    tagExpression: input.tagExpression,
    includeDrafts: input.includeDrafts,
    plannedStart: input.plannedStart ? new Date(input.plannedStart) : null,
    plannedEnd: input.plannedEnd ? new Date(input.plannedEnd) : null,
  };
}

function isoDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function toSummary(campaign: CampaignWithSummary | CampaignWithDetail): CampaignSummary {
  return {
    id: campaign.id,
    name: campaign.name,
    build: campaign.build,
    environment: campaign.environment,
    status: campaign.status,
    needsReplay: campaign.needsReplay,
    plannedStart: isoDate(campaign.plannedStart),
    plannedEnd: isoDate(campaign.plannedEnd),
    createdAt: campaign.createdAt.toISOString(),
    stats: computeCampaignStats(campaign.executions.map((e) => e.status)),
  };
}

function toDetail(campaign: CampaignWithDetail, selection: SelectionPreview | null): CampaignDetail {
  return {
    ...toSummary(campaign),
    tagExpression: campaign.tagExpression,
    includeDrafts: campaign.includeDrafts,
    launchedAt: campaign.launchedAt?.toISOString() ?? null,
    closedAt: campaign.closedAt?.toISOString() ?? null,
    createdByName: campaign.createdBy.name,
    duplicatedFromId: campaign.duplicatedFromId,
    selection,
    executions: campaign.executions.map((e) => ({
      id: e.id,
      position: e.position,
      testCaseId: e.testCaseId,
      title: e.testCaseVersion.title,
      versionNumber: e.testCaseVersion.number,
      newerVersionAvailable: (e.testCase.currentVersion?.number ?? 0) > e.testCaseVersion.number,
      assignee: e.assignee,
      status: e.status,
      elapsedSeconds: e.elapsedSeconds,
    })),
  };
}
