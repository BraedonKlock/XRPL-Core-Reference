import { describe, expect, it } from 'vitest';
import { functionSymbol, parameter, text } from '../../../tests/helpers/symbol-builders.js';
import { compactCppText, overloadHashOf, signatureKeyOf } from './signature-key.js';

function method(overrides) {
  return functionSymbol({ qualifiedName: 'xrpl::ApplyContext::view', role: 'method', ...overrides });
}

describe('signature keys', () => {
  it('distinguishes const and reference qualifiers', () => {
    const plain = method({});
    const constant = method({ qualifiers: { ...plain.qualifiers, isConst: true } });
    const rvalue = method({ qualifiers: { ...plain.qualifiers, referenceQualifier: 'rvalue' } });
    expect(new Set([signatureKeyOf(plain), signatureKeyOf(constant), signatureKeyOf(rvalue)]).size).toBe(3);
    expect(signatureKeyOf(constant)).toBe('xrpl::ApplyContext::view()const');
  });

  it('ignores parameter names, default values and spacing', () => {
    const first = method({ parameters: [parameter('STTx const &', 'tx', { defaultValue: text('x') })] });
    const second = method({ parameters: [parameter('STTx const&', 'transaction')] });
    expect(signatureKeyOf(first)).toBe(signatureKeyOf(second));
  });

  it('includes template parameters, return type and requires clause for templates', () => {
    const template = [{ type: text('bool'), name: 'MaybeMulti', defaultValue: text('IsMulti') }];
    const unique = method({
      qualifiedName: 'beast::Aged::insert',
      templateParameters: template,
      returnType: text('std::pair<iterator, bool>'),
      requiresClause: text('(!MaybeMulti)'),
    });
    const multi = method({
      qualifiedName: 'beast::Aged::insert',
      templateParameters: template,
      returnType: text('iterator'),
      requiresClause: text('MaybeMulti'),
    });
    expect(signatureKeyOf(unique)).toBe(
      'template<bool>beast::Aged::insert()->std::pair<iterator,bool> requires (!MaybeMulti)',
    );
    expect(signatureKeyOf(unique)).not.toBe(signatureKeyOf(multi));
  });

  it('keeps meaningful spaces between identifiers', () => {
    expect(compactCppText('unsigned  long const &')).toBe('unsigned long const&');
  });

  it('produces stable eight-character overload hashes', () => {
    expect(overloadHashOf('xrpl::ApplyContext::view()const')).toMatch(/^[0-9a-f]{8}$/);
    expect(overloadHashOf('a')).toBe(overloadHashOf('a'));
    expect(overloadHashOf('a')).not.toBe(overloadHashOf('b'));
  });
});
