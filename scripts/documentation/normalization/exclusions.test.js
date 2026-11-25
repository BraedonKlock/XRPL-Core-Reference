import { describe, expect, it } from 'vitest';
import {
  classSymbol,
  functionSymbol,
  location,
  namespaceSymbol,
} from '../../../tests/helpers/symbol-builders.js';
import { applyExclusions, assignCategories, EXCLUSION_REASONS } from './exclusions.js';

const INCLUDED = { includedCategories: ['production'] };

describe('exclusions', () => {
  it('assigns categories from declaration paths', () => {
    const [production, test, unknown] = assignCategories([
      functionSymbol({ qualifiedName: 'a', location: location('src/xrpld/app/main/Main.cpp', 1) }),
      functionSymbol({ qualifiedName: 'b', location: location('src/test/app/Payment_test.cpp', 1) }),
      functionSymbol({ qualifiedName: 'c', location: null }),
    ]);
    expect([production.category, test.category, unknown.category]).toEqual(['production', 'test', null]);
  });

  it('excludes anonymous namespaces, phantom namespaces, macros and their members', () => {
    const anonymous = namespaceSymbol({ id: 'anon', qualifiedName: 'xrpl::@123' });
    const phantom = namespaceSymbol({
      id: 'phantom',
      qualifiedName: 'ReadView',
      location: null,
      category: null,
    });
    const helper = functionSymbol({ id: 'helper', qualifiedName: 'xrpl::@123::helper', ownerId: 'anon' });
    const nested = classSymbol({ id: 'nested', qualifiedName: 'Hidden', ownerId: 'anon' });
    const macro = { ...functionSymbol({ id: 'macro', qualifiedName: 'XRPL_ASSERT' }), kind: 'macro' };
    const kept = classSymbol({ id: 'kept', qualifiedName: 'xrpl::ApplyContext', memberIds: ['macro'] });
    const { symbols, excludedReasons } = applyExclusions(
      [anonymous, phantom, helper, nested, macro, kept],
      INCLUDED,
    );
    expect(symbols.map((symbol) => symbol.id)).toEqual(['kept']);
    expect(Object.fromEntries(excludedReasons)).toEqual({
      anon: EXCLUSION_REASONS.anonymousNamespace,
      phantom: EXCLUSION_REASONS.phantomNamespace,
      helper: EXCLUSION_REASONS.anonymousNamespace,
      nested: EXCLUSION_REASONS.ownerExcluded,
      macro: EXCLUSION_REASONS.preprocessorMacro,
    });
    expect(kept.memberIds).toEqual([]);
  });

  it('excludes symbols outside the included categories', () => {
    const testSymbol = functionSymbol({ qualifiedName: 'xrpl::test::helper', category: 'test' });
    expect(applyExclusions([testSymbol], INCLUDED).excluded[0].reason).toBe(
      EXCLUSION_REASONS.outsideCategories,
    );
    expect(
      applyExclusions([testSymbol], { includedCategories: ['production', 'test'] }).symbols,
    ).toHaveLength(1);
  });

  it('turns friend class declarations into relationships on their owner', () => {
    const owner = classSymbol({ id: 'iterator', qualifiedName: 'xrpl::SHAMap::ConstIterator' });
    const friendClass = {
      ...functionSymbol({
        id: 'friend',
        qualifiedName: 'xrpl::SHAMap::ConstIterator::SHAMap',
        ownerId: 'iterator',
      }),
      kind: 'friendClass',
      friendRefId: null,
    };
    const { symbols, friendClassSymbols } = applyExclusions([owner, friendClass], INCLUDED);
    expect(symbols).toEqual([owner]);
    expect(owner.friendClasses).toEqual([{ name: 'SHAMap', refId: 'friend' }]);
    expect(friendClassSymbols).toEqual([friendClass]);
  });
});
