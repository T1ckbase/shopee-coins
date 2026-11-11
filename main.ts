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

// // if (process.env.STORAGE_STATE_BROTLI_BASE64 !== undefined) {
// // const bytes = Uint8Array.fromBase64(process.env.STORAGE_STATE_BROTLI_BASE64);
// const base64 = await readFile('storage-state.txt', 'utf8');
// const storageStateJson = brotliDecompressSync(Buffer.from(base64, 'base64')).toString('utf8');
// // const storageState = await new Response(
// //   new Response(bytes).body!.pipeThrough(new DecompressionStream('brotli')),
// // ).text();
// console.log(storageStateJson);
// process.exit();
// // }

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--disable-blink-features=AutomationControlled'],
});
const context = await browser.newContext({
  ...devices['Desktop Chrome'],
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
  await page.waitForURL((url) => url.pathname.startsWith('/shopee-coins'), { timeout: 0, waitUntil: 'load' });
  await page.reload();
  await page.waitForURL((url) => url.pathname.startsWith('/shopee-coins'), { timeout: 15_000, waitUntil: 'load' });
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

// {
//   const storageState = await readFile('storage-state.json', 'utf8');
//   const minified = JSON.stringify(JSON.parse(storageState));
//   const base64 = brotliCompressSync(minified, {
//     params: { [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT },
//   }).toString('base64');
//   // const encoder = new TextEncoder();
//   // const bytes = encoder.encode(storageState);
//   // const base64 = new Uint8Array(
//   //   await new Response(new Response(bytes).body!.pipeThrough(new CompressionStream('brotli'))).arrayBuffer(),
//   // ).toBase64();
//   await writeFile('storage-state.txt', base64);
// }
