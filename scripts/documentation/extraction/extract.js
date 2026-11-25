import { join } from 'node:path';
import { SOURCE_REPOSITORY } from '../../../contract/constants.js';
import { PROJECT_PATHS } from '../config/pipeline-config.js';
import { inputsForCategories } from '../config/source-categories.js';
import { ensureDoxygen } from './doxygen-installation.js';
import { runDoxygen } from './doxygen-runner.js';
import { writeExtractionRecord } from './extraction-record.js';
import {
  assertCheckoutAtCommit,
  checkoutPinnedCommit,
  ensureCheckout,
  readCommitDate,
  resolveCommit,
} from './git-repository.js';

export function extractionDirectoryFor(extractionsDirectory, commitSha) {
  return join(extractionsDirectory, commitSha);
}

export function createSourceRevision(commitSha, commitDate) {
  return {
    repository: SOURCE_REPOSITORY.name,
    repositoryUrl: SOURCE_REPOSITORY.url,
    webUrl: SOURCE_REPOSITORY.webUrl,
    branch: SOURCE_REPOSITORY.branch,
    commitSha,
    commitDate,
  };
}

export async function extractDocumentation(config, log) {
  const doxygen = await ensureDoxygen(config.toolsDirectory);
  log(`Using Doxygen ${doxygen.version}`);
  await ensureCheckout({
    checkout: config.sourceCheckout,
    repositoryUrl: SOURCE_REPOSITORY.url,
    branch: SOURCE_REPOSITORY.branch,
  });
  const commitSha = await resolveCommit({
    checkout: config.sourceCheckout,
    branch: SOURCE_REPOSITORY.branch,
    requestedCommit: config.requestedCommit,
  });
  log(`Pinned ${SOURCE_REPOSITORY.name}@${SOURCE_REPOSITORY.branch} to ${commitSha}`);
  await checkoutPinnedCommit(config.sourceCheckout, commitSha);

  const inputs = inputsForCategories(config.categories);
  const extractionDirectory = extractionDirectoryFor(config.extractionsDirectory, commitSha);
  const run = await runDoxygen({
    binary: doxygen.binary,
    overlay: PROJECT_PATHS.doxygenOverlay,
    sourceCheckout: config.sourceCheckout,
    outputDirectory: extractionDirectory,
    inputs,
  });
  await assertCheckoutAtCommit(config.sourceCheckout, commitSha);

  const record = writeExtractionRecord(extractionDirectory, {
    source: createSourceRevision(commitSha, await readCommitDate(config.sourceCheckout, commitSha)),
    extractedAt: new Date().toISOString(),
    doxygenVersion: doxygen.version,
    doxygenConfigSha256: run.configSha256,
    categories: [...config.categories],
    inputs,
  });
  log(`Extracted Doxygen XML into ${extractionDirectory}`);
  return { extractionDirectory, record };
}
