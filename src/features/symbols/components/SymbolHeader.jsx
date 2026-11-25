import { Badge } from '../../../components/ui/Badge.jsx';
import { kindLabelOf } from '../../../utils/symbol-kinds.js';
import { SourceLocations } from './SourceLocations.jsx';
import styles from './SymbolHeader.module.css';

function badgesOf(record) {
  return [
    record.access && record.access !== 'public' ? record.access : null,
    record.templateParameters ? 'template' : null,
    record.isTemplateSpecialization ? 'specialization' : null,
    record.isFinal ? 'final' : null,
    record.isAbstract ? 'abstract' : null,
    record.qualifiers?.isStatic ? 'static' : null,
    record.qualifiers?.isConstexpr ? 'constexpr' : null,
    record.qualifiers?.isDeleted ? 'deleted' : null,
    record.qualifiers?.virtuality && record.qualifiers.virtuality !== 'non-virtual'
      ? record.qualifiers.virtuality
      : null,
    record.category === 'test' ? 'test code' : null,
  ].filter(Boolean);
}

export function SymbolHeader({ entry, record, source }) {
  const subject = record ?? entry;
  const badges = record ? badgesOf(record) : [];
  return (
    <header className={styles.header}>
      <span className={styles.kind}>{kindLabelOf(subject)}</span>
      <h1 className={styles.title}>{subject.name}</h1>
      <code className={styles.qualifiedName}>{subject.qualifiedName}</code>
      {badges.length > 0 ? (
        <div className={styles.badges}>
          {badges.map((badge) => (
            <Badge key={badge}>{badge}</Badge>
          ))}
        </div>
      ) : null}
      {record && record.kind !== 'namespace' ? (
        <SourceLocations source={source} location={record.location} />
      ) : null}
    </header>
  );
}
