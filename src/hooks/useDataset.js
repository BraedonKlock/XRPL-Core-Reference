import { useContext } from 'react';
import { DatasetContext } from './dataset-context.js';

export function useDataset() {
  const dataset = useContext(DatasetContext);
  if (!dataset) {
    throw new Error('useDataset must be used inside DatasetProvider');
  }
  return dataset;
}
