import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, input } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import type { TestCaseDetail } from '@testplace/shared';
import { describeHttpError } from '../http-errors';
import { STATUS_LABELS, priorityLabel } from './case-labels';

@Component({
  selector: 'app-case-detail',
  imports: [DatePipe, MatProgressBarModule, RouterLink],
  templateUrl: './case-detail.html',
  styleUrl: './case-detail.scss',
})
export class CaseDetail {
  /** Route parameter. */
  readonly id = input.required<string>();
  /** Query parameter: an older version to display. */
  readonly version = input<string>();

  protected readonly detail = httpResource<TestCaseDetail>(() => {
    const version = this.version();
    const params: Record<string, string> = version ? { version } : {};
    return { url: `/api/cases/${encodeURIComponent(this.id())}`, params };
  });

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly priorityLabel = priorityLabel;
  protected readonly describeHttpError = describeHttpError;
}
