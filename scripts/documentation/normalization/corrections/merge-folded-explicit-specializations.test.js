import { describe, expect, it } from 'vitest';
import { createInMemorySourceFileReader } from '../../parsing/source-files.js';
import {
  classSymbol,
  functionSymbol,
  location,
  parameter,
} from '../../../../tests/helpers/symbol-builders.js';
import {
  MERGE_FOLDED_EXPLICIT_SPECIALIZATIONS,
  mergeFoldedExplicitSpecializations,
} from './merge-folded-explicit-specializations.js';

const SOURCE = createInMemorySourceFileReader({
  'src/libxrpl/protocol/STInteger.cpp': [
    'namespace xrpl {',
    '',
    'template <>',
    'STInteger<unsigned char>::STInteger(SerialIter& sit, SField const& name)',
    '    : STInteger(name, sit.get8())',
    '{',
    '}',
    '',
    'STInteger<std::uint16_t>::STInteger(SerialIter& sit, SField const& name)',
  ].join('\n'),
});

function constructorAt(id, file, line) {
  return functionSymbol({
    id,
    name: 'STInteger',
    role: 'constructor',
    qualifiedName: 'xrpl::STInteger::STInteger',
    ownerId: 'stinteger',
    returnType: null,
    parameters: [parameter('SerialIter&', 'sit'), parameter('SField const&', 'name')],
    location: location(file, line),
  });
}

function owner(memberIds) {
  return classSymbol({ id: 'stinteger', qualifiedName: 'xrpl::STInteger', memberIds });
}

describe(MERGE_FOLDED_EXPLICIT_SPECIALIZATIONS, () => {
  it('attaches verified explicit specialization definitions to the primary declaration', () => {
    const primary = constructorAt('primary', 'include/xrpl/protocol/STInteger.h', 28);
    const specialization = constructorAt('specialization', 'src/libxrpl/protocol/STInteger.cpp', 4);
    const stInteger = owner(['primary', 'specialization']);
    const result = mergeFoldedExplicitSpecializations([stInteger, primary, specialization], {
      sourceFiles: SOURCE,
    });
    expect(result.symbols).toEqual([stInteger, primary]);
    expect(primary.explicitSpecializations).toEqual([
      { file: 'src/libxrpl/protocol/STInteger.cpp', line: 4 },
    ]);
    expect(primary.corrections).toEqual([MERGE_FOLDED_EXPLICIT_SPECIALIZATIONS]);
    expect(stInteger.memberIds).toEqual(['primary']);
  });

  it('leaves the group untouched when a definition lacks an empty template header', () => {
    const primary = constructorAt('primary', 'include/xrpl/protocol/STInteger.h', 28);
    const unverified = constructorAt('unverified', 'src/libxrpl/protocol/STInteger.cpp', 9);
    const result = mergeFoldedExplicitSpecializations(
      [owner(['primary', 'unverified']), primary, unverified],
      {
        sourceFiles: SOURCE,
      },
    );
    expect(result.symbols).toHaveLength(3);
    expect(result.unresolved).toHaveLength(2);
  });

  it('ignores distinct overloads', () => {
    const first = constructorAt('first', 'include/xrpl/protocol/STInteger.h', 28);
    const second = {
      ...constructorAt('second', 'include/xrpl/protocol/STInteger.h', 30),
      parameters: [parameter('int', 'v')],
    };
    expect(
      mergeFoldedExplicitSpecializations([owner([]), first, second], { sourceFiles: SOURCE }).unresolved,
    ).toHaveLength(0);
  });
});
