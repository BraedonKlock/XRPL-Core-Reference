import { describe, expect, it } from 'vitest';
import { classifyLinkDestination, linksInMarkdown, parseInlineMarkdown, parseMarkdown } from './markdown.js';

describe('developer notes Markdown subset', () => {
  it('splits paragraphs on blank lines and joins wrapped lines', () => {
    expect(parseMarkdown('First line\ncontinues.\n\nSecond paragraph.')).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'First line continues.' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Second paragraph.' }] },
    ]);
  });

  it('parses unordered and ordered lists with continuation lines', () => {
    const blocks = parseMarkdown('- one\n  more\n- two\n\n3. three\n4. four');
    expect(blocks).toEqual([
      {
        type: 'list',
        ordered: false,
        start: 1,
        items: [[{ type: 'text', text: 'one more' }], [{ type: 'text', text: 'two' }]],
      },
      {
        type: 'list',
        ordered: true,
        start: 3,
        items: [[{ type: 'text', text: 'three' }], [{ type: 'text', text: 'four' }]],
      },
    ]);
  });

  it('keeps fenced code verbatim, including Markdown characters', () => {
    expect(parseMarkdown('```cpp\nif (*p)\n\n    return `x`;\n```')).toEqual([
      { type: 'code', language: 'cpp', text: 'if (*p)\n\n    return `x`;' },
    ]);
  });

  it('parses inline code, emphasis and strong text', () => {
    expect(parseInlineMarkdown('Use `a*b` and *this* or **that**')).toEqual([
      { type: 'text', text: 'Use ' },
      { type: 'code', text: 'a*b' },
      { type: 'text', text: ' and ' },
      { type: 'emphasis', children: [{ type: 'text', text: 'this' }] },
      { type: 'text', text: ' or ' },
      { type: 'strong', children: [{ type: 'text', text: 'that' }] },
    ]);
  });

  it('leaves snake_case, lone asterisks and unclosed markers as text', () => {
    expect(parseInlineMarkdown('a_b_c * d `open')).toEqual([{ type: 'text', text: 'a_b_c * d `open' }]);
  });

  it('honours backslash escapes', () => {
    expect(parseInlineMarkdown(String.raw`\*not emphasis\* and \[not a link\]`)).toEqual([
      { type: 'text', text: '*not emphasis* and [not a link]' },
    ]);
  });

  it('keeps raw HTML as text', () => {
    expect(parseInlineMarkdown('<img src=x onerror=alert(1)>')).toEqual([
      { type: 'text', text: '<img src=x onerror=alert(1)>' },
    ]);
  });

  it('parses symbol links whose signature keys contain parentheses and spaces', () => {
    const [link] = parseInlineMarkdown('[`Asset::native`](symbol:xrpl::Asset::native()const)');
    expect(link).toEqual({
      type: 'link',
      destination: 'symbol:xrpl::Asset::native()const',
      target: { kind: 'symbol', symbol: 'xrpl::Asset::native()const' },
      children: [{ type: 'code', text: 'Asset::native' }],
    });
    expect(parseInlineMarkdown('[x](symbol:xrpl::isXRP(Asset const&))')[0].target.symbol).toBe(
      'xrpl::isXRP(Asset const&)',
    );
  });

  it('classifies link destinations and rejects unsafe schemes', () => {
    expect(classifyLinkDestination('symbol:xrpl::isXRP')).toEqual({ kind: 'symbol', symbol: 'xrpl::isXRP' });
    expect(classifyLinkDestination('https://xrpl.org/')).toEqual({
      kind: 'external',
      href: 'https://xrpl.org/',
    });
    for (const destination of [
      'javascript:alert(1)',
      'data:text/html,x',
      '/symbols/xrpl',
      'symbol:',
      'vbscript:x',
      'overloads:xrpl::isXRP',
    ]) {
      expect(classifyLinkDestination(destination)).toEqual({ kind: 'invalid' });
    }
  });

  it('does not nest links inside link text', () => {
    const [link] = parseInlineMarkdown('[a [b](https://b.example/)](https://a.example/)');
    expect(link.children.every((child) => child.type !== 'link')).toBe(true);
  });

  it('collects links from paragraphs and lists but not code', () => {
    const links = linksInMarkdown(
      '[a](symbol:xrpl::A)\n\n- [b](symbol:xrpl::b(int))\n\n```\n[c](symbol:xrpl::C)\n```',
    );
    expect(links.map((link) => link.destination)).toEqual(['symbol:xrpl::A', 'symbol:xrpl::b(int)']);
  });
});
