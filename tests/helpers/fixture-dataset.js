import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDataset } from '../../scripts/documentation/build-dataset.js';
import { PROJECT_PATHS } from '../../scripts/documentation/config/pipeline-config.js';
import { verifySourceSnapshot } from '../../scripts/documentation/extraction/source-snapshot.js';

export const FIXTURE_BASE_URL = '/data/';

let datasetDirectoryPromise = null;

export function buildFixtureDataset() {
  datasetDirectoryPromise ??= (async () => {
    const outputDirectory = mkdtempSync(join(tmpdir(), 'xcr-browser-dataset-'));
    const sourceRoot = join(PROJECT_PATHS.fixtureDirectory, 'source');
    await buildDataset({
      extractionDirectory: join(PROJECT_PATHS.fixtureDirectory, 'extraction'),
      sourceRoot,
      verifySourceRevision: (commitSha) => verifySourceSnapshot(sourceRoot, commitSha),
      outputDirectory,
      log: () => {},
    });
    return outputDirectory;
  })();
  return datasetDirectoryPromise;
}

function jsonResponse(status, text) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(text),
  };
}

export function createFileFetch(datasetDirectory, { overrides = {}, requests = [] } = {}) {
  return async (url) => {
    requests.push(url);
    const relativePath = url.slice(FIXTURE_BASE_URL.length);
    if (relativePath in overrides) {
      return overrides[relativePath]();
    }
    const path = join(datasetDirectory, relativePath);
    return existsSync(path) ? jsonResponse(200, readFileSync(path, 'utf8')) : jsonResponse(404, '{}');
  };
}

export function readDatasetFile(datasetDirectory, relativePath) {
  return JSON.parse(readFileSync(join(datasetDirectory, relativePath), 'utf8'));
}
