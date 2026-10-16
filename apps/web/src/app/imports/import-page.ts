import { DatePipe } from '@angular/common';
import { Component, type ElementRef, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import type {
  ImportRevisionDetail,
  ImportRevisionSummary,
  ImportStatus,
} from '@testplace/shared';
import { ImportsApi, describeHttpError } from './imports-api';

@Component({
  selector: 'app-import-page',
  imports: [DatePipe, MatButtonModule, MatCardModule, MatProgressBarModule],
  templateUrl: './import-page.html',
  styleUrl: './import-page.scss',
})
export class ImportPage {
  private readonly api = inject(ImportsApi);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly archive = signal<File | null>(null);
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly revision = signal<ImportRevisionDetail | null>(null);
  protected readonly history = signal<ImportRevisionSummary[]>([]);

  protected readonly statusLabels: Record<ImportStatus, string> = {
    APPLIED: 'Appliqué',
    REJECTED: 'Rejeté',
  };

  constructor() {
    this.loadHistory();
  }

  protected chooseArchive(event: Event): void {
    this.archive.set((event.target as HTMLInputElement).files?.[0] ?? null);
    this.error.set(null);
  }

  protected upload(): void {
    const archive = this.archive();
    if (!archive) return;
    this.uploading.set(true);
    this.error.set(null);
    this.api.upload(archive).subscribe({
      next: (revision) => {
        this.revision.set(revision);
        this.uploading.set(false);
        this.archive.set(null);
        this.fileInput().nativeElement.value = '';
        this.loadHistory();
      },
      error: (error: unknown) => {
        this.error.set(describeHttpError(error));
        this.uploading.set(false);
      },
    });
  }

  protected show(id: number): void {
    this.api.get(id).subscribe({
      next: (revision) => this.revision.set(revision),
      error: (error: unknown) => this.error.set(describeHttpError(error)),
    });
  }

  private loadHistory(): void {
    this.api.list().subscribe({
      next: (history) => this.history.set(history),
      error: (error: unknown) => this.error.set(describeHttpError(error)),
    });
  }
}
