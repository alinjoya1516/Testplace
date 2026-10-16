export type HealthStatus = {
  status: 'ok' | 'error';
  db: 'up' | 'down';
};

export type TestCaseStatus = 'READY' | 'DRAFT' | 'RETIRED';

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
