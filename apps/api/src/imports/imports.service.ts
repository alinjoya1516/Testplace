import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ImportReport,
  ImportRevisionDetail,
  ImportRevisionSummary,
} from '@testplace/shared';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import type { ImportRevision, Prisma, User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { readFeatureArchive } from './feature-archive';
import { parseFeatureFiles, type ParsedCase } from './feature-parser';
import type { ImportConventions } from './import-conventions';

export const IMPORT_CONVENTIONS = Symbol('IMPORT_CONVENTIONS');

// Arbitrary key of the PostgreSQL advisory lock that serialises imports.
const IMPORT_LOCK_KEY = 4_127_001;

export type ImportInput = {
  data: Uint8Array;
  archiveName: string;
  gitCommit: string | null;
  authorId: string;
};

type RevisionWithAuthor = ImportRevision & { author: User };

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(IMPORT_CONVENTIONS) private readonly conventions: ImportConventions,
  ) {}

  async importArchive(input: ImportInput): Promise<ImportRevisionDetail> {
    const archive = readFeatureArchive(input.data, input.archiveName, this.config.importLimits);
    const parsed = parseFeatureFiles(archive.files, this.conventions);
    const report: ImportReport = {
      archiveName: input.archiveName,
      created: [],
      modified: [],
      restored: [],
      retired: [],
      unchanged: 0,
      ignoredFiles: archive.ignoredFiles,
      errors: [...archive.errors, ...parsed.errors],
      warnings: parsed.warnings,
    };
    const revisionData = { authorId: input.authorId, gitCommit: input.gitCommit };

    if (report.errors.length > 0) {
      const revision = await this.prisma.importRevision.create({
        data: { ...revisionData, status: 'REJECTED', report },
        include: { author: true },
      });
      return toDetail(revision);
    }

    const revision = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${IMPORT_LOCK_KEY})`;
        const { id } = await tx.importRevision.create({
          data: { ...revisionData, status: 'APPLIED', report },
        });
        await applyCases(tx, id, parsed.cases, report);
        return tx.importRevision.update({ where: { id }, data: { report }, include: { author: true } });
      },
      { timeout: 60_000 },
    );
    return toDetail(revision);
  }

  async list(): Promise<ImportRevisionSummary[]> {
    const revisions = await this.prisma.importRevision.findMany({
      orderBy: { id: 'desc' },
      include: { author: true },
    });
    return revisions.map(toSummary);
  }

  async get(id: number): Promise<ImportRevisionDetail> {
    const revision = await this.prisma.importRevision.findUnique({
      where: { id },
      include: { author: true },
    });
    if (!revision) throw new NotFoundException(`Révision d'import ${id} introuvable.`);
    return toDetail(revision);
  }
}

async function applyCases(
  tx: Prisma.TransactionClient,
  revisionId: number,
  cases: ParsedCase[],
  report: ImportReport,
): Promise<void> {
  const existing = await tx.testCase.findMany({
    select: {
      id: true,
      status: true,
      currentVersion: { select: { id: true, number: true, hash: true, sourceFile: true, sourceLine: true } },
    },
  });
  const existingById = new Map(existing.map((c) => [c.id, c]));

  const requirementIds = [...new Set(cases.flatMap((c) => c.requirementIds))];
  if (requirementIds.length > 0) {
    await tx.requirement.createMany({
      data: requirementIds.map((id) => ({ id, source: 'TAG' as const })),
      skipDuplicates: true,
    });
  }

  for (const parsed of cases) {
    const current = existingById.get(parsed.id);
    const requirements = parsed.requirementIds.map((id) => ({ id }));
    const fields = {
      status: parsed.status,
      priority: parsed.priority,
      tags: parsed.tags,
      jiraKeys: parsed.jiraKeys,
    };

    if (!current) {
      await tx.testCase.create({ data: { id: parsed.id, ...fields, requirements: { connect: requirements } } });
      const version = await createVersion(tx, parsed, 1, revisionId);
      await tx.testCase.update({ where: { id: parsed.id }, data: { currentVersionId: version.id } });
      report.created.push(parsed.id);
      continue;
    }

    const currentVersion = current.currentVersion;
    if (!currentVersion || currentVersion.hash !== parsed.hash) {
      const version = await createVersion(tx, parsed, (currentVersion?.number ?? 0) + 1, revisionId);
      await tx.testCase.update({
        where: { id: parsed.id },
        data: { ...fields, requirements: { set: requirements }, currentVersionId: version.id },
      });
      report.modified.push(parsed.id);
    } else {
      if (currentVersion.sourceFile !== parsed.sourceFile || currentVersion.sourceLine !== parsed.sourceLine) {
        await tx.testCaseVersion.update({
          where: { id: currentVersion.id },
          data: { sourceFile: parsed.sourceFile, sourceLine: parsed.sourceLine },
        });
      }
      if (current.status === 'RETIRED') {
        await tx.testCase.update({ where: { id: parsed.id }, data: { status: parsed.status } });
      } else {
        report.unchanged += 1;
      }
    }
    if (current.status === 'RETIRED') report.restored.push(parsed.id);
  }

  const imported = new Set(cases.map((c) => c.id));
  report.retired = existing.filter((c) => c.status !== 'RETIRED' && !imported.has(c.id)).map((c) => c.id);
  if (report.retired.length > 0) {
    await tx.testCase.updateMany({ where: { id: { in: report.retired } }, data: { status: 'RETIRED' } });
  }
  for (const list of [report.created, report.modified, report.restored, report.retired]) list.sort();
}

function createVersion(
  tx: Prisma.TransactionClient,
  parsed: ParsedCase,
  number: number,
  revisionId: number,
) {
  return tx.testCaseVersion.create({
    data: {
      testCaseId: parsed.id,
      number,
      revisionId,
      hash: parsed.hash,
      title: parsed.title,
      objective: parsed.objective,
      testData: parsed.testData,
      preconditions: parsed.preconditions,
      cleanup: parsed.cleanup,
      notes: parsed.notes,
      openQuestions: parsed.openQuestions,
      priority: parsed.priority,
      tags: parsed.tags,
      requirementIds: parsed.requirementIds,
      jiraKeys: parsed.jiraKeys,
      sourceFile: parsed.sourceFile,
      sourceLine: parsed.sourceLine,
      steps: {
        create: parsed.steps.map((step, index) => ({
          position: index + 1,
          action: step.action,
          expectedResult: step.expectedResult,
        })),
      },
    },
  });
}

function toSummary(revision: RevisionWithAuthor): ImportRevisionSummary {
  // The report column is only ever written by this service.
  const report = revision.report as ImportReport;
  return {
    id: revision.id,
    createdAt: revision.createdAt.toISOString(),
    authorName: revision.author.name,
    gitCommit: revision.gitCommit,
    status: revision.status,
    archiveName: report.archiveName,
    counts: {
      created: report.created.length,
      modified: report.modified.length,
      restored: report.restored.length,
      retired: report.retired.length,
      unchanged: report.unchanged,
      errors: report.errors.length,
      warnings: report.warnings.length,
    },
  };
}

function toDetail(revision: RevisionWithAuthor): ImportRevisionDetail {
  return { ...toSummary(revision), report: revision.report as ImportReport };
}
