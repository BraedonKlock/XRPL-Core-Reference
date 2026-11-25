import { Link } from 'react-router';
import { ErrorState } from '../../../components/feedback/ErrorState.jsx';
import { LoadingState } from '../../../components/feedback/LoadingState.jsx';
import { symbolUrl } from '../../../config/routes.js';
import { useInheritanceIndex } from '../hooks/useInheritance.js';
import { baseTreeOf } from '../utils/inheritance.js';
import styles from './InheritanceTree.module.css';

function BaseNode({ node }) {
  const qualifiers = [node.access, node.isVirtual ? 'virtual' : null].filter(Boolean).join(' ');
  return (
    <li>
      <div className={styles.node}>
        {node.path ? <Link to={symbolUrl(node.path)}>{node.name}</Link> : node.name}
        <span className={styles.meta}>
          {qualifiers}
          {node.path ? '' : ' · not in this reference'}
        </span>
      </div>
      {node.bases.length > 0 ? (
        <ul>
          {node.bases.map((base, position) => (
            <BaseNode key={`${base.name}-${position}`} node={base} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function BaseClassTree({ record }) {
  const inheritance = useInheritanceIndex();
  if (inheritance.status === 'loading') {
    return <LoadingState label="Loading inheritance…" />;
  }
  if (inheritance.status === 'error') {
    return <ErrorState title="Inheritance could not be loaded" error={inheritance.error} />;
  }
  const tree = baseTreeOf(record.path, inheritance.basesByDerived);
  return (
    <ul className={styles.tree} aria-label={`Base classes of ${record.name}`}>
      <li>
        <div className={`${styles.node} ${styles.current}`}>{record.qualifiedName}</div>
        <ul>
          {tree.map((node, position) => (
            <BaseNode key={`${node.name}-${position}`} node={node} />
          ))}
        </ul>
      </li>
    </ul>
  );
}

export function DerivedClassList({ record }) {
  return (
    <ul className={styles.derived} aria-label={`Classes derived from ${record.name}`}>
      {record.derivedClasses.map((derived) => (
        <li key={derived.name}>
          {derived.target ? <Link to={symbolUrl(derived.target.path)}>{derived.name}</Link> : derived.name}
        </li>
      ))}
    </ul>
  );
}

export function InheritanceSection({ record }) {
  return (
    <>
      {record.baseClasses.length > 0 ? (
        <>
          <h3 className={styles.groupTitle}>Base classes</h3>
          <BaseClassTree record={record} />
        </>
      ) : null}
      {record.derivedClasses.length > 0 ? (
        <>
          <h3 className={styles.groupTitle}>Derived classes ({record.derivedClasses.length})</h3>
          <DerivedClassList record={record} />
        </>
      ) : null}
    </>
  );
}
