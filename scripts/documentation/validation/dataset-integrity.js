import {
  navigationSchema,
  relationshipsSchema,
  searchIndexSchema,
  symbolShardSchema,
} from '../../../contract/schema.js';

const MAX_REPORTED_ITEMS = 50;

function formatSchemaIssues(label, error) {
  return error.issues.slice(0, 5).map((issue) => `${label}: ${issue.path.join('.')} ${issue.message}`);
}

function validateWithSchema(schema, value, label, errors) {
  const result = schema.safeParse(value);
  if (!result.success) {
    errors.push(...formatSchemaIssues(label, result.error));
  }
}

function* expressionsOfRecord(record) {
  const singleExpressions = [
    record.declaration,
    record.returnType,
    record.type,
    record.initializer,
    record.underlyingType,
    record.requiresClause,
    record.definition,
  ];
  yield* singleExpressions.filter(Boolean);
  for (const parameter of record.parameters ?? []) {
    yield parameter.type;
    if (parameter.defaultValue) {
      yield parameter.defaultValue;
    }
  }
  for (const parameter of record.templateParameters ?? []) {
    yield parameter.type;
    if (parameter.defaultValue) {
      yield parameter.defaultValue;
    }
  }
  for (const enumerator of record.enumerators ?? []) {
    if (enumerator.initializer) {
      yield enumerator.initializer;
    }
  }
}

function* inlineContentsOf(documentation) {
  if (documentation.brief) {
    yield documentation.brief;
  }
  if (documentation.returns) {
    yield documentation.returns;
  }
  for (const note of documentation.notes) {
    yield note.content;
  }
  for (const block of documentation.description) {
    if (block.type === 'paragraph') {
      yield block.content;
    } else if (block.type === 'list') {
      yield* block.items;
    }
  }
}

function* targetsOfRecord(record) {
  for (const expression of expressionsOfRecord(record)) {
    for (const token of expression) {
      if (token.target) {
        yield token.target;
      }
    }
  }
  const documentations = [
    record.documentation,
    ...(record.enumerators ?? []).map((enumerator) => enumerator.documentation),
  ];
  for (const documentation of documentations) {
    for (const content of inlineContentsOf(documentation)) {
      for (const inline of content) {
        if (inline.type === 'link') {
          yield inline.target;
        }
      }
    }
  }
  for (const parameter of record.parameters ?? []) {
    for (const inline of parameter.description ?? []) {
      if (inline.type === 'link') {
        yield inline.target;
      }
    }
  }
  for (const edge of [
    ...(record.baseClasses ?? []),
    ...(record.derivedClasses ?? []),
    ...(record.friends ?? []),
  ]) {
    if (edge.target) {
      yield edge.target;
    }
  }
}

function checkUniquePaths(shards, errors) {
  const pathToShard = new Map();
  for (const shard of shards) {
    for (const record of shard.symbols) {
      if (pathToShard.has(record.path)) {
        errors.push(
          `duplicate symbol path ${record.path} in shards ${pathToShard.get(record.path)} and ${shard.shard}`,
        );
      }
      pathToShard.set(record.path, shard.shard);
    }
  }
  return pathToShard;
}

function checkFragment(target, recordsByPath) {
  if (!target.fragment) {
    return true;
  }
  return (recordsByPath.get(target.path)?.enumerators ?? []).some(
    (enumerator) => enumerator.name === target.fragment,
  );
}

export function checkDatasetIntegrity({ commitSha, shards, searchIndex, navigation, relationships }) {
  const errors = [];
  const brokenLinks = [];
  for (const shard of shards) {
    validateWithSchema(symbolShardSchema, shard, `shard ${shard.shard}`, errors);
    if (shard.commitSha !== commitSha) {
      errors.push(`shard ${shard.shard} belongs to commit ${shard.commitSha}, expected ${commitSha}`);
    }
  }
  validateWithSchema(searchIndexSchema, searchIndex, 'search index', errors);
  validateWithSchema(navigationSchema, navigation, 'navigation', errors);
  validateWithSchema(relationshipsSchema, relationships, 'relationships', errors);
  for (const [label, file] of [
    ['search index', searchIndex],
    ['navigation', navigation],
    ['relationships', relationships],
  ]) {
    if (file.commitSha !== commitSha) {
      errors.push(`${label} belongs to commit ${file.commitSha}, expected ${commitSha}`);
    }
  }

  const pathToShard = checkUniquePaths(shards, errors);
  const recordsByPath = new Map(
    shards.flatMap((shard) => shard.symbols.map((record) => [record.path, record])),
  );
  const overloadSets = new Map();
  for (const record of recordsByPath.values()) {
    if (record.kind === 'function') {
      overloadSets.set(record.overloadSet, pathToShard.get(record.path));
    }
  }

  for (const record of recordsByPath.values()) {
    for (const target of targetsOfRecord(record)) {
      if (!recordsByPath.has(target.path) || !checkFragment(target, recordsByPath)) {
        brokenLinks.push({ from: record.path, to: target.path, fragment: target.fragment ?? null });
      }
    }
    for (const path of [record.scope, ...(record.members ?? []), ...(record.nested ?? [])].filter(Boolean)) {
      if (!recordsByPath.has(path)) {
        brokenLinks.push({ from: record.path, to: path, fragment: null });
      }
    }
  }

  for (const row of searchIndex.rows) {
    const [path, , , kind, , , , , shardIndex] = row;
    const expectedShard = kind === 'function' ? overloadSets.get(path) : pathToShard.get(path);
    if (!expectedShard) {
      errors.push(`search row ${path} does not match any symbol`);
    } else if (searchIndex.shards[shardIndex] !== expectedShard) {
      errors.push(
        `search row ${path} points to shard ${searchIndex.shards[shardIndex]}, expected ${expectedShard}`,
      );
    }
  }

  const visitNavigation = (node) => {
    if (!recordsByPath.has(node.path)) {
      errors.push(`navigation node ${node.path} does not match any symbol`);
    }
    node.children.forEach(visitNavigation);
  };
  navigation.roots.forEach(visitNavigation);

  for (const edge of relationships.inheritance) {
    for (const path of [edge.derived, edge.base].filter(Boolean)) {
      if (!recordsByPath.has(path)) {
        brokenLinks.push({ from: 'relationships', to: path, fragment: null });
      }
    }
  }

  if (brokenLinks.length > 0) {
    errors.push(`${brokenLinks.length} broken internal links`);
  }
  return {
    errors: errors.slice(0, MAX_REPORTED_ITEMS),
    errorCount: errors.length,
    brokenLinks: brokenLinks.slice(0, MAX_REPORTED_ITEMS),
    brokenLinkCount: brokenLinks.length,
    symbolCount: recordsByPath.size,
  };
}
