export interface HealthStatus {
  status: 'ok' | 'error';
  db: 'up' | 'down';
}

export type TestCaseStatus = 'READY' | 'DRAFT' | 'RETIRED';

/** A problem found while importing, located in a source `.feature` file. */
export interface ImportIssue {
  file: string;
  line: number;
  message: string;
}
