export const SCHEMA_VERSION = '1.0.0';

export const SOURCE_REPOSITORY = Object.freeze({
  name: 'XRPLF/rippled',
  url: 'https://github.com/XRPLF/rippled.git',
  webUrl: 'https://github.com/XRPLF/rippled',
  branch: 'develop',
});

export const COMPOUND_KINDS = Object.freeze(['namespace', 'class', 'struct', 'union', 'concept']);
export const MEMBER_KINDS = Object.freeze(['function', 'variable', 'typeAlias', 'enum']);
export const SYMBOL_KINDS = Object.freeze([...COMPOUND_KINDS, ...MEMBER_KINDS]);

export const FUNCTION_ROLES = Object.freeze([
  'constructor',
  'destructor',
  'operator',
  'conversion',
  'method',
  'function',
  'friend',
]);

export const ACCESS_LEVELS = Object.freeze(['public', 'protected', 'private']);
export const SOURCE_CATEGORIES = Object.freeze(['production', 'test']);
export const REFERENCE_RESOLUTIONS = Object.freeze(['doxygen', 'scope']);
export const DOCUMENTATION_STATUSES = Object.freeze(['present', 'absent', 'suppressed']);
export const NOTE_KINDS = Object.freeze([
  'note',
  'warning',
  'see',
  'precondition',
  'postcondition',
  'since',
  'deprecated',
  'attention',
  'remark',
  'invariant',
  'throws',
  'retval',
]);

export const DATASET_FILES = Object.freeze({
  manifest: 'manifest.json',
  searchIndex: 'search-index.json',
  navigation: 'navigation.json',
  relationships: 'relationships.json',
  coverage: 'coverage-report.json',
  shardDirectory: 'symbols',
  currentPointer: 'current.json',
  upstreamLicense: 'rippled-license.txt',
});

export const SEARCH_INDEX_COLUMNS = Object.freeze([
  'path',
  'name',
  'qualifiedName',
  'kind',
  'role',
  'scope',
  'category',
  'brief',
  'shard',
  'overloads',
]);
