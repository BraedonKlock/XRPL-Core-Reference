import { useDataset } from '../../../hooks/useDataset.js';
import { createSearchEngine } from '../services/search-engine.js';

const enginesByDirectory = new WeakMap();

export function useSearchEngine() {
  const { directory } = useDataset();
  if (!enginesByDirectory.has(directory)) {
    enginesByDirectory.set(directory, createSearchEngine(directory.entries()));
  }
  return enginesByDirectory.get(directory);
}
