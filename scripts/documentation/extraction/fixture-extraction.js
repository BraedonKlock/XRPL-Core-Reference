import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXTRACTION_FILES, PROJECT_PATHS } from '../config/pipeline-config.js';
import { ensureDoxygen } from './doxygen-installation.js';
import { runDoxygen } from './doxygen-runner.js';
import { writeExtractionRecord } from './extraction-record.js';
import { createSourceRevision } from './extract.js';
import { assertCheckoutAtCommit, readCommitDate, readHeadCommit } from './git-repository.js';
import { copySourceSnapshot } from './source-snapshot.js';

export const FIXTURE_INPUT_FILES = Object.freeze([
  'include/xrpl/basics/base_uint.h',
  'include/xrpl/basics/contract.h',
  'include/xrpl/basics/scope.h',
  'include/xrpl/beast/container/detail/aged_ordered_container.h',
  'include/xrpl/consensus/Validations.h',
  'include/xrpl/ledger/ApplyView.h',
  'include/xrpl/ledger/OpenView.h',
  'include/xrpl/ledger/ReadView.h',
  'include/xrpl/protocol/Feature.h',
  'include/xrpl/protocol/IOUAmount.h',
  'include/xrpl/protocol/LedgerFormats.h',
  'include/xrpl/protocol/Rate.h',
  'include/xrpl/protocol/SField.h',
  'include/xrpl/protocol/STInteger.h',
  'include/xrpl/protocol/STTx.h',
  'include/xrpl/protocol/TER.h',
  'include/xrpl/protocol/TxFormats.h',
  'include/xrpl/protocol/jss.h',
  'include/xrpl/shamap/SHAMap.h',
  'include/xrpl/tx/ApplyContext.h',
  'src/libxrpl/protocol/Feature.cpp',
  'src/libxrpl/protocol/Rate2.cpp',
  'src/libxrpl/protocol/SField.cpp',
  'src/libxrpl/protocol/STInteger.cpp',
  'src/libxrpl/tx/ApplyContext.cpp',
]);

export const FIXTURE_INCLUDED_FILES = Object.freeze([
  'include/xrpl/protocol/detail/features.macro',
  'include/xrpl/protocol/detail/ledger_entries.macro',
  'include/xrpl/protocol/detail/permissions.macro',
  'include/xrpl/protocol/detail/sfields.macro',
  'include/xrpl/protocol/detail/transactions.macro',
]);

const LICENSE_FILE = 'LICENSE.md';
const MACHINE_SPECIFIC_XML_FILE = 'Doxyfile.xml';

function replaceInFile(path, searchText) {
  writeFileSync(path, readFileSync(path, 'utf8').replaceAll(searchText, ''));
}

function removeMachineSpecificPaths(extractionDirectory, sourceCheckout) {
  const xmlDirectory = join(extractionDirectory, EXTRACTION_FILES.xmlDirectory);
  rmSync(join(xmlDirectory, MACHINE_SPECIFIC_XML_FILE), { force: true });
  const checkoutPrefix = `${sourceCheckout}/`;
  for (const file of readdirSync(xmlDirectory).filter((name) => name.endsWith('.xml'))) {
    replaceInFile(join(xmlDirectory, file), checkoutPrefix);
  }
  replaceInFile(join(extractionDirectory, EXTRACTION_FILES.warningLog), checkoutPrefix);
}

export async function generateFixture({
  sourceCheckout,
  toolsDirectory,
  fixtureDirectory = PROJECT_PATHS.fixtureDirectory,
  log,
}) {
  const commitSha = await readHeadCommit(sourceCheckout);
  await assertCheckoutAtCommit(sourceCheckout, commitSha);
  const doxygen = await ensureDoxygen(toolsDirectory);
  rmSync(fixtureDirectory, { recursive: true, force: true });
  const extractionDirectory = join(fixtureDirectory, 'extraction');
  const run = await runDoxygen({
    binary: doxygen.binary,
    overlay: PROJECT_PATHS.doxygenOverlay,
    sourceCheckout,
    outputDirectory: extractionDirectory,
    inputs: [...FIXTURE_INPUT_FILES],
  });
  removeMachineSpecificPaths(extractionDirectory, sourceCheckout);
  writeExtractionRecord(extractionDirectory, {
    source: createSourceRevision(commitSha, await readCommitDate(sourceCheckout, commitSha)),
    extractedAt: new Date().toISOString(),
    doxygenVersion: doxygen.version,
    doxygenConfigSha256: run.configSha256,
    categories: ['production'],
    inputs: [...FIXTURE_INPUT_FILES],
  });
  const snapshotDirectory = join(fixtureDirectory, 'source');
  copySourceSnapshot({
    sourceCheckout,
    snapshotDirectory,
    files: [...FIXTURE_INPUT_FILES, ...FIXTURE_INCLUDED_FILES, LICENSE_FILE],
    commitSha,
  });
  log(`Generated rippled subset fixture from ${commitSha} in ${fixtureDirectory}`);
  return { commitSha, fixtureDirectory };
}
