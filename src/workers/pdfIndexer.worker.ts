import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error pdfjs-dist ships build/pdf.worker.mjs without an adjacent .d.ts file
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs';
import { createWorker } from 'tesseract.js';
import {
  computeOcrRenderScale,
  extractPdfPagesWithFailFast,
  normalizeOcrPageRange,
  sanitizeExtractedPdfText,
  SCANNED_PDF_NO_OCR_CODE,
  SCANNED_PDF_NO_OCR_MESSAGE,
  ScannedPdfNoOcrError,
  type ExtractedPdfPage,
  type OcrLanguage,
} from '../core/pdfRulesStore';

export type OcrProgressStage = 'loading-engine' | 'recognizing';

export interface StartOcrIndexingPayload {
  buffer: ArrayBuffer;
  bookTitle: string;
  systemId: string;
  lang: OcrLanguage;
  startPage?: number;
  endPage?: number;
  jobId?: string;
  bookId?: string;
}

export type PdfIndexWorkerRequest =
  | {
      type: 'extract';
      jobId: string;
      bookId: string;
      bookTitle: string;
      systemId: string;
      buffer: ArrayBuffer;
    }
  | {
      type: 'START_OCR_INDEXING';
      payload: StartOcrIndexingPayload;
    }
  | {
      type: 'ABORT_INDEXING';
      jobId?: string;
    };

export type PdfIndexWorkerResponse =
  | {
      type: 'progress';
      jobId: string;
      bookId: string;
      page: number;
      totalPages: number;
    }
  | {
      type: 'OCR_PROGRESS';
      jobId: string;
      bookId: string;
      page: number;
      totalPages: number;
      currentPdfPage?: number;
      stage: OcrProgressStage;
    }
  | {
      type: 'complete';
      jobId: string;
      bookId: string;
      bookTitle: string;
      systemId: string;
      totalPages: number;
      pages: ExtractedPdfPage[];
      isOcr?: boolean;
    }
  | {
      type: 'aborted';
      jobId: string;
      bookId: string;
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

async function handleExtractRequest(
  request: Extract<PdfIndexWorkerRequest, { type: 'extract' }>,
): Promise<void> {
  let bufferRef: ArrayBuffer | null = request.buffer;
  let bytesRef: Uint8Array | null = new Uint8Array(request.buffer);
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

export interface OcrWorkerLike {
  recognize(image: unknown): Promise<{ data: { text: string } }>;
  terminate(): Promise<unknown>;
}

export interface OcrPipelineDeps {
  createOcrWorker?: (lang: OcrLanguage) => Promise<OcrWorkerLike>;
  postMessage?: (msg: PdfIndexWorkerResponse) => void;
  shouldAbort?: () => boolean;
  onWorkerCreated?: (worker: OcrWorkerLike | null) => void;
  renderPageToImage?: (pdfPage: pdfjsLib.PDFPageProxy) => Promise<Blob | ImageData>;
  loadPdfDocument?: (bytes: Uint8Array) => {
    promise: Promise<pdfjsLib.PDFDocumentProxy>;
    destroy: () => Promise<void>;
  };
}

let activeOcrJobId: string | null = null;
let abortRequested = false;
let activeTesseractWorker: OcrWorkerLike | null = null;

async function defaultRenderPageToOcrImage(
  pdfPage: pdfjsLib.PDFPageProxy,
): Promise<Blob | ImageData> {
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error(
      'OffscreenCanvas indisponível neste navegador para rasterização OCR em Web Worker.',
    );
  }

  const baseViewport = pdfPage.getViewport({ scale: 1 });
  const scale = computeOcrRenderScale(baseViewport.width, 1600);
  const viewport = pdfPage.getViewport({ scale });

  const width = Math.max(1, Math.floor(viewport.width));
  const height = Math.max(1, Math.floor(viewport.height));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.width = 0;
    canvas.height = 0;
    throw new Error('Não foi possível inicializar o contexto 2D do OffscreenCanvas.');
  }

  try {
    // White background improves OCR accuracy on transparent PDFs
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    await pdfPage.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      canvas: canvas as unknown as HTMLCanvasElement,
      viewport,
    }).promise;

    if (typeof canvas.convertToBlob === 'function') {
      return await canvas.convertToBlob({ type: 'image/png' });
    }
    return ctx.getImageData(0, 0, width, height);
  } finally {
    // Zero and release canvas memory immediately after each page
    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } catch {
      // Ignore clearRect errors
    }
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function runOcrIndexingPipeline(
  payload: StartOcrIndexingPayload,
  deps: OcrPipelineDeps = {},
): Promise<void> {
  const jobId =
    payload.jobId?.trim() || `ocr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const bookId =
    payload.bookId?.trim() || `pdf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const emit =
    deps.postMessage ?? ((msg: PdfIndexWorkerResponse) => self.postMessage(msg));
  const isAborted = deps.shouldAbort ?? (() => abortRequested && activeOcrJobId === jobId);
  const createOcrWorkerFn =
    deps.createOcrWorker ?? (async (lang: OcrLanguage) => createWorker(lang));
  const renderPageFn = deps.renderPageToImage ?? defaultRenderPageToOcrImage;
  const loadDocFn =
    deps.loadPdfDocument ??
    ((bytes: Uint8Array) =>
      pdfjsLib.getDocument({
        data: bytes,
        useWorkerFetch: false,
        disableAutoFetch: true,
      }));

  let bufferRef: ArrayBuffer | null = payload.buffer;
  let bytesRef: Uint8Array | null = new Uint8Array(bufferRef);
  let loadingTask: { promise: Promise<pdfjsLib.PDFDocumentProxy>; destroy: () => Promise<void> } | null =
    null;
  let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
  let tesseractWorker: OcrWorkerLike | null = null;

  try {
    loadingTask = loadDocFn(bytesRef);
    pdfDoc = await loadingTask.promise;
    const pdfTotalPages = pdfDoc.numPages;

    const { startPage, endPage, rangeTotal } = normalizeOcrPageRange(
      pdfTotalPages,
      payload.startPage,
      payload.endPage,
    );

    if (isAborted()) {
      emit({ type: 'aborted', jobId, bookId });
      return;
    }

    emit({
      type: 'OCR_PROGRESS',
      jobId,
      bookId,
      page: 0,
      totalPages: rangeTotal,
      currentPdfPage: startPage,
      stage: 'loading-engine',
    });

    tesseractWorker = await createOcrWorkerFn(payload.lang);
    deps.onWorkerCreated?.(tesseractWorker);

    if (isAborted()) {
      emit({ type: 'aborted', jobId, bookId });
      return;
    }

    const pages: ExtractedPdfPage[] = [];
    let processedCount = 0;

    for (let pageNum = startPage; pageNum <= endPage; pageNum += 1) {
      if (isAborted()) {
        emit({ type: 'aborted', jobId, bookId });
        return;
      }

      const pdfPage = await pdfDoc.getPage(pageNum);
      let pageImage: Blob | ImageData | null = null;
      try {
        pageImage = await renderPageFn(pdfPage);
      } finally {
        pdfPage.cleanup();
      }

      if (isAborted()) {
        pageImage = null;
        emit({ type: 'aborted', jobId, bookId });
        return;
      }

      const result = await tesseractWorker.recognize(pageImage);
      pageImage = null;

      if (isAborted()) {
        emit({ type: 'aborted', jobId, bookId });
        return;
      }

      const cleanText = sanitizeExtractedPdfText(result?.data?.text ?? '');
      pages.push({ page: pageNum, content: cleanText });
      processedCount += 1;

      emit({
        type: 'OCR_PROGRESS',
        jobId,
        bookId,
        page: processedCount,
        totalPages: rangeTotal,
        currentPdfPage: pageNum,
        stage: 'recognizing',
      });
    }

    if (isAborted()) {
      emit({ type: 'aborted', jobId, bookId });
      return;
    }

    emit({
      type: 'complete',
      jobId,
      bookId,
      bookTitle: payload.bookTitle,
      systemId: payload.systemId,
      totalPages: pdfTotalPages,
      pages,
      isOcr: true,
    });
  } catch (err) {
    if (isAborted()) {
      emit({ type: 'aborted', jobId, bookId });
      return;
    }
    const message =
      err instanceof Error
        ? err.message
        : 'Falha ao executar OCR local no PDF selecionado.';
    emit({
      type: 'error',
      jobId,
      bookId,
      error: message,
    });
  } finally {
    if (tesseractWorker) {
      try {
        await tesseractWorker.terminate();
      } catch {
        // Ignore terminate errors
      }
      tesseractWorker = null;
    }
    deps.onWorkerCreated?.(null);

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
    pdfDoc = null;
    loadingTask = null;
    bytesRef = null;
    bufferRef = null;
  }
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('message', (event: MessageEvent<PdfIndexWorkerRequest>) => {
    const payload = event.data;
    if (!payload) return;

    if (payload.type === 'extract') {
      void handleExtractRequest(payload as Extract<PdfIndexWorkerRequest, { type: 'extract' }>);
      return;
    }

    if (payload.type === 'START_OCR_INDEXING') {
      const jobId =
        payload.payload.jobId?.trim() ||
        `ocr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      activeOcrJobId = jobId;
      abortRequested = false;

      void runOcrIndexingPipeline(
        { ...payload.payload, jobId },
        {
          onWorkerCreated: (w) => {
            activeTesseractWorker = w;
          },
          shouldAbort: () => abortRequested && activeOcrJobId === jobId,
        },
      ).finally(() => {
        if (activeOcrJobId === jobId) {
          activeOcrJobId = null;
          abortRequested = false;
          activeTesseractWorker = null;
        }
      });
      return;
    }

    if (payload.type === 'ABORT_INDEXING') {
      if (!payload.jobId || payload.jobId === activeOcrJobId) {
        abortRequested = true;
        if (activeTesseractWorker) {
          const workerToKill = activeTesseractWorker;
          activeTesseractWorker = null;
          void workerToKill.terminate().catch(() => {
            // Ignore terminate errors on abort
          });
        }
      }
    }
  });
}
