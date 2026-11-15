import { describe, expect, it, vi } from 'vitest';
import {
  buildPageDocId,
  computeOcrRenderScale,
  createIndexedDbStorageBackend,
  createInMemoryStorageBackend,
  extractPdfPagesWithFailFast,
  normalizeOcrPageRange,
  PdfRulesStore,
  sanitizeExtractedPdfText,
  SCANNED_PDF_NO_OCR_CODE,
  ScannedPdfNoOcrError,
  type BookMetadata,
} from './pdfRulesStore';
import {
  runOcrIndexingPipeline,
  type OcrWorkerLike,
  type PdfIndexWorkerResponse,
} from '../workers/pdfIndexer.worker';

/**
 * Minimal spec-compatible IDBFactory mock to exercise real IndexedDB transactions,
 * object stores, cursors/getAll, put, get, delete, and upgrade hooks inside Vitest.
 */
function createMockIdbFactory(): IDBFactory {
  const databases = new Map<string, Map<string, Map<string, unknown>>>();

  function makeRequest<T>(executor: () => T): IDBRequest<T> {
    const req = {
      result: undefined as T,
      error: null as DOMException | null,
      onsuccess: null as ((ev: Event) => void) | null,
      onerror: null as ((ev: Event) => void) | null,
    } as unknown as IDBRequest<T>;

    queueMicrotask(() => {
      try {
        (req as { result: T }).result = executor();
        req.onsuccess?.(new Event('success'));
      } catch (err) {
        (req as { error: DOMException }).error =
          err instanceof DOMException ? err : new DOMException(String(err));
        req.onerror?.(new Event('error'));
      }
    });

    return req;
  }

  return {
    open(name: string): IDBOpenDBRequest {
      let stores = databases.get(name);
      const needsUpgrade = !stores;
      if (!stores) {
        stores = new Map();
        databases.set(name, stores);
      }

      const storeNamesList: string[] = Array.from(stores.keys());
      const objectStoreNames = {
        contains: (storeName: string) => stores!.has(storeName),
        item: (i: number) => storeNamesList[i] ?? null,
        get length() {
          return storeNamesList.length;
        },
        [Symbol.iterator]: () => storeNamesList[Symbol.iterator](),
      } as unknown as DOMStringList;

      const db = {
        objectStoreNames,
        createObjectStore(storeName: string) {
          if (!stores!.has(storeName)) {
            stores!.set(storeName, new Map());
            storeNamesList.push(storeName);
          }
          return {
            createIndex: () => ({} as IDBIndex),
          } as unknown as IDBObjectStore;
        },
        transaction(storeOrStores: string | string[]) {
          const names = Array.isArray(storeOrStores) ? storeOrStores : [storeOrStores];
          const tx = {
            oncomplete: null as ((ev: Event) => void) | null,
            onerror: null as ((ev: Event) => void) | null,
            onabort: null as ((ev: Event) => void) | null,
            objectStore(storeName: string) {
              if (!names.includes(storeName)) {
                throw new Error(`Store ${storeName} not in transaction`);
              }
              const map = stores!.get(storeName)!;
              const keyPath = storeName === 'books' ? 'bookId' : 'key';
              return {
                getAll: () => makeRequest(() => Array.from(map.values())),
                get: (key: string) => makeRequest(() => map.get(key)),
                put: (value: Record<string, unknown>) =>
                  makeRequest(() => {
                    map.set(String(value[keyPath]), structuredClone(value));
                    return value[keyPath];
                  }),
                delete: (key: string) =>
                  makeRequest(() => {
                    map.delete(String(key));
                    return undefined;
                  }),
                clear: () =>
                  makeRequest(() => {
                    map.clear();
                    return undefined;
                  }),
              } as unknown as IDBObjectStore;
            },
          } as unknown as IDBTransaction;

          queueMicrotask(() => {
            queueMicrotask(() => {
              tx.oncomplete?.(new Event('complete'));
            });
          });
          return tx;
        },
      } as unknown as IDBDatabase;

      const openReq = {
        result: db,
        error: null,
        onupgradeneeded: null as ((ev: IDBVersionChangeEvent) => void) | null,
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
      } as unknown as IDBOpenDBRequest;

      queueMicrotask(() => {
        if (needsUpgrade) {
          openReq.onupgradeneeded?.(new Event('upgradeneeded') as IDBVersionChangeEvent);
        }
        openReq.onsuccess?.(new Event('success'));
      });

      return openReq;
    },
  } as unknown as IDBFactory;
}

describe('pdfRulesStore', () => {
  it('sanitizes multiple spaces and line-break hyphenations cleanly', () => {
    const raw =
      'Super-\nficial   damage\tfrom   ag-\n  gravated   sour\u00AD\nces\n\n  is   halved.\n1 - 5 dice.';
    expect(sanitizeExtractedPdfText(raw)).toBe(
      'Superficial damage from aggravated sources is halved. 1 - 5 dice.',
    );
  });

  it('indexes books, persists MiniSearch JSON in IndexedDB, and hydrates across store instances', async () => {
    const mockIdb = createMockIdbFactory();
    const storeA = new PdfRulesStore(createIndexedDbStorageBackend(mockIdb));

    const meta = await storeA.indexBook({
      bookId: 'v5_core',
      bookTitle: 'Vampire V5 Corebook',
      systemId: 'wod',
      pages: [
        {
          page: 1,
          content: 'Table of contents and introduction to the World of Darkness.',
        },
        {
          page: 219,
          content:
            'Frenzy occurs when the Beast overwhelms the vampire. Hunger dice increase risk of Fury Frenzy.',
        },
        {
          page: 220,
          content:
            'Rouse checks test Hunger. Rolling 1-5 on a Rouse Check increases Hunger by 1.',
        },
      ],
    });

    expect(meta.bookId).toBe('v5_core');
    expect(meta.pageCount).toBe(220);
    expect(meta.indexedPageCount).toBe(3);
    expect(meta.charCount).toBeGreaterThan(100);
    expect(buildPageDocId('v5_core', 219)).toBe('v5_core::p219');

    // Hydrate a fresh store instance from the same IndexedDB mock
    const storeB = new PdfRulesStore(createIndexedDbStorageBackend(mockIdb));
    const books = await storeB.listBooks('wod');
    expect(books).toHaveLength(1);
    expect(books[0].bookTitle).toBe('Vampire V5 Corebook');

    const hits = await storeB.searchLocalRules('Frenzy', 'wod', 5);
    expect(hits).toHaveLength(1);
    expect(hits[0].bookTitle).toBe('Vampire V5 Corebook');
    expect(hits[0].page).toBe(219);
    expect(hits[0].highlightParts.some((part) => part.matched && /frenzy/i.test(part.text))).toBe(
      true,
    );
  });

  it('filters books and search results strictly by systemId', async () => {
    const store = new PdfRulesStore(createInMemoryStorageBackend());

    await store.indexBook({
      bookId: 'wod_book',
      bookTitle: 'WoD Storyteller Guide',
      systemId: 'wod',
      pages: [
        { page: 12, content: 'Aggravated damage cannot be halved and requires Rouse healing.' },
      ],
    });

    await store.indexBook({
      bookId: 'dnd_book',
      bookTitle: '5e Player Handbook',
      systemId: 'dnd5e',
      pages: [
        { page: 196, content: 'Critical hit damage doubles all weapon damage dice rolled.' },
      ],
    });

    await store.indexBook({
      bookId: 'cp_book',
      bookTitle: 'Cyberpunk Red Core',
      systemId: 'cyberpunk',
      pages: [
        { page: 173, content: 'Armor SP ablates by 1 whenever damage penetrates stopping power.' },
      ],
    });

    expect((await store.listBooks('wod')).map((b: BookMetadata) => b.bookId)).toEqual(['wod_book']);
    expect((await store.listBooks('dnd5e')).map((b: BookMetadata) => b.bookId)).toEqual(['dnd_book']);
    expect(await store.listBooks()).toHaveLength(3);

    const wodHits = await store.searchLocalRules('damage', 'wod', 5);
    expect(wodHits).toHaveLength(1);
    expect(wodHits[0].systemId).toBe('wod');
    expect(wodHits[0].page).toBe(12);

    const dndHits = await store.searchLocalRules('damage', 'dnd5e', 5);
    expect(dndHits).toHaveLength(1);
    expect(dndHits[0].systemId).toBe('dnd5e');
    expect(dndHits[0].page).toBe(196);

    const allHits = await store.searchLocalRules('damage', undefined, 2);
    expect(allHits).toHaveLength(2);
  });

  it('ranks multi-term and high-frequency pages higher and supports prefix, fuzzy (0.2), and accent-insensitive queries', async () => {
    const store = new PdfRulesStore(createInMemoryStorageBackend());

    await store.indexBook({
      bookId: 'rules_pt',
      bookTitle: 'Manual de Combate',
      systemId: 'wod',
      pages: [
        {
          page: 10,
          content: 'Introdução geral sobre iniciativa e movimento em cena.',
        },
        {
          page: 45,
          content: 'Em combate corpo a corpo, verifique Força e Perícia antes do dano.',
        },
        {
          page: 88,
          content:
            'Regra completa de Frenesi e Fome: quando a Fome atinge 5, o teste de Frenesi usa Força de Vontade. Frenesi ignora penalidades de ferimento.',
        },
      ],
    });

    // Multi-term ranking: page 88 matches both Frenesi and Fome repeatedly
    const rankedHits = await store.searchLocalRules('Frenesi Fome', 'wod', 5);
    expect(rankedHits.length).toBeGreaterThanOrEqual(1);
    expect(rankedHits[0].page).toBe(88);
    expect(rankedHits[0].score).toBeGreaterThan(0);

    // Prefix search ("iniciat" -> "iniciativa")
    const prefixHits = await store.searchLocalRules('iniciat', 'wod', 5);
    expect(prefixHits.map((h) => h.page)).toContain(10);

    // Fuzzy 0.2 search ("Frenezi" -> "Frenesi")
    const fuzzyHits = await store.searchLocalRules('Frenezi', 'wod', 5);
    expect(fuzzyHits.map((h) => h.page)).toContain(88);

    // Accent-insensitive search ("pericia forca" -> "Força e Perícia")
    const accentHits = await store.searchLocalRules('pericia forca', 'wod', 5);
    expect(accentHits[0].page).toBe(45);
  });

  it('removes a book from both MiniSearch and IndexedDB without affecting other books', async () => {
    const mockIdb = createMockIdbFactory();
    const store = new PdfRulesStore(createIndexedDbStorageBackend(mockIdb));

    await store.indexBook({
      bookId: 'book_keep',
      bookTitle: 'Core Rules',
      systemId: 'dnd5e',
      pages: [
        { page: 20, content: 'Grapple requires a Strength (Athletics) check contested by the target.' },
      ],
    });

    await store.indexBook({
      bookId: 'book_delete',
      bookTitle: 'Homebrew Expansion',
      systemId: 'dnd5e',
      pages: [
        { page: 5, content: 'Grapple variant rule with cybernetic grappling hooks and bonus reach.' },
        { page: 6, content: 'Advanced grapple maneuvers for aerial combat.' },
      ],
    });

    expect((await store.searchLocalRules('grapple', 'dnd5e', 5))).toHaveLength(3);

    const removed = await store.removeBook('book_delete');
    expect(removed).toBe(true);
    expect(await store.removeBook('nonexistent_book')).toBe(false);

    const remainingBooks = await store.listBooks('dnd5e');
    expect(remainingBooks.map((b) => b.bookId)).toEqual(['book_keep']);

    const hitsAfterDelete = await store.searchLocalRules('grapple', 'dnd5e', 5);
    expect(hitsAfterDelete).toHaveLength(1);
    expect(hitsAfterDelete[0].bookId).toBe('book_keep');

    // Re-hydrate from persisted IndexedDB to verify deletion persisted in serialized index
    const reloadedStore = new PdfRulesStore(createIndexedDbStorageBackend(mockIdb));
    expect((await reloadedStore.listBooks())).toHaveLength(1);
    const reloadedHits = await reloadedStore.searchLocalRules('grapple', 'dnd5e', 5);
    expect(reloadedHits).toHaveLength(1);
    expect(reloadedHits[0].bookId).toBe('book_keep');
  });

  it('searches 150 indexed pages in under 20 ms', async () => {
    const store = new PdfRulesStore(createInMemoryStorageBackend());
    const pages = Array.from({ length: 150 }, (_, idx) => ({
      page: idx + 1,
      content:
        idx === 112
          ? 'Special rule: Opportunity Attack triggers when a hostile creature leaves your reach without disengaging.'
          : `Standard rulebook page ${idx + 1} covering exploration, equipment, travel pace, and downtime activities.`,
    }));

    await store.indexBook({
      bookId: 'big_book',
      bookTitle: 'System Reference 150p',
      systemId: 'dnd5e',
      pages,
    });

    const t0 = performance.now();
    const hits = store.searchLocalRulesSync('Opportunity Attack', 'dnd5e', 5);
    const elapsedMs = performance.now() - t0;

    expect(hits).toHaveLength(1);
    expect(hits[0].page).toBe(113);
    expect(elapsedMs).toBeLessThan(20);
  });

  it('aborts fail-fast on page 10 for a 15-page scanned PDF without OCR and persists nothing', async () => {
    const mockIdb = createMockIdbFactory();
    const store = new PdfRulesStore(createIndexedDbStorageBackend(mockIdb));

    let pagesVisited = 0;
    const noisyPages = Array.from({ length: 15 }, (_, idx) => {
      const pageNum = idx + 1;
      // Noise under 30 non-whitespace chars per page (< 40 chars threshold)
      return `Pg ${pageNum} / 15`;
    });

    let caughtError: unknown = null;
    try {
      await extractPdfPagesWithFailFast({
        totalPages: noisyPages.length,
        readPageText: (pageNumber) => {
          pagesVisited += 1;
          return noisyPages[pageNumber - 1] ?? '';
        },
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ScannedPdfNoOcrError);
    const scannedErr = caughtError as ScannedPdfNoOcrError;
    expect(scannedErr.code).toBe(SCANNED_PDF_NO_OCR_CODE);
    expect(scannedErr.sampledPages).toBe(10);
    expect(scannedErr.totalPages).toBe(15);
    expect(pagesVisited).toBe(10);

    // Direct store.indexBook guard also rejects without persisting metadata or MiniSearch docs
    await expect(
      store.indexBook({
        bookId: 'scanned_15p',
        bookTitle: 'Manual Escaneado',
        systemId: 'wod',
        totalPages: 15,
        pages: noisyPages.map((content, idx) => ({ page: idx + 1, content })),
      }),
    ).rejects.toThrow(ScannedPdfNoOcrError);

    expect(await store.listBooks()).toHaveLength(0);
    expect(store.getIndexedDocumentCount()).toBe(0);
  });

  it('continues indexing beyond page 10 when page 10 contains a real text layer (>= 40 chars)', async () => {
    let pagesVisited = 0;
    const pages = await extractPdfPagesWithFailFast({
      totalPages: 15,
      readPageText: (pageNumber) => {
        pagesVisited += 1;
        if (pageNumber < 10) return '';
        return `Chapter ${pageNumber}: Combat rules, initiative order, and damage resolution mechanics.`;
      },
    });

    expect(pagesVisited).toBe(15);
    expect(pages).toHaveLength(15);
  });

  it('transitions from ERROR_NO_TEXT_LAYER to on-demand OCR pipeline and persists searchable index', async () => {
    const mockIdb = createMockIdbFactory();
    const store = new PdfRulesStore(createIndexedDbStorageBackend(mockIdb));

    // 1. Fail-fast detects scanned PDF without text layer
    await expect(
      extractPdfPagesWithFailFast({
        totalPages: 12,
        readPageText: () => '',
      }),
    ).rejects.toThrow(ScannedPdfNoOcrError);

    // 2. User triggers OCR fallback with mocked PDF.js document and Tesseract worker
    const events: PdfIndexWorkerResponse[] = [];
    const recognizeMock = vi.fn(async (img: unknown) => {
      const marker = (img as { pageNum: number }).pageNum;
      return {
        data: {
          text:
            marker === 2
              ? 'Com-\nbate Tático: rolar   Iniciativa d20 + Destreza.'
              : `Página ${marker} arte ilustrativa`,
        },
      };
    });
    const terminateMock = vi.fn(async () => undefined);
    const createOcrWorkerMock = vi.fn(async (): Promise<OcrWorkerLike> => ({
      recognize: recognizeMock,
      terminate: terminateMock,
    }));

    const cleanedPages: number[] = [];
    await runOcrIndexingPipeline(
      {
        buffer: new ArrayBuffer(16),
        bookTitle: 'Manual Escaneado OCR',
        systemId: 'dnd5e',
        lang: 'por',
        jobId: 'ocr_job_1',
        bookId: 'scanned_ocr_book',
      },
      {
        createOcrWorker: createOcrWorkerMock,
        postMessage: (msg) => events.push(msg),
        loadPdfDocument: () => ({
          promise: Promise.resolve({
            numPages: 3,
            getPage: async (pageNum: number) => ({
              cleanup: () => cleanedPages.push(pageNum),
              pageNum,
            }),
            cleanup: async () => undefined,
          } as unknown as any),
          destroy: async () => undefined,
        }),
        renderPageToImage: async (page) =>
          ({ pageNum: (page as unknown as { pageNum: number }).pageNum }) as unknown as Blob,
      },
    );

    expect(createOcrWorkerMock).toHaveBeenCalledTimes(1);
    expect(createOcrWorkerMock).toHaveBeenCalledWith('por');
    expect(recognizeMock).toHaveBeenCalledTimes(3);
    expect(terminateMock).toHaveBeenCalledTimes(1);
    expect(cleanedPages).toEqual([1, 2, 3]);

    const progressEvents = events.filter((e) => e.type === 'OCR_PROGRESS');
    expect(progressEvents[0]).toMatchObject({
      type: 'OCR_PROGRESS',
      stage: 'loading-engine',
      page: 0,
      totalPages: 3,
    });
    expect(progressEvents[progressEvents.length - 1]).toMatchObject({
      type: 'OCR_PROGRESS',
      stage: 'recognizing',
      page: 3,
      totalPages: 3,
    });

    const completeEvent = events.find((e) => e.type === 'complete');
    expect(completeEvent).toBeDefined();
    if (completeEvent && completeEvent.type === 'complete') {
      expect(completeEvent.isOcr).toBe(true);
      await store.indexBook({
        bookId: completeEvent.bookId,
        bookTitle: completeEvent.bookTitle,
        systemId: completeEvent.systemId,
        pages: completeEvent.pages,
        totalPages: completeEvent.totalPages,
        skipTextLayerCheck: true,
      });
    }

    const hits = await store.searchLocalRules('Iniciativa', 'dnd5e', 5);
    expect(hits).toHaveLength(1);
    expect(hits[0].page).toBe(2);
    expect(hits[0].excerpt).toContain('Combate Tático');
  });

  it('respects startPage..endPage range and caps OCR rasterization scale at 1600px', async () => {
    expect(normalizeOcrPageRange(50, 12, 15)).toEqual({
      startPage: 12,
      endPage: 15,
      rangeTotal: 4,
    });
    expect(normalizeOcrPageRange(20, 0, 999)).toEqual({
      startPage: 1,
      endPage: 20,
      rangeTotal: 20,
    });
    expect(computeOcrRenderScale(1000, 1600)).toBeCloseTo(1.6);
    expect(computeOcrRenderScale(400, 1600)).toBe(2.5);

    const visitedPages: number[] = [];
    const events: PdfIndexWorkerResponse[] = [];

    await runOcrIndexingPipeline(
      {
        buffer: new ArrayBuffer(8),
        bookTitle: 'Capítulo de Regras',
        systemId: 'wod',
        lang: 'por+eng',
        startPage: 4,
        endPage: 6,
        jobId: 'ocr_range_job',
        bookId: 'range_book',
      },
      {
        createOcrWorker: async () => ({
          recognize: async (img) => ({
            data: { text: `Regra da página ${(img as { pageNum: number }).pageNum}` },
          }),
          terminate: async () => undefined,
        }),
        postMessage: (msg) => events.push(msg),
        loadPdfDocument: () => ({
          promise: Promise.resolve({
            numPages: 10,
            getPage: async (pageNum: number) => {
              visitedPages.push(pageNum);
              return { cleanup: () => undefined, pageNum };
            },
            cleanup: async () => undefined,
          } as unknown as any),
          destroy: async () => undefined,
        }),
        renderPageToImage: async (page) =>
          ({ pageNum: (page as unknown as { pageNum: number }).pageNum }) as unknown as Blob,
      },
    );

    expect(visitedPages).toEqual([4, 5, 6]);
    const completeEvent = events.find((e) => e.type === 'complete');
    expect(completeEvent).toBeDefined();
    if (completeEvent && completeEvent.type === 'complete') {
      expect(completeEvent.totalPages).toBe(10);
      expect(completeEvent.pages.map((p) => p.page)).toEqual([4, 5, 6]);
    }
  });

  it('aborts OCR cleanly on ABORT_INDEXING without emitting complete or corrupting store', async () => {
    const mockIdb = createMockIdbFactory();
    const store = new PdfRulesStore(createIndexedDbStorageBackend(mockIdb));

    let aborted = false;
    let recognizedCount = 0;
    const terminateMock = vi.fn(async () => undefined);
    const events: PdfIndexWorkerResponse[] = [];

    await runOcrIndexingPipeline(
      {
        buffer: new ArrayBuffer(8),
        bookTitle: 'Livro Cancelado',
        systemId: 'wod',
        lang: 'eng',
        startPage: 1,
        endPage: 10,
        jobId: 'ocr_abort_job',
        bookId: 'abort_book',
      },
      {
        shouldAbort: () => aborted,
        createOcrWorker: async () => ({
          recognize: async () => {
            recognizedCount += 1;
            if (recognizedCount === 2) {
              aborted = true;
            }
            return { data: { text: `Texto página ${recognizedCount}` } };
          },
          terminate: terminateMock,
        }),
        postMessage: (msg) => events.push(msg),
        loadPdfDocument: () => ({
          promise: Promise.resolve({
            numPages: 10,
            getPage: async (pageNum: number) => ({ cleanup: () => undefined, pageNum }),
            cleanup: async () => undefined,
          } as unknown as any),
          destroy: async () => undefined,
        }),
        renderPageToImage: async (page) =>
          ({ pageNum: (page as unknown as { pageNum: number }).pageNum }) as unknown as Blob,
      },
    );

    expect(recognizedCount).toBe(2);
    expect(terminateMock).toHaveBeenCalledTimes(1);
    expect(events.some((e) => e.type === 'aborted')).toBe(true);
    expect(events.some((e) => e.type === 'complete')).toBe(false);
    expect(await store.listBooks()).toHaveLength(0);
    expect(store.getIndexedDocumentCount()).toBe(0);
  });
});
