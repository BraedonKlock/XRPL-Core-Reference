import { describe, expect, it } from 'vitest';
import {
  isAnonymousQualifiedName,
  isTemplateSpecializationName,
  simpleNameOf,
  splitQualifiedName,
  templateBaseNameOf,
} from './qualified-name.js';

describe('qualified names', () => {
  it('splits scopes without breaking template arguments', () => {
    expect(splitQualifiedName('std::hash< xrpl::AccountID >')).toEqual(['std', 'hash< xrpl::AccountID >']);
    expect(splitQualifiedName('beast::detail::Aged< A::B, C >::insert')).toEqual([
      'beast',
      'detail',
      'Aged< A::B, C >',
      'insert',
    ]);
  });

  it('keeps operator names intact', () => {
    expect(splitQualifiedName('xrpl::IOUAmount::operator<<')).toEqual(['xrpl', 'IOUAmount', 'operator<<']);
    expect(splitQualifiedName('xrpl::Foo::operator()')).toEqual(['xrpl', 'Foo', 'operator()']);
    expect(splitQualifiedName('xrpl::Foo::operator json::Value')).toEqual([
      'xrpl',
      'Foo',
      'operator json::Value',
    ]);
    expect(simpleNameOf('xrpl::operatorName')).toBe('operatorName');
  });

  it('identifies template specializations and anonymous scopes', () => {
    expect(templateBaseNameOf('CountedObject< STTx >')).toBe('CountedObject');
    expect(isTemplateSpecializationName('hash< xrpl::Book >')).toBe(true);
    expect(isTemplateSpecializationName('operator<')).toBe(false);
    expect(isAnonymousQualifiedName('xrpl::@0123::helper')).toBe(true);
    expect(isAnonymousQualifiedName('xrpl::ApplyContext')).toBe(false);
  });
});
