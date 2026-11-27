import { expect, test } from './support/test.js';

async function collectFailures(page) {
  const failures = [];
  page.on('requestfailed', (request) => failures.push(`${request.url()} ${request.failure()?.errorText}`));
  page.on('response', (response) => {
    if (response.status() >= 400 && response.request().resourceType() !== 'document') {
      failures.push(`${response.url()} HTTP ${response.status()}`);
    }
  });
  return failures;
}

test('direct navigation to a class URL works without server rewrites', async ({ page }) => {
  const failures = await collectFailures(page);
  const response = await page.goto('symbols/xrpl/ApplyContext');
  expect(response.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'ApplyContext' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Methods' })).toBeVisible();
  expect(failures).toEqual([]);
});

test('refreshing a method page keeps the page', async ({ page }) => {
  await page.goto('symbols/xrpl/ApplyContext/view');
  await page.getByRole('table', { name: 'Overloads' }).getByRole('link', { name: 'view() const' }).click();
  await expect(page).toHaveURL(/\/XRPL-Core-Reference\/symbols\/xrpl\/ApplyContext\/view\/[0-9a-f]{8}$/);
  await page.reload();
  await expect(page.getByLabel('Declaration of view')).toContainText('view() const');
});

test('assets, favicon and the dataset load from the repository sub-path', async ({ page, request }) => {
  const failures = await collectFailures(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'XRPLD C++ Reference' })).toBeVisible();
  const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(favicon).toMatch(/^\/XRPL-Core-Reference\/assets\//);
  expect((await request.get(favicon)).ok()).toBe(true);
  const pointer = await (await request.get('data/current.json')).json();
  await expect(page.getByRole('link', { name: pointer.commitSha })).toBeVisible();
  expect(failures).toEqual([]);
});

test('in-app links stay under the repository sub-path', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('list', { name: 'Core types' }).getByRole('link', { name: 'STTx' }).click();
  await expect(page).toHaveURL(/\/XRPL-Core-Reference\/symbols\/xrpl\/STTx$/);
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Overview' }).click();
  await expect(page).toHaveURL(/\/XRPL-Core-Reference\/$/);
});

test('a malformed URL still renders the site with a helpful message', async ({ page }) => {
  await page.goto('symbols/xrpl/%E0%A4%A');
  await expect(page.getByRole('heading', { level: 1, name: 'Symbol not found' })).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();
});

test('the GitHub Pages build does not load Cloudflare Web Analytics', async ({ page, request }) => {
  const analyticsRequests = [];
  page.on('request', (pageRequest) => {
    if (pageRequest.url().includes('cloudflareinsights.com')) {
      analyticsRequests.push(pageRequest.url());
    }
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'XRPLD C++ Reference' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(analyticsRequests).toEqual([]);
  for (const path of ['./', 'symbols/xrpl/ApplyContext']) {
    expect(await (await request.get(path)).text(), path).not.toContain('cloudflareinsights');
  }
});

test('development-only files are not published', async ({ request }) => {
  for (const path of ['src/main.jsx', 'package.json', '.git/config', 'node_modules/react/package.json']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});
