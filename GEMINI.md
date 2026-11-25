# Diretrizes do Projeto GridSheet (Web)

## Stack & Comandos
- **Escopo Ativo**: Exclusivamente Web: React 19, TypeScript, Vite, Tailwind CSS v4 e IndexedDB.
- **Persistência Local**: Armazenamento cliente-side via IndexedDB para fichas, templates e metadados.
- **Servidor de Sincronização**: Servidor Express em `server.ts` para sincronização LAN autenticada (opcional).
- **Módulo Android Pausado**: Diretório `android/` pausado; não altere código Kotlin nem execute tarefas Gradle.
- **Estilização Semântica**: Tailwind CSS v4 com variáveis CSS em `src/index.css` para suporte a temas.
- **Ambiente de Execução**: Node.js 20+ com npm para execução de testes e ferramentas de build.
- **Validação de Tipos**: `npm run lint` (`tsc --noEmit`) para checagem estática de tipos TypeScript.
- **Suíte Unificada de Testes**: `npm run test:all` (executa Vitest e todas as suítes `node:test`).
- **Build de Produção**: `npx vite build --base=/rpg-sheet-builder/` para validar empacotamento Web.
- **Critério de Aceite**: Exit Code 0 obrigatório e zero testes pulados (`skipped`) na validação Web.

## Mapa de Arquivos
- `@shared/presets/schema.v2.json`: Contrato JSON Schema estrito para validação de fichas e campos de regras.
- `@shared/presets/presets.v2.json`: Presets oficiais de sistemas de RPG (WoD V5, V20, D&D 5e SRD, Cyberpunk, Genérico).
- `@shared/presets/fixtures/`: Fichas e payloads de referência para validação de presets e contratos.
- `src/core/formula.ts`: Motor determinístico de avaliação de expressões e fórmulas sem interpretadores dinâmicos.
- `src/core/pureHtmlExporter.ts`: Exportador HTML autônomo com sanitização estrita, `sanitizeUrl` e CSP embutida.
- `src/core/storage.ts`: Camada cliente-side IndexedDB para persistência de fichas e configurações locais.
- `src/core/i18n.ts`: Dicionários e chaves de internacionalização nos idiomas `pt-BR`, `en` e `es`.
- `src/core/xp/`: Motor de experiência, catálogos de vantagens e histórico contábil de evolução de personagens.
- `src/utils/bentoLayout.ts`: Algoritmo de empacotamento masonry responsivo para cards Bento da ficha.
- `src/utils/dotRating.ts`: Renderização e manipulação acessível de caixas e círculos de atributos e habilidades.
- `src/utils/poolComposer.ts`: Utilitários de composição e rolagem combinada de dados WoD e genéricos.
- `src/components/`: Componentes modulares React (BentoCard, FieldPrimitives, SheetModal, RollComposer, Wizard).
- `src/components/BentoCard.tsx`: Card base modular com suporte a expansão, layout bento e densidade adaptativa.
- `src/components/FieldPrimitives.tsx`: Primitivas de campos, inputs numéricos, seletores e tags de ficha.
- `src/workers/pdfIndexer.worker.ts`: Worker off-thread para extração de texto e busca OCR em livros de regras.
- `src/index.css`: Tokens semânticos para `light`, `dark` e `eink` com regras de alto contraste para impressão.
- `src/App.tsx`: Shell principal da aplicação com roteamento de abas e gerenciador de estado.
- `scripts/validate-presets.js`: Script de validação sintática e semântica do schema v2 e presets oficiais.
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
- **Isolamento de Sistemas**: Isolar novas regras de RPG em `src/core/<sys>*` sem acoplamentos nos módulos genéricos.
- **Popovers & Camadas Z**: Popovers/dropdowns devem usar <AnchoredPopover> (createPortal em document.body) e tokens --z-* de src/index.css; nunca position: absolute dentro de containers com overflow.

## Governança & Skills
- **Diretrizes e Regras**: Ver `@.agent/rules/` (`token-efficiency.md`) para governança de git, validação e eficiência.
- **Micro-Skills**: Usar `gridsheet-i18n-auditor`, `gridsheet-print-designer`, `gridsheet-system-adapter` e `gridsheet-qa-runner` em `@.agent/skills/`.
