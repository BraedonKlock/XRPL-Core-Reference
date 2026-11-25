import { describe, expect, it } from 'vitest';
import {
  functionSymbol,
  location,
  parameter,
  text,
  variableSymbol,
} from '../../../../tests/helpers/symbol-builders.js';
import {
  MERGE_MISPARSED_VARIABLE_DEFINITIONS,
  mergeMisparsedVariableDefinitions,
} from './merge-misparsed-variable-definitions.js';

const SFIELD_DEFINITION = location('src/libxrpl/protocol/SField.cpp', 48);

function sfInvalidVariable() {
  return variableSymbol({
    id: 'variable',
    qualifiedName: 'xrpl::sfInvalid',
    ownerId: 'namespacexrpl',
    type: text('SField const'),
    location: {
      declaration: { file: 'include/xrpl/protocol/SField.h', line: 376 },
      definition: { file: 'src/libxrpl/protocol/SField.cpp', line: 48, endLine: null },
    },
  });
}

function sfInvalidMisparse(overrides = {}) {
  return functionSymbol({
    id: 'function',
    qualifiedName: 'xrpl::sfInvalid',
    ownerId: 'namespacexrpl',
    returnType: text('SField const'),
    parameters: [parameter('access'), parameter('-', '1'), parameter('""')],
    location: SFIELD_DEFINITION,
    origin: { ownerKind: 'namespace', argsString: '(access, -1, "")' },
    ...overrides,
  });
}

describe(MERGE_MISPARSED_VARIABLE_DEFINITIONS, () => {
  it('removes a function record that duplicates a variable definition at the same position', () => {
    const variable = sfInvalidVariable();
    const result = mergeMisparsedVariableDefinitions([variable, sfInvalidMisparse()]);
    expect(result.symbols).toEqual([variable]);
    expect(variable.corrections).toEqual([MERGE_MISPARSED_VARIABLE_DEFINITIONS]);
  });

  it('records the definition when the variable lacks one', () => {
    const variable = variableSymbol({
      id: 'variable',
      qualifiedName: 'xrpl::kParityRate',
      ownerId: 'namespacexrpl',
      location: location('src/libxrpl/protocol/Rate2.cpp', 12),
    });
    const misparse = sfInvalidMisparse({
      qualifiedName: 'xrpl::kParityRate',
      parameters: [parameter('QUALITY_ONE')],
      location: location('src/libxrpl/protocol/Rate2.cpp', 12),
    });
    mergeMisparsedVariableDefinitions([variable, misparse]);
    expect(variable.location.definition).toBeNull();
  });

  it('reports but keeps a same-named function at a different position', () => {
    const variable = sfInvalidVariable();
    const elsewhere = sfInvalidMisparse({ location: location('src/libxrpl/protocol/Other.cpp', 3) });
    const result = mergeMisparsedVariableDefinitions([variable, elsewhere]);
    expect(result.symbols).toHaveLength(2);
    expect(result.unresolved).toHaveLength(1);
  });

  it('ignores member functions and functions without a variable twin', () => {
    const method = sfInvalidMisparse({ role: 'method', origin: { ownerKind: 'class', argsString: '()' } });
    expect(mergeMisparsedVariableDefinitions([sfInvalidVariable(), method]).symbols).toHaveLength(2);
    expect(mergeMisparsedVariableDefinitions([sfInvalidMisparse()]).applied).toHaveLength(0);
  });
});
