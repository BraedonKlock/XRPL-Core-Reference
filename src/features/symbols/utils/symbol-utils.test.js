import { describe, expect, it } from 'vitest';
import { functionRecord, variableRecord } from '../../../../tests/helpers/public-records.js';
import { breadcrumbItemsFor } from './breadcrumbs.js';
import { withoutLeadingAssignment } from './expression-utils.js';
import { ancestorPathsOf, baseTreeOf, indexInheritance } from './inheritance.js';
import { groupClassMembers, groupNamespaceMembers, inheritableMembers } from './member-groups.js';
import { memberSignatureText, memberTagsOf } from './member-signature.js';

function method(name, overrides = {}) {
  return functionRecord(`xrpl/X/${name}`, '00000000', {
    name,
    role: 'method',
    access: 'public',
    ...overrides,
  });
}

function withQualifiers(record, qualifiers) {
  return { ...record, qualifiers: { ...record.qualifiers, ...qualifiers } };
}

describe('member signatures', () => {
  it('renders parameter types and qualifiers compactly', () => {
    const view = withQualifiers(
      method('view', {
        parameters: [
          {
            name: 'k',
            type: [{ text: 'Keylet const&' }],
            array: null,
            defaultValue: null,
            description: null,
            direction: null,
          },
        ],
      }),
      { isConst: true },
    );
    expect(memberSignatureText(view)).toBe('view(Keylet const&) const');
    expect(memberSignatureText(variableRecord('xrpl/X/tx'))).toBe('tx');
  });

  it('lists meaningful tags', () => {
    expect(
      memberTagsOf(withQualifiers(method('read'), { isPureVirtual: true, virtuality: 'pure-virtual' })),
    ).toEqual(['pure virtual']);
    expect(
      memberTagsOf(withQualifiers(method('apply'), { virtuality: 'virtual', isOverride: true })),
    ).toEqual(['override']);
    expect(memberTagsOf(withQualifiers(method('make'), { isStatic: true, isDeleted: true }))).toEqual([
      'static',
      'deleted',
    ]);
  });
});

describe('member groups', () => {
  const members = [
    method('X', { role: 'constructor' }),
    method('view'),
    withQualifiers(method('create'), { isStatic: true }),
    method('operator==', { role: 'operator' }),
    method('operator<<', { role: 'friend' }),
    variableRecord('xrpl/X/tx', { access: 'public' }),
    method('helper', { access: 'protected' }),
    variableRecord('xrpl/X/state_', { access: 'private' }),
  ];

  it('groups public members by role and keeps non-public members separate', () => {
    expect(
      groupClassMembers(members).map((group) => [
        group.id,
        group.members.map((record) => record.name),
        group.collapsed,
      ]),
    ).toEqual([
      ['constructors', ['X'], false],
      ['methods', ['view'], false],
      ['static-methods', ['create'], false],
      ['operators', ['operator=='], false],
      ['fields', ['tx'], false],
      ['friends', ['operator<<'], false],
      ['protected-members', ['helper'], false],
      ['private-members', ['state_'], true],
    ]);
  });

  it('keeps only inheritable members', () => {
    expect(
      inheritableMembers([...members, method('operator=', { role: 'operator' })]).map(
        (record) => record.name,
      ),
    ).toEqual(['view', 'create', 'operator==', 'tx', 'helper']);
  });

  it('groups namespace members alphabetically', () => {
    const groups = groupNamespaceMembers([
      { name: 'to_string', kind: 'function' },
      { name: 'isXRP', kind: 'function' },
      { name: 'kParityRate', kind: 'variable' },
      { name: 'STTx', kind: 'class' },
    ]);
    expect(groups.map((group) => [group.id, group.entries.map((entry) => entry.name)])).toEqual([
      ['functions', ['isXRP', 'to_string']],
      ['variables', ['kParityRate']],
    ]);
  });
});

describe('inheritance', () => {
  const index = indexInheritance({
    inheritance: [
      {
        derived: 'xrpl/STTx',
        base: 'xrpl/STObject',
        baseName: 'xrpl::STObject',
        access: 'public',
        isVirtual: false,
      },
      {
        derived: 'xrpl/STTx',
        base: null,
        baseName: 'std::enable_shared_from_this',
        access: 'public',
        isVirtual: false,
      },
      {
        derived: 'xrpl/STObject',
        base: 'xrpl/STBase',
        baseName: 'xrpl::STBase',
        access: 'public',
        isVirtual: false,
      },
      { derived: 'xrpl/A', base: 'xrpl/B', baseName: 'B', access: 'public', isVirtual: false },
      { derived: 'xrpl/B', base: 'xrpl/A', baseName: 'A', access: 'public', isVirtual: false },
    ],
  });

  it('builds the base-class tree and its ancestors', () => {
    const tree = baseTreeOf('xrpl/STTx', index);
    expect(tree.map((node) => [node.path, node.bases.map((base) => base.path)])).toEqual([
      ['xrpl/STObject', ['xrpl/STBase']],
      [null, []],
    ]);
    expect(ancestorPathsOf(tree)).toEqual(['xrpl/STObject', 'xrpl/STBase']);
  });

  it('stops at cycles', () => {
    expect(ancestorPathsOf(baseTreeOf('xrpl/A', index))).toEqual(['xrpl/B', 'xrpl/A']);
  });
});

describe('page helpers', () => {
  it('labels overload breadcrumbs distinctly', () => {
    const directory = {
      get: (path) =>
        ({
          xrpl: { path: 'xrpl', name: 'xrpl' },
          'xrpl/ApplyContext': { path: 'xrpl/ApplyContext', name: 'ApplyContext' },
          'xrpl/ApplyContext/view': { path: 'xrpl/ApplyContext/view', name: 'view' },
        })[path] ?? null,
      resolve: () => ({ entry: { name: 'view' }, overloadPath: 'xrpl/ApplyContext/view/8ca9df3f' }),
    };
    expect(
      breadcrumbItemsFor('xrpl/ApplyContext/view/8ca9df3f', directory).map((item) => item.label),
    ).toEqual(['Overview', 'xrpl', 'ApplyContext', 'view', 'view(…)']);
  });

  it('strips a leading assignment from initializers', () => {
    expect(withoutLeadingAssignment([{ text: '= 0x0061' }])).toEqual([{ text: '0x0061' }]);
    expect(
      withoutLeadingAssignment([
        { text: '= ' },
        { text: 'kMax', target: { path: 'x', resolution: 'doxygen' } },
      ]),
    ).toEqual([{ text: 'kMax', target: { path: 'x', resolution: 'doxygen' } }]);
    expect(withoutLeadingAssignment([{ text: '("Account")' }])).toEqual([{ text: '("Account")' }]);
  });
});
