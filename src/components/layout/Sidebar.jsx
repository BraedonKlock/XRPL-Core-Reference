import { useEffect, useRef } from 'react';
import styles from './Sidebar.module.css';

export function Sidebar({ id, toggleId, isOpen, onClose, children }) {
  const sidebarReference = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    sidebarReference.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
        document.getElementById(toggleId)?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onClose, toggleId]);

  return (
    <>
      <aside
        id={id}
        ref={sidebarReference}
        tabIndex={-1}
        className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}
        aria-label="Symbol navigation"
      >
        <div className={styles.heading}>Namespaces</div>
        <nav className={styles.scroller} aria-label="Namespaces and classes">
          {children}
        </nav>
      </aside>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Close navigation"
        tabIndex={-1}
        onClick={onClose}
      />
    </>
  );
}
