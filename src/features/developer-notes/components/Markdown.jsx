import { Link } from 'react-router';
import { parseMarkdown } from '../../../../contract/markdown.js';
import { symbolUrl } from '../../../config/routes.js';
import { CppCode } from './CppCode.jsx';

const HIGHLIGHTED_LANGUAGES = new Set(['cpp', 'c++']);

function InlineNodes({ nodes, resolveReference }) {
  return nodes.map((node, position) => (
    <InlineNode key={position} node={node} resolveReference={resolveReference} />
  ));
}

function InlineNode({ node, resolveReference }) {
  if (node.type === 'text') {
    return node.text;
  }
  if (node.type === 'code') {
    return <code>{node.text}</code>;
  }
  const children = <InlineNodes nodes={node.children} resolveReference={resolveReference} />;
  if (node.type === 'strong') {
    return <strong>{children}</strong>;
  }
  if (node.type === 'emphasis') {
    return <em>{children}</em>;
  }
  if (node.target.kind === 'external') {
    return (
      <a href={node.target.href} rel="noreferrer">
        {children}
      </a>
    );
  }
  const path = node.target.kind === 'symbol' ? resolveReference(node.target.symbol) : null;
  return path ? <Link to={symbolUrl(path)}>{children}</Link> : <span>{children}</span>;
}

function MarkdownBlock({ block, resolveReference }) {
  if (block.type === 'code') {
    return <CppCode code={block.text} highlighted={HIGHLIGHTED_LANGUAGES.has(block.language ?? 'cpp')} />;
  }
  if (block.type === 'list') {
    const List = block.ordered ? 'ol' : 'ul';
    return (
      <List start={block.ordered && block.start !== 1 ? block.start : undefined}>
        {block.items.map((item, position) => (
          <li key={position}>
            <InlineNodes nodes={item} resolveReference={resolveReference} />
          </li>
        ))}
      </List>
    );
  }
  return (
    <p>
      <InlineNodes nodes={block.content} resolveReference={resolveReference} />
    </p>
  );
}

export function Markdown({ source, resolveReference }) {
  return parseMarkdown(source).map((block, position) => (
    <MarkdownBlock key={position} block={block} resolveReference={resolveReference} />
  ));
}
