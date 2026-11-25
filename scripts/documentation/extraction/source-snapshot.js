import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as z from 'zod/mini';
import { commitShaSchema } from '../../../contract/schema.js';

export const SOURCE_SNAPSHOT_FILE = 'source-snapshot.json';

const sourceSnapshotSchema = z.strictObject({
  commitSha: commitShaSchema,
  files: z.record(z.string().check(z.minLength(1)), z.string().check(z.regex(/^[0-9a-f]{64}$/))),
});

function sha256Of(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function copySourceSnapshot({ sourceCheckout, snapshotDirectory, files, commitSha }) {
  const hashes = {};
  for (const file of [...files].sort()) {
    const destination = join(snapshotDirectory, file);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(sourceCheckout, file), destination);
    hashes[file] = sha256Of(destination);
  }
  const snapshot = sourceSnapshotSchema.parse({ commitSha, files: hashes });
  writeFileSync(join(snapshotDirectory, SOURCE_SNAPSHOT_FILE), `${JSON.stringify(snapshot, null, 2)}\n`);
  return snapshot;
}

export function verifySourceSnapshot(snapshotDirectory, expectedCommitSha) {
  const snapshot = sourceSnapshotSchema.parse(
    JSON.parse(readFileSync(join(snapshotDirectory, SOURCE_SNAPSHOT_FILE), 'utf8')),
  );
  if (snapshot.commitSha !== expectedCommitSha) {
    throw new Error(
      `Source snapshot is from ${snapshot.commitSha}, but the extraction is pinned to ${expectedCommitSha}`,
    );
  }
  for (const [file, expectedHash] of Object.entries(snapshot.files)) {
    if (sha256Of(join(snapshotDirectory, file)) !== expectedHash) {
      throw new Error(`Source snapshot file ${file} was modified`);
    }
  }
}
