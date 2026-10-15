import { readFileSync } from 'node:fs';
import { z } from 'zod';

const tag = z.string().regex(/^@\S+$/, 'must start with @ and contain no whitespace');
const keyword = z.string().trim().min(1);

const importConventionsSchema = z.strictObject({
  caseIdTagPrefix: tag,
  requirementTagPrefix: tag,
  jiraTagPrefix: tag,
  /** Highest priority first: when a case has several, the first one listed wins. */
  priorityTags: z.array(tag),
  manualTag: tag,
  quarantineTag: tag,
  descriptionFields: z.strictObject({
    objective: keyword,
    testData: keyword,
    cleanup: keyword,
  }),
  commentKeywords: z.strictObject({
    openQuestion: keyword,
    note: keyword,
  }),
  requiredTagPrefixes: z.array(tag),
});

export type ImportConventions = z.infer<typeof importConventionsSchema>;

export function loadImportConventions(path: string): ImportConventions {
  const result = importConventionsSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
  if (!result.success) {
    throw new Error(`Invalid import conventions in ${path}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
