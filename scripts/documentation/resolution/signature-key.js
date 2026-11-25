import { createHash } from 'node:crypto';
import { expressionText } from '../normalization/type-expression.js';

const OVERLOAD_HASH_LENGTH = 8;

export function compactCppText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s*([<>(),*&[\]{}=:])\s*/g, '$1')
    .trim();
}

function compactExpression(expression) {
  return compactCppText(expressionText(expression));
}

function templatePrefixOf(templateParameters) {
  if (!templateParameters) {
    return '';
  }
  return `template<${templateParameters.map((parameter) => compactExpression(parameter.type)).join(',')}>`;
}

function referenceQualifierSuffix(referenceQualifier) {
  if (referenceQualifier === 'lvalue') {
    return '&';
  }
  return referenceQualifier === 'rvalue' ? '&&' : '';
}

export function signatureKeyOf(functionSymbol) {
  const parameterTypes = functionSymbol.parameters
    .map(
      (parameter) =>
        `${compactExpression(parameter.type)}${parameter.array ? compactCppText(parameter.array) : ''}`,
    )
    .join(',');
  const constSuffix = functionSymbol.qualifiers.isConst ? 'const' : '';
  const returnSuffix =
    functionSymbol.templateParameters && functionSymbol.returnType
      ? `->${compactExpression(functionSymbol.returnType)}`
      : '';
  const requiresSuffix = functionSymbol.requiresClause
    ? ` requires ${compactExpression(functionSymbol.requiresClause)}`
    : '';
  return [
    templatePrefixOf(functionSymbol.templateParameters),
    `${functionSymbol.qualifiedName}(${parameterTypes})`,
    constSuffix,
    referenceQualifierSuffix(functionSymbol.qualifiers.referenceQualifier),
    returnSuffix,
    requiresSuffix,
  ].join('');
}

export function overloadHashOf(signatureKey) {
  return createHash('sha256').update(signatureKey).digest('hex').slice(0, OVERLOAD_HASH_LENGTH);
}
