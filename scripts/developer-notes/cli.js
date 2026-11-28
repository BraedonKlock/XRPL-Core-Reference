#!/usr/bin/env node
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { validateDeveloperNotes } from './validate-notes.js';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const log = (message) => console.log(`[notes] ${message}`);

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { notes: { type: 'string' }, data: { type: 'string' } },
  });
  const result = await validateDeveloperNotes({
    notesDirectory: resolve(values.notes ?? join(PROJECT_ROOT, 'developer-notes')),
    dataDirectory: resolve(values.data ?? join(PROJECT_ROOT, 'public', 'data')),
  });
  log(`Checked ${result.entryCount} entries in ${result.fileCount} files against ${result.commitSha}`);
  result.warnings.forEach((warning) => console.warn(`[notes] warning: ${warning}`));
  if (result.errors.length > 0) {
    result.errors.forEach((error) => console.error(`[notes] error: ${error}`));
    throw new Error(`Developer notes failed validation with ${result.errors.length} errors`);
  }
}

main().catch((error) => {
  console.error(`[notes] ${error.message}`);
  process.exitCode = 1;
});
