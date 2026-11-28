import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildFixtureDataset } from '../../tests/helpers/fixture-dataset.js';
import { validateDeveloperNotes } from './validate-notes.js';

const COMMIT = 'c2534ff9c84422e00711da31629a76f3f59feb98';
const OTHER_COMMIT = 'a'.repeat(40);
let dataDirectory;

beforeAll(async () => {
  dataDirectory = await buildFixtureDataset();
});

function notesDirectoryWith(files) {
  const directory = mkdtempSync(join(tmpdir(), 'xcr-developer-notes-'));
  for (const [name, content] of Object.entries(files)) {
    const path = join(directory, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content));
  }
  return directory;
}

const VIEW = 'xrpl::ApplyContext::view';
const VIEW_SIGNATURES = '"xrpl::ApplyContext::view()", "xrpl::ApplyContext::view()const"';

function entry(symbol, extra = {}) {
  return { schemaVersion: 2, symbol, purpose: 'Purpose.', ...extra };
}

function example(signature, extra = {}) {
  return { ...(signature ? { signature } : {}), title: 'Example', code: 'f();', ...extra };
}

async function validate(files) {
  return validateDeveloperNotes({ notesDirectory: notesDirectoryWith(files), dataDirectory });
}

describe('developer notes validation', () => {
  it('accepts a function family with signature examples and a class with plain examples', async () => {
    const result = await validate({
      'xrpl/view.json': entry(VIEW, {
        verifiedAt: COMMIT,
        importantNotes:
          'See [ApplyView](symbol:xrpl::ApplyView) and [the const view](symbol:xrpl::ApplyContext::view()const).',
        examples: [example('xrpl::ApplyContext::view()'), example('xrpl::ApplyContext::view()const')],
      }),
      'xrpl/STTx.json': entry('xrpl::STTx', {
        examples: [example(null, { explanation: 'See [view](symbol:xrpl::ApplyContext::view).' })],
      }),
      'README.md': '# not a note',
    });
    expect(result).toMatchObject({
      commitSha: COMMIT,
      fileCount: 2,
      entryCount: 2,
      errors: [],
      warnings: [],
    });
  });

  it('accepts an empty notes directory', async () => {
    expect(await validate({})).toMatchObject({ fileCount: 0, errors: [] });
  });

  it('reports invalid JSON, schema errors and files in the previous format', async () => {
    const result = await validate({
      'broken.json': '{ "schemaVersion": 2,',
      'empty-code.json': entry('xrpl::STTx', { examples: [example(null, { code: '' })] }),
      'old.json': { schemaVersion: 1, symbol: VIEW, scope: 'overload-set', notes: { purpose: 'x' } },
    });
    expect(result.errors).toEqual([
      expect.stringMatching(/^broken\.json: is not valid JSON/),
      'empty-code.json: examples.0.code: must contain code',
      'old.json: schemaVersion: must be 2; see developer-notes/README.md for the current format',
      'old.json: entry: unknown fields "scope", "notes"',
    ]);
  });

  it('reports duplicate files for the same symbol', async () => {
    const result = await validate({ 'a.json': entry('xrpl::STTx'), 'nested/b.json': entry('xrpl::STTx') });
    expect(result.errors).toEqual(['nested/b.json: duplicates the entry for "xrpl::STTx" in a.json']);
  });

  it('reports missing symbols and signatures used as the file symbol', async () => {
    const result = await validate({
      'missing.json': entry('xrpl::DoesNotExist'),
      'signature.json': entry('xrpl::ApplyContext::view()const'),
    });
    expect(result.errors).toEqual([
      'missing.json: symbol "xrpl::DoesNotExist" does not match any symbol in the dataset',
      `signature.json: symbol "xrpl::ApplyContext::view()const" is a signature. Use the qualified name "${VIEW}" and put the signature on each example`,
    ]);
  });

  it('requires example signatures for functions and checks that they belong to the family', async () => {
    const result = await validate({
      'view.json': entry(VIEW, {
        examples: [
          example(null),
          example('xrpl::ApplyContext::view(int)'),
          example('xrpl::ApplyView::ApplyView()'),
        ],
      }),
    });
    expect(result.errors).toEqual([
      `view.json: examples[0].signature is required for a function. Available signatures: ${VIEW_SIGNATURES}`,
      `view.json: examples[1].signature "xrpl::ApplyContext::view(int)" is not an overload of ${VIEW}. Available signatures: ${VIEW_SIGNATURES}`,
      `view.json: examples[2].signature "xrpl::ApplyView::ApplyView()" is not an overload of ${VIEW}. Available signatures: ${VIEW_SIGNATURES}`,
    ]);
  });

  it('rejects signatures on examples for non-function symbols', async () => {
    const result = await validate({
      'sttx.json': entry('xrpl::STTx', { examples: [example('xrpl::STTx::STTx()')] }),
    });
    expect(result.errors).toEqual([
      'sttx.json: examples[0].signature: "xrpl::STTx" is not a function, so examples must not have a signature',
    ]);
  });

  it('reports broken symbol links and unsafe links in every Markdown field', async () => {
    const result = await validate({
      'sttx.json': entry('xrpl::STTx', {
        purpose: 'See [gone](symbol:xrpl::Gone) and [bad](javascript:alert(1)).',
        importantNotes: 'Old scheme: [set](overloads:xrpl::ApplyContext::view).',
        examples: [example(null, { explanation: 'Uses [view](symbol:xrpl::ApplyContext::view(int)).' })],
      }),
    });
    expect(result.errors).toEqual([
      'sttx.json: purpose: link "javascript:alert(1)" must use https:, http: or symbol:',
      'sttx.json: importantNotes: link "overloads:xrpl::ApplyContext::view" must use https:, http: or symbol:',
      'sttx.json: purpose link "symbol:xrpl::Gone": "xrpl::Gone" does not match any symbol in the dataset',
      `sttx.json: examples[0].explanation link "symbol:xrpl::ApplyContext::view(int)": "xrpl::ApplyContext::view(int)" does not match any overload of ${VIEW}. Available signatures: ${VIEW_SIGNATURES}`,
    ]);
  });

  it('warns about drafts, draft examples and entries verified against another commit', async () => {
    const result = await validate({
      'sttx.json': entry('xrpl::STTx', { draft: true, verifiedAt: OTHER_COMMIT }),
      'view.json': entry(VIEW, {
        examples: [example('xrpl::ApplyContext::view()', { title: 'Unreviewed', draft: true })],
      }),
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      'sttx.json: was verified against rippled aaaaaaa, but the dataset documents c2534ff',
      'sttx.json: is marked as a draft',
      'view.json: examples[0] "Unreviewed" is marked as a draft',
    ]);
  });
});
