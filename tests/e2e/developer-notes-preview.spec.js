import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from './support/test.js';
import { THEMES, useTheme } from './support/site.js';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const NOTED_PAGE = '/symbols/xrpl/isXRP/6b2a4439';
const SECTION_NAMES = Object.freeze(['Developer notes', 'Code examples']);
const DEV_SERVER_TEST_TIMEOUT_MS = 90000;
const DEV_SERVER_LOAD_TIMEOUT_MS = 60000;
const NOTE_SOURCES_MODULE = '**/src/features/developer-notes/services/note-sources.js*';
const FIXTURE_NOTES = Object.freeze({
  '/developer-notes/xrpl/isXRP.json': {
    schemaVersion: 2,
    symbol: 'xrpl::isXRP',
    purpose: 'Fixture purpose shared by every isXRP overload.',
    importantNotes: 'Fixture note linking to [`Asset::native`](symbol:xrpl::Asset::native()const).',
    examples: [
      {
        signature: 'xrpl::isXRP(Asset const&)',
        title: 'Fixture Asset example',
        explanation: 'Fixture explanation with `inline code`.',
        code: 'Asset const asset{xrpIssue()};\nbool const native = isXRP(asset);',
      },
      {
        signature: 'xrpl::isXRP(Asset const&)',
        title: 'Fixture draft example',
        draft: true,
        code: 'bool const viaMember = asset.native();',
      },
      {
        signature: 'xrpl::isXRP(Issue const&)',
        title: 'Fixture Issue example',
        code: 'bool const native = isXRP(issue);',
      },
    ],
  },
});

async function openNotedPage(page) {
  await page.route(NOTE_SOURCES_MODULE, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript; charset=utf-8',
      body: `export const NOTE_SOURCES = ${JSON.stringify(FIXTURE_NOTES)};\n`,
    }),
  );
  await page.goto(NOTED_PAGE);
  await page
    .getByRole('button', { name: SECTION_NAMES[0] })
    .waitFor({ state: 'visible', timeout: DEV_SERVER_LOAD_TIMEOUT_MS });
}

async function expandWithKeyboard(page, name) {
  const toggle = page.getByRole('button', { name });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  return page.getByRole('region', { name });
}

test.describe('developer notes in the authoring preview', () => {
  test.describe.configure({ timeout: DEV_SERVER_TEST_TIMEOUT_MS });

  for (const theme of THEMES) {
    test(`@a11y expanded developer sections have no WCAG violations in the ${theme} theme`, async ({
      page,
      browserName,
    }) => {
      test.skip(browserName === 'webkit', 'axe results are audited in Chromium and Firefox');
      await useTheme(page, theme);
      await openNotedPage(page);
      for (const name of SECTION_NAMES) {
        await expandWithKeyboard(page, name);
      }
      await expect(page.getByText('Fixture purpose shared by every isXRP overload.')).toBeVisible();
      await expect(page.getByText('Draft example.', { exact: false })).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(violations.map((violation) => violation.id)).toEqual([]);
    });

    test(`code examples are highlighted with theme colours in the ${theme} theme`, async ({ page }) => {
      await useTheme(page, theme);
      await openNotedPage(page);
      const examples = await expandWithKeyboard(page, 'Code examples');
      const colours = await examples
        .locator('pre')
        .first()
        .evaluate((pre) => {
          const keyword = [...pre.querySelectorAll('span')].find((span) => span.textContent === 'const');
          const value = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
          return {
            keyword: getComputedStyle(keyword).color,
            text: getComputedStyle(pre).color,
            expected: value('--color-syntax-keyword'),
          };
        });
      expect(colours.keyword).not.toBe(colours.text);
      expect(colours.expected).toBe(theme === 'dark' ? '#ff7b72' : '#b31d28');
    });
  }

  test('expanded sections fit the viewport without horizontal overflow', async ({ page }) => {
    await openNotedPage(page);
    for (const name of SECTION_NAMES) {
      await expandWithKeyboard(page, name);
    }
    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      code: Math.max(
        0,
        ...[...document.querySelectorAll('pre')].map((pre) => pre.scrollWidth - pre.clientWidth),
      ),
    }));
    expect(overflow.page).toBeLessThanOrEqual(1);
    expect(overflow.code).toBeLessThanOrEqual(1);
  });

  test('the copy button puts the example code on the clipboard', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Clipboard permissions can be granted only in Chromium');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openNotedPage(page);
    const examples = await expandWithKeyboard(page, 'Code examples');
    const code = await examples.locator('pre').first().textContent();
    await examples.getByRole('button', { name: 'Copy' }).first().click();
    await expect(examples.getByRole('button', { name: 'Copied' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  });

  test('the overload page shows the shared notes and only its own examples', async ({ page }) => {
    await openNotedPage(page);
    const notes = await expandWithKeyboard(page, 'Developer notes');
    await expect(notes.getByRole('heading', { level: 3 })).toHaveText(['Purpose', 'Important notes']);
    const examples = await expandWithKeyboard(page, 'Code examples');
    await expect(examples.getByRole('heading', { level: 3 })).toHaveText([
      'Fixture Asset example',
      'Fixture draft example',
    ]);
    await expect(examples.getByText('Fixture Issue example')).toHaveCount(0);
  });

  test('symbol links in notes open their reference pages', async ({ page }) => {
    await openNotedPage(page);
    const notes = await expandWithKeyboard(page, 'Developer notes');
    await notes.getByRole('link', { name: 'Asset::native' }).click();
    await expect(page).toHaveURL(/\/symbols\/xrpl\/Asset\/native\/231b0681$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('native');
  });
});
