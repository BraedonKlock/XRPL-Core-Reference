import { hasDocumentationContent } from './documentation.js';

const LINES_SCANNED_ABOVE_DECLARATION = 8;
const DOCUMENTATION_COMMENT_START = /^\s*(\/\*\*|\/\*!|\/\/\/|\/\/!)/;
const TRAILING_DOCUMENTATION_COMMENT = /(\/\/\/<|\/\/!<|\/\*\*<|\/\*!<)/;
const DECLARATION_BOUNDARY = /[;{}]\s*$|^\s*(public|protected|private)\s*:\s*$/;

function hasAdjacentDocumentationComment(position, sourceFiles) {
  if (!position?.line || !sourceFiles.exists(position.file)) {
    return false;
  }
  if (TRAILING_DOCUMENTATION_COMMENT.test(sourceFiles.lineAt(position.file, position.line) ?? '')) {
    return true;
  }
  const lowestLine = Math.max(1, position.line - LINES_SCANNED_ABOVE_DECLARATION);
  for (let line = position.line - 1; line >= lowestLine; line -= 1) {
    const text = (sourceFiles.lineAt(position.file, line) ?? '').trim();
    if (text === '') {
      continue;
    }
    if (text.endsWith('*/')) {
      for (let start = line; start >= 1; start -= 1) {
        const commentLine = sourceFiles.lineAt(position.file, start) ?? '';
        if (commentLine.includes('/*')) {
          return DOCUMENTATION_COMMENT_START.test(commentLine);
        }
      }
      return false;
    }
    if (text.startsWith('//')) {
      return DOCUMENTATION_COMMENT_START.test(text);
    }
    if (DECLARATION_BOUNDARY.test(text)) {
      return false;
    }
  }
  return false;
}

function writesOwnDocumentation(symbol, sourceFiles) {
  const location = symbol.location;
  return [location?.declaration, location?.definition].some((position) =>
    hasAdjacentDocumentationComment(position, sourceFiles),
  );
}

function contentKeyOf(documentation) {
  const { brief, description, returns, notes } = documentation;
  return JSON.stringify({ brief, description, returns, notes });
}

function originOf(symbol, symbolsById, key, visited) {
  for (const refId of symbol.reimplementsIds ?? []) {
    const base = symbolsById.get(refId);
    if (!base || visited.has(refId) || !hasDocumentationContent(base.documentation)) {
      continue;
    }
    if (contentKeyOf(base.documentation) !== key) {
      continue;
    }
    visited.add(refId);
    return originOf(base, symbolsById, key, visited) ?? base;
  }
  return null;
}

export function attributeInheritedDocumentation(symbols, { sourceFiles }) {
  const symbolsById = new Map(symbols.map((symbol) => [symbol.id, symbol]));
  const origins = new Map();
  for (const symbol of symbols) {
    if (!symbol.reimplementsIds?.length || !hasDocumentationContent(symbol.documentation)) {
      continue;
    }
    if (writesOwnDocumentation(symbol, sourceFiles)) {
      continue;
    }
    const origin = originOf(symbol, symbolsById, contentKeyOf(symbol.documentation), new Set([symbol.id]));
    if (origin) {
      origins.set(symbol, origin);
    }
  }
  for (const [symbol, origin] of origins) {
    symbol.documentation = {
      ...symbol.documentation,
      inheritedFrom: { refId: origin.id, name: origin.qualifiedName },
    };
  }
  return origins.size;
}
