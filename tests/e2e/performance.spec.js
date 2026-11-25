import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { openPage } from './support/site.js';

const MAX_LONG_TASK_MILLISECONDS = 400;
const MAX_SEARCH_RESPONSE_MILLISECONDS = 500;
const KILOBYTE = 1024;
const BUNDLE_BUDGETS = Object.freeze({
  totalScriptGzipBytes: 140 * KILOBYTE,
  largestScriptGzipBytes: 95 * KILOBYTE,
  totalStyleGzipBytes: 10 * KILOBYTE,
});
const BUILT_ASSETS = join(process.cwd(), 'dist', 'assets');

function gzipSizesOf(extension) {
  return readdirSync(BUILT_ASSETS)
    .filter((file) => file.endsWith(extension))
    .map((file) => gzipSync(readFileSync(join(BUILT_ASSETS, file))).length);
}

test.skip(({ browserName }) => browserName !== 'chromium', 'Long-task timing is measured in Chromium');

test('the production bundle stays within its size budget', () => {
  const scripts = gzipSizesOf('.js');
  const styles = gzipSizesOf('.css');
  const total = (sizes) => sizes.reduce((sum, size) => sum + size, 0);
  expect(scripts.length).toBeGreaterThan(0);
  expect(total(scripts)).toBeLessThanOrEqual(BUNDLE_BUDGETS.totalScriptGzipBytes);
  expect(Math.max(...scripts)).toBeLessThanOrEqual(BUNDLE_BUDGETS.largestScriptGzipBytes);
  expect(total(styles)).toBeLessThanOrEqual(BUNDLE_BUDGETS.totalStyleGzipBytes);
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.longTaskDurations = [];
    new PerformanceObserver((list) => {
      window.longTaskDurations.push(...list.getEntries().map((entry) => entry.duration));
    }).observe({ type: 'longtask', buffered: true });
  });
});

test('the largest namespace renders without long blocking tasks', async ({ page }) => {
  await openPage(page, '/symbols/xrpl');
  await expect(page.getByRole('list', { name: 'Functions' })).toBeVisible();
  const longest = await page.evaluate(() => Math.max(0, ...window.longTaskDurations));
  expect(longest).toBeLessThan(MAX_LONG_TASK_MILLISECONDS);
});

test('search suggestions appear promptly for a broad query', async ({ page }) => {
  await openPage(page, '/');
  const started = Date.now();
  await page.getByRole('combobox', { name: 'Search the reference' }).fill('a');
  await page.getByRole('option').first().waitFor();
  expect(Date.now() - started).toBeLessThan(MAX_SEARCH_RESPONSE_MILLISECONDS);
});

test('navigating between classes does not block the main thread', async ({ page }) => {
  await openPage(page, '/symbols/xrpl/ApplyContext');
  await page.evaluate(() => {
    window.longTaskDurations = [];
  });
  await page.getByRole('table', { name: 'Methods' }).getByRole('link', { name: 'ApplyView' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'ApplyView' })).toBeVisible();
  const longest = await page.evaluate(() => Math.max(0, ...window.longTaskDurations));
  expect(longest).toBeLessThan(MAX_LONG_TASK_MILLISECONDS);
});
