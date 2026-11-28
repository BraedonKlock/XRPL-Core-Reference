import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './support/test.js';
import { openPage } from './support/site.js';

const OVERLOAD_SET_PAGE = '/symbols/xrpl/isXRP';
const ENTRY = JSON.parse(readFileSync(join(process.cwd(), 'developer-notes', 'xrpl', 'isXRP.json'), 'utf8'));
const PURPOSE = ENTRY.purpose.replaceAll('`', '');
const IMPORTANT_NOTES = ENTRY.importantNotes.replaceAll('`', '');

function publishedExampleTitles(signature) {
  return (ENTRY.examples ?? [])
    .filter((example) => example.signature === signature && !example.draft)
    .map((example) => example.title);
}

async function expectSharedNotes(page) {
  await page.getByRole('button', { name: 'Developer notes' }).click();
  const notes = page.getByRole('region', { name: 'Developer notes' });
  await expect(notes.getByRole('heading', { level: 3 })).toHaveText(['Purpose', 'Important notes']);
  await expect(notes).toContainText(PURPOSE);
  await expect(notes).toContainText(IMPORTANT_NOTES);
  await expect(notes.getByRole('group')).toHaveCount(0);
}

test.describe('developer notes in the production build', () => {
  test('the isXRP entry is shared by the overload set and every overload', async ({ page }) => {
    await openPage(page, OVERLOAD_SET_PAGE);
    await expectSharedNotes(page);
    await expect(page.getByRole('button', { name: 'Code examples' })).toHaveCount(0);
    const overloadLinks = page.getByRole('table', { name: 'Overloads' }).getByRole('link');
    await expect(overloadLinks).toHaveCount(7);
    const overloadPaths = await overloadLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href')),
    );
    expect(new Set(overloadPaths).size).toBe(7);
    for (const path of overloadPaths) {
      await openPage(page, path);
      await expectSharedNotes(page);
    }
  });

  test('each overload shows only its own published examples', async ({ page }) => {
    const expectations = {
      '/symbols/xrpl/isXRP/e049e68b': publishedExampleTitles('xrpl::isXRP(AccountID const&)'),
      '/symbols/xrpl/isXRP/6b2a4439': publishedExampleTitles('xrpl::isXRP(Asset const&)'),
      '/symbols/xrpl/isXRP/3fe368bf': publishedExampleTitles('xrpl::isXRP(Issue const&)'),
      '/symbols/xrpl/isXRP/690f80e4': publishedExampleTitles('xrpl::isXRP(MPTID const&)'),
      '/symbols/xrpl/isXRP/8655f753': publishedExampleTitles('xrpl::isXRP(PathAsset const&)'),
      '/symbols/xrpl/isXRP/b0da76a2': publishedExampleTitles('xrpl::isXRP(STAmount const&)'),
      '/symbols/xrpl/isXRP/b3aa262f': publishedExampleTitles('xrpl::isXRP(Currency const&)'),
    };
    for (const [path, titles] of Object.entries(expectations)) {
      await openPage(page, path);
      await expect(page.getByRole('button', { name: 'Developer notes' })).toBeVisible();
      const toggle = page.getByRole('button', { name: 'Code examples' });
      if (titles.length === 0) {
        await expect(toggle).toHaveCount(0);
      } else {
        await toggle.click();
        await expect(
          page.getByRole('region', { name: 'Code examples' }).getByRole('heading', { level: 3 }),
        ).toHaveText(titles);
      }
    }
  });

  test('pages without notes have no developer sections', async ({ page }) => {
    await openPage(page, '/symbols/xrpl/ApplyContext');
    await expect(page.getByRole('heading', { level: 2, name: 'Description' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Developer notes' })).toHaveCount(0);
  });
});
