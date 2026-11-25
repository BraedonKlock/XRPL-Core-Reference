import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';

const ATTRIBUTES_KEY = ':@';
const TEXT_KEY = '#text';

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: true,
  htmlEntities: false,
});

export function parseXmlFile(filePath) {
  return parser.parse(readFileSync(filePath, 'utf8'));
}

export function tagNameOf(node) {
  return Object.keys(node).find((key) => key !== ATTRIBUTES_KEY);
}

export function isTextNode(node) {
  return tagNameOf(node) === TEXT_KEY;
}

export function childrenOf(node) {
  if (!node || isTextNode(node)) {
    return [];
  }
  return node[tagNameOf(node)] ?? [];
}

export function attributesOf(node) {
  return node?.[ATTRIBUTES_KEY] ?? {};
}

export function findChild(node, tagName) {
  return childrenOf(node).find((child) => tagNameOf(child) === tagName);
}

export function findChildren(node, tagName) {
  return childrenOf(node).filter((child) => tagNameOf(child) === tagName);
}

export function findDescendants(node, tagName, results = []) {
  for (const child of childrenOf(node)) {
    if (tagNameOf(child) === tagName) {
      results.push(child);
    }
    findDescendants(child, tagName, results);
  }
  return results;
}

export function textOf(node) {
  if (!node) {
    return '';
  }
  if (isTextNode(node)) {
    return String(node[TEXT_KEY]);
  }
  return childrenOf(node).map(textOf).join('');
}

export function normalizedTextOf(node) {
  return textOf(node).replace(/\s+/g, ' ').trim();
}

export function findRootElement(document, tagName) {
  return document.find((node) => tagNameOf(node) === tagName);
}

export function parseXmlText(xmlText) {
  return parser.parse(xmlText);
}
