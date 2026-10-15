import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadImportConventions, type ImportConventions } from './import-conventions';
import { parseFeatureFiles, type FeatureFile, type ParsedCase } from './feature-parser';

const conventions = loadImportConventions(join(__dirname, '../../config/import-conventions.json'));
const samplesDir = join(__dirname, '../../../../samples/features');

function readSamples(): FeatureFile[] {
  return readdirSync(samplesDir, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.feature'))
    .sort()
    .map((path) => ({
      path: relative(samplesDir, join(samplesDir, path)),
      content: readFileSync(join(samplesDir, path), 'utf8'),
    }));
}

function parseOne(content: string, overrides: Partial<ImportConventions> = {}) {
  return parseFeatureFiles([{ path: 'test.feature', content }], { ...conventions, ...overrides });
}

function byId(cases: ParsedCase[], id: string): ParsedCase {
  const found = cases.find((c) => c.id === id);
  if (!found) throw new Error(`Case ${id} not found`);
  return found;
}

describe('parseFeatureFiles on the sample set', () => {
  const result = parseFeatureFiles(readSamples(), conventions);

  it('imports the expected cases without errors', () => {
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.cases.map((c) => c.id).sort()).toEqual([
      'TC-CRT-01',
      'TC-CRT-02',
      'TC-LOG-01.1',
      'TC-LOG-01.2',
      'TC-LOG-01.3',
      'TC-LOG-02',
      'TC-LOG-03',
      'TC-PRF-01',
      'TC-PRF-02',
    ]);
  });

  it('produces the same hashes when the same files are parsed again', () => {
    const again = parseFeatureFiles(readSamples(), conventions);
    expect(again.cases.map((c) => [c.id, c.hash])).toEqual(result.cases.map((c) => [c.id, c.hash]));
  });

  it('matches the example of the specification (§4.2)', () => {
    expect(byId(result.cases, 'TC-PRF-01')).toMatchObject({
      title: 'A new display name is kept after logging in again',
      status: 'READY',
      priority: 'critical',
      tags: ['@REQ-12', '@TC-PRF-01', '@critical', '@manual'],
      requirementIds: ['REQ-12'],
      objective: 'Check that a profile change is saved and shown everywhere.',
      testData: 'A test account with a known display name.',
      cleanup: null,
      preconditions: ['I am logged in with a test account'],
      steps: [
        { action: 'I change my display name', expectedResult: '' },
        {
          action: 'I log out and log in again',
          expectedResult:
            'the new display name is shown in the header\nthe new display name is shown on the profile page',
        },
      ],
      notes: [],
      openQuestions: [],
      sourceFile: 'account/user-profile.feature',
      sourceLine: 5,
    });
  });

  it('reads cleanup, notes, Jira keys and several requirements', () => {
    expect(byId(result.cases, 'TC-PRF-02')).toMatchObject({
      priority: 'standard',
      requirementIds: ['REQ-12', 'REQ-13'],
      jiraKeys: ['DEMO-42'],
      cleanup: 'Restore the default picture.',
      notes: ['Use the images from the shared test data folder.'],
      preconditions: ['I am logged in with a test account', 'my profile has a picture'],
    });
  });

  it('creates one case per example row, numbered across Examples blocks', () => {
    expect(byId(result.cases, 'TC-LOG-01.1')).toMatchObject({
      title: 'A user with a administrator account can log in',
      preconditions: ['the login page is open'],
      steps: [{ action: 'I log in as "admin.test"', expectedResult: 'I see the dashboard page' }],
      requirementIds: ['REQ-20'],
    });
    expect(byId(result.cases, 'TC-LOG-01.2').steps[0].action).toBe('I log in as "exec.test"');
    expect(byId(result.cases, 'TC-LOG-01.3')).toMatchObject({
      title: 'A user with a reader account can log in',
      requirementIds: ['REQ-20', 'REQ-21'],
    });
  });

  it('marks a case with a TODO comment as Draft, without leaking to its neighbours', () => {
    expect(byId(result.cases, 'TC-LOG-03')).toMatchObject({
      status: 'DRAFT',
      openQuestions: ['Ask the product owner how long the unlock link stays valid.'],
    });
    expect(byId(result.cases, 'TC-LOG-02')).toMatchObject({ status: 'READY', openQuestions: [] });
  });

  it('inherits rule tags and backgrounds, and keeps step arguments', () => {
    expect(byId(result.cases, 'TC-CRT-01')).toMatchObject({
      requirementIds: ['REQ-30'],
      preconditions: ['I am logged in with a test account', 'my cart is empty'],
      steps: [
        {
          action:
            'I add these products to my cart:\n| product | quantity | unit price |\n| Pen | 2 | 1.50 |\n| Notepad | 1 | 3.00 |',
          expectedResult: 'the cart total is 6.00',
        },
      ],
    });
    expect(byId(result.cases, 'TC-CRT-02').steps[0].expectedResult).toBe(
      'the cart total is 18.00\nthe order summary shows:\nSubtotal: 20.00\nDiscount: -2.00\nTotal:    18.00',
    );
  });
});

describe('parseFeatureFiles hashes', () => {
  const base = `Feature: F
  @TC-1
  Scenario: S
    When I act
    Then it works
`;
  const hashOf = (content: string) => parseOne(content).cases[0].hash;

  it('ignores the position of the scenario in the file', () => {
    expect(hashOf(`\n\n${base}`)).toBe(hashOf(base));
  });

  it('changes when a step or a tag changes', () => {
    expect(hashOf(base.replace('I act', 'I act differently'))).not.toBe(hashOf(base));
    expect(hashOf(base.replace('@TC-1', '@TC-1 @smoke'))).not.toBe(hashOf(base));
  });
});

describe('parseFeatureFiles errors', () => {
  it('rejects a scenario without identifier, with file and line', () => {
    const result = parseOne(`Feature: F
  @TC-1
  Scenario: With id
    When I act

  @smoke
  Scenario: Without id
    When I act
`);
    expect(result.errors).toEqual([
      { file: 'test.feature', line: 7, message: expect.stringContaining('sans identifiant @TC-') },
    ]);
  });

  it('rejects two cases sharing an identifier across files, with both locations', () => {
    const scenario = (title: string) => `Feature: F\n\n  @TC-9\n  Scenario: ${title}\n    When I act\n`;
    const result = parseFeatureFiles(
      [
        { path: 'a.feature', content: scenario('First') },
        { path: 'b.feature', content: scenario('Second') },
      ],
      conventions,
    );
    expect(result.errors).toEqual([
      { file: 'b.feature', line: 4, message: 'Identifiant TC-9 déjà utilisé (a.feature, ligne 4).' },
    ]);
  });

  it('rejects an explicit identifier that collides with an outline row', () => {
    const result = parseOne(`Feature: F
  @TC-5
  Scenario Outline: S <n>
    When I act <n>
    Examples:
      | n |
      | 1 |

  @TC-5.1
  Scenario: Collision
    When I act
`);
    expect(result.errors.map((e) => e.line)).toEqual([10]);
  });

  it('rejects a scenario with several identifiers', () => {
    const result = parseOne(`Feature: F\n  @TC-1 @TC-2\n  Scenario: S\n    When I act\n`);
    expect(result.errors).toEqual([
      { file: 'test.feature', line: 3, message: expect.stringContaining('plusieurs identifiants') },
    ]);
  });

  it('rejects a case missing a required tag', () => {
    const result = parseOne(
      `Feature: F\n  @TC-1 @REQ-1\n  Scenario: Ok\n    When I act\n\n  @TC-2\n  Scenario: Missing\n    When I act\n`,
      { requiredTagPrefixes: ['@REQ-'] },
    );
    expect(result.errors).toEqual([
      { file: 'test.feature', line: 7, message: 'Cas TC-2 : tag obligatoire @REQ-… manquant.' },
    ]);
  });

  it('reports Gherkin syntax errors with their line', () => {
    const result = parseOne(
      `Feature: F\n  @TC-1\n  Scenario: S\n    When I act\n      | a | b |\n      | c |\n`,
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ file: 'test.feature', line: 6 });
    expect(result.cases).toEqual([]);
  });
});

describe('parseFeatureFiles warnings', () => {
  it('keeps an expected result without action, with a warning', () => {
    const result = parseOne(`Feature: F\n  @TC-1\n  Scenario: S\n    Then it works\n`);
    expect(result.errors).toEqual([]);
    expect(result.cases[0].steps).toEqual([{ action: '', expectedResult: 'it works' }]);
    expect(result.warnings).toEqual([
      { file: 'test.feature', line: 4, message: expect.stringContaining('sans action') },
    ]);
  });

  it('warns about free description lines and continues multi-line fields', () => {
    const result = parseOne(`Feature: F
  @TC-1
  Scenario: S
    Free text before any field.
    Objective: First line
    second line.
    When I act
`);
    expect(result.cases[0].objective).toBe('First line\nsecond line.');
    expect(result.warnings).toEqual([
      { file: 'test.feature', line: 3, message: expect.stringContaining('Free text before any field.') },
    ]);
  });

  it('keeps the first configured priority when several are present', () => {
    const result = parseOne(`Feature: F\n  @TC-1 @standard @critical\n  Scenario: S\n    When I act\n`);
    expect(result.cases[0].priority).toBe('critical');
    expect(result.warnings).toHaveLength(1);
  });
});
