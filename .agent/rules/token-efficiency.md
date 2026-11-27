# Economia de Tokens e Eficiência de Contexto

- **Ignorar Diretórios**: Nunca varrer `node_modules/`, `dist/`, `android/` ou lockfiles.
- **Localização Prévia**: Antes de abrir `src/core/i18n.ts`, `src/core/i18n/*.ts`, `src/core/paperSheetModel.ts`, `shared/presets/presets.v2.json`, `src/components/BentoCard.tsx`, `src/components/FieldPrimitives.tsx` ou `src/index.css`, use `rg`/grep/Node para mapear linhas ou chaves exatas.
- **Leitura Cirúrgica**: Leia somente trechos necessários; não carregue arquivos completos de grande porte no contexto.
- **Edições Cirúrgicas**: Use substituições pontuais (`edit_file`); nunca reescreva um arquivo inteiro para alterar funções.
- **Fronteiras Claras**: Limite cada workstream a 3–5 arquivos com fronteiras exclusivas.
- **Roteamento de Modelos**: Raciocínio (Pro) apenas para arquitetura, contratos e bugs complexos; rápido (Flash) para dicionários, CSS, substituições mecânicas e QA/testes.
- **Respostas Concisas**: Respostas finais em no máximo 15 linhas (branch, `git status -sb`, `git diff --stat`, contagem de testes e achados objetivos).
