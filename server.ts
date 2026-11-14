import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { GoogleGenAI } from '@google/genai';
import {
  buildRulesSearchPrompt,
  extractGroundedSources,
  formatRulesSearchError,
  validateRulesQuery,
} from './src/core/rulesSearch.ts';
import {
  createWorkspaceMirrorPayload,
  formatETagHeader,
  isIfNoneMatchWildcard,
  OptimisticSheetStore,
  parseIfMatchRevision,
  validateCanonicalSheetPayload,
  validateWorkspaceMirrorInput,
  type WorkspaceMirrorPayload,
} from './src/core/roomSync.ts';
import {
  type CanonicalSheet,
  fromCanonicalSheet,
  toCanonicalSheet,
} from './src/core/sheetModel.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const BIND_HOST = process.env.ALLOW_LAN_SYNC === 'true' ? '0.0.0.0' : '127.0.0.1';
const ROOM_MIRROR_DIR = path.resolve(__dirname, '.data');
const ROOM_MIRROR_FILE = path.join(ROOM_MIRROR_DIR, 'room-sync-mirror.json');
const SHEETS_STORE_FILE = path.join(ROOM_MIRROR_DIR, 'sheets-store.json');
const SHEET_SCHEMA_PATH = path.resolve(__dirname, 'shared-specs/sheet.schema.json');

const ENV_SYNC_TOKEN = process.env.SYNC_TOKEN?.trim();
export const SYNC_TOKEN: string =
  ENV_SYNC_TOKEN && ENV_SYNC_TOKEN.length > 0
    ? ENV_SYNC_TOKEN
    : (() => {
        const generated = crypto.randomBytes(16).toString('hex');
        console.log(`[SYNC AUTH] SYNC_TOKEN ausente no ambiente. Token efêmero gerado: ${generated}`);
        return generated;
      })();

const DEFAULT_DEV_ORIGINS = [
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export function resolveAllowedCorsOrigins(rawCorsOrigin = process.env.CORS_ORIGIN): string[] {
  if (typeof rawCorsOrigin === 'string' && rawCorsOrigin.trim().length > 0) {
    return rawCorsOrigin
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0 && origin !== '*');
  }
  return DEFAULT_DEV_ORIGINS;
}

export function cors(options?: { origins?: string[] }): express.RequestHandler {
  const allowedOrigins = new Set(options?.origins ?? resolveAllowedCorsOrigins());
  return (req, res, next) => {
    const requestOrigin = req.header('origin');
    if (requestOrigin && allowedOrigins.has(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, If-Match, If-None-Match',
      );
      res.setHeader('Access-Control-Expose-Headers', 'ETag');
    }
    if (req.method.toUpperCase() === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}

export function verifySyncBearerToken(
  authHeader: string | undefined,
  expectedToken: string = SYNC_TOKEN,
): boolean {
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const providedToken = authHeader.slice('Bearer '.length).trim();
  if (!providedToken || !expectedToken) {
    return false;
  }
  const providedBuffer = Buffer.from(providedToken, 'utf8');
  const expectedBuffer = Buffer.from(expectedToken, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

export function requireSyncAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const authHeader = req.header('authorization') ?? undefined;
  if (!verifySyncBearerToken(authHeader)) {
    res.status(401).json({
      ok: false,
      error: 'UNAUTHORIZED',
      message: 'Cabeçalho Authorization: Bearer <token> inválido ou ausente.',
    });
    return;
  }
  next();
}

export function createAjvSheetValidator() {
  const rawSchema = JSON.parse(fs.readFileSync(SHEET_SCHEMA_PATH, 'utf8')) as Record<string, unknown>;
  const AjvCtor = (Ajv2020 as unknown as { default?: typeof Ajv2020 }).default ?? Ajv2020;
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  const applyFormats = (addFormats as unknown as { default?: typeof addFormats }).default ?? addFormats;
  applyFormats(ajv);
  return ajv.compile(rawSchema);
}

const ajvValidateSheet = createAjvSheetValidator();

function loadPersistedSheets(): CanonicalSheet[] {
  try {
    if (!fs.existsSync(SHEETS_STORE_FILE)) return [];
    const raw = fs.readFileSync(SHEETS_STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CanonicalSheet => {
      const check = validateCanonicalSheetPayload(item, ajvValidateSheet);
      return check.ok;
    });
  } catch {
    return [];
  }
}

function savePersistedSheets(sheets: CanonicalSheet[]): void {
  try {
    fs.mkdirSync(ROOM_MIRROR_DIR, { recursive: true });
    const tmpFile = `${SHEETS_STORE_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(sheets, null, 2), 'utf8');
    fs.renameSync(tmpFile, SHEETS_STORE_FILE);
  } catch {
    // Non-fatal fallback to in-memory store
  }
}

function loadPersistedMirror(): WorkspaceMirrorPayload | null {
  try {
    if (!fs.existsSync(ROOM_MIRROR_FILE)) return null;
    const raw = fs.readFileSync(ROOM_MIRROR_FILE, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const validated = validateWorkspaceMirrorInput(parsed);
    if (!validated.ok) return null;
    return createWorkspaceMirrorPayload(
      validated.workspace,
      validated.updatedAtMillis,
      validated.source,
    );
  } catch {
    return null;
  }
}

function savePersistedMirror(mirror: WorkspaceMirrorPayload): void {
  try {
    fs.mkdirSync(ROOM_MIRROR_DIR, { recursive: true });
    const tmpFile = `${ROOM_MIRROR_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(mirror), 'utf8');
    fs.renameSync(tmpFile, ROOM_MIRROR_FILE);
  } catch {
    // Non-fatal fallback to in-memory mirror
  }
}

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function createSyncApp(initialSheets?: CanonicalSheet[]) {
  const app = express();
  app.use(cors({ origins: resolveAllowedCorsOrigins() }));
  app.use(express.json({ limit: '1mb' }));

  let currentRoomMirror: WorkspaceMirrorPayload | null = loadPersistedMirror();
  const seededSheets =
    initialSheets ??
    (loadPersistedSheets().length > 0
      ? loadPersistedSheets()
      : currentRoomMirror?.sheet
        ? [currentRoomMirror.sheet]
        : []);
  const sheetStore = new OptimisticSheetStore(seededSheets, ajvValidateSheet);

  const handleSheetSyncHttp = (req: express.Request, res: express.Response) => {
    const method = (req.method.toUpperCase() as 'GET' | 'POST' | 'PUT');
    const sheetIdParam = typeof req.params?.id === 'string' ? req.params.id : undefined;

    if (method === 'GET') {
      const outcome = sheetStore.handleRequest({
        method: 'GET',
        headers: req.headers,
        body: req.body,
        sheetIdParam,
      });
      for (const [hk, hv] of Object.entries(outcome.headers)) {
        res.setHeader(hk, hv);
      }
      res.status(outcome.status).json({
        ...outcome.body,
        mirror: currentRoomMirror,
      });
      return;
    }

    // Extract sheet payload for Ajv validation against @shared-specs/sheet.schema.json
    const rawBody = req.body as Record<string, unknown> | null | undefined;
    const isWorkspaceEnvelope =
      Boolean(
        rawBody &&
          typeof rawBody === 'object' &&
          !Array.isArray(rawBody) &&
          'workspace' in rawBody,
      );

    const candidateSheet =
      rawBody &&
      typeof rawBody === 'object' &&
      !Array.isArray(rawBody) &&
      'sheet' in rawBody &&
      rawBody.sheet !== undefined
        ? rawBody.sheet
        : rawBody;

    // 1. Validate payload against @shared-specs/sheet.schema.json using ajv + ajv-formats
    const schemaValidation = validateCanonicalSheetPayload(candidateSheet, ajvValidateSheet);
    if (!schemaValidation.ok) {
      res.status(400).json({
        ok: false,
        error: 'SCHEMA_VALIDATION_FAILED',
        details: schemaValidation.details,
      });
      return;
    }

    // 2. Enforce If-Match: "<revision>" on PUT updates (If-None-Match: * on creation) -> 412 Precondition Failed
    const ifMatchHeader = req.header('if-match');
    const ifNoneMatchHeader = req.header('if-none-match');
    const isCreate = method === 'POST' || isIfNoneMatchWildcard(ifNoneMatchHeader);
    const expectedRevision = parseIfMatchRevision(ifMatchHeader);

    if (isCreate && !isIfNoneMatchWildcard(ifNoneMatchHeader)) {
      res.status(412).json({
        ok: false,
        error: 'PRECONDITION_REQUIRED',
        message: 'Cabeçalho If-None-Match: * é obrigatório na criação.',
      });
      return;
    }

    if (!isCreate && expectedRevision === null) {
      res.status(412).json({
        ok: false,
        error: 'PRECONDITION_REQUIRED',
        message: 'Cabeçalho If-Match: "<revision>" é obrigatório na atualização.',
      });
      return;
    }

    // 3. Compare revision and persist with revision + 1 (or reject with 409 Conflict)
    const outcome = sheetStore.handleRequest({
      method,
      headers: {
        'if-match': ifMatchHeader ?? undefined,
        'if-none-match': ifNoneMatchHeader ?? undefined,
      },
      body: schemaValidation.sheet,
      sheetIdParam,
    });

    for (const [hk, hv] of Object.entries(outcome.headers)) {
      res.setHeader(hk, hv);
    }

    if (outcome.status === 200 || outcome.status === 201) {
      const persistedSheet = outcome.body.sheet as CanonicalSheet;
      savePersistedSheets(sheetStore.getAllSheets());

      if (isWorkspaceEnvelope) {
        const wsValidation = validateWorkspaceMirrorInput(rawBody);
        if (wsValidation.ok) {
          const activeId = wsValidation.workspace.activeSystemId;
          const prevActive = wsValidation.workspace.sheetsBySystem[activeId];
          const syncedCharSheet = fromCanonicalSheet(persistedSheet, prevActive);
          const nextWorkspace = {
            ...wsValidation.workspace,
            sheetsBySystem: {
              ...wsValidation.workspace.sheetsBySystem,
              [activeId]: {
                ...syncedCharSheet,
                revision: persistedSheet.revision,
              },
            },
          };
          currentRoomMirror = createWorkspaceMirrorPayload(
            nextWorkspace,
            wsValidation.updatedAtMillis,
            wsValidation.source,
          );
          savePersistedMirror(currentRoomMirror);
        }
      } else {
        const syncedCharSheet = fromCanonicalSheet(persistedSheet);
        const sysId = syncedCharSheet.systemId ?? 'wod';
        currentRoomMirror = createWorkspaceMirrorPayload(
          {
            activeSystemId: sysId,
            sheetsBySystem: {
              ...(currentRoomMirror?.workspace.sheetsBySystem ?? {}),
              [sysId]: syncedCharSheet,
            },
          },
          Date.parse(persistedSheet.updatedAt) || Date.now(),
          'web',
        );
        savePersistedMirror(currentRoomMirror);
      }

      res.setHeader('ETag', formatETagHeader(persistedSheet.revision));
      res.status(outcome.status).json({
        ok: true,
        sheet: persistedSheet,
        staleIgnored: false,
        mirror: currentRoomMirror,
      });
      return;
    }

    res.status(outcome.status).json(outcome.body);
  };

  app.use('/api/sync', requireSyncAuth);
  app.get('/api/sync', handleSheetSyncHttp);
  app.get('/api/sync/:id', handleSheetSyncHttp);
  app.post('/api/sync', handleSheetSyncHttp);
  app.post('/api/sync/:id', handleSheetSyncHttp);
  app.put('/api/sync', handleSheetSyncHttp);
  app.put('/api/sync/:id', handleSheetSyncHttp);

  app.get('/api/workspace-sync', handleSheetSyncHttp);
  app.get('/api/workspace-sync/:id', handleSheetSyncHttp);
  app.post('/api/workspace-sync', handleSheetSyncHttp);
  app.put('/api/workspace-sync', handleSheetSyncHttp);
  app.put('/api/workspace-sync/:id', handleSheetSyncHttp);

  app.get('/api/sheets', handleSheetSyncHttp);
  app.get('/api/sheets/:id', handleSheetSyncHttp);
  app.post('/api/sheets', handleSheetSyncHttp);
  app.post('/api/sheets/:id', handleSheetSyncHttp);
  app.put('/api/sheets', handleSheetSyncHttp);
  app.put('/api/sheets/:id', handleSheetSyncHttp);

  app.post('/api/rules-search', async (req, res) => {
    const validation = validateRulesQuery(req.body?.query);
    if (!validation.ok) {
      res.status(400).json({
        ok: false,
        query: validation.query,
        answer: '',
        sources: [],
        searchQueries: [],
        error: validation.error,
      });
      return;
    }

    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        ok: false,
        query: validation.query,
        answer: '',
        sources: [],
        searchQueries: [],
        error:
          'Chave GEMINI_API_KEY não configurada no ambiente. Adicione a chave no painel Settings > Secrets.',
      });
      return;
    }

    const systemName = typeof req.body?.systemName === 'string' ? req.body.systemName : undefined;
    const prompt = buildRulesSearchPrompt(validation.query, systemName);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a concise tabletop RPG rules reference assistant inside a character sheet desktop app. Use Google Search to verify official rules, dice pools, target numbers, and modifiers. Keep answers structured, brief (max ~140 words), and easy to scan during a live game session. Do not use filler greetings.',
          tools: [{ googleSearch: {} }],
        },
      });

      const answer = (response.text ?? '').trim();
      const groundingMeta = response.candidates?.[0]?.groundingMetadata;
      const sources = extractGroundedSources(groundingMeta?.groundingChunks);
      const searchQueries = Array.isArray(groundingMeta?.webSearchQueries)
        ? groundingMeta.webSearchQueries
        : [];

      if (!answer) {
        res.status(502).json({
          ok: false,
          query: validation.query,
          answer: '',
          sources,
          searchQueries,
          error: 'A busca não retornou conteúdo para esta consulta.',
        });
        return;
      }

      res.json({
        ok: true,
        query: validation.query,
        answer,
        sources,
        searchQueries,
      });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Erro desconhecido ao consultar regras.';
      const formatted = formatRulesSearchError(rawMessage);

      res.status(formatted.status).json({
        ok: false,
        query: validation.query,
        answer: '',
        sources: [],
        searchQueries: [],
        error: formatted.message,
      });
    }
  });

  app.get('/api/download-apk', (_req, res) => {
    const apkPath = path.resolve(__dirname, 'android/app/build/outputs/apk/debug/app-debug.apk');
    if (!fs.existsSync(apkPath)) {
      res.status(404).json({ ok: false, error: 'APK ainda não compilado.' });
      return;
    }
    res.download(apkPath, 'grid-sheet-debug.apk');
  });

  return { app, sheetStore, toCanonicalSheet };
}

async function startServer() {
  const { app } = createSyncApp();

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const bindHost = process.env.ALLOW_LAN_SYNC === 'true' ? '0.0.0.0' : BIND_HOST;
  app.listen(PORT, bindHost, () => {
    console.log(`GRID//SHEET server running on http://${bindHost}:${PORT}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
