import { Link } from 'react-router';
import { symbolUrl } from '../../../config/routes.js';
import { kindLabelOf } from '../../../utils/symbol-kinds.js';
import { memberSignatureText, memberTagsOf } from '../utils/member-signature.js';
import { DocumentationInline } from './DocumentationInline.jsx';
import styles from './ReferenceTable.module.css';
import { TypeExpression } from './TypeExpression.jsx';

function typeOf(record) {
  if (record.kind === 'function') {
    return record.returnType;
  }
  return record.kind === 'variable' || record.kind === 'typeAlias' ? record.type : null;
}

export function MemberTable({ members, label, showsKind = false }) {
  const showsType = members.some((record) => typeOf(record));
  return (
    <div className={styles.wrapper}>
      <table className={styles.table} aria-label={label}>
        <thead>
          <tr>
            <th scope="col" className={styles.nameColumn}>
              Name
            </th>
            {showsType ? <th scope="col">Type</th> : null}
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {members.map((record) => {
            const tags = [...(showsKind ? [kindLabelOf(record)] : []), ...memberTagsOf(record)];
            return (
              <tr key={record.path}>
                <td>
                  <Link to={symbolUrl(record.path)} className={styles.signature}>
                    {memberSignatureText(record)}
                  </Link>
                  {tags.length > 0 ? (
                    <div className={styles.tags}>
                      {tags.map((tag) => (
                        <span key={tag} className={styles.tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </td>
                {showsType ? (
                  <td className={styles.type}>
                    <TypeExpression expression={typeOf(record)} />
                  </td>
                ) : null}
                <td>
                  {record.documentation.brief ? (
                    <DocumentationInline content={record.documentation.brief} />
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
