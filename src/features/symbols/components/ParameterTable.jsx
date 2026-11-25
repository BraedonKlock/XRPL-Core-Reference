import { DocumentationInline } from './DocumentationInline.jsx';
import styles from './ReferenceTable.module.css';
import { TypeExpression } from './TypeExpression.jsx';

export function ParameterTable({ parameters }) {
  const showsDefaults = parameters.some((parameter) => parameter.defaultValue);
  return (
    <div className={styles.wrapper}>
      <table className={styles.table} aria-label="Parameters">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Type</th>
            {showsDefaults ? <th scope="col">Default</th> : null}
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {parameters.map((parameter, position) => (
            <tr key={`${parameter.name ?? 'unnamed'}-${position}`}>
              <td className={styles.signature}>
                {parameter.name ?? <span className={styles.muted}>unnamed</span>}
                {parameter.direction ? <span className={styles.tag}> [{parameter.direction}]</span> : null}
              </td>
              <td className={styles.type}>
                <TypeExpression expression={parameter.type} />
                {parameter.array}
              </td>
              {showsDefaults ? (
                <td className={styles.type}>
                  <TypeExpression expression={parameter.defaultValue} />
                </td>
              ) : null}
              <td>
                {parameter.description ? <DocumentationInline content={parameter.description} /> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
