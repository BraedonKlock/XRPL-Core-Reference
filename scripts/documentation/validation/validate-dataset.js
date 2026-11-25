import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATASET_FILES } from '../../../contract/constants.js';
import { currentDatasetPointerSchema, manifestSchema } from '../../../contract/schema.js';
import { checkDatasetIntegrity } from './dataset-integrity.js';

function readJson(path) {
  if (!existsSync(path)) {
    throw new Error(`Dataset file not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function verifyFileEntry(directory, entry, errors) {
  const content = readFileSync(join(directory, entry.path));
  const sha256 = createHash('sha256').update(content).digest('hex');
  if (sha256 !== entry.sha256 || content.length !== entry.bytes) {
    errors.push(`${entry.path} does not match the hash or size recorded in the manifest`);
  }
}

export function validatePublishedDataset(outputDirectory) {
  const pointer = currentDatasetPointerSchema.parse(
    readJson(join(outputDirectory, DATASET_FILES.currentPointer)),
  );
  const manifestPath = join(outputDirectory, pointer.manifest);
  const manifest = manifestSchema.parse(readJson(manifestPath));
  const datasetDirectory = join(outputDirectory, pointer.commitSha);
  const errors = [];
  if (manifest.source.commitSha !== pointer.commitSha) {
    errors.push(
      `manifest commit ${manifest.source.commitSha} does not match pointer commit ${pointer.commitSha}`,
    );
  }
  for (const key of ['searchIndex', 'navigation', 'relationships', 'coverage', 'upstreamLicense']) {
    verifyFileEntry(datasetDirectory, manifest.files[key], errors);
  }
  const shardDirectory = join(datasetDirectory, manifest.files.shards.directory);
  const shards = readdirSync(shardDirectory)
    .filter((file) => file.endsWith('.json'))
    .map((file) => readJson(join(shardDirectory, file)));
  if (shards.length !== manifest.files.shards.count) {
    errors.push(`found ${shards.length} shards, manifest records ${manifest.files.shards.count}`);
  }
  const integrity = checkDatasetIntegrity({
    commitSha: pointer.commitSha,
    shards,
    searchIndex: readJson(join(datasetDirectory, manifest.files.searchIndex.path)),
    navigation: readJson(join(datasetDirectory, manifest.files.navigation.path)),
    relationships: readJson(join(datasetDirectory, manifest.files.relationships.path)),
  });
  return {
    commitSha: pointer.commitSha,
    symbolCount: integrity.symbolCount,
    shardCount: shards.length,
    errors: [...errors, ...integrity.errors],
    brokenLinkCount: integrity.brokenLinkCount,
  };
}
