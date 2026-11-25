import { emptyDocumentation } from '../../scripts/documentation/normalization/documentation.js';
import { findRootElement, parseXmlText } from '../../scripts/documentation/parsing/xml-tree.js';

export function parseElement(xmlText, tagName) {
  return findRootElement(parseXmlText(xmlText), tagName);
}

export function text(value) {
  return [{ text: value }];
}

export function linked(value, refId) {
  return [{ text: value, refId }];
}

export function location(file, line, definition = null) {
  return { declaration: { file, line }, definition };
}

function baseSymbol(overrides) {
  return {
    id: overrides.id ?? `id-${overrides.qualifiedName}`,
    name: overrides.qualifiedName.split('::').at(-1),
    ownerId: null,
    access: null,
    documentation: emptyDocumentation(),
    location: location('include/xrpl/Example.h', 10),
    corrections: [],
    category: 'production',
    origin: { ownerKind: 'namespace', argsString: '', definitionText: '', memberKind: overrides.kind },
    ...overrides,
  };
}

export function functionSymbol(overrides) {
  return baseSymbol({
    kind: 'function',
    role: 'function',
    returnType: text('void'),
    parameters: [],
    templateParameters: null,
    requiresClause: null,
    explicitSpecializations: [],
    qualifiers: {
      isStatic: false,
      isConst: false,
      isConstexpr: false,
      isConsteval: false,
      isExplicit: false,
      isInline: false,
      isNoexcept: false,
      isNodiscard: false,
      isDeleted: false,
      isDefaulted: false,
      isPureVirtual: false,
      isOverride: false,
      isFinal: false,
      virtuality: 'non-virtual',
      referenceQualifier: null,
    },
    ...overrides,
  });
}

export function parameter(type, name = null, overrides = {}) {
  return {
    name,
    type: typeof type === 'string' ? text(type) : type,
    array: null,
    defaultValue: null,
    description: null,
    direction: null,
    ...overrides,
  };
}

export function variableSymbol(overrides) {
  return baseSymbol({
    kind: 'variable',
    type: text('int'),
    initializer: null,
    bitfield: null,
    qualifiers: { isStatic: false, isConstexpr: false, isMutable: false },
    ...overrides,
  });
}

export function classSymbol(overrides) {
  return baseSymbol({
    kind: 'class',
    templateParameters: null,
    isTemplateSpecialization: false,
    isFinal: false,
    isAbstract: false,
    baseClasses: [],
    derivedClasses: [],
    friendClasses: [],
    deductionGuides: [],
    innerIds: [],
    memberIds: [],
    origin: { compoundKind: overrides.kind ?? 'class' },
    ...overrides,
  });
}

export function namespaceSymbol(overrides) {
  return baseSymbol({
    kind: 'namespace',
    innerIds: [],
    memberIds: [],
    origin: { compoundKind: 'namespace' },
    ...overrides,
  });
}
