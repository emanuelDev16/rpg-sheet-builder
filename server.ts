import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import {
  buildRulesSearchPrompt,
  extractGroundedSources,
  formatRulesSearchError,
  validateRulesQuery,
} from './src/core/rulesSearch.ts';
import {
  createWorkspaceMirrorPayload,
  validateWorkspaceMirrorInput,
  type WorkspaceMirrorPayload,
} from './src/core/roomSync.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const ROOM_MIRROR_DIR = path.resolve(__dirname, '.data');
const ROOM_MIRROR_FILE = path.join(ROOM_MIRROR_DIR, 'room-sync-mirror.json');

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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  let currentRoomMirror: WorkspaceMirrorPayload | null = loadPersistedMirror();

  app.get('/api/workspace-sync', (_req, res) => {
    res.json({
      ok: true,
      mirror: currentRoomMirror,
    });
  });

  const handleUpsertWorkspaceMirror = (req: express.Request, res: express.Response) => {
    const validated = validateWorkspaceMirrorInput(req.body);
    if (!validated.ok) {
      res.status(400).json({ ok: false, error: validated.error });
      return;
    }

    if (
      currentRoomMirror &&
      validated.updatedAtMillis < currentRoomMirror.updatedAtMillis
    ) {
      res.json({
        ok: true,
        staleIgnored: true,
        mirror: currentRoomMirror,
      });
      return;
    }

    const nextMirror = createWorkspaceMirrorPayload(
      validated.workspace,
      validated.updatedAtMillis,
      validated.source,
    );
    currentRoomMirror = nextMirror;
    savePersistedMirror(nextMirror);

    res.json({
      ok: true,
      staleIgnored: false,
      mirror: nextMirror,
    });
  };

  app.put('/api/workspace-sync', handleUpsertWorkspaceMirror);
  app.post('/api/workspace-sync', handleUpsertWorkspaceMirror);

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GRID//SHEET server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
