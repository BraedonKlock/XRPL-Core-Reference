#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { buildDataset, DatasetBuildError } from './build-dataset.js';
import { createPipelineConfig } from './config/pipeline-config.js';
import { extractDocumentation, extractionDirectoryFor } from './extraction/extract.js';
import { generateFixture } from './extraction/fixture-extraction.js';
import { assertCheckoutAtCommit, readHeadCommit } from './extraction/git-repository.js';
import { validatePublishedDataset } from './validation/validate-dataset.js';

const USAGE = `Usage: node scripts/documentation/cli.js <command> [options]

Commands:
  extract     Pin XRPLF/rippled develop and run Doxygen
  build       Build the dataset from an existing extraction
  generate    Extract and build
  validate    Validate the published dataset in public/data
  fixtures    Regenerate the rippled subset test fixture from the pinned checkout

Options:
  --commit <sha>          Pin a specific develop commit instead of the branch tip
  --categories <list>     Comma-separated source categories (default: production)
  --output <directory>    Dataset output directory (default: public/data)`;

const log = (message) => console.log(`[docs] ${message}`);

function parseCommandLine(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      commit: { type: 'string' },
      categories: { type: 'string' },
      output: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  return {
    command: positionals[0],
    help: values.help ?? false,
    config: createPipelineConfig({
      requestedCommit: values.commit,
      categories: values.categories?.split(',').map((category) => category.trim()),
      datasetOutputDirectory: values.output,
    }),
  };
}

async function build(config, commitSha) {
  const pinnedCommit = commitSha ?? config.requestedCommit ?? (await readHeadCommit(config.sourceCheckout));
  return buildDataset({
    extractionDirectory: extractionDirectoryFor(config.extractionsDirectory, pinnedCommit),
    sourceRoot: config.sourceCheckout,
    verifySourceRevision: (expectedCommit) => assertCheckoutAtCommit(config.sourceCheckout, expectedCommit),
    outputDirectory: config.datasetOutputDirectory,
    log,
  });
}

function summarizeBuild({ coverage }) {
  const { counts, documentation, references, identity, integrity, corrections } = coverage;
  log(
    `Symbols: ${counts.totalSymbols}; documented ${documentation.documentedSymbols}, undocumented ${documentation.undocumentedSymbols}, suppressed ${documentation.suppressedSymbols}`,
  );
  log(
    `References: ${references.resolved.doxygen} Doxygen + ${references.resolved.scope} scope links, ${references.unresolvedTotal} unresolved`,
  );
  log(
    `URL collisions: ${identity.pathCollisions.length}; broken internal links: ${integrity.brokenInternalLinks}`,
  );
  for (const correction of corrections) {
    log(`Correction ${correction.id}: ${correction.applied} applied, ${correction.unresolved} unresolved`);
  }
}

const COMMANDS = Object.freeze({
  async extract(config) {
    await extractDocumentation(config, log);
  },
  async build(config) {
    summarizeBuild(await build(config));
  },
  async generate(config) {
    const { record } = await extractDocumentation(config, log);
    summarizeBuild(await build(config, record.source.commitSha));
  },
  async validate(config) {
    const result = validatePublishedDataset(config.datasetOutputDirectory);
    log(`Validated ${result.symbolCount} symbols in ${result.shardCount} shards for ${result.commitSha}`);
    if (result.errors.length > 0) {
      result.errors.forEach((error) => console.error(`[docs] ${error}`));
      throw new Error('Published dataset failed validation');
    }
  },
  async fixtures(config) {
    await generateFixture({
      sourceCheckout: config.sourceCheckout,
      toolsDirectory: config.toolsDirectory,
      log,
    });
  },
});

async function main() {
  const { command, help, config } = parseCommandLine(process.argv.slice(2));
  if (help || !command || !(command in COMMANDS)) {
    console.log(USAGE);
    process.exitCode = help ? 0 : 1;
    return;
  }
  await COMMANDS[command](config);
}

main().catch((error) => {
  console.error(`[docs] ${error.message}`);
  if (error instanceof DatasetBuildError) {
    console.error(JSON.stringify(error.details, null, 2).slice(0, 20000));
  }
  process.exitCode = 1;
});
