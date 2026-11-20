# Governança Git & Validação Obrigatória (Web)

## 1. Isolamento em Branch (Antes de Editar)
- Em qualquer tarefa que modifique arquivos, verifique `git status -sb` e `git branch -vv` antes da primeira edição.
- Nunca edite diretamente na `main` ou na branch base da sprint (`feat/web-wod-app`). Crie e mude para uma branch descritiva (`feat/<escopo>`, `fix/<escopo>` ou `chore/<escopo>`) a partir da branch atual antes de alterar qualquer arquivo.
- Ignore a criação de branch apenas em consultas estritamente somente-leitura (auditorias sem edição).

## 2. Validação Web Obrigatória (Antes de Concluir)
- O desenvolvimento Android (`android/`) está pausado: não execute tarefas do Gradle nem modifique código Kotlin salvo solicitação explícita.
- Nenhuma tarefa de código Web é considerada concluída sem Exit Code `0` e sem testes pulados (`skipped`) nos comandos abaixo:
  1. `npm run lint`
  2. `npx vitest run`
  3. Os testes `node:test` correspondentes em `src/core/*.test.ts` (ou a suíte completa quando alterar `src/core/` ou `shared/presets/`)
  4. `npx vite build --base=/rpg-sheet-builder/`
- Ao finalizar, reporte a contagem de testes aprovados e exiba `git branch --show-current` e `git diff --stat`.
