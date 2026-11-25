import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { PROJECT_PATHS } from '../../scripts/documentation/config/pipeline-config.js';
import { checkDatasetIntegrity } from '../../scripts/documentation/validation/dataset-integrity.js';
import { buildFixtureDataset } from '../helpers/fixture-dataset.js';

const MIN_DOCUMENTATION_MATCH_RATIO = 0.98;
const WORDS_CHECKED_PER_BRIEF = 4;

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadDataset(outputDirectory) {
  const pointer = readJson(join(outputDirectory, 'current.json'));
  const directory = join(outputDirectory, pointer.commitSha);
  const manifest = readJson(join(directory, 'manifest.json'));
  const shardDirectory = join(directory, manifest.files.shards.directory);
  const shards = readdirSync(shardDirectory).map((file) => readJson(join(shardDirectory, file)));
  return {
    pointer,
    manifest,
    shards,
    searchIndex: readJson(join(directory, manifest.files.searchIndex.path)),
    navigation: readJson(join(directory, manifest.files.navigation.path)),
    relationships: readJson(join(directory, manifest.files.relationships.path)),
    records: new Map(
      shards.flatMap((shard) =>
        shard.symbols.map((record) => [record.path, { ...record, shard: shard.shard }]),
      ),
    ),
  };
}

function inlineText(content) {
  return (content ?? []).map((inline) => inline.text).join('');
}

function wordsOf(text) {
  return text.match(/[A-Za-z0-9_]+/g) ?? [];
}

function createSourceText(sourceRoot) {
  const cache = new Map();
  return (file) => {
    if (!cache.has(file)) {
      const path = join(sourceRoot, file);
      cache.set(file, existsSync(path) ? wordsOf(readFileSync(path, 'utf8')).join(' ') : null);
    }
    return cache.get(file);
  };
}

function checkoutIsAt(checkout, commitSha) {
  try {
    return (
      execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() === commitSha
    );
  } catch {
    return false;
  }
}

function describeDatasetConsistency(label, loadContext) {
  describe(label, () => {
    let dataset;
    let sourceRoot;

    beforeAll(async () => {
      ({ dataset, sourceRoot } = await loadContext());
    });

    it('comes entirely from one pinned commit', () => {
      const { pointer, manifest, shards, searchIndex, navigation, relationships } = dataset;
      expect(manifest.source.commitSha).toBe(pointer.commitSha);
      expect(manifest.source.repository).toBe('XRPLF/rippled');
      expect(manifest.source.branch).toBe('develop');
      const commits = new Set(
        [searchIndex, navigation, relationships, ...shards].map((file) => file.commitSha),
      );
      expect([...commits]).toEqual([pointer.commitSha]);
      expect(shards).toHaveLength(manifest.files.shards.count);
    });

    it('passes schema and link integrity checks', () => {
      const integrity = checkDatasetIntegrity({ commitSha: dataset.pointer.commitSha, ...dataset });
      expect(integrity.errors).toEqual([]);
      expect(integrity.brokenLinkCount).toBe(0);
    });

    it('resolves every search result to a record with the same name and kind', () => {
      const problems = [];
      for (const row of dataset.searchIndex.rows) {
        const [path, name, , kind, , , , , shardIndex] = row;
        const shardId = dataset.searchIndex.shards[shardIndex];
        const matches =
          kind === 'function'
            ? [...dataset.records.values()].filter((record) => record.overloadSet === path)
            : [dataset.records.get(path)].filter(Boolean);
        if (
          matches.length === 0 ||
          matches.some((record) => record.name !== name || record.kind !== kind || record.shard !== shardId)
        ) {
          problems.push(path);
        }
      }
      expect(problems).toEqual([]);
    });

    it('keeps member and nested-type relationships consistent in both directions', () => {
      const problems = [];
      for (const record of dataset.records.values()) {
        for (const childPath of [...(record.members ?? []), ...(record.nested ?? [])]) {
          if (dataset.records.get(childPath)?.scope !== record.path) {
            problems.push(`${record.path} lists ${childPath}`);
          }
        }
        if (record.scope) {
          const owner = dataset.records.get(record.scope);
          const listed = owner && [...(owner.members ?? []), ...(owner.nested ?? [])].includes(record.path);
          if (!listed) {
            problems.push(`${record.path} is not listed by ${record.scope}`);
          }
        }
      }
      expect(problems.slice(0, 20)).toEqual([]);
    });

    it('keeps inheritance symmetric and identical to the relationships file', () => {
      const problems = [];
      const classRecords = [...dataset.records.values()].filter((record) => record.baseClasses);
      for (const record of classRecords) {
        for (const base of record.baseClasses.filter((edge) => edge.target)) {
          const derivedOfBase = dataset.records.get(base.target.path)?.derivedClasses ?? [];
          if (!derivedOfBase.some((edge) => edge.target?.path === record.path)) {
            problems.push(`${record.path} -> ${base.target.path}`);
          }
        }
      }
      expect(problems.slice(0, 20)).toEqual([]);
      const fromRecords = classRecords.flatMap((record) =>
        record.baseClasses.map((base) => `${record.path}|${base.target?.path ?? null}|${base.name}`),
      );
      const fromRelationships = dataset.relationships.inheritance.map(
        (edge) => `${edge.derived}|${edge.base}|${edge.baseName}`,
      );
      expect(fromRelationships.sort()).toEqual(fromRecords.sort());
    });

    it('gives every overload a distinct page under its overload set', () => {
      const keysBySet = new Map();
      for (const record of [...dataset.records.values()].filter(
        (candidate) => candidate.kind === 'function',
      )) {
        expect(record.path.startsWith(`${record.overloadSet}/`)).toBe(true);
        const keys = keysBySet.get(record.overloadSet) ?? new Set();
        expect(keys.has(record.signatureKey)).toBe(false);
        keys.add(record.signatureKey);
        keysBySet.set(record.overloadSet, keys);
      }
    });

    it('reports documentation status honestly', () => {
      const problems = [];
      for (const record of dataset.records.values()) {
        const { documentation } = record;
        const hasContent = Boolean(
          documentation.brief ||
          documentation.description.length > 0 ||
          documentation.returns ||
          documentation.notes.length > 0 ||
          (record.parameters ?? []).some((parameter) => parameter.description),
        );
        const isConsistent =
          (documentation.status === 'present' && hasContent && documentation.suppressionReason === null) ||
          (documentation.status === 'absent' && !hasContent && documentation.suppressionReason === null) ||
          (documentation.status === 'suppressed' && !hasContent && Boolean(documentation.suppressionReason));
        if (!isConsistent) {
          problems.push(record.path);
        }
      }
      expect(problems.slice(0, 20)).toEqual([]);
    });

    it('points every source location at an existing line of the pinned source', () => {
      const problems = [];
      const lineCounts = new Map();
      const lineCountOf = (file) => {
        if (!lineCounts.has(file)) {
          const path = join(sourceRoot, file);
          lineCounts.set(file, existsSync(path) ? readFileSync(path, 'utf8').split('\n').length : null);
        }
        return lineCounts.get(file);
      };
      for (const record of dataset.records.values()) {
        for (const position of [record.location?.declaration, record.location?.definition].filter(Boolean)) {
          const lines = lineCountOf(position.file);
          if (lines === null || (position.line !== null && position.line > lines)) {
            problems.push(`${record.path} ${position.file}:${position.line}`);
          }
        }
      }
      expect(problems.slice(0, 20)).toEqual([]);
    });

    it('only shows descriptions that appear in the rippled source', () => {
      const sourceText = createSourceText(sourceRoot);
      const checked = [];
      for (const record of dataset.records.values()) {
        const briefWords = wordsOf(inlineText(record.documentation.brief)).slice(0, WORDS_CHECKED_PER_BRIEF);
        if (briefWords.length < WORDS_CHECKED_PER_BRIEF || !record.location) {
          continue;
        }
        const phrase = briefWords.join(' ');
        const origin = record.documentation.inheritedFrom?.target
          ? dataset.records.get(record.documentation.inheritedFrom.target.path)
          : record;
        const files = [origin?.location?.declaration.file, origin?.location?.definition?.file].filter(
          Boolean,
        );
        checked.push({ path: record.path, found: files.some((file) => sourceText(file)?.includes(phrase)) });
      }
      const ratio = checked.filter((entry) => entry.found).length / checked.length;
      expect(checked.length).toBeGreaterThan(20);
      expect(ratio).toBeGreaterThanOrEqual(MIN_DOCUMENTATION_MATCH_RATIO);
    });
  });
}

describeDatasetConsistency('fixture dataset consistency', async () => ({
  dataset: loadDataset(await buildFixtureDataset()),
  sourceRoot: join(PROJECT_PATHS.fixtureDirectory, 'source'),
}));

const PUBLISHED_POINTER = join(PROJECT_PATHS.datasetOutputDirectory, 'current.json');
const publishedCommit = existsSync(PUBLISHED_POINTER) ? readJson(PUBLISHED_POINTER).commitSha : null;
const canCheckPublishedDataset =
  Boolean(publishedCommit) && checkoutIsAt(PROJECT_PATHS.sourceCheckout, publishedCommit);

describe.skipIf(!canCheckPublishedDataset)('published dataset', () => {
  describeDatasetConsistency('consistency', async () => ({
    dataset: loadDataset(PROJECT_PATHS.datasetOutputDirectory),
    sourceRoot: PROJECT_PATHS.sourceCheckout,
  }));
});
