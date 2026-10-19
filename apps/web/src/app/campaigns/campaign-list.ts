import { DatePipe, PercentPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import type { CampaignSummary } from '@testplace/shared';
import { describeHttpError } from '../http-errors';
import { CAMPAIGN_STATUS_LABELS } from './campaign-labels';

@Component({
  selector: 'app-campaign-list',
  imports: [DatePipe, MatButtonModule, MatProgressBarModule, PercentPipe, RouterLink],
  templateUrl: './campaign-list.html',
  styleUrl: './campaigns.scss',
})
export class CampaignList {
  protected readonly campaigns = httpResource<CampaignSummary[]>(() => '/api/campaigns');
  protected readonly statusLabels = CAMPAIGN_STATUS_LABELS;
  protected readonly describeHttpError = describeHttpError;
}
