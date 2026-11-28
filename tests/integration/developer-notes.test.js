import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDataset } from '../../scripts/documentation/build-dataset.js';
import { PROJECT_PATHS } from '../../scripts/documentation/config/pipeline-config.js';
import { verifySourceSnapshot } from '../../scripts/documentation/extraction/source-snapshot.js';
import { validateDeveloperNotes } from '../../scripts/developer-notes/validate-notes.js';

const NOTES_DIRECTORY = join(PROJECT_PATHS.projectRoot, 'developer-notes');
const NOTE_TEXT = JSON.stringify({ schemaVersion: 1, symbol: 'xrpl::STTx', notes: { purpose: 'Kept.' } });

function contains(directory, path) {
  return path === directory || path.startsWith(`${directory}${sep}`);
}

describe('committed developer notes', () => {
  it('match symbols in the published dataset', async () => {
    const result = await validateDeveloperNotes({
      notesDirectory: NOTES_DIRECTORY,
      dataDirectory: PROJECT_PATHS.datasetOutputDirectory,
    });
    expect(result.errors).toEqual([]);
  });

  it('live outside every directory the documentation pipeline writes or deletes', () => {
    const pipelineDirectories = [
      PROJECT_PATHS.cacheDirectory,
      PROJECT_PATHS.sourceCheckout,
      PROJECT_PATHS.toolsDirectory,
      PROJECT_PATHS.extractionsDirectory,
      PROJECT_PATHS.datasetOutputDirectory,
      PROJECT_PATHS.fixtureDirectory,
    ];
    for (const directory of pipelineDirectories) {
      expect(contains(directory, NOTES_DIRECTORY)).toBe(false);
      expect(contains(NOTES_DIRECTORY, directory)).toBe(false);
    }
  });

  it('survive dataset generation even when they sit inside the output directory', async () => {
    const outputDirectory = mkdtempSync(join(tmpdir(), 'xcr-notes-isolation-'));
    const notePath = join(outputDirectory, 'developer-notes', 'xrpl', 'STTx.json');
    const staleDataset = join(outputDirectory, 'b'.repeat(40));
    mkdirSync(join(outputDirectory, 'developer-notes', 'xrpl'), { recursive: true });
    mkdirSync(staleDataset);
    writeFileSync(notePath, NOTE_TEXT);
    const sourceRoot = join(PROJECT_PATHS.fixtureDirectory, 'source');
    await buildDataset({
      extractionDirectory: join(PROJECT_PATHS.fixtureDirectory, 'extraction'),
      sourceRoot,
      verifySourceRevision: (commitSha) => verifySourceSnapshot(sourceRoot, commitSha),
      outputDirectory,
      log: () => {},
    });
    expect(existsSync(staleDataset)).toBe(false);
    expect(existsSync(join(outputDirectory, 'current.json'))).toBe(true);
    expect(readFileSync(notePath, 'utf8')).toBe(NOTE_TEXT);
  });
});
