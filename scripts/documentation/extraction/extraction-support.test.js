import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DOXYGEN_RELEASE } from '../config/pipeline-config.js';
import { categorizeSourceFile, inputsForCategories } from '../config/source-categories.js';
import { verifyArchiveChecksum } from './doxygen-installation.js';
import { computeDoxygenConfigSha256, createDoxygenEnvironment } from './doxygen-runner.js';
import { createSourceRevision } from './extract.js';
import { readExtractionRecord, writeExtractionRecord } from './extraction-record.js';
import { copySourceSnapshot, verifySourceSnapshot } from './source-snapshot.js';

const COMMIT = 'c2534ff9c84422e00711da31629a76f3f59feb98';
const temporaryDirectories = [];

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'xcr-extraction-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() =>
  temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })),
);

describe('source categories', () => {
  it('maps categories to Doxygen inputs and files back to categories', () => {
    expect(inputsForCategories(['production'])).toEqual(['include', 'src/libxrpl', 'src/xrpld']);
    expect(inputsForCategories(['production', 'test'])).toContain('src/test');
    expect(() => inputsForCategories(['vendor'])).toThrow(/Unknown source categories/);
    expect(categorizeSourceFile('src/xrpld/app/main/Main.cpp')).toBe('production');
    expect(categorizeSourceFile('src/tests/libxrpl/basics/Buffer.cpp')).toBe('test');
    expect(categorizeSourceFile('src/xrpldx/Other.cpp')).toBeNull();
    expect(categorizeSourceFile('external/secp256k1/x.h')).toBeNull();
  });
});

describe('doxygen invocation', () => {
  it('verifies the archive checksum', () => {
    expect(() => verifyArchiveChecksum(Buffer.from('tampered'), DOXYGEN_RELEASE.archiveSha256)).toThrow(
      /checksum mismatch/,
    );
  });

  it('passes inputs and X-macro definers through the environment', () => {
    const environment = createDoxygenEnvironment({
      sourceCheckout: '/src',
      outputDirectory: '/out',
      inputs: ['include', 'src/libxrpl'],
    });
    expect(environment.XCR_DOXYGEN_INPUT).toBe('include src/libxrpl');
    expect(environment.XCR_DOXYGEN_EXPAND_AS_DEFINED.split(' ')).toContain('TYPED_SFIELD');
  });

  it('hashes the effective configuration deterministically', () => {
    const input = { overlayText: 'a', upstreamDoxyfileText: 'b', inputs: ['include'] };
    expect(computeDoxygenConfigSha256(input)).toBe(computeDoxygenConfigSha256({ ...input }));
    expect(computeDoxygenConfigSha256(input)).not.toBe(
      computeDoxygenConfigSha256({ ...input, inputs: ['src'] }),
    );
  });
});

describe('extraction records', () => {
  it('round-trips a validated record', () => {
    const directory = temporaryDirectory();
    const record = {
      source: createSourceRevision(COMMIT, '2026-11-25T15:23:34+00:00'),
      extractedAt: '2026-11-25T17:31:03.000Z',
      doxygenVersion: '1.17.0 (65a43c0aba45cc23b3ca11b6b5334d4eea931726)',
      doxygenConfigSha256: 'a'.repeat(64),
      categories: ['production'],
      inputs: ['include'],
    };
    writeExtractionRecord(directory, record);
    expect(readExtractionRecord(directory)).toEqual(record);
    expect(record.source).toMatchObject({ repository: 'XRPLF/rippled', branch: 'develop' });
  });

  it('rejects abbreviated commit SHAs', () => {
    expect(() =>
      writeExtractionRecord(temporaryDirectory(), {
        source: createSourceRevision('c2534ff', '2026-11-25T15:23:34+00:00'),
        extractedAt: '2026-11-25T17:31:03.000Z',
        doxygenVersion: '1.17.0',
        doxygenConfigSha256: 'a'.repeat(64),
        categories: ['production'],
        inputs: ['include'],
      }),
    ).toThrow();
  });
});

describe('source snapshots', () => {
  it('detects modified files and mismatched revisions', () => {
    const source = temporaryDirectory();
    const snapshot = temporaryDirectory();
    writeFileSync(join(source, 'a.h'), 'class A;');
    copySourceSnapshot({
      sourceCheckout: source,
      snapshotDirectory: snapshot,
      files: ['a.h'],
      commitSha: COMMIT,
    });
    expect(() => verifySourceSnapshot(snapshot, COMMIT)).not.toThrow();
    expect(() => verifySourceSnapshot(snapshot, 'f'.repeat(40))).toThrow(/pinned to/);
    writeFileSync(join(snapshot, 'a.h'), 'class B;');
    expect(() => verifySourceSnapshot(snapshot, COMMIT)).toThrow(/was modified/);
  });
});
