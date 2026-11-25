import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { EXTRACTION_FILES, SOURCE_FILE_PATTERNS, X_MACRO_DEFINERS } from '../config/pipeline-config.js';
import { runCommand } from './run-command.js';

const UPSTREAM_DOXYFILE = join('docs', 'Doxyfile');

export function createDoxygenEnvironment({ sourceCheckout, outputDirectory, inputs }) {
  return {
    XCR_DOXYGEN_OUTPUT_DIRECTORY: outputDirectory,
    XCR_SOURCE_ROOT: sourceCheckout,
    XCR_DOXYGEN_INPUT: inputs.join(' '),
    XCR_DOXYGEN_FILE_PATTERNS: SOURCE_FILE_PATTERNS.join(' '),
    XCR_DOXYGEN_EXPAND_AS_DEFINED: X_MACRO_DEFINERS.join(' '),
  };
}

export function computeDoxygenConfigSha256({ overlayText, upstreamDoxyfileText, inputs }) {
  return createHash('sha256')
    .update(
      JSON.stringify({ overlayText, upstreamDoxyfileText, inputs, SOURCE_FILE_PATTERNS, X_MACRO_DEFINERS }),
    )
    .digest('hex');
}

export async function runDoxygen({ binary, overlay, sourceCheckout, outputDirectory, inputs }) {
  rmSync(outputDirectory, { recursive: true, force: true });
  mkdirSync(outputDirectory, { recursive: true });
  const environment = createDoxygenEnvironment({ sourceCheckout, outputDirectory, inputs });
  await runCommand(binary, [overlay], { cwd: sourceCheckout, env: environment });
  return {
    xmlDirectory: join(outputDirectory, EXTRACTION_FILES.xmlDirectory),
    warningLog: join(outputDirectory, EXTRACTION_FILES.warningLog),
    configSha256: computeDoxygenConfigSha256({
      overlayText: readFileSync(overlay, 'utf8'),
      upstreamDoxyfileText: readFileSync(join(sourceCheckout, UPSTREAM_DOXYFILE), 'utf8'),
      inputs,
    }),
  };
}
