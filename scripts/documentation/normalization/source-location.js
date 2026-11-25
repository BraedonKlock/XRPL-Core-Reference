import { attributesOf, findChild } from '../parsing/xml-tree.js';

export const GENERATED_LOCATION_FILE = '[generated]';

function positiveLineOrNull(value) {
  const line = Number(value);
  return Number.isInteger(line) && line > 0 ? line : null;
}

export function sourceLocationFromAttributes(attributes) {
  if (!attributes.file || attributes.file === GENERATED_LOCATION_FILE) {
    return null;
  }
  const hasSeparateDeclaration =
    Boolean(attributes.declfile) &&
    (attributes.declfile !== attributes.file || attributes.declline !== attributes.line);
  const declaration = hasSeparateDeclaration
    ? { file: attributes.declfile, line: positiveLineOrNull(attributes.declline) }
    : { file: attributes.file, line: positiveLineOrNull(attributes.line) };
  const bodyStart = positiveLineOrNull(attributes.bodystart);
  let definition = null;
  if (attributes.bodyfile && bodyStart) {
    definition = {
      file: attributes.bodyfile,
      line: bodyStart,
      endLine: positiveLineOrNull(attributes.bodyend),
    };
  } else if (hasSeparateDeclaration && positiveLineOrNull(attributes.line)) {
    definition = { file: attributes.file, line: positiveLineOrNull(attributes.line), endLine: null };
  }
  return { declaration, definition };
}

export function sourceLocationOf(element) {
  const location = findChild(element, 'location');
  return location ? sourceLocationFromAttributes(attributesOf(location)) : null;
}
