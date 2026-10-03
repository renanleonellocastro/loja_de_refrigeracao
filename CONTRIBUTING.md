# Como contribuir

## Fluxo

1. Escolha uma issue do [roteiro](docs/ROTEIRO.md) e crie uma branch a partir do `main`: `feat/42-cadastrar-cliente`, `fix/77-estoque-negativo`, `chore/...`, `docs/...`.
2. Faça commits pequenos no padrão [Conventional Commits](https://www.conventionalcommits.org/), em inglês: `feat(api): reserve stock atomically on checkout`.
3. Abra um PR para o `main` com o título no mesmo padrão e `Closes #42` na descrição.
4. O merge só acontece com o CI verde. O `main` é protegido e não recebe commits diretos.

## Definição de pronto

* Critérios de aceite da issue atendidos.
* Testes no mesmo PR, com **100% de cobertura** de linhas, ramos, funções e instruções.
* Tela nova ou alterada: E2E em celular, tablet e desktop e zero violações do axe.
* API nova ou alterada: OpenAPI e cliente gerado atualizados.
* Documentos em `docs/` atualizados quando a regra de negócio mudar.

## Idiomas

Documentação, issues, interface e emails em português do Brasil. Código, banco, rotas e commits em inglês (ADR 0015).

## Comandos

```
pnpm install       dependências
pnpm dev           sistema completo local (Docker + API + site)
pnpm test          unitários e integração com cobertura
pnpm test:e2e      Playwright nos três dispositivos
pnpm lint          ESLint e Prettier
pnpm typecheck     TypeScript em todos os pacotes
pnpm depcruise     fronteiras entre módulos da API
```
