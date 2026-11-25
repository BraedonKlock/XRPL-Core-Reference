import { describe, expect, it } from 'vitest';
import { parseElement } from '../../../tests/helpers/symbol-builders.js';
import {
  expressionText,
  joinExpressions,
  normalizeTypeSpacing,
  typeExpressionOf,
  valueExpressionOf,
} from './type-expression.js';

describe('type expressions', () => {
  it('keeps structured references and normalizes type spacing', () => {
    const node = parseElement(
      '<type>std::optional&lt; <ref refid="namespacexrpl_1a828887c5b310e7be87ca398a23c99874" kindref="member">UInt256</ref> const &gt; const &amp;</type>',
      'type',
    );
    expect(typeExpressionOf(node)).toEqual([
      { text: 'std::optional<' },
      { text: 'UInt256', refId: 'namespacexrpl_1a828887c5b310e7be87ca398a23c99874' },
      { text: ' const> const&' },
    ]);
  });

  it('does not rewrite spacing inside value expressions', () => {
    const node = parseElement('<defval>a &gt; b * 2</defval>', 'defval');
    expect(expressionText(valueExpressionOf(node))).toBe('a > b * 2');
  });

  it('normalizes pointer, reference and pack spacing', () => {
    expect(normalizeTypeSpacing('Args &&... args')).toBe('Args&&... args');
    expect(normalizeTypeSpacing('char const *')).toBe('char const*');
    expect(normalizeTypeSpacing('std::map< K , V >')).toBe('std::map<K, V>');
  });

  it('joins expressions and merges adjacent text', () => {
    expect(joinExpressions(['using X = ', [{ text: 'Y', refId: 'y' }], ''])).toEqual([
      { text: 'using X = ' },
      { text: 'Y', refId: 'y' },
    ]);
  });
});
