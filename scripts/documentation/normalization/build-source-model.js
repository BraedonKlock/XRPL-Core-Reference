import {
  DOXYGEN_FILE_COMPOUND_KIND,
  DOXYGEN_SYMBOL_COMPOUND_KINDS,
  memberDefinitionsOf,
  readCompoundDefinition,
  readDoxygenIndex,
} from '../parsing/doxygen-xml.js';
import { createDocumentationDiagnostics } from './documentation.js';
import { normalizeCompound, normalizeMember } from './doxygen-symbols.js';

const GLOBAL_SCOPE_OWNER = Object.freeze({ id: null, kind: 'global', qualifiedName: '' });

function assignCompoundOwners(compounds) {
  const compoundsById = new Map(compounds.map((compound) => [compound.id, compound]));
  for (const parent of compounds) {
    for (const innerId of parent.innerIds) {
      const inner = compoundsById.get(innerId);
      if (inner && inner.ownerId === null) {
        inner.ownerId = parent.id;
      }
    }
  }
}

export function buildSourceModel(xmlDirectory) {
  const diagnostics = createDocumentationDiagnostics();
  const index = readDoxygenIndex(xmlDirectory);
  const compounds = [];
  const members = [];
  const memberIdsSeenInSymbolCompounds = new Set();

  for (const entry of index.filter((candidate) => DOXYGEN_SYMBOL_COMPOUND_KINDS.has(candidate.kind))) {
    const definition = readCompoundDefinition(xmlDirectory, entry.refid);
    const compound = normalizeCompound(definition, diagnostics);
    compounds.push(compound);
    for (const memberEntry of memberDefinitionsOf(definition)) {
      const member = normalizeMember(memberEntry, compound, diagnostics);
      members.push(member);
      compound.memberIds.push(member.id);
      memberIdsSeenInSymbolCompounds.add(member.id);
    }
  }

  for (const entry of index.filter((candidate) => candidate.kind === DOXYGEN_FILE_COMPOUND_KIND)) {
    const definition = readCompoundDefinition(xmlDirectory, entry.refid);
    for (const memberEntry of memberDefinitionsOf(definition)) {
      const member = normalizeMember(memberEntry, GLOBAL_SCOPE_OWNER, diagnostics);
      if (!memberIdsSeenInSymbolCompounds.has(member.id)) {
        memberIdsSeenInSymbolCompounds.add(member.id);
        members.push(member);
      }
    }
  }

  assignCompoundOwners(compounds);
  return {
    symbols: [...compounds, ...members],
    indexedRefIds: new Set(index.map((entry) => entry.refid)),
    diagnostics,
  };
}
