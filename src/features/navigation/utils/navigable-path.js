import { parentPathOf } from '../../../services/documentation/symbol-directory.js';

const NAVIGABLE_KINDS = new Set(['namespace', 'class', 'struct', 'union', 'concept']);

export function nearestNavigablePath(symbolPath, directory) {
  let current = symbolPath;
  while (current) {
    if (NAVIGABLE_KINDS.has(directory.get(current)?.kind)) {
      return current;
    }
    current = parentPathOf(current);
  }
  return null;
}
