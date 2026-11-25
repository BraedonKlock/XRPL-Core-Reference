import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { symbolShardSchema } from '../../contract/schema.js';
import {
  assembleDataset,
  buildDataset,
  normalizeExtraction,
  resolveSymbols,
} from '../../scripts/documentation/build-dataset.js';
import { PROJECT_PATHS } from '../../scripts/documentation/config/pipeline-config.js';
import { DOXYGEN_CORRECTIONS } from '../../scripts/documentation/normalization/corrections/index.js';
import { readExtractionRecord } from '../../scripts/documentation/extraction/extraction-record.js';
import { verifySourceSnapshot } from '../../scripts/documentation/extraction/source-snapshot.js';
import { validatePublishedDataset } from '../../scripts/documentation/validation/validate-dataset.js';

const FIXTURE = PROJECT_PATHS.fixtureDirectory;
const EXTRACTION = join(FIXTURE, 'extraction');
const SOURCE = join(FIXTURE, 'source');
const PINNED_COMMIT = 'c2534ff9c84422e00711da31629a76f3f59feb98';

function tokensText(expression) {
  return (expression ?? []).map((token) => token.text).join('');
}

function linkTargets(expression) {
  return (expression ?? []).filter((token) => token.target).map((token) => [token.text, token.target.path]);
}

describe('pipeline over the rippled subset fixture', () => {
  let records;
  let resolved;
  let normalized;

  const symbolsNamed = (qualifiedName, kind) =>
    records.filter((record) => record.qualifiedName === qualifiedName && (!kind || record.kind === kind));
  const only = (qualifiedName, kind) => {
    const matches = symbolsNamed(qualifiedName, kind);
    expect(matches, qualifiedName).toHaveLength(1);
    return matches[0];
  };

  beforeAll(() => {
    normalized = normalizeExtraction({
      extractionDirectory: EXTRACTION,
      sourceRoot: SOURCE,
      includedCategories: ['production'],
    });
    resolved = resolveSymbols(normalized);
    records = resolved.records;
  });

  it('is pinned to the documented develop commit', () => {
    const record = readExtractionRecord(EXTRACTION);
    expect(record.source).toMatchObject({
      repository: 'XRPLF/rippled',
      branch: 'develop',
      commitSha: PINNED_COMMIT,
    });
    expect(record.doxygenVersion).toMatch(/^1\.17\.0/);
    expect(() => verifySourceSnapshot(SOURCE, PINNED_COMMIT)).not.toThrow();
  });

  it('produces schema-valid records with unique paths', () => {
    expect(resolved.pathCollisions).toEqual([]);
    expect(new Set(records.map((record) => record.path)).size).toBe(records.length);
    const validation = symbolShardSchema.safeParse({
      schemaVersion: '1.0.0',
      commitSha: PINNED_COMMIT,
      shard: 'all',
      symbols: records,
    });
    expect(validation.error?.issues.slice(0, 3)).toBeUndefined();
  });

  it('extracts ApplyContext with linked method signatures', () => {
    const applyContext = only('xrpl::ApplyContext', 'class');
    expect(applyContext.path).toBe('xrpl/ApplyContext');
    expect(applyContext.location.declaration).toEqual({ file: 'include/xrpl/tx/ApplyContext.h', line: 27 });
    expect(tokensText(applyContext.documentation.brief.map((inline) => ({ text: inline.text })))).toBe(
      'State information when applying a tx.',
    );

    const constView = symbolsNamed('xrpl::ApplyContext::view').find((view) => view.qualifiers.isConst);
    expect(tokensText(constView.returnType)).toBe('ApplyView const&');
    expect(linkTargets(constView.returnType)).toEqual([['ApplyView', 'xrpl/ApplyView']]);
    expect(constView.overloadSet).toBe('xrpl/ApplyContext/view');
    expect(applyContext.members).toContain(constView.path);
  });

  it('links constructor parameters through template arguments and aliases', () => {
    const constructor = symbolsNamed('xrpl::ApplyContext::ApplyContext').find((candidate) =>
      candidate.parameters.some((parameter) => parameter.name === 'parentBatchId'),
    );
    const parameterTargets = Object.fromEntries(
      constructor.parameters.map((parameter) => [parameter.name, linkTargets(parameter.type)]),
    );
    expect(parameterTargets.parentBatchId).toEqual([['UInt256', 'xrpl/UInt256']]);
    expect(parameterTargets.tx).toEqual([['STTx', 'xrpl/STTx']]);
    expect(parameterTargets.preclaimResult).toEqual([['TER', 'xrpl/TER']]);
    expect(constructor.location.definition).toEqual({
      file: 'src/libxrpl/tx/ApplyContext.cpp',
      line: 22,
      endLine: 44,
    });
    expect(tokensText(constructor.parameters.at(-1).defaultValue)).toBe(
      'beast::Journal{beast::Journal::getNullSink()}',
    );
  });

  it('records inheritance and keeps unresolvable bases as plain text', () => {
    const sttx = only('xrpl::STTx', 'class');
    expect(sttx.isFinal).toBe(true);
    expect(sttx.baseClasses.map((base) => [base.name, base.target])).toEqual([
      ['STObject', null],
      ['CountedObject< STTx >', null],
    ]);
    const readView = only('xrpl::ReadView', 'class');
    expect(readView.isAbstract).toBe(true);
    expect(readView.derivedClasses.map((derived) => derived.target?.path)).toEqual([
      'xrpl/ApplyView',
      'xrpl/DigestAwareReadView',
      'xrpl/OpenView',
    ]);
  });

  it('links alias targets', () => {
    expect(linkTargets(only('xrpl::TER', 'typeAlias').type)).toEqual([
      ['TERSubset', 'xrpl/TERSubset'],
      ['CanCvtToTER', 'xrpl/CanCvtToTER'],
    ]);
  });

  it('corrects macro-generated constants', () => {
    const account = only('xrpl::jss::Account');
    expect(account).toMatchObject({
      kind: 'variable',
      corrections: ['reclassify-literal-initialized-constants'],
    });
    expect(tokensText(account.initializer)).toBe('("Account")');
    expect(only('xrpl::sfAccount').location.declaration).toEqual({
      file: 'include/xrpl/protocol/detail/sfields.macro',
      line: 339,
    });
    expect(only('xrpl::sfAMMID').location.declaration.line).toBe(194);
    expect(only('xrpl::featureCosign').location.declaration).toEqual({
      file: 'include/xrpl/protocol/detail/features.macro',
      line: 19,
    });
    expect(only('xrpl::sfInvalid').location).toEqual({
      declaration: { file: 'include/xrpl/protocol/SField.h', line: 376 },
      definition: { file: 'src/libxrpl/protocol/SField.cpp', line: 48, endLine: null },
    });
    const ledgerEntryType = only('xrpl::LedgerEntryType', 'enum');
    expect(ledgerEntryType.enumerators).toHaveLength(37);
    expect(
      ledgerEntryType.enumerators.find((enumerator) => enumerator.name === 'ltACCOUNT_ROOT').initializer,
    ).toEqual([{ text: '= 0x0061' }]);
  });

  it('suppresses documentation Doxygen attributed to the wrong symbol', () => {
    const byLedger = only('xrpl::Validations::byLedger');
    expect(byLedger.documentation.status).toBe('suppressed');
    expect(byLedger.documentation.brief).toBeNull();
    const payment = only('xrpl::TxType', 'enum').enumerators.find(
      (enumerator) => enumerator.name === 'ttPAYMENT',
    );
    expect(payment.documentation.status).toBe('suppressed');
  });

  it('separates trailing requires clauses and folded specializations', () => {
    const constrained = symbolsNamed('beast::detail::AgedOrderedContainer::insert').filter(
      (insert) => insert.requiresClause,
    );
    expect(constrained.length).toBeGreaterThan(0);
    constrained.forEach((insert) => expect(tokensText(insert.returnType)).not.toMatch(/\brequires\b/));
    const [specialized] = symbolsNamed('xrpl::STInteger::STInteger').filter(
      (constructor) => constructor.explicitSpecializations.length > 0,
    );
    expect(specialized.explicitSpecializations).toHaveLength(5);
    expect(
      specialized.explicitSpecializations.every(
        (position) => position.file === 'src/libxrpl/protocol/STInteger.cpp',
      ),
    ).toBe(true);
  });

  it('attaches deduction guides to their class templates', () => {
    const scopeExit = only('xrpl::ScopeExit', 'class');
    expect(scopeExit.deductionGuides.map((guide) => tokensText(guide.declaration))).toEqual([
      'template <class EF>\nScopeExit(EF) -> ScopeExit< EF >',
    ]);
  });

  it('keeps hidden friend functions with their class', () => {
    const [streamOperator] = symbolsNamed('xrpl::IOUAmount::operator<<');
    expect(streamOperator).toMatchObject({
      role: 'friend',
      overloadSet: 'xrpl/IOUAmount/operator-shift-left',
    });
  });

  it('generates a complete, verifiable dataset', async () => {
    const output = mkdtempSync(join(tmpdir(), 'xcr-dataset-'));
    try {
      const result = await buildDataset({
        extractionDirectory: EXTRACTION,
        sourceRoot: SOURCE,
        verifySourceRevision: (commitSha) => verifySourceSnapshot(SOURCE, commitSha),
        outputDirectory: output,
        log: () => {},
      });
      expect(result.manifest.source.commitSha).toBe(PINNED_COMMIT);
      expect(result.coverage.integrity.brokenInternalLinks).toBe(0);
      expect(result.coverage.identity.pathCollisions).toEqual([]);
      expect(result.coverage.validationTargets).toEqual({
        'xrpl::STTx': 'xrpl/STTx',
        'xrpl::ReadView': 'xrpl/ReadView',
        'xrpl::ApplyContext': 'xrpl/ApplyContext',
        'xrpl::SHAMap': 'xrpl/SHAMap',
      });
      expect(result.coverage.corrections.map((correction) => correction.id)).toEqual(
        DOXYGEN_CORRECTIONS.map((correction) => correction.id),
      );
      expect(validatePublishedDataset(output).errors).toEqual([]);

      const searchIndexPath = join(output, PINNED_COMMIT, 'search-index.json');
      writeFileSync(
        searchIndexPath,
        readFileSync(searchIndexPath, 'utf8').replace('ApplyContext', 'ApplyContexx'),
      );
      expect(
        validatePublishedDataset(output).errors.some((error) => error.includes('does not match the hash')),
      ).toBe(true);
    } finally {
      rmSync(output, { recursive: true, force: true });
    }
  });

  it('refuses to build when the source snapshot does not match the extraction', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'xcr-tamper-'));
    try {
      cpSync(SOURCE, join(workspace, 'source'), { recursive: true });
      writeFileSync(join(workspace, 'source', 'include/xrpl/tx/ApplyContext.h'), '');
      await expect(
        buildDataset({
          extractionDirectory: EXTRACTION,
          sourceRoot: join(workspace, 'source'),
          verifySourceRevision: (commitSha) => verifySourceSnapshot(join(workspace, 'source'), commitSha),
          outputDirectory: join(workspace, 'out'),
          log: () => {},
        }),
      ).rejects.toThrow(/was modified/);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('is deterministic', () => {
    const again = resolveSymbols(
      normalizeExtraction({
        extractionDirectory: EXTRACTION,
        sourceRoot: SOURCE,
        includedCategories: ['production'],
      }),
    );
    expect(JSON.stringify(assembleDataset(again.records, PINNED_COMMIT))).toBe(
      JSON.stringify(assembleDataset(records, PINNED_COMMIT)),
    );
  });
});
