import { join } from 'node:path';
import { z } from 'zod';

export const APP_CONFIG = Symbol('APP_CONFIG');

const MB = 1024 * 1024;

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    // "dev" attributes every request to a fixed administrator; OpenID Connect comes in increment 3.
    AUTH_MODE: z.enum(['none', 'dev']).default('none'),
    IMPORT_CONVENTIONS_PATH: z
      .string()
      .default(join(__dirname, '../../config/import-conventions.json')),
    IMPORT_MAX_ARCHIVE_BYTES: z.coerce.number().int().positive().default(5 * MB),
    IMPORT_MAX_UNCOMPRESSED_BYTES: z.coerce.number().int().positive().default(20 * MB),
    IMPORT_MAX_FILES: z.coerce.number().int().positive().default(1000),
    // Share of Blocked cases above which a closed campaign is flagged for replay (EF-09).
    CAMPAIGN_REPLAY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.1),
  })
  .refine((env) => !(env.AUTH_MODE === 'dev' && env.NODE_ENV === 'production'), {
    message: 'AUTH_MODE=dev is forbidden when NODE_ENV=production',
    path: ['AUTH_MODE'],
  });

export type AppConfig = {
  authMode: 'none' | 'dev';
  importConventionsPath: string;
  importLimits: ArchiveLimits;
  campaignReplayThreshold: number;
};

export type ArchiveLimits = {
  maxArchiveBytes: number;
  maxUncompressedBytes: number;
  maxFiles: number;
};

export function loadAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  const parsed = result.data;
  return {
    authMode: parsed.AUTH_MODE,
    importConventionsPath: parsed.IMPORT_CONVENTIONS_PATH,
    importLimits: {
      maxArchiveBytes: parsed.IMPORT_MAX_ARCHIVE_BYTES,
      maxUncompressedBytes: parsed.IMPORT_MAX_UNCOMPRESSED_BYTES,
      maxFiles: parsed.IMPORT_MAX_FILES,
    },
    campaignReplayThreshold: parsed.CAMPAIGN_REPLAY_THRESHOLD,
  };
}
