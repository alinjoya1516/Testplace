import { DatePipe, PercentPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import type { CampaignDetail, UserSummary } from '@testplace/shared';
import type { Observable } from 'rxjs';
import { describeHttpError } from '../http-errors';
import { CAMPAIGN_STATUS_LABELS, RESULT_STATUS_LABELS } from './campaign-labels';
import { CampaignsApi } from './campaigns-api';

/** Value of the assignee select that removes the assignment. */
const NOBODY = '';

@Component({
  selector: 'app-campaign-view',
  imports: [
    DatePipe,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    PercentPipe,
    RouterLink,
  ],
  templateUrl: './campaign-view.html',
  styleUrls: ['./campaigns.scss', './campaign-view.scss'],
})
export class CampaignView {
  /** Route parameter. */
  readonly id = input.required<string>();

  private readonly api = inject(CampaignsApi);
  private readonly router = inject(Router);

  protected readonly campaign = httpResource<CampaignDetail>(() => `/api/campaigns/${this.id()}`);
  protected readonly users = httpResource<UserSummary[]>(() => '/api/users/assignable');

  protected readonly selected = signal<ReadonlySet<number>>(new Set());
  protected readonly bulkAssignee = signal<string | null>(null);
  protected readonly confirmingClose = signal(false);
  protected readonly duplicating = signal(false);
  protected readonly duplicateBuild = signal('');
  protected readonly busy = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly staleCount = computed(
    () => this.campaign.value()?.executions.filter((e) => e.newerVersionAvailable).length ?? 0,
  );
  protected readonly allSelected = computed(() => {
    const executions = this.campaign.value()?.executions ?? [];
    return executions.length > 0 && executions.every((e) => this.selected().has(e.id));
  });

  protected readonly nobody = NOBODY;
  protected readonly statusLabels = CAMPAIGN_STATUS_LABELS;
  protected readonly resultLabels = RESULT_STATUS_LABELS;
  protected readonly describeHttpError = describeHttpError;

  protected launch(): void {
    this.run(this.api.launch(this.campaignId()));
  }

  protected close(): void {
    this.run(this.api.close(this.campaignId()), () => this.confirmingClose.set(false));
  }

  protected duplicate(): void {
    const build = this.duplicateBuild().trim();
    if (!build) return;
    this.run(this.api.duplicate(this.campaignId(), build), (copy) => {
      this.duplicating.set(false);
      void this.router.navigate(['/campaigns', copy.id]);
    });
  }

  protected assignOne(executionId: number, assigneeId: string): void {
    this.run(this.api.assign(this.campaignId(), [executionId], assigneeId || null));
  }

  protected assignSelected(): void {
    const assigneeId = this.bulkAssignee();
    if (assigneeId === null || this.selected().size === 0) return;
    this.run(this.api.assign(this.campaignId(), [...this.selected()], assigneeId || null), () => {
      this.selected.set(new Set());
      this.bulkAssignee.set(null);
    });
  }

  protected toggle(executionId: number, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) next.add(executionId);
    else next.delete(executionId);
    this.selected.set(next);
  }

  protected toggleAll(checked: boolean): void {
    this.selected.set(new Set(checked ? (this.campaign.value()?.executions ?? []).map((e) => e.id) : []));
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private campaignId(): number {
    return Number(this.id());
  }

  private run(action: Observable<CampaignDetail>, after?: (campaign: CampaignDetail) => void): void {
    this.busy.set(true);
    this.actionError.set(null);
    action.subscribe({
      next: (campaign) => {
        this.busy.set(false);
        this.campaign.set(campaign);
        after?.(campaign);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(describeHttpError(error));
      },
    });
  }
}
