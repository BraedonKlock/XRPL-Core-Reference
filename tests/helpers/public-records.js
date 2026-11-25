const ABSENT_DOCUMENTATION = Object.freeze({
  status: 'absent',
  brief: null,
  description: [],
  returns: null,
  notes: [],
  suppressionReason: null,
  inheritedFrom: null,
});

export const TEST_COMMIT_SHA = 'c2534ff9c84422e00711da31629a76f3f59feb98';

function baseRecord(overrides) {
  return {
    scope: null,
    category: 'production',
    access: null,
    documentation: ABSENT_DOCUMENTATION,
    location: { declaration: { file: 'include/xrpl/Example.h', line: 1 }, definition: null },
    corrections: [],
    ...overrides,
  };
}

export function documented(briefText) {
  return { ...ABSENT_DOCUMENTATION, status: 'present', brief: [{ type: 'text', text: briefText }] };
}

export function namespaceRecord(path, overrides = {}) {
  return baseRecord({
    path,
    kind: 'namespace',
    name: path.split('/').at(-1),
    qualifiedName: path.replaceAll('/', '::'),
    nested: [],
    members: [],
    ...overrides,
  });
}

export function classRecord(path, overrides = {}) {
  return baseRecord({
    path,
    kind: 'class',
    name: path.split('/').at(-1),
    qualifiedName: path.replaceAll('/', '::'),
    templateParameters: null,
    isTemplateSpecialization: false,
    isFinal: false,
    isAbstract: false,
    baseClasses: [],
    derivedClasses: [],
    friends: [],
    deductionGuides: [],
    nested: [],
    members: [],
    declaration: [{ text: `class ${path.split('/').at(-1)}` }],
    access: 'public',
    ...overrides,
  });
}

export function functionRecord(overloadSet, hash, overrides = {}) {
  const name = overloadSet.split('/').at(-1);
  return baseRecord({
    path: `${overloadSet}/${hash}`,
    kind: 'function',
    name,
    qualifiedName: overloadSet.replaceAll('/', '::'),
    role: 'function',
    overloadSet,
    signatureKey: `${overloadSet}#${hash}`,
    returnType: [{ text: 'void' }],
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
    declaration: [{ text: `void ${name}()` }],
    ...overrides,
  });
}

export function variableRecord(path, overrides = {}) {
  return baseRecord({
    path,
    kind: 'variable',
    name: path.split('/').at(-1),
    qualifiedName: path.replaceAll('/', '::'),
    type: [{ text: 'int' }],
    initializer: null,
    bitfield: null,
    qualifiers: { isStatic: false, isConstexpr: false, isMutable: false },
    declaration: [{ text: 'int x' }],
    ...overrides,
  });
}
