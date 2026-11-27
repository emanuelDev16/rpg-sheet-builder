---
name: gridsheet-qa-runner
description: Executa a bateria de QA e validação no fechamento de branches com modelo Flash.
---

# QA Runner e Fechamento de Branch

## Gatilhos
- Fechamento e validação final de branches (usar modelo Flash).

## Execução
Execute a sequência canônica em comando único:
```bash
npm run verify
```
(Equivalente ao PR CI gate: `npm run audit:local && npm run lint && npm run test:all && vite build --base=/rpg-sheet-builder/`.)

## Planos de Teste & Fuzzing
- **Vitest `unit` (Node):** testes de core, i18n e fuzzers `fast-check` (`src/core/*Fuzz.test.ts`).
- **Vitest `ui` (JSDOM):** testes interativos `*.ui.test.tsx` (`@testing-library/react`, `src/test/setupJsdom.ts`).
- **`node:test`:** suítes registradas em `NODE_TEST_FILES` (`vitest.config.ts`), via `npm run test:node`.
- **Reprodutibilidade de Fuzz:** use `getFuzzOptions` (`src/core/fuzzConfig.ts`) e reproduza contraexemplos com `FUZZ_SEED=<seed> npm run test:fuzz`. Em helpers que usam `String.prototype.replace` sobre dados gerados, passe callback `() => valor` para evitar expansão de `$&`/`$'`/`$$`.

## Formato de Saída (Máximo 10 linhas)
Reporte apenas os dados objetivos:
- Status do `audit:local` (incluindo alertas `[WARN]`, se houver).
- Contagem exata de testes aprovados (`vitest` e `node:test`) e testes pulados (0 obrigatório).
- Falhas detalhadas (se houver).
- Resumo conciso de `git diff --stat`.
