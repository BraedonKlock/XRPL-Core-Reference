import { extname } from 'node:path';
import { expectedSourceNames, findNameOffset } from '../normalization/source-name-verification.js';

const NEARBY_TOLERANCE = 1;
const MAX_EXAMPLES = 25;

function classifyOffset(offset) {
  if (offset === 0) {
    return 'exact';
  }
  if (offset !== null && offset <= NEARBY_TOLERANCE) {
    return 'nearby';
  }
  return offset === null ? 'notFound' : 'wide';
}

export function verifySourceLocations(records, sourceFiles) {
  const outcomes = { exact: 0, nearby: 0, wide: 0, notFound: 0, lineUnavailable: 0, missingFile: 0 };
  const byExtension = {};
  const notFoundExamples = [];
  const checkable = records.filter((record) => record.kind !== 'namespace' && record.location);
  for (const record of checkable) {
    const { file, line } = record.location.declaration;
    if (!sourceFiles.exists(file)) {
      outcomes.missingFile += 1;
      continue;
    }
    if (line === null) {
      outcomes.lineUnavailable += 1;
      continue;
    }
    const outcome = classifyOffset(findNameOffset(sourceFiles, file, line, expectedSourceNames(record)));
    outcomes[outcome] += 1;
    const extension = extname(file) || '(none)';
    if (!Object.hasOwn(byExtension, extension)) {
      byExtension[extension] = { exact: 0, nearby: 0, wide: 0, notFound: 0 };
    }
    byExtension[extension][outcome] += 1;
    if (outcome === 'notFound' && notFoundExamples.length < MAX_EXAMPLES) {
      notFoundExamples.push({ path: record.path, kind: record.kind, file, line });
    }
  }
  return { checked: checkable.length, outcomes, byExtension, notFoundExamples };
}
