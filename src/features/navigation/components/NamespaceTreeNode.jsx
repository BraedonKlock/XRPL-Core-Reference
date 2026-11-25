import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { symbolUrl } from '../../../config/routes.js';
import { kindGlyphOf, kindLabelOf } from '../../../utils/symbol-kinds.js';
import styles from './NamespaceTree.module.css';

export function NamespaceTreeNode({ node, activePath, expandedPaths, onToggle }) {
  const rowReference = useRef(null);
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedPaths.has(node.path);
  const isActive = node.path === activePath;

  useEffect(() => {
    if (isActive) {
      rowReference.current?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    }
  }, [isActive]);

  const rowClassName = [styles.row, isActive && styles.active, isExpanded && styles.expanded]
    .filter(Boolean)
    .join(' ');

  return (
    <li>
      <div className={rowClassName} ref={rowReference}>
        {hasChildren ? (
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.name}`}
            onClick={() => onToggle(node.path)}
          >
            <span className={styles.chevron} aria-hidden="true">
              {'›'}
            </span>
          </button>
        ) : (
          <span className={styles.spacer} aria-hidden="true" />
        )}
        <Link
          to={symbolUrl(node.path)}
          className={styles.link}
          aria-label={`${node.name} ${kindLabelOf(node)}`}
          aria-current={isActive ? 'page' : undefined}
        >
          <span
            className={`${styles.glyph} ${styles[node.kind]}`}
            data-glyph={kindGlyphOf(node.kind)}
            aria-hidden="true"
          />
          <span className={styles.name} title={node.name}>
            {node.name}
          </span>
        </Link>
      </div>
      {hasChildren && isExpanded ? (
        <ul className={styles.group}>
          {node.children.map((child) => (
            <NamespaceTreeNode
              key={child.path}
              node={child}
              activePath={activePath}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
