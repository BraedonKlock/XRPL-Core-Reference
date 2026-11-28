const KEYWORDS = new Set([
  'alignas',
  'alignof',
  'auto',
  'bool',
  'break',
  'case',
  'catch',
  'char',
  'char8_t',
  'char16_t',
  'char32_t',
  'class',
  'co_await',
  'co_return',
  'co_yield',
  'concept',
  'const',
  'const_cast',
  'consteval',
  'constexpr',
  'constinit',
  'continue',
  'decltype',
  'default',
  'delete',
  'do',
  'double',
  'dynamic_cast',
  'else',
  'enum',
  'explicit',
  'export',
  'extern',
  'false',
  'final',
  'float',
  'for',
  'friend',
  'goto',
  'if',
  'inline',
  'int',
  'long',
  'mutable',
  'namespace',
  'new',
  'noexcept',
  'nullptr',
  'operator',
  'override',
  'private',
  'protected',
  'public',
  'reinterpret_cast',
  'requires',
  'return',
  'short',
  'signed',
  'sizeof',
  'static',
  'static_assert',
  'static_cast',
  'struct',
  'switch',
  'template',
  'this',
  'thread_local',
  'throw',
  'true',
  'try',
  'typedef',
  'typeid',
  'typename',
  'union',
  'unsigned',
  'using',
  'virtual',
  'void',
  'volatile',
  'wchar_t',
  'while',
]);

const TOKEN_PATTERN = new RegExp(
  [
    String.raw`(?<comment>\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))`,
    String.raw`(?<string>(?:u8|[uUL])?R"(?<delimiter>[^()\\\s]{0,16})\([\s\S]*?\)\k<delimiter>"|(?:u8|[uUL])?"(?:\\.|[^"\\\n])*"?|(?:u8|[uUL])?'(?:\\.|[^'\\\n])*'?)`,
    String.raw`(?<preprocessor>^[ \t]*#[^\n]*)`,
    String.raw`(?<number>\b(?:0[xX][0-9a-fA-F']+|0[bB][01']+|\d[\d']*(?:\.\d[\d']*)?(?:[eE][+-]?\d+)?)[uUlLfFzZ]*\b)`,
    String.raw`(?<identifier>[A-Za-z_]\w*)`,
  ].join('|'),
  'gm',
);

const TOKEN_TYPES = Object.freeze(['comment', 'string', 'preprocessor', 'number']);

function tokenTypeOf(groups) {
  const type = TOKEN_TYPES.find((candidate) => groups[candidate] !== undefined);
  if (type) {
    return type;
  }
  return KEYWORDS.has(groups.identifier) ? 'keyword' : 'plain';
}

export function highlightCpp(code) {
  const tokens = [];
  const push = (type, text) => {
    const last = tokens.at(-1);
    if (last && last.type === type && type === 'plain') {
      last.text += text;
    } else if (text) {
      tokens.push({ type, text });
    }
  };
  let position = 0;
  for (const match of code.matchAll(TOKEN_PATTERN)) {
    push('plain', code.slice(position, match.index));
    push(tokenTypeOf(match.groups), match[0]);
    position = match.index + match[0].length;
  }
  push('plain', code.slice(position));
  return tokens;
}
