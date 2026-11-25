import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertCheckoutAtCommit,
  checkoutPinnedCommit,
  ensureCheckout,
  readCommitDate,
  readHeadCommit,
  resolveCommit,
} from './git-repository.js';

const TEST_GIT_IDENTITY = [
  '-c',
  'user.name=Pipeline Test',
  '-c',
  'user.email=pipeline@example.invalid',
  '-c',
  'commit.gpgsign=false',
];

function git(directory, ...args) {
  return execFileSync('git', ['-C', directory, ...TEST_GIT_IDENTITY, ...args], { encoding: 'utf8' }).trim();
}

function commitFile(directory, name, content) {
  writeFileSync(join(directory, name), content);
  git(directory, 'add', name);
  git(directory, 'commit', '--quiet', '-m', `Add ${name}`);
  return git(directory, 'rev-parse', 'HEAD');
}

describe('git repository pinning', () => {
  let workspace;
  let origin;
  let checkout;
  const commits = {};

  beforeAll(() => {
    workspace = mkdtempSync(join(tmpdir(), 'xcr-git-'));
    origin = join(workspace, 'origin');
    checkout = join(workspace, 'checkout');
    execFileSync('git', ['init', '--quiet', '--initial-branch=develop', origin]);
    commits.first = commitFile(origin, 'a.h', 'first');
    commits.second = commitFile(origin, 'a.h', 'second');
    git(origin, 'checkout', '--quiet', '-b', 'feature');
    commits.feature = commitFile(origin, 'b.h', 'feature');
    git(origin, 'checkout', '--quiet', 'develop');
  });

  afterAll(() => rmSync(workspace, { recursive: true, force: true }));

  it('clones the branch and resolves its tip', async () => {
    await ensureCheckout({ checkout, repositoryUrl: origin, branch: 'develop' });
    expect(await resolveCommit({ checkout, branch: 'develop', requestedCommit: null })).toBe(commits.second);
  });

  it('pins a requested commit that belongs to the branch', async () => {
    const pinned = await resolveCommit({ checkout, branch: 'develop', requestedCommit: commits.first });
    expect(pinned).toBe(commits.first);
    await checkoutPinnedCommit(checkout, pinned);
    expect(await readHeadCommit(checkout)).toBe(commits.first);
    expect(await readCommitDate(checkout, pinned)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('rejects commits that are not on the branch', async () => {
    await expect(
      resolveCommit({ checkout, branch: 'develop', requestedCommit: commits.feature }),
    ).rejects.toThrow(/not reachable/);
  });

  it('rejects a checkout that moved or has local modifications', async () => {
    await expect(assertCheckoutAtCommit(checkout, commits.second)).rejects.toThrow(/dataset is pinned/);
    writeFileSync(join(checkout, 'a.h'), 'modified');
    await expect(assertCheckoutAtCommit(checkout, commits.first)).rejects.toThrow(/local modifications/);
  });
});
