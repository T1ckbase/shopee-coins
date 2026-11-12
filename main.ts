import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib';

import { chromium, devices } from 'playwright-core';

const args = process.argv.slice(2);

const secret = process.env.STORAGE_STATE_BROTLI_BASE64;

const encoded = secret?.trim() || (existsSync('storage-state.txt') ? readFileSync('storage-state.txt', 'utf8') : null);
const storageState = encoded
  ? JSON.parse(brotliDecompressSync(Buffer.from(encoded, 'base64')).toString('utf8'))
  : undefined;

const browser = await chromium.launch({
  channel: 'msedge',
  headless: false,
  args: ['--disable-blink-features=AutomationControlled'],
});
const context = await browser.newContext({
  ...devices['Desktop Edge'],
  colorScheme: 'dark',
  // viewport: { width: 1920, height: 1080 },
  viewport: null,
  deviceScaleFactor: undefined,
  permissions: [],
  storageState,
});

const page = await context.newPage();

await page.goto('https://shopee.tw/buyer/login?next=https%3A%2F%2Fshopee.tw%2Fshopee-coins', { waitUntil: 'load' });

if (args.includes('login')) {
  await page.waitForEvent('close', { timeout: 0 });
} else {
  try {
    try {
      await page.waitForURL((url) => url.pathname.startsWith('/shopee-coins'));
    } catch {
      const url = new URL(page.url());
      if (url.pathname.startsWith('/buyer/login')) {
        throw new Error('Login required');
      }
      throw new Error(`Unexpected page: ${url.href}`);
    }

    // const text = await page.locator('div:has(> a[href="/coins"]) button').textContent();
    // console.log(text);

    await page.locator('div:has(> a[href="/coins"]) button').click();

    await page.waitForTimeout(10_000);
  } finally {
    await page.screenshot({ path: 'screenshot.png', fullPage: true }).catch(() => {});
  }
}

const newStorageState = await context.storageState();
const minified = JSON.stringify(newStorageState);
const base64 = brotliCompressSync(minified, {
  params: { [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT },
}).toString('base64');
await writeFile('storage-state.txt', base64);

await context.close();
await browser.close();
