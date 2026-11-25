import {
  currentDatasetPointerSchema,
  manifestSchema,
  navigationSchema,
  relationshipsSchema,
  searchIndexSchema,
  symbolShardSchema,
} from '../../../contract/schema.js';
import { DATASET_FILES } from '../../../contract/constants.js';

export class DatasetError extends Error {
  constructor(message, { url, cause } = {}) {
    super(message, { cause });
    this.name = 'DatasetError';
    this.url = url ?? null;
  }
}

function describeIssues(error) {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ');
}

function assertSameRevision(file, expectedCommitSha, url) {
  if (file.commitSha !== expectedCommitSha) {
    throw new DatasetError(`${url} belongs to commit ${file.commitSha}, expected ${expectedCommitSha}`, {
      url,
    });
  }
}

export function createDatasetClient({ baseUrl, fetchImplementation = globalThis.fetch.bind(globalThis) }) {
  const cache = new Map();

  const fetchJson = async (relativePath, schema, requestOptions) => {
    const url = `${baseUrl}${relativePath}`;
    let response;
    try {
      response = await fetchImplementation(url, requestOptions);
    } catch (cause) {
      throw new DatasetError(`Could not reach ${url}`, { url, cause });
    }
    if (!response.ok) {
      throw new DatasetError(`Request for ${url} failed with HTTP ${response.status}`, { url });
    }
    let body;
    try {
      body = await response.json();
    } catch (cause) {
      throw new DatasetError(`${url} is not valid JSON`, { url, cause });
    }
    const result = schema.safeParse(body);
    if (!result.success) {
      throw new DatasetError(`${url} does not match the data contract: ${describeIssues(result.error)}`, {
        url,
      });
    }
    return result.data;
  };

  const memoize = (key, load) => {
    if (!cache.has(key)) {
      const pending = load();
      pending.catch(() => cache.delete(key));
      cache.set(key, pending);
    }
    return cache.get(key);
  };

  const loadDataset = () =>
    memoize('dataset', async () => {
      const pointer = await fetchJson(DATASET_FILES.currentPointer, currentDatasetPointerSchema, {
        cache: 'no-cache',
      });
      const manifest = await fetchJson(pointer.manifest, manifestSchema);
      if (manifest.source.commitSha !== pointer.commitSha) {
        throw new DatasetError(
          `Manifest describes ${manifest.source.commitSha}, expected ${pointer.commitSha}`,
        );
      }
      const datasetPath = (file) => `${pointer.commitSha}/${file}`;
      const [navigation, searchIndex] = await Promise.all([
        fetchJson(datasetPath(manifest.files.navigation.path), navigationSchema),
        fetchJson(datasetPath(manifest.files.searchIndex.path), searchIndexSchema),
      ]);
      assertSameRevision(navigation, pointer.commitSha, manifest.files.navigation.path);
      assertSameRevision(searchIndex, pointer.commitSha, manifest.files.searchIndex.path);
      return { manifest, navigation, searchIndex };
    });

  const loadShard = (commitSha, shardId) =>
    memoize(`shard:${commitSha}:${shardId}`, async () => {
      const relativePath = `${commitSha}/${DATASET_FILES.shardDirectory}/${shardId}.json`;
      const shard = await fetchJson(relativePath, symbolShardSchema);
      assertSameRevision(shard, commitSha, relativePath);
      return shard;
    });

  const loadRelationships = (manifest) =>
    memoize(`relationships:${manifest.source.commitSha}`, async () => {
      const relativePath = `${manifest.source.commitSha}/${manifest.files.relationships.path}`;
      const relationships = await fetchJson(relativePath, relationshipsSchema);
      assertSameRevision(relationships, manifest.source.commitSha, relativePath);
      return relationships;
    });

  const fileUrl = (commitSha, file) => `${baseUrl}${commitSha}/${file}`;

  return { loadDataset, loadShard, loadRelationships, fileUrl };
}
