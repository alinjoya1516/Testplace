export type HealthStatus = {
  status: 'ok' | 'error';
  db: 'up' | 'down';
};

export type TestCaseStatus = 'READY' | 'DRAFT' | 'RETIRED';

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
