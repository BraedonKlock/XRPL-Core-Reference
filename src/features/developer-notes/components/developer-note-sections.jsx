import { hasNotes } from '../../../../contract/developer-notes.js';
import { CopyButton } from './CopyButton.jsx';
import { CppCode } from './CppCode.jsx';
import styles from './DeveloperNotes.module.css';
import { Markdown } from './Markdown.jsx';

const SHORT_SHA_LENGTH = 7;
const SECTION_DESCRIPTION =
  "Additional guidance written for this site. It is not part of rippled's source documentation.";
const NOTE_FIELDS = Object.freeze([
  ['purpose', 'Purpose'],
  ['importantNotes', 'Important notes'],
]);

function shortSha(sha) {
  return sha.slice(0, SHORT_SHA_LENGTH);
}

function EntryStatus({ entry, commitSha }) {
  const isOutdated = entry.verifiedAt && entry.verifiedAt !== commitSha;
  return (
    <>
      {entry.draft ? (
        <p className={styles.notice}>
          <strong>Draft.</strong> This entry has not been reviewed yet.
        </p>
      ) : null}
      {isOutdated ? (
        <p className={styles.notice}>
          Written for rippled <code>{shortSha(entry.verifiedAt)}</code>. This reference documents{' '}
          <code>{shortSha(commitSha)}</code>, so this guidance may be out of date.
        </p>
      ) : null}
      {entry.verifiedAt && !isOutdated ? (
        <p className={styles.meta}>
          Verified against rippled <code>{shortSha(entry.verifiedAt)}</code>.
        </p>
      ) : null}
    </>
  );
}

function NotesContent({ entry, context }) {
  return (
    <>
      <EntryStatus entry={entry} commitSha={context.commitSha} />
      {NOTE_FIELDS.filter(([field]) => entry[field]).map(([field, title]) => (
        <div key={field} className={styles.field}>
          <h3 className={styles.fieldHeading}>{title}</h3>
          <Markdown source={entry[field]} resolveReference={context.resolveReference} />
        </div>
      ))}
    </>
  );
}

function CodeExample({ example, headingId, resolveReference }) {
  return (
    <div className={styles.example}>
      <div className={styles.exampleHeader}>
        <h3 id={headingId} className={styles.fieldHeading}>
          {example.title}
        </h3>
        <CopyButton text={example.code} describedBy={headingId} />
      </div>
      {example.draft ? (
        <p className={styles.notice}>
          <strong>Draft example.</strong> It is not included in production builds.
        </p>
      ) : null}
      {example.explanation ? (
        <Markdown source={example.explanation} resolveReference={resolveReference} />
      ) : null}
      <CppCode code={example.code} label={example.title} />
    </div>
  );
}

function ExamplesContent({ entry, examples, context }) {
  return (
    <>
      <EntryStatus entry={entry} commitSha={context.commitSha} />
      {examples.map((example, position) => (
        <CodeExample
          key={position}
          example={example}
          headingId={`code-example-${position + 1}`}
          resolveReference={context.resolveReference}
        />
      ))}
    </>
  );
}

export function developerNoteSections({ entry, examples }, context) {
  if (!entry) {
    return [];
  }
  return [
    ...(hasNotes(entry)
      ? [
          {
            id: 'developer-notes',
            title: 'Developer notes',
            description: SECTION_DESCRIPTION,
            collapsible: true,
            content: (
              <div className={`${styles.notes} ${styles.prose}`}>
                <NotesContent entry={entry} context={context} />
              </div>
            ),
          },
        ]
      : []),
    ...(examples.length > 0
      ? [
          {
            id: 'code-examples',
            title: 'Code examples',
            description: SECTION_DESCRIPTION,
            collapsible: true,
            content: (
              <div className={`${styles.notes} ${styles.prose}`}>
                <ExamplesContent entry={entry} examples={examples} context={context} />
              </div>
            ),
          },
        ]
      : []),
  ];
}
