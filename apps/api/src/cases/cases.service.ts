import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  TestCaseDetail,
  TestCaseList,
  TestCaseStatus,
  TestCaseSummary,
} from '@testplace/shared';
import type { Prisma } from '../generated/prisma/client';
import { IMPORT_CONVENTIONS, type ImportConventions } from '../imports/import-conventions';
import { PrismaService } from '../prisma/prisma.service';

export type CaseFilters = {
  q?: string;
  tags: string[];
  priority?: string;
  status?: TestCaseStatus;
  requirement?: string;
};

const naturalOrder = new Intl.Collator('en', { numeric: true }).compare;

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(IMPORT_CONVENTIONS) private readonly conventions: ImportConventions,
  ) {}

  async list(filters: CaseFilters): Promise<TestCaseList> {
    const where: Prisma.TestCaseWhereInput = {
      status: filters.status ?? { not: 'RETIRED' },
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.tags.length > 0 ? { tags: { hasEvery: filters.tags } } : {}),
      ...(filters.requirement ? { requirements: { some: { id: filters.requirement } } } : {}),
    };
    if (filters.q) {
      const text = { contains: filters.q, mode: 'insensitive' as const };
      where.OR = [
        { id: text },
        { currentVersion: { is: { title: text } } },
        {
          currentVersion: {
            is: { steps: { some: { OR: [{ action: text }, { expectedResult: text }] } } },
          },
        },
      ];
    }

    const [cases, all] = await Promise.all([
      this.prisma.testCase.findMany({
        where,
        select: {
          id: true,
          status: true,
          priority: true,
          tags: true,
          requirements: { select: { id: true } },
          currentVersion: { select: { number: true, title: true } },
        },
      }),
      this.prisma.testCase.findMany({
        select: { tags: true, priority: true, requirements: { select: { id: true } } },
      }),
    ]);

    const items: TestCaseSummary[] = cases
      .map((c) => ({
        id: c.id,
        title: c.currentVersion?.title ?? '',
        status: c.status,
        priority: c.priority,
        tags: c.tags,
        requirementIds: c.requirements.map((r) => r.id).sort(naturalOrder),
        versionNumber: c.currentVersion?.number ?? 0,
      }))
      .sort((a, b) => naturalOrder(a.id, b.id));

    // Identifier, requirement and Jira tags have their own column or filter.
    const { caseIdTagPrefix, requirementTagPrefix, jiraTagPrefix } = this.conventions;
    const isFilterTag = (tag: string) =>
      ![caseIdTagPrefix, requirementTagPrefix, jiraTagPrefix].some((prefix) => tag.startsWith(prefix));
    const distinct = (values: (string | null)[]) =>
      [...new Set(values.filter((v): v is string => v !== null))].sort(naturalOrder);

    return {
      items,
      facets: {
        tags: distinct(all.flatMap((c) => c.tags).filter(isFilterTag)),
        priorities: distinct(all.map((c) => c.priority)),
        requirementIds: distinct(all.flatMap((c) => c.requirements.map((r) => r.id))),
      },
    };
  }

  async get(id: string, versionNumber?: number): Promise<TestCaseDetail> {
    const testCase = await this.prisma.testCase.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        currentVersion: { select: { number: true } },
        versions: {
          select: { number: true, createdAt: true, revisionId: true },
          orderBy: { number: 'desc' },
        },
      },
    });
    if (!testCase?.currentVersion) throw new NotFoundException(`Cas ${id} introuvable.`);

    const number = versionNumber ?? testCase.currentVersion.number;
    const version = await this.prisma.testCaseVersion.findUnique({
      where: { testCaseId_number: { testCaseId: id, number } },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    if (!version) throw new NotFoundException(`Version ${number} du cas ${id} introuvable.`);

    return {
      id: testCase.id,
      status: testCase.status,
      currentVersionNumber: testCase.currentVersion.number,
      versions: testCase.versions.map((v) => ({
        number: v.number,
        createdAt: v.createdAt.toISOString(),
        revisionId: v.revisionId,
      })),
      version: {
        number: version.number,
        createdAt: version.createdAt.toISOString(),
        revisionId: version.revisionId,
        title: version.title,
        objective: version.objective,
        testData: version.testData,
        preconditions: version.preconditions,
        steps: version.steps.map(({ position, action, expectedResult }) => ({
          position,
          action,
          expectedResult,
        })),
        cleanup: version.cleanup,
        notes: version.notes,
        openQuestions: version.openQuestions,
        priority: version.priority,
        tags: version.tags,
        requirementIds: version.requirementIds,
        jiraKeys: version.jiraKeys,
        sourceFile: version.sourceFile,
        sourceLine: version.sourceLine,
      },
    };
  }
}
