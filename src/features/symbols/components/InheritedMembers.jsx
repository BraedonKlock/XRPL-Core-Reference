import { useState } from 'react';
import { ErrorState } from '../../../components/feedback/ErrorState.jsx';
import { LoadingState } from '../../../components/feedback/LoadingState.jsx';
import { useDataset } from '../../../hooks/useDataset.js';
import { useShard } from '../hooks/useShard.js';
import { inheritableMembers } from '../utils/member-groups.js';
import styles from './InheritedMembers.module.css';
import { MemberTable } from './MemberTable.jsx';

function InheritedMemberTable({ basePath, baseName }) {
  const { directory } = useDataset();
  const shard = useShard(directory.get(basePath)?.shard ?? null);
  if (shard.status === 'loading') {
    return <LoadingState label={`Loading members of ${baseName}…`} />;
  }
  if (shard.status === 'error') {
    return <ErrorState title={`Members of ${baseName} could not be loaded`} error={shard.error} />;
  }
  const symbolsByPath = new Map(shard.value.symbols.map((symbol) => [symbol.path, symbol]));
  const base = symbolsByPath.get(basePath);
  const members = inheritableMembers(
    (base?.members ?? []).map((path) => symbolsByPath.get(path)).filter(Boolean),
  );
  if (members.length === 0) {
    return <p className={styles.empty}>No public or protected members are declared here.</p>;
  }
  return <MemberTable members={members} label={`Members inherited from ${baseName}`} showsKind />;
}

function InheritedGroup({ basePath }) {
  const { directory } = useDataset();
  const [isOpen, setOpen] = useState(false);
  const baseName = directory.get(basePath)?.qualifiedName ?? basePath;
  return (
    <details className={styles.details} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className={styles.summary}>
        From <code>{baseName}</code>
      </summary>
      {isOpen ? (
        <div className={styles.body}>
          <InheritedMemberTable basePath={basePath} baseName={baseName} />
        </div>
      ) : null}
    </details>
  );
}

export function InheritedMembers({ ancestorPaths }) {
  return (
    <div className={styles.list}>
      {ancestorPaths.map((path) => (
        <InheritedGroup key={path} basePath={path} />
      ))}
    </div>
  );
}
