import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_INCLUDED_CATEGORIES } from './source-categories.js';

const CONFIG_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(CONFIG_DIRECTORY, '../../..');
const CACHE_DIRECTORY = join(PROJECT_ROOT, '.cache');

export const DOXYGEN_RELEASE = Object.freeze({
  version: '1.17.0',
  archiveSha256: '75419ef4f446fc1c24ef12514b574e66e898ee6f527c6ae2ad84f91a905823c2',
  archiveUrl:
    'https://github.com/doxygen/doxygen/releases/download/Release_1_17_0/doxygen-1.17.0.linux.bin.tar.gz',
  archiveRootDirectory: 'doxygen-1.17.0',
});

export const X_MACRO_DEFINERS = Object.freeze([
  'EXPAND',
  'JSS',
  'TYPED_SFIELD',
  'UNTYPED_SFIELD',
  'XRPL_FEATURE',
  'XRPL_FIX',
  'XRPL_RETIRE_FEATURE',
  'XRPL_RETIRE_FIX',
  'LEDGER_ENTRY',
  'LEDGER_ENTRY_DUPLICATE',
  'TRANSACTION',
  'GRANULAR_PERMISSION',
]);

export const X_MACRO_TOKEN_PASTE_PREFIXES = Object.freeze(['retiredFeature', 'retiredFix', 'feature', 'fix']);

export const X_MACRO_FILE_EXTENSION = '.macro';

export const VALIDATION_TARGETS = Object.freeze([
  'xrpl::STTx',
  'xrpl::ReadView',
  'xrpl::ApplyContext',
  'xrpl::SHAMap',
]);

export const SOURCE_FILE_PATTERNS = Object.freeze(['*.h', '*.hpp', '*.ipp', '*.cpp']);

export const PROJECT_PATHS = Object.freeze({
  projectRoot: PROJECT_ROOT,
  cacheDirectory: CACHE_DIRECTORY,
  sourceCheckout: join(CACHE_DIRECTORY, 'rippled'),
  toolsDirectory: join(CACHE_DIRECTORY, 'tools'),
  extractionsDirectory: join(CACHE_DIRECTORY, 'extractions'),
  datasetOutputDirectory: join(PROJECT_ROOT, 'public', 'data'),
  doxygenOverlay: join(CONFIG_DIRECTORY, 'Doxyfile.overlay'),
  fixtureDirectory: join(PROJECT_ROOT, 'tests', 'fixtures', 'rippled-subset'),
});

export const EXTRACTION_FILES = Object.freeze({
  xmlDirectory: 'xml',
  warningLog: 'doxygen-warnings.log',
  revision: 'source-revision.json',
  doxygenConfig: 'Doxyfile.effective',
});

export function createPipelineConfig(overrides = {}) {
  return Object.freeze({
    categories: overrides.categories ?? DEFAULT_INCLUDED_CATEGORIES,
    sourceCheckout: overrides.sourceCheckout ?? PROJECT_PATHS.sourceCheckout,
    extractionsDirectory: overrides.extractionsDirectory ?? PROJECT_PATHS.extractionsDirectory,
    datasetOutputDirectory: overrides.datasetOutputDirectory ?? PROJECT_PATHS.datasetOutputDirectory,
    toolsDirectory: overrides.toolsDirectory ?? PROJECT_PATHS.toolsDirectory,
    requestedCommit: overrides.requestedCommit ?? null,
  });
}
