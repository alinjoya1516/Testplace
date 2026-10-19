import { deriveExecutionStatus } from './execution-status';

describe('deriveExecutionStatus (EF-13)', () => {
  it('is Failed as soon as one step failed, even if another is blocked', () => {
    expect(deriveExecutionStatus(['PASSED', 'BLOCKED', 'FAILED', 'NOT_RUN'])).toBe('FAILED');
  });

  it('is Blocked when a step is blocked and none failed', () => {
    expect(deriveExecutionStatus(['PASSED', 'BLOCKED', 'NOT_RUN'])).toBe('BLOCKED');
  });

  it('is Passed only when every step passed', () => {
    expect(deriveExecutionStatus(['PASSED', 'PASSED'])).toBe('PASSED');
    expect(deriveExecutionStatus(['PASSED'])).toBe('PASSED');
  });

  it('is Not run while a step is not run and none failed or is blocked', () => {
    expect(deriveExecutionStatus(['PASSED', 'NOT_RUN'])).toBe('NOT_RUN');
    expect(deriveExecutionStatus(['NOT_RUN', 'NOT_RUN'])).toBe('NOT_RUN');
  });

  it('is Not run for a case without steps', () => {
    expect(deriveExecutionStatus([])).toBe('NOT_RUN');
  });
});
