import { createHash } from 'node:crypto';
import { AstBuilder, Errors, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator, StepKeywordType } from '@cucumber/messages';
import type {
  Background,
  Comment,
  DataTable,
  GherkinDocument,
  Scenario,
  Step,
  Tag,
} from '@cucumber/messages';
import type { ImportIssue } from '@testplace/shared';
import type { ImportConventions } from './import-conventions';

export interface FeatureFile {
  /** Path relative to the root of the imported archive. */
  path: string;
  content: string;
}

export interface ParsedStep {
  action: string;
  /** One line per `Then` / `And`, joined with a newline. */
  expectedResult: string;
}

export interface ParsedCase {
  id: string;
  title: string;
  status: 'READY' | 'DRAFT';
  priority: string | null;
  tags: string[];
  requirementIds: string[];
  jiraKeys: string[];
  objective: string | null;
  testData: string | null;
  cleanup: string | null;
  preconditions: string[];
  steps: ParsedStep[];
  notes: string[];
  openQuestions: string[];
  sourceFile: string;
  sourceLine: number;
  /** Fingerprint of the content: a new version is created only when it changes. */
  hash: string;
}

export interface ParseResult {
  cases: ParsedCase[];
  /** Any error rejects the whole import. */
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

type DescriptionField = keyof ImportConventions['descriptionFields'];

interface ScenarioContext {
  file: string;
  scenario: Scenario;
  inheritedTags: readonly Tag[];
  backgrounds: Background[];
  comments: Comment[];
}

export function parseFeatureFiles(
  files: FeatureFile[],
  conventions: ImportConventions,
): ParseResult {
  const result: ParseResult = { cases: [], errors: [], warnings: [] };
  for (const file of files) {
    for (const context of readScenarios(file, result)) {
      result.cases.push(...buildCases(context, conventions, result));
    }
  }
  reportDuplicateIds(result);
  result.errors = dedupe(result.errors);
  result.warnings = dedupe(result.warnings);
  return result;
}

function readScenarios(file: FeatureFile, result: ParseResult): ScenarioContext[] {
  let document: GherkinDocument;
  try {
    const parser = new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher());
    document = parser.parse(file.content);
  } catch (error) {
    const failures = error instanceof Errors.CompositeParserException ? error.errors : [error];
    for (const failure of failures) {
      result.errors.push({
        file: file.path,
        line: failure instanceof Errors.GherkinException ? (failure.location?.line ?? 1) : 1,
        message: `Erreur de syntaxe Gherkin : ${failure instanceof Error ? failure.message : String(failure)}`,
      });
    }
    return [];
  }

  const feature = document.feature;
  if (!feature) {
    result.warnings.push({ file: file.path, line: 1, message: 'Fichier sans Feature : ignoré.' });
    return [];
  }

  const found: Omit<ScenarioContext, 'comments'>[] = [];
  // Start line of every block, to find which scenario a comment falls into.
  const blockStarts: number[] = [];
  let featureBackground: Background | undefined;

  for (const child of feature.children) {
    if (child.background) {
      featureBackground = child.background;
      blockStarts.push(child.background.location.line);
    } else if (child.scenario) {
      found.push({
        file: file.path,
        scenario: child.scenario,
        inheritedTags: feature.tags,
        backgrounds: featureBackground ? [featureBackground] : [],
      });
      blockStarts.push(startLine(child.scenario));
    } else if (child.rule) {
      const rule = child.rule;
      blockStarts.push(Math.min(rule.location.line, ...rule.tags.map((t) => t.location.line)));
      let ruleBackground: Background | undefined;
      for (const ruleChild of rule.children) {
        if (ruleChild.background) {
          ruleBackground = ruleChild.background;
          blockStarts.push(ruleChild.background.location.line);
        } else if (ruleChild.scenario) {
          found.push({
            file: file.path,
            scenario: ruleChild.scenario,
            inheritedTags: [...feature.tags, ...rule.tags],
            backgrounds: [featureBackground, ruleBackground].filter((b) => b !== undefined),
          });
          blockStarts.push(startLine(ruleChild.scenario));
        }
      }
    }
  }

  blockStarts.sort((a, b) => a - b);
  return found.map((context) => {
    const start = startLine(context.scenario);
    const end = blockStarts.find((line) => line > start) ?? Number.POSITIVE_INFINITY;
    const comments = document.comments.filter((c) => c.location.line >= start && c.location.line < end);
    return { ...context, comments };
  });
}

function startLine(scenario: Scenario): number {
  return Math.min(scenario.location.line, ...scenario.tags.map((t) => t.location.line));
}

function buildCases(
  context: ScenarioContext,
  conventions: ImportConventions,
  result: ParseResult,
): ParsedCase[] {
  const { file, scenario } = context;
  const line = scenario.location.line;
  const idTags = scenario.tags.filter((t) => t.name.startsWith(conventions.caseIdTagPrefix));
  if (idTags.length === 0) {
    result.errors.push({
      file,
      line,
      message: `Scénario « ${scenario.name} » sans identifiant ${conventions.caseIdTagPrefix}<id>.`,
    });
    return [];
  }
  if (idTags.length > 1) {
    result.errors.push({
      file,
      line,
      message: `Scénario « ${scenario.name} » avec plusieurs identifiants : ${idTags.map((t) => t.name).join(', ')}.`,
    });
    return [];
  }
  const baseId = idTags[0].name.slice(1);
  const baseTags = [...context.inheritedTags, ...scenario.tags].map((t) => t.name);

  if (scenario.examples.length === 0) {
    return [buildCase(context, conventions, result, baseId, baseTags, new Map())];
  }

  const cases: ParsedCase[] = [];
  let index = 0;
  for (const examples of scenario.examples) {
    if (!examples.tableHeader) {
      result.warnings.push({ file, line: examples.location.line, message: 'Bloc Examples sans tableau : ignoré.' });
      continue;
    }
    const names = examples.tableHeader.cells.map((c) => c.value);
    const tags = [...baseTags, ...examples.tags.map((t) => t.name)];
    for (const row of examples.tableBody) {
      index += 1;
      const params = new Map(names.map((name, i) => [name, row.cells[i]?.value ?? '']));
      cases.push(buildCase(context, conventions, result, `${baseId}.${index}`, tags, params));
    }
  }
  if (cases.length === 0) {
    result.warnings.push({
      file,
      line,
      message: `Scenario Outline ${baseId} sans ligne d'exemple : aucun cas créé.`,
    });
  }
  return cases;
}

function buildCase(
  context: ScenarioContext,
  conventions: ImportConventions,
  result: ParseResult,
  id: string,
  rawTags: string[],
  params: Map<string, string>,
): ParsedCase {
  const { file, scenario } = context;
  const line = scenario.location.line;
  const fill = (text: string) =>
    text.replace(/<([^<>]+)>/g, (match, name: string) => params.get(name) ?? match);

  const tags = [...new Set(rawTags)].sort();
  for (const prefix of conventions.requiredTagPrefixes) {
    if (!tags.some((t) => t.startsWith(prefix))) {
      result.errors.push({ file, line, message: `Cas ${id} : tag obligatoire ${prefix}… manquant.` });
    }
  }

  const priorities = conventions.priorityTags.filter((p) => tags.includes(p));
  if (priorities.length > 1) {
    result.warnings.push({
      file,
      line,
      message: `Cas ${id} : plusieurs priorités (${priorities.join(', ')}), ${priorities[0]} est retenue.`,
    });
  }

  const fields = readDescription(scenario.description, conventions, fill, (message) =>
    result.warnings.push({ file, line, message: `Cas ${id} : ${message}` }),
  );

  const notes: string[] = [];
  const openQuestions: string[] = [];
  for (const comment of context.comments) {
    const text = comment.text.trim().replace(/^#\s*/, '');
    const { openQuestion, note } = conventions.commentKeywords;
    if (text.startsWith(openQuestion)) openQuestions.push(fill(text.slice(openQuestion.length).trim()));
    else if (text.startsWith(note)) notes.push(fill(text.slice(note.length).trim()));
  }

  const preconditions = context.backgrounds.flatMap((b) => b.steps.map((s) => fill(stepText(s))));
  const steps: { action: string; expected: string[] }[] = [];
  let currentType = StepKeywordType.CONTEXT;
  for (const step of scenario.steps) {
    if (step.keywordType === StepKeywordType.CONTEXT || step.keywordType === StepKeywordType.ACTION
      || step.keywordType === StepKeywordType.OUTCOME) {
      currentType = step.keywordType;
    }
    const text = fill(stepText(step));
    if (currentType === StepKeywordType.CONTEXT) {
      preconditions.push(text);
    } else if (currentType === StepKeywordType.ACTION) {
      steps.push({ action: text, expected: [] });
    } else {
      if (steps.length === 0) {
        steps.push({ action: '', expected: [] });
        result.warnings.push({
          file,
          line: step.location.line,
          message: `Cas ${id} : résultat attendu sans action (When) qui le précède.`,
        });
      }
      steps[steps.length - 1].expected.push(text);
    }
  }

  const content = {
    title: fill(scenario.name),
    priority: priorities[0]?.slice(1) ?? null,
    tags,
    requirementIds: tags
      .filter((t) => t.startsWith(conventions.requirementTagPrefix))
      .map((t) => t.slice(1)),
    jiraKeys: tags
      .filter((t) => t.startsWith(conventions.jiraTagPrefix))
      .map((t) => t.slice(conventions.jiraTagPrefix.length)),
    objective: fields.objective,
    testData: fields.testData,
    cleanup: fields.cleanup,
    preconditions,
    steps: steps.map((s) => ({ action: s.action, expectedResult: s.expected.join('\n') })),
    notes,
    openQuestions,
  };
  return {
    id,
    status: openQuestions.length > 0 ? 'DRAFT' : 'READY',
    ...content,
    sourceFile: file,
    sourceLine: line,
    // Source location is left out on purpose: moving a scenario must not create a new version.
    hash: createHash('sha256').update(JSON.stringify(content)).digest('hex'),
  };
}

function readDescription(
  description: string,
  conventions: ImportConventions,
  fill: (text: string) => string,
  warn: (message: string) => void,
): Record<DescriptionField, string | null> {
  const fields: Record<DescriptionField, string | null> = { objective: null, testData: null, cleanup: null };
  const keywords = Object.entries(conventions.descriptionFields) as [DescriptionField, string][];
  let current: DescriptionField | undefined;
  for (const rawLine of description.split('\n')) {
    const text = rawLine.trim();
    if (!text) continue;
    const match = keywords.find(([, keyword]) => text.startsWith(keyword));
    if (match) {
      current = match[0];
      const value = fill(text.slice(match[1].length).trim());
      fields[current] = fields[current] === null ? value : `${fields[current]}\n${value}`;
    } else if (current) {
      // Lines without a keyword continue the previous field.
      fields[current] = `${fields[current]}\n${fill(text)}`;
    } else {
      warn(`ligne de description ignorée : « ${text} ».`);
    }
  }
  return fields;
}

/** A manual tester needs the step argument, so it is kept in the text. */
function stepText(step: Step): string {
  if (step.docString) return `${step.text}\n${step.docString.content}`;
  if (step.dataTable) return `${step.text}\n${formatTable(step.dataTable)}`;
  return step.text;
}

function formatTable(table: DataTable): string {
  return table.rows.map((row) => `| ${row.cells.map((c) => c.value).join(' | ')} |`).join('\n');
}

function reportDuplicateIds(result: ParseResult): void {
  const firstSeen = new Map<string, ParsedCase>();
  for (const parsed of result.cases) {
    const first = firstSeen.get(parsed.id);
    if (first) {
      result.errors.push({
        file: parsed.sourceFile,
        line: parsed.sourceLine,
        message: `Identifiant ${parsed.id} déjà utilisé (${first.sourceFile}, ligne ${first.sourceLine}).`,
      });
    } else {
      firstSeen.set(parsed.id, parsed);
    }
  }
}

function dedupe(issues: ImportIssue[]): ImportIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.file}\u0000${issue.line}\u0000${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
