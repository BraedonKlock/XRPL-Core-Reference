import { expect, test } from '@playwright/test';

const PAGES = Object.freeze([
  ['overview', '/', 'XRPL Core Reference'],
  ['namespace', '/symbols/xrpl', 'xrpl'],
  ['class', '/symbols/xrpl/ApplyContext', 'ApplyContext'],
  ['inherited documentation', '/symbols/xrpl/detail/ApplyViewBase/open/3d5a0786', 'open'],
  ['overload set', '/symbols/xrpl/ApplyContext/view', 'view'],
  ['search', '/search?q=Payment', 'Search'],
]);
const EXPECTED_CONTENT_TYPES = Object.freeze({
  document: /^text\/html/,
  script: /^text\/javascript/,
  stylesheet: /^text\/css/,
  image: /^image\//,
  fetch: /^application\/json/,
});

function watchPage(page) {
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      problems.push(`console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('requestfailed', (request) => problems.push(`failed: ${request.url()}`));
  page.on('response', (response) => {
    const url = new URL(response.url());
    const type = response.request().resourceType();
    const contentType = response.headers()['content-type'] ?? '';
    if (url.pathname.includes('/XRPL-Core-Reference/')) {
      problems.push(`GitHub Pages base path used: ${url.pathname}`);
    }
    if (response.status() >= 400) {
      problems.push(`${response.status()}: ${url.pathname}`);
    }
    if (EXPECTED_CONTENT_TYPES[type] && !EXPECTED_CONTENT_TYPES[type].test(contentType)) {
      problems.push(`${type} ${url.pathname} served as ${contentType}`);
    }
  });
  return problems;
}

test.skip(({ viewport }) => viewport.width < 1024, 'Server behaviour is the same at every screen size');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(`CSP violation: ${event.violatedDirective} ${event.blockedURI}`);
    });
  });
});

for (const [name, path, heading] of PAGES) {
  test(`the ${name} page loads under the production server without errors`, async ({ page }) => {
    const problems = watchPage(page);
    const response = await page.goto(path);
    expect(response.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(problems).toEqual([]);
  });
}

test('deep links survive a reload and keep the pinned dataset', async ({ page }) => {
  const problems = watchPage(page);
  await page.goto('/symbols/xrpl/detail/ApplyViewBase/open/3d5a0786');
  await expect(page.getByText(/Documentation inherited from/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Documentation inherited from/)).toBeVisible();
  await page.getByRole('link', { name: 'xrpl::ReadView::open' }).click();
  await expect(page).toHaveURL(/\/symbols\/xrpl\/ReadView\/open\/5ece40d4$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/symbols\/xrpl\/detail\/ApplyViewBase\/open\/3d5a0786$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/symbols\/xrpl\/ReadView\/open\/5ece40d4$/);
  expect(problems).toEqual([]);
});

test('the theme script and theme toggle work under the content security policy', async ({ page }) => {
  const problems = watchPage(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark)$/);
  await page.getByRole('button', { name: /theme/i }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark)$/);
  expect(problems).toEqual([]);
});

test('the logo, styles and scripts load from the site root', async ({ page }) => {
  const problems = watchPage(page);
  await page.goto('/');
  const logoWidth = await page
    .locator('header img')
    .first()
    .evaluate((image) => image.naturalWidth);
  expect(logoWidth).toBeGreaterThan(0);
  const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(favicon).toMatch(/^\/assets\//);
  expect((await page.request.get(favicon)).status()).toBe(200);
  expect(problems).toEqual([]);
});

test('documents carry the security headers', async ({ request }) => {
  for (const path of ['/', '/symbols/xrpl/STTx', '/data/current.json']) {
    const headers = (await request.get(path)).headers();
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  }
});

test('the served dataset is the pinned rippled commit', async ({ request }) => {
  const pointer = await (await request.get('/data/current.json')).json();
  expect(pointer.commitSha).toBe('c2534ff9c84422e00711da31629a76f3f59feb98');
  const manifest = await (await request.get(`/data/${pointer.manifest}`)).json();
  expect(manifest.source).toMatchObject({
    repository: 'XRPLF/rippled',
    branch: 'develop',
    commitSha: pointer.commitSha,
  });
});

test('missing files and repository paths are 404s, never the application page', async ({ request }) => {
  for (const path of [
    '/assets/missing.js',
    '/data/missing.json',
    '/package.json',
    '/src/main.jsx',
    '/.env',
    '/.git/config',
    '/404.html',
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    expect(response.headers()['content-type'], path).toBe('text/plain; charset=utf-8');
  }
});

test('the content security policy blocks injected inline scripts', async ({ page }) => {
  const violations = [];
  page.on('console', (message) => {
    if (message.text().startsWith('CSP violation')) {
      violations.push(message.text());
    }
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const executed = await page.evaluate(async () => {
    const script = document.createElement('script');
    script.textContent = 'window.injectedScriptRan = true;';
    document.body.append(script);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return window.injectedScriptRan === true;
  });
  expect(executed).toBe(false);
  await expect.poll(() => violations.length).toBeGreaterThan(0);
});
