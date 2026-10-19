import { InvalidTagExpression, compileTagExpression } from './tag-selection';

describe('compileTagExpression', () => {
  it('evaluates the expression of acceptance criterion 3', () => {
    const matches = compileTagExpression('@critical and not @quarantine');
    expect(matches(['@critical', '@manual'])).toBe(true);
    expect(matches(['@critical', '@quarantine'])).toBe(false);
    expect(matches(['@standard'])).toBe(false);
  });

  it('matches every case when empty', () => {
    expect(compileTagExpression('  ')(['@anything'])).toBe(true);
  });

  it('supports parentheses and or', () => {
    const matches = compileTagExpression('(@smoke or @critical) and not @quarantine');
    expect(matches(['@smoke'])).toBe(true);
    expect(matches(['@smoke', '@quarantine'])).toBe(false);
  });

  it('rejects a tag written without @', () => {
    expect(() => compileTagExpression('critical and not @quarantine')).toThrow(
      new InvalidTagExpression('Expression de tags invalide : « critical » doit commencer par @.'),
    );
  });

  it('rejects a syntax error with the message of the parser', () => {
    expect(() => compileTagExpression('@a and')).toThrow(/Expression de tags invalide : .*Expected operand/);
    expect(() => compileTagExpression('(@a')).toThrow(InvalidTagExpression);
  });
});
