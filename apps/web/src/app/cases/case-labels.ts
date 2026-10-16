import type { TestCaseStatus } from '@testplace/shared';

/** Status names of the specification (EF-03). */
export const STATUS_LABELS: Record<TestCaseStatus, string> = {
  READY: 'Ready',
  DRAFT: 'Draft',
  RETIRED: 'Retiré',
};

export function priorityLabel(priority: string | null): string {
  return priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : '—';
}
