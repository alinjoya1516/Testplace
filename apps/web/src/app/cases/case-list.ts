import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import type { TestCaseList } from '@testplace/shared';
import { Subject, debounceTime } from 'rxjs';
import { describeHttpError } from '../http-errors';
import { STATUS_LABELS, priorityLabel } from './case-labels';

type FilterChange = Partial<Record<'q' | 'status' | 'priority' | 'requirement' | 'tag', string | string[] | null>>;

@Component({
  selector: 'app-case-list',
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressBarModule, MatSelectModule, RouterLink],
  templateUrl: './case-list.html',
  styleUrl: './case-list.scss',
})
export class CaseList {
  private readonly router = inject(Router);

  // Filters live in the URL so that a filtered list can be shared and survives going back.
  readonly q = input<string>();
  readonly status = input<string>();
  readonly priority = input<string>();
  readonly requirement = input<string>();
  readonly tag = input<string | string[]>();

  protected readonly tags = computed(() => [this.tag() ?? []].flat());

  protected readonly cases = httpResource<TestCaseList>(() => {
    const params: Record<string, string | string[]> = { tag: this.tags() };
    for (const [name, value] of Object.entries({
      q: this.q(),
      status: this.status(),
      priority: this.priority(),
      requirement: this.requirement(),
    })) {
      if (value) params[name] = value;
    }
    return { url: '/api/cases', params };
  });

  /** Tags shown in the table: the filterable ones, not the identifier or requirement tags. */
  protected readonly filterTags = computed(() => new Set(this.cases.value()?.facets.tags ?? []));

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly priorityLabel = priorityLabel;
  protected readonly describeHttpError = describeHttpError;

  private readonly search = new Subject<string>();

  constructor() {
    this.search
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((q) => this.setFilter({ q: q.trim() || null }));
  }

  protected onSearch(event: Event): void {
    this.search.next((event.target as HTMLInputElement).value);
  }

  protected setFilter(change: FilterChange): void {
    void this.router.navigate([], { queryParams: change, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected clearFilters(): void {
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }
}
