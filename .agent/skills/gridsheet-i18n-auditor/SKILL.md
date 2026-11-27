---
name: gridsheet-i18n-auditor
description: Audita e sincroniza traduções (pt-BR, en, es) e strings literais no GridSheet sem inflar contexto.
---

# Auditoria e Sincronização i18n

## Gatilhos
- Modificações ou adições de traduções nos idiomas `pt-BR`, `en` e `es`.
- Auditoria e substituição de strings literais na UI.

## Procedimento de Execução
1. **Descoberta Cirúrgica**: Nunca leia `src/core/i18n.ts`, `src/core/i18n/*.ts` ou `shared/presets/presets.v2.json` por inteiro. Use `rg` ou script Node para localizar chaves e linhas específicas.
2. **Escopo Modular**: Coloque traduções exclusivas de um sistema em `src/core/i18n/<sys>.ts` (ex.: `dnd5e.ts`, `wod.ts`) e mantenha paridade estrita em `Record<TranslationKey, string>` nos 3 idiomas, removendo chaves órfãs ao refatorar UI.
3. **Presets em Tempo de Render**: Localize rótulos canônicos de presets via `src/core/presetI18n*.ts` no render/export, sem mutar dados salvos ou sobrescrever rótulos editados pelo usuário.
4. **Preservação de Fórmulas**: Jamais altere identificadores técnicos (`field.key`, `varName`) consumidos pelo motor de fórmulas.
5. **Validação**: Execute `npx vitest run src/i18n.test.ts` e `npm run test:node` (cobre `src/core/i18n.test.ts` e `src/core/presetI18n.test.ts`).
