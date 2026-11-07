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

Mutação com StrykerJS (pontuação mínima de 85%) roda nos módulos de regras críticas alterados: estoque, máquinas de estado, permissões, dinheiro. Teste de carga k6 antes de cada versão (seção 4).

## 2. O que cada camada garante

* **Unitários**: regras puras (máquinas de estado com todas as combinações, cálculo de totais, validação de CPF, CEP e telefone, formatação de dinheiro e datas, matriz de permissões). Relógio e geradores de id injetados, nada de `Date.now()` solto.
* **Integração da API**: cada rota testada pelo HTTP contra o banco real, com migrações aplicadas e transação desfeita ao fim de cada teste. Casos obrigatórios por rota: sucesso, validação (`422`), sem autenticação (`401`), sem permissão (`403` ou `404`), não encontrado, conflito quando houver.
* **Concorrência**: testes que disparam pedidos simultâneos para o último item do estoque e garantem exatamente uma reserva; serviços sobrepostos na agenda do mesmo técnico; edição concorrente com `If-Match`.
* **Componentes**: cada componente base em todos os estados (padrão, foco, desabilitado, carregando, erro) e com teclado.
* **Páginas**: fluxos da tela com a API simulada, incluindo erros de rede e respostas lentas.
* **E2E**: um arquivo por caso de uso (`e2e/uc-solicitar-agendamento.spec.ts`), nomeado com o RF correspondente, rodando contra a stack completa com banco semeado e Mailpit para verificar os emails enviados.
* **Teclado**: `apps/e2e/tests/keyboard.spec.ts` percorre os fluxos principais (atalho para o conteúdo, criar conta e entrar, comprar e cancelar, pedir visita técnica) só com Tab, Enter, Espaço, setas e digitação, sem cliques. O auxiliar `tabTo` de `apps/e2e/support/keyboard.ts` aperta Tab até o controle receber foco, então o teste prova que ele está na ordem de tabulação.

## 3. Contrato com Schemathesis

O job `contract` do CI sobe o PostgreSQL, migra e semeia o banco (`pnpm --filter @rc/api seed`), inicia a API e roda `infra/schemathesis.sh` contra `/api/v1/openapi.json`: uma passada anônima e outra com o token do gerente obtido em `POST /api/v1/auth/sessions`. Localmente: `infra/schemathesis.sh http://localhost:3001` com a API rodando sobre o banco semeado.

Exclusões, todas falsos positivos documentados:

| Exclusão | Motivo |
|---|---|
| verificação `positive_data_acceptance` | Regras de negócio recusam dados válidos pelo esquema (link vencido, carrinho vazio, senha atual errada, `If-Match` exigido) com 4xx documentados. |
| verificação `unsupported_method` | O Fastify responde 404 em vez de 405 para métodos sem rota; nenhum dos dois expõe nada. |
| `/api/v1/addresses/lookup` | Consulta o ViaCEP, serviço externo que o CI não deve sobrecarregar. |
| `/api/v1/auth/*` e `/api/v1/me*` na passada autenticada | Sair, trocar a senha ou excluir a conta encerraria a sessão usada no teste; a passada anônima cobre essas rotas. |

## 4. Carga com k6

Verifica o RNF-10: p95 abaixo de 150 ms nas leituras e de 300 ms nas escritas com 10 mil produtos, 50 mil pedidos e 50 usuários simultâneos. Não roda em PR: é manual, antes de cada versão.

* **Como rodar**: `pnpm db:up` e depois `make load`. O script `infra/load-test.sh` recria o banco `castro_load` (`apps/api/scripts/load-stack.ts`), aplica as migrações, os dados de exemplo e o volume do RNF-10 (`apps/api/scripts/load-volume.sql`: 10 mil produtos, 500 clientes `carga-N@castro.dev` com a senha dos dados de exemplo e 50 mil pedidos com itens e linha do tempo), sobe a API em modo de produção e roda `tools/load/main.js`. Usa o `k6` instalado ou a imagem Docker `grafana/k6`. Variáveis: `LOAD_API_PORT` (3001), `LOAD_DATABASE_URL`, `LOAD_DURATION` (3m) e `LOAD_RESULTS` (`tools/load/results`, com `summary.json` e o log da API).
* **No CI**: workflow "Teste de carga" (`.github/workflows/load.yml`), disparado à mão em Actions; o resumo fica como artefato `k6` por 30 dias e vai para o PR de lançamento.
* **Fluxos**: 30 visitantes (início, categorias, busca, filtros, facetas, produto, serviços), 14 clientes com a própria conta (busca, produto, carrinho, fechar pedido, meus pedidos, detalhe) e 6 da gerência (painel, fila de pedidos, busca de pedidos e clientes, detalhe, catálogo, edição de produto com `If-Match`, venda no balcão, solicitações e agenda). Cada usuário pensa cerca de 1 s entre as telas. Subida de 30 s, 3 min com os 50 e descida de 15 s.
* **Limites**: p95 por tipo (leitura, escrita) e por rota, menos de 1% de falhas e 99% das verificações de status. Qualquer limite estourado faz o comando falhar. Os logins ficam fora da medição (feitos uma vez por conta), porque o hash Argon2 é lento de propósito.

### Resultado medido em 06/11/2026

Máquina local (Apple M5 Pro, 18 núcleos, 48 GB), API em modo de produção com log `info`, PostgreSQL 17 em Docker, outros processos rodando em paralelo. 18.555 requisições em 3 min 45 s (81 por segundo), nenhuma falha.

| Rota | p95 | p99 |
|---|---|---|
| Leituras (todas) | 38 ms | 61 ms |
| Escritas (todas) | 45 ms | 124 ms |
| `GET /products?q` (busca do visitante) | 55 ms | 83 ms |
| `GET /products` da gerência (com arquivados) | 63 ms | 86 ms |
| `GET /orders` fila da gerência (com contagem por estado) | 58 ms | 253 ms |
| `GET /orders?q` busca de pedidos | 46 ms | 69 ms |
| `GET /orders` meus pedidos | 41 ms | 77 ms |
| `GET /dashboard` | 18 ms | 57 ms |
| `GET /orders/:id` | 13 ms | 24 ms |
| `POST /orders` | 84 ms | 162 ms |
| `POST /counter-sales` | 74 ms | 126 ms |
| `PATCH /products/:id` | 25 ms | 60 ms |
| `PUT /me/cart/items/:productId` | 26 ms | 58 ms |

Todas as rotas ficaram bem abaixo dos limites. Os máximos isolados perto de 2 s aparecem ao mesmo tempo em rotas diferentes, inclusive nas triviais como `GET /store`: são pausas da máquina compartilhada, não gargalo da aplicação. As rotas mais pesadas são as listas com contagem e busca (`/orders` da gerência e `/products` com texto); são as primeiras a observar se o volume crescer.

## 5. Dados de teste

Fábricas tipadas (`test/factories`) criam usuários de cada papel, produtos com e sem estoque, pedidos em cada estado e serviços em cada etapa. Os dados de exemplo para desenvolvimento usam nomes e documentos fictícios gerados com CPFs válidos de teste; nenhum dado real de cliente entra no repositório.

## 6. Exclusões de cobertura

Somente arquivos de configuração e pontos de entrada do processo (`server.ts`, `worker.ts`, `nuxt.config.ts`), listados explicitamente na configuração do Vitest. Comentários `istanbul ignore` ou `v8 ignore` exigem justificativa no PR e são revisados um a um.

## 7. Como rodar

```
pnpm test            unitários e integração com cobertura
pnpm test:e2e        Playwright nos três dispositivos
pnpm test:a11y       só as verificações de acessibilidade
pnpm lighthouse      orçamentos de desempenho
make load            carga k6 do RNF-10 (seção 4)
make zap             varredura OWASP ZAP na stack de produção local (seção 8)
```

## 8. Varredura com OWASP ZAP

`make zap` monta as imagens de produção (`infra/docker/`) e sobe a stack de `infra/compose.production.yaml` com o Caddyfile de produção, num projeto próprio do Compose (`refrigeracao-castro-zap`) e sem porta publicada na máquina. O arquivo `infra/zap/compose.zap.yaml` muda só o que depende de domínio real: o Caddy atende HTTP na porta 8080 da rede interna, os emails vão para um Mailpit e as origens apontam para o proxy. Em seguida o [ZAP baseline](https://www.zaproxy.org/docs/docker/baseline-scan/) navega pelo site por dois minutos só com análise passiva (sem ataques), e a stack é removida com os volumes. Os relatórios ficam em `infra/zap/reports/` (HTML, JSON e Markdown, fora do git). `make zap-down` limpa a stack se uma execução for interrompida.

O workflow `Varredura ZAP` roda o mesmo alvo toda segunda e sob demanda (Actions, Run workflow) e publica os relatórios como artefato `zap-report`. Não bloqueia os PRs porque montar as imagens leva minutos.

Qualquer alerta novo falha a varredura. Os achados aceitos ficam em `infra/zap/rules.tsv`, um por linha com o motivo:

| Regra | Ação | Motivo |
|---|---|---|
| 10027 Comentários suspeitos | Ignorar | Palavras como "select" e "query" nos chunks minificados do Nuxt, não comentários. |
| 10049 Conteúdo armazenável em cache | Ignorar | Os arquivos de `/_nuxt` têm hash no nome e cache de um ano de propósito; o HTML não leva dados privados. |
| 10055 CSP com `style-src 'unsafe-inline'` | Ignorar | Necessário para os estilos do Vue e das fontes ([SEGURANCA.md](SEGURANCA.md)); remoção em #170. |
| 10096 Data Unix exposta | Ignorar | Números do payload do Nuxt parecidos com datas, não horários do servidor. |
| 10109 Aplicação web moderna | Ignorar | Informativo: o site é Nuxt. |
| 10116 ZAP desatualizado | Informar | A versão da imagem é fixa em `compose.zap.yaml`; atualize à mão quando aparecer. |
| 90004 Isolamento contra Spectre | Ignorar | O site manda `Cross-Origin-Resource-Policy: same-origin`; `Cross-Origin-Embedder-Policy: require-corp` bloquearia o mapa do Google. |

Limites: a varredura é anônima e o banco começa vazio (a imagem de produção não traz o seed), então cobre as páginas públicas, as telas das áreas logadas sem dados e os cabeçalhos de todas as respostas. A varredura no ambiente de homologação depende do deploy (#87): é o mesmo baseline com o alvo trocado, por exemplo `docker run -v "$PWD/infra/zap:/zap/wrk" ghcr.io/zaproxy/zaproxy:2.17.0 zap-baseline.py -t https://<domínio de homologação> -c rules.tsv -r reports/zap.html`.
