# GridSheet (v2.0)

Construtor e gerenciador agnóstico de fichas para RPG de mesa (*TTRPG*), projetado com estética *Light Cyber Brutalism*.

O projeto roda como uma aplicação web (React + TypeScript + Express) e conta com um cliente nativo para Android (Kotlin + Jetpack Compose + Room) que sincroniza o estado das fichas entre dispositivos.

---

## Demo e Download

* **Demo Web:** [emanueldev16.github.io/rpg-sheet-builder](https://emanueldev16.github.io/rpg-sheet-builder/)[cite: 1]
* **App Android (APK):** [Baixar última build na aba Releases](https://github.com/emanueldev16/rpg-sheet-builder/releases/tag/latest-demo)[cite: 1]

*(Nota: Na demo estática hospedada no GitHub Pages, o estado das fichas fica salvo localmente no navegador; para usar a sincronização em tempo real entre dispositivos, execute o servidor Express incluído no repositório[cite: 1]).*

---

## Novidades da v2.0

* **Motor de Rolagem d10 / Storyteller Clássico:** Suporte completo a paradas de dados (*dice pools*) com **Dificuldade (Target Number)** ajustável (2 a 10), opção de **Especialização** (resultados `10` contam como 2 sucessos), cancelamento por resultados `1` e detecção automática de **Falha Crítica (Botch)**[cite: 4].
* **Testes de Skill & Absorção (Soak):** Cálculo integrado para testes de perícia e rolagens de absorção de dano sem risco de Botch[cite: 4].
* **Gasto Automático de Willpower:** Controle `WILLPOWER (+1 AUTO SUCCESS)` integrado diretamente ao contador de Willpower da ficha, adicionando 1 sucesso automático imune a `1s` e descontando 1 ponto do recurso atual a cada uso[cite: 4].
* **Blindagem e Segurança:** Sanitização contra XSS na exportação HTML standalone (`pureHtmlExporter.ts`), bloqueio de referências circulares e limites de recursão/dados no motor de fórmulas (`formula.ts`), além de autenticação por token no servidor de sincronização[cite: 1].

---

## O que o projeto faz

* **Fichas modulares e agnósticas:** Estrutura baseada em abas (`TabNav`), cartões em grade (`BentoCard`) e campos tipados (`FieldPrimitives`) — atributos, modificadores calculados, barras de recursos (HP, Mana, Willpower, Sanidade), checklists e notas[cite: 1, 4].
* **Presets e blocos customizados:** Inclui templates prontos (`Presets.kt`) e um editor visual (`CustomCardBuilder`) para montar novos cartões e campos sem mexer no código[cite: 1].
* **Motor de fórmulas dinâmicas:** Avalia expressões matemáticas e paradas de dados em tempo real (`formula.ts` / `FormulaEngine.kt`), atualizando perícias e valores derivados automaticamente[cite: 1, 4].
* **Progressão por XP:** Gerenciador de pontos de experiência (`XpSystem` / `XpUpgradeWorkspace`) para calcular custos e aplicar melhorias diretamente na ficha[cite: 1].
* **Rolador de dados com log e áudio:** Painel lateral com histórico detalhado das rolagens da sessão (`RollLogSidebar`), status de resultado (`Success`, `Failure`, `Botch`) e feedback sonoro via Web Audio (`diceAudio.ts`)[cite: 1, 4].
* **Consulta rápida de regras:** Painel integrado (`RulesSearchPanel` / `RollAndRulesSheet`) para pesquisar regras e condições durante a mesa[cite: 1].
* **Exportação HTML standalone e impressão:** Gera um arquivo `.html` autocontido (`pureHtmlExporter.ts`) para abrir a ficha offline ou imprimir em layout limpo (`PrintSheetHeader` / `printSheet.ts`)[cite: 1].
* **Multi-fichas e Sync Web ↔ Android:** Gerenciamento de múltiplos personagens (`SheetModal`) com persistência local no Android via SQLite/Room (`GridSheetDatabase`) e sincronização via servidor Node/Express (`server.ts` / `WorkspaceSyncEngine` / `RoomSyncBridge`)[cite: 1].

---

## Stack

* **Web:** React, TypeScript, Vite, CSS customizado (`src/index.css`)[cite: 1]
* **Backend / Sync:** Node.js, Express (`server.ts`)[cite: 1]
* **Android:** Kotlin, Jetpack Compose, Room (SQLite), Gradle Kotlin DSL[cite: 1]
* **Testes:** Vitest (`src/core/*.test.ts`) e JUnit (`CoreEngineTest.kt`)[cite: 1, 4]

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
