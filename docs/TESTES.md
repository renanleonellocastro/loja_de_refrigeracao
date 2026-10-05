# Estratégia de testes

Regra do projeto: **todo código entra com teste, e o CI recusa qualquer mudança abaixo de 100% de cobertura de linhas, ramos, funções e instruções**, no backend e no frontend. Cobertura é o piso; o objetivo é que cada caso de uso documentado tenha prova automática de que funciona, em todos os dispositivos.

## 1. Portões do CI (bloqueiam o merge)

| Portão | API (`apps/api`) | Web (`apps/web`) |
|---|---|---|
| Formatação e lint | ESLint + Prettier | ESLint (plugin Vue) + Prettier |
| Tipos | `tsc --noEmit` estrito | `nuxi typecheck` (`vue-tsc`) |
| Fronteiras entre módulos | `dependency-cruiser` | `dependency-cruiser` |
| Unitários e cobertura | Vitest + `@vitest/coverage-v8`, limites de 100 | Vitest + Vue Test Utils + Testing Library, limites de 100 |
| Integração | Vitest com PostgreSQL real (Testcontainers localmente, serviço no CI) e `app.inject` do Fastify | Componentes e páginas contra a API simulada por MSW com o cliente gerado |
| Contrato | OpenAPI gerada igual à versionada; Schemathesis contra a API | Cliente gerado sem divergência |
| Permissões | Teste gerado da matriz: cada rota × cada papel × dono ou não dono | Guardas de rota por papel |
| E2E | | Playwright em três dispositivos (Pixel 7, iPad, desktop 1440 px) e três motores (Chromium, WebKit, Firefox) |
| Acessibilidade | | `@axe-core/playwright` em toda tela, zero violações AA |
| Visual | | Capturas do guia vivo `/design` e das telas principais comparadas por dispositivo (`@visual`) |
| Desempenho | | Lighthouse CI com os orçamentos do RNF-08; limite de tamanho de bundle |
| Segurança | `pnpm audit`, gitleaks, Semgrep | `pnpm audit`, Semgrep |

Mutação com StrykerJS (pontuação mínima de 85%) roda nos módulos de regras críticas alterados: estoque, máquinas de estado, permissões, dinheiro. Teste de carga k6 antes de cada versão.

## 2. O que cada camada garante

* **Unitários**: regras puras (máquinas de estado com todas as combinações, cálculo de totais, validação de CPF, CEP e telefone, formatação de dinheiro e datas, matriz de permissões). Relógio e geradores de id injetados, nada de `Date.now()` solto.
* **Integração da API**: cada rota testada pelo HTTP contra o banco real, com migrações aplicadas e transação desfeita ao fim de cada teste. Casos obrigatórios por rota: sucesso, validação (`422`), sem autenticação (`401`), sem permissão (`403` ou `404`), não encontrado, conflito quando houver.
* **Concorrência**: testes que disparam pedidos simultâneos para o último item do estoque e garantem exatamente uma reserva; serviços sobrepostos na agenda do mesmo técnico; edição concorrente com `If-Match`.
* **Componentes**: cada componente base em todos os estados (padrão, foco, desabilitado, carregando, erro) e com teclado.
* **Páginas**: fluxos da tela com a API simulada, incluindo erros de rede e respostas lentas.
* **E2E**: um arquivo por caso de uso (`e2e/uc-solicitar-agendamento.spec.ts`), nomeado com o RF correspondente, rodando contra a stack completa com banco semeado e Mailpit para verificar os emails enviados.

## 3. Contrato com Schemathesis

O job `contract` do CI sobe o PostgreSQL, migra e semeia o banco (`pnpm --filter @rc/api seed`), inicia a API e roda `infra/schemathesis.sh` contra `/api/v1/openapi.json`: uma passada anônima e outra com o token do gerente obtido em `POST /api/v1/auth/sessions`. Localmente: `infra/schemathesis.sh http://localhost:3001` com a API rodando sobre o banco semeado.

Exclusões, todas falsos positivos documentados:

| Exclusão | Motivo |
|---|---|
| verificação `positive_data_acceptance` | Regras de negócio recusam dados válidos pelo esquema (link vencido, carrinho vazio, senha atual errada, `If-Match` exigido) com 4xx documentados. |
| verificação `unsupported_method` | O Fastify responde 404 em vez de 405 para métodos sem rota; nenhum dos dois expõe nada. |
| `/api/v1/addresses/lookup` | Consulta o ViaCEP, serviço externo que o CI não deve sobrecarregar. |
| `/api/v1/auth/*` e `/api/v1/me*` na passada autenticada | Sair, trocar a senha ou excluir a conta encerraria a sessão usada no teste; a passada anônima cobre essas rotas. |

## 4. Dados de teste

Fábricas tipadas (`test/factories`) criam usuários de cada papel, produtos com e sem estoque, pedidos em cada estado e serviços em cada etapa. Os dados de exemplo para desenvolvimento usam nomes e documentos fictícios gerados com CPFs válidos de teste; nenhum dado real de cliente entra no repositório.

## 5. Exclusões de cobertura

Somente arquivos de configuração e pontos de entrada do processo (`server.ts`, `worker.ts`, `nuxt.config.ts`), listados explicitamente na configuração do Vitest. Comentários `istanbul ignore` ou `v8 ignore` exigem justificativa no PR e são revisados um a um.

## 6. Como rodar

```
pnpm test            unitários e integração com cobertura
pnpm test:e2e        Playwright nos três dispositivos
pnpm test:a11y       só as verificações de acessibilidade
pnpm lighthouse      orçamentos de desempenho
```
