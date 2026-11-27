import { test as base, expect } from '@playwright/test';

export const ANALYTICS_SCRIPT_URL = 'https://static.cloudflareinsights.com/beacon.min.js';

function isAnalyticsRequest(url) {
  return url.hostname === 'cloudflareinsights.com' || url.hostname.endsWith('.cloudflareinsights.com');
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(isAnalyticsRequest, (route) =>
      route.request().url().startsWith(ANALYTICS_SCRIPT_URL)
        ? route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '' })
        : route.fulfill({ status: 204 }),
    );
    await use(context);
  },
});

export { expect };
