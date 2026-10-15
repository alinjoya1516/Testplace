import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadImportConventions } from './import-conventions';

const defaultPath = join(__dirname, '../../config/import-conventions.json');

describe('loadImportConventions', () => {
  it('loads the default conventions of the specification', () => {
    expect(loadImportConventions(defaultPath)).toMatchObject({
      caseIdTagPrefix: '@TC-',
      requirementTagPrefix: '@REQ-',
      priorityTags: ['@critical', '@standard'],
      commentKeywords: { openQuestion: 'TODO:', note: 'Note:' },
    });
  });

  it('rejects an invalid file with a readable message', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'conventions-')), 'conventions.json');
    writeFileSync(path, JSON.stringify({ caseIdTagPrefix: 'TC-' }));
    expect(() => loadImportConventions(path)).toThrow(/caseIdTagPrefix/);
  });
});
