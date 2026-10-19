import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  CampaignDetail,
  CampaignInput,
  SelectionPreview,
  UserSummary,
} from '@testplace/shared';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CampaignsApi {
  private readonly http = inject(HttpClient);

  get(id: number): Observable<CampaignDetail> {
    return this.http.get<CampaignDetail>(`/api/campaigns/${id}`);
  }

  preview(tagExpression: string, includeDrafts: boolean): Observable<SelectionPreview> {
    return this.http.post<SelectionPreview>('/api/campaigns/preview', { tagExpression, includeDrafts });
  }

  create(input: CampaignInput): Observable<CampaignDetail> {
    return this.http.post<CampaignDetail>('/api/campaigns', input);
  }

  update(id: number, input: CampaignInput): Observable<CampaignDetail> {
    return this.http.put<CampaignDetail>(`/api/campaigns/${id}`, input);
  }

  launch(id: number): Observable<CampaignDetail> {
    return this.http.post<CampaignDetail>(`/api/campaigns/${id}/launch`, {});
  }

  assign(id: number, executionIds: number[], assigneeId: string | null): Observable<CampaignDetail> {
    return this.http.post<CampaignDetail>(`/api/campaigns/${id}/assignments`, { executionIds, assigneeId });
  }

  close(id: number): Observable<CampaignDetail> {
    return this.http.post<CampaignDetail>(`/api/campaigns/${id}/close`, {});
  }

  duplicate(id: number, build: string, name?: string): Observable<CampaignDetail> {
    return this.http.post<CampaignDetail>(`/api/campaigns/${id}/duplicate`, { build, ...(name ? { name } : {}) });
  }

  assignableUsers(): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>('/api/users/assignable');
  }
}
