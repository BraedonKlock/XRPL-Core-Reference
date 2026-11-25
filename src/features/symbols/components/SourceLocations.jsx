import { sourceFileUrl } from '../../../services/documentation/source-links.js';
import styles from './SymbolHeader.module.css';

function positionLabel(position) {
  return position.line ? `${position.file}:${position.line}` : position.file;
}

function SourcePosition({ label, source, position }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <a href={sourceFileUrl(source, position)} rel="noreferrer">
          {positionLabel(position)}
        </a>
      </dd>
    </div>
  );
}

export function SourceLocations({ source, location }) {
  if (!location) {
    return null;
  }
  const { declaration, definition } = location;
  const showsDefinition = definition && definition.file !== declaration.file;
  return (
    <dl className={styles.locations}>
      <SourcePosition label="Declared in" source={source} position={declaration} />
      {showsDefinition ? <SourcePosition label="Defined in" source={source} position={definition} /> : null}
    </dl>
  );
}
