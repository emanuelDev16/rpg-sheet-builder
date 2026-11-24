---
name: gridsheet-qa-runner
description: Executa a bateria de QA e validação no fechamento de branches com modelo Flash.
---

# QA Runner e Fechamento de Branch

## Gatilhos
- Fechamento e validação final de branches (usar modelo Flash).

## Execução
Execute a sequência canônica em comando único:
```bash
npm run lint && npm run test:all && npx vite build --base=/rpg-sheet-builder/
```

## Formato de Saída (Máximo 10 linhas)
Reporte apenas os dados objetivos:
- Contagem exata de testes aprovados (`vitest` e `node:test`) e testes pulados (0 obrigatório).
- Falhas detalhadas (se houver).
- Resumo conciso de `git diff --stat`.
