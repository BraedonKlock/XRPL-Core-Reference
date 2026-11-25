import { describe, expect, it } from 'vitest';
import {
  classSymbol,
  functionSymbol,
  namespaceSymbol,
  parameter,
  variableSymbol,
} from '../../../tests/helpers/symbol-builders.js';
import {
  assignSymbolPaths,
  encodePathSegment,
  findPathCollisions,
  nameSegmentOf,
  operatorPathSegment,
} from './symbol-paths.js';
import { overloadHashOf, signatureKeyOf } from './signature-key.js';

const URL_SAFE_SEGMENT = /^[A-Za-z0-9_~.%-]+$/;

function corpus() {
  const xrpl = namespaceSymbol({ id: 'xrpl', qualifiedName: 'xrpl' });
  const std = namespaceSymbol({ id: 'std', qualifiedName: 'std' });
  const applyContext = classSymbol({ id: 'ac', qualifiedName: 'xrpl::ApplyContext', ownerId: 'xrpl' });
  const constructor = functionSymbol({
    id: 'ctor',
    name: 'ApplyContext',
    qualifiedName: 'xrpl::ApplyContext::ApplyContext',
    ownerId: 'ac',
    role: 'constructor',
    returnType: null,
    parameters: [parameter('OpenView&', 'base')],
  });
  const copyConstructor = functionSymbol({
    id: 'copy',
    name: 'ApplyContext',
    qualifiedName: 'xrpl::ApplyContext::ApplyContext',
    ownerId: 'ac',
    role: 'constructor',
    returnType: null,
    parameters: [parameter('ApplyContext const&')],
  });
  const destructor = functionSymbol({
    id: 'dtor',
    name: '~ApplyContext',
    qualifiedName: 'xrpl::ApplyContext::~ApplyContext',
    ownerId: 'ac',
    role: 'destructor',
    returnType: null,
  });
  const equality = functionSymbol({
    id: 'eq',
    name: 'operator==',
    qualifiedName: 'xrpl::operator==',
    ownerId: 'xrpl',
    role: 'operator',
  });
  const hash = classSymbol({
    id: 'hash',
    kind: 'struct',
    name: 'hash< xrpl::AccountID >',
    qualifiedName: 'std::hash< xrpl::AccountID >',
    ownerId: 'std',
    isTemplateSpecialization: true,
  });
  const template = functionSymbol({
    id: 'rand',
    name: 'randInt',
    qualifiedName: 'xrpl::randInt',
    ownerId: 'xrpl',
    templateParameters: [{ type: [{ text: 'class' }], name: 'Integral', defaultValue: null }],
    returnType: [{ text: 'Integral' }],
    parameters: [parameter('Integral', 'max')],
  });
  return {
    symbols: [xrpl, std, applyContext, constructor, copyConstructor, destructor, equality, hash, template],
    constructor,
    copyConstructor,
    destructor,
    equality,
    hash,
    template,
    applyContext,
  };
}

describe('symbol paths', () => {
  it('nests members under their owner and gives each overload its own path', () => {
    const { symbols, applyContext, constructor, copyConstructor, destructor } = corpus();
    assignSymbolPaths(symbols);
    expect(applyContext.path).toBe('xrpl/ApplyContext');
    expect(constructor.overloadSetPath).toBe('xrpl/ApplyContext/ApplyContext');
    expect(constructor.path).toBe(
      `xrpl/ApplyContext/ApplyContext/${overloadHashOf(signatureKeyOf(constructor))}`,
    );
    expect(copyConstructor.overloadSetPath).toBe(constructor.overloadSetPath);
    expect(copyConstructor.path).not.toBe(constructor.path);
    expect(destructor.overloadSetPath).toBe('xrpl/ApplyContext/~ApplyContext');
    expect(constructor.scopePath).toBe('xrpl/ApplyContext');
  });

  it('gives operators readable, URL-safe segments', () => {
    const { symbols, equality } = corpus();
    assignSymbolPaths(symbols);
    expect(equality.overloadSetPath).toBe('xrpl/operator-equal');
    expect(operatorPathSegment('operator()')).toBe('operator-call');
    expect(operatorPathSegment('operator/')).toBe('operator-divide');
    expect(operatorPathSegment('operator<<=')).toBe('operator-shift-left-assign');
    expect(operatorPathSegment('operator<=>')).toBe('operator-three-way-compare');
    expect(operatorPathSegment('operator delete[]')).toBe('operator-delete-array');
    expect(operatorPathSegment('operator bool')).toBe('operator-conversion-bool');
    expect(operatorPathSegment('operator char const *')).toBe('operator-conversion-char_const%2A');
    expect(operatorPathSegment('operator json::StaticString const &')).toBe(
      'operator-conversion-json%3A%3AStaticString_const%26',
    );
    expect(operatorPathSegment('operator""_kb')).toBe('operator-literal-_kb');
    expect(operatorPathSegment('operatorName')).toBeNull();
  });

  it('encodes template specializations reversibly', () => {
    const { symbols, hash } = corpus();
    assignSymbolPaths(symbols);
    expect(hash.path).toBe('std/hash%3Cxrpl%3A%3AAccountID%3E');
    expect(decodeURIComponent(hash.path.split('/')[1])).toBe('hash<xrpl::AccountID>');
  });

  it('includes template identity in function overload hashes', () => {
    const { symbols, template } = corpus();
    assignSymbolPaths(symbols);
    expect(template.signatureKey).toBe('template<class>xrpl::randInt(Integral)->Integral');
    expect(template.path).toMatch(/^xrpl\/randInt\/[0-9a-f]{8}$/);
  });

  it('is deterministic', () => {
    const first = corpus();
    const second = corpus();
    assignSymbolPaths(first.symbols);
    assignSymbolPaths(second.symbols);
    expect(first.symbols.map((symbol) => symbol.path)).toEqual(second.symbols.map((symbol) => symbol.path));
  });

  it.each([
    'operator()',
    'operator[]',
    'operator->',
    'operator/',
    'operator/=',
    'operator<',
    'operator>>',
    'operator&&',
    'operator,',
    'operator std::vector< UInt256 >',
    'hash< xrpl::Book >',
    '~Foo',
    'Foo bar',
    'x/y',
  ])('produces a single URL-safe segment for %s', (name) => {
    const segment = nameSegmentOf(name);
    expect(segment).toMatch(URL_SAFE_SEGMENT);
    expect(segment).not.toContain('/');
  });

  it('detects collisions between symbols and overload sets', () => {
    const xrpl = namespaceSymbol({ id: 'xrpl', qualifiedName: 'xrpl' });
    const scopeExit = classSymbol({ id: 'class', qualifiedName: 'xrpl::ScopeExit', ownerId: 'xrpl' });
    const guide = functionSymbol({
      id: 'guide',
      qualifiedName: 'xrpl::ScopeExit',
      ownerId: 'xrpl',
      returnType: null,
    });
    const first = variableSymbol({ id: 'v1', qualifiedName: 'xrpl::kFee', ownerId: 'xrpl' });
    const second = variableSymbol({ id: 'v2', qualifiedName: 'xrpl::kFee', ownerId: 'xrpl' });
    const symbols = [xrpl, scopeExit, guide, first, second];
    assignSymbolPaths(symbols);
    const collisions = findPathCollisions(symbols);
    expect(collisions.map((collision) => collision.path).sort()).toEqual(['xrpl/ScopeExit', 'xrpl/kFee']);
    expect(
      collisions
        .find((collision) => collision.path === 'xrpl/ScopeExit')
        .claimants.map((claimant) => claimant.role)
        .sort(),
    ).toEqual(['overload-set', 'symbol']);
  });

  it('reports no collisions for distinct overloads', () => {
    const { symbols } = corpus();
    assignSymbolPaths(symbols);
    expect(findPathCollisions(symbols)).toEqual([]);
  });

  it('encodes spaces and reserved characters', () => {
    expect(encodePathSegment('unsigned int')).toBe('unsigned_int');
    expect(encodePathSegment("a'b(c)")).toBe('a%27b%28c%29');
  });
});
