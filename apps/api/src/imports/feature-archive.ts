import type { ImportIssue } from '@testplace/shared';
import { unzipSync } from 'fflate';
import type { ArchiveLimits } from '../config/app-config';
import type { FeatureFile } from './feature-parser';

export type ArchiveContent = {
  files: FeatureFile[];
  ignoredFiles: string[];
  /** Any error rejects the whole import. */
  errors: ImportIssue[];
};

class LimitExceeded extends Error {}

const utf8 = new TextDecoder('utf-8', { fatal: true });

/**
 * Extracts the `.feature` files of a zip archive, in memory.
 * Limits are checked on the sizes declared by the archive before anything is inflated:
 * fflate inflates each file into a buffer of its declared size and never grows it.
 */
export function readFeatureArchive(
  data: Uint8Array,
  archiveName: string,
  limits: ArchiveLimits,
): ArchiveContent {
  const ignoredFiles: string[] = [];
  const errors: ImportIssue[] = [];
  const rejectArchive = (message: string): ArchiveContent => ({
    files: [],
    ignoredFiles: [],
    errors: [{ file: archiveName, message }],
  });

  if (!hasZipSignature(data)) return rejectArchive("Le fichier n'est pas une archive .zip.");

  let entries = 0;
  let uncompressedBytes = 0;
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(data, {
      filter: (entry) => {
        entries += 1;
        if (entries > limits.maxFiles) {
          throw new LimitExceeded(`L'archive contient plus de ${limits.maxFiles} fichiers.`);
        }
        if (!isSafePath(entry.name)) {
          errors.push({ file: entry.name, message: 'Chemin de fichier interdit dans l’archive.' });
          return false;
        }
        if (entry.name.endsWith('/') || isSystemFile(entry.name)) return false;
        if (!entry.name.toLowerCase().endsWith('.feature')) {
          ignoredFiles.push(entry.name);
          return false;
        }
        uncompressedBytes += entry.originalSize;
        if (uncompressedBytes > limits.maxUncompressedBytes) {
          throw new LimitExceeded(
            `L'archive dépasse ${formatMegabytes(limits.maxUncompressedBytes)} une fois décompressée.`,
          );
        }
        return true;
      },
    });
  } catch (error) {
    return rejectArchive(
      error instanceof LimitExceeded ? error.message : 'Archive .zip illisible ou corrompue.',
    );
  }

  const files: FeatureFile[] = [];
  for (const path of Object.keys(unzipped).sort()) {
    try {
      files.push({ path, content: utf8.decode(unzipped[path]) });
    } catch {
      errors.push({ file: path, message: "Le fichier n'est pas encodé en UTF-8." });
    }
  }
  if (files.length === 0 && errors.length === 0) {
    errors.push({ file: archiveName, message: "L'archive ne contient aucun fichier .feature." });
  }
  return { files, ignoredFiles: ignoredFiles.sort(), errors };
}

function hasZipSignature(data: Uint8Array): boolean {
  // "PK\x03\x04" starts an archive with entries, "PK\x05\x06" an empty one.
  return (
    data.length >= 4 &&
    data[0] === 0x50 &&
    data[1] === 0x4b &&
    ((data[2] === 0x03 && data[3] === 0x04) || (data[2] === 0x05 && data[3] === 0x06))
  );
}

function isSafePath(name: string): boolean {
  return (
    !name.startsWith('/') &&
    !name.includes('\\') &&
    !/^[a-zA-Z]:/.test(name) &&
    !name.split('/').includes('..')
  );
}

/** Files added by macOS and Windows when zipping a folder. */
function isSystemFile(name: string): boolean {
  const base = name.slice(name.lastIndexOf('/') + 1);
  return name.startsWith('__MACOSX/') || base.startsWith('._') || base === '.DS_Store' || base === 'Thumbs.db';
}

function formatMegabytes(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} Mo`;
}
