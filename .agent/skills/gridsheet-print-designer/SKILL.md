---
name: gridsheet-print-designer
description: Ajusta layout de impressão (@media print), PDF e exportação HTML autônoma no GridSheet.
---

# Design de Impressão e Exportação HTML

## Gatilhos
- Ajustes de CSS de impressão (`@media print`), exportação PDF ou layout de ficha em papel.
- Manutenção de `src/core/pureHtmlExporter.ts`.

## Regras Obrigatórias
1. **Todas as Abas**: Garanta a renderização e impressão de todas as abas da ficha, e não apenas da aba ativa em tela.
2. **Alto Contraste**: Force fundo branco e texto preto nítido na impressão, independente do tema ativo (`dark` ou `eink`).
3. **Quebra de Página**: Aplique `break-inside: avoid` em cards e blocos atômicos para evitar quebras inadequadas.
4. **Precisão de Impressão**: Use `print-color-adjust: exact` no componente `DotRating` e marcadores visuais.
5. **Segurança e Sanitização**: Garanta `escapeHtml()` em 100% das interpolações de dados e CSP restritiva em `pureHtmlExporter.ts`.
