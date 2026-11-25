const ASSIGNMENT_PREFIX = /^\s*=\s*/;

export function withoutLeadingAssignment(expression) {
  if (!expression || expression.length === 0 || !ASSIGNMENT_PREFIX.test(expression[0].text)) {
    return expression;
  }
  const [first, ...rest] = expression;
  const remainder = first.text.replace(ASSIGNMENT_PREFIX, '');
  return remainder.length > 0 ? [{ ...first, text: remainder }, ...rest] : rest;
}
