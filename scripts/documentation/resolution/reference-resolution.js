const DOXYGEN_RESOLUTION = 'doxygen';
const UNKNOWN_TARGET = 'unknown-target';
const MAX_UNRESOLVED_EXAMPLES = 25;

export function buildTargetIndex(symbols, redirects = new Map()) {
  const targets = new Map();
  for (const symbol of symbols) {
    targets.set(symbol.id, { path: symbol.path, kind: symbol.kind });
    for (const enumerator of symbol.enumerators ?? []) {
      if (enumerator.id) {
        targets.set(enumerator.id, { path: symbol.path, fragment: enumerator.name, kind: 'enumerator' });
      }
    }
  }
  for (const [sourceId, { targetId, resolution }] of redirects) {
    const target = targets.get(targetId);
    if (target) {
      targets.set(sourceId, { ...target, resolution });
    }
  }
  return targets;
}

export function createReferenceResolver({ targets, excludedReasons }) {
  const statistics = {
    resolved: { doxygen: 0, scope: 0 },
    resolvedByTargetKind: {},
    unresolvedByReason: {},
    unresolvedExamples: [],
  };

  const recordUnresolved = (refId, text, context) => {
    const reason = excludedReasons.get(refId) ?? UNKNOWN_TARGET;
    statistics.unresolvedByReason[reason] =
      (Object.hasOwn(statistics.unresolvedByReason, reason) ? statistics.unresolvedByReason[reason] : 0) + 1;
    if (statistics.unresolvedExamples.length < MAX_UNRESOLVED_EXAMPLES) {
      statistics.unresolvedExamples.push({ text, reason, context });
    }
  };

  const resolveTarget = (refId, resolution, text, context) => {
    const target = targets.get(refId);
    if (!target) {
      recordUnresolved(refId, text, context);
      return null;
    }
    const effectiveResolution = target.resolution ?? resolution;
    statistics.resolved[effectiveResolution] += 1;
    statistics.resolvedByTargetKind[target.kind] =
      (Object.hasOwn(statistics.resolvedByTargetKind, target.kind)
        ? statistics.resolvedByTargetKind[target.kind]
        : 0) + 1;
    return target.fragment
      ? { path: target.path, fragment: target.fragment, resolution: effectiveResolution }
      : { path: target.path, resolution: effectiveResolution };
  };

  const resolveExpression = (expression, context) => {
    if (expression === null || expression === undefined) {
      return null;
    }
    const resolved = [];
    for (const token of expression) {
      const target =
        token.refId === undefined
          ? null
          : resolveTarget(token.refId, token.resolution ?? DOXYGEN_RESOLUTION, token.text, context);
      const previous = resolved.at(-1);
      if (!target && previous && !previous.target) {
        previous.text += token.text;
      } else {
        resolved.push(target ? { text: token.text, target } : { text: token.text });
      }
    }
    return resolved;
  };

  const resolveInlineContent = (content, context) => {
    if (!content) {
      return null;
    }
    const resolved = [];
    for (const inline of content) {
      if (inline.type !== 'link') {
        resolved.push({ ...inline });
        continue;
      }
      const target = resolveTarget(inline.refId, DOXYGEN_RESOLUTION, inline.text, context);
      if (target) {
        resolved.push({ type: 'link', text: inline.text, target });
      } else if (resolved.at(-1)?.type === 'text') {
        resolved.at(-1).text += inline.text;
      } else {
        resolved.push({ type: 'text', text: inline.text });
      }
    }
    return resolved;
  };

  const resolveEdgeTarget = (refId, name, context) =>
    refId ? resolveTarget(refId, DOXYGEN_RESOLUTION, name, context) : null;

  return { resolveExpression, resolveInlineContent, resolveEdgeTarget, statistics };
}
