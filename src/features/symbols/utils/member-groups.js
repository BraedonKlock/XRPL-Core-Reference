const PUBLIC_GROUPS = Object.freeze([
  {
    id: 'constructors',
    title: 'Constructors and destructor',
    matches: (record) => ['constructor', 'destructor'].includes(record.role),
  },
  {
    id: 'methods',
    title: 'Methods',
    matches: (record) => record.role === 'method' && !record.qualifiers.isStatic,
  },
  {
    id: 'static-methods',
    title: 'Static methods',
    matches: (record) => record.role === 'method' && record.qualifiers.isStatic,
  },
  {
    id: 'operators',
    title: 'Operators',
    matches: (record) => ['operator', 'conversion'].includes(record.role),
  },
  { id: 'fields', title: 'Fields', matches: (record) => record.kind === 'variable' },
  { id: 'type-aliases', title: 'Type aliases', matches: (record) => record.kind === 'typeAlias' },
  { id: 'enums', title: 'Enums', matches: (record) => record.kind === 'enum' },
]);

const FRIEND_GROUP = Object.freeze({ id: 'friends', title: 'Friend functions' });
const NON_PUBLIC_GROUPS = Object.freeze([
  { id: 'protected-members', title: 'Protected members', access: 'protected', collapsed: false },
  { id: 'private-members', title: 'Private members', access: 'private', collapsed: true },
]);

export function groupClassMembers(members) {
  const friends = members.filter((record) => record.role === 'friend');
  const others = members.filter((record) => record.role !== 'friend');
  const publicMembers = others.filter((record) => record.access === 'public' || record.access === null);
  const groups = PUBLIC_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    collapsed: false,
    showsKind: false,
    members: publicMembers.filter(group.matches),
  }));
  groups.push({ ...FRIEND_GROUP, collapsed: false, showsKind: false, members: friends });
  for (const group of NON_PUBLIC_GROUPS) {
    groups.push({
      id: group.id,
      title: group.title,
      collapsed: group.collapsed,
      showsKind: true,
      members: others.filter((record) => record.access === group.access),
    });
  }
  return groups.filter((group) => group.members.length > 0);
}

const NAMESPACE_GROUPS = Object.freeze([
  { id: 'functions', title: 'Functions', kinds: new Set(['function']) },
  { id: 'variables', title: 'Variables and constants', kinds: new Set(['variable']) },
  { id: 'type-aliases', title: 'Type aliases', kinds: new Set(['typeAlias']) },
  { id: 'enums', title: 'Enums', kinds: new Set(['enum']) },
]);

export function groupNamespaceMembers(entries) {
  return NAMESPACE_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    entries: entries
      .filter((entry) => group.kinds.has(entry.kind))
      .sort((left, right) => left.name.localeCompare(right.name)),
  })).filter((group) => group.entries.length > 0);
}

const INHERITABLE_EXCLUDED_ROLES = new Set(['constructor', 'destructor', 'friend']);

export function inheritableMembers(members) {
  return members.filter(
    (record) =>
      (record.access === 'public' || record.access === 'protected') &&
      !INHERITABLE_EXCLUDED_ROLES.has(record.role) &&
      !(record.role === 'operator' && record.name === 'operator='),
  );
}
