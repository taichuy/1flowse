const test = require('node:test');
const assert = require('node:assert/strict');

const { assertReadyNavigation, waitForPageReady } = require('../readiness.js');

test('assertReadyNavigation rejects sign-in fallback', () => {
  assert.throws(
    () =>
      assertReadyNavigation({
        requestedUrl: '/settings',
        finalUrl: 'http://127.0.0.1:3100/sign-in',
        waitForUrl: null,
      }),
    /sign-in/u
  );
});

test('assertReadyNavigation honors explicit wait-for-url', () => {
  assert.deepEqual(
    assertReadyNavigation({
      requestedUrl: '/settings',
      finalUrl: 'http://127.0.0.1:3100/settings/members',
      waitForUrl: 'http://127.0.0.1:3100/settings/members',
    }),
    {
      finalUrl: 'http://127.0.0.1:3100/settings/members',
      readyState: 'ready_with_url',
    }
  );
});

test('waitForPageReady waits for explicit url before asserting selector-ready state', async () => {
  const calls = [];
  let currentUrl = 'http://127.0.0.1:3100/settings';

  const result = await waitForPageReady({
    page: {
      waitForLoadState: async () => {
        calls.push('domcontentloaded');
      },
      waitForFunction: async () => {
        calls.push('waitForFunction');
      },
      waitForURL: async (expectedUrl) => {
        calls.push(`waitForURL:${expectedUrl}`);
        currentUrl = expectedUrl;
      },
      locator: (selector) => ({
        first: () => ({
          waitFor: async () => {
            calls.push(`waitForSelector:${selector}`);
          },
        }),
      }),
      url: () => currentUrl,
    },
    requestedUrl: '/settings',
    waitForUrl: 'http://127.0.0.1:3100/settings/docs',
    waitForSelector: '[data-testid="section-page-layout"]',
    timeout: 15000,
  });

  assert.deepEqual(result, {
    finalUrl: 'http://127.0.0.1:3100/settings/docs',
    readyState: 'ready_with_selector',
  });
  assert.deepEqual(calls, [
    'domcontentloaded',
    'waitForFunction',
    'waitForFunction',
    'waitForURL:http://127.0.0.1:3100/settings/docs',
    'waitForSelector:[data-testid="section-page-layout"]',
  ]);
});
