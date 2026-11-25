import { describe, expect, it } from 'vitest';
import {
  classSymbol,
  functionSymbol,
  namespaceSymbol,
  parameter,
  text,
} from '../../../tests/helpers/symbol-builders.js';
import { linkScopeReferences, resolveFriendClassRedirects, SCOPE_RESOLUTION } from './scope-references.js';

function index(symbols) {
  return new Map(symbols.map((symbol) => [symbol.id, symbol]));
}

function clock(overrides = {}) {
  return classSymbol({
    id: 'clock',
    qualifiedName: 'beast::AbstractClock',
    ownerId: 'beast',
    memberIds: ['copy'],
    ...overrides,
  });
}

function copyConstructor(parameterType) {
  return functionSymbol({
    id: 'copy',
    name: 'AbstractClock',
    qualifiedName: 'beast::AbstractClock::AbstractClock',
    ownerId: 'clock',
    role: 'constructor',
    returnType: null,
    parameters: [parameter(parameterType)],
  });
}

describe('scope references', () => {
  it('links the injected class name inside the class', () => {
    const owner = clock();
    const member = copyConstructor('AbstractClock const&');
    const symbols = [namespaceSymbol({ id: 'beast', qualifiedName: 'beast' }), owner, member];
    const { linked } = linkScopeReferences(symbols, index(symbols));
    expect(linked).toBe(1);
    expect(member.parameters[0].type).toEqual([
      { text: 'AbstractClock', refId: 'clock', resolution: SCOPE_RESOLUTION },
      { text: ' const&' },
    ]);
  });

  it('does not link qualified names, template parameters or other identifiers', () => {
    const owner = clock({ templateParameters: null });
    const qualified = copyConstructor('other::AbstractClock const&');
    const symbols = [owner, qualified];
    linkScopeReferences(symbols, index(symbols));
    expect(qualified.parameters[0].type).toEqual(text('other::AbstractClock const&'));

    const shadowing = {
      ...copyConstructor('AbstractClock&'),
      templateParameters: [{ type: text('class'), name: 'AbstractClock', defaultValue: null }],
    };
    linkScopeReferences([owner, shadowing], index([owner, shadowing]));
    expect(shadowing.parameters[0].type).toEqual(text('AbstractClock&'));
  });

  it('links an enclosing class only when no nearer scope can hide the name', () => {
    const outer = classSymbol({ id: 'shamap', qualifiedName: 'xrpl::SHAMap', innerIds: ['iterator'] });
    const inner = classSymbol({
      id: 'iterator',
      qualifiedName: 'xrpl::SHAMap::ConstIterator',
      ownerId: 'shamap',
      memberIds: ['ctor'],
    });
    const member = functionSymbol({
      id: 'ctor',
      name: 'ConstIterator',
      qualifiedName: 'xrpl::SHAMap::ConstIterator::ConstIterator',
      ownerId: 'iterator',
      role: 'constructor',
      returnType: null,
      parameters: [parameter('SHAMap const*', 'map')],
    });
    linkScopeReferences([outer, inner, member], index([outer, inner, member]));
    expect(member.parameters[0].type[0]).toEqual({
      text: 'SHAMap',
      refId: 'shamap',
      resolution: SCOPE_RESOLUTION,
    });

    const shadowed = { ...inner, memberIds: ['ctor', 'alias'] };
    const alias = {
      ...functionSymbol({ id: 'alias', qualifiedName: 'xrpl::SHAMap::ConstIterator::SHAMap' }),
      name: 'SHAMap',
      kind: 'typeAlias',
    };
    const shadowedMember = { ...member, parameters: [parameter('SHAMap const*', 'map')] };
    linkScopeReferences(
      [outer, shadowed, alias, shadowedMember],
      index([outer, shadowed, alias, shadowedMember]),
    );
    expect(shadowedMember.parameters[0].type).toEqual(text('SHAMap const*'));
  });

  it('refuses to look through base classes it cannot see', () => {
    const outer = classSymbol({ id: 'outer', qualifiedName: 'xrpl::Outer' });
    const inner = classSymbol({
      id: 'inner',
      qualifiedName: 'xrpl::Outer::Inner',
      ownerId: 'outer',
      baseClasses: [{ name: 'std::exception', refId: null, access: 'public', isVirtual: false }],
    });
    const member = functionSymbol({
      id: 'm',
      qualifiedName: 'xrpl::Outer::Inner::m',
      ownerId: 'inner',
      role: 'method',
      parameters: [parameter('Outer&', 'o')],
    });
    linkScopeReferences([outer, inner, member], index([outer, inner, member]));
    expect(member.parameters[0].type).toEqual(text('Outer&'));
  });

  it('redirects friend declarations that name an enclosing class', () => {
    const outer = classSymbol({ id: 'shamap', qualifiedName: 'xrpl::SHAMap' });
    const inner = classSymbol({
      id: 'iterator',
      qualifiedName: 'xrpl::SHAMap::ConstIterator',
      ownerId: 'shamap',
    });
    const friendOfOuter = {
      ...functionSymbol({
        id: 'friend',
        qualifiedName: 'xrpl::SHAMap::ConstIterator::SHAMap',
        ownerId: 'iterator',
      }),
      name: 'SHAMap',
      kind: 'friendClass',
    };
    const friendOfStranger = { ...friendOfOuter, id: 'stranger', name: 'OverlayImpl' };
    const redirects = resolveFriendClassRedirects([friendOfOuter, friendOfStranger], index([outer, inner]));
    expect(Object.fromEntries(redirects)).toEqual({
      friend: { targetId: 'shamap', resolution: SCOPE_RESOLUTION },
    });
  });
});
