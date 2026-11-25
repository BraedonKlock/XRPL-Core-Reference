import {
  attributesOf,
  childrenOf,
  findChild,
  findChildren,
  isTextNode,
  tagNameOf,
  textOf,
} from '../parsing/xml-tree.js';

const SPECIAL_CHARACTERS = Object.freeze({
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  nonbreakablespace: ' ',
  hellip: '…',
  copy: '©',
  trade: '™',
  reg: '®',
  times: '×',
  rarr: '→',
  larr: '←',
});

const INLINE_STYLES = Object.freeze({ emphasis: 'emphasis', bold: 'strong', computeroutput: 'code' });
const TRANSPARENT_INLINE_TAGS = new Set([
  'superscript',
  'subscript',
  'small',
  'underline',
  's',
  'del',
  'ins',
  'strike',
  'center',
  'formula',
]);
const FLATTENED_BLOCK_TAGS = new Set(['itemizedlist', 'orderedlist', 'listitem', 'para']);
const IGNORED_TAGS = new Set([
  'anchor',
  'image',
  'htmlonly',
  'latexonly',
  'rtfonly',
  'manonly',
  'xmlonly',
  'docbookonly',
  'hruler',
  'simplesectsep',
  'indexentry',
]);
const LIST_TAGS = Object.freeze({ itemizedlist: false, orderedlist: true });
const CODE_BLOCK_TAGS = new Set(['programlisting', 'verbatim', 'preformatted']);
const SECTION_TAGS = new Set(['sect1', 'sect2', 'sect3', 'sect4', 'internal']);
const EXTRACTED_SECTION_TAGS = new Set(['parameterlist', 'simplesect', 'xrefsect']);

const SIMPLE_SECTION_NOTE_KINDS = Object.freeze({
  note: 'note',
  warning: 'warning',
  see: 'see',
  pre: 'precondition',
  post: 'postcondition',
  since: 'since',
  attention: 'attention',
  remark: 'remark',
  important: 'note',
  invariant: 'invariant',
  par: 'note',
});
const RETURN_SECTION_KINDS = new Set(['return', 'returns']);
const PARAMETER_DIRECTIONS = new Set(['in', 'out', 'inout']);
const URL_PATTERN = /^https?:\/\//;

export function createDocumentationDiagnostics() {
  return { unrecognizedElements: new Map(), droppedSections: new Map() };
}

function countInto(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function appendInline(content, inline) {
  const previous = content.at(-1);
  if (inline.type === 'text' && previous?.type === 'text') {
    previous.text += inline.text;
    return;
  }
  content.push(inline);
}

function collapseWhitespace(text) {
  return text.replace(/\s+/g, ' ');
}

export function finalizeInlineContent(content) {
  const collapsed = content
    .map((inline) => ({ ...inline, text: collapseWhitespace(inline.text) }))
    .filter((inline) => inline.text.length > 0);
  if (collapsed.length === 0) {
    return null;
  }
  const first = collapsed[0];
  const last = collapsed.at(-1);
  first.text = first.text.trimStart();
  last.text = last.text.trimEnd();
  const trimmed = collapsed.filter((inline) => inline.text.length > 0);
  return trimmed.length > 0 ? trimmed : null;
}

function codeTextOf(node) {
  if (isTextNode(node)) {
    return textOf(node);
  }
  const tag = tagNameOf(node);
  if (tag === 'sp') {
    return ' ';
  }
  if (tag === 'codeline') {
    return `${childrenOf(node).map(codeTextOf).join('')}\n`;
  }
  return childrenOf(node).map(codeTextOf).join('');
}

function createCodeBlock(node) {
  const text = codeTextOf(node).replace(/\n+$/, '').replace(/^\n+/, '');
  return text.trim().length > 0 ? { type: 'code', text } : null;
}

function urlInline(node) {
  const href = attributesOf(node).url ?? '';
  const text = collapseWhitespace(textOf(node)).trim() || href;
  return URL_PATTERN.test(href) && URL.canParse(href) ? { type: 'url', text, href } : { type: 'text', text };
}

function collectInline(node, content, diagnostics) {
  if (isTextNode(node)) {
    appendInline(content, { type: 'text', text: textOf(node) });
    return;
  }
  const tag = tagNameOf(node);
  if (tag in SPECIAL_CHARACTERS) {
    appendInline(content, { type: 'text', text: SPECIAL_CHARACTERS[tag] });
  } else if (tag === 'ref') {
    content.push({ type: 'link', text: textOf(node), refId: attributesOf(node).refid });
  } else if (tag in INLINE_STYLES) {
    content.push({ type: INLINE_STYLES[tag], text: textOf(node) });
  } else if (tag === 'ulink') {
    appendInline(content, urlInline(node));
  } else if (tag === 'linebreak' || tag === 'sp') {
    appendInline(content, { type: 'text', text: ' ' });
  } else if (IGNORED_TAGS.has(tag) || EXTRACTED_SECTION_TAGS.has(tag)) {
    return;
  } else if (FLATTENED_BLOCK_TAGS.has(tag)) {
    appendInline(content, { type: 'text', text: ' ' });
    childrenOf(node).forEach((child) => collectInline(child, content, diagnostics));
    appendInline(content, { type: 'text', text: ' ' });
  } else {
    if (!TRANSPARENT_INLINE_TAGS.has(tag)) {
      countInto(diagnostics.unrecognizedElements, tag);
    }
    childrenOf(node).forEach((child) => collectInline(child, content, diagnostics));
  }
}

function inlineContentOf(node, diagnostics) {
  const content = [];
  childrenOf(node).forEach((child) => collectInline(child, content, diagnostics));
  return finalizeInlineContent(content);
}

function flattenedInlineContentOf(nodes, diagnostics) {
  const content = [];
  nodes.forEach((node, position) => {
    if (position > 0) {
      appendInline(content, { type: 'text', text: ' ' });
    }
    childrenOf(node).forEach((child) => collectInline(child, content, diagnostics));
  });
  return finalizeInlineContent(content);
}

function createListBlock(node, ordered, diagnostics) {
  const items = findChildren(node, 'listitem')
    .map((item) => flattenedInlineContentOf(findChildren(item, 'para'), diagnostics))
    .filter(Boolean);
  return items.length > 0 ? { type: 'list', ordered, items } : null;
}

function blockOfBlockElement(node, diagnostics) {
  const tag = tagNameOf(node);
  if (tag in LIST_TAGS) {
    return createListBlock(node, LIST_TAGS[tag], diagnostics);
  }
  if (CODE_BLOCK_TAGS.has(tag)) {
    return createCodeBlock(node);
  }
  return undefined;
}

function isBlockElement(node) {
  const tag = tagNameOf(node);
  return (
    tag in LIST_TAGS ||
    CODE_BLOCK_TAGS.has(tag) ||
    tag === 'table' ||
    tag === 'blockquote' ||
    tag === 'heading'
  );
}

function blocksOfParagraph(paragraph, diagnostics) {
  const blocks = [];
  let buffer = [];
  const flush = () => {
    const content = finalizeInlineContent(buffer);
    if (content) {
      blocks.push({ type: 'paragraph', content });
    }
    buffer = [];
  };
  for (const child of childrenOf(paragraph)) {
    if (isTextNode(child) || !isBlockElement(child)) {
      collectInline(child, buffer, diagnostics);
      continue;
    }
    flush();
    blocks.push(...blocksOfStructuralElement(child, diagnostics));
  }
  flush();
  return blocks;
}

function blocksOfTable(table, diagnostics) {
  return findChildren(table, 'row')
    .map((row) =>
      flattenedInlineContentOf(
        findChildren(row, 'entry').flatMap((entry) => findChildren(entry, 'para')),
        diagnostics,
      ),
    )
    .filter(Boolean)
    .map((content) => ({ type: 'paragraph', content }));
}

function blocksOfStructuralElement(node, diagnostics) {
  const tag = tagNameOf(node);
  const block = blockOfBlockElement(node, diagnostics);
  if (block !== undefined) {
    return block ? [block] : [];
  }
  if (tag === 'table') {
    return blocksOfTable(node, diagnostics);
  }
  if (tag === 'heading') {
    const content = inlineContentOf(node, diagnostics);
    return content
      ? [
          {
            type: 'paragraph',
            content: [{ type: 'strong', text: content.map((inline) => inline.text).join('') }],
          },
        ]
      : [];
  }
  if (tag === 'blockquote') {
    return blocksOf(node, diagnostics);
  }
  countInto(diagnostics.unrecognizedElements, tag);
  return [];
}

function blocksOfSection(section, diagnostics) {
  const title = collapseWhitespace(textOf(findChild(section, 'title'))).trim();
  const heading = title ? [{ type: 'paragraph', content: [{ type: 'strong', text: title }] }] : [];
  return [...heading, ...blocksOf(section, diagnostics)];
}

export function blocksOf(container, diagnostics) {
  return childrenOf(container).flatMap((child) => {
    if (isTextNode(child)) {
      return [];
    }
    const tag = tagNameOf(child);
    if (tag === 'para') {
      return blocksOfParagraph(child, diagnostics);
    }
    if (SECTION_TAGS.has(tag)) {
      return blocksOfSection(child, diagnostics);
    }
    if (tag === 'title') {
      return [];
    }
    return blocksOfStructuralElement(child, diagnostics);
  });
}

function descendantsOutsideNestedLists(node, tagName, results = []) {
  for (const child of childrenOf(node)) {
    if (tagNameOf(child) === tagName) {
      results.push(child);
    } else {
      descendantsOutsideNestedLists(child, tagName, results);
    }
  }
  return results;
}

function parameterItemsOf(detailedNode, kind) {
  return descendantsOutsideNestedLists(detailedNode, 'parameterlist')
    .filter((list) => attributesOf(list).kind === kind)
    .flatMap((list) => findChildren(list, 'parameteritem'));
}

function parameterNamesOf(item) {
  return findChildren(findChild(item, 'parameternamelist'), 'parametername').map((nameNode) => ({
    name: collapseWhitespace(textOf(nameNode)).trim(),
    direction: PARAMETER_DIRECTIONS.has(attributesOf(nameNode).direction)
      ? attributesOf(nameNode).direction
      : null,
  }));
}

function parameterDescriptionMap(detailedNode, kind, diagnostics) {
  const descriptions = new Map();
  for (const item of parameterItemsOf(detailedNode, kind)) {
    const content = flattenedInlineContentOf(
      findChildren(findChild(item, 'parameterdescription'), 'para'),
      diagnostics,
    );
    for (const { name, direction } of parameterNamesOf(item)) {
      if (name) {
        descriptions.set(name, { content, direction });
      }
    }
  }
  return descriptions;
}

function namedItemNotes(detailedNode, listKind, noteKind, diagnostics) {
  return parameterItemsOf(detailedNode, listKind).flatMap((item) => {
    const description = flattenedInlineContentOf(
      findChildren(findChild(item, 'parameterdescription'), 'para'),
      diagnostics,
    );
    return parameterNamesOf(item)
      .filter(({ name }) => name)
      .map(({ name }) => ({
        kind: noteKind,
        content: [
          { type: 'code', text: name },
          ...(description ? [{ type: 'text', text: ' ' }, ...description] : []),
        ],
      }));
  });
}

function simpleSectionNotes(sections, diagnostics) {
  const notes = [];
  for (const section of sections) {
    const sectionKind = attributesOf(section).kind;
    const noteKind = SIMPLE_SECTION_NOTE_KINDS[sectionKind];
    if (RETURN_SECTION_KINDS.has(sectionKind)) {
      continue;
    }
    if (!noteKind) {
      countInto(diagnostics.droppedSections, `simplesect:${sectionKind}`);
      continue;
    }
    const title = collapseWhitespace(textOf(findChild(section, 'title'))).trim();
    const body = flattenedInlineContentOf(findChildren(section, 'para'), diagnostics);
    const content = title
      ? [{ type: 'strong', text: title }, ...(body ? [{ type: 'text', text: ' ' }, ...body] : [])]
      : body;
    if (content) {
      notes.push({ kind: noteKind, content });
    }
  }
  return notes;
}

function deprecationNotes(detailedNode, diagnostics) {
  return descendantsOutsideNestedLists(detailedNode, 'xrefsect').flatMap((section) => {
    const title = collapseWhitespace(textOf(findChild(section, 'xreftitle')))
      .trim()
      .toLowerCase();
    if (title !== 'deprecated') {
      countInto(diagnostics.droppedSections, `xrefsect:${title}`);
      return [];
    }
    const content = flattenedInlineContentOf(
      findChildren(findChild(section, 'xrefdescription'), 'para'),
      diagnostics,
    );
    return content ? [{ kind: 'deprecated', content }] : [];
  });
}

export function parseDocumentation(element, diagnostics) {
  const briefNode = findChild(element, 'briefdescription');
  const detailedNode = findChild(element, 'detaileddescription');
  const sections = descendantsOutsideNestedLists(detailedNode, 'simplesect');
  const returnSections = sections.filter((section) => RETURN_SECTION_KINDS.has(attributesOf(section).kind));
  const briefBlocks = briefNode ? blocksOf(briefNode, diagnostics) : [];
  const brief = finalizeInlineContent(
    briefBlocks.flatMap((block, position) => [
      ...(position > 0 ? [{ type: 'text', text: ' ' }] : []),
      ...(block.type === 'paragraph' ? block.content : []),
    ]),
  );
  return {
    brief,
    description: detailedNode ? blocksOf(detailedNode, diagnostics) : [],
    returns: flattenedInlineContentOf(
      returnSections.flatMap((section) => findChildren(section, 'para')),
      diagnostics,
    ),
    notes: [
      ...simpleSectionNotes(sections, diagnostics),
      ...deprecationNotes(detailedNode, diagnostics),
      ...namedItemNotes(detailedNode, 'exception', 'throws', diagnostics),
      ...namedItemNotes(detailedNode, 'retval', 'retval', diagnostics),
    ],
    parameterDescriptions: parameterDescriptionMap(detailedNode, 'param', diagnostics),
    templateParameterDescriptions: parameterDescriptionMap(detailedNode, 'templateparam', diagnostics),
  };
}

export function hasDocumentationContent(documentation) {
  return Boolean(
    documentation.brief ||
    documentation.description.length > 0 ||
    documentation.returns ||
    documentation.notes.length > 0 ||
    [...documentation.parameterDescriptions.values()].some((entry) => entry.content),
  );
}

export function emptyDocumentation() {
  return {
    brief: null,
    description: [],
    returns: null,
    notes: [],
    parameterDescriptions: new Map(),
    templateParameterDescriptions: new Map(),
  };
}
