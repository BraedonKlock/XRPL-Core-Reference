import { expect, test } from './support/test.js';
import { openPage } from './support/site.js';

test('a missing dataset pointer explains how to recover', async ({ page }) => {
  await page.route('**/data/current.json', (route) => route.fulfill({ status: 404, body: 'Not found' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('The documentation dataset could not be loaded');
  await expect(page.getByRole('alert')).toContainText('npm run docs:generate');
});

test('an invalid manifest is rejected with a clear message', async ({ page }) => {
  await page.route('**/manifest.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"schemaVersion":"1.0.0"}' }),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('does not match the data contract');
});

test('a failed network request for the search index is reported', async ({ page }) => {
  await page.route('**/search-index.json', (route) => route.abort('failed'));
  await page.goto('/symbols/xrpl/STTx');
  await expect(page.getByRole('alert')).toContainText('Could not reach');
});

test('a failed symbol file keeps the rest of the site working', async ({ page }) => {
  await openPage(page, '/');
  await page.route('**/symbols/*.json', (route) => route.fulfill({ status: 500, body: 'error' }));
  await page.goto('/symbols/xrpl/STTx');
  await expect(page.getByRole('alert')).toContainText('xrpl::STTx could not be loaded');
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Overview' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'XRPLD C++ Reference' })).toBeVisible();
});

test('a failed inheritance file only affects the inheritance section', async ({ page }) => {
  await page.route('**/relationships.json', (route) => route.fulfill({ status: 503, body: 'unavailable' }));
  await openPage(page, '/symbols/xrpl/STTx');
  await expect(page.getByRole('heading', { level: 1, name: 'STTx' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Inheritance' }).getByRole('alert')).toContainText(
    'Inheritance could not be loaded',
  );
  await expect(page.getByRole('region', { name: 'Inherited members' }).getByRole('alert')).toContainText(
    'Inheritance could not be loaded',
  );
  await expect(page.getByRole('table', { name: 'Methods', exact: true })).toBeVisible();
});

test('unknown URLs show a page instead of a blank screen', async ({ page }) => {
  for (const path of ['/symbols/', '/symbols/xrpl/STTx/not-a-member', '/totally/unknown']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('banner')).toBeVisible();
  }
});

test('a search without matches says so', async ({ page }) => {
  await openPage(page, '/search?q=zzzNoSuchSymbolzzz');
  await expect(page.getByRole('heading', { name: 'No matching symbols' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Search the reference' }).fill('zzzNoSuchSymbolzzz');
  await expect(page.getByText('No symbols match')).toBeVisible();
});
