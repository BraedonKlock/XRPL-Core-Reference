import { describe, expect, it } from 'vitest';
import { classSymbol, functionSymbol, location } from '../../../../tests/helpers/symbol-builders.js';
import {
  MERGE_DUPLICATE_MEMBER_RECORDS,
  mergeDuplicateMemberRecords,
} from './merge-duplicate-member-records.js';

describe(MERGE_DUPLICATE_MEMBER_RECORDS, () => {
  it('merges an out-of-class template definition into the in-class declaration', () => {
    const owner = classSymbol({ id: 'stamount', qualifiedName: 'xrpl::STAmount', memberIds: ['get', 'get'] });
    const declaration = functionSymbol({
      id: 'get',
      qualifiedName: 'xrpl::STAmount::get',
      location: location('include/xrpl/protocol/STAmount.h', 181),
    });
    const definition = functionSymbol({
      id: 'get',
      qualifiedName: 'xrpl::STAmount::get',
      location: location('include/xrpl/protocol/STAmount.h', 503),
      qualifiers: { ...declaration.qualifiers, isNodiscard: true },
    });
    const result = mergeDuplicateMemberRecords([owner, declaration, definition]);
    expect(result.symbols).toHaveLength(2);
    expect(result.symbols[1].location).toEqual({
      declaration: { file: 'include/xrpl/protocol/STAmount.h', line: 181 },
      definition: { file: 'include/xrpl/protocol/STAmount.h', line: 503, endLine: null },
    });
    expect(result.symbols[1].qualifiers.isNodiscard).toBe(true);
    expect(result.symbols[1].corrections).toEqual([MERGE_DUPLICATE_MEMBER_RECORDS]);
    expect(owner.memberIds).toEqual(['get']);
    expect(result.applied).toHaveLength(1);
  });

  it('refuses to merge records that share an id but describe different symbols', () => {
    expect(() =>
      mergeDuplicateMemberRecords([
        functionSymbol({ id: 'same', qualifiedName: 'xrpl::a' }),
        functionSymbol({ id: 'same', qualifiedName: 'xrpl::b' }),
      ]),
    ).toThrow(/identifies different symbols/);
  });
});
