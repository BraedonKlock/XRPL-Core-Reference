import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { DATASET_FILES } from '../../contract/constants.js';
import {
  developerNoteSchema,
  markdownFieldsOf,
  overloadHashOf,
  qualifiedNameOfSignature,
  referencesOf,
} from '../../contract/developer-notes.js';
import { linksInMarkdown } from '../../contract/markdown.js';

const NOTE_FILE_EXTENSION = '.json';
const SHORT_SHA_LENGTH = 7;
const MAXIMUM_LISTED_CANDIDATES = 12;

function listNoteFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory, { withFileTypes: true })
    .filter((item) => !item.name.startsWith('.'))
    .flatMap((item) => {
      const path = join(directory, item.name);
      if (item.isDirectory()) {
        return listNoteFiles(path);
      }
      return item.isFile() && item.name.endsWith(NOTE_FILE_EXTENSION) ? [path] : [];
    })
    .sort();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function createDatasetLookup(dataDirectory) {
  const pointer = readJson(join(dataDirectory, DATASET_FILES.currentPointer));
  const manifest = readJson(join(dataDirectory, pointer.manifest));
  const datasetDirectory = join(dataDirectory, pointer.commitSha);
  const searchIndex = readJson(join(datasetDirectory, manifest.files.searchIndex.path));
  const shardDirectory = join(datasetDirectory, manifest.files.shards.directory);
  const column = Object.fromEntries(searchIndex.columns.map((name, position) => [name, position]));
  const rowsByQualifiedName = new Map();
  for (const row of searchIndex.rows) {
    const entry = {
      path: row[column.path],
      qualifiedName: row[column.qualifiedName],
      kind: row[column.kind],
      shard: searchIndex.shards[row[column.shard]],
    };
    rowsByQualifiedName.set(entry.qualifiedName, [
      ...(rowsByQualifiedName.get(entry.qualifiedName) ?? []),
      entry,
    ]);
  }
  const shardCache = new Map();
  const shardSymbols = (shard) => {
    if (!shardCache.has(shard)) {
      shardCache.set(shard, readJson(join(shardDirectory, `${shard}.json`)).symbols);
    }
    return shardCache.get(shard);
  };
  return {
    commitSha: pointer.commitSha,
    rowsNamed: (qualifiedName) => rowsByQualifiedName.get(qualifiedName) ?? [],
    overloadsOf: (overloadSetEntry) =>
      shardSymbols(overloadSetEntry.shard).filter((record) => record.overloadSet === overloadSetEntry.path),
  };
}

function signatureList(overloads) {
  const keys = overloads.map((overload) => `"${overload.signatureKey}"`);
  const listed = keys.slice(0, MAXIMUM_LISTED_CANDIDATES).join(', ');
  return keys.length > MAXIMUM_LISTED_CANDIDATES ? `${listed}, …` : listed;
}

async function checkReference(symbol, dataset) {
  const rows = dataset.rowsNamed(symbol);
  if (rows.length > 1) {
    return { error: `"${symbol}" is ambiguous: it names ${rows.length} symbols` };
  }
  if (rows.length === 1) {
    return { path: rows[0].path };
  }
  const qualifiedName = qualifiedNameOfSignature(symbol);
  const overloadSets = qualifiedName
    ? dataset.rowsNamed(qualifiedName).filter((row) => row.kind === 'function')
    : [];
  if (overloadSets.length !== 1) {
    return { error: `"${symbol}" does not match any symbol in the dataset` };
  }
  const overloads = dataset.overloadsOf(overloadSets[0]);
  const record = overloads.find((overload) => overload.signatureKey === symbol);
  if (!record) {
    return {
      error: `"${symbol}" does not match any overload of ${qualifiedName}. Available signatures: ${signatureList(overloads)}`,
    };
  }
  const expectedPath = `${overloadSets[0].path}/${await overloadHashOf(symbol)}`;
  if (record.path !== expectedPath) {
    return {
      error: `"${symbol}" resolves to ${expectedPath}, but the dataset publishes it at ${record.path}`,
    };
  }
  return { path: record.path };
}

function checkEntrySymbol(entry, dataset) {
  const rows = dataset.rowsNamed(entry.symbol);
  if (rows.length === 1) {
    return { row: rows[0] };
  }
  if (rows.length > 1) {
    return { error: `symbol "${entry.symbol}" is ambiguous: it names ${rows.length} symbols` };
  }
  const qualifiedName = qualifiedNameOfSignature(entry.symbol);
  if (qualifiedName && dataset.rowsNamed(qualifiedName).length > 0) {
    return {
      error: `symbol "${entry.symbol}" is a signature. Use the qualified name "${qualifiedName}" and put the signature on each example`,
    };
  }
  return { error: `symbol "${entry.symbol}" does not match any symbol in the dataset` };
}

function checkExamples(entry, row, dataset, error) {
  const examples = entry.examples ?? [];
  if (row.kind !== 'function') {
    examples.forEach((example, position) => {
      if (example.signature) {
        error(
          `examples[${position}].signature: "${entry.symbol}" is not a function, so examples must not have a signature`,
        );
      }
    });
    return;
  }
  const overloads = dataset.overloadsOf(row);
  const signatures = new Set(overloads.map((overload) => overload.signatureKey));
  examples.forEach((example, position) => {
    if (!example.signature) {
      error(
        `examples[${position}].signature is required for a function. Available signatures: ${signatureList(overloads)}`,
      );
    } else if (!signatures.has(example.signature)) {
      error(
        `examples[${position}].signature "${example.signature}" is not an overload of ${entry.symbol}. Available signatures: ${signatureList(overloads)}`,
      );
    }
  });
}

function schemaIssues(error) {
  return error.issues.map((issue) => {
    const location = issue.path.length > 0 ? issue.path.join('.') : 'entry';
    if (issue.code === 'unrecognized_keys') {
      return `${location}: unknown fields ${issue.keys.map((key) => `"${key}"`).join(', ')}`;
    }
    return `${location}: ${issue.message}`;
  });
}

export async function validateDeveloperNotes({ notesDirectory, dataDirectory, dataset = null }) {
  const lookup = dataset ?? createDatasetLookup(dataDirectory);
  const errors = [];
  const warnings = [];
  const claims = new Map();
  const files = listNoteFiles(notesDirectory);
  let entryCount = 0;
  for (const path of files) {
    const file = relative(notesDirectory, path).split(sep).join('/');
    const report = (list) => (message) => list.push(`${file}: ${message}`);
    const error = report(errors);
    const warning = report(warnings);
    let content;
    try {
      content = readJson(path);
    } catch (parseError) {
      error(`is not valid JSON (${parseError.message})`);
      continue;
    }
    const parsed = developerNoteSchema.safeParse(content);
    if (!parsed.success) {
      schemaIssues(parsed.error).forEach(error);
      continue;
    }
    const entry = parsed.data;
    entryCount += 1;
    if (claims.has(entry.symbol)) {
      error(`duplicates the entry for "${entry.symbol}" in ${claims.get(entry.symbol)}`);
    } else {
      claims.set(entry.symbol, file);
    }
    const target = checkEntrySymbol(entry, lookup);
    if (target.error) {
      error(target.error);
    } else {
      checkExamples(entry, target.row, lookup, error);
    }
    for (const field of markdownFieldsOf(entry)) {
      for (const link of linksInMarkdown(field.source)) {
        if (link.target.kind === 'invalid') {
          error(`${field.location}: link "${link.destination}" must use https:, http: or symbol:`);
        }
      }
    }
    for (const { location, symbol } of referencesOf(entry)) {
      const result = await checkReference(symbol, lookup);
      if (result.error) {
        error(`${location}: ${result.error}`);
      }
    }
    if (entry.verifiedAt && entry.verifiedAt !== lookup.commitSha) {
      warning(
        `was verified against rippled ${entry.verifiedAt.slice(0, SHORT_SHA_LENGTH)}, but the dataset documents ${lookup.commitSha.slice(0, SHORT_SHA_LENGTH)}`,
      );
    }
    if (entry.draft) {
      warning('is marked as a draft');
    }
    (entry.examples ?? []).forEach((example, position) => {
      if (example.draft) {
        warning(`examples[${position}] "${example.title}" is marked as a draft`);
      }
    });
  }
  return { commitSha: lookup.commitSha, fileCount: files.length, entryCount, errors, warnings };
}
