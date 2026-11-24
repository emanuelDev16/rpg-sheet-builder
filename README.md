# GridSheet

Construtor e gerenciador agnóstico de fichas para RPG de mesa (*TTRPG*) com aplicação Web offline-first (React 19, TypeScript, Vite, Tailwind CSS v4 e IndexedDB) e suporte completo a **World of Darkness (Vampiro: A Máscara V5 e V20)**, além de presets para D&D 5e, Cyberpunk e fichas customizadas.

* **Demo Web:** [emanueldev16.github.io/rpg-sheet-builder](https://emanueldev16.github.io/rpg-sheet-builder/)

> **Status do módulo Android (`android/`):** desenvolvimento temporariamente pausado. A compilação de APK no GitHub Actions (`.github/workflows/deploy-demo.yml`) está configurada como *opt-in* manual via `workflow_dispatch` (`build_android: true`).

---

## Principais Recursos

### 1. World of Darkness (Vampiro V5 e V20)
* **Grade 3×3 e Catálogos Oficiais:** Atributos organizados em Físicos, Sociais e Mentais em `shared/presets/presets.v2.json`, com catálogos completos de Clãs, Disciplinas, Poderes (`wodClansDisciplinesCatalog.ts`), Perícias (`wodSkillsCatalog.ts`), Antecedentes, Qualidades/Defeitos e Refúgios (`wodAdvantagesCatalog.ts`).
* **DotRating & Rolador Combinado:** Controle acessível `DotRating` (`0–5` / `0–10`) em `DotRating.tsx`, acionamento direto de poderes (`Rouse Check` no V5 e `Gasto de Sangue` no V20) e rolador livre combinado (`WodPoolComposer.tsx`) com suporte a Dados de Fome (V5), Dificuldade, Especialização, Willpower e histórico em `RollLogSidebar.tsx`.
* **Mecânicas de Mesa V5 e V20:** Manchas & Remorso V5, trilha completa de Força de Vontade V5 (`Superficial` / `Agravado` / `Impaired`), Tabela de Potência de Sangue V5 acoplada a Surto de Sangue/rerrolagem de Rouse/bônus de poder/Severidade da Perdição e testes de Frenesi / Rötschreck.
* **Blocos Estruturados (`WodStructuredBlocks.tsx`):** Pedras de Toque & Convicções, Qualidades/Defeitos e Refúgios com traços configuráveis.
* **Assistente de Criação (`WodCreationWizard.tsx`):** Criação guiada em 4 passos para V5 e V20 (conceito/identidade, atributos, perícias/especializações, clã/predador/disciplinas e dossiê inicial).
* **Gerenciador de XP (`XpUpgradeWorkspace.tsx` + `xpSystem.ts`):** Regras Storyteller V20, Vampiro V5 e Customizado, afinidade de clã, aquisição direta `0 -> 1` de perícias/disciplinas/vantagens, compra de especializações e `Undo` atômico com histórico no ledger.

### 2. Offline-First, Busca em PDFs, Exportação e UX
* **Persistência & Contrato (`sheetsStore.ts` + `shared/presets/`):** Armazenamento local em IndexedDB com snapshots automáticos antes de sobrescritas e envelope versionado (`schemaVersion: 2`) validado por `shared/presets/schema.v2.json`.
* **Busca Offline em PDFs/OCR (`pdfIndexer.worker.ts`):** Indexação local de livros PDF em Web Worker com `pdfjs-dist`, OCR via `tesseract.js` e busca textual via `MiniSearch` sem envio de arquivos a servidores externos.
* **Exportação HTML Standalone & Impressão (`pureHtmlExporter.ts`):** Gera arquivo HTML autônomo com blindagem XSS (`escapeHtml`, sanitização de URLs e JSON embutido) e CSP restritiva, além de layout dedicado para `@media print` (`PrintSheetHeader.tsx`).
* **Temas & Internacionalização:** Tri-tema (`Light`, `Dark`, `E-Ink` monocromático sem sombras/animações) controlado por `data-theme` em `src/index.css` e interface completa em `pt-BR`, `en` e `es` (`src/core/i18n.ts`).
* **Sync Local Opcional (`server.ts`):** Servidor Express para sincronização LAN autenticada por Bearer token (`SYNC_TOKEN`), restrito a `127.0.0.1` por padrão (`ALLOW_LAN_SYNC=false`).

---

## Comandos Oficiais (Web)

```bash
npm ci                                  # Instala dependências exatas do lockfile
npm run dev                             # Sobe servidor Express + Vite HMR em desenvolvimento
npm run lint                            # Verifica tipagem TypeScript (tsc --noEmit)
npm run test:all                        # Executa todas as suítes Vitest e node:test
npx vite build --base=/rpg-sheet-builder/ # Gera build de produção estático em dist/
```

---

## Estrutura do Repositório

```text
rpg-sheet-builder/
├── .github/workflows/deploy-demo.yml   # CI/CD: build/deploy Web (Pages) + build Android opt-in
├── shared/presets/                     # presets.v2.json, schema.v2.json e fixtures compartilhadas
├── src/
│   ├── components/                     # HomeView, BentoCard, DotRating, WodPoolComposer, WodCreationWizard, XpUpgradeWorkspace, etc.
│   ├── core/                           # formula, sheetModel, sheetsStore, xpSystem, pureHtmlExporter, printSheet, i18n, catálogos WoD
│   ├── utils/                          # bentoLayout, dotRating, theme, useFocusTrap, wodCreationWizard, wodPoolComposer
│   ├── workers/                        # pdfIndexer.worker.ts (extração e OCR off-thread)
│   ├── App.tsx                         # Orquestração da aplicação Web
│   └── index.css                       # Tokens semânticos (Light, Dark, E-Ink) e regras @media print
├── server.ts                           # Servidor Express para sync local autenticado
└── android/                            # Módulo Android nativo (pausado)
```
