import { parse } from '@cucumber/tag-expressions';

export class InvalidTagExpression extends Error {}

const OPERATORS = new Set(['and', 'or', 'not']);

/**
 * Compiles a campaign tag expression (EF-06). An empty expression matches every case.
 * Tags must keep their @: the library accepts `critical` but it would never match a case.
 */
export function compileTagExpression(expression: string): (tags: readonly string[]) => boolean {
  const literals = expression
    .split(/[\s()]+/)
    .filter((token) => token !== '' && !OPERATORS.has(token));
  const withoutAt = literals.find((literal) => !literal.startsWith('@'));
  if (withoutAt) {
    throw new InvalidTagExpression(`Expression de tags invalide : « ${withoutAt} » doit commencer par @.`);
  }
  try {
    const node = parse(expression);
    return (tags) => node.evaluate([...tags]);
  } catch (error) {
    throw new InvalidTagExpression(
      `Expression de tags invalide : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
