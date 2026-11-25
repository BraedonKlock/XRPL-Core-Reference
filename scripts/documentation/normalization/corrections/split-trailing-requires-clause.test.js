import { describe, expect, it } from 'vitest';
import { functionSymbol, text } from '../../../../tests/helpers/symbol-builders.js';
import {
  findTopLevelRequiresOffset,
  SPLIT_TRAILING_REQUIRES_CLAUSE,
  splitExpressionAt,
  splitTrailingRequiresClause,
} from './split-trailing-requires-clause.js';

describe(SPLIT_TRAILING_REQUIRES_CLAUSE, () => {
  it('moves a folded requires clause out of the return type', () => {
    const insert = functionSymbol({
      qualifiedName: 'beast::detail::AgedOrderedContainer::insert',
      returnType: [
        { text: 'std::pair<' },
        { text: 'iterator', refId: 'iter' },
        { text: ', bool> requires(!MaybeMulti)' },
      ],
    });
    const result = splitTrailingRequiresClause([insert]);
    expect(insert.returnType).toEqual([
      { text: 'std::pair<' },
      { text: 'iterator', refId: 'iter' },
      { text: ', bool>' },
    ]);
    expect(insert.requiresClause).toEqual([{ text: '(!MaybeMulti)' }]);
    expect(result.applied).toHaveLength(1);
  });

  it('ignores requires inside template arguments and identifiers containing the keyword', () => {
    expect(findTopLevelRequiresOffset('Foo<requires_x>')).toBe(-1);
    expect(findTopLevelRequiresOffset('decltype(requires {x;})')).toBe(-1);
    expect(findTopLevelRequiresOffset('prerequisites')).toBe(-1);
  });

  it('reports a return type that conflicts with an existing requires clause', () => {
    const conflicting = functionSymbol({
      qualifiedName: 'x',
      returnType: text('int requires A'),
      requiresClause: text('B'),
    });
    expect(splitTrailingRequiresClause([conflicting]).unresolved).toHaveLength(1);
    expect(conflicting.returnType).toEqual(text('int requires A'));
  });

  it('refuses to split inside a linked token', () => {
    expect(splitExpressionAt([{ text: 'abcdef', refId: 'x' }], 3)).toBeNull();
  });
});
