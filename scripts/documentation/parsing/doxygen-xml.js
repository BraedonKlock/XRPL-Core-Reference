import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { attributesOf, findChild, findChildren, findRootElement, parseXmlFile, textOf } from './xml-tree.js';

export const DOXYGEN_SYMBOL_COMPOUND_KINDS = new Set(['namespace', 'class', 'struct', 'union', 'concept']);
export const DOXYGEN_FILE_COMPOUND_KIND = 'file';
const INDEX_FILE = 'index.xml';

export function readDoxygenIndex(xmlDirectory) {
  const indexPath = join(xmlDirectory, INDEX_FILE);
  if (!existsSync(indexPath)) {
    throw new Error(`Doxygen index not found at ${indexPath}`);
  }
  const index = findRootElement(parseXmlFile(indexPath), 'doxygenindex');
  return findChildren(index, 'compound').map((compound) => ({
    refid: attributesOf(compound).refid,
    kind: attributesOf(compound).kind,
    name: textOf(findChild(compound, 'name')),
  }));
}

export function readCompoundDefinition(xmlDirectory, refid) {
  const path = join(xmlDirectory, `${refid}.xml`);
  const root = findRootElement(parseXmlFile(path), 'doxygen');
  const definition = findChild(root, 'compounddef');
  if (!definition) {
    throw new Error(`Doxygen compound ${refid} has no compounddef element`);
  }
  return definition;
}

export function memberDefinitionsOf(compoundDefinition) {
  return findChildren(compoundDefinition, 'sectiondef').flatMap((section) =>
    findChildren(section, 'memberdef').map((memberDefinition) => ({
      sectionKind: attributesOf(section).kind,
      memberDefinition,
    })),
  );
}

export function innerCompoundIdsOf(compoundDefinition) {
  return ['innerclass', 'innernamespace', 'innerconcept'].flatMap((tag) =>
    findChildren(compoundDefinition, tag).map((inner) => attributesOf(inner).refid),
  );
}
