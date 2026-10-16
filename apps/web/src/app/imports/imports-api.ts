import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { ImportRevisionDetail, ImportRevisionSummary } from '@testplace/shared';
import { type Observable, catchError, of, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ImportsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<ImportRevisionSummary[]> {
    return this.http.get<ImportRevisionSummary[]>('/api/imports');
  }

  get(id: number): Observable<ImportRevisionDetail> {
    return this.http.get<ImportRevisionDetail>(`/api/imports/${id}`);
  }

  /** A rejected import (422) is a normal outcome: its revision is returned like an applied one. */
  upload(archive: File): Observable<ImportRevisionDetail> {
    const form = new FormData();
    form.append('archive', archive);
    return this.http.post<ImportRevisionDetail>('/api/imports', form).pipe(
      catchError((error: HttpErrorResponse) =>
        error.status === 422 ? of(error.error as ImportRevisionDetail) : throwError(() => error),
      ),
    );
  }
}
