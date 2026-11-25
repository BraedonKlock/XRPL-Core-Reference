import { expect, test } from '@playwright/test';

async function currentCommitSha(request) {
  const pointer = await (await request.get('/data/current.json')).json();
  return pointer.commitSha;
}

async function openNavigationIfCollapsed(page) {
  await page.getByRole('main').waitFor();
  const menuButton = page.getByRole('button', { name: 'Open navigation' });
  if (await menuButton.isVisible()) {
    await menuButton.click();
  }
}

test('overview identifies the documented develop commit', async ({ page, request }) => {
  const commitSha = await currentCommitSha(request);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'XRPLD C++ Reference' })).toBeVisible();
  await expect(page.getByRole('link', { name: commitSha })).toHaveAttribute(
    'href',
    `https://github.com/XRPLF/rippled/commit/${commitSha}`,
  );
  await expect(page).toHaveTitle('XRPLD C++ Reference');
  const logo = page.getByRole('link', { name: 'XRPLD C++ Reference' }).locator('img');
  await expect(logo).toBeVisible();
  expect(
    await logo.evaluate((image) => image.naturalWidth === image.naturalHeight && image.naturalWidth > 0),
  ).toBe(true);
  const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
  expect((await request.get(favicon)).ok()).toBe(true);
});

test('browse from the namespace tree to a class and back', async ({ page, request }) => {
  const commitSha = await currentCommitSha(request);
  await page.goto('/');
  await openNavigationIfCollapsed(page);
  await page.getByRole('button', { name: 'Expand xrpl' }).click();
  await page.getByRole('link', { name: 'ApplyContext class' }).click();

  await expect(page).toHaveURL(/\/symbols\/xrpl\/ApplyContext$/);
  await expect(page.getByRole('heading', { level: 1, name: 'ApplyContext' })).toBeVisible();
  await expect(page.getByText('State information when applying a tx.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'include/xrpl/tx/ApplyContext.h:27' })).toHaveAttribute(
    'href',
    `https://github.com/XRPLF/rippled/blob/${commitSha}/include/xrpl/tx/ApplyContext.h#L27`,
  );
  await expect(page).toHaveTitle(/xrpl::ApplyContext class/);

  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'xrpl' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'xrpl' })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'ApplyContext' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'XRPLD C++ Reference' })).toBeVisible();
});

test('deep links reveal the symbol in the navigation tree', async ({ page }) => {
  await page.goto('/symbols/xrpl/SHAMap');
  await expect(page.getByRole('heading', { level: 1, name: 'SHAMap' })).toBeVisible();
  await openNavigationIfCollapsed(page);
  await expect(page.getByRole('link', { name: 'SHAMap class', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('percent-encoded specialization URLs load directly', async ({ page }) => {
  await page.goto('/symbols/std/hash%3Cxrpl%3A%3AAccountID%3E');
  await expect(page.getByRole('heading', { level: 1, name: 'hash< xrpl::AccountID >' })).toBeVisible();
});

test('overload sets list every overload', async ({ page }) => {
  await page.goto('/symbols/xrpl/ApplyContext/view');
  const overloads = page.getByRole('table', { name: 'Overloads' });
  await expect(overloads.getByRole('row')).toHaveCount(3);
  await overloads.getByRole('link', { name: 'view() const' }).click();
  await expect(page).toHaveURL(/\/symbols\/xrpl\/ApplyContext\/view\/[0-9a-f]{8}$/);
});

test('unknown symbols and pages explain what went wrong', async ({ page }) => {
  await page.goto('/symbols/xrpl/DoesNotExist');
  await expect(page.getByRole('heading', { name: 'Symbol not found' })).toBeVisible();
  await page.goto('/missing-page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('the theme choice persists across reloads', async ({ page }) => {
  await page.goto('/');
  const before = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: /dark theme/i }).click();
  const after = before === 'dark' ? 'light' : 'dark';
  await expect(page.locator('html')).toHaveAttribute('data-theme', after);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', after);
});

test('the mobile navigation drawer opens and closes after navigating', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('main').waitFor();
  test.skip(
    !(await page.getByRole('button', { name: 'Open navigation' }).isVisible()),
    'The drawer only exists on narrow screens',
  );
  const drawer = page.getByRole('complementary', { name: 'Symbol navigation' });
  await page.goto('/');
  const menuButton = page.getByRole('button', { name: 'Open navigation' });
  await menuButton.click();
  await expect(drawer).toBeVisible();
  await page.getByRole('button', { name: 'Expand xrpl' }).click();
  await page.getByRole('link', { name: 'STTx class' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'STTx' })).toBeVisible();
  await expect(drawer).toBeHidden();
  await menuButton.click();
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
});

test('search from the header, then follow a return type to its class', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('main').waitFor();
  await page.keyboard.press('/');
  await page.keyboard.type('ApplyContext');
  await expect(page.getByRole('option').first()).toContainText('ApplyContext');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'ApplyContext' })).toBeVisible();

  await page.getByRole('table', { name: 'Methods' }).getByRole('link', { name: 'view() const' }).click();
  await expect(page.getByText('[[nodiscard]]')).toBeVisible();
  await page.getByRole('region', { name: 'Return value' }).getByRole('link', { name: 'ApplyView' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'ApplyView' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Return value' })).toBeVisible();
});

test('class pages connect related classes through inheritance', async ({ page }) => {
  await page.goto('/symbols/xrpl/STTx');
  const bases = page.getByRole('list', { name: 'Base classes of STTx' });
  await bases.getByRole('link', { name: 'xrpl::STObject' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'STObject' })).toBeVisible();
  await expect(
    page
      .getByRole('list', { name: 'Classes derived from STObject' })
      .getByRole('link', { name: 'xrpl::STTx' }),
  ).toBeVisible();
});

test('member pages link to the exact pinned source line', async ({ page, request }) => {
  const commitSha = await currentCommitSha(request);
  await page.goto('/symbols/xrpl/STTx');
  await page
    .getByRole('table', { name: 'Methods' })
    .getByRole('link', { name: 'getTxnType() const' })
    .click();
  const declared = page.getByRole('link', { name: /^include\/xrpl\/protocol\/STTx\.h:\d+$/ });
  await expect(declared).toHaveAttribute(
    'href',
    new RegExp(`^https://github\\.com/XRPLF/rippled/blob/${commitSha}/include/xrpl/protocol/STTx\\.h#L\\d+$`),
  );
});

test('overrides showing base-class documentation name where it came from', async ({ page }) => {
  await page.goto('/symbols/xrpl/detail/ApplyViewBase/open/3d5a0786');
  await expect(page.getByText('Returns true if this reflects an open ledger.')).toBeVisible();
  await expect(page.getByText(/Documentation inherited from/)).toBeVisible();
  await page.getByRole('link', { name: 'xrpl::ReadView::open' }).click();
  await expect(page).toHaveURL(/\/symbols\/xrpl\/ReadView\/open\/5ece40d4$/);
  await expect(page.getByText(/Documentation inherited from/)).toHaveCount(0);
});

test('the full search page filters by kind', async ({ page }) => {
  await page.goto('/search?q=preflight');
  await expect(page.getByText(/matches/)).toBeVisible();
  await page.getByText('Types', { exact: true }).click();
  await expect(page).toHaveURL(/kind=types/);
  const results = page.getByRole('list', { name: 'Search results' });
  await expect(results.getByRole('link', { name: /PreflightContext/ }).first()).toBeVisible();
  await expect(results).not.toContainText(/method|constructor/);
});
