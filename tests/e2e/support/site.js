export const THEMES = Object.freeze(['light', 'dark']);

export async function useTheme(page, theme) {
  await page.addInitScript((selectedTheme) => window.localStorage.setItem('xcr-theme', selectedTheme), theme);
}

export async function openPage(page, path) {
  await page.goto(path);
  await page.getByRole('main').waitFor();
  await page.waitForLoadState('networkidle');
}

export async function isCompactLayout(page) {
  return page.getByRole('button', { name: 'Open navigation' }).isVisible();
}

export async function currentCommitSha(request, dataPath = '/data/current.json') {
  const pointer = await (await request.get(dataPath)).json();
  return pointer.commitSha;
}
