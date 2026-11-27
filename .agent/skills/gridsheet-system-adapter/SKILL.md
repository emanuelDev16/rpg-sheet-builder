---
name: gridsheet-system-adapter
description: Adapta e adiciona sistemas de RPG não-WoD (D&D 5e SRD, Cyberpunk NET//RUNNER, Genérico) ao GridSheet.
---

# Adaptador de Novos Sistemas de RPG

## Gatilhos
- Criação ou evolução de presets e regras para D&D 5e SRD, Cyberpunk `NET//RUNNER` ou Genérico.

## Regras Obrigatórias
1. **Isolamento Modular**: Isole toda a lógica específica do novo sistema em `src/core/<sys>*` sem poluir módulos genéricos.
2. **Registro no SystemRegistry**: Implemente `SystemAdapter` em `src/core/systems/` (`matches` restrito a IDs/presets explícitos, sem fallback frouxo; `progressionKind`; `capabilities`; `migrateSheet` compondo `migrateLegacySheetMetadata` antes do normalizer do sistema).
3. **Preservação de Sub-Estados**: Garanta que `createDefault<Sys>State` e `normalize<Sys>State` preservem campos opcionais (ex.: `progression`) para evitar resets silenciosos na UI.
4. **UI, Lazy Loading & i18n**: Divida traduções exclusivas em `src/core/i18n/<sys>.ts`, carregue painéis/workspaces com `React.lazy` + `Suspense` estático (sem animação para `[data-theme="eink"]`) e respeite o limite modular (`<= 200` linhas; `dnd5e` WARN `201–220` / FAIL `> 220`).
5. **Preservação de WoD & Schema v2**: Preserve intactos catálogos/regras WoD V5/V20, mantenha `additionalProperties: false` em `shared/presets/schema.v2.json` e registre qualquer delta de schema em `docs/android-sync-backlog.md` (sem alterar `android/`).
6. **Registro de Testes**: Cadastre novas suítes `node:test` em `NODE_TEST_FILES` (`vitest.config.ts`); crie testes interativos de árvore React em `*.ui.test.tsx` (projeto Vitest `ui`/JSDOM) cobrindo limites como nível máximo.
7. **Validação**: Execute `npm run verify` (`audit:local` + `lint` + `test:all` + build).
