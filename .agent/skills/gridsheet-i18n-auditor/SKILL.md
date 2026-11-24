---
name: gridsheet-i18n-auditor
description: Audita e sincroniza traduções (pt-BR, en, es) e strings literais no GridSheet sem inflar contexto.
---

# Auditoria e Sincronização i18n

## Gatilhos
- Modificações ou adições de traduções nos idiomas `pt-BR`, `en` e `es`.
- Auditoria e substituição de strings literais na UI.

## Procedimento de Execução
1. **Descoberta Cirúrgica**: Nunca leia `src/core/i18n.ts` ou `shared/presets/presets.v2.json` por inteiro. Use `rg` ou script Node para localizar chaves e linhas específicas.
2. **Tipagem e Paridade**: Mantenha paridade estrita em `Record<TranslationKey, string>` para os 3 idiomas.
3. **Preservação de Fórmulas**: Jamais altere identificadores técnicos (`field.key`, `varName`) consumidos pelo motor de fórmulas.
4. **Validação Rápida**: Execute `npx vitest run src/i18n.test.ts` para verificar integridade e ausência de chaves órfãs.
