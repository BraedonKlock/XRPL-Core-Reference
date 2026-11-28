import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';
import { excludeDraftNotes, publishedNoteSources } from './exclude-draft-notes.js';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUBLISHED_TEXT = 'Published note text for the build test.';
const DRAFT_TEXT = 'Draft note text that must never ship.';

function notesDirectoryWith(files) {
  const directory = mkdtempSync(join(tmpdir(), 'xcr-draft-notes-'));
  for (const [name, content] of Object.entries(files)) {
    const path = join(directory, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content));
  }
  return directory;
}

function note(symbol, purpose, extra = {}) {
  return { schemaVersion: 2, symbol, purpose, ...extra };
}

function example(title, extra = {}) {
  return { signature: 'xrpl::ApplyContext::view()', title, code: `${title}();`, ...extra };
}

function builtScripts(outputDirectory) {
  const assets = join(outputDirectory, 'assets');
  return readdirSync(assets)
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(join(assets, file), 'utf8'))
    .join('\n');
}

async function buildSite(inlineConfig) {
  const outputDirectory = mkdtempSync(join(tmpdir(), 'xcr-build-'));
  await build({
    root: PROJECT_ROOT,
    publicDir: false,
    logLevel: 'silent',
    build: { outDir: outputDirectory, emptyOutDir: true },
    ...inlineConfig,
  });
  return builtScripts(outputDirectory);
}

describe('draft developer notes in production builds', () => {
  it('keeps published notes and drops drafts', () => {
    const directory = notesDirectoryWith({
      'xrpl/STTx.json': note('xrpl::STTx', PUBLISHED_TEXT),
      'xrpl/reviewed.json': note('xrpl::STObject', 'Reviewed.', { draft: false }),
      'xrpl/draft.json': note('xrpl::ApplyView', DRAFT_TEXT, { draft: true }),
      'README.md': '# Guide',
      '.hidden.json': note('xrpl::Hidden', 'Hidden.'),
    });
    expect(publishedNoteSources(directory)).toEqual({
      '/developer-notes/xrpl/STTx.json': note('xrpl::STTx', PUBLISHED_TEXT),
      '/developer-notes/xrpl/reviewed.json': note('xrpl::STObject', 'Reviewed.', { draft: false }),
    });
  });

  it('drops draft examples from published entries', () => {
    const directory = notesDirectoryWith({
      'xrpl/view.json': note('xrpl::ApplyContext::view', 'Shared.', {
        examples: [
          example('published'),
          example('unreviewed', { draft: true }),
          example('reviewed', { draft: false }),
        ],
      }),
      'xrpl/only-drafts.json': note('xrpl::ApplyView', 'Kept purpose.', {
        examples: [example('unreviewed', { draft: true })],
      }),
      'xrpl/nothing-left.json': {
        schemaVersion: 2,
        symbol: 'xrpl::STObject',
        examples: [example('unreviewed', { draft: true })],
      },
    });
    expect(publishedNoteSources(directory)).toEqual({
      '/developer-notes/xrpl/view.json': note('xrpl::ApplyContext::view', 'Shared.', {
        examples: [example('published'), example('reviewed', { draft: false })],
      }),
      '/developer-notes/xrpl/only-drafts.json': note('xrpl::ApplyView', 'Kept purpose.'),
    });
  });

  it('accepts a missing notes directory', () => {
    expect(publishedNoteSources(join(tmpdir(), 'xcr-no-such-notes-directory'))).toEqual({});
  });

  it('fails the build on invalid JSON instead of shipping it', () => {
    const directory = notesDirectoryWith({ 'broken.json': '{ "schemaVersion": 1,' });
    expect(() => publishedNoteSources(directory)).toThrow(
      /^\/developer-notes\/broken\.json is not valid JSON/,
    );
  });

  it('builds the site with published notes and without any trace of drafts', async () => {
    const notesDirectory = notesDirectoryWith({
      'xrpl/STTx.json': note('xrpl::STTx', PUBLISHED_TEXT, {
        examples: [{ title: 'Published example', code: 'publishedCall();' }],
      }),
      'xrpl/secret-draft.json': note('xrpl::ApplyView', DRAFT_TEXT, { draft: true }),
      'xrpl/view.json': note('xrpl::ApplyContext::view', 'View purpose.', {
        examples: [example('secretDraftExample', { draft: true })],
      }),
    });
    const scripts = await buildSite({
      configFile: false,
      plugins: [excludeDraftNotes({ notesDirectory }), react()],
    });
    expect(scripts).toContain(PUBLISHED_TEXT);
    expect(scripts).toContain('publishedCall();');
    expect(scripts).toContain('View purpose.');
    expect(scripts).not.toContain(DRAFT_TEXT);
    expect(scripts).not.toContain('secretDraftExample');
    expect(scripts).not.toContain('secret-draft');
    expect(scripts).not.toContain('xrpl::ApplyView"');
  });

  it('excludes every committed draft from the configured production build', async () => {
    const committedNotes = Object.entries(
      Object.fromEntries(
        readdirSync(join(PROJECT_ROOT, 'developer-notes'), { recursive: true })
          .filter((file) => String(file).endsWith('.json'))
          .map((file) => [
            String(file),
            JSON.parse(readFileSync(join(PROJECT_ROOT, 'developer-notes', String(file)), 'utf8')),
          ]),
      ),
    );
    const scripts = await buildSite({ configFile: join(PROJECT_ROOT, 'vite.config.js') });
    expect(scripts).toContain('NOTE_SOURCES');
    const escaped = (text) => JSON.stringify(text).slice(1, -1);
    for (const [file, content] of committedNotes) {
      const draftExamples = content.draft
        ? (content.examples ?? [])
        : (content.examples ?? []).filter((draftExample) => draftExample.draft);
      if (content.draft) {
        expect(scripts).not.toContain(file);
        for (const text of [content.purpose, content.importantNotes].filter(Boolean)) {
          expect(scripts).not.toContain(escaped(text));
        }
      }
      for (const draftExample of draftExamples) {
        expect(scripts).not.toContain(escaped(draftExample.code));
      }
    }
  });
});
