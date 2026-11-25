import { Link } from 'react-router';
import { SymbolList } from '../../../components/navigation/SymbolList.jsx';
import { symbolUrl } from '../../../config/routes.js';
import { sourceFileUrl } from '../../../services/documentation/source-links.js';
import { withoutLeadingAssignment } from '../utils/expression-utils.js';
import { groupClassMembers, groupNamespaceMembers } from '../utils/member-groups.js';
import { Declaration } from './Declaration.jsx';
import { DocumentationInline } from './DocumentationInline.jsx';
import { EnumeratorTable } from './EnumeratorTable.jsx';
import { InheritanceSection } from './InheritanceSection.jsx';
import { InheritedMembersSection } from './InheritedMembersSection.jsx';
import { MemberTable } from './MemberTable.jsx';
import { ParameterTable } from './ParameterTable.jsx';
import { SymbolDocumentation } from './SymbolDocumentation.jsx';
import styles from './SymbolSections.module.css';
import { TemplateParameterTable } from './TemplateParameterTable.jsx';
import { TypeExpression } from './TypeExpression.jsx';

const COMPOUND_GROUPS = Object.freeze([
  { id: 'namespaces', title: 'Namespaces', kinds: new Set(['namespace']) },
  { id: 'classes', title: 'Classes and structs', kinds: new Set(['class', 'struct', 'union']) },
  { id: 'concepts', title: 'Concepts', kinds: new Set(['concept']) },
]);

function section(id, title, content, count = null) {
  return { id, title, content, count };
}

function descriptionSection(record) {
  return section('description', 'Description', <SymbolDocumentation documentation={record.documentation} />);
}

function declarationSection(record) {
  return section(
    'declaration',
    'Declaration',
    <Declaration expression={record.declaration} name={record.name} />,
  );
}

function templateSection(record) {
  return record.templateParameters?.length
    ? [
        section(
          'template-parameters',
          'Template parameters',
          <TemplateParameterTable parameters={record.templateParameters} />,
        ),
      ]
    : [];
}

function nestedCompoundSections(entries, classesTitle) {
  return COMPOUND_GROUPS.map((group) => {
    const members = entries
      .filter((entry) => group.kinds.has(entry.kind))
      .sort((left, right) => left.name.localeCompare(right.name));
    const title = group.id === 'classes' && classesTitle ? classesTitle : group.title;
    return members.length > 0
      ? section(group.id, title, <SymbolList entries={members} label={title} />, members.length)
      : null;
  }).filter(Boolean);
}

function namespaceSections(record, { directory }) {
  const children = directory.childrenOf(record.path);
  return [
    descriptionSection(record),
    ...nestedCompoundSections(children, null),
    ...groupNamespaceMembers(children).map((group) =>
      section(
        `members-${group.id}`,
        group.title,
        <SymbolList entries={group.entries} label={group.title} />,
        group.entries.length,
      ),
    ),
  ];
}

function classSections(record, { directory, symbolsByPath }) {
  const members = record.members.map((path) => symbolsByPath.get(path)).filter(Boolean);
  const hasInheritance = record.baseClasses.length > 0 || record.derivedClasses.length > 0;
  const hasResolvedBases = record.baseClasses.some((base) => base.target);
  const nestedEntries = record.nested.map((path) => directory.get(path)).filter(Boolean);
  return [
    descriptionSection(record),
    declarationSection(record),
    ...templateSection(record),
    ...(hasInheritance
      ? [section('inheritance', 'Inheritance', <InheritanceSection record={record} />)]
      : []),
    ...groupClassMembers(members).map((group) =>
      section(
        group.id,
        group.title,
        group.collapsed ? (
          <details>
            <summary>Show {group.members.length} private members</summary>
            <MemberTable members={group.members} label={group.title} showsKind={group.showsKind} />
          </details>
        ) : (
          <MemberTable members={group.members} label={group.title} showsKind={group.showsKind} />
        ),
        group.members.length,
      ),
    ),
    ...nestedCompoundSections(nestedEntries, 'Nested types'),
    ...(record.friends.length > 0
      ? [
          section(
            'friend-classes',
            'Friend classes',
            <ul className={styles.list}>
              {record.friends.map((friend) => (
                <li key={friend.name}>
                  {friend.target ? (
                    <Link to={symbolUrl(friend.target.path)}>{friend.name}</Link>
                  ) : (
                    friend.name
                  )}
                </li>
              ))}
            </ul>,
          ),
        ]
      : []),
    ...(record.deductionGuides.length > 0
      ? [
          section(
            'deduction-guides',
            'Deduction guides',
            <div className={styles.stack}>
              {record.deductionGuides.map((guide, position) => (
                <Declaration
                  key={position}
                  expression={guide.declaration}
                  name={`${record.name} deduction guide`}
                />
              ))}
            </div>,
          ),
        ]
      : []),
    ...(hasResolvedBases
      ? [section('inherited-members', 'Inherited members', <InheritedMembersSection record={record} />)]
      : []),
  ];
}

function returnSection(record) {
  const returnsSomething = record.returnType && !['constructor', 'destructor'].includes(record.role);
  if (!returnsSomething) {
    return [];
  }
  return [
    section(
      'return-value',
      'Return value',
      <div className={styles.stack}>
        <code className={styles.returnType}>
          <TypeExpression expression={record.returnType} />
        </code>
        {record.documentation.returns ? (
          <p>
            <DocumentationInline content={record.documentation.returns} />
          </p>
        ) : null}
      </div>,
    ),
  ];
}

function specializationSection(record, { source }) {
  if (record.explicitSpecializations.length === 0) {
    return [];
  }
  return [
    section(
      'explicit-specializations',
      'Explicit specializations',
      <ul className={styles.list}>
        {record.explicitSpecializations.map((position) => (
          <li key={`${position.file}:${position.line}`}>
            <a href={sourceFileUrl(source, position)} rel="noreferrer">
              {position.line ? `${position.file}:${position.line}` : position.file}
            </a>
          </li>
        ))}
      </ul>,
    ),
  ];
}

function functionSections(record, context) {
  const otherOverloads = context.overloads.filter((overload) => overload.path !== record.path);
  return [
    descriptionSection(record),
    declarationSection(record),
    ...templateSection(record),
    ...(record.parameters.length > 0
      ? [section('parameters', 'Parameters', <ParameterTable parameters={record.parameters} />)]
      : []),
    ...returnSection(record),
    ...specializationSection(record, context),
    ...(otherOverloads.length > 0
      ? [
          section(
            'other-overloads',
            'Other overloads',
            <MemberTable members={otherOverloads} label="Other overloads" />,
            otherOverloads.length,
          ),
        ]
      : []),
  ];
}

function variableSections(record) {
  return [
    descriptionSection(record),
    declarationSection(record),
    section(
      'type',
      'Type',
      <code className={styles.returnType}>
        <TypeExpression expression={record.type} />
      </code>,
    ),
    ...(record.initializer
      ? [
          section(
            'value',
            'Initial value',
            <code className={styles.returnType}>
              <TypeExpression expression={withoutLeadingAssignment(record.initializer)} />
            </code>,
          ),
        ]
      : []),
  ];
}

function typeAliasSections(record) {
  return [
    descriptionSection(record),
    declarationSection(record),
    ...templateSection(record),
    section(
      'aliased-type',
      'Aliased type',
      <code className={styles.returnType}>
        <TypeExpression expression={record.type} />
      </code>,
    ),
  ];
}

function enumSections(record) {
  return [
    descriptionSection(record),
    declarationSection(record),
    section(
      'enumerators',
      'Enumerators',
      <EnumeratorTable enumerators={record.enumerators} />,
      record.enumerators.length,
    ),
  ];
}

function conceptSections(record) {
  return [descriptionSection(record), declarationSection(record), ...templateSection(record)];
}

const SECTION_BUILDERS = Object.freeze({
  namespace: namespaceSections,
  class: classSections,
  struct: classSections,
  union: classSections,
  concept: conceptSections,
  function: functionSections,
  variable: variableSections,
  typeAlias: typeAliasSections,
  enum: enumSections,
});

export function sectionsForRecord(record, context) {
  return SECTION_BUILDERS[record.kind](record, context);
}

export function overloadSetSections(overloads) {
  return [
    section(
      'overloads',
      'Overloads',
      <MemberTable members={overloads} label="Overloads" />,
      overloads.length,
    ),
  ];
}
