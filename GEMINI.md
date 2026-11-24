# Diretrizes do Projeto GridSheet (Web)

## 1. Stack & Escopo Ativo
- Escopo ativo exclusivamente **Web**: React 19, TypeScript, Vite, Tailwind CSS v4, IndexedDB e Express (`server.ts`).
- O módulo `android/` está **pausado**: não modifique arquivos Kotlin nem execute tarefas do Gradle salvo solicitação explícita.

## 2. Governança Git
- Antes de editar qualquer arquivo, verifique `git status -sb` e `git branch -vv`.
- Nunca edite diretamente na `main` ou na branch base `feat/web-wod-app`; crie e mude para uma branch descritiva (`feat/<escopo>`, `fix/<escopo>` ou `chore/<escopo>`).
- Dispense criação de branch apenas em auditorias estritamente somente-leitura.

## 3. Validação Web Obrigatória
Nenhuma tarefa de código Web é concluída sem Exit Code `0` e zero testes pulados (`skipped`) nos comandos:
1. `npm run lint` (`tsc --noEmit`)
2. `npm run test:all` (executa `test:vitest` e todas as suítes `node:test`)
3. `npx vite build --base=/rpg-sheet-builder/`

Ao finalizar, reporte contagem de testes aprovados (`vitest` e `node:test`), `git branch --show-current`, `git status -sb` e `git diff --stat`.

## 4. Mapa de Diretórios
- `shared/presets/`: presets oficiais (`presets.v2.json`), contrato estrito (`schema.v2.json`) e fixtures (`fixtures/`).
- `src/core/`: motor de fórmulas, modelo de ficha, IndexedDB, XP, catálogos WoD, exportação HTML, impressão e `i18n.ts`.
- `src/utils/`: layout masonry (`bentoLayout.ts`), `dotRating.ts`, tema, foco e helpers de criação/rolagem WoD.
- `src/components/`: UI modular React (workspace, cards Bento, wizard WoD, rolador combinado, XP, blocos estruturados).
- `src/workers/`: `pdfIndexer.worker.ts` (extração PDF e OCR off-thread).
- `server.ts`: servidor Express para sync local autenticado (bind padrão `127.0.0.1`).
- `android/`: app nativo pausado (build CI opt-in em `.github/workflows/deploy-demo.yml`).

## 5. Invariantes Obrigatórias
- **Contrato JSON:** mantenha `additionalProperties: false` em todos os objetos de `shared/presets/schema.v2.json`.
- **Motor de Fórmulas:** proibido `eval` ou `new Function` em `src/core/formula.ts`; preserve limites de recursão, ciclos e dados.
- **Exportação HTML:** preserve `escapeHtml`, sanitização de dados embutidos e CSP restritiva em `src/core/pureHtmlExporter.ts`.
- **Temas & E-Ink:** use apenas tokens CSS semânticos em `src/index.css` para `light`, `dark` e `eink`; garanta zero sombras, gradientes ou animações em `[data-theme="eink"]`.
- **Internacionalização:** mantenha paridade estrita de chaves entre `pt-BR`, `en` e `es` em `src/core/i18n.ts` (validada por `src/i18n.test.ts`).
