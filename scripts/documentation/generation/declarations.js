import { joinExpressions } from '../normalization/type-expression.js';

const LINE_BREAK = '\n';

function templateParameterExpression(parameter) {
  return joinExpressions([
    parameter.type,
    parameter.name ? ` ${parameter.name}` : '',
    ...(parameter.defaultValue ? [' = ', parameter.defaultValue] : []),
  ]);
}

export function templateHeaderExpression(templateParameters) {
  if (!templateParameters) {
    return [];
  }
  const parameters = templateParameters.flatMap((parameter, position) =>
    position > 0 ? [', ', templateParameterExpression(parameter)] : [templateParameterExpression(parameter)],
  );
  return joinExpressions(['template <', ...parameters, `>${LINE_BREAK}`]);
}

function inheritanceExpression(baseClasses) {
  if (baseClasses.length === 0) {
    return [];
  }
  const bases = baseClasses.flatMap((base, position) => [
    position > 0 ? ', ' : ' : ',
    `${base.access} ${base.isVirtual ? 'virtual ' : ''}`,
    base.refId ? [{ text: base.name, refId: base.refId }] : base.name,
  ]);
  return joinExpressions(bases);
}

export function classDeclaration(symbol) {
  return joinExpressions([
    templateHeaderExpression(symbol.templateParameters),
    `${symbol.kind} ${symbol.name}`,
    symbol.isFinal ? ' final' : '',
    inheritanceExpression(symbol.baseClasses),
  ]);
}

export function conceptDeclaration(symbol) {
  return joinExpressions([
    templateHeaderExpression(symbol.templateParameters),
    `concept ${symbol.name}`,
    ...(symbol.definition ? [' = ', symbol.definition] : []),
  ]);
}

function parameterExpression(parameter) {
  return joinExpressions([
    parameter.type,
    parameter.name ? ` ${parameter.name}` : '',
    parameter.array ?? '',
    ...(parameter.defaultValue ? [' = ', parameter.defaultValue] : []),
  ]);
}

function functionPrefix(symbol) {
  const { qualifiers } = symbol;
  return [
    qualifiers.isNodiscard ? `[[nodiscard]]${LINE_BREAK}` : '',
    symbol.role === 'friend' ? 'friend ' : '',
    qualifiers.isStatic ? 'static ' : '',
    qualifiers.virtuality !== 'non-virtual' ? 'virtual ' : '',
    qualifiers.isExplicit ? 'explicit ' : '',
    qualifiers.isConstexpr ? 'constexpr ' : '',
    qualifiers.isConsteval ? 'consteval ' : '',
  ].join('');
}

function referenceQualifierText(referenceQualifier) {
  if (referenceQualifier === 'lvalue') {
    return ' &';
  }
  return referenceQualifier === 'rvalue' ? ' &&' : '';
}

function functionSuffix(qualifiers) {
  let suffix = '';
  suffix += qualifiers.isConst ? ' const' : '';
  suffix += referenceQualifierText(qualifiers.referenceQualifier);
  suffix += qualifiers.isNoexcept ? ' noexcept' : '';
  suffix += qualifiers.isOverride ? ' override' : '';
  suffix += qualifiers.isFinal ? ' final' : '';
  if (qualifiers.isPureVirtual) {
    suffix += ' = 0';
  } else if (qualifiers.isDeleted) {
    suffix += ' = delete';
  } else if (qualifiers.isDefaulted) {
    suffix += ' = default';
  }
  return suffix;
}

function parameterListExpression(parameters) {
  return parameters.flatMap((parameter, position) =>
    position > 0 ? [', ', parameterExpression(parameter)] : [parameterExpression(parameter)],
  );
}

export function deductionGuideDeclaration(guide, className) {
  return joinExpressions([
    templateHeaderExpression(guide.templateParameters),
    `${className}(`,
    ...parameterListExpression(guide.parameters),
    `) -> ${guide.resultText}`,
  ]);
}

export function functionDeclaration(symbol) {
  const parameters = parameterListExpression(symbol.parameters);
  return joinExpressions([
    templateHeaderExpression(symbol.templateParameters),
    functionPrefix(symbol),
    ...(symbol.returnType ? [symbol.returnType, ' '] : []),
    `${symbol.name}(`,
    ...parameters,
    ')',
    functionSuffix(symbol.qualifiers),
    ...(symbol.requiresClause ? [`${LINE_BREAK}    requires `, symbol.requiresClause] : []),
  ]);
}

function initializerExpression(initializer) {
  if (!initializer) {
    return [];
  }
  const startsWithAssignment = initializer[0]?.text.startsWith('=');
  return joinExpressions([startsWithAssignment ? ' ' : '', initializer]);
}

export function variableDeclaration(symbol) {
  const { qualifiers } = symbol;
  return joinExpressions([
    qualifiers.isStatic ? 'static ' : '',
    qualifiers.isConstexpr ? 'constexpr ' : '',
    qualifiers.isMutable ? 'mutable ' : '',
    symbol.type,
    ` ${symbol.name}`,
    symbol.bitfield ? ` : ${symbol.bitfield}` : '',
    initializerExpression(symbol.initializer),
  ]);
}

export function typeAliasDeclaration(symbol) {
  if (symbol.aliasStyle === 'typedef') {
    return joinExpressions(['typedef ', symbol.type, ` ${symbol.name}`]);
  }
  return joinExpressions([
    templateHeaderExpression(symbol.templateParameters),
    `using ${symbol.name} = `,
    symbol.type,
  ]);
}

export function enumDeclaration(symbol) {
  return joinExpressions([
    symbol.isScoped ? `enum class ${symbol.name}` : `enum ${symbol.name}`,
    ...(symbol.underlyingType ? [' : ', symbol.underlyingType] : []),
  ]);
}

const DECLARATION_BUILDERS = Object.freeze({
  class: classDeclaration,
  struct: classDeclaration,
  union: classDeclaration,
  concept: conceptDeclaration,
  function: functionDeclaration,
  variable: variableDeclaration,
  typeAlias: typeAliasDeclaration,
  enum: enumDeclaration,
});

export function declarationOf(symbol) {
  const build = DECLARATION_BUILDERS[symbol.kind];
  return build ? build(symbol) : null;
}
