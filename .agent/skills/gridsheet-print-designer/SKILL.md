---
name: gridsheet-print-designer
description: Ajusta layout de impressão (@media print), PDF e exportação HTML autônoma no GridSheet.
---

# Design de Impressão e Exportação HTML

## Gatilhos
- Ajustes de CSS de impressão (`@media print`), exportação PDF ou layout de ficha em papel.
- Manutenção de `src/core/pureHtmlExporter.ts`.

## Regras Obrigatórias
1. **Impressão Isolada**: Mantenha a impressão PDF via iframe oculto gerado por `pureHtmlExporter.ts` (evita vazamento de DOM/CSS web, `<input>` e tags técnicas `//`) e priorize o nome real preenchido do personagem no título/cabeçalho.
2. **Paridade de Estilos**: Preserve paridade CSS entre `pureHtmlExporter.ts`, `src/styles/paperPrint.css` e `PaperSheetPrintView.tsx` nos 3 estilos (`gothic-crimson`, `classic-bw`, `minimal` via `data-print-style`).
3. **Escala A4 & Quebra de Página**: Calibre a Página 1 em `281mm` (buffer de 2mm contra arredondamento/página em branco no Chromium), deixe Página 2+ com `min-height: 281mm; height: auto` e aplique `break-inside: avoid` em blocos atômicos.
4. **Todas as Abas & Contraste**: Renderize todas as abas da ficha com fundo branco, texto preto nítido e `print-color-adjust: exact` em `DotRating`/marcadores, independente do tema ativo (`dark` ou `eink`).
5. **Segurança e Sanitização**: Garanta `escapeHtml()`, `sanitizeUrl()` e CSP restritiva em `pureHtmlExporter.ts`, validando com `src/core/printSheet.test.ts` e `src/core/securityFuzz.test.ts`.
