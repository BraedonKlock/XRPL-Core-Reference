export function indexInheritance(relationships) {
  const basesByDerived = new Map();
  for (const edge of relationships.inheritance) {
    if (!basesByDerived.has(edge.derived)) {
      basesByDerived.set(edge.derived, []);
    }
    basesByDerived.get(edge.derived).push(edge);
  }
  return basesByDerived;
}

export function baseTreeOf(symbolPath, basesByDerived, visited = new Set([symbolPath])) {
  return (basesByDerived.get(symbolPath) ?? []).map((edge) => {
    const isCycle = edge.base !== null && visited.has(edge.base);
    const nextVisited = edge.base ? new Set([...visited, edge.base]) : visited;
    return {
      path: edge.base,
      name: edge.baseName,
      access: edge.access,
      isVirtual: edge.isVirtual,
      bases: edge.base && !isCycle ? baseTreeOf(edge.base, basesByDerived, nextVisited) : [],
    };
  });
}

export function ancestorPathsOf(tree) {
  const paths = [];
  const visit = (nodes) => {
    for (const node of nodes) {
      if (node.path && !paths.includes(node.path)) {
        paths.push(node.path);
      }
      visit(node.bases);
    }
  };
  visit(tree);
  return paths;
}
