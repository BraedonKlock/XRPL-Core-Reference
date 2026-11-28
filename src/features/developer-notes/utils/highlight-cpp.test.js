import { describe, expect, it } from 'vitest';
import { highlightCpp } from './highlight-cpp.js';

function typed(code) {
  return highlightCpp(code).filter((token) => token.type !== 'plain');
}

describe('C++ highlighting', () => {
  it('preserves the source text exactly', () => {
    const code = '#include <x>\nauto const n = 0x1F; // done\nstd::string s{"a\\"b"};\n';
    expect(
      highlightCpp(code)
        .map((token) => token.text)
        .join(''),
    ).toBe(code);
  });

  it('classifies keywords, numbers, strings, comments and preprocessor lines', () => {
    expect(typed('#include <vector>\nif (n == 1\'000u) return "x"; /* c */')).toEqual([
      { type: 'preprocessor', text: '#include <vector>' },
      { type: 'keyword', text: 'if' },
      { type: 'number', text: "1'000u" },
      { type: 'keyword', text: 'return' },
      { type: 'string', text: '"x"' },
      { type: 'comment', text: '/* c */' },
    ]);
  });

  it('does not highlight keywords inside identifiers, strings or comments', () => {
    expect(typed('interface returnValue; // if return')).toEqual([{ type: 'comment', text: '// if return' }]);
    expect(typed('"for while"')).toEqual([{ type: 'string', text: '"for while"' }]);
  });

  it('handles raw strings, character literals and unterminated input', () => {
    expect(typed('R"x(a "quoted" )x" \'c\'')).toEqual([
      { type: 'string', text: 'R"x(a "quoted" )x"' },
      { type: 'string', text: "'c'" },
    ]);
    expect(typed('/* open')).toEqual([{ type: 'comment', text: '/* open' }]);
  });
});
