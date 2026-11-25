import { describe, expect, it } from 'vitest';
import { parseElement } from '../../../tests/helpers/symbol-builders.js';
import { createDocumentationDiagnostics } from './documentation.js';
import {
  classifyFunctionRole,
  normalizeCompound,
  normalizeMember,
  trailingSpecifiersOf,
} from './doxygen-symbols.js';

const APPLY_CONTEXT_OWNER = {
  id: 'classxrpl_1_1ApplyContext',
  kind: 'class',
  qualifiedName: 'xrpl::ApplyContext',
};

const APPLY_CONTEXT_VIEW = `<memberdef kind="function" id="classxrpl_1_1ApplyContext_1a9626b1e9fdf5183e0471dd93023c752d" prot="public" static="no" nodiscard="yes" const="yes" explicit="no" inline="yes" virt="non-virtual">
  <type><ref refid="classxrpl_1_1ApplyView" kindref="compound">ApplyView</ref> const &amp;</type>
  <definition>ApplyView const  &amp; xrpl::ApplyContext::view</definition>
  <argsstring>() const</argsstring>
  <name>view</name>
  <qualifiedname>xrpl::ApplyContext::view</qualifiedname>
  <briefdescription></briefdescription><detaileddescription></detaileddescription><inbodydescription></inbodydescription>
  <location file="include/xrpl/tx/ApplyContext.h" line="74" column="5" bodyfile="include/xrpl/tx/ApplyContext.h" bodystart="74" bodyend="77"/>
</memberdef>`;

const DELETED_COPY_CONSTRUCTOR = `<memberdef kind="function" id="classxrpl_1_1ApplyContext_1aCopy" prot="public" static="no" const="no" explicit="no" inline="no" virt="non-virtual">
  <type></type><definition>xrpl::ApplyContext::ApplyContext</definition><argsstring>(ApplyContext const &amp;)=delete</argsstring>
  <name>ApplyContext</name><qualifiedname>xrpl::ApplyContext::ApplyContext</qualifiedname>
  <param><type><ref refid="classxrpl_1_1ApplyContext" kindref="compound">ApplyContext</ref> const &amp;</type></param>
  <briefdescription></briefdescription><detaileddescription></detaileddescription>
  <location file="include/xrpl/tx/ApplyContext.h" line="58" column="5"/>
</memberdef>`;

const FRIEND_CLASS = `<memberdef kind="friend" id="classxrpl_1_1Example_1aFriend" prot="private" static="no" const="no" explicit="no" inline="no" virt="non-virtual">
  <type>class</type><definition>friend class SHAMap</definition><argsstring></argsstring><name>SHAMap</name>
  <qualifiedname>xrpl::SHAMap::ConstIterator::SHAMap</qualifiedname><param><type>SHAMap</type></param>
  <briefdescription></briefdescription><detaileddescription></detaileddescription>
  <location file="include/xrpl/shamap/SHAMap.h" line="1054" column="5"/>
</memberdef>`;

const STTX_COMPOUND = `<compounddef id="classxrpl_1_1STTx" kind="class" language="C++" prot="public" final="yes">
  <compoundname>xrpl::STTx</compoundname>
  <basecompoundref refid="classxrpl_1_1STObject" prot="public" virt="non-virtual">xrpl::STObject</basecompoundref>
  <basecompoundref refid="classxrpl_1_1CountedObject" prot="public" virt="non-virtual">xrpl::CountedObject&lt; STTx &gt;</basecompoundref>
  <briefdescription></briefdescription><detaileddescription></detaileddescription>
  <location file="include/xrpl/protocol/STTx.h" line="42" column="1" bodyfile="include/xrpl/protocol/STTx.h" bodystart="43" bodyend="222"/>
</compounddef>`;

function member(xml, owner = APPLY_CONTEXT_OWNER) {
  return normalizeMember(
    { memberDefinition: parseElement(xml, 'memberdef'), sectionKind: 'public-func' },
    owner,
    createDocumentationDiagnostics(),
  );
}

describe('doxygen symbol normalization', () => {
  it('normalizes a const nodiscard method with a linked return type', () => {
    const view = member(APPLY_CONTEXT_VIEW);
    expect(view).toMatchObject({
      kind: 'function',
      role: 'method',
      name: 'view',
      qualifiedName: 'xrpl::ApplyContext::view',
      access: 'public',
      returnType: [{ text: 'ApplyView', refId: 'classxrpl_1_1ApplyView' }, { text: ' const&' }],
      location: {
        declaration: { file: 'include/xrpl/tx/ApplyContext.h', line: 74 },
        definition: { file: 'include/xrpl/tx/ApplyContext.h', line: 74, endLine: 77 },
      },
    });
    expect(view.qualifiers).toMatchObject({
      isConst: true,
      isNodiscard: true,
      isInline: true,
      isDeleted: false,
    });
  });

  it('recognizes deleted constructors and unnamed parameters', () => {
    const constructor = member(DELETED_COPY_CONSTRUCTOR);
    expect(constructor.role).toBe('constructor');
    expect(constructor.qualifiers.isDeleted).toBe(true);
    expect(constructor.parameters).toEqual([
      expect.objectContaining({
        name: null,
        type: [{ text: 'ApplyContext', refId: 'classxrpl_1_1ApplyContext' }, { text: ' const&' }],
      }),
    ]);
  });

  it('separates friend class declarations from friend functions', () => {
    expect(member(FRIEND_CLASS).kind).toBe('friendClass');
  });

  it('normalizes compounds with inheritance and final', () => {
    const compound = normalizeCompound(
      parseElement(STTX_COMPOUND, 'compounddef'),
      createDocumentationDiagnostics(),
    );
    expect(compound).toMatchObject({
      kind: 'class',
      name: 'STTx',
      qualifiedName: 'xrpl::STTx',
      isFinal: true,
      baseClasses: [
        { name: 'xrpl::STObject', refId: 'classxrpl_1_1STObject', access: 'public', isVirtual: false },
        {
          name: 'xrpl::CountedObject< STTx >',
          refId: 'classxrpl_1_1CountedObject',
          access: 'public',
          isVirtual: false,
        },
      ],
    });
  });

  it.each([
    ['ApplyContext', 'function', 'class', 'xrpl::ApplyContext', 'constructor'],
    ['~ApplyContext', 'function', 'class', 'xrpl::ApplyContext', 'destructor'],
    ['CountedObject', 'function', 'class', 'xrpl::CountedObject< T >', 'constructor'],
    ['operator==', 'function', 'class', 'xrpl::Foo', 'operator'],
    ['operator bool', 'function', 'class', 'xrpl::Foo', 'conversion'],
    ['operator new', 'function', 'class', 'xrpl::Foo', 'operator'],
    ['operator<<', 'friend', 'class', 'xrpl::IOUAmount', 'friend'],
    ['view', 'function', 'class', 'xrpl::ApplyContext', 'method'],
    ['to_string', 'function', 'namespace', 'xrpl', 'function'],
  ])('classifies %s as %s', (name, memberKind, ownerKind, ownerName, expectedRole) => {
    expect(classifyFunctionRole({ name, memberKind, ownerKind, ownerName })).toBe(expectedRole);
  });

  it('reads trailing specifiers after the parameter list', () => {
    expect(trailingSpecifiersOf('(Keylet const &k) const =0')).toMatchObject({ isPureVirtual: true });
    expect(trailingSpecifiersOf('() const override')).toMatchObject({ isOverride: true, isFinal: false });
    expect(trailingSpecifiersOf('(int finalValue)')).toMatchObject({ isFinal: false });
    expect(trailingSpecifiersOf('()=default')).toMatchObject({ isDefaulted: true });
  });
});
