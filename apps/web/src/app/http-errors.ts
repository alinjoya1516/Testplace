import { HttpErrorResponse } from '@angular/common/http';

export function describeHttpError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'Erreur inattendue.';
  if (error.status === 0) return 'Le serveur ne répond pas.';
  if (error.status === 413) return "L'archive dépasse la taille maximale autorisée.";
  const message: unknown = (error.error as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : `Erreur ${error.status}.`;
}
