import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';

// Synthetic fixtures only. Never use personal files or record their content in test artifacts.
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWP4z8DQAMIMMAYAOOgF/Q/eI6wAAAAASUVORK5CYII=', 'base64');
const png = { name: 'local-test.png', mimeType: 'image/png', buffer: image };
const fake = { name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('not an image') };
const corruptPdf = { name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nbroken') };
const operationRequests = new WeakMap<Page, string[]>();

async function pdfFile(name: string, widths: number[]) {
  const pdf = await PDFDocument.create();
  widths.forEach((width) => pdf.addPage([width, 300]));
  return { name, mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) };
}
async function select(page: Page, files: Parameters<ReturnType<Page['locator']>['setInputFiles']>[0]) {
  if (!operationRequests.has(page)) {
    const requests: string[] = [];
    operationRequests.set(page, requests);
    page.on('request', (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  }
  await page.locator('input[type=file]').setInputFiles(files);
  await expect(page.locator('[data-status]')).not.toContainText('Reading');
}
async function done(page: Page) {
  await expect(page.locator('[data-status]')).toContainText('Done.');
  await expect(page.locator('[data-result]')).toBeVisible();
  await expect(page.locator('[data-process]')).toBeEnabled();
}
async function downloadBytes(page: Page) {
  const event = page.waitForEvent('download');
  await page.locator('[data-download]').click();
  const download = await event;
  const bytes = await readFile((await download.path())!);
  return { bytes, name: download.suggestedFilename() };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const active = new Set<string>();
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob) => { const url = create(blob); active.add(url); return url; };
    URL.revokeObjectURL = (url: string) => { active.delete(url); revoke(url); };
    // Instrumentation is installed by the test only, never by the shipped application.
    Object.defineProperty(window, '__activeUrls', { value: active });
  });
});
test.afterEach(async ({ page }) => {
  expect(operationRequests.get(page) ?? [], 'File operations must make no HTTP requests').toEqual([]);
});

for (const route of ['image-compressor', 'jpg-png-to-webp', 'image-resizer']) {
  test(`${route}: output downloads, settings invalidate results, invalid inputs recover`, async ({ page }) => {
    await page.goto(`/tools/${route}`);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await select(page, png);
    await expect(page.locator('[data-controls]')).toBeVisible();
    await page.locator('[data-process]').click();
    await done(page);
    const result = await downloadBytes(page);
    expect(result.bytes.length).toBeGreaterThan(10);
    expect(result.name).toMatch(route === 'jpg-png-to-webp' ? /\.webp$/ : /\.png$/);
    expect(result.bytes.subarray(0, route === 'jpg-png-to-webp' ? 4 : 8)).toEqual(
      route === 'jpg-png-to-webp' ? Buffer.from('RIFF') : Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    await expect(page.locator('[data-preview]')).toHaveJSProperty('naturalWidth', 2);
    if (route === 'image-compressor') await page.locator('[data-format]').selectOption('image/jpeg');
    else if (route === 'image-resizer') await page.locator('[data-width]').fill('1');
    else await page.locator('[data-quality]').fill('70');
    await expect(page.locator('[data-result]')).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { __activeUrls: Set<string> }).__activeUrls.size)).toBe(0);
    await select(page, fake);
    await expect(page.locator('[data-status]')).toContainText('valid');
    await expect(page.locator('[data-controls]')).toBeHidden();
    await expect(page.locator('[data-download]')).not.toHaveAttribute('href');
    await select(page, { ...png, name: 'truncated.png', buffer: image.subarray(0, 12) });
    await expect(page.locator('[data-status]')).toContainText('decoded');
    await expect(page.locator('[data-controls]')).toBeHidden();
    await select(page, png);
    await page.locator('[data-process]').click();
    await done(page);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    expect(await page.evaluate(() => (window as unknown as { __activeUrls: Set<string> }).__activeUrls.size)).toBe(0);
    expect(errors).toEqual([]);
  });
}

test('resizer validates integer dimensions, side and area limits; downloads correct dimensions', async ({ page }) => {
  await page.goto('/tools/image-resizer');
  await select(page, png);
  await page.locator('[data-lock]').uncheck();
  for (const [w, h] of [['', '2'], ['0', '2'], ['1.5', '2'], ['8193', '1'], ['5000', '5000']] as const) {
    await page.locator('[data-width]').fill(w);
    await page.locator('[data-height]').fill(h);
    await page.locator('[data-process]').click();
    await expect(page.locator('[data-status]')).toHaveClass(/error/);
    await expect(page.locator('[data-result]')).toBeHidden();
  }
  await page.locator('[data-width]').fill('4');
  await page.locator('[data-lock]').check();
  await expect(page.locator('[data-height]')).toHaveValue('4');
  await page.locator('[data-process]').click();
  await done(page);
  await expect(page.locator('[data-preview]')).toHaveJSProperty('naturalWidth', 4);
  await expect(page.locator('[data-preview]')).toHaveJSProperty('naturalHeight', 4);
  expect((await downloadBytes(page)).name).toBe('local-test-4x4.png');
});

test('WebP unsupported encoding is rejected instead of downloading a PNG named WebP', async ({ page }) => {
  await page.goto('/tools/jpg-png-to-webp');
  await select(page, png);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) { original.call(this, callback, 'image/png'); };
  });
  await page.locator('[data-process]').click();
  await expect(page.locator('[data-status]')).toContainText('cannot create');
  await expect(page.locator('[data-result]')).toBeHidden();
  await expect(page.locator('[data-process]')).toBeEnabled();
});

test('local image decoder fallback succeeds without ImageBitmap', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'createImageBitmap', { value: undefined }); });
  await page.goto('/tools/image-compressor');
  await select(page, png);
  await page.locator('[data-process]').click();
  await done(page);
  expect(await page.evaluate(() => (window as unknown as { __activeUrls: Set<string> }).__activeUrls.size)).toBe(1);
});

test('compressor accepts JPEG and WebP bytes with missing MIME and creates readable matching outputs', async ({ page }) => {
  await page.goto('/tools/image-compressor');
  for (const mime of ['image/jpeg', 'image/webp']) {
    const bytes = await page.evaluate(async (type) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 2;
      canvas.getContext('2d')!.fillRect(0, 0, 2, 2);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), type));
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    }, mime);
    await select(page, { name: 'camera.bin', mimeType: '', buffer: Buffer.from(bytes) });
    await page.locator('[data-process]').click();
    await done(page);
    const output = await downloadBytes(page);
    expect(output.name).toMatch(mime === 'image/jpeg' ? /\.jpg$/ : /\.webp$/);
  }
});

test('PNG transparency is preserved and JPEG output uses a white background', async ({ page }) => {
  await page.goto('/tools/image-compressor');
  await select(page, png);
  async function pixel() {
    return page.locator('[data-preview]').evaluate((element) => {
      const image = element as HTMLImageElement;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 2;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    });
  }
  await page.locator('[data-process]').click();
  await done(page);
  await expect(page.locator('[data-preview]')).toHaveJSProperty('complete', true);
  expect((await pixel())[3]).toBe(128);
  await page.locator('[data-format]').selectOption('image/jpeg');
  await page.locator('[data-process]').click();
  await done(page);
  await expect(page.locator('[data-preview]')).toHaveJSProperty('naturalWidth', 2);
  const [red, green, blue, alpha] = await pixel();
  expect(alpha).toBe(255);
  expect(red).toBeGreaterThan(245);
  expect(green).toBeGreaterThan(110);
  expect(blue).toBeGreaterThan(110);
});

for (const route of ['image-compressor', 'jpg-png-to-webp', 'image-resizer', 'merge-pdf', 'split-pdf']) {
  test(`${route}: unreadable files report a controlled error`, async ({ page }) => {
    await page.goto(`/tools/${route}`);
    await page.evaluate(() => {
      Blob.prototype.arrayBuffer = async () => { throw new Error('private-file-text-must-not-appear'); };
    });
    const pdf = await pdfFile('unreadable.pdf', [111]);
    await select(page, route === 'merge-pdf' ? [pdf, pdf] : route === 'split-pdf' ? pdf : png);
    if (route === 'merge-pdf') await page.locator('[data-process]').click();
    await expect(page.locator('[data-status]')).toContainText('could not be read');
    await expect(page.locator('[data-status]')).not.toContainText('private-file-text');
    await expect(page.locator('[data-result]')).toBeHidden();
    await expect(page.locator('input[type=file]')).toBeEnabled();
  });

  test(`${route}: populated controls and results fit narrow mobile screens`, async ({ page }) => {
    await page.goto(`/tools/${route}`);
    const pdf = await pdfFile(`${'very-long-local-name-'.repeat(12)}.pdf`, [111]);
    await select(page, route === 'merge-pdf' ? [pdf, pdf] : route === 'split-pdf' ? pdf : { ...png, name: `${'long-image-'.repeat(20)}.png` });
    await page.locator('[data-process]').click();
    await done(page);
    for (const width of [320, 375, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const download = await page.locator('[data-download]').boundingBox();
      expect(download!.width).toBeLessThanOrEqual(width);
    }
  });
}

test('merge preserves chosen file/page order, removes stale results and recovers from corruption', async ({ page }) => {
  await page.goto('/tools/merge-pdf');
  await select(page, [await pdfFile('one.pdf', [111]), await pdfFile('two.pdf', [222, 223])]);
  await page.getByRole('button', { name: 'Move PDF 2 up', exact: true }).click();
  await page.locator('[data-process]').click();
  await done(page);
  let output = await PDFDocument.load((await downloadBytes(page)).bytes);
  expect(output.getPages().map((p) => p.getWidth())).toEqual([222, 223, 111]);
  await expect(page.getByRole('button', { name: 'Move PDF 1 up', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Remove PDF 1', exact: true }).click();
  await expect(page.locator('[data-result]')).toBeHidden();
  await expect(page.locator('[data-process]')).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { __activeUrls: Set<string> }).__activeUrls.size)).toBe(0);
  await select(page, [await pdfFile('good.pdf', [111]), corruptPdf]);
  await page.locator('[data-process]').click();
  await expect(page.locator('[data-status]')).toContainText('could not be opened');
  await expect(page.locator('[data-result]')).toBeHidden();
  await select(page, [await pdfFile('good.pdf', [111]), await pdfFile('good-again.pdf', [222])]);
  await page.locator('[data-process]').click();
  await done(page);
  output = await PDFDocument.load((await downloadBytes(page)).bytes);
  expect(output.getPageCount()).toBe(2);
});

test('split validates ranges, preserves requested order/repetition, rejects corrupt files and recovers', async ({ page }) => {
  await page.goto('/tools/split-pdf');
  await select(page, await pdfFile('source.pdf', [111, 222, 333]));
  for (const range of ['', '0', '4', '1-4', '1,,2', '1,', '1.5']) {
    await page.locator('[data-ranges]').fill(range);
    await page.locator('[data-process]').click();
    await expect(page.locator('[data-ranges]')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('[data-result]')).toBeHidden();
  }
  await page.locator('[data-ranges]').fill('3-1,2');
  await page.locator('[data-process]').click();
  await done(page);
  const output = await PDFDocument.load((await downloadBytes(page)).bytes);
  expect(output.getPages().map((p) => p.getWidth())).toEqual([333, 222, 111, 222]);
  await select(page, corruptPdf);
  await expect(page.locator('[data-controls]')).toBeHidden();
  await expect(page.locator('[data-download]')).not.toHaveAttribute('href');
  await expect(page.locator('[data-status]')).toContainText('could not be opened');
  await select(page, await pdfFile('recovery.pdf', [111]));
  await page.locator('[data-process]').click();
  await done(page);
});

test('controls lock while reading and processing; file operations make no HTTP requests', async ({ page }) => {
  await page.goto('/tools/image-compressor');
  await page.evaluate(() => {
    const slice = File.prototype.slice;
    File.prototype.slice = function (...args) {
      const blob = slice.apply(this, args);
      const read = blob.arrayBuffer.bind(blob);
      blob.arrayBuffer = async () => { await new Promise((resolve) => setTimeout(resolve, 300)); return read(); };
      return blob;
    };
    const encode = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (...args) { setTimeout(() => encode.apply(this, args), 300); };
  });
  const requests: string[] = [];
  page.on('request', (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await page.locator('input[type=file]').setInputFiles(png);
  await expect(page.locator('input[type=file]')).toBeDisabled();
  await expect(page.locator('[data-controls]')).toBeVisible();
  await page.locator('[data-process]').click();
  await expect(page.locator('input[type=file]')).toBeDisabled();
  await expect(page.locator('[data-process]')).toBeDisabled();
  await done(page);
  await downloadBytes(page);
  expect(requests).toEqual([]);
});

test('leaving during image encoding cannot publish a late Blob URL', async ({ page }) => {
  await page.goto('/tools/image-compressor');
  await select(page, png);
  await page.evaluate(() => {
    const encode = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (...args) { setTimeout(() => encode.apply(this, args), 300); };
  });
  await page.locator('[data-process]').click();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect(page.locator('input[type=file]')).toBeEnabled();
  await expect(page.locator('[data-result]')).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { __activeUrls: Set<string> }).__activeUrls.size)).toBe(0);
});

test('all routes have labels, status, focus visibility and no narrow-screen horizontal overflow', async ({ page, browserName }) => {
  for (const route of ['image-compressor', 'jpg-png-to-webp', 'image-resizer', 'merge-pdf', 'split-pdf']) {
    await page.goto(`/tools/${route}`);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('input[type=file]')).toHaveAccessibleName(/Choose/);
    await expect(page.getByRole('status')).toHaveCount(1);
    // Mobile WebKit emulation does not model iOS Full Keyboard Access.
    // Check its focus rendering directly; exercise the actual Tab sequence in Chromium.
    await page.keyboard.press('Tab');
    if (browserName === 'webkit') await page.getByRole('link', { name: 'Skip to content' }).focus();
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    const outline = await page.locator(':focus').evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outline).not.toBe('none');
    for (const width of [320, 375, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
});
