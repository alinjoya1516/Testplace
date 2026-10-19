import type { ResultStatus } from '../generated/prisma/client';

/**
 * Status of a case derived from its steps (EF-13): Failed if a step failed, otherwise Blocked if a
 * step is blocked, otherwise Passed if every step passed, otherwise Not run.
 * Pass one status per step of the version, Not run for a step without result.
 */
export function deriveExecutionStatus(stepStatuses: readonly ResultStatus[]): ResultStatus {
  if (stepStatuses.includes('FAILED')) return 'FAILED';
  if (stepStatuses.includes('BLOCKED')) return 'BLOCKED';
  // A case without steps has nothing to pass: it stays Not run unless set by hand.
  if (stepStatuses.length > 0 && stepStatuses.every((s) => s === 'PASSED')) return 'PASSED';
  return 'NOT_RUN';
}
