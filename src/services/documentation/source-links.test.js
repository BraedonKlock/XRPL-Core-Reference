import { describe, expect, it } from 'vitest';
import { commitUrl, shortCommitSha, sourceFileUrl } from './source-links.js';

const SOURCE = {
  webUrl: 'https://github.com/XRPLF/rippled',
  commitSha: 'c2534ff9c84422e00711da31629a76f3f59feb98',
};

describe('source links', () => {
  it('pins links to the documented commit', () => {
    expect(commitUrl(SOURCE)).toBe(
      'https://github.com/XRPLF/rippled/commit/c2534ff9c84422e00711da31629a76f3f59feb98',
    );
    expect(sourceFileUrl(SOURCE, { file: 'include/xrpl/tx/ApplyContext.h', line: 27 })).toBe(
      'https://github.com/XRPLF/rippled/blob/c2534ff9c84422e00711da31629a76f3f59feb98/include/xrpl/tx/ApplyContext.h#L27',
    );
  });

  it('omits the line anchor when the line is unknown and encodes file names', () => {
    expect(sourceFileUrl(SOURCE, { file: 'include/a b#.h', line: null })).toBe(
      'https://github.com/XRPLF/rippled/blob/c2534ff9c84422e00711da31629a76f3f59feb98/include/a%20b%23.h',
    );
    expect(shortCommitSha(SOURCE.commitSha)).toBe('c2534ff');
  });
});
