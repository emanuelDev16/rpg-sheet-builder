# Governança Git & Validação Obrigatória (Web)

## 1. Isolamento em Branch (Antes de Editar)
- Em qualquer tarefa que modifique arquivos, verifique `git status -sb` e `git branch -vv` antes da primeira edição.
- Nunca edite diretamente na `main` ou na branch base da sprint (`feat/web-wod-app`). Crie e mude para uma branch descritiva (`feat/<escopo>`, `fix/<escopo>` ou `chore/<escopo>`) a partir da branch atual antes de alterar qualquer arquivo.
- Ignore a criação de branch apenas em consultas estritamente somente-leitura (auditorias sem edição).

## 2. Validação Web Obrigatória (Antes de Concluir)
- O desenvolvimento Android (`android/`) está pausado: não execute tarefas do Gradle nem modifique código Kotlin salvo solicitação explícita.
- Nenhuma tarefa de código Web é considerada concluída sem Exit Code `0` e sem testes pulados (`skipped`) nos comandos abaixo:
  1. `npm run lint`
  2. `npm run test:all` (executa `test:vitest` e todas as suítes `node:test`)
  3. `npx vite build --base=/rpg-sheet-builder/`
- Ao finalizar, reporte a contagem de testes aprovados (`vitest` e `node:test`), exiba `git branch --show-current`, `git status -sb` e `git diff --stat`.
