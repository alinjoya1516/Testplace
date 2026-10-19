import type { CampaignStats } from '@testplace/shared';
import type { ResultStatus } from '../generated/prisma/client';

/**
 * Counts and rates of a campaign (EF-25), with the formulas agreed for acceptance criterion 3:
 * execution rate = (Passed + Failed + Blocked) / total, pass rate = Passed / (Passed + Failed),
 * blocked share = Blocked / total. A rate with an empty denominator is null.
 */
export function computeCampaignStats(statuses: readonly ResultStatus[]): CampaignStats {
  const count = (status: ResultStatus) => statuses.filter((s) => s === status).length;
  const total = statuses.length;
  const passed = count('PASSED');
  const failed = count('FAILED');
  const blocked = count('BLOCKED');
  const ratio = (numerator: number, denominator: number) =>
    denominator === 0 ? null : numerator / denominator;
  return {
    total,
    notRun: count('NOT_RUN'),
    passed,
    failed,
    blocked,
    executionRate: ratio(passed + failed + blocked, total),
    passRate: ratio(passed, passed + failed),
    blockedShare: ratio(blocked, total),
  };
}

/** EF-09: strictly above the threshold, so that exactly 10 % blocked does not ask for a replay. */
export function needsReplay(stats: CampaignStats, threshold: number): boolean {
  return stats.blockedShare !== null && stats.blockedShare > threshold;
}
