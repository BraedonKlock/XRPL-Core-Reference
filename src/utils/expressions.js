export function expressionText(expression) {
  return (expression ?? []).map((token) => token.text).join('');
}
