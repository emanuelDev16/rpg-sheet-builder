# GridSheet

Construtor e gerenciador agnóstico de fichas para RPG de mesa (*TTRPG*), projetado com estética *Light Cyber Brutalism*. 

O projeto roda como uma aplicação web (React + TypeScript + Express) e conta com um cliente nativo para Android (Kotlin + Jetpack Compose + Room) que sincroniza o estado das fichas entre dispositivos.

---

## O que o projeto faz

* **Fichas modulares e agnósticas:** Estrutura baseada em abas (`TabNav`), cartões em grade (`BentoCard`) e campos tipados (`FieldPrimitives`) — atributos, modificadores calculados, barras de recursos (HP, Mana, Sanidade), checklists e notas[cite: 1].
* **Presets e blocos customizados:** Inclui templates prontos (`Presets.kt`) e um editor visual (`CustomCardBuilder`) para montar novos cartões e campos sem mexer no código[cite: 1].
* **Motor de fórmulas:** Avalia expressões dinâmicas em tempo real (`formula.ts` / `FormulaEngine.kt`), atualizando perícias, CA e valores derivados automaticamente a partir dos atributos base[cite: 1].
* **Progressão por XP:** Gerenciador de pontos de experiência (`XpSystem` / `XpUpgradeWorkspace`) para calcular custos e aplicar melhorias diretamente na ficha[cite: 1].
* **Rolador de dados com log e áudio:** Painel lateral com histórico de rolagens da sessão (`RollLogSidebar`), detalhamento dos dados individuais e feedback sonoro via Web Audio (`diceAudio.ts`)[cite: 1].
* **Consulta rápida de regras:** Painel integrado (`RulesSearchPanel` / `RollAndRulesSheet`) para pesquisar regras e condições durante a mesa[cite: 1].
* **Exportação HTML standalone:** Gera um arquivo `.html` único e autocontido (`pureHtmlExporter.ts`) para abrir a ficha offline no navegador ou imprimir[cite: 1].
* **Multi-fichas e Sync Web ↔ Android:** Gerenciamento de múltiplos personagens (`SheetModal`) com persistência local no Android via SQLite/Room (`GridSheetDatabase`) e sincronização via servidor Node/Express (`server.ts` / `WorkspaceSyncEngine`)[cite: 1].

---

## Stack

* **Web:** React, TypeScript, Vite, CSS customizado (`src/index.css`)[cite: 1]
* **Backend / Sync:** Node.js, Express (`server.ts`)[cite: 1]
* **Android:** Kotlin, Jetpack Compose, Room (SQLite), Gradle Kotlin DSL[cite: 1]

---

## Estrutura

```text
rpg-sheet-builder/
├── android/                  # App Android nativo (Kotlin + Compose + Room)
│   └── app/src/main/java/com/gridsheet/app/
│       ├── core/             # FormulaEngine, Presets, SheetModels, XpSystem
│       ├── data/             # WorkspaceRepository, WorkspaceSyncEngine, Room DB
│       └── ui/               # GridSheetApp, SheetViewModel, componentes e tema
├── public/
│   ├── assets/aistudio/      # Referências de UI e paleta
│   └── prototipo-puro.html   # Exemplo de exportação HTML standalone
├── src/
│   ├── components/           # BentoCard, CustomCardBuilder, FieldPrimitives, RollLogSidebar, etc.
│   ├── core/                 # Fórmulas, modelo da ficha, XP, busca, áudio e exportador HTML
│   ├── App.tsx               # Aplicação principal
│   └── index.css             # Tokens e estilos globais
└── server.ts                 # Servidor Express para API e sincronização
