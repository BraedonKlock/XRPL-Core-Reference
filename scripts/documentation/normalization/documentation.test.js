import { describe, expect, it } from 'vitest';
import { parseElement } from '../../../tests/helpers/symbol-builders.js';
import {
  createDocumentationDiagnostics,
  hasDocumentationContent,
  parseDocumentation,
} from './documentation.js';

function documentationOf(innerXml) {
  return parseDocumentation(
    parseElement(`<memberdef>${innerXml}</memberdef>`, 'memberdef'),
    createDocumentationDiagnostics(),
  );
}

describe('documentation parsing', () => {
  it('extracts brief text with inline code and links', () => {
    const documentation = documentationOf(
      '<briefdescription><para>Returns the <computeroutput>SLE</computeroutput> for <ref refid="classxrpl_1_1Keylet">Keylet</ref>. </para></briefdescription><detaileddescription></detaileddescription>',
    );
    expect(documentation.brief).toEqual([
      { type: 'text', text: 'Returns the ' },
      { type: 'code', text: 'SLE' },
      { type: 'text', text: ' for ' },
      { type: 'link', text: 'Keylet', refId: 'classxrpl_1_1Keylet' },
      { type: 'text', text: '.' },
    ]);
  });

  it('separates parameter, return and note sections from the description', () => {
    const documentation = documentationOf(`
      <briefdescription><para>Take a snapshot of the given map.</para></briefdescription>
      <detaileddescription>
        <para>Snapshots share nodes.</para>
        <para>
          <parameterlist kind="param">
            <parameteritem><parameternamelist><parametername direction="in">other</parametername></parameternamelist>
              <parameterdescription><para>The map to snapshot.</para></parameterdescription></parameteritem>
          </parameterlist>
          <simplesect kind="return"><para>nullptr if the key is not present.</para></simplesect>
          <simplesect kind="warning"><para>Called under lock.</para></simplesect>
          <simplesect kind="par"><title>Thread Safety</title><para>Not thread safe.</para></simplesect>
          <parameterlist kind="exception">
            <parameteritem><parameternamelist><parametername>std::runtime_error</parametername></parameternamelist>
              <parameterdescription><para>on failure</para></parameterdescription></parameteritem>
          </parameterlist>
        </para>
      </detaileddescription>`);
    expect(documentation.description).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Snapshots share nodes.' }] },
    ]);
    expect(documentation.parameterDescriptions.get('other')).toEqual({
      content: [{ type: 'text', text: 'The map to snapshot.' }],
      direction: 'in',
    });
    expect(documentation.returns).toEqual([{ type: 'text', text: 'nullptr if the key is not present.' }]);
    expect(documentation.notes.map((note) => note.kind)).toEqual(['warning', 'note', 'throws']);
    expect(documentation.notes[1].content[0]).toEqual({ type: 'strong', text: 'Thread Safety' });
    expect(documentation.notes[2].content[0]).toEqual({ type: 'code', text: 'std::runtime_error' });
  });

  it('turns lists and code listings into blocks', () => {
    const documentation = documentationOf(`
      <briefdescription></briefdescription>
      <detaileddescription><para>Steps:<itemizedlist><listitem><para>first</para></listitem><listitem><para>second</para></listitem></itemizedlist></para>
      <para><programlisting><codeline><highlight class="normal">auto<sp/>x<sp/>=<sp/>1;</highlight></codeline><codeline><highlight class="normal">return<sp/>x;</highlight></codeline></programlisting></para></detaileddescription>`);
    expect(documentation.description).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Steps:' }] },
      {
        type: 'list',
        ordered: false,
        items: [[{ type: 'text', text: 'first' }], [{ type: 'text', text: 'second' }]],
      },
      { type: 'code', text: 'auto x = 1;\nreturn x;' },
    ]);
  });

  it('keeps only http(s) URLs as url inlines and maps special characters', () => {
    const documentation = documentationOf(
      '<briefdescription><para>See <ulink url="https://xrpl.org">docs</ulink><ndash/>and <ulink url="javascript:alert(1)">this</ulink></para></briefdescription><detaileddescription/>',
    );
    expect(documentation.brief).toEqual([
      { type: 'text', text: 'See ' },
      { type: 'url', text: 'docs', href: 'https://xrpl.org' },
      { type: 'text', text: '–and this' },
    ]);
  });

  it('reports absent documentation', () => {
    const documentation = documentationOf(
      '<briefdescription>\n</briefdescription><detaileddescription>\n</detaileddescription>',
    );
    expect(hasDocumentationContent(documentation)).toBe(false);
  });
});
