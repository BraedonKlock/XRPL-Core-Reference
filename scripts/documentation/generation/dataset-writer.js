import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATASET_FILES, SCHEMA_VERSION } from '../../../contract/constants.js';
import { currentDatasetPointerSchema, manifestSchema } from '../../../contract/schema.js';

const STAGING_PREFIX = '.staging-';
const COMMIT_DIRECTORY_PATTERN = /^[0-9a-f]{40}$/;

function serialize(value) {
  return `${JSON.stringify(value)}\n`;
}

function writeTextFile(directory, relativePath, content) {
  writeFileSync(join(directory, relativePath), content);
  return {
    path: relativePath,
    bytes: Buffer.byteLength(content),
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

function writeJsonFile(directory, relativePath, value) {
  return writeTextFile(directory, relativePath, serialize(value));
}

function removeOtherDatasets(outputDirectory, keptCommitSha) {
  for (const entry of readdirSync(outputDirectory, { withFileTypes: true })) {
    const isDataset = entry.isDirectory() && COMMIT_DIRECTORY_PATTERN.test(entry.name);
    const isStaleStaging = entry.isDirectory() && entry.name.startsWith(STAGING_PREFIX);
    if ((isDataset && entry.name !== keptCommitSha) || isStaleStaging) {
      rmSync(join(outputDirectory, entry.name), { recursive: true, force: true });
    }
  }
}

export function writeDataset({
  outputDirectory,
  commitSha,
  shards,
  searchIndex,
  navigation,
  relationships,
  coverage,
  upstreamLicenseText,
  createManifest,
}) {
  mkdirSync(outputDirectory, { recursive: true });
  const stagingDirectory = join(outputDirectory, `${STAGING_PREFIX}${commitSha}`);
  rmSync(stagingDirectory, { recursive: true, force: true });
  mkdirSync(join(stagingDirectory, DATASET_FILES.shardDirectory), { recursive: true });

  let shardBytes = 0;
  for (const shard of shards) {
    shardBytes += writeJsonFile(
      stagingDirectory,
      join(DATASET_FILES.shardDirectory, `${shard.shard}.json`),
      shard,
    ).bytes;
  }
  const files = {
    searchIndex: writeJsonFile(stagingDirectory, DATASET_FILES.searchIndex, searchIndex),
    navigation: writeJsonFile(stagingDirectory, DATASET_FILES.navigation, navigation),
    relationships: writeJsonFile(stagingDirectory, DATASET_FILES.relationships, relationships),
    coverage: writeJsonFile(stagingDirectory, DATASET_FILES.coverage, coverage),
    upstreamLicense: writeTextFile(stagingDirectory, DATASET_FILES.upstreamLicense, upstreamLicenseText),
    shards: { directory: DATASET_FILES.shardDirectory, count: shards.length, bytes: shardBytes },
  };
  const manifest = manifestSchema.parse(createManifest(files));
  writeJsonFile(stagingDirectory, DATASET_FILES.manifest, manifest);

  const finalDirectory = join(outputDirectory, commitSha);
  rmSync(finalDirectory, { recursive: true, force: true });
  renameSync(stagingDirectory, finalDirectory);
  removeOtherDatasets(outputDirectory, commitSha);

  const pointer = currentDatasetPointerSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    commitSha,
    manifest: `${commitSha}/${DATASET_FILES.manifest}`,
  });
  writeFileSync(join(outputDirectory, DATASET_FILES.currentPointer), serialize(pointer));
  return { directory: finalDirectory, manifest };
}

export function datasetExists(outputDirectory) {
  return existsSync(join(outputDirectory, DATASET_FILES.currentPointer));
}
