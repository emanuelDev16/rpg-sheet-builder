#!/usr/bin/env node
// Auditoria determinística de governança/segurança do GridSheet (Web-only).
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const WARN_SIZE = args.has('--warn-size');
const ALLOW_ANDROID = args.has('--allow-android');
const results = [];

const lines = (f) => {
  const t = readFileSync(f, 'utf8');
  if (!t) return 0;
  const n = t.split(/\r?\n/).length;
  return t.endsWith('\n') ? n - 1 : n;
};
const report = (ok, name, detail = '', warn = false) => {
  const tag = ok ? '[PASS]' : warn ? '[WARN]' : '[FAIL]';
  console.log(`${tag} ${name}${detail ? ` — ${detail}` : ''}`);
  results.push(ok || warn);
};
const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

// 1. Tamanho de governança
const gem = lines('GEMINI.md');
report(gem <= 75, 'GEMINI.md <= 75 linhas', `${gem}`);
for (const f of walk('.agent/rules').filter((p) => p.endsWith('.md'))) {
  const n = lines(f);
  report(n <= 40, `${f} <= 40 linhas`, `${n}`);
}

// 2. Tamanho dos componentes dnd5e
const dndDir = 'src/components/dnd5e';
const dnd = existsSync(dndDir) ? readdirSync(dndDir).filter((f) => f.endsWith('.tsx')) : [];
if (!dnd.length) report(true, `${dndDir}/*.tsx`, 'nenhum arquivo');
for (const f of dnd) {
  const n = lines(join(dndDir, f));
  report(n <= 200, `${dndDir}/${f} <= 200 linhas`, `${n}`, WARN_SIZE);
}

// 3. Segredos/SDKs proibidos
const FORBIDDEN = ['@google/genai', 'GEMINI_API_KEY', 'googleSearch', 'SYNC_TOKEN'];
const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx', '.json', '.html', '.css', '.map', '.txt', '.md']);
const targets = [...walk('src'), ...(existsSync('vite.config.ts') ? ['vite.config.ts'] : []), ...walk('dist')]
  .filter((p) => TEXT_EXT.has(extname(p)) && statSync(p).size < 20e6);
const hits = [];
for (const f of targets) {
  const t = readFileSync(f, 'utf8');
  for (const k of FORBIDDEN) if (t.includes(k)) hits.push(`${f}: ${k}`);
}
report(!hits.length, 'Sem tokens proibidos em src/, vite.config.ts, dist/', hits.length ? `\n  ${hits.join('\n  ')}` : `${targets.length} arquivos`);

// 4. android/ intocado
let changed = [];
try {
  const st = execSync('git status --porcelain -- android', { encoding: 'utf8' });
  const df = execSync('git diff --name-only HEAD -- android', { encoding: 'utf8' });
  changed = [...new Set([...st.split('\n'), ...df.split('\n')].map((s) => s.trim()).filter(Boolean))];
  report(!changed.length || ALLOW_ANDROID, 'android/ sem alterações', changed.length ? `${changed.length} mudança(s)${ALLOW_ANDROID ? ' (--allow-android)' : ''}` : '');
} catch (e) {
  report(false, 'android/ sem alterações', `git indisponível: ${e.message}`);
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} checagem(ns) falharam.` : '\nAuditoria OK.');
process.exit(failed ? 1 : 0);
