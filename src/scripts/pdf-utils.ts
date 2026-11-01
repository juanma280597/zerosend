import { PDFDocument } from 'pdf-lib';

export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const MAX_PDF_TOTAL_BYTES = 100 * 1024 * 1024;
export const MAX_PDF_PAGES = 2000;

/** Only controlled messages from our validation may be displayed to the user. */
export class FileProblem extends Error {}

export async function readPdf(file: File): Promise<PDFDocument> {
  if (!file.size) throw new FileProblem('This PDF is empty. Choose another file.');
  if (file.size > MAX_PDF_BYTES) throw new FileProblem('Each PDF must be no larger than 50 MiB.');
  if (file.type && !['application/pdf', 'application/octet-stream'].includes(file.type)) {
    throw new FileProblem('Choose PDF files only.');
  }
  let bytes: ArrayBuffer;
  try {
    const header = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    const signature = [37, 80, 68, 70, 45]; // ASCII %PDF-
    const hasSignature = header.some((_, offset) =>
      signature.every((byte, index) => header[offset + index] === byte));
    if (!hasSignature) {
      throw new FileProblem('This is not a valid PDF file. Choose an original PDF.');
    }
    bytes = await file.arrayBuffer();
  } catch (error) {
    if (error instanceof FileProblem) throw error;
    throw new FileProblem('This PDF could not be read. Select it again from your device.');
  }
  try {
    const pdf = await PDFDocument.load(bytes, { throwOnInvalidObject: true });
    if (!pdf.getPageCount()) throw new Error('No pages');
    return pdf;
  } catch {
    throw new FileProblem('This PDF could not be opened. It may be encrypted, damaged or contain no pages.');
  }
}

export function parseRanges(value: string, total: number): number[] {
  if (!value.trim()) throw new FileProblem('Enter at least one page or range.');
  const pages: number[] = [];
  for (const raw of value.split(',')) {
    const match = raw.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new FileProblem('Use page numbers or ranges separated by commas, for example 1-3, 5. Remove empty entries.');
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < 1 || start > total || end > total) {
      throw new FileProblem(`Pages must be whole numbers from 1 to ${total}.`);
    }
    if (pages.length + Math.abs(end - start) + 1 > MAX_PDF_PAGES) {
      throw new FileProblem('Extract at most 2000 pages at a time, including repeated pages.');
    }
    const step = start <= end ? 1 : -1;
    for (let page = start; ; page += step) {
      pages.push(page - 1);
      if (page === end) break;
    }
  }
  return pages;
}

export async function pdfBlob(pdf: PDFDocument): Promise<Blob> {
  const bytes = await pdf.save();
  // Copy into an ArrayBuffer-owned view: TS 5.9 correctly excludes SharedArrayBuffer from BlobPart.
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}
