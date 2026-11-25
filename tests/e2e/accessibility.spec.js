import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { isCompactLayout, openPage, THEMES, useTheme } from './support/site.js';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const AUDITED_PAGES = Object.freeze([
  ['overview', '/'],
  ['class', '/symbols/xrpl/ApplyContext'],
  ['class with inheritance', '/symbols/xrpl/STTx'],
  ['method', '/symbols/xrpl/ApplyContext/view'],
  ['enum', '/symbols/xrpl/TERcodes'],
  ['search results', '/search?q=Payment'],
  ['missing symbol', '/symbols/xrpl/DoesNotExist'],
  ['missing page', '/no-such-page'],
]);

async function expectNoViolations(page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(
    violations.map(
      (violation) =>
        `${violation.id}: ${violation.nodes
          .map((node) => node.target.join(' '))
          .slice(0, 3)
          .join(', ')}`,
    ),
  ).toEqual([]);
}

test.describe('@a11y automated audit', () => {
  test.skip(({ browserName }) => browserName === 'webkit', 'axe results are audited in Chromium and Firefox');

  for (const theme of THEMES) {
    for (const [name, path] of AUDITED_PAGES) {
      test(`${name} page has no WCAG violations in the ${theme} theme`, async ({ page }) => {
        await useTheme(page, theme);
        await openPage(page, path);
        await expectNoViolations(page);
      });
    }

    test(`open search suggestions have no WCAG violations in the ${theme} theme`, async ({ page }) => {
      await useTheme(page, theme);
      await openPage(page, '/');
      await page.getByRole('combobox', { name: 'Search the reference' }).fill('ApplyContext');
      await page.getByRole('option').first().waitFor();
      await expectNoViolations(page);
    });

    test(`the open navigation drawer has no WCAG violations in the ${theme} theme`, async ({ page }) => {
      await useTheme(page, theme);
      await openPage(page, '/');
      test.skip(!(await isCompactLayout(page)), 'The drawer only exists on narrow screens');
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await expect(page.getByRole('complementary', { name: 'Symbol navigation' })).toBeVisible();
      await expectNoViolations(page);
    });
  }

  test('the largest namespace page has no WCAG violations', async ({ page }) => {
    test.setTimeout(120000);
    await openPage(page, '/symbols/xrpl');
    await expectNoViolations(page);
  });
});

test.describe('@a11y keyboard access', () => {
  test('the skip link is the first stop and moves focus to the content', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit does not tab to links by default');
    await openPage(page, '/symbols/xrpl/STTx');
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to content' });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
  });

  test('keyboard focus is clearly visible', async ({ page }) => {
    await openPage(page, '/');
    await page.getByRole('combobox', { name: 'Search the reference' }).focus();
    await page.keyboard.press('Shift+Tab');
    const focused = page.locator(':focus');
    const outline = await focused.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    expect(outline.style).not.toBe('none');
    expect(outline.width).toBeGreaterThanOrEqual(2);
  });

  test('the namespace tree can be operated with the keyboard', async ({ page }) => {
    await openPage(page, '/');
    if (await isCompactLayout(page)) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
    }
    const toggle = page.getByRole('button', { name: 'Expand xrpl' });
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Collapse xrpl' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const applyContext = page.getByRole('link', { name: 'ApplyContext class', exact: true });
    await applyContext.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'ApplyContext' })).toBeVisible();
  });

  test('member tables expose headers and names to assistive technology', async ({ page }) => {
    await openPage(page, '/symbols/xrpl/ApplyContext');
    const methods = page.getByRole('table', { name: 'Methods' });
    await expect(methods.getByRole('columnheader', { name: 'Name' })).toBeAttached();
    await expect(methods.getByRole('columnheader', { name: 'Description' })).toBeAttached();
  });

  test('closing the navigation drawer with Escape returns focus to the menu button', async ({ page }) => {
    await openPage(page, '/');
    test.skip(!(await isCompactLayout(page)), 'The drawer only exists on narrow screens');
    const menuButton = page.getByRole('button', { name: 'Open navigation' });
    await menuButton.click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('complementary', { name: 'Symbol navigation' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
  });
});
