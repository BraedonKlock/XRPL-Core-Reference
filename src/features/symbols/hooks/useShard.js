import { useDataset } from '../../../hooks/useDataset.js';
import { useResource } from '../../../hooks/useResource.js';

const NO_SHARD = Promise.resolve(null);

export function useShard(shardId) {
  const { client, manifest } = useDataset();
  const commitSha = manifest.source.commitSha;
  return useResource(shardId, () => (shardId ? client.loadShard(commitSha, shardId) : NO_SHARD));
}
