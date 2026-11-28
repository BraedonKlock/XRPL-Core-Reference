import {
  developerNoteSchema,
  overloadHashOf,
  qualifiedNameOfSignature,
  referencesOf,
} from '../../../../contract/developer-notes.js';

const NO_NOTES = Object.freeze({ entry: null, examples: [] });

function validEntries(sources) {
  const entries = new Map();
  for (const [, content] of Object.entries(sources).sort(([left], [right]) => left.localeCompare(right))) {
    const parsed = developerNoteSchema.safeParse(content);
    if (parsed.success && !entries.has(parsed.data.symbol)) {
      entries.set(parsed.data.symbol, parsed.data);
    }
  }
  return entries;
}

function linkedSignatures(entries) {
  const symbols = [...entries.values()].flatMap((entry) => referencesOf(entry).map(({ symbol }) => symbol));
  return [...new Set(symbols.filter((symbol) => qualifiedNameOfSignature(symbol)))];
}

async function overloadHashes(signatureKeys, subtle) {
  try {
    const hashes = await Promise.all(signatureKeys.map((key) => overloadHashOf(key, subtle)));
    return new Map(signatureKeys.map((key, position) => [key, hashes[position]]).filter(([, hash]) => hash));
  } catch {
    return new Map();
  }
}

export async function buildNotesCatalog(sources, subtle = globalThis.crypto?.subtle) {
  const entries = validEntries(sources);
  const hashes = await overloadHashes(linkedSignatures(entries), subtle);

  const notesFor = ({ record, entry }) => {
    const notes = entries.get(record?.qualifiedName ?? entry.qualifiedName);
    if (!notes) {
      return NO_NOTES;
    }
    const examples = notes.examples ?? [];
    if (!record) {
      return { entry: notes, examples: [] };
    }
    return {
      entry: notes,
      examples:
        record.kind === 'function'
          ? examples.filter((example) => example.signature === record.signatureKey)
          : examples.filter((example) => !example.signature),
    };
  };

  const resolve = (symbol, directory) => {
    const qualifiedName = qualifiedNameOfSignature(symbol);
    if (qualifiedName) {
      const overloadSet = directory.findByQualifiedName(qualifiedName);
      if (overloadSet?.kind !== 'function') {
        return null;
      }
      const hash = hashes.get(symbol);
      return hash ? `${overloadSet.path}/${hash}` : overloadSet.path;
    }
    return directory.findByQualifiedName(symbol)?.path ?? null;
  };

  return { size: entries.size, notesFor, resolve };
}
