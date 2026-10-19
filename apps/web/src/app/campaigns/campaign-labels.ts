import type { CampaignStatus, ResultStatus } from '@testplace/shared';

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: 'En préparation',
  RUNNING: 'En cours',
  CLOSED: 'Clôturée',
};

/** Status names of the specification (EF-12). */
export const RESULT_STATUS_LABELS: Record<ResultStatus, string> = {
  NOT_RUN: 'Not run',
  PASSED: 'Passed',
  FAILED: 'Failed',
  BLOCKED: 'Blocked',
};
