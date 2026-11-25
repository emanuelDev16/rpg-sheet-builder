---
name: gridsheet-system-adapter
description: Adapta e adiciona sistemas de RPG não-WoD (D&D 5e SRD, Cyberpunk NET//RUNNER, Genérico) ao GridSheet.
---

# Adaptador de Novos Sistemas de RPG

## Gatilhos
- Criação ou evolução de presets e regras para D&D 5e SRD, Cyberpunk `NET//RUNNER` ou Genérico.

## Regras Obrigatórias
1. **Isolamento Modular**: Isole toda a lógica específica do novo sistema em `src/core/<sys>*` sem poluir módulos genéricos.
2. **Preservação de WoD**: Preserve intactos todos os catálogos, presets e regras existentes de WoD V5 e V20.
3. **Contrato Estrito**: Mantenha `additionalProperties: false` em todas as definições de `shared/presets/schema.v2.json`.
4. **Registro de Testes**: Registre e execute as novas suítes `node:test` em `vitest.config.ts`.
5. **Validação**: Valide conformidade com `node scripts/validate-presets.js` e `npm run test:all`.
