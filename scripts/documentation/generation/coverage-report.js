import { SCHEMA_VERSION } from '../../../contract/constants.js';

const MAX_UNRESOLVED_ITEMS_PER_CORRECTION = 50;
const MAX_EXCLUSION_EXAMPLES = 10;
const CLASS_LIKE_KINDS = new Set(['class', 'struct', 'union']);

function increment(counter, key, amount = 1) {
  counter[key] = (Object.hasOwn(counter, key) ? counter[key] : 0) + amount;
}

function coverageCategoryOf(record, recordsByPath) {
  if (record.kind !== 'function') {
    if (record.kind === 'variable') {
      return CLASS_LIKE_KINDS.has(recordsByPath.get(record.scope)?.kind)
        ? 'memberVariable'
        : 'namespaceVariable';
    }
    return record.kind;
  }
  if (record.role === 'method') {
    return record.qualifiers.isStatic ? 'staticMethod' : 'method';
  }
  return {
    function: 'freeFunction',
    constructor: 'constructor',
    destructor: 'destructor',
    operator: 'operator',
    conversion: 'conversionOperator',
    friend: 'friendFunction',
  }[record.role];
}

export function measureSymbolCounts(records) {
  const recordsByPath = new Map(records.map((record) => [record.path, record]));
  const counts = {};
  const overloadSetSizes = new Map();
  for (const record of records) {
    increment(counts, coverageCategoryOf(record, recordsByPath));
    if (record.kind === 'enum') {
      increment(counts, 'enumerator', record.enumerators.length);
    }
    if (CLASS_LIKE_KINDS.has(record.kind) && record.templateParameters) {
      increment(counts, 'classTemplate');
    }
    if (CLASS_LIKE_KINDS.has(record.kind) && record.isTemplateSpecialization) {
      increment(counts, 'classTemplateSpecialization');
    }
    if (record.kind === 'function') {
      overloadSetSizes.set(record.overloadSet, (overloadSetSizes.get(record.overloadSet) ?? 0) + 1);
      if (record.templateParameters) {
        increment(counts, 'functionTemplate');
      }
    }
  }
  counts.overloadSet = overloadSetSizes.size;
  counts.overloadSetWithMultipleOverloads = [...overloadSetSizes.values()].filter((size) => size > 1).length;
  counts.totalSymbols = records.length;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

export function measureDocumentationCoverage(records) {
  const recordsByPath = new Map(records.map((record) => [record.path, record]));
  const byCategory = {};
  const statusTotals = { present: 0, absent: 0, suppressed: 0 };
  let parameters = 0;
  let describedParameters = 0;
  for (const record of records) {
    const category = coverageCategoryOf(record, recordsByPath);
    if (!Object.hasOwn(byCategory, category)) {
      byCategory[category] = { total: 0, documented: 0 };
    }
    byCategory[category].total += 1;
    byCategory[category].documented += record.documentation.status === 'present' ? 1 : 0;
    statusTotals[record.documentation.status] += 1;
    for (const parameter of record.parameters ?? []) {
      parameters += 1;
      describedParameters += parameter.description ? 1 : 0;
    }
  }
  return {
    documentedSymbols: statusTotals.present,
    undocumentedSymbols: statusTotals.absent,
    suppressedSymbols: statusTotals.suppressed,
    documentedRatio: records.length > 0 ? Number((statusTotals.present / records.length).toFixed(4)) : 0,
    byCategory,
    parameters: { total: parameters, described: describedParameters },
  };
}

function summarizeInheritance(records) {
  const edges = records.flatMap((record) => record.baseClasses ?? []);
  const unresolved = edges.filter((edge) => !edge.target);
  return {
    total: edges.length,
    resolved: edges.length - unresolved.length,
    unresolved: unresolved.length,
    unresolvedBaseNames: [...new Set(unresolved.map((edge) => edge.name))].sort(),
  };
}

function summarizeExclusions(excluded) {
  const byReason = {};
  const examples = {};
  for (const entry of excluded) {
    increment(byReason, entry.reason);
    if (!Object.hasOwn(examples, entry.reason)) {
      examples[entry.reason] = [];
    }
    if (examples[entry.reason].length < MAX_EXCLUSION_EXAMPLES) {
      examples[entry.reason].push(`${entry.kind} ${entry.qualifiedName}`);
    }
  }
  return { total: excluded.length, byReason, examples };
}

function summarizeCorrections(correctionReport) {
  return correctionReport.map((entry) => ({
    id: entry.id,
    limitation: entry.limitation,
    applied: entry.applied,
    unresolved: entry.unresolved,
    appliedExamples: entry.appliedExamples,
    unresolvedItems: entry.unresolvedItems.slice(0, MAX_UNRESOLVED_ITEMS_PER_CORRECTION),
  }));
}

function locateValidationTargets(records, validationTargets) {
  const pathsByQualifiedName = new Map(
    records
      .filter((record) => record.kind !== 'function')
      .map((record) => [record.qualifiedName, record.path]),
  );
  return Object.fromEntries(
    validationTargets.map((qualifiedName) => [
      qualifiedName,
      pathsByQualifiedName.get(qualifiedName) ?? null,
    ]),
  );
}

function serializeDiagnostics(diagnostics) {
  return {
    unrecognizedElements: Object.fromEntries(diagnostics.unrecognizedElements),
    droppedSections: Object.fromEntries(diagnostics.droppedSections),
  };
}

export function createCoverageReport(input) {
  return {
    schemaVersion: SCHEMA_VERSION,
    source: input.source,
    generatedAt: input.generatedAt,
    extractor: input.extractor,
    scope: input.scope,
    counts: measureSymbolCounts(input.records),
    documentation: measureDocumentationCoverage(input.records),
    references: {
      resolved: input.referenceStatistics.resolved,
      resolvedByTargetKind: input.referenceStatistics.resolvedByTargetKind,
      unresolvedByReason: input.referenceStatistics.unresolvedByReason,
      unresolvedTotal: Object.values(input.referenceStatistics.unresolvedByReason).reduce(
        (total, count) => total + count,
        0,
      ),
      unresolvedExamples: input.referenceStatistics.unresolvedExamples,
      inheritance: summarizeInheritance(input.records),
    },
    identity: {
      duplicateIdentifiers: input.duplicateIdentifiers,
      pathCollisions: input.pathCollisions,
    },
    integrity: {
      brokenInternalLinks: input.integrity.brokenLinkCount,
      brokenLinkExamples: input.integrity.brokenLinks,
      errors: input.integrity.errors,
    },
    corrections: summarizeCorrections(input.correctionReport),
    exclusions: summarizeExclusions(input.excluded),
    sourceLocations: input.locationVerification,
    validationTargets: locateValidationTargets(input.records, input.validationTargets),
    doxygen: {
      warnings: input.warningSummary,
      unterminatedComments: input.unterminatedComments,
      documentationDiagnostics: serializeDiagnostics(input.documentationDiagnostics),
    },
  };
}
