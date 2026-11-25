import styles from './ReferenceTable.module.css';
import { TypeExpression } from './TypeExpression.jsx';

export function TemplateParameterTable({ parameters }) {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table} aria-label="Template parameters">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Kind</th>
            <th scope="col">Default</th>
          </tr>
        </thead>
        <tbody>
          {parameters.map((parameter, position) => (
            <tr key={`${parameter.name ?? 'unnamed'}-${position}`}>
              <td className={styles.signature}>
                {parameter.name ?? <span className={styles.muted}>unnamed</span>}
              </td>
              <td className={styles.type}>
                <TypeExpression expression={parameter.type} />
              </td>
              <td className={styles.type}>
                <TypeExpression expression={parameter.defaultValue} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
