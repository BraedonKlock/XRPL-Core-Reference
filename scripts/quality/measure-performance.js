#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.XCR_MEASURE_URL ?? 'http://localhost:4173';
const OUTPUT_FILE = process.argv[2] ?? null;
const CPU_SLOWDOWN = 4;
const DIST_ASSETS = join(process.cwd(), 'dist', 'assets');
const SAMPLES = 3;

const PAGES = Object.freeze([
  { name: 'overview', path: '/', heading: 'XRPL Core Reference' },
  { name: 'namespace xrpl', path: '/symbols/xrpl', heading: 'xrpl' },
  { name: 'class STObject', path: '/symbols/xrpl/STObject', heading: 'STObject' },
  { name: 'class ApplyContext', path: '/symbols/xrpl/ApplyContext', heading: 'ApplyContext' },
  { name: 'search page', path: '/search?q=Apply', heading: 'Search' },
]);

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function measureBundles() {
  return readdirSync(DIST_ASSETS)
    .filter((file) => /\.(js|css)$/.test(file))
    .map((file) => {
      const content = readFileSync(join(DIST_ASSETS, file));
      return { file, bytes: statSync(join(DIST_ASSETS, file)).size, gzipBytes: gzipSync(content).length };
    })
    .sort((left, right) => right.gzipBytes - left.gzipBytes);
}

async function openMeasuredPage(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      window.__longTasks.push(...list.getEntries().map((entry) => entry.duration));
    }).observe({ type: 'longtask', buffered: true });
  });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  await session.send('Network.enable');
  await session.send('Performance.enable');
  const transfer = { bytes: 0, requests: 0 };
  session.on('Network.loadingFinished', (event) => {
    transfer.bytes += event.encodedDataLength;
    transfer.requests += 1;
  });
  return { context, page, session, transfer };
}

async function heapMegabytes(session) {
  const { metrics } = await session.send('Performance.getMetrics');
  const used = metrics.find((metric) => metric.name === 'JSHeapUsedSize').value;
  return Number((used / 1024 / 1024).toFixed(1));
}

async function measurePageLoad(browser, target) {
  const { context, page, session, transfer } = await openMeasuredPage(browser);
  const started = Date.now();
  await page.goto(`${BASE_URL}${target.path}`);
  await page.getByRole('heading', { level: 1, name: target.heading, exact: true }).waitFor();
  await page.waitForLoadState('networkidle');
  const result = {
    page: target.name,
    loadMilliseconds: Date.now() - started,
    domNodes: await page.evaluate(() => document.getElementsByTagName('*').length),
    ...(await page.evaluate(() => ({
      longestTaskMilliseconds: Math.round(Math.max(0, ...window.__longTasks)),
      blockingMilliseconds: Math.round(
        window.__longTasks.reduce((total, duration) => total + Math.max(0, duration - 50), 0),
      ),
    }))),
    heapMegabytes: await heapMegabytes(session),
    transferredKilobytes: Number((transfer.bytes / 1024).toFixed(0)),
    requests: transfer.requests,
  };
  await context.close();
  return result;
}

async function measureNavigation(browser) {
  const { context, page } = await openMeasuredPage(browser);
  await page.goto(`${BASE_URL}/symbols/xrpl/ApplyContext`);
  await page.getByRole('heading', { level: 1, name: 'ApplyContext', exact: true }).waitFor();
  await page.waitForLoadState('networkidle');
  const timings = [];
  for (const [linkName, heading] of [
    ['ApplyView class', 'ApplyView'],
    ['ApplyContext class', 'ApplyContext'],
    ['ApplyViewImpl class', 'ApplyViewImpl'],
    ['ApplyContext class', 'ApplyContext'],
  ]) {
    const started = Date.now();
    await page.getByRole('link', { name: linkName, exact: true }).click();
    await page.getByRole('heading', { level: 1, name: heading, exact: true }).waitFor();
    timings.push(Date.now() - started);
  }
  await context.close();
  return { sidebarNavigationMilliseconds: median(timings) };
}

async function measureSearch(browser) {
  const { context, page } = await openMeasuredPage(browser);
  await page.goto(BASE_URL);
  await page.getByRole('heading', { level: 1, name: 'XRPL Core Reference', exact: true }).waitFor();
  const timings = [];
  for (const query of ['ApplyContext', 'preflight', 'a', 'xrpl::STTx::getTxnType']) {
    const input = page.getByRole('combobox', { name: 'Search the reference' });
    await input.fill('');
    const started = Date.now();
    await input.fill(query);
    await page.getByRole('option').first().waitFor();
    timings.push({ query, milliseconds: Date.now() - started });
  }
  await context.close();
  return timings;
}

async function main() {
  const browser = await chromium.launch();
  const pages = [];
  for (const target of PAGES) {
    const samples = [];
    for (let sample = 0; sample < SAMPLES; sample += 1) {
      samples.push(await measurePageLoad(browser, target));
    }
    pages.push({
      ...samples[0],
      loadMilliseconds: median(samples.map((sample) => sample.loadMilliseconds)),
      blockingMilliseconds: median(samples.map((sample) => sample.blockingMilliseconds)),
      longestTaskMilliseconds: median(samples.map((sample) => sample.longestTaskMilliseconds)),
    });
  }
  const report = {
    measuredAt: new Date().toISOString(),
    cpuSlowdown: CPU_SLOWDOWN,
    bundles: measureBundles(),
    pages,
    navigation: await measureNavigation(browser),
    search: await measureSearch(browser),
  };
  await browser.close();
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (OUTPUT_FILE) {
    writeFileSync(OUTPUT_FILE, json);
  }
  process.stdout.write(json);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
