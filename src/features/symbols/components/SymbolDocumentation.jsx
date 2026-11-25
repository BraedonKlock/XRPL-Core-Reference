import { Link } from 'react-router';
import { symbolUrl } from '../../../config/routes.js';
import { DocumentationInline } from './DocumentationInline.jsx';
import styles from './SymbolDocumentation.module.css';

const NOTE_LABELS = Object.freeze({
  note: 'Note',
  warning: 'Warning',
  see: 'See also',
  precondition: 'Precondition',
  postcondition: 'Postcondition',
  since: 'Since',
  deprecated: 'Deprecated',
  attention: 'Attention',
  remark: 'Remark',
  invariant: 'Invariant',
  throws: 'Throws',
  retval: 'Return value',
});
const WARNING_KINDS = new Set(['warning', 'deprecated', 'attention']);

function DocumentationBlock({ block }) {
  if (block.type === 'code') {
    return (
      <pre className={styles.codeBlock}>
        <code>{block.text}</code>
      </pre>
    );
  }
  if (block.type === 'list') {
    const List = block.ordered ? 'ol' : 'ul';
    return (
      <List>
        {block.items.map((item, position) => (
          <li key={position}>
            <DocumentationInline content={item} />
          </li>
        ))}
      </List>
    );
  }
  return (
    <p>
      <DocumentationInline content={block.content} />
    </p>
  );
}

function DocumentationNote({ note }) {
  return (
    <div className={`${styles.note} ${WARNING_KINDS.has(note.kind) ? styles.warning : ''}`}>
      <span className={styles.noteLabel}>{NOTE_LABELS[note.kind]}</span>
      <DocumentationInline content={note.content} />
    </div>
  );
}

function InheritedFrom({ inheritedFrom }) {
  return (
    <p className={styles.inherited}>
      Documentation inherited from{' '}
      {inheritedFrom.target ? (
        <Link to={symbolUrl(inheritedFrom.target.path)}>{inheritedFrom.name}</Link>
      ) : (
        <code>{inheritedFrom.name}</code>
      )}
    </p>
  );
}

export function SymbolDocumentation({ documentation }) {
  if (documentation.status === 'suppressed') {
    return (
      <p className={styles.suppressed}>
        <strong>Documentation omitted.</strong> {documentation.suppressionReason}
      </p>
    );
  }
  if (documentation.status === 'absent') {
    return <p className={styles.absent}>No documentation comment in the source.</p>;
  }
  return (
    <div className={styles.documentation}>
      {documentation.inheritedFrom ? <InheritedFrom inheritedFrom={documentation.inheritedFrom} /> : null}
      {documentation.brief ? (
        <p className={styles.brief}>
          <DocumentationInline content={documentation.brief} />
        </p>
      ) : null}
      {documentation.description.map((block, position) => (
        <DocumentationBlock key={position} block={block} />
      ))}
      {documentation.returns ? (
        <p>
          <strong>Returns: </strong>
          <DocumentationInline content={documentation.returns} />
        </p>
      ) : null}
      {documentation.notes.map((note, position) => (
        <DocumentationNote key={position} note={note} />
      ))}
    </div>
  );
}
