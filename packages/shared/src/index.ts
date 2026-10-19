export type HealthStatus = {
  status: 'ok' | 'error';
  db: 'up' | 'down';
};

export type TestCaseStatus = 'READY' | 'DRAFT' | 'RETIRED';

export type Role = 'ADMIN' | 'EXECUTOR' | 'READER';

export type UserSummary = {
  id: string;
  name: string;
  role: Role;
};

export type ResultStatus = 'NOT_RUN' | 'PASSED' | 'FAILED' | 'BLOCKED';

export type CampaignStatus = 'DRAFT' | 'RUNNING' | 'CLOSED';

/** Rates are between 0 and 1, null when their denominator is zero. */
export type CampaignStats = {
  total: number;
  notRun: number;
  passed: number;
  failed: number;
  blocked: number;
  /** (Passed + Failed + Blocked) / total */
  executionRate: number | null;
  /** Passed / (Passed + Failed) */
  passRate: number | null;
  /** Blocked / total, compared with the replay threshold at closing. */
  blockedShare: number | null;
};

export type CampaignInput = {
  name: string;
  build: string;
  environment: string;
  tagExpression: string;
  includeDrafts: boolean;
  /** ISO dates, YYYY-MM-DD. */
  plannedStart: string | null;
  plannedEnd: string | null;
};

export type SelectionPreview = {
  count: number;
  caseIds: string[];
};

export type CampaignSummary = {
  id: number;
  name: string;
  build: string;
  environment: string;
  status: CampaignStatus;
  needsReplay: boolean;
  plannedStart: string | null;
  plannedEnd: string | null;
  createdAt: string;
  stats: CampaignStats;
};

export type CampaignExecution = {
  id: number;
  position: number;
  testCaseId: string;
  title: string;
  versionNumber: number;
  /** The case was imported again with changes after the launch (§12). */
  newerVersionAvailable: boolean;
  assignee: UserSummary | null;
  status: ResultStatus;
  elapsedSeconds: number;
};

export type CampaignDetail = CampaignSummary & {
  tagExpression: string;
  includeDrafts: boolean;
  launchedAt: string | null;
  closedAt: string | null;
  createdByName: string;
  duplicatedFromId: number | null;
  /** Live selection of a draft campaign; null once launched. */
  selection: SelectionPreview | null;
  /** Empty until the campaign is launched. */
  executions: CampaignExecution[];
};

export type TestCaseSummary = {
  id: string;
  title: string;
  status: TestCaseStatus;
  priority: string | null;
  tags: string[];
  requirementIds: string[];
  versionNumber: number;
};

export type TestCaseList = {
  items: TestCaseSummary[];
  /** Values present across all cases, to fill the filters. */
  facets: {
    tags: string[];
    priorities: string[];
    requirementIds: string[];
  };
};

export type TestCaseStep = {
  position: number;
  action: string;
  expectedResult: string;
};

export type TestCaseVersion = {
  number: number;
  createdAt: string;
  revisionId: number;
  title: string;
  objective: string | null;
  testData: string | null;
  preconditions: string[];
  steps: TestCaseStep[];
  cleanup: string | null;
  notes: string[];
  openQuestions: string[];
  priority: string | null;
  tags: string[];
  requirementIds: string[];
  jiraKeys: string[];
  sourceFile: string;
  sourceLine: number;
};

export type TestCaseDetail = {
  id: string;
  status: TestCaseStatus;
  currentVersionNumber: number;
  /** Newest first. */
  versions: { number: number; createdAt: string; revisionId: number }[];
  /** The current version, or the one asked for with `?version=`. */
  version: TestCaseVersion;
};

/** A problem found while importing. `line` is absent when it concerns the archive itself. */
export type ImportIssue = {
  file: string;
  line?: number;
  message: string;
};

export type ImportStatus = 'APPLIED' | 'REJECTED';

export type ImportReport = {
  archiveName: string;
  /** Case IDs, empty when the import is rejected. */
  created: string[];
  modified: string[];
  /** Retired cases present again in this import. */
  restored: string[];
  retired: string[];
  unchanged: number;
  /** Files of the archive that are not `.feature` files. */
  ignoredFiles: string[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
};

export type ImportRevisionSummary = {
  id: number;
  createdAt: string;
  authorName: string;
  gitCommit: string | null;
  status: ImportStatus;
  archiveName: string;
  counts: {
    created: number;
    modified: number;
    restored: number;
    retired: number;
    unchanged: number;
    errors: number;
    warnings: number;
  };
};

export type ImportRevisionDetail = ImportRevisionSummary & { report: ImportReport };
