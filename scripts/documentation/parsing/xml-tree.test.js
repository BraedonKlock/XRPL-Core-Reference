import { describe, expect, it } from 'vitest';
import { findChild, findRootElement, normalizedTextOf, parseXmlText, tagNameOf, textOf } from './xml-tree.js';

describe('xml-tree', () => {
  it('preserves the order of mixed text and element content', () => {
    const root = findRootElement(
      parseXmlText('<type>std::optional&lt; <ref refid="a">UInt256</ref> const &gt; const &amp;</type>'),
      'type',
    );
    expect(textOf(root)).toBe('std::optional< UInt256 const > const &');
    expect(tagNameOf(findChild(root, 'ref'))).toBe('ref');
  });

  it('normalizes whitespace in text content', () => {
    const root = findRootElement(
      parseXmlText('<para>  State   information\n when applying a tx. </para>'),
      'para',
    );
    expect(normalizedTextOf(root)).toBe('State information when applying a tx.');
  });
});
