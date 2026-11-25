import { createHash } from 'node:crypto';
import { SCHEMA_VERSION, SEARCH_INDEX_COLUMNS } from '../../../contract/constants.js';

const NAMESPACE_MEMBERS_PER_SINGLE_SHARD = 400;
const SHARD_ID_LENGTH = 16;
const BRIEF_PREVIEW_LENGTH = 160;
const GLOBAL_SCOPE_SHARD_KEY = '@global';
const COMPOUND_KINDS_WITH_OWN_SHARD = new Set(['class', 'struct', 'union', 'concept', 'namespace']);
const NAVIGATION_KIND_ORDER = Object.freeze({ namespace: 0, class: 1, struct: 1, union: 1, concept: 2 });

export function shardIdOf(shardKey) {
  return createHash('sha256').update(shardKey).digest('hex').slice(0, SHARD_ID_LENGTH);
}

function bucketOf(name) {
  const first = name.replace(/^~/, '').charAt(0).toLowerCase();
  return /[a-z]/.test(first) ? first : '_';
}

function shardKeyForMember(record, scopeRecord, scopeMemberCount) {
  if (!scopeRecord) {
    return `${GLOBAL_SCOPE_SHARD_KEY}/${bucketOf(record.name)}`;
  }
  if (scopeRecord.kind !== 'namespace' || scopeMemberCount <= NAMESPACE_MEMBERS_PER_SINGLE_SHARD) {
    return scopeRecord.path;
  }
  return `${scopeRecord.path}@${bucketOf(record.name)}`;
}

export function assignShards(records) {
  const recordsByPath = new Map(records.map((record) => [record.path, record]));
  const memberCountByScope = new Map();
  for (const record of records) {
    if (!COMPOUND_KINDS_WITH_OWN_SHARD.has(record.kind)) {
      memberCountByScope.set(record.scope, (memberCountByScope.get(record.scope) ?? 0) + 1);
    }
  }
  const shardKeyByPath = new Map();
  for (const record of records) {
    if (COMPOUND_KINDS_WITH_OWN_SHARD.has(record.kind)) {
      shardKeyByPath.set(record.path, record.path);
      continue;
    }
    const scopeRecord = record.scope ? recordsByPath.get(record.scope) : null;
    shardKeyByPath.set(
      record.path,
      shardKeyForMember(record, scopeRecord, memberCountByScope.get(record.scope) ?? 0),
    );
  }
  const shards = new Map();
  for (const record of records) {
    const shardId = shardIdOf(shardKeyByPath.get(record.path));
    if (!shards.has(shardId)) {
      shards.set(shardId, { shard: shardId, key: shardKeyByPath.get(record.path), symbols: [] });
    }
    shards.get(shardId).symbols.push(record);
  }
  const sortedShards = [...shards.values()].sort((left, right) => left.shard.localeCompare(right.shard));
  const shardIdByPath = new Map(
    records.map((record) => [record.path, shardIdOf(shardKeyByPath.get(record.path))]),
  );
  return { shards: sortedShards, shardIdByPath };
}

export function briefPreviewOf(documentation) {
  const text = (documentation.brief ?? [])
    .map((inline) => inline.text)
    .join('')
    .trim();
  if (!text) {
    return null;
  }
  return text.length > BRIEF_PREVIEW_LENGTH ? `${text.slice(0, BRIEF_PREVIEW_LENGTH - 1).trimEnd()}…` : text;
}

function scopeQualifiedNameOf(record, recordsByPath) {
  return record.scope ? (recordsByPath.get(record.scope)?.qualifiedName ?? null) : null;
}

export function buildSearchIndex(records, { shardIdByPath, shardIds, commitSha }) {
  const recordsByPath = new Map(records.map((record) => [record.path, record]));
  const shardIndexById = new Map(shardIds.map((shardId, position) => [shardId, position]));
  const rows = [];
  const overloadSets = new Map();
  for (const record of records) {
    if (record.kind === 'function') {
      overloadSets.set(record.overloadSet, [...(overloadSets.get(record.overloadSet) ?? []), record]);
      continue;
    }
    rows.push([
      record.path,
      record.name,
      record.qualifiedName,
      record.kind,
      null,
      scopeQualifiedNameOf(record, recordsByPath),
      record.category,
      briefPreviewOf(record.documentation),
      shardIndexById.get(shardIdByPath.get(record.path)),
      1,
    ]);
  }
  for (const [overloadSetPath, overloads] of overloadSets) {
    const [first] = overloads;
    const shardIndexes = new Set(
      overloads.map((overload) => shardIndexById.get(shardIdByPath.get(overload.path))),
    );
    if (shardIndexes.size !== 1) {
      throw new Error(`Overloads of ${overloadSetPath} were split across shards`);
    }
    rows.push([
      overloadSetPath,
      first.name,
      first.qualifiedName,
      'function',
      first.role,
      scopeQualifiedNameOf(first, recordsByPath),
      overloads.every((overload) => overload.category === 'test') ? 'test' : 'production',
      overloads.map((overload) => briefPreviewOf(overload.documentation)).find(Boolean) ?? null,
      [...shardIndexes][0],
      overloads.length,
    ]);
  }
  rows.sort((left, right) => left[0].localeCompare(right[0]));
  return {
    schemaVersion: SCHEMA_VERSION,
    commitSha,
    columns: [...SEARCH_INDEX_COLUMNS],
    shards: shardIds,
    rows,
  };
}

function compareNavigationNodes(left, right) {
  const kindOrder = NAVIGATION_KIND_ORDER[left.kind] - NAVIGATION_KIND_ORDER[right.kind];
  return kindOrder !== 0 ? kindOrder : left.name.localeCompare(right.name);
}

export function buildNavigation(records, { commitSha }) {
  const recordsByPath = new Map(records.map((record) => [record.path, record]));
  const compounds = records.filter((record) => record.kind in NAVIGATION_KIND_ORDER);
  const toNode = (record) => ({
    path: record.path,
    name: record.name,
    kind: record.kind,
    category: record.category,
    children: (record.nested ?? [])
      .map((path) => recordsByPath.get(path))
      .filter((child) => child && child.kind in NAVIGATION_KIND_ORDER)
      .map(toNode)
      .sort(compareNavigationNodes),
  });
  const roots = compounds
    .filter((record) => record.scope === null)
    .map(toNode)
    .sort(compareNavigationNodes);
  return { schemaVersion: SCHEMA_VERSION, commitSha, roots };
}

export function buildRelationships(records, { commitSha }) {
  const classRecords = records.filter((record) => record.baseClasses);
  return {
    schemaVersion: SCHEMA_VERSION,
    commitSha,
    inheritance: classRecords.flatMap((record) =>
      record.baseClasses.map((base) => ({
        derived: record.path,
        base: base.target?.path ?? null,
        baseName: base.name,
        access: base.access,
        isVirtual: base.isVirtual,
      })),
    ),
    aliases: records
      .filter((record) => record.kind === 'typeAlias')
      .map((record) => ({
        alias: record.path,
        targets: [...new Set(record.type.filter((token) => token.target).map((token) => token.target.path))],
      }))
      .filter((alias) => alias.targets.length > 0),
    friends: classRecords.flatMap((record) =>
      record.friends.map((friendEntry) => ({
        owner: record.path,
        friend: friendEntry.target?.path ?? null,
        name: friendEntry.name,
      })),
    ),
  };
}
