import { withoutLeadingAssignment } from '../utils/expression-utils.js';
import { DocumentationInline } from './DocumentationInline.jsx';
import styles from './ReferenceTable.module.css';
import { TypeExpression } from './TypeExpression.jsx';

function enumeratorDescription(documentation) {
  if (documentation.status === 'suppressed') {
    return <span className={styles.muted}>Documentation omitted: {documentation.suppressionReason}</span>;
  }
  return documentation.brief ? <DocumentationInline content={documentation.brief} /> : null;
}

export function EnumeratorTable({ enumerators }) {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table} aria-label="Enumerators">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Value</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {enumerators.map((enumerator) => (
            <tr key={enumerator.name} id={enumerator.name} className={styles.anchor}>
              <td className={styles.signature}>{enumerator.name}</td>
              <td className={styles.type}>
                <TypeExpression expression={withoutLeadingAssignment(enumerator.initializer)} />
              </td>
              <td>{enumeratorDescription(enumerator.documentation)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
