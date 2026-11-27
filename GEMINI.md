# Diretrizes do Projeto GridSheet (Web)

## Stack & Comandos
- **Escopo Ativo**: Exclusivamente Web: React 19, TypeScript, Vite, Tailwind CSS v4 e IndexedDB.
- **Persistência Local**: Armazenamento cliente-side via IndexedDB para fichas, templates e metadados.
- **Servidor de Sincronização**: Servidor Express em `server.ts` para sincronização LAN autenticada (opcional).
- **Módulo Android Pausado**: Diretório `android/` pausado; não altere código Kotlin nem execute tarefas Gradle.
- **Estilização Semântica**: Tailwind CSS v4 com variáveis CSS em `src/index.css` para suporte a temas.
- **Ambiente de Execução**: Node.js 20+ com npm para execução de testes e ferramentas de build.
- **Validação Canônica**: `npm run verify` (`audit:local` + `lint` + `test:all` + `vite build --base=/rpg-sheet-builder/`), em paridade com `.github/workflows/ci-pr.yml`.
- **Suíte de Testes**: `npm run test:all` (Vitest `unit` Node + `ui` JSDOM `*.ui.test.tsx` + `node:test`); `npm run test:fuzz` com `FUZZ_SEED` para reproduzir falhas `fast-check`.
- **Auditoria Local**: `npm run audit:local` (tetos de governança/componentes, zero conflitos Git, tokens proibidos e `android/` intocado).
- **Critério de Aceite**: Exit Code 0 obrigatório e zero testes pulados (`skipped`) na validação Web.

## Mapa de Arquivos
- `@shared/presets/schema.v2.json`: Contrato JSON Schema estrito para validação de fichas e campos de regras.
- `@shared/presets/presets.v2.json`: Presets oficiais de sistemas de RPG (WoD V5, V20, D&D 5e SRD, Cyberpunk, Genérico).
- `@shared/presets/fixtures/`: Fichas e payloads de referência para validação de presets e contratos.
- `src/core/formula.ts`: Motor determinístico de avaliação de expressões e fórmulas sem interpretadores dinâmicos.
- `src/core/pureHtmlExporter.ts`: Exportador HTML autônomo com sanitização estrita, `sanitizeUrl` e CSP embutida.
- `src/core/storage.ts`: Camada cliente-side IndexedDB para persistência de fichas e configurações locais.
- `src/core/i18n.ts` & `src/core/i18n/`: Dicionários `pt-BR`/`en`/`es` (raiz + módulos por sistema) e `presetI18n*.ts`.
- `src/core/systems/`: `SystemRegistry` e contratos `SystemAdapter` (`progressionKind`, `capabilities`, `migrateSheet`).
- `src/core/xpSystem.ts`: Motor de experiência WoD, catálogos de vantagens e histórico contábil.
- `src/utils/bentoLayout.ts`: Algoritmo de empacotamento masonry responsivo para cards Bento da ficha.
- `src/utils/dotRating.ts`: Renderização e manipulação acessível de caixas e círculos de atributos e habilidades.
- `src/utils/wodPoolComposer.ts`: Utilitários de composição e rolagem combinada de dados WoD.
- `src/components/`: Componentes modulares React (BentoCard, FieldPrimitives, SheetModal, RollComposer, Wizard).
- `src/components/BentoCard.tsx`: Card base modular com suporte a expansão, layout bento e densidade adaptativa.
- `src/components/FieldPrimitives.tsx`: Primitivas de campos, inputs numéricos, seletores e tags de ficha.
- `src/workers/pdfIndexer.worker.ts`: Worker off-thread para extração de texto e busca OCR em livros de regras.
- `src/index.css`: Tokens semânticos para `light`, `dark` e `eink` com regras de alto contraste para impressão.
- `src/App.tsx`: Shell principal da aplicação com roteamento de abas e gerenciador de estado.
- `scripts/audit-project.mjs`: Auditoria determinística de governança, limites de tamanho, conflitos e segredos.
- `docs/android-sync-backlog.md`: Registro obrigatório de deltas de `schema.v2.json` enquanto `android/` estiver pausado.
- `server.ts`: Servidor Express local para sincronização de fichas via rede local com autenticação Bearer.

## Invariantes Críticas
- **Contrato JSON**: Manter `additionalProperties: false` em todos os objetos de `@shared/presets/schema.v2.json`.
- **Motor de Fórmulas**: Proibido `eval` ou `new Function` em `src/core/formula.ts`; preservar limites de recursão e ciclo.
- **Exportação HTML**: Preservar `escapeHtml`, `sanitizeUrl` e CSP restritiva em `@src/core/pureHtmlExporter.ts`.
- **Segurança de Sincronização**: Exigir bind `127.0.0.1` e verificação de tokens via `crypto.timingSafeEqual` em `@server.ts`.
- **Temas & E-Ink**: Usar apenas tokens CSS semânticos em `light`/`dark`/`eink`; zero sombras, gradientes ou animações no `eink`.
- **Internacionalização**: Manter paridade estrita de chaves entre `pt-BR`, `en` e `es` validada por `src/i18n.test.ts`.
- **Modularidade de Arquivos**: Manter arquivos novos com no máximo 200 linhas e responsabilidades exclusivas.
- **Preservação de Regras**: Preservar intactos os catálogos, presets e mecânicas de WoD V5 e V20.
- **Sanitização de URLs**: Bloquear esquemas inseguros (`javascript:`, `data:` exceto imagens raster) em links e assets.
- **Proteção Contra Poluição**: Rejeitar recursivamente chaves `__proto__` e `constructor` em payloads de importação e sync.
- **Validação Sem Coerção Insegura**: Nunca usar `String(val)` em valores não confiáveis durante validação (evita `TypeError` em objetos hostis); exigir `typeof val === 'string'`.
- **Normalizers & Backlog Android**: Normalizers (`normalize*State`/`createDefault*State`) devem preservar sub-estados opcionais (ex.: `progression`); todo delta em `schema.v2.json` deve ser anotado em `docs/android-sync-backlog.md`.
- **Isolamento de Sistemas**: Isolar novas regras de RPG em `src/core/<sys>*` sem acoplamentos nos módulos genéricos.
- **Popovers & Camadas Z**: Popovers/dropdowns devem usar <AnchoredPopover> (createPortal em document.body) e tokens --z-* de src/index.css; nunca position: absolute dentro de containers com overflow.

## Governança & Skills
- **Diretrizes e Regras**: Ver `@.agent/rules/` (`token-efficiency.md`, `ui-accessibility.md`) para eficiência, validação e acessibilidade UI.
- **Micro-Skills**: Usar `gridsheet-i18n-auditor`, `gridsheet-print-designer`, `gridsheet-system-adapter` e `gridsheet-qa-runner` em `@.agent/skills/`.
