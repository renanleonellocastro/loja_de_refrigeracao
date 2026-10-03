# Guia de implementação

Padrões que todo código novo segue. Leia junto com [ARQUITETURA.md](ARQUITETURA.md), [API.md](API.md) e [TESTES.md](TESTES.md). Os módulos `auth` e `users` da API são a referência viva.

## API (`apps/api`)

### Estrutura de um módulo

```
src/modules/<modulo>/
  schemas.ts     Zod: entrada (pode ter transforms) e saída (sem transforms, com .meta({ id }))
  repository.ts  consultas Drizzle; único arquivo que conhece tabelas
  service.ts     superfície pública para outros módulos (reexporta do repository e funções de regra)
  <regras>.ts    regras de negócio e orquestração (ex.: users/accounts.ts), transações
  routes.ts      rotas Fastify: esquemas, permissão, códigos de estado; nenhuma regra
  *.test.ts      testes ao lado do código
```

Registre as rotas em `src/app.ts` dentro do bloco com prefixo `/api/v1`.

### Fronteiras (checadas por `pnpm depcruise`)

* Rotas não importam `repository.ts`.
* Um módulo só importa de outro módulo os arquivos `service.ts` e `schemas.ts`. Se precisar de algo interno de outro módulo, reexporte pelo `service.ts` dele.
* `src/shared` não importa módulos nem infraestrutura.
* Sem ciclos.

### Rotas

* Toda rota em `/api/v1` declara `config: { permission: '<permissão>' }` (da matriz em `packages/contracts/src/permissions.ts`) ou `config: { public: true }`. Sem isso o app não sobe.
* A permissão é checada antes da validação. Dentro do handler use `requireAuth(request)` para obter `{ userId, role, sessionId }` e `request.scope` (`all` ou `own`) para decidir se o usuário vê tudo ou só o que é dele.
* Recurso de outra pessoa responde **404**, não 403.
* Documente `tags`, `summary`, `security: [{ bearerAuth: [] }]` (quando autenticada) e `response` com `...errorResponses`.
* Criação: `201` com cabeçalho `location`. Exclusão ou ação sem corpo: `204` com `noContentSchema`.
* Listas: `pageQuerySchema` e `paginated(itemSchema)`; responda com `pageOf(rows, query, total)`.
* Edição concorrente (produto, agendamento): devolva `etag` com `etagFor(version)` no GET e chame `assertIfMatch(request.headers['if-match'], row.version)` no PATCH, incrementando `version`.
* Criações que o cliente pode repetir (pedido, venda no balcão, solicitação, orçamento): `config: { idempotent: true }`.
* Uploads: `readMultipart(request, maxFiles)` e `storeImage(ctx.storage, buffer)`; exponha imagens com `imageView()` e `imageSchema`.

### Erros

Use as fábricas de `src/shared/errors.ts` (`notFound`, `conflict`, `unprocessable`, `forbidden`...). Erros de campo vão em `extensions.errors: [{ path, message }]`, mensagens em português, do jeito que o usuário entende. Transição de estado inválida: `conflict('invalid-transition', ...)`.

### Esquemas Zod

* Esquemas de **saída não podem ter transforms** (o serializador codifica a saída). Use esquemas separados para entrada e saída quando a entrada normaliza dados (ex.: `addressSchema` e `addressViewSchema`).
* Só registre `.meta({ id })` em esquemas sem transform.
* Dinheiro sempre `*Cents` inteiro. Datas como `z.date()` na saída.

### Transações, outbox e auditoria

* Mudança de estado, evento da linha do tempo, emails (`queueEmail`) e auditoria (`recordAudit`) na **mesma transação** (`ctx.db.transaction`).
* Se um erro precisa desfazer apenas parte do trabalho (ex.: revogar sessões e responder 401), devolva o erro da transação e lance depois do commit.
* Datas de regra de negócio vêm de `ctx.clock.now()`, nunca de `new Date()`.
* Novos templates de email em `src/modules/mail/templates.ts`.

### Testes

* `useTestApp()` dá o app real com banco próprio (clonado do template migrado), relógio fixo (`t.clock`), caixa de email em memória (`t.mailer`, `t.deliverEmails()`), armazenamento em pasta temporária e `fetch` falso.
* `t.as('MANAGER')` cria um usuário do papel e devolve `{ user, headers }`.
* `multipart([...])` monta uploads; `jpeg(w, h)` gera fotos de teste.
* O teste da matriz de permissões (`src/plugins/permission-matrix.test.ts`) chama toda rota com todo papel automaticamente; não precisa repetir isso por módulo, mas teste o escopo `own` (cliente não vê dado de outro cliente).
* Cobertura de 100%: remova ramos defensivos impossíveis em vez de ignorá-los.

### Contrato

Depois de mudar rotas: `pnpm --filter @rc/contracts generate` atualiza `packages/contracts/openapi.json` e os tipos do cliente. Faça commit dos dois; o CI compara.

## Comandos úteis

```
pnpm db:up                                   PostgreSQL e Mailpit no Docker
pnpm --filter @rc/api test                   testes da API com cobertura
pnpm --filter @rc/api exec vitest run src/modules/<modulo>
pnpm --filter @rc/api db:generate --name x   migração a partir do schema.ts
pnpm --filter @rc/contracts generate         OpenAPI e cliente tipado
pnpm lint && pnpm depcruise && pnpm typecheck
```
