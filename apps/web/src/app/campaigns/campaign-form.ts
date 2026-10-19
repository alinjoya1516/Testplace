import { Component, type OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import type { CampaignInput, SelectionPreview } from '@testplace/shared';
import { catchError, debounceTime, map, merge, of, startWith, switchMap } from 'rxjs';
import { describeHttpError } from '../http-errors';
import { CampaignsApi } from './campaigns-api';

type PreviewState = { preview: SelectionPreview; error: null } | { preview: null; error: string };

@Component({
  selector: 'app-campaign-form',
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './campaign-form.html',
  styleUrls: ['./campaigns.scss', './campaign-form.scss'],
})
export class CampaignForm implements OnInit {
  /** Route parameter, present when editing a draft. */
  readonly id = input<string>();

  private readonly api = inject(CampaignsApi);
  private readonly router = inject(Router);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    build: ['', [Validators.required, Validators.maxLength(100)]],
    environment: ['', [Validators.required, Validators.maxLength(100)]],
    // Quarantined cases are excluded by default (§4.1), visibly rather than behind the scenes.
    tagExpression: ['not @quarantine', Validators.maxLength(500)],
    includeDrafts: [false],
    plannedStart: [''],
    plannedEnd: [''],
  });

  protected readonly selection = signal<PreviewState | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notEditable = signal(false);

  constructor() {
    const { tagExpression, includeDrafts } = this.form.controls;
    merge(tagExpression.valueChanges, includeDrafts.valueChanges)
      .pipe(
        startWith(null),
        debounceTime(400),
        switchMap(() =>
          this.api.preview(tagExpression.value, includeDrafts.value).pipe(
            map((preview): PreviewState => ({ preview, error: null })),
            catchError((error: unknown) => of<PreviewState>({ preview: null, error: describeHttpError(error) })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.selection.set(state));
  }

  ngOnInit(): void {
    const id = this.id();
    if (!id) return;
    this.api.get(Number(id)).subscribe({
      next: (campaign) => {
        if (campaign.status !== 'DRAFT') this.notEditable.set(true);
        this.form.setValue({
          name: campaign.name,
          build: campaign.build,
          environment: campaign.environment,
          tagExpression: campaign.tagExpression,
          includeDrafts: campaign.includeDrafts,
          plannedStart: campaign.plannedStart ?? '',
          plannedEnd: campaign.plannedEnd ?? '',
        });
      },
      error: (error: unknown) => this.error.set(describeHttpError(error)),
    });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const input: CampaignInput = {
      ...value,
      plannedStart: value.plannedStart || null,
      plannedEnd: value.plannedEnd || null,
    };
    const id = this.id();
    this.saving.set(true);
    this.error.set(null);
    (id ? this.api.update(Number(id), input) : this.api.create(input)).subscribe({
      next: (campaign) => void this.router.navigate(['/campaigns', campaign.id]),
      error: (error: unknown) => {
        this.error.set(describeHttpError(error));
        this.saving.set(false);
      },
    });
  }
}
