import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { parseRanges, readPdf, pdfBlob, MAX_PDF_BYTES } from '../src/scripts/pdf-utils.ts';
import { safeBaseName, validateImage, validateDimensions, MAX_IMAGE_BYTES } from '../src/scripts/image-utils.ts';

test('PDF ranges preserve requested order, descending ranges and repeated pages', () => {
  assert.deepEqual(parseRanges(' 3-1, 2, 4-5 ', 5), [2, 1, 0, 1, 3, 4]);
});
test('PDF ranges reject empty tokens, malformed, unsafe, out-of-range and oversized output', () => {
  for (const value of ['', ' ', ',', '1,', ',1', '1,,2', '0', '-1', '6', '1-6', '2.5', '1e2', '1--2', '<script>', '9007199254740993']) {
    assert.throws(() => parseRanges(value, 5), undefined, value);
  }
  assert.throws(() => parseRanges('1-2000,1', 2000));
  assert.equal(parseRanges('1-2000', 2000).length, 2000);
});
test('dimensions reject decimals, missing, non-finite, oversized sides and excessive area', () => {
  validateDimensions(4000, 4000);
  validateDimensions(8192, 1);
  for (const pair of [[0, 1], [-1, 1], [1.5, 1], [NaN, 1], [Infinity, 1], [8193, 1], [5000, 5000]]) {
    assert.throws(() => validateDimensions(...pair));
  }
});
test('image signatures are required; MIME may be absent but cannot contradict bytes', async () => {
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  assert.equal(await validateImage(new File([new Uint8Array(png)], 'image.bin')), 'image/png');
  await assert.rejects(validateImage(new File([new Uint8Array(png)], 'image.jpg', { type: 'image/jpeg' })));
  await assert.rejects(validateImage(new File(['garbage'], 'fake.png', { type: 'image/png' })));
  await assert.rejects(validateImage(new File([], 'empty.png', { type: 'image/png' })));
  const webp = new File(['RIFF1234WEBP'], 'test.webp', { type: 'image/webp' });
  assert.equal(await validateImage(webp), 'image/webp');
  await assert.rejects(validateImage(webp, true));
  await assert.rejects(validateImage({ size: MAX_IMAGE_BYTES + 1 }));
});
test('unreadable files return controlled errors', async () => {
  const broken = { size: 20, type: 'application/pdf', slice() { throw new Error('sensitive private text'); } };
  await assert.rejects(readPdf(broken), /could not be read/);
  await assert.rejects(validateImage(broken), /could not be read/);
});
test('PDF validation rejects wrong MIME/signature, empty, oversized and corrupt PDFs', async () => {
  for (const file of [new File([], 'empty.pdf'), new File(['not PDF'], 'fake.pdf'), new File(['%PDF-broken'], 'broken.pdf'), new File(['%PDF-'], 'wrong.txt', { type: 'text/plain' }), { size: MAX_PDF_BYTES + 1 }]) {
    await assert.rejects(readPdf(file));
  }
});
test('PDF Blob output is readable and retains pages', async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([123, 456]);
  const blob = await pdfBlob(pdf);
  assert.equal(blob.type, 'application/pdf');
  const read = await readPdf(new File([blob], 'test.pdf'));
  assert.equal(read.getPageCount(), 1);
  assert.equal(read.getPage(0).getWidth(), 123);
});
test('download names are bounded and sanitized', () => {
  assert.equal(safeBaseName('../private report.png'), 'private-report');
  assert.equal(safeBaseName('😺.png'), 'zerosend-file');
  assert.equal(safeBaseName('a'.repeat(400) + '.jpg').length, 100);
});
