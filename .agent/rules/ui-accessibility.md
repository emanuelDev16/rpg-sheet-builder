# UI & Acessibilidade (GridSheet Web)

## Controles
- Declare todo `<button>` com `type="button"`, exceto submit explícito de formulário.
- Use `aria-disabled="true"` em vez de `disabled` quando o foco precisar persistir; bloqueie o handler em JS (`if (ariaDisabled) return`).
- Preserve o texto visível no início do `aria-label` (WCAG 2.5.3 Label in Name).
- Garanta `min-height: 36px` em alvos interativos.

## Teclado & IME
- Ignore Enter/atalhos durante composição: `if (e.nativeEvent.isComposing || e.keyCode === 229) return;`.

## Tabelas
- Use `<th scope="col">` em cabeçalhos de coluna e `scope="row"` em cabeçalhos de linha.

## Mobile
- Use `font-size: 16px` mínimo em `input`, `select` e `textarea` mobile para evitar zoom automático.

## Temas & Contraste
- Use somente tokens semânticos de `src/index.css`.
- Em `[data-theme="eink"]`: zero `box-shadow`, gradientes, `transition` e `animation`.
- Adicione `@media (forced-colors: active)` com bordas visíveis (`CanvasText`, `ButtonText`) em controles customizados.

## Camadas
- Renderize popovers/dropdowns via `<AnchoredPopover>` (portal em `document.body`) com tokens `--z-*`.
- Nunca use `position: absolute` para popovers dentro de containers com `overflow`.
