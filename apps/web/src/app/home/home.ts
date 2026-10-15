import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { HealthStatus } from '@testplace/shared';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-home',
  template: `
    <h1>Accueil</h1>
    @switch (health()?.db) {
      @case ('up') {
        <p>Le serveur et la base de données répondent.</p>
      }
      @case ('down') {
        <p>Le serveur répond, mais la base de données est indisponible.</p>
      }
      @default {
        <p>Vérification du serveur…</p>
      }
    }
  `,
})
export class Home {
  // A 503 from /api/health still carries a body, but HttpClient treats it as an error.
  protected readonly health = toSignal(
    inject(HttpClient)
      .get<HealthStatus>('/api/health')
      .pipe(catchError(() => of<HealthStatus>({ status: 'error', db: 'down' }))),
  );
}
