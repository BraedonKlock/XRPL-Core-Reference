import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildFixtureDataset,
  createFileFetch,
  FIXTURE_BASE_URL,
  readDatasetFile,
} from '../../../tests/helpers/fixture-dataset.js';
import { createDatasetClient, DatasetError } from './dataset-client.js';

const COMMIT = 'c2534ff9c84422e00711da31629a76f3f59feb98';
let datasetDirectory;

beforeAll(async () => {
  datasetDirectory = await buildFixtureDataset();
});

function client(options) {
  return createDatasetClient({
    baseUrl: FIXTURE_BASE_URL,
    fetchImplementation: createFileFetch(datasetDirectory, options),
  });
}

function jsonOf(value) {
  return async () => ({ ok: true, status: 200, json: async () => value });
}

describe('dataset client', () => {
  it('loads and validates the startup files for one revision', async () => {
    const { manifest, navigation, searchIndex } = await client().loadDataset();
    expect(manifest.source).toMatchObject({
      repository: 'XRPLF/rippled',
      branch: 'develop',
      commitSha: COMMIT,
    });
    expect(navigation.commitSha).toBe(COMMIT);
    expect(searchIndex.rows.length).toBeGreaterThan(100);
  });

  it('caches dataset and shard requests', async () => {
    const requests = [];
    const datasetClient = client({ requests });
    const { searchIndex } = await datasetClient.loadDataset();
    await datasetClient.loadDataset();
    const shardId = searchIndex.shards[0];
    await datasetClient.loadShard(COMMIT, shardId);
    await datasetClient.loadShard(COMMIT, shardId);
    expect(requests.filter((url) => url.endsWith('current.json'))).toHaveLength(1);
    expect(requests.filter((url) => url.endsWith(`${shardId}.json`))).toHaveLength(1);
  });

  it('rejects files that violate the data contract', async () => {
    const broken = client({
      overrides: { 'current.json': jsonOf({ schemaVersion: '1.0.0', commitSha: 'abc', manifest: 'x' }) },
    });
    await expect(broken.loadDataset()).rejects.toThrow(/does not match the data contract/);
  });

  it('rejects a manifest from a different revision', async () => {
    const manifest = readDatasetFile(datasetDirectory, `${COMMIT}/manifest.json`);
    const otherCommit = 'f'.repeat(40);
    const mismatched = client({
      overrides: {
        [`${COMMIT}/manifest.json`]: jsonOf({
          ...manifest,
          source: { ...manifest.source, commitSha: otherCommit },
        }),
      },
    });
    await expect(mismatched.loadDataset()).rejects.toThrow(/Manifest describes/);
  });

  it('reports network failures and does not cache them', async () => {
    let attempts = 0;
    const flaky = client({
      overrides: {
        'current.json': async () => {
          attempts += 1;
          if (attempts === 1) {
            throw new TypeError('network down');
          }
          return {
            ok: true,
            status: 200,
            json: async () => readDatasetFile(datasetDirectory, 'current.json'),
          };
        },
      },
    });
    await expect(flaky.loadDataset()).rejects.toBeInstanceOf(DatasetError);
    await expect(flaky.loadDataset()).resolves.toHaveProperty('manifest');
  });

  it('reports missing shards with their URL', async () => {
    await expect(client().loadShard(COMMIT, 'missing')).rejects.toMatchObject({
      name: 'DatasetError',
      url: `${FIXTURE_BASE_URL}${COMMIT}/symbols/missing.json`,
    });
  });
});
