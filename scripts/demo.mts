/**
 * Fills a running development API with demo data: the sample cases and a launched,
 * assigned campaign. Usage: `npm run dev:api`, then `npm run demo`.
 * Run directly by Node 24, which strips the types.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { strToU8, zipSync } from 'fflate';
import type {
  CampaignDetail,
  CampaignInput,
  ImportRevisionDetail,
  UserSummary,
} from '@testplace/shared';

const apiUrl = process.env['DEMO_API_URL'] ?? 'http://127.0.0.1:3000';
const webUrl = process.env['DEMO_WEB_URL'] ?? 'http://localhost:4200';
const samplesDir = new URL('../samples/features/', import.meta.url);

async function call<T>(method: string, path: string, body?: FormData | object): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method,
      ...(body instanceof FormData
        ? { body }
        : body
          ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }
          : {}),
    });
  } catch {
    throw new Error(`L'API ne répond pas sur ${apiUrl} : lancez d'abord « npm run dev:api ».`);
  }
  if (response.status === 401) {
    throw new Error("L'API refuse la requête : AUTH_MODE=dev doit être défini dans .env.");
  }
  const payload: unknown = await response.json();
  // A rejected import (422) still carries its report.
  if (!response.ok && response.status !== 422) {
    throw new Error(`${method} ${path} : erreur ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload as T;
}

function sampleArchive(): Blob {
  const files: Record<string, Uint8Array> = {};
  for (const path of readdirSync(samplesDir, { recursive: true, encoding: 'utf8' })) {
    if (path.endsWith('.feature')) files[path] = strToU8(readFileSync(new URL(path, samplesDir), 'utf8'));
  }
  return new Blob([zipSync(files)], { type: 'application/zip' });
}

function isoDate(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const form = new FormData();
  form.append('archive', sampleArchive(), 'samples.zip');
  const revision = await call<ImportRevisionDetail>('POST', '/api/imports', form);
  const { created, modified, unchanged, errors } = revision.counts;
  console.log(
    `Import n° ${revision.id} (${revision.status}) : ${created} créés, ${modified} modifiés, ${unchanged} inchangés, ${errors} erreurs.`,
  );
  if (revision.status === 'REJECTED') throw new Error("L'import du jeu d'exemple a été rejeté.");

  const input: CampaignInput = {
    name: `Démo ${new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`,
    build: 'demo-1.0',
    environment: 'Recette',
    tagExpression: '@critical and not @quarantine',
    includeDrafts: false,
    plannedStart: isoDate(0),
    plannedEnd: isoDate(4),
  };
  const draft = await call<CampaignDetail>('POST', '/api/campaigns', input);
  const campaign = await call<CampaignDetail>('POST', `/api/campaigns/${draft.id}/launch`);

  const users = await call<UserSummary[]>('GET', '/api/users/assignable');
  const executors = users.filter((u) => u.role === 'EXECUTOR');
  if (executors.length > 0) {
    for (const [index, executor] of executors.entries()) {
      const executionIds = campaign.executions
        .filter((_, position) => position % executors.length === index)
        .map((e) => e.id);
      if (executionIds.length > 0) {
        await call('POST', `/api/campaigns/${campaign.id}/assignments`, { executionIds, assigneeId: executor.id });
      }
    }
  }

  console.log(
    `Campagne n° ${campaign.id} « ${input.name} » lancée : ${campaign.executions.length} cas, répartis entre ${executors.map((e) => e.name).join(' et ') || 'personne'}.`,
  );
  console.log(`Ouvrir : ${webUrl}/campaigns/${campaign.id}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
