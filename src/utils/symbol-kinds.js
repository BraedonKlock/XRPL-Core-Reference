const KIND_LABELS = Object.freeze({
  namespace: 'namespace',
  class: 'class',
  struct: 'struct',
  union: 'union',
  concept: 'concept',
  function: 'function',
  variable: 'variable',
  typeAlias: 'type alias',
  enum: 'enum',
});

const ROLE_LABELS = Object.freeze({
  constructor: 'constructor',
  destructor: 'destructor',
  operator: 'operator',
  conversion: 'conversion operator',
  method: 'method',
  function: 'function',
  friend: 'friend function',
});

const KIND_GLYPHS = Object.freeze({ namespace: 'N', class: 'C', struct: 'S', union: 'U', concept: 'K' });

export function kindLabelOf({ kind, role }) {
  return (kind === 'function' && ROLE_LABELS[role]) || KIND_LABELS[kind] || kind;
}

export function kindGlyphOf(kind) {
  return KIND_GLYPHS[kind] ?? '•';
}
