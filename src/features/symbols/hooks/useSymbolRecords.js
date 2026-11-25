import { useDataset } from '../../../hooks/useDataset.js';
import { selectSymbolRecords } from '../utils/select-symbol-records.js';
import { useShard } from './useShard.js';

export function useSymbolRecords(symbolPath) {
  const { directory } = useDataset();
  const resolution = symbolPath ? directory.resolve(symbolPath) : null;
  const shard = useShard(resolution?.entry.shard ?? null);

  if (!resolution) {
    return { status: 'not-found' };
  }
  if (shard.status !== 'ready') {
    return { status: shard.status, error: shard.error, entry: resolution.entry };
  }
  const selection = selectSymbolRecords(shard.value.symbols, resolution);
  if (!selection) {
    return { status: 'not-found' };
  }
  return { status: 'ready', entry: resolution.entry, shardSymbols: shard.value.symbols, ...selection };
}
