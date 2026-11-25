const OVERLOAD_SEGMENT = /^[0-9a-f]{8}$/;

function rowToEntry(columns, row, shards) {
  const entry = Object.fromEntries(columns.map((column, position) => [column, row[position]]));
  return { ...entry, shard: shards[entry.shard] };
}

export function parentPathOf(symbolPath) {
  const separator = symbolPath.lastIndexOf('/');
  return separator > 0 ? symbolPath.slice(0, separator) : null;
}

export function ancestorPathsOf(symbolPath) {
  const ancestors = [];
  let current = parentPathOf(symbolPath);
  while (current) {
    ancestors.unshift(current);
    current = parentPathOf(current);
  }
  return ancestors;
}

export function createSymbolDirectory(searchIndex) {
  const entries = new Map();
  const entriesByQualifiedName = new Map();
  const childrenByParent = new Map();
  for (const row of searchIndex.rows) {
    const entry = rowToEntry(searchIndex.columns, row, searchIndex.shards);
    entries.set(entry.path, entry);
    if (!entriesByQualifiedName.has(entry.qualifiedName)) {
      entriesByQualifiedName.set(entry.qualifiedName, entry);
    }
    const parentPath = parentPathOf(entry.path);
    if (parentPath) {
      if (!childrenByParent.has(parentPath)) {
        childrenByParent.set(parentPath, []);
      }
      childrenByParent.get(parentPath).push(entry);
    }
  }
  const allEntries = [...entries.values()];

  const resolve = (symbolPath) => {
    const direct = entries.get(symbolPath);
    if (direct) {
      return { entry: direct, overloadPath: null };
    }
    const lastSegment = symbolPath.slice(symbolPath.lastIndexOf('/') + 1);
    const overloadSet = entries.get(parentPathOf(symbolPath) ?? '');
    if (overloadSet?.kind === 'function' && OVERLOAD_SEGMENT.test(lastSegment)) {
      return { entry: overloadSet, overloadPath: symbolPath };
    }
    return null;
  };

  return {
    size: entries.size,
    entries: () => allEntries,
    childrenOf: (symbolPath) => childrenByParent.get(symbolPath) ?? [],
    get: (symbolPath) => entries.get(symbolPath) ?? null,
    findByQualifiedName: (qualifiedName) => entriesByQualifiedName.get(qualifiedName) ?? null,
    resolve,
  };
}
