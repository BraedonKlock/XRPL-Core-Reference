import { expect, test } from './support/test.js';
import { isCompactLayout, openPage, useTheme } from './support/site.js';

const LONG_CLASS_PATH =
  '/symbols/xrpl/detail/IsContiguousContainer%3CContainer%2Cstd%3A%3Avoid_t%3Cdecltype%28std%3A%3Adeclval%3CContainer_const%3E%28%29.size%28%29%29%2Cdecltype%28std%3A%3Adeclval%3CContainer_const%3E%28%29.data%28%29%29%2Ctypename_Container%3A%3Avalue_type%3E%3E';
const LONG_DECLARATION_PATH =
  '/symbols/xrpl/transactions/ConfidentialMPTSendBuilder/ConfidentialMPTSendBuilder/31c12b27';
const LAYOUT_PAGES = Object.freeze([
  '/',
  '/symbols/xrpl/ApplyContext',
  '/symbols/xrpl/STTx',
  LONG_CLASS_PATH,
  LONG_DECLARATION_PATH,
  '/search?q=Apply',
]);

async function horizontalOverflow(page) {
  return page.evaluate(() => ({
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    code: Math.max(
      0,
      ...[...document.querySelectorAll('pre')].map((element) => element.scrollWidth - element.clientWidth),
    ),
    headings: Math.max(
      0,
      ...[...document.querySelectorAll('h1')].map(
        (element) => element.getBoundingClientRect().right - window.innerWidth,
      ),
    ),
  }));
}

for (const path of LAYOUT_PAGES) {
  test(`${decodeURIComponent(path).slice(0, 60)} fits the viewport without horizontal overflow`, async ({
    page,
  }) => {
    await openPage(page, path);
    const overflow = await horizontalOverflow(page);
    expect(overflow.page).toBeLessThanOrEqual(1);
    expect(overflow.code).toBeLessThanOrEqual(1);
    expect(overflow.headings).toBeLessThanOrEqual(1);
  });
}

test('member tables use columns on wide screens and stacked rows on phones', async ({ page }) => {
  await openPage(page, '/symbols/xrpl/ApplyContext');
  const cellDisplay = await page
    .getByRole('table', { name: 'Methods' })
    .locator('tbody td')
    .first()
    .evaluate((cell) => window.getComputedStyle(cell).display);
  const viewportWidth = page.viewportSize().width;
  expect(cellDisplay).toBe(viewportWidth <= 640 ? 'block' : 'table-cell');
});

test('search works at every screen size', async ({ page }) => {
  await openPage(page, '/');
  const search = page.getByRole('combobox', { name: 'Search the reference' });
  await search.fill('SHAMap');
  await page.getByRole('option').first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'SHAMap' })).toBeVisible();
});

test('navigation is reachable at every screen size', async ({ page }) => {
  await openPage(page, '/');
  if (await isCompactLayout(page)) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
  }
  await expect(page.getByRole('navigation', { name: 'Namespaces and classes' })).toBeVisible();
});

test('the dark theme applies its colour tokens', async ({ page }) => {
  await useTheme(page, 'dark');
  await openPage(page, '/symbols/xrpl/ApplyContext');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const colours = await page.evaluate(() => ({
    page: window.getComputedStyle(document.body).backgroundColor,
    text: window.getComputedStyle(document.body).color,
  }));
  expect(colours).toEqual({ page: 'rgb(15, 20, 25)', text: 'rgb(230, 237, 243)' });
});
