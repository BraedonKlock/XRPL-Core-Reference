import { useMemo } from 'react';
import { useDataset } from '../../../hooks/useDataset.js';
import { useResource } from '../../../hooks/useResource.js';
import { indexInheritance } from '../utils/inheritance.js';

export function useInheritanceIndex() {
  const { client, manifest } = useDataset();
  const relationships = useResource(`relationships:${manifest.source.commitSha}`, () =>
    client.loadRelationships(manifest),
  );
  const index = useMemo(
    () => (relationships.status === 'ready' ? indexInheritance(relationships.value) : null),
    [relationships],
  );
  return { status: relationships.status, error: relationships.error, basesByDerived: index };
}
