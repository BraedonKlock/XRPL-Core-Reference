import { useDataset } from '../../../hooks/useDataset.js';
import { createLazySearchEngine } from '../services/search-engine.js';

const enginesByDirectory = new WeakMap();

export function useSearchEngine() {
  const { directory } = useDataset();
  if (!enginesByDirectory.has(directory)) {
    enginesByDirectory.set(
      directory,
      createLazySearchEngine(() => directory.entries()),
    );
  }
  return enginesByDirectory.get(directory);
}
