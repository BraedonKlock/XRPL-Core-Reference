const SCOPE_SEPARATOR = '::';
const DEFAULT_LIMIT = 50;

export const MATCH_TIERS = Object.freeze({
  exactName: 100,
  exactNameIgnoringCase: 95,
  exactQualifiedName: 90,
  qualifiedSuffix: 85,
  namePrefix: 70,
  nameWordStart: 60,
  nameSubstring: 50,
  qualifiedSubstring: 30,
});

export const KIND_FILTERS = Object.freeze({
  types: new Set(['class', 'struct', 'union', 'concept', 'typeAlias', 'enum']),
  functions: new Set(['function']),
  variables: new Set(['variable']),
  namespaces: new Set(['namespace']),
});

const KIND_WEIGHTS = Object.freeze({
  class: 6,
  struct: 6,
  union: 5,
  concept: 5,
  namespace: 4,
  typeAlias: 4,
  enum: 4,
  function: 2,
  variable: 1,
});

function wordStartOffsets(name) {
  const offsets = [0];
  for (let position = 1; position < name.length; position += 1) {
    const previous = name[position - 1];
    const current = name[position];
    const startsCamelWord = /[a-z0-9]/.test(previous) && /[A-Z]/.test(current);
    const followsSeparator = previous === '_' || previous === ':';
    if (startsCamelWord || followsSeparator) {
      offsets.push(position);
    }
  }
  return offsets;
}

function prepareEntry(entry) {
  return {
    entry,
    name: entry.name,
    nameLower: entry.name.toLowerCase(),
    qualifiedLower: entry.qualifiedName.toLowerCase(),
    wordStarts: wordStartOffsets(entry.name),
    kindWeight: KIND_WEIGHTS[entry.kind] ?? 0,
  };
}

export function parseQuery(rawQuery) {
  const query = rawQuery
    .trim()
    .replace(/\s*::\s*/g, SCOPE_SEPARATOR)
    .replace(/\s+/g, ' ');
  const isQualified = query.includes(SCOPE_SEPARATOR);
  const lastSegment = isQualified
    ? query.slice(query.lastIndexOf(SCOPE_SEPARATOR) + SCOPE_SEPARATOR.length)
    : query;
  return {
    text: query,
    lower: query.toLowerCase(),
    isQualified,
    nameTerm: lastSegment,
    nameTermLower: lastSegment.toLowerCase(),
  };
}

function nameMatch(prepared, query) {
  const term = query.nameTermLower;
  if (term.length === 0) {
    return null;
  }
  if (prepared.name === query.nameTerm) {
    return { tier: MATCH_TIERS.exactName, start: 0 };
  }
  if (prepared.nameLower === term) {
    return { tier: MATCH_TIERS.exactNameIgnoringCase, start: 0 };
  }
  if (prepared.nameLower.startsWith(term)) {
    return { tier: MATCH_TIERS.namePrefix, start: 0 };
  }
  const wordStart = prepared.wordStarts.find((offset) => prepared.nameLower.startsWith(term, offset));
  if (wordStart !== undefined) {
    return { tier: MATCH_TIERS.nameWordStart, start: wordStart };
  }
  const index = prepared.nameLower.indexOf(term);
  return index >= 0 ? { tier: MATCH_TIERS.nameSubstring, start: index } : null;
}

function qualifiedMatch(prepared, query) {
  if (prepared.qualifiedLower === query.lower) {
    return MATCH_TIERS.exactQualifiedName;
  }
  if (prepared.qualifiedLower.endsWith(`${SCOPE_SEPARATOR}${query.lower}`)) {
    return MATCH_TIERS.qualifiedSuffix;
  }
  return prepared.qualifiedLower.includes(query.lower) ? MATCH_TIERS.qualifiedSubstring : null;
}

function scoreEntry(prepared, query) {
  const qualifiedTier = qualifiedMatch(prepared, query);
  if (query.isQualified) {
    if (qualifiedTier === null) {
      return null;
    }
    const highlight = nameMatch(prepared, query);
    return {
      tier: qualifiedTier,
      highlight: highlight ? { start: highlight.start, length: query.nameTerm.length } : null,
    };
  }
  const match = nameMatch(prepared, query);
  if (match) {
    const tier = Math.max(match.tier, qualifiedTier ?? 0);
    return { tier, highlight: { start: match.start, length: query.nameTerm.length } };
  }
  return qualifiedTier === null ? null : { tier: qualifiedTier, highlight: null };
}

function compareResults(left, right) {
  return (
    right.tier - left.tier ||
    right.prepared.kindWeight - left.prepared.kindWeight ||
    left.prepared.name.length - right.prepared.name.length ||
    left.prepared.entry.qualifiedName.length - right.prepared.entry.qualifiedName.length ||
    left.prepared.entry.qualifiedName.localeCompare(right.prepared.entry.qualifiedName)
  );
}

function matchesFilters(entry, { kindFilter, scopePath }) {
  if (kindFilter && !KIND_FILTERS[kindFilter]?.has(entry.kind)) {
    return false;
  }
  return !scopePath || entry.path.startsWith(`${scopePath}/`);
}

export function createSearchEngine(entries) {
  const prepared = entries.map(prepareEntry);
  return {
    size: prepared.length,
    search(rawQuery, { kindFilter = null, scopePath = null, limit = DEFAULT_LIMIT } = {}) {
      const query = parseQuery(rawQuery);
      if (query.text.length === 0) {
        return { query: query.text, total: 0, results: [] };
      }
      const matches = [];
      for (const candidate of prepared) {
        if (!matchesFilters(candidate.entry, { kindFilter, scopePath })) {
          continue;
        }
        const score = scoreEntry(candidate, query);
        if (score) {
          matches.push({ prepared: candidate, ...score });
        }
      }
      matches.sort(compareResults);
      return {
        query: query.text,
        total: matches.length,
        results: matches.slice(0, limit).map(({ prepared: candidate, tier, highlight }) => ({
          entry: candidate.entry,
          tier,
          highlight,
        })),
      };
    },
  };
}

const EMPTY_RESULT = Object.freeze({ query: '', total: 0, results: Object.freeze([]) });

export function createLazySearchEngine(loadEntries) {
  let engine = null;
  return {
    get isBuilt() {
      return engine !== null;
    },
    search(rawQuery, options) {
      if (parseQuery(rawQuery).text.length === 0) {
        return EMPTY_RESULT;
      }
      engine ??= createSearchEngine(loadEntries());
      return engine.search(rawQuery, options);
    },
  };
}
