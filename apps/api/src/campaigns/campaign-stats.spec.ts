import type { ResultStatus } from '../generated/prisma/client';
import { computeCampaignStats, needsReplay } from './campaign-stats';

const repeat = (status: ResultStatus, n: number): ResultStatus[] => Array.from({ length: n }, () => status);

describe('computeCampaignStats (EF-25)', () => {
  it('counts statuses and computes the agreed rates', () => {
    // 10 cases: 5 passed, 2 failed, 1 blocked, 2 not run.
    const stats = computeCampaignStats([
      ...repeat('PASSED', 5),
      ...repeat('FAILED', 2),
      ...repeat('BLOCKED', 1),
      ...repeat('NOT_RUN', 2),
    ]);
    expect(stats).toEqual({
      total: 10,
      notRun: 2,
      passed: 5,
      failed: 2,
      blocked: 1,
      executionRate: 0.8,
      passRate: 5 / 7,
      blockedShare: 0.1,
    });
  });

  it('leaves the rates empty when nothing can be divided', () => {
    expect(computeCampaignStats([])).toMatchObject({ total: 0, executionRate: null, passRate: null, blockedShare: null });
    expect(computeCampaignStats(['BLOCKED', 'NOT_RUN'])).toMatchObject({ executionRate: 0.5, passRate: null });
  });
});

describe('needsReplay (EF-09)', () => {
  it('asks for a replay strictly above the threshold', () => {
    const tenPercent = computeCampaignStats([...repeat('BLOCKED', 1), ...repeat('PASSED', 9)]);
    const twentyPercent = computeCampaignStats([...repeat('BLOCKED', 2), ...repeat('PASSED', 8)]);
    expect(needsReplay(tenPercent, 0.1)).toBe(false);
    expect(needsReplay(twentyPercent, 0.1)).toBe(true);
  });

  it('never asks for a replay of an empty campaign', () => {
    expect(needsReplay(computeCampaignStats([]), 0.1)).toBe(false);
  });
});
