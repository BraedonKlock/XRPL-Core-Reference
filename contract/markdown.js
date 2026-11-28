const FENCE_OPEN = /^```\s*([A-Za-z0-9+#-]*)\s*$/;
const FENCE_CLOSE = /^```\s*$/;
const BULLET_ITEM = /^[-*]\s+(.*)$/;
const ORDERED_ITEM = /^(\d{1,9})[.)]\s+(.*)$/;
const CONTINUATION = /^\s+\S/;
const ESCAPABLE = new Set(['\\', '`', '*', '_', '[', ']', '(', ')', '#', '-', '!']);
const SYMBOL_SCHEME = 'symbol:';
const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:']);

export function classifyLinkDestination(destination) {
  if (destination.startsWith(SYMBOL_SCHEME)) {
    const symbol = destination.slice(SYMBOL_SCHEME.length).trim();
    return symbol ? { kind: 'symbol', symbol } : { kind: 'invalid' };
  }
  try {
    const url = new URL(destination);
    return EXTERNAL_PROTOCOLS.has(url.protocol) ? { kind: 'external', href: url.href } : { kind: 'invalid' };
  } catch {
    return { kind: 'invalid' };
  }
}

function backtickRunLength(text, position) {
  let end = position;
  while (text[end] === '`') {
    end += 1;
  }
  return end - position;
}

function findClosingBackticks(text, from, length) {
  let position = text.indexOf('`'.repeat(length), from);
  while (position !== -1) {
    if (backtickRunLength(text, position) === length) {
      return position;
    }
    position = text.indexOf('`'.repeat(length), position + backtickRunLength(text, position));
  }
  return -1;
}

function codeSpanText(raw) {
  const text = raw.replace(/\n/g, ' ');
  return text.length > 2 && text.startsWith(' ') && text.endsWith(' ') ? text.slice(1, -1) : text;
}

function findClosingBracket(text, start) {
  let depth = 0;
  for (let position = start; position < text.length; position += 1) {
    const character = text[position];
    if (character === '\\') {
      position += 1;
    } else if (character === '`') {
      const length = backtickRunLength(text, position);
      const close = findClosingBackticks(text, position + length, length);
      position = close === -1 ? position + length - 1 : close + length - 1;
    } else if (character === '[') {
      depth += 1;
    } else if (character === ']') {
      depth -= 1;
      if (depth === 0) {
        return position;
      }
    }
  }
  return -1;
}

function findClosingParenthesis(text, start) {
  let depth = 0;
  for (let position = start; position < text.length; position += 1) {
    if (text[position] === '(') {
      depth += 1;
    } else if (text[position] === ')') {
      depth -= 1;
      if (depth === 0) {
        return position;
      }
    }
  }
  return -1;
}

function parseLink(text, start) {
  const labelEnd = findClosingBracket(text, start);
  if (labelEnd === -1 || text[labelEnd + 1] !== '(') {
    return null;
  }
  const destinationEnd = findClosingParenthesis(text, labelEnd + 1);
  if (destinationEnd === -1) {
    return null;
  }
  const destination = text.slice(labelEnd + 2, destinationEnd).trim();
  return {
    end: destinationEnd + 1,
    node: {
      type: 'link',
      destination,
      target: classifyLinkDestination(destination),
      children: parseInlineContent(text.slice(start + 1, labelEnd), false),
    },
  };
}

function parseEmphasis(text, start, allowLinks) {
  const marker = text.startsWith('**', start) ? '**' : '*';
  const contentStart = start + marker.length;
  const close = text.indexOf(marker, contentStart);
  if (close <= contentStart || /\s/.test(text[contentStart]) || /\s/.test(text[close - 1])) {
    return null;
  }
  return {
    end: close + marker.length,
    node: {
      type: marker === '**' ? 'strong' : 'emphasis',
      children: parseInlineContent(text.slice(contentStart, close), allowLinks),
    },
  };
}

function parseInlineContent(text, allowLinks) {
  const nodes = [];
  let buffer = '';
  const flushText = () => {
    if (buffer) {
      nodes.push({ type: 'text', text: buffer });
      buffer = '';
    }
  };
  let position = 0;
  while (position < text.length) {
    const character = text[position];
    if (character === '\\' && ESCAPABLE.has(text[position + 1])) {
      buffer += text[position + 1];
      position += 2;
      continue;
    }
    if (character === '`') {
      const length = backtickRunLength(text, position);
      const close = findClosingBackticks(text, position + length, length);
      if (close === -1) {
        buffer += '`'.repeat(length);
        position += length;
        continue;
      }
      flushText();
      nodes.push({ type: 'code', text: codeSpanText(text.slice(position + length, close)) });
      position = close + length;
      continue;
    }
    const parsed =
      character === '*'
        ? parseEmphasis(text, position, allowLinks)
        : character === '[' && allowLinks
          ? parseLink(text, position)
          : null;
    if (parsed) {
      flushText();
      nodes.push(parsed.node);
      position = parsed.end;
      continue;
    }
    buffer += character;
    position += 1;
  }
  flushText();
  return nodes;
}

export function parseInlineMarkdown(text) {
  return parseInlineContent(text, true);
}

export function parseMarkdown(source) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let list = null;
  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', content: parseInlineMarkdown(paragraph.join(' ')) });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({
        type: 'list',
        ordered: list.ordered,
        start: list.start,
        items: list.items.map((item) => parseInlineMarkdown(item.join(' '))),
      });
      list = null;
    }
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = FENCE_OPEN.exec(line.trim());
    if (fence) {
      flushParagraph();
      flushList();
      const code = [];
      index += 1;
      while (index < lines.length && !FENCE_CLOSE.test(lines[index].trim())) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: 'code', language: fence[1] || null, text: code.join('\n') });
      continue;
    }
    if (line.trim() === '') {
      flushParagraph();
      flushList();
      continue;
    }
    const bullet = BULLET_ITEM.exec(line);
    const ordered = ORDERED_ITEM.exec(line);
    if (bullet || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (list && list.ordered !== isOrdered) {
        flushList();
      }
      list ??= { ordered: isOrdered, start: ordered ? Number(ordered[1]) : 1, items: [] };
      list.items.push([(bullet ? bullet[1] : ordered[2]).trim()]);
      continue;
    }
    if (list && CONTINUATION.test(line)) {
      list.items.at(-1).push(line.trim());
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return blocks;
}

function collectInlineLinks(nodes, links) {
  for (const node of nodes) {
    if (node.type === 'link') {
      links.push(node);
    }
    if (node.children) {
      collectInlineLinks(node.children, links);
    }
  }
  return links;
}

export function linksInMarkdown(source) {
  const links = [];
  for (const block of parseMarkdown(source)) {
    if (block.type === 'paragraph') {
      collectInlineLinks(block.content, links);
    } else if (block.type === 'list') {
      block.items.forEach((item) => collectInlineLinks(item, links));
    }
  }
  return links;
}
