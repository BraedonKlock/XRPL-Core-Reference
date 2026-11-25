import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOXYGEN_RELEASE } from '../config/pipeline-config.js';
import { runCommand } from './run-command.js';

export function doxygenBinaryPath(toolsDirectory) {
  return join(toolsDirectory, DOXYGEN_RELEASE.archiveRootDirectory, 'bin', 'doxygen');
}

export function verifyArchiveChecksum(archiveBytes, expectedSha256) {
  const actualSha256 = createHash('sha256').update(archiveBytes).digest('hex');
  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `Doxygen archive checksum mismatch: expected ${expectedSha256}, received ${actualSha256}`,
    );
  }
}

async function downloadArchive(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download Doxygen from ${url}: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function readDoxygenVersion(binary) {
  return runCommand(binary, ['--version']);
}

async function assertExpectedVersion(binary) {
  const version = await readDoxygenVersion(binary);
  if (!version.startsWith(`${DOXYGEN_RELEASE.version} `) && version !== DOXYGEN_RELEASE.version) {
    throw new Error(`Expected Doxygen ${DOXYGEN_RELEASE.version}, found ${version}`);
  }
  return version;
}

export async function ensureDoxygen(toolsDirectory) {
  const binary = doxygenBinaryPath(toolsDirectory);
  if (!existsSync(binary)) {
    mkdirSync(toolsDirectory, { recursive: true });
    const archiveBytes = await downloadArchive(DOXYGEN_RELEASE.archiveUrl);
    verifyArchiveChecksum(archiveBytes, DOXYGEN_RELEASE.archiveSha256);
    const archivePath = join(toolsDirectory, 'doxygen.tar.gz');
    writeFileSync(archivePath, archiveBytes);
    rmSync(join(toolsDirectory, DOXYGEN_RELEASE.archiveRootDirectory), { recursive: true, force: true });
    await runCommand('tar', ['-xzf', archivePath, '-C', toolsDirectory]);
    rmSync(archivePath);
  }
  return { binary, version: await assertExpectedVersion(binary) };
}
