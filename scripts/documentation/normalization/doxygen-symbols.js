import { attributesOf, findChild, findChildren, normalizedTextOf } from '../parsing/xml-tree.js';
import { innerCompoundIdsOf } from '../parsing/doxygen-xml.js';
import { parseDocumentation } from './documentation.js';
import { isTemplateSpecializationName, simpleNameOf, templateBaseNameOf } from './qualified-name.js';
import { sourceLocationOf } from './source-location.js';
import {
  expressionText,
  optionalTypeExpressionOf,
  optionalValueExpressionOf,
  typeExpressionOf,
} from './type-expression.js';

const YES = 'yes';
const CLASS_LIKE_KINDS = new Set(['class', 'struct', 'union']);
const FRIEND_CLASS_TYPES = new Set(['class', 'struct', 'union']);
const OPERATOR_PATTERN = /^operator(?![A-Za-z0-9_])/;
const NAMED_OPERATOR_PATTERN = /^operator\s+(new|delete|co_await)\b|^operator\s*""/;
const CONVERSION_OPERATOR_PATTERN = /^operator\s+[A-Za-z_:]/;
const ACCESS_LEVELS = new Set(['public', 'protected', 'private']);
const VIRTUALITIES = new Set(['non-virtual', 'virtual', 'pure-virtual']);
const REFERENCE_QUALIFIERS = new Set(['lvalue', 'rvalue']);

export function isClassLikeKind(kind) {
  return CLASS_LIKE_KINDS.has(kind);
}

function accessOf(attributes) {
  return ACCESS_LEVELS.has(attributes.prot) ? attributes.prot : null;
}

function templateParametersOf(element) {
  const list = findChild(element, 'templateparamlist');
  if (!list) {
    return null;
  }
  return findChildren(list, 'param').map((parameter) => ({
    type: typeExpressionOf(findChild(parameter, 'type')),
    name:
      normalizedTextOf(findChild(parameter, 'declname')) ||
      normalizedTextOf(findChild(parameter, 'defname')) ||
      null,
    defaultValue: optionalValueExpressionOf(findChild(parameter, 'defval')),
  }));
}

export function classifyFunctionRole({ name, memberKind, ownerKind, ownerName }) {
  if (memberKind === 'friend') {
    return 'friend';
  }
  if (OPERATOR_PATTERN.test(name)) {
    return CONVERSION_OPERATOR_PATTERN.test(name) && !NAMED_OPERATOR_PATTERN.test(name)
      ? 'conversion'
      : 'operator';
  }
  if (!isClassLikeKind(ownerKind)) {
    return 'function';
  }
  const ownerSimpleName = templateBaseNameOf(simpleNameOf(ownerName));
  if (name === ownerSimpleName) {
    return 'constructor';
  }
  if (name === `~${ownerSimpleName}`) {
    return 'destructor';
  }
  return 'method';
}

export function trailingSpecifiersOf(argsString) {
  const trailing = argsString.slice(argsString.lastIndexOf(')') + 1);
  const compact = trailing.replace(/\s+/g, '');
  return {
    isDeleted: compact.endsWith('=delete'),
    isDefaulted: compact.endsWith('=default'),
    isPureVirtual: compact.endsWith('=0'),
    isOverride: /\boverride\b/.test(trailing),
    isFinal: /\bfinal\b/.test(trailing),
  };
}

function functionQualifiersOf(attributes, argsString) {
  const trailing = trailingSpecifiersOf(argsString);
  return {
    isStatic: attributes.static === YES,
    isConst: attributes.const === YES,
    isConstexpr: attributes.constexpr === YES,
    isConsteval: attributes.consteval === YES,
    isExplicit: attributes.explicit === YES,
    isInline: attributes.inline === YES,
    isNoexcept: attributes.noexcept === YES,
    isNodiscard: attributes.nodiscard === YES,
    ...trailing,
    isPureVirtual: trailing.isPureVirtual || attributes.virt === 'pure-virtual',
    virtuality: VIRTUALITIES.has(attributes.virt) ? attributes.virt : 'non-virtual',
    referenceQualifier: REFERENCE_QUALIFIERS.has(attributes.refqual) ? attributes.refqual : null,
  };
}

function parametersOf(memberDefinition, documentation) {
  return findChildren(memberDefinition, 'param').map((parameter) => {
    const name = normalizedTextOf(findChild(parameter, 'declname')) || null;
    const described = name ? documentation.parameterDescriptions.get(name) : undefined;
    return {
      name,
      type: typeExpressionOf(findChild(parameter, 'type')),
      array: normalizedTextOf(findChild(parameter, 'array')) || null,
      defaultValue: optionalValueExpressionOf(findChild(parameter, 'defval')),
      description: described?.content ?? null,
      direction: described?.direction ?? null,
    };
  });
}

function baseSymbolFields({
  id,
  kind,
  name,
  qualifiedName,
  ownerId,
  access,
  documentation,
  location,
  origin,
}) {
  return { id, kind, name, qualifiedName, ownerId, access, documentation, location, corrections: [], origin };
}

function functionSymbol(memberDefinition, context) {
  const { attributes, name, documentation, owner, argsString } = context;
  return {
    role: classifyFunctionRole({
      name,
      memberKind: attributes.kind,
      ownerKind: owner.kind,
      ownerName: owner.qualifiedName,
    }),
    returnType: optionalTypeExpressionOf(findChild(memberDefinition, 'type')),
    parameters: parametersOf(memberDefinition, documentation),
    templateParameters: templateParametersOf(memberDefinition),
    requiresClause: optionalValueExpressionOf(findChild(memberDefinition, 'requiresclause')),
    explicitSpecializations: [],
    qualifiers: functionQualifiersOf(attributes, argsString),
  };
}

function variableSymbol(memberDefinition, { attributes }) {
  return {
    type: typeExpressionOf(findChild(memberDefinition, 'type')),
    initializer: optionalValueExpressionOf(findChild(memberDefinition, 'initializer')),
    bitfield: normalizedTextOf(findChild(memberDefinition, 'bitfield')) || null,
    qualifiers: {
      isStatic: attributes.static === YES,
      isConstexpr: attributes.constexpr === YES,
      isMutable: attributes.mutable === YES,
    },
  };
}

function typeAliasSymbol(memberDefinition, { definitionText }) {
  return {
    aliasStyle: definitionText.startsWith('using ') ? 'using' : 'typedef',
    type: typeExpressionOf(findChild(memberDefinition, 'type')),
    templateParameters: templateParametersOf(memberDefinition),
  };
}

function enumSymbol(memberDefinition, { attributes }, diagnostics) {
  return {
    isScoped: attributes.strong === YES,
    underlyingType: optionalTypeExpressionOf(findChild(memberDefinition, 'type')),
    enumerators: findChildren(memberDefinition, 'enumvalue').map((enumerator) => ({
      id: attributesOf(enumerator).id,
      name: normalizedTextOf(findChild(enumerator, 'name')),
      initializer: optionalValueExpressionOf(findChild(enumerator, 'initializer')),
      documentation: parseDocumentation(enumerator, diagnostics),
    })),
  };
}

function internalKindOfMember(memberKind, typeText) {
  if (memberKind === 'function') {
    return 'function';
  }
  if (memberKind === 'friend') {
    return FRIEND_CLASS_TYPES.has(typeText) ? 'friendClass' : 'function';
  }
  if (memberKind === 'variable') {
    return 'variable';
  }
  if (memberKind === 'typedef') {
    return 'typeAlias';
  }
  if (memberKind === 'enum') {
    return 'enum';
  }
  if (memberKind === 'define') {
    return 'macro';
  }
  return null;
}

export function normalizeMember({ memberDefinition, sectionKind }, owner, diagnostics) {
  const attributes = attributesOf(memberDefinition);
  const name = normalizedTextOf(findChild(memberDefinition, 'name'));
  const typeText = expressionText(typeExpressionOf(findChild(memberDefinition, 'type')));
  const kind = internalKindOfMember(attributes.kind, typeText);
  const argsString = normalizedTextOf(findChild(memberDefinition, 'argsstring'));
  const definitionText = normalizedTextOf(findChild(memberDefinition, 'definition'));
  const documentation = parseDocumentation(memberDefinition, diagnostics);
  const qualifiedName =
    normalizedTextOf(findChild(memberDefinition, 'qualifiedname')) ||
    (owner.qualifiedName ? `${owner.qualifiedName}::${name}` : name);
  const origin = {
    memberKind: attributes.kind,
    sectionKind,
    argsString,
    definitionText,
    ownerKind: owner.kind,
  };
  const base = baseSymbolFields({
    id: attributes.id,
    kind: kind ?? 'unsupported',
    name,
    qualifiedName,
    ownerId: owner.id,
    access: accessOf(attributes),
    documentation,
    location: sourceLocationOf(memberDefinition),
    origin,
  });
  const context = { attributes, name, documentation, owner, argsString, definitionText };
  if (kind === 'function') {
    return { ...base, ...functionSymbol(memberDefinition, context) };
  }
  if (kind === 'variable') {
    return { ...base, ...variableSymbol(memberDefinition, context) };
  }
  if (kind === 'typeAlias') {
    return { ...base, ...typeAliasSymbol(memberDefinition, context) };
  }
  if (kind === 'enum') {
    return { ...base, ...enumSymbol(memberDefinition, context, diagnostics) };
  }
  if (kind === 'friendClass') {
    return {
      ...base,
      friendRefId:
        typeExpressionOf(findChild(memberDefinition, 'type')).find((token) => token.refId)?.refId ?? null,
    };
  }
  return base;
}

function inheritanceEdgesOf(compoundDefinition, tagName) {
  return findChildren(compoundDefinition, tagName).map((edge) => {
    const attributes = attributesOf(edge);
    return {
      name: normalizedTextOf(edge),
      refId: attributes.refid ?? null,
      access: ACCESS_LEVELS.has(attributes.prot) ? attributes.prot : 'public',
      isVirtual: attributes.virt === 'virtual' || attributes.virt === 'pure-virtual',
    };
  });
}

export function normalizeCompound(compoundDefinition, diagnostics) {
  const attributes = attributesOf(compoundDefinition);
  const qualifiedName = normalizedTextOf(findChild(compoundDefinition, 'compoundname'));
  const name = simpleNameOf(qualifiedName);
  const base = baseSymbolFields({
    id: attributes.id,
    kind: attributes.kind,
    name,
    qualifiedName,
    ownerId: null,
    access: isClassLikeKind(attributes.kind) || attributes.kind === 'concept' ? accessOf(attributes) : null,
    documentation: parseDocumentation(compoundDefinition, diagnostics),
    location: sourceLocationOf(compoundDefinition),
    origin: { compoundKind: attributes.kind },
  });
  const compound = { ...base, innerIds: innerCompoundIdsOf(compoundDefinition), memberIds: [] };
  if (isClassLikeKind(attributes.kind)) {
    return {
      ...compound,
      templateParameters: templateParametersOf(compoundDefinition),
      isTemplateSpecialization: isTemplateSpecializationName(name),
      isFinal: attributes.final === YES,
      isAbstract: attributes.abstract === YES,
      baseClasses: inheritanceEdgesOf(compoundDefinition, 'basecompoundref'),
      derivedClasses: inheritanceEdgesOf(compoundDefinition, 'derivedcompoundref'),
      friendClasses: [],
      deductionGuides: [],
    };
  }
  if (attributes.kind === 'concept') {
    return {
      ...compound,
      templateParameters: templateParametersOf(compoundDefinition),
      definition: optionalValueExpressionOf(findChild(compoundDefinition, 'initializer')),
    };
  }
  return compound;
}
