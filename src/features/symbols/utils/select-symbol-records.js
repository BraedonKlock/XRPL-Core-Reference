export function selectSymbolRecords(records, { entry, overloadPath }) {
  if (entry.kind !== 'function') {
    const record = records.find((candidate) => candidate.path === entry.path);
    return record ? { record, overloads: [] } : null;
  }
  const overloads = records.filter((candidate) => candidate.overloadSet === entry.path);
  if (overloads.length === 0) {
    return null;
  }
  if (overloadPath) {
    const record = overloads.find((candidate) => candidate.path === overloadPath);
    return record ? { record, overloads } : null;
  }
  return { record: overloads.length === 1 ? overloads[0] : null, overloads };
}
