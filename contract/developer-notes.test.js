import { describe, expect, it } from 'vitest';
import { overloadHashOf as pipelineOverloadHashOf } from '../scripts/documentation/resolution/signature-key.js';
import {
  developerNoteSchema,
  hasExamples,
  hasNotes,
  overloadHashOf,
  qualifiedNameOfSignature,
  referencesOf,
} from './developer-notes.js';

const MINIMAL_ENTRY = Object.freeze({ schemaVersion: 2, symbol: 'xrpl::STTx', purpose: 'A transaction.' });
const EXAMPLE = Object.freeze({
  signature: 'xrpl::isXRP(Asset const&)',
  title: 'Check',
  code: 'isXRP(asset);',
});

function accepts(entry) {
  return developerNoteSchema.safeParse(entry).success;
}

describe('developer notes contract', () => {
  it('accepts purpose, important notes and examples, each optional', () => {
    expect(accepts(MINIMAL_ENTRY)).toBe(true);
    expect(accepts({ schemaVersion: 2, symbol: 'xrpl::STTx', importantNotes: 'Careful.' })).toBe(true);
    expect(accepts({ schemaVersion: 2, symbol: 'xrpl::isXRP', examples: [EXAMPLE] })).toBe(true);
    expect(
      accepts({
        ...MINIMAL_ENTRY,
        verifiedAt: 'c2534ff9c84422e00711da31629a76f3f59feb98',
        draft: false,
        importantNotes: 'Careful.',
        examples: [{ ...EXAMPLE, explanation: 'Uses `isXRP`.', draft: true }],
      }),
    ).toBe(true);
  });

  it('rejects missing required fields, unknown fields and empty entries', () => {
    expect(accepts({ symbol: 'xrpl::STTx', purpose: 'x' })).toBe(false);
    expect(accepts({ schemaVersion: 2, purpose: 'x' })).toBe(false);
    expect(accepts({ schemaVersion: 2, symbol: 'xrpl::STTx' })).toBe(false);
    expect(accepts({ schemaVersion: 2, symbol: 'xrpl::STTx', examples: [] })).toBe(false);
    expect(accepts({ ...MINIMAL_ENTRY, purpose: '   ' })).toBe(false);
    expect(accepts({ ...MINIMAL_ENTRY, verifiedAt: 'c2534ff' })).toBe(false);
    expect(accepts({ ...MINIMAL_ENTRY, symbol: ' xrpl::STTx' })).toBe(false);
    for (const removedField of ['scope', 'notes', 'recommendations', 'keywords', 'behavior']) {
      expect(accepts({ ...MINIMAL_ENTRY, [removedField]: 'x' })).toBe(false);
    }
  });

  it('rejects files in the previous format with a pointer to the guide', () => {
    const result = developerNoteSchema.safeParse({
      schemaVersion: 1,
      symbol: 'xrpl::isXRP',
      scope: 'overload-set',
      notes: { purpose: 'Old.' },
    });
    expect(result.success).toBe(false);
    expect(result.error.issues.map((issue) => issue.message)).toContain(
      'must be 2; see developer-notes/README.md for the current format',
    );
  });

  it('rejects invalid code examples', () => {
    const withExample = (example) => accepts({ ...MINIMAL_ENTRY, examples: [example] });
    expect(withExample({ title: 'No signature on a class', code: 'STTx tx;' })).toBe(true);
    expect(withExample({ ...EXAMPLE, code: '   ' })).toBe(false);
    expect(withExample({ signature: EXAMPLE.signature, code: 'x' })).toBe(false);
    expect(withExample({ ...EXAMPLE, signature: '' })).toBe(false);
    expect(withExample({ ...EXAMPLE, explanation: '' })).toBe(false);
    expect(withExample({ ...EXAMPLE, draft: 'yes' })).toBe(false);
    expect(withExample({ ...EXAMPLE, language: 'cpp' })).toBe(false);
  });

  it('reports which content an entry has', () => {
    expect(hasNotes(MINIMAL_ENTRY)).toBe(true);
    expect(hasNotes({ importantNotes: 'x' })).toBe(true);
    expect(hasNotes({ examples: [EXAMPLE] })).toBe(false);
    expect(hasExamples({ examples: [EXAMPLE] })).toBe(true);
    expect(hasExamples(MINIMAL_ENTRY)).toBe(false);
  });

  it('extracts the qualified name from signature keys', () => {
    const cases = [
      ['xrpl::isXRP(Asset const&)', 'xrpl::isXRP'],
      ['xrpl::ApplyContext::view()const', 'xrpl::ApplyContext::view'],
      ['template<typename T>xrpl::toAmount(Asset const&,Number const&)->T', 'xrpl::toAmount'],
      ['xrpl::Foo<std::pair<int,int>>::bar(int)', 'xrpl::Foo<std::pair<int,int>>::bar'],
      ['xrpl::Number::operator()(int)', 'xrpl::Number::operator()'],
      ['xrpl::operator<(Issue const&,Issue const&)', 'xrpl::operator<'],
      ['xrpl::operator<=>(Issue const&,Issue const&)', 'xrpl::operator<=>'],
      ['xrpl::STAmount::operator bool()const', 'xrpl::STAmount::operator bool'],
    ];
    for (const [signatureKey, qualifiedName] of cases) {
      expect(qualifiedNameOfSignature(signatureKey)).toBe(qualifiedName);
    }
    expect(qualifiedNameOfSignature('xrpl::STTx')).toBeNull();
    expect(qualifiedNameOfSignature('xrpl::Wrapper<int(char)>')).toBeNull();
  });

  it('computes the same overload hash as the documentation pipeline', async () => {
    for (const key of [
      'xrpl::isXRP(Asset const&)',
      'xrpl::ApplyContext::view()const',
      'xrpl::f(std::string_view)',
    ]) {
      expect(await overloadHashOf(key)).toBe(pipelineOverloadHashOf(key));
    }
    expect(await overloadHashOf('xrpl::isXRP(Asset const&)')).toBe('6b2a4439');
    expect(await overloadHashOf('xrpl::f()', null)).toBeNull();
  });

  it('collects Markdown symbol links from every Markdown field', () => {
    const entry = {
      ...MINIMAL_ENTRY,
      purpose: 'See [view](symbol:xrpl::ApplyContext::view()const) and [site](https://example.com/).',
      importantNotes: 'Compare [isXRP](symbol:xrpl::isXRP).',
      examples: [{ ...EXAMPLE, explanation: 'Uses [STObject](symbol:xrpl::STObject).' }],
    };
    expect(referencesOf(entry)).toEqual([
      {
        location: 'purpose link "symbol:xrpl::ApplyContext::view()const"',
        symbol: 'xrpl::ApplyContext::view()const',
      },
      { location: 'importantNotes link "symbol:xrpl::isXRP"', symbol: 'xrpl::isXRP' },
      { location: 'examples[0].explanation link "symbol:xrpl::STObject"', symbol: 'xrpl::STObject' },
    ]);
  });
});
