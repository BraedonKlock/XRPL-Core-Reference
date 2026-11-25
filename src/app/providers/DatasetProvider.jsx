import { useMemo } from 'react';
import { DATASET_FILES } from '../../../contract/constants.js';
import { ErrorState } from '../../components/feedback/ErrorState.jsx';
import { LoadingState } from '../../components/feedback/LoadingState.jsx';
import { DatasetContext } from '../../hooks/dataset-context.js';
import { useResource } from '../../hooks/useResource.js';
import { createSymbolDirectory } from '../../services/documentation/symbol-directory.js';
import styles from './DatasetProvider.module.css';

export function DatasetProvider({ client, children }) {
  const dataset = useResource(client, () => client.loadDataset());

  const value = useMemo(() => {
    if (dataset.status !== 'ready') {
      return null;
    }
    const { manifest, navigation, searchIndex } = dataset.value;
    return {
      client,
      manifest,
      navigation,
      directory: createSymbolDirectory(searchIndex),
      upstreamLicenseUrl: client.fileUrl(manifest.source.commitSha, DATASET_FILES.upstreamLicense),
    };
  }, [client, dataset]);

  if (dataset.status === 'error') {
    return (
      <div className={styles.screen}>
        <ErrorState title="The documentation dataset could not be loaded" error={dataset.error}>
          <p>
            Generate a dataset with <code>npm run docs:generate</code>, then reload this page.
          </p>
        </ErrorState>
      </div>
    );
  }
  if (!value) {
    return (
      <div className={styles.screen}>
        <LoadingState label="Loading the documentation dataset…" />
      </div>
    );
  }
  return <DatasetContext value={value}>{children}</DatasetContext>;
}
