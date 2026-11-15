import MiniSearch, { type AsPlainObject, type Options as MiniSearchOptions } from 'minisearch';

export interface PdfPageDocument {
  id: string;
  bookId: string;
  bookTitle: string;
  systemId: string;
  page: number;
  content: string;
}

export interface ExtractedPdfPage {
  page: number;
  content: string;
}

export interface BookMetadata {
  bookId: string;
  bookTitle: string;
  systemId: string;
  pageCount: number;
  indexedPageCount: number;
  charCount: number;
  indexedAt: string;
}

export interface LocalRuleHighlightPart {
  text: string;
  matched: boolean;
}

export interface LocalRuleSearchHit {
  id: string;
  bookId: string;
  bookTitle: string;
  systemId: string;
  page: number;
  score: number;
  terms: string[];
  excerpt: string;
  highlightParts: LocalRuleHighlightPart[];
}

export interface IndexPdfBookInput {
  bookId?: string;
  bookTitle: string;
  systemId: string;
  pages: ExtractedPdfPage[];
  totalPages?: number;
}

export interface PdfRulesStorageBackend {
  loadBooks(): Promise<BookMetadata[]>;
  saveBook(book: BookMetadata): Promise<void>;
  deleteBook(bookId: string): Promise<void>;
  loadSerializedIndex(): Promise<string | AsPlainObject | null>;
  saveSerializedIndex(serializedJson: string): Promise<void>;
  clearAll(): Promise<void>;
}

const DB_NAME = 'gridsheet_pdf_rules_v1';
const DB_VERSION = 1;
const BOOKS_STORE = 'books';
const META_STORE = 'index_meta';
const MINISEARCH_KEY = 'minisearch_index';

export function normalizeRulesTerm(term: string): string {
  return term
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function sanitizeExtractedPdfText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\u00AD\s*\r?\n\s*/g, '')
    .replace(/\u00AD/g, '')
    .replace(/([A-Za-zÀ-ÿ0-9])[-‐‑‒–]\s*\r?\n\s*([A-Za-zÀ-ÿ0-9])/g, '$1$2')
    .replace(/[\r\n\t\f\v]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

export function buildPageDocId(bookId: string, page: number): string {
  return `${bookId}::p${page}`;
}

export const PDF_MINISEARCH_OPTIONS: MiniSearchOptions<PdfPageDocument> = {
  fields: ['content', 'bookTitle'],
  storeFields: ['bookId', 'bookTitle', 'systemId', 'page', 'content'],
  processTerm: (term) => {
    const normalized = normalizeRulesTerm(term);
    return normalized.length > 0 ? normalized : null;
  },
};

function promisifyIdbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function awaitIdbTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export function createIndexedDbStorageBackend(idbFactory?: IDBFactory): PdfRulesStorageBackend {
  const factory =
    idbFactory ?? (typeof globalThis !== 'undefined' ? globalThis.indexedDB : undefined);

  if (!factory) {
    return createInMemoryStorageBackend();
  }

  let dbPromise: Promise<IDBDatabase> | null = null;

  const openDb = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = factory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(BOOKS_STORE)) {
          const store = db.createObjectStore(BOOKS_STORE, { keyPath: 'bookId' });
          store.createIndex('systemId', 'systemId', { unique: false });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error ?? new Error('Failed to open IndexedDB'));
      };
    });
    return dbPromise;
  };

  return {
    async loadBooks(): Promise<BookMetadata[]> {
      const db = await openDb();
      const tx = db.transaction(BOOKS_STORE, 'readonly');
      const txDone = awaitIdbTransaction(tx);
      const store = tx.objectStore(BOOKS_STORE);
      const records = await promisifyIdbRequest<BookMetadata[]>(store.getAll());
      await txDone;
      return Array.isArray(records) ? records : [];
    },

    async saveBook(book: BookMetadata): Promise<void> {
      const db = await openDb();
      const tx = db.transaction(BOOKS_STORE, 'readwrite');
      const txDone = awaitIdbTransaction(tx);
      await promisifyIdbRequest(tx.objectStore(BOOKS_STORE).put(book));
      await txDone;
    },

    async deleteBook(bookId: string): Promise<void> {
      const db = await openDb();
      const tx = db.transaction(BOOKS_STORE, 'readwrite');
      const txDone = awaitIdbTransaction(tx);
      await promisifyIdbRequest(tx.objectStore(BOOKS_STORE).delete(bookId));
      await txDone;
    },

    async loadSerializedIndex(): Promise<string | AsPlainObject | null> {
      const db = await openDb();
      const tx = db.transaction(META_STORE, 'readonly');
      const txDone = awaitIdbTransaction(tx);
      const record = await promisifyIdbRequest<{ key: string; json?: string; data?: AsPlainObject } | undefined>(
        tx.objectStore(META_STORE).get(MINISEARCH_KEY),
      );
      await txDone;
      if (!record) return null;
      if (typeof record.json === 'string') return record.json;
      if (record.data && typeof record.data === 'object') return record.data;
      return null;
    },

    async saveSerializedIndex(serializedJson: string): Promise<void> {
      const db = await openDb();
      const tx = db.transaction(META_STORE, 'readwrite');
      const txDone = awaitIdbTransaction(tx);
      await promisifyIdbRequest(
        tx.objectStore(META_STORE).put({
          key: MINISEARCH_KEY,
          json: serializedJson,
          updatedAt: new Date().toISOString(),
        }),
      );
      await txDone;
    },

    async clearAll(): Promise<void> {
      const db = await openDb();
      const tx = db.transaction([BOOKS_STORE, META_STORE], 'readwrite');
      const txDone = awaitIdbTransaction(tx);
      await Promise.all([
        promisifyIdbRequest(tx.objectStore(BOOKS_STORE).clear()),
        promisifyIdbRequest(tx.objectStore(META_STORE).clear()),
      ]);
      await txDone;
    },
  };
}

export function createInMemoryStorageBackend(): PdfRulesStorageBackend {
  const books = new Map<string, BookMetadata>();
  let serializedIndex: string | null = null;

  return {
    async loadBooks() {
      return Array.from(books.values()).map((b) => ({ ...b }));
    },
    async saveBook(book) {
      books.set(book.bookId, { ...book });
    },
    async deleteBook(bookId) {
      books.delete(bookId);
    },
    async loadSerializedIndex() {
      return serializedIndex;
    },
    async saveSerializedIndex(json) {
      serializedIndex = json;
    },
    async clearAll() {
      books.clear();
      serializedIndex = null;
    },
  };
}

function buildNormalizedFoldMap(text: string): {
  folded: string;
  foldedToOriginal: number[];
} {
  let folded = '';
  const foldedToOriginal: number[] = [];

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const norm = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (let j = 0; j < norm.length; j += 1) {
      folded += norm[j];
      foldedToOriginal.push(i);
    }
  }

  return { folded, foldedToOriginal };
}

function collectMatchRanges(
  content: string,
  searchTerms: string[],
): Array<{ start: number; end: number }> {
  const normalizedTerms = Array.from(
    new Set(
      searchTerms
        .map((t) => normalizeRulesTerm(t))
        .filter((t) => t.length >= 2),
    ),
  ).sort((a, b) => b.length - a.length);

  if (normalizedTerms.length === 0 || !content) return [];

  const { folded, foldedToOriginal } = buildNormalizedFoldMap(content);
  const rawRanges: Array<{ start: number; end: number }> = [];

  for (const term of normalizedTerms) {
    let fromIndex = 0;
    while (fromIndex < folded.length) {
      const idx = folded.indexOf(term, fromIndex);
      if (idx === -1) break;
      const origStart = foldedToOriginal[idx];
      const origEndIdx = idx + term.length - 1;
      const origEnd =
        origEndIdx < foldedToOriginal.length
          ? foldedToOriginal[origEndIdx] + 1
          : content.length;
      rawRanges.push({ start: origStart, end: origEnd });
      fromIndex = idx + term.length;
    }
  }

  if (rawRanges.length === 0) return [];

  rawRanges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: Array<{ start: number; end: number }> = [rawRanges[0]];
  for (let i = 1; i < rawRanges.length; i += 1) {
    const prev = merged[merged.length - 1];
    const curr = rawRanges[i];
    if (curr.start <= prev.end) {
      prev.end = Math.max(prev.end, curr.end);
    } else {
      merged.push({ ...curr });
    }
  }

  return merged;
}

export function extractHighlightedExcerpt(
  content: string,
  query: string,
  matchedTerms: string[],
  maxLength = 260,
): { excerpt: string; highlightParts: LocalRuleHighlightPart[] } {
  const cleanContent = content.trim();
  if (!cleanContent) {
    return { excerpt: '', highlightParts: [] };
  }

  const queryTokens = query
    .split(/[\s,.;:!?()[\]{}"'\/\\-]+/)
    .map((t) => normalizeRulesTerm(t))
    .filter((t) => t.length >= 2);
  const combinedTerms = Array.from(new Set([...matchedTerms, ...queryTokens]));
  const ranges = collectMatchRanges(cleanContent, combinedTerms);

  let windowStart = 0;
  let windowEnd = Math.min(cleanContent.length, maxLength);

  if (ranges.length > 0 && cleanContent.length > maxLength) {
    // Pick the anchor match that maximizes nearby matches inside the excerpt window
    let bestAnchor = ranges[0];
    let bestClusterCount = -1;
    for (const candidate of ranges) {
      const candStart = Math.max(0, candidate.start - Math.floor(maxLength * 0.3));
      const candEnd = candStart + maxLength;
      let count = 0;
      for (const r of ranges) {
        if (r.start >= candStart && r.end <= candEnd) count += 1;
      }
      if (count > bestClusterCount) {
        bestClusterCount = count;
        bestAnchor = candidate;
      }
    }

    const rawStart = Math.max(0, bestAnchor.start - Math.floor(maxLength * 0.3));
    const rawEnd = Math.min(cleanContent.length, rawStart + maxLength);
    windowStart = rawStart;
    windowEnd = rawEnd;

    if (windowStart > 0) {
      const nextSpace = cleanContent.indexOf(' ', windowStart);
      if (nextSpace !== -1 && nextSpace < bestAnchor.start && nextSpace - windowStart < 24) {
        windowStart = nextSpace + 1;
      }
    }
    if (windowEnd < cleanContent.length) {
      const prevSpace = cleanContent.lastIndexOf(' ', windowEnd);
      if (prevSpace > bestAnchor.end && windowEnd - prevSpace < 24) {
        windowEnd = prevSpace;
      }
    }
  }

  const prefix = windowStart > 0 ? '...' : '';
  const suffix = windowEnd < cleanContent.length ? '...' : '';
  const sliced = cleanContent.slice(windowStart, windowEnd).trim();
  const excerpt = `${prefix}${sliced}${suffix}`;

  const parts: LocalRuleHighlightPart[] = [];
  if (prefix) {
    parts.push({ text: prefix, matched: false });
  }

  const localRanges = collectMatchRanges(sliced, combinedTerms);
  if (localRanges.length === 0) {
    parts.push({ text: sliced, matched: false });
  } else {
    let cursor = 0;
    for (const range of localRanges) {
      if (range.start > cursor) {
        parts.push({ text: sliced.slice(cursor, range.start), matched: false });
      }
      parts.push({ text: sliced.slice(range.start, range.end), matched: true });
      cursor = range.end;
    }
    if (cursor < sliced.length) {
      parts.push({ text: sliced.slice(cursor), matched: false });
    }
  }

  if (suffix) {
    parts.push({ text: suffix, matched: false });
  }

  return { excerpt, highlightParts: parts };
}

export class PdfRulesStore {
  private backend: PdfRulesStorageBackend;
  private miniSearch: MiniSearch<PdfPageDocument>;
  private booksById: Map<string, BookMetadata>;
  private loaded = false;
  private initPromise: Promise<void> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(backend?: PdfRulesStorageBackend) {
    this.backend = backend ?? createIndexedDbStorageBackend();
    this.miniSearch = new MiniSearch<PdfPageDocument>(PDF_MINISEARCH_OPTIONS);
    this.booksById = new Map();
  }

  private enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(fn, fn);
    this.writeQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async ensureReady(): Promise<void> {
    if (this.loaded) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const [books, serialized] = await Promise.all([
        this.backend.loadBooks(),
        this.backend.loadSerializedIndex(),
      ]);

      this.booksById.clear();
      for (const book of books) {
        if (book && typeof book.bookId === 'string') {
          this.booksById.set(book.bookId, book);
        }
      }

      if (typeof serialized === 'string' && serialized.trim().length > 0) {
        this.miniSearch = MiniSearch.loadJSON<PdfPageDocument>(serialized, PDF_MINISEARCH_OPTIONS);
      } else if (serialized && typeof serialized === 'object') {
        this.miniSearch = MiniSearch.loadJS<PdfPageDocument>(serialized, PDF_MINISEARCH_OPTIONS);
      } else {
        this.miniSearch = new MiniSearch<PdfPageDocument>(PDF_MINISEARCH_OPTIONS);
      }

      this.loaded = true;
    })();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  async indexBook(input: IndexPdfBookInput): Promise<BookMetadata> {
    return this.enqueueWrite(async () => {
      await this.ensureReady();

      const cleanTitle = input.bookTitle.trim() || 'Regra Local (PDF)';
      const cleanSystemId = input.systemId.trim() || 'default';
      const bookId =
        input.bookId?.trim() ||
        `pdf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

      // If re-indexing an existing bookId, discard old pages first
      const previous = this.booksById.get(bookId);
      if (previous) {
        this.discardBookDocs(previous);
      }

      const docs: PdfPageDocument[] = [];
      let charCount = 0;
      let maxPageNum = input.totalPages ?? input.pages.length;

      for (const rawPage of input.pages) {
        const pageNum = Math.max(1, Math.floor(rawPage.page));
        if (pageNum > maxPageNum) maxPageNum = pageNum;
        const cleanContent = sanitizeExtractedPdfText(rawPage.content);
        if (!cleanContent) continue;
        charCount += cleanContent.length;
        docs.push({
          id: buildPageDocId(bookId, pageNum),
          bookId,
          bookTitle: cleanTitle,
          systemId: cleanSystemId,
          page: pageNum,
          content: cleanContent,
        });
      }

      if (docs.length > 0) {
        this.miniSearch.addAll(docs);
      }

      const metadata: BookMetadata = {
        bookId,
        bookTitle: cleanTitle,
        systemId: cleanSystemId,
        pageCount: maxPageNum,
        indexedPageCount: docs.length,
        charCount,
        indexedAt: new Date().toISOString(),
      };

      this.booksById.set(bookId, metadata);
      await this.backend.saveBook(metadata);
      await this.backend.saveSerializedIndex(JSON.stringify(this.miniSearch.toJSON()));

      return { ...metadata };
    });
  }

  private discardBookDocs(book: BookMetadata): void {
    const idsToDiscard: string[] = [];
    const upperBound = Math.max(book.pageCount, book.indexedPageCount);
    for (let page = 1; page <= upperBound; page += 1) {
      const id = buildPageDocId(book.bookId, page);
      if (this.miniSearch.has(id)) {
        idsToDiscard.push(id);
      }
    }
    if (idsToDiscard.length > 0) {
      this.miniSearch.discardAll(idsToDiscard);
    }
  }

  async listBooks(systemId?: string): Promise<BookMetadata[]> {
    await this.ensureReady();
    const filterSys = systemId?.trim();
    const list = Array.from(this.booksById.values())
      .filter((book) => !filterSys || filterSys === 'all' || book.systemId === filterSys)
      .map((book) => ({ ...book }));
    list.sort((a, b) => b.indexedAt.localeCompare(a.indexedAt));
    return list;
  }

  async removeBook(bookId: string): Promise<boolean> {
    return this.enqueueWrite(async () => {
      await this.ensureReady();
      const target = this.booksById.get(bookId);
      if (!target) return false;

      this.discardBookDocs(target);
      await this.miniSearch.vacuum();

      this.booksById.delete(bookId);
      await this.backend.deleteBook(bookId);
      await this.backend.saveSerializedIndex(JSON.stringify(this.miniSearch.toJSON()));
      return true;
    });
  }

  async clearAll(): Promise<void> {
    return this.enqueueWrite(async () => {
      await this.ensureReady();
      this.miniSearch.removeAll();
      this.booksById.clear();
      await this.backend.clearAll();
    });
  }

  searchLocalRulesSync(query: string, systemId?: string, limit = 5): LocalRuleSearchHit[] {
    const trimmed = query.trim();
    if (trimmed.length < 2 || this.miniSearch.documentCount === 0) {
      return [];
    }

    const filterSys = systemId?.trim();
    const safeLimit = Math.max(1, Math.min(20, Math.floor(limit)));

    const rawResults = this.miniSearch.search(trimmed, {
      prefix: true,
      fuzzy: 0.2,
      boost: { content: 2, bookTitle: 0.5 },
      combineWith: 'OR',
      filter:
        filterSys && filterSys !== 'all'
          ? (result) => result.systemId === filterSys
          : undefined,
    });

    return rawResults.slice(0, safeLimit).map((res) => {
      const content = typeof res.content === 'string' ? res.content : '';
      const matchedTerms = Array.isArray(res.terms) ? res.terms : [];
      const { excerpt, highlightParts } = extractHighlightedExcerpt(
        content,
        trimmed,
        matchedTerms,
      );

      return {
        id: String(res.id),
        bookId: String(res.bookId ?? ''),
        bookTitle: String(res.bookTitle ?? ''),
        systemId: String(res.systemId ?? ''),
        page: Number(res.page ?? 1),
        score: res.score,
        terms: matchedTerms,
        excerpt,
        highlightParts,
      };
    });
  }

  async searchLocalRules(
    query: string,
    systemId?: string,
    limit = 5,
  ): Promise<LocalRuleSearchHit[]> {
    await this.ensureReady();
    return this.searchLocalRulesSync(query, systemId, limit);
  }

  getIndexedDocumentCount(): number {
    return this.miniSearch.documentCount;
  }
}

export const pdfRulesStore = new PdfRulesStore();

export async function ensurePdfRulesStoreReady(): Promise<void> {
  return pdfRulesStore.ensureReady();
}

export async function indexPdfBook(input: IndexPdfBookInput): Promise<BookMetadata> {
  return pdfRulesStore.indexBook(input);
}

export async function listIndexedBooks(systemId?: string): Promise<BookMetadata[]> {
  return pdfRulesStore.listBooks(systemId);
}

export async function removeIndexedBook(bookId: string): Promise<boolean> {
  return pdfRulesStore.removeBook(bookId);
}

export async function searchLocalRules(
  query: string,
  systemId?: string,
  limit = 5,
): Promise<LocalRuleSearchHit[]> {
  return pdfRulesStore.searchLocalRules(query, systemId, limit);
}
