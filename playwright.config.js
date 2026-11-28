import { defineConfig, devices } from '@playwright/test';

const PREVIEW_PORT = 4173;
const PAGES_PORT = 4174;
const NOTES_PREVIEW_PORT = 4175;
const PAGES_BASE_PATH = '/XRPL-Core-Reference/';
const ENABLED_BROWSERS = new Set((process.env.XCR_E2E_BROWSERS ?? 'chromium,firefox,webkit').split(','));
const SITE_TESTS =
  /(navigation|accessibility|responsive|errors|performance|production-server|developer-notes)\.spec\.js$/;

const SITE_PROJECTS = [
  { name: 'desktop-chromium', browser: 'chromium', use: devices['Desktop Chrome'] },
  { name: 'desktop-firefox', browser: 'firefox', use: devices['Desktop Firefox'] },
  { name: 'desktop-webkit', browser: 'webkit', use: devices['Desktop Safari'] },
  {
    name: 'tablet-chromium',
    browser: 'chromium',
    use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 }, hasTouch: true },
  },
  { name: 'mobile-chromium', browser: 'chromium', use: devices['Pixel 7'] },
  { name: 'mobile-webkit', browser: 'webkit', use: devices['iPhone 14'] },
];
const NOTES_PREVIEW_PROJECTS = new Set(['desktop-chromium', 'desktop-firefox', 'mobile-chromium']);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    ...SITE_PROJECTS.filter((project) => ENABLED_BROWSERS.has(project.browser)).map((project) => ({
      name: project.name,
      testMatch: SITE_TESTS,
      use: { ...project.use, baseURL: `http://localhost:${PREVIEW_PORT}` },
    })),
    ...SITE_PROJECTS.filter(
      (project) => NOTES_PREVIEW_PROJECTS.has(project.name) && ENABLED_BROWSERS.has(project.browser),
    ).map((project) => ({
      name: `notes-preview-${project.name}`,
      testMatch: /developer-notes-preview\.spec\.js$/,
      use: { ...project.use, baseURL: `http://localhost:${NOTES_PREVIEW_PORT}` },
    })),
    {
      name: 'github-pages',
      testMatch: /deployment\.spec\.js$/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PAGES_PORT}${PAGES_BASE_PATH}` },
    },
  ],
  webServer: [
    {
      command: `npx vite --port ${NOTES_PREVIEW_PORT} --strictPort`,
      url: `http://localhost:${NOTES_PREVIEW_PORT}/data/current.json`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: `npm run build && PORT=${PREVIEW_PORT} npm run serve`,
      url: `http://localhost:${PREVIEW_PORT}/data/current.json`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: `npm run build:pages && npm run preview:pages`,
      url: `http://localhost:${PAGES_PORT}${PAGES_BASE_PATH}data/current.json`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
