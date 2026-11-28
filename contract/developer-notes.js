import * as z from 'zod/mini';
import { linksInMarkdown } from './markdown.js';

export const DEVELOPER_NOTES_SCHEMA_VERSION = 2;

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;
const OVERLOAD_HASH_LENGTH = 8;
const TEMPLATE_PREFIX = 'template<';
const OPERATOR_KEYWORD = 'operator';
const IDENTIFIER_CHARACTER = /[A-Za-z0-9_]/;

const trimmedText = () =>
  z.string().check(
    z.refine((text) => text.trim().length > 0, { error: 'must not be empty' }),
    z.refine((text) => text === text.trim(), { error: 'must not have leading or trailing whitespace' }),
  );
const markdownText = () =>
  z.string().check(z.refine((text) => text.trim().length > 0, { error: 'must not be empty' }));

export const codeExampleSchema = z.strictObject({
  signature: z.optional(trimmedText()),
  title: trimmedText(),
  explanation: z.optional(markdownText()),
  code: z.string().check(z.refine((code) => code.trim().length > 0, { error: 'must contain code' })),
  draft: z.optional(z.boolean()),
});

export const developerNoteSchema = z
  .strictObject({
    schemaVersion: z.literal(DEVELOPER_NOTES_SCHEMA_VERSION, {
      error: `must be ${DEVELOPER_NOTES_SCHEMA_VERSION}; see developer-notes/README.md for the current format`,
    }),
    symbol: trimmedText(),
    verifiedAt: z.optional(
      z.string().check(z.regex(COMMIT_SHA_PATTERN, { error: 'must be a full 40-character commit SHA' })),
    ),
    draft: z.optional(z.boolean()),
    purpose: z.optional(markdownText()),
    importantNotes: z.optional(markdownText()),
    examples: z.optional(z.array(codeExampleSchema)),
  })
  .check(
    z.refine((entry) => hasNotes(entry) || hasExamples(entry), {
      error: 'must provide purpose, importantNotes or at least one code example',
    }),
  );

export function hasNotes(entry) {
  return Boolean(entry.purpose || entry.importantNotes);
}

export function hasExamples(entry) {
  return (entry.examples?.length ?? 0) > 0;
}

function templatePrefixLength(text) {
  if (!text.startsWith(TEMPLATE_PREFIX)) {
    return 0;
  }
  let depth = 0;
  for (let position = TEMPLATE_PREFIX.length - 1; position < text.length; position += 1) {
    if (text[position] === '<') {
      depth += 1;
    } else if (text[position] === '>') {
      depth -= 1;
      if (depth === 0) {
        return position + 1;
      }
    }
  }
  return text.length;
}

function startsOperatorAt(text, position) {
  return (
    text.startsWith(OPERATOR_KEYWORD, position) &&
    (position === 0 || text[position - 1] === ':') &&
    !IDENTIFIER_CHARACTER.test(text[position + OPERATOR_KEYWORD.length] ?? '')
  );
}

export function qualifiedNameOfSignature(signatureKey) {
  const offset = templatePrefixLength(signatureKey);
  const text = signatureKey.slice(offset);
  let depth = 0;
  for (let position = 0; position < text.length; position += 1) {
    if (startsOperatorAt(text, position)) {
      const afterKeyword = position + OPERATOR_KEYWORD.length;
      const parameterStart = text.startsWith('()', afterKeyword)
        ? afterKeyword + 2
        : text.indexOf('(', afterKeyword);
      return parameterStart > afterKeyword && text[parameterStart] === '('
        ? text.slice(0, parameterStart)
        : null;
    }
    const character = text[position];
    if (character === '<') {
      depth += 1;
    } else if (character === '>') {
      depth -= 1;
    } else if (character === '(' && depth === 0) {
      return position > 0 ? text.slice(0, position) : null;
    }
  }
  return null;
}

export async function overloadHashOf(signatureKey, subtle = globalThis.crypto?.subtle) {
  if (!subtle) {
    return null;
  }
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(signatureKey));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, OVERLOAD_HASH_LENGTH);
}

export function markdownFieldsOf(entry) {
  const fields = ['purpose', 'importantNotes']
    .filter((field) => entry[field])
    .map((field) => ({ location: field, source: entry[field] }));
  (entry.examples ?? []).forEach((example, position) => {
    if (example.explanation) {
      fields.push({ location: `examples[${position}].explanation`, source: example.explanation });
    }
  });
  return fields;
}

export function referencesOf(entry) {
  return markdownFieldsOf(entry).flatMap((field) =>
    linksInMarkdown(field.source)
      .filter((link) => link.target.kind === 'symbol')
      .map((link) => ({
        location: `${field.location} link "${link.destination}"`,
        symbol: link.target.symbol,
      })),
  );
}
