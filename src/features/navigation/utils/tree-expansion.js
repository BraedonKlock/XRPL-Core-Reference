import { ancestorPathsOf } from '../../../services/documentation/symbol-directory.js';

export function withAncestorsExpanded(expandedPaths, activePath) {
  if (!activePath) {
    return expandedPaths;
  }
  const missing = ancestorPathsOf(activePath).filter((path) => !expandedPaths.has(path));
  return missing.length === 0 ? expandedPaths : new Set([...expandedPaths, ...missing]);
}

export function toggledExpansion(expandedPaths, path) {
  const next = new Set(expandedPaths);
  if (next.has(path)) {
    next.delete(path);
  } else {
    next.add(path);
  }
  return next;
}
