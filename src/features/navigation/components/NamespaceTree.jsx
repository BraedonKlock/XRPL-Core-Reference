import { useCallback, useState } from 'react';
import { toggledExpansion, withAncestorsExpanded } from '../utils/tree-expansion.js';
import styles from './NamespaceTree.module.css';
import { NamespaceTreeNode } from './NamespaceTreeNode.jsx';

export function NamespaceTree({ roots, activePath }) {
  const [expandedPaths, setExpandedPaths] = useState(() => withAncestorsExpanded(new Set(), activePath));
  const [revealedPath, setRevealedPath] = useState(activePath);

  if (activePath !== revealedPath) {
    setRevealedPath(activePath);
    setExpandedPaths((current) => withAncestorsExpanded(current, activePath));
  }

  const handleToggle = useCallback(
    (path) => setExpandedPaths((current) => toggledExpansion(current, path)),
    [],
  );

  return (
    <ul className={styles.tree}>
      {roots.map((node) => (
        <NamespaceTreeNode
          key={node.path}
          node={node}
          activePath={activePath}
          expandedPaths={expandedPaths}
          onToggle={handleToggle}
        />
      ))}
    </ul>
  );
}
