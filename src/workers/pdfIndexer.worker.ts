import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error pdfjs-dist ships build/pdf.worker.mjs without an adjacent .d.ts file
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs';
import {
  extractPdfPagesWithFailFast,
  sanitizeExtractedPdfText,
  SCANNED_PDF_NO_OCR_CODE,
  SCANNED_PDF_NO_OCR_MESSAGE,
  ScannedPdfNoOcrError,
  type ExtractedPdfPage,
} from '../core/pdfRulesStore';

export interface PdfIndexWorkerRequest {
  type: 'extract';
  jobId: string;
  bookId: string;
  bookTitle: string;
  systemId: string;
  buffer: ArrayBuffer;
}

export type PdfIndexWorkerResponse =
  | {
      type: 'progress';
      jobId: string;
      bookId: string;
      page: number;
      totalPages: number;
    }
  | {
      type: 'complete';
      jobId: string;
      bookId: string;
      bookTitle: string;
      systemId: string;
      totalPages: number;
      pages: ExtractedPdfPage[];
    }
  | {
      type: 'ERROR_NO_TEXT_LAYER';
      code: typeof SCANNED_PDF_NO_OCR_CODE;
      jobId: string;
      bookId: string;
      sampledPages: number;
      totalPages: number;
      message: string;
    }
  | {
      type: 'error';
      jobId: string;
      bookId: string;
      error: string;
    };

// Register the bundled PDF.js worker handler directly inside this Web Worker
// so pdfjs-dist runs off-thread without spawning a nested sub-worker or fetching external assets.
const workerGlobal = globalThis as typeof globalThis & {
  pdfjsWorker?: typeof pdfjsWorker;
};
if (!workerGlobal.pdfjsWorker) {
  workerGlobal.pdfjsWorker = pdfjsWorker;
}

function joinPageTextItems(items: Array<{ str?: string; hasEOL?: boolean }>): string {
  let raw = '';
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    raw += item.str;
    raw += item.hasEOL ? '\n' : ' ';
  }
  return sanitizeExtractedPdfText(raw);
}

async function handleExtractRequest(request: PdfIndexWorkerRequest): Promise<void> {
  let bufferRef: ArrayBuffer | null = request.buffer;
  let bytesRef: Uint8Array | null = new Uint8Array(bufferRef);
  let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
  let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;

  try {
    loadingTask = pdfjsLib.getDocument({
      data: bytesRef,
      useWorkerFetch: false,
      disableAutoFetch: true,
    });

    pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    self.postMessage({
      type: 'progress',
      jobId: request.jobId,
      bookId: request.bookId,
      page: 0,
      totalPages,
    } satisfies PdfIndexWorkerResponse);

    const pages = await extractPdfPagesWithFailFast({
      totalPages,
      readPageText: async (pageNumber) => {
        const pdfPage = await pdfDoc!.getPage(pageNumber);
        try {
          const textContent = await pdfPage.getTextContent();
          return joinPageTextItems(
            textContent.items as Array<{ str?: string; hasEOL?: boolean }>,
          );
        } finally {
          pdfPage.cleanup();
        }
      },
      onProgress: (pageNumber, pagesTotal) => {
        self.postMessage({
          type: 'progress',
          jobId: request.jobId,
          bookId: request.bookId,
          page: pageNumber,
          totalPages: pagesTotal,
        } satisfies PdfIndexWorkerResponse);
      },
    });

    self.postMessage({
      type: 'complete',
      jobId: request.jobId,
      bookId: request.bookId,
      bookTitle: request.bookTitle,
      systemId: request.systemId,
      totalPages,
      pages,
    } satisfies PdfIndexWorkerResponse);
  } catch (err) {
    if (err instanceof ScannedPdfNoOcrError) {
      self.postMessage({
        type: 'ERROR_NO_TEXT_LAYER',
        code: SCANNED_PDF_NO_OCR_CODE,
        jobId: request.jobId,
        bookId: request.bookId,
        sampledPages: err.sampledPages,
        totalPages: err.totalPages,
        message: err.message || SCANNED_PDF_NO_OCR_MESSAGE,
      } satisfies PdfIndexWorkerResponse);
      return;
    }
    const message =
      err instanceof Error
        ? err.message
        : 'Falha ao extrair texto do PDF selecionado.';
    self.postMessage({
      type: 'error',
      jobId: request.jobId,
      bookId: request.bookId,
      error: message,
    } satisfies PdfIndexWorkerResponse);
  } finally {
    try {
      await pdfDoc?.cleanup(false);
    } catch {
      // Ignore cleanup errors
    }
    try {
      await loadingTask?.destroy();
    } catch {
      // Ignore loadingTask destroy errors
    }
    // Discard references to the raw PDF binary immediately after extraction
    pdfDoc = null;
    loadingTask = null;
    bytesRef = null;
    bufferRef = null;
  }
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('message', (event: MessageEvent<PdfIndexWorkerRequest>) => {
    const payload = event.data;
    if (!payload || payload.type !== 'extract') return;
    void handleExtractRequest(payload);
  });
}
