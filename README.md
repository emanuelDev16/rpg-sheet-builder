# GridSheet

Construtor e gerenciador agnóstico de fichas para RPG de mesa (*TTRPG*), projetado com estética *Light Cyber Brutalism* (com suporte a temas *Light*, *Dark* e *E-Ink*)[cite: 1, 2].

O projeto roda como uma aplicação web offline-first (React + TypeScript + IndexedDB) e conta com um cliente nativo para Android (Kotlin + Jetpack Compose + Room) que sincroniza o estado das fichas entre dispositivos via rede local[cite: 1, 3, 4].

---

## Demo e Download

* **Demo Web:** [emanueldev16.github.io/rpg-sheet-builder](https://emanueldev16.github.io/rpg-sheet-builder/)[cite: 4]
* **App Android (APK):** [Baixar última build na aba Releases](https://github.com/emanueldev16/rpg-sheet-builder/releases/tag/latest-demo)[cite: 4]

*(Nota: Na demo estática hospedada no GitHub Pages, o estado das fichas e dos livros indexados fica salvo localmente no navegador; para sincronizar entre dispositivos na rede local, execute o servidor Express incluído no repositório[cite: 3, 4]).*

---

## Principais Recursos

### 1. Workspace Hub (Tela Inicial Offline-First)
* **Retomada Rápida (`// SESSÃO_ATIVA`):** Destaca o último personagem editado com acesso em um clique (`CONTINUAR FICHA →`) e botão `// INÍCIO` na barra superior para alternar entre o hub e a ficha ativa sem recarregar a sessão[cite: 1].
* **Criação por Sistema (`// NOVO_PERSONAGEM`):** Instancia fichas zeradas a partir dos templates de `shared/presets/presets.v2.json` (`createFreshSheetForSystem`) ou cria fichas em branco para montagem livre[cite: 1, 9].
* **Gerenciador Local (`// MEUS_PERSONAGENS`):** Busca por nome, filtro por sistema, duplicação com novo UUID, exclusão e snapshots automáticos no IndexedDB antes de importações com sobrescrita[cite: 1, 13].

### 2. Gerenciador Completo de XP (V20 vs. V5)
* **Seletor de Regras por Ficha (`xpRulePreset`):** Alterna entre **Storyteller Clássico (V20)** (custo baseado no nível atual: Atributos `×4`, Habilidades `×2` / novo `3 XP`, Disciplinas de Clã `×5` / Fora de Clã `×7` / novo `10 XP`, Virtudes/Humanidade `×2`, Força de Vontade `×1`), **Vampiro: A Máscara (V5)** (custo baseado no novo nível alvo: Atributos `×5`, Perícias `×3`, Disciplinas `×5`/`×7`, com bloqueio automático de Willpower e Humanidade) e **Customizado**.
* **Compra Direta de Especializações e Vantagens:** Permite adquirir **Especializações (`3 XP` fixo)** vinculadas diretamente a uma perícia da ficha e criar/evoluir **Antecedentes e Vantagens** sem precisar montar campos manuais antes, com histórico de transações e estorno completo via **Undo**.

### 3. Motor de Rolagem d10 & Vitalidade
* **Resolução Storyteller:** Suporte a paradas de dados (*dice pools*) com **Dificuldade (Target Number)** ajustável (`2–10`, inicializada automaticamente em `DIFF 6` ao criar novos campos de habilidade), **Especialização** (resultados `10` contam como 2 sucessos), cancelamento por `1s` e detecção de **Falha Crítica (Botch)**[cite: 2, 9].
* **Vitalidade, Soak e Willpower:** Controle de dano (*Contundente*, *Letal* e *Agravado* no V20; *Superficial* e *Agravado* com *Hunger* no V5), penalidades automáticas de ferimento, testes de absorção (`ROLL SOAK`) e gasto automático de `WILLPOWER (+1 AUTO SUCCESS)` integrado ao contador da ficha[cite: 2, 4, 9].

### 4. Edição Modular & Presets Compartilhados (`shared/presets/`)
* **Single Source of Truth (`shared/presets/`):** Os templates de sistemas (`presets.v2.json`) e o contrato de validação (`schema.v2.json`) são compartilhados entre Web (importados pelo Vite) e Android (copiados para `assets/presets/` via `preBuild` no Gradle)[cite: 9].
* **Construção Intuitiva (`CustomCardBuilder`):** Presets rápidos de tipo de campo (Habilidade d10, Atributo, Disciplina, Recurso, Calculado, Texto), edição contextual em acordeão por campo e reordenação (`↑` / `↓`)[cite: 1, 8].
* **Internacionalização (`i18n.ts`):** Interface Web localizada em Português (`pt-BR`), Inglês (`en`) e Espanhol (`es`)[cite: 12].

### 5. Consulta Offline de PDFs & Portabilidade
* **Indexação Local de Livros:** Importa PDFs do próprio usuário para busca instantânea por página e trecho sem envio de arquivos a servidores — usando `pdfjs-dist` (Web Worker) + `MiniSearch` + `IndexedDB` na Web e `PdfBox-Android` + `SQLite FTS5` no Android, com detecção rápida de PDFs escaneados sem camada de texto[cite: 3].
* **Exportação & Sync LAN:** Exporta fichas individuais ou backups completos no envelope versionado (`schemaVersion: 2`), gera HTML standalone (`pureHtmlExporter.ts`) para impressão/uso offline e sincroniza o workspace entre Web e Android via servidor Express autenticado por token (`server.ts` / `WorkspaceSyncEngine`)[cite: 1, 4, 13].

---

## Stack

* **Web:** React, TypeScript, Vite, MiniSearch, `pdfjs-dist`, CSS customizado (`src/index.css`)[cite: 3, 4]
* **Backend / Sync:** Node.js, Express (`server.ts`)[cite: 4]
* **Android:** Kotlin, Jetpack Compose, Room (SQLite + FTS5), PdfBox-Android, Gradle Kotlin DSL[cite: 3, 4]
* **Testes:** Vitest (`src/core/*.test.ts`, `src/i18n.test.ts`) e JUnit (`CoreEngineTest.kt`)[cite: 4, 12]

---

## Estrutura

```text
rpg-sheet-builder/
├── .github/workflows/        # CI/CD (Deploy GitHub Pages + Build APK)
├── shared/
│   └── presets/              # Contrato compartilhado (presets.v2.json e schema.v2.json)
├── android/                  # App Android nativo (Kotlin + Compose + Room)
│   └── app/src/main/java/com/gridsheet/app/
│       ├── core/             # FormulaEngine, Presets, SheetModels, XpSystem
│       ├── data/             # RoomSyncBridge, WorkspaceRepository, WorkspaceSyncEngine, PdfRulesIndexer
│       └── ui/               # GridSheetApp, HomeScreen, XpUpgradeScreen, SheetViewModel e tema
├── src/
│   ├── components/           # HomeView, TopBar, TabNav, BentoCard, FieldPrimitives, XpUpgradeWorkspace, etc.
│   ├── core/                 # Fórmulas, modelo da ficha, XP, IndexedDB store, busca PDF, áudio e exportadores
│   ├── workers/              # pdfIndexer.worker.ts (extração off-thread de PDFs)
│   ├── i18n.ts               # Dicionários tipados (pt-BR, en, es)
│   ├── App.tsx               # Orquestração principal da interface Web
│   └── index.css             # Tokens visuais e media queries responsivas
└── server.ts                 # Servidor Express para API e sincronização LAN
