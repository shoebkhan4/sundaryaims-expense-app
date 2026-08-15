import type { OcrResult } from './ocrService';
import { parseReceiptText } from './ocrService';

/**
 * Reads a PDF bill.
 *
 * Uploading a PDF used to fill in nothing but whatever digits happened to be in
 * the file name — the document itself was never opened. Most bills that arrive
 * as PDFs (fuel cards, online orders, utilities) carry a real text layer, so
 * the amount, date and vendor can be read exactly rather than guessed, and far
 * more reliably than from a photograph.
 *
 * pdf.js is loaded on demand: it is a large library and most attachments are
 * photographs, so it must not sit in the initial bundle.
 */
/** The slice of pdf.js's document API this module relies on. */
interface PDFDocumentLike {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (o: { scale: number }) => { width: number; height: number };
    render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
    getTextContent: () => Promise<{ items: unknown[] }>;
  }>;
}

export interface PdfReadResult extends OcrResult {
  /** First page rendered as an image, so the bill still appears in the compiled PDF. */
  pageImage?: string;
  pageCount: number;
}

/** Longest edge of the rendered page image. */
const PAGE_IMAGE_MAX_DIM = 1700;

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  // Vite resolves the worker to a URL it will emit as its own chunk.
  const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

export async function readPdfBill(file: File): Promise<PdfReadResult> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = (await pdfjs.getDocument({ data }).promise) as unknown as PDFDocumentLike;

  // Bills are short; reading every page costs little and catches totals that
  // sit on a continuation sheet.
  const MAX_PAGES = 10;
  const pageTexts: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pageTexts.push(linesFromTextItems(content.items));
  }

  const text = pageTexts.join('\n');
  const parsed = parseReceiptText(text, text.trim().length > 0 ? 95 : 0);

  return {
    ...parsed,
    pageImage: await renderFirstPage(doc),
    pageCount: doc.numPages
  };
}

/**
 * Rebuilds lines from positioned glyph runs.
 *
 * pdf.js returns text in draw order with coordinates, not as lines. The parser
 * reasons per line — a label and its amount belonging together — so runs at the
 * same height are joined and the rest are split apart.
 */
function linesFromTextItems(items: unknown[]): string {
  interface Run {
    text: string;
    x: number;
    y: number;
  }

  const runs: Run[] = [];
  for (const item of items) {
    const it = item as { str?: string; transform?: number[] };
    if (!it || typeof it.str !== 'string' || it.str.trim() === '') continue;
    const transform = it.transform;
    if (!transform || transform.length < 6) continue;
    runs.push({ text: it.str, x: transform[4], y: transform[5] });
  }
  if (runs.length === 0) return '';

  // Group by vertical position, tolerating the slight drift within a line.
  const TOLERANCE = 3;
  runs.sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: Run[][] = [];
  for (const run of runs) {
    const current = lines[lines.length - 1];
    if (current && Math.abs(current[0].y - run.y) <= TOLERANCE) current.push(run);
    else lines.push([run]);
  }

  return lines
    .map((line) =>
      line
        .sort((a, b) => a.x - b.x)
        .map((r) => r.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .join('\n');
}

/** Renders page one so the bill is still visible in the compiled bills PDF. */
async function renderFirstPage(doc: PDFDocumentLike): Promise<string | undefined> {
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, PAGE_IMAGE_MAX_DIM / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch (err) {
    console.error('Could not render the PDF page:', err);
    return undefined;
  }
}
