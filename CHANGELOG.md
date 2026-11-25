# Changelog

Registro das alterações consolidadas da entrega Web de World of Darkness (Fases 1–4 e endurecimento de segurança/regras).

## [Unreleased] — Web WoD Sprint (Fases 1–4)

### Added
- **Criação e Presets WoD (`HomeView`, `SheetModal`, `shared/presets/presets.v2.json`):** Alinhamento de fichas V20 e V5 com grade 3×3 de Atributos (Físicos, Sociais, Mentais) e fluxo unificado de escolha de edição e clã.
- **Catálogos Oficiais WoD:** Adicionados `src/core/wodClansDisciplinesCatalog.ts`, `src/core/wodSkillsCatalog.ts` e `src/core/wodAdvantagesCatalog.ts` cobrindo Clãs, Disciplinas, Poderes, Perícias, Antecedentes, Qualidades/Defeitos e Refúgios.
- **Controles e Rolador Combinado:** Novo componente acessível `DotRating` (`0–5` / `0–10`) e `WodPoolComposer` para paradas combinadas livres em V20 e V5, além de acionamento de `Rouse Check` / `Gasto de Sangue` direto nos poderes.
- **Evolução de XP (`XpUpgradeWorkspace`, `xpSystem.ts`):** Aquisição `0 -> 1` de perícias, disciplinas (com afinidade de clã) e vantagens a partir dos catálogos, compra de especializações e estorno atômico via `Undo`.
- **Mecânicas de Mesa V5 e V20:** Manchas & Remorso V5, trilha completa de Força de Vontade V5 (`Superficial`/`Agravado`/`Impaired`), Tabela de Potência de Sangue V5 acoplada a Surto de Sangue, bônus de poder e rerrolagem de Rouse, além de testes de Frenesi e Rötschreck.
- **Blocos Estruturados e Assistente Guiado:** Adicionados `WodStructuredBlocks` (Pedras de Toque & Convicções, Qualidades/Defeitos e Refúgios) e `WodCreationWizard` com criação guiada em 4 passos para V5 e V20.
- **Exportação e Impressão:** Cobertura completa dos novos blocos WoD na exportação HTML standalone (`pureHtmlExporter.ts`), `PrintSheetHeader` e polimento `@media print` em `src/index.css`.

### Changed
- **Contrato v2 (`shared/presets/schema.v2.json`):** Expandido mantendo `additionalProperties: false` para suportar trilhas V5, blocos estruturados, logs de Frenesi/Remorso e metadados de aquisição XP.
- **Layout e Temas:** Reorganização do grid em alvenaria segmentada de 2 colunas (`src/utils/bentoLayout.ts`), harmonização de contraste/densidade no tema Light e consistência visual nos temas `Light`, `Dark` e `E-Ink`.
- **i18n e CI/CD:** Paridade estrita de chaves entre `pt-BR`, `en` e `es` validada em `src/i18n.test.ts`; suíte unificada em `npm run test:all` (Vitest + `node:test`); deploy do GitHub Pages separado em jobs `build-web`/`deploy-web` e build Android movido para *opt-in* manual (`workflow_dispatch`) em `.github/workflows/deploy-demo.yml`.

### Fixed
- Corrigido o custo fixo de 3 XP para vantagens V5 e a sincronização de trilhas derivadas após evolução ou estorno de XP.
- Corrigido o acoplamento dos bônus/rerrolagens da Tabela de Potência de Sangue e a aplicação de `Impaired` por domínio.
- Ajustado o rodapé fixo do modal de criação em viewports reduzidos, eliminadas lacunas no grid masonry e removidos símbolos mortos (`V5_SKILL_ARRAYS`, `touchSheetMetadata`, `bufferRef`).

### Security
- **Motor de Fórmulas (`src/core/formula.ts`):** Limites explícitos contra DoS (profundidade de recursão, detecção de ciclos e teto de dados) sem uso de `eval` ou `new Function`.
- **Validação Estrita & Fixtures:** `additionalProperties: false` em `shared/presets/schema.v2.json` e suíte de regressão em `shared/presets/fixtures/` (`malformed-xss.json`, `envelope-v1-upcast.json`, `v20-botch.json`, `v5-messy-critical.json`).
- **Exportador HTML (`src/core/pureHtmlExporter.ts`):** Blindagem contra XSS com `escapeHtml`, sanitização de URLs/JSON embutido e cabeçalho CSP restritivo.
- **Sync Local (`server.ts`):** Bind padrão restrito a `127.0.0.1` (`ALLOW_LAN_SYNC=false`), autenticação Bearer obrigatória e remoção de resíduos `@google/genai` / `googleSearch`.

### Nota para Retomada do Android
Ao reativar o desenvolvimento em `android/`, espelhar em `android/app/src/main/java/com/gridsheet/app/core/SheetModels.kt`, `SheetPayloadValidator` e `CoreEngineTest.kt` os novos campos opcionais de `shared/presets/schema.v2.json`:
- `stains` (propriedade raiz e em `SheetField`);
- Dano na trilha de Força de Vontade `f_willpower` (`damageTrack`, `superficialDamage`, `aggravatedDamage` em `SheetField`);
- `touchstones` (`TouchstoneEntry`);
- `meritsFlaws` (`MeritFlawEntry`);
- `havens` (`HavenEntry`);
- Campos auxiliares opcionais de log e XP (`isRemorseCheck`, `isFrenzyRoll`, `frenzyKind`, `humanityLost`, `createdFieldIds`, `createdCardId`, `xpCategory`: `discipline_clan`, `discipline_out_of_clan`, `discipline_caitiff`).
