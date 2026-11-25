import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { commitShaSchema } from '../../../contract/schema.js';
import { runCommand } from './run-command.js';

function git(checkout, args) {
  return runCommand('git', ['-C', checkout, ...args]);
}

export async function ensureCheckout({ checkout, repositoryUrl, branch }) {
  if (!existsSync(join(checkout, '.git'))) {
    await runCommand('git', ['clone', '--branch', branch, '--single-branch', repositoryUrl, checkout]);
  }
  await git(checkout, ['fetch', '--quiet', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`]);
}

async function isAncestorOfBranch(checkout, commitSha, branch) {
  try {
    await git(checkout, ['merge-base', '--is-ancestor', commitSha, `origin/${branch}`]);
    return true;
  } catch {
    return false;
  }
}

export async function resolveCommit({ checkout, branch, requestedCommit }) {
  if (!requestedCommit) {
    return commitShaSchema.parse(await git(checkout, ['rev-parse', '--verify', `origin/${branch}^{commit}`]));
  }
  await git(checkout, ['fetch', '--quiet', 'origin', requestedCommit]);
  const commitSha = commitShaSchema.parse(
    await git(checkout, ['rev-parse', '--verify', `${requestedCommit}^{commit}`]),
  );
  if (!(await isAncestorOfBranch(checkout, commitSha, branch))) {
    throw new Error(`Commit ${commitSha} is not reachable from origin/${branch}`);
  }
  return commitSha;
}

export async function readHeadCommit(checkout) {
  return commitShaSchema.parse(await git(checkout, ['rev-parse', 'HEAD']));
}

export async function assertCleanWorkingTree(checkout) {
  const status = await git(checkout, ['status', '--porcelain']);
  if (status.length > 0) {
    throw new Error(`Source checkout ${checkout} has local modifications:\n${status}`);
  }
}

export async function checkoutPinnedCommit(checkout, commitSha) {
  await git(checkout, ['checkout', '--quiet', '--detach', commitSha]);
  const headCommit = await readHeadCommit(checkout);
  if (headCommit !== commitSha) {
    throw new Error(`Checked-out commit ${headCommit} does not match pinned commit ${commitSha}`);
  }
  await assertCleanWorkingTree(checkout);
}

export async function assertCheckoutAtCommit(checkout, commitSha) {
  const headCommit = await readHeadCommit(checkout);
  if (headCommit !== commitSha) {
    throw new Error(`Source checkout is at ${headCommit}, but the dataset is pinned to ${commitSha}`);
  }
  await assertCleanWorkingTree(checkout);
}

export async function readCommitDate(checkout, commitSha) {
  return git(checkout, ['show', '-s', '--format=%cI', commitSha]);
}
