# GridSheet

Construtor e gerenciador agnóstico de fichas para RPG de mesa (*TTRPG*), projetado com estética *Light Cyber Brutalism*[cite: 1, 2].

O projeto roda como uma aplicação web (React + TypeScript + Express) e conta com um cliente nativo para Android (Kotlin + Jetpack Compose + Room) que sincroniza o estado das fichas entre dispositivos[cite: 1, 2].

---

## Demo e Download

* **Demo Web:** [emanueldev16.github.io/rpg-sheet-builder](https://emanueldev16.github.io/rpg-sheet-builder/)[cite: 1]
* **App Android (APK):** [Baixar última build na aba Releases](https://github.com/emanueldev16/rpg-sheet-builder/releases/tag/latest-demo)[cite: 1]

*(Nota: Na demo estática hospedada no GitHub Pages, o estado das fichas fica salvo localmente no navegador; para usar a sincronização em tempo real entre dispositivos, execute o servidor Express incluído no repositório).*

---

## O que o projeto faz

* **Fichas modulares e agnósticas:** Estrutura baseada em abas (`TabNav`), cartões em grade (`BentoCard`) e campos tipados (`FieldPrimitives`) — atributos, modificadores calculados, barras de recursos (HP, Mana, Sanidade), checklists e notas.
* **Presets e blocos customizados:** Inclui templates prontos (`Presets.kt`) e um editor visual (`CustomCardBuilder`) para montar novos cartões e campos sem mexer no código[cite: 2].
* **Motor de fórmulas:** Avalia expressões dinâmicas em tempo real (`formula.ts` / `FormulaEngine.kt`), atualizando perícias, CA e valores derivados automaticamente a partir dos atributos base[cite: 2].
* **Progressão por XP:** Gerenciador de pontos de experiência (`XpSystem` / `XpUpgradeWorkspace`) para calcular custos e aplicar melhorias diretamente na ficha[cite: 2].
* **Rolador de dados com log e áudio:** Painel lateral com histórico de rolagens da sessão (`RollLogSidebar`), detalhamento dos dados individuais e feedback sonoro via Web Audio (`diceAudio.ts`)[cite: 2].
* **Consulta rápida de regras:** Painel integrado (`RulesSearchPanel` / `RollAndRulesSheet`) para pesquisar regras e condições durante a mesa[cite: 2].
* **Exportação HTML standalone:** Gera um arquivo `.html` único e autocontido (`pureHtmlExporter.ts`) para abrir a ficha offline no navegador ou imprimir[cite: 2].
* **Impressão formatada:** Layout dedicado (`PrintSheetHeader` / `printSheet.ts`) para exportação limpa em PDF ou papel[cite: 2].
* **Multi-fichas e Sync Web ↔ Android:** Gerenciamento de múltiplos personagens (`SheetModal`) com persistência local no Android via SQLite/Room (`GridSheetDatabase`) e sincronização via servidor Node/Express (`server.ts` / `WorkspaceSyncEngine` / `RoomSyncBridge`)[cite: 2].

---

## Stack

* **Web:** React, TypeScript, Vite, CSS customizado (`src/index.css`)[cite: 2]
* **Backend / Sync:** Node.js, Express (`server.ts`)[cite: 2]
* **Android:** Kotlin, Jetpack Compose, Room (SQLite), Gradle Kotlin DSL[cite: 2]

---

## Estrutura

```text
rpg-sheet-builder/
├── .github/workflows/        # CI/CD (Deploy GitHub Pages + Build APK)
├── android/                  # App Android nativo (Kotlin + Compose + Room)
│   └── app/src/main/java/com/gridsheet/app/
│       ├── core/             # FormulaEngine, Presets, SheetModels, XpSystem
│       ├── data/             # RoomSyncBridge, WorkspaceRepository, WorkspaceSyncEngine, Room DB
│       └── ui/               # GridSheetApp, SheetViewModel, componentes e tema
├── public/
│   ├── assets/aistudio/      # Referências de UI e paleta
│   └── prototipo-puro.html   # Exemplo de exportação HTML standalone
├── src/
│   ├── components/           # BentoCard, CustomCardBuilder, FieldPrimitives, RollLogSidebar, etc.
│   ├── core/                 # Fórmulas, modelo da ficha, XP, busca, áudio, sync e exportadores
│   ├── App.tsx               # Aplicação principal
│   └── index.css             # Tokens e estilos globais
└── server.ts                 # Servidor Express para API e sincronização
