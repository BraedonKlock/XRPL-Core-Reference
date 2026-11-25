import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCHEMA_VERSION } from '../../contract/constants.js';
import { EXTRACTION_FILES, PROJECT_PATHS, VALIDATION_TARGETS } from './config/pipeline-config.js';
import { readExtractionRecord } from './extraction/extraction-record.js';
import { createCoverageReport } from './generation/coverage-report.js';
import {
  assignShards,
  buildNavigation,
  buildRelationships,
  buildSearchIndex,
} from './generation/dataset-assembly.js';
import { writeDataset } from './generation/dataset-writer.js';
import { toPublicRecord } from './generation/symbol-records.js';
import { buildSourceModel } from './normalization/build-source-model.js';
import { applyCorrections } from './normalization/corrections/index.js';
import { applyExclusions, assignCategories } from './normalization/exclusions.js';
import {
  findUnterminatedComments,
  readDoxygenWarnings,
  summarizeWarnings,
} from './parsing/doxygen-warnings.js';
import { createSourceFileReader } from './parsing/source-files.js';
import { buildTargetIndex, createReferenceResolver } from './resolution/reference-resolution.js';
import { linkScopeReferences, resolveFriendClassRedirects } from './resolution/scope-references.js';
import { assignSymbolPaths, findPathCollisions } from './resolution/symbol-paths.js';
import { checkDatasetIntegrity } from './validation/dataset-integrity.js';
import { verifySourceLocations } from './validation/location-verification.js';

export class DatasetBuildError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'DatasetBuildError';
    this.details = details;
  }
}

function readGeneratorVersion() {
  return JSON.parse(readFileSync(join(PROJECT_PATHS.projectRoot, 'package.json'), 'utf8')).version;
}

function findDuplicateIdentifiers(symbols) {
  const seen = new Set();
  const duplicates = new Set();
  for (const symbol of symbols) {
    if (seen.has(symbol.id)) {
      duplicates.add(symbol.id);
    }
    seen.add(symbol.id);
  }
  return [...duplicates];
}

export function normalizeExtraction({ extractionDirectory, sourceRoot, includedCategories }) {
  const xmlDirectory = join(extractionDirectory, EXTRACTION_FILES.xmlDirectory);
  const warnings = readDoxygenWarnings(join(extractionDirectory, EXTRACTION_FILES.warningLog), sourceRoot);
  const unterminatedComments = findUnterminatedComments(warnings);
  const sourceFiles = createSourceFileReader(sourceRoot);
  const model = buildSourceModel(xmlDirectory);
  const corrected = applyCorrections(model.symbols, { sourceFiles, unterminatedComments });
  const { symbols, excluded, excludedReasons, friendClassSymbols } = applyExclusions(
    assignCategories(corrected.symbols),
    {
      includedCategories,
    },
  );
  const duplicateIdentifiers = findDuplicateIdentifiers(symbols);
  if (duplicateIdentifiers.length > 0) {
    throw new DatasetBuildError('Duplicate symbol identifiers remain after corrections', {
      duplicateIdentifiers,
    });
  }
  return {
    symbols,
    excluded,
    excludedReasons,
    friendClassSymbols,
    correctionReport: corrected.report,
    warnings,
    unterminatedComments,
    sourceFiles,
    documentationDiagnostics: model.diagnostics,
  };
}

export function resolveSymbols(normalized) {
  const { symbols, excludedReasons, friendClassSymbols } = normalized;
  assignSymbolPaths(symbols);
  const pathCollisions = findPathCollisions(symbols);
  if (pathCollisions.length > 0) {
    throw new DatasetBuildError(`${pathCollisions.length} symbol URL collisions detected`, {
      pathCollisions,
    });
  }
  const symbolsById = new Map(symbols.map((symbol) => [symbol.id, symbol]));
  const scopeLinks = linkScopeReferences(symbols, symbolsById);
  const friendRedirects = resolveFriendClassRedirects(friendClassSymbols, symbolsById);
  const resolver = createReferenceResolver({
    targets: buildTargetIndex(symbols, friendRedirects),
    excludedReasons,
  });
  const records = symbols.map((symbol) => toPublicRecord(symbol, { resolver, symbolsById }));
  return { records, referenceStatistics: resolver.statistics, scopeLinks, pathCollisions };
}

export function assembleDataset(records, commitSha) {
  const { shards: assignedShards, shardIdByPath } = assignShards(records);
  const shards = assignedShards.map((shard) => ({
    schemaVersion: SCHEMA_VERSION,
    commitSha,
    shard: shard.shard,
    symbols: shard.symbols,
  }));
  const shardIds = shards.map((shard) => shard.shard);
  return {
    shards,
    searchIndex: buildSearchIndex(records, { shardIdByPath, shardIds, commitSha }),
    navigation: buildNavigation(records, { commitSha }),
    relationships: buildRelationships(records, { commitSha }),
  };
}

const UPSTREAM_LICENSE_FILE = 'LICENSE.md';

function readUpstreamLicense(sourceRoot) {
  const path = join(sourceRoot, UPSTREAM_LICENSE_FILE);
  if (!existsSync(path)) {
    throw new DatasetBuildError(`Upstream license not found at ${path}`, { path });
  }
  return readFileSync(path, 'utf8');
}

export async function buildDataset({
  extractionDirectory,
  sourceRoot,
  verifySourceRevision,
  outputDirectory,
  log,
}) {
  const extraction = readExtractionRecord(extractionDirectory);
  const { commitSha } = extraction.source;
  await verifySourceRevision(commitSha);
  log(`Building dataset for ${extraction.source.repository}@${commitSha}`);

  const normalized = normalizeExtraction({
    extractionDirectory,
    sourceRoot,
    includedCategories: extraction.categories,
  });
  const resolved = resolveSymbols(normalized);
  const dataset = assembleDataset(resolved.records, commitSha);
  const integrity = checkDatasetIntegrity({ commitSha, ...dataset });
  if (integrity.errorCount > 0) {
    throw new DatasetBuildError('Generated dataset failed integrity validation', integrity);
  }

  const generatedAt = new Date().toISOString();
  const extractor = {
    name: 'doxygen',
    version: extraction.doxygenVersion,
    configSha256: extraction.doxygenConfigSha256,
  };
  const scope = { categories: extraction.categories, inputs: extraction.inputs };
  const coverage = createCoverageReport({
    source: extraction.source,
    generatedAt,
    extractor,
    scope,
    records: resolved.records,
    referenceStatistics: { ...resolved.referenceStatistics, scopeLinked: resolved.scopeLinks.linked },
    duplicateIdentifiers: [],
    pathCollisions: resolved.pathCollisions,
    integrity,
    correctionReport: normalized.correctionReport,
    excluded: normalized.excluded,
    locationVerification: verifySourceLocations(resolved.records, normalized.sourceFiles),
    validationTargets: VALIDATION_TARGETS,
    warningSummary: summarizeWarnings(normalized.warnings),
    unterminatedComments: normalized.unterminatedComments,
    documentationDiagnostics: normalized.documentationDiagnostics,
  });

  const written = writeDataset({
    outputDirectory,
    commitSha,
    ...dataset,
    coverage,
    upstreamLicenseText: readUpstreamLicense(sourceRoot),
    createManifest: (files) => ({
      schemaVersion: SCHEMA_VERSION,
      source: extraction.source,
      generation: {
        generatedAt,
        extractedAt: extraction.extractedAt,
        generatorVersion: readGeneratorVersion(),
        extractor,
      },
      scope,
      files,
      counts: coverage.counts,
    }),
  });
  log(`Wrote ${dataset.shards.length} shards and ${resolved.records.length} symbols to ${written.directory}`);
  return { coverage, manifest: written.manifest, directory: written.directory };
}
