import { describe, expect, it } from 'vitest';
import { buildTargetIndex, createReferenceResolver } from './reference-resolution.js';

const SYMBOLS = [
  { id: 'applyview', path: 'xrpl/ApplyView', kind: 'class' },
  { id: 'ter', path: 'xrpl/TERcodes', kind: 'enum', enumerators: [{ id: 'terretry', name: 'terRETRY' }] },
];

function resolver(redirects) {
  return createReferenceResolver({
    targets: buildTargetIndex(SYMBOLS, redirects),
    excludedReasons: new Map([['anon', 'anonymous-namespace']]),
  });
}

describe('reference resolution', () => {
  it('resolves structured references to public paths', () => {
    const { resolveExpression, statistics } = resolver();
    expect(
      resolveExpression([{ text: 'ApplyView', refId: 'applyview' }, { text: ' const&' }], 'ctx'),
    ).toEqual([
      { text: 'ApplyView', target: { path: 'xrpl/ApplyView', resolution: 'doxygen' } },
      { text: ' const&' },
    ]);
    expect(statistics.resolved.doxygen).toBe(1);
  });

  it('resolves enumerators to their enum with a fragment', () => {
    expect(resolver().resolveExpression([{ text: 'terRETRY', refId: 'terretry' }], 'ctx')).toEqual([
      { text: 'terRETRY', target: { path: 'xrpl/TERcodes', fragment: 'terRETRY', resolution: 'doxygen' } },
    ]);
  });

  it('degrades unresolved references to plain text and records why', () => {
    const { resolveExpression, resolveInlineContent, statistics } = resolver();
    expect(
      resolveExpression([{ text: 'std::vector<' }, { text: 'Helper', refId: 'anon' }, { text: '>' }], 'ctx'),
    ).toEqual([{ text: 'std::vector<Helper>' }]);
    expect(
      resolveInlineContent(
        [
          { type: 'text', text: 'See ' },
          { type: 'link', text: 'Missing', refId: 'missing' },
        ],
        'ctx',
      ),
    ).toEqual([{ type: 'text', text: 'See Missing' }]);
    expect(statistics.unresolvedByReason).toEqual({ 'anonymous-namespace': 1, 'unknown-target': 1 });
  });

  it('applies redirects with their own resolution', () => {
    const { resolveEdgeTarget } = resolver(
      new Map([['friend', { targetId: 'applyview', resolution: 'scope' }]]),
    );
    expect(resolveEdgeTarget('friend', 'ApplyView', 'ctx')).toEqual({
      path: 'xrpl/ApplyView',
      resolution: 'scope',
    });
    expect(resolveEdgeTarget(null, 'std::exception', 'ctx')).toBeNull();
  });
});
