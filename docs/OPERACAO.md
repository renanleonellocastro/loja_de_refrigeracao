# Guia de operação

Como colocar a Refrigeração Castro no ar e mantê-la funcionando: imagens Docker, variáveis de ambiente, migrações, backups, troca de segredos, email, compressão e monitoramento. O provedor de hospedagem ainda está em aberto (ADR 0012); este guia vale para qualquer servidor Linux com Docker.

## 1. Visão geral

```mermaid
flowchart LR
  Navegador -->|HTTPS| Caddy
  Caddy -->|/api, /health, /ready| API
  Caddy -->|demais caminhos| Site
  API --> PostgreSQL
  Worker --> PostgreSQL
  Worker -->|SMTP| Email[Provedor de email]
  API --> Arquivos[(Volume de fotos)]
```

| Serviço | Imagem | O que faz |
|---|---|---|
| `caddy` | `caddy:2-alpine` | HTTPS automático com Let's Encrypt, compressão zstd e gzip, encaminha `/api/*`, `/health` e `/ready` para a API e o resto para o site |
| `api` | `infra/docker/api.Dockerfile` | API REST em `:3001`; aplica as migrações pendentes ao iniciar |
| `worker` | mesma imagem da API, comando `node dist/worker.js` | envia os emails do outbox e vence orçamentos a cada hora |
| `web` | `infra/docker/web.Dockerfile` | site Nuxt renderizado no servidor em `:3000` |
| `postgres` | `postgres:17-alpine` | banco de dados, volume `postgres-data` |

As fotos de produtos e serviços ficam no volume `storage`, montado em `/data/storage` na API e no worker.

## 2. Deploy com Docker

### Primeira vez

1. Aponte o domínio (registro A ou AAAA) para o servidor e libere as portas 80 e 443.
2. Instale o Docker com o plugin Compose e clone o repositório.
3. Crie o arquivo de configuração a partir do modelo e preencha os valores (seção 3):

   ```
   cp infra/env.production.sample infra/.env.production
   chmod 600 infra/.env.production
   ```

4. Construa as imagens e suba tudo:

   ```
   docker compose -f infra/compose.production.yaml --env-file infra/.env.production up -d --build
   ```

5. Confira: `curl https://SEU_DOMINIO/ready` deve responder `{"status":"ready"}`.
6. Crie o super usuário (seção 4.3).

### Atualizar para uma nova versão

```
git pull
docker compose -f infra/compose.production.yaml --env-file infra/.env.production up -d --build
```

A API aplica as migrações novas ao iniciar; o Compose só troca os containers que mudaram. Faça um backup antes de versões com migrações (seção 5).

### Imagens prontas em vez de construir no servidor

As imagens podem ser construídas em outra máquina e publicadas num registro:

```
docker build -f infra/docker/api.Dockerfile -t ghcr.io/renanleonellocastro/refrigeracao-castro-api:1.0.0 .
docker build -f infra/docker/web.Dockerfile -t ghcr.io/renanleonellocastro/refrigeracao-castro-web:1.0.0 .
```

Para servidores ARM (como o Oracle Cloud Always Free), use `docker buildx build --platform linux/amd64,linux/arm64 --push`. No servidor, preencha `API_IMAGE` e `WEB_IMAGE` no `.env.production` e rode `docker compose ... pull` seguido de `up -d` sem `--build`.

## 3. Variáveis de ambiente

O modelo de desenvolvimento é `infra/env.sample`; o de produção é `infra/env.production.sample`, do qual o Compose monta as variáveis de cada serviço.

| Variável | Onde | Descrição |
|---|---|---|
| `DOMAIN` | produção | domínio público, por exemplo `refrigeracaocastro.com.br`; vira `APP_ORIGIN` da API e `NUXT_PUBLIC_API_BASE` do site |
| `ACME_EMAIL` | produção | email para os avisos do Let's Encrypt |
| `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD` | produção | credenciais do banco; o Compose monta o `DATABASE_URL` com elas |
| `NODE_ENV` | API e worker | `production` em produção; nesse modo a API recusa o `JWT_SECRET` e o `DATABASE_URL` de desenvolvimento e liga cookies seguros |
| `TZ` | todos | `America/Sao_Paulo` |
| `HOST`, `PORT` | API | interface e porta, padrão `0.0.0.0:3001` |
| `LOG_LEVEL` | API | `info` em produção; `debug` só para investigar |
| `APP_ORIGIN` | API | origem do site, usada em CORS e nos links dos emails |
| `DATABASE_URL` | API e worker | conexão com o PostgreSQL |
| `JWT_SECRET` | API | segredo dos tokens de acesso, com pelo menos 32 caracteres (seção 6) |
| `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS` | API | validade do token de acesso (padrão 900 segundos) e da sessão (padrão 30 dias) |
| `COOKIE_SECURE`, `TRUST_PROXY` | API | ligados por padrão em produção; só mude se não houver HTTPS na frente |
| `SMTP_URL` | worker | servidor de envio de emails (seção 7) |
| `MAIL_FROM` | worker | remetente dos emails |
| `STORAGE_PATH` | API e worker | pasta das fotos; `/data/storage` nas imagens |
| `NUXT_PUBLIC_API_BASE` | site | endereço público da API, lido quando o container inicia |

`STORAGE_DRIVER` aparece no modelo de desenvolvimento, mas hoje só existe o armazenamento em disco (ADR 0010).

## 4. Banco de dados

### 4.1 Migrações

As migrações SQL ficam em `apps/api/drizzle` e são aplicadas pela própria API ao iniciar, em ordem e uma única vez. Para criar uma nova durante o desenvolvimento, altere `apps/api/src/infra/db/schema.ts` e rode `pnpm --filter @rc/api db:generate`. Migrações nunca são editadas depois de publicadas.

### 4.2 Dados de exemplo só em desenvolvimento

`pnpm --filter @rc/api seed` cria categorias, produtos, tipos de serviço e as contas de exemplo com a senha conhecida `Castro-Dev-2026`. O script se recusa a rodar com `NODE_ENV=production` e a imagem de produção nem traz o código fonte necessário para executá-lo. Nunca aponte o seed para o banco de produção.

### 4.3 Primeiro super usuário

Em produção o banco começa vazio. Crie o super usuário direto no banco e use a recuperação de senha do site para definir a senha:

```
docker compose -f infra/compose.production.yaml --env-file infra/.env.production exec postgres \
  psql -U castro -d castro -c "INSERT INTO users (role, name, email, cpf, search_text, email_verified_at) VALUES ('ADMIN', 'Eduardo Castro', 'eduardo@refrigeracaocastro.com.br', '00000000000', 'eduardo castro', now());"
```

Troque nome, email e CPF pelos reais. Depois acesse `/esqueci-minha-senha` com esse email; o restante da equipe é cadastrado pela tela de Colaboradores e Gerentes, com convite por email.

## 5. Backups e restauração do PostgreSQL

### Backup diário

Um dump compactado por dia, guardado fora do servidor. Exemplo de script em `/opt/castro/backup.sh`:

```
#!/bin/sh
set -eu
cd /opt/castro/loja_de_refrigeracao
STAMP=$(date +%Y%m%d_%H%M)
docker compose -f infra/compose.production.yaml --env-file infra/.env.production exec -T postgres \
  pg_dump -U castro -d castro --format=custom > /opt/castro/backups/castro_$STAMP.dump
docker run --name castro-storage-backup -v refrigeracao-castro-prod_storage:/data:ro -v /opt/castro/backups:/out alpine \
  tar czf /out/storage_$STAMP.tar.gz -C /data .
docker container rm castro-storage-backup
find /opt/castro/backups -mtime +30 -delete
```

Agende com `crontab -e`: `30 3 * * * /opt/castro/backup.sh`. Copie a pasta `/opt/castro/backups` para outro lugar (rclone para um bucket, por exemplo). Mantenha 30 dias locais e pelo menos 12 meses no destino externo.

### Restaurar

1. Pare quem escreve no banco: `docker compose ... stop api worker`.
2. Restaure o dump, recriando os objetos:

   ```
   docker compose -f infra/compose.production.yaml --env-file infra/.env.production exec -T postgres \
     pg_restore -U castro -d castro --clean --if-exists < castro_20261005_0330.dump
   ```

3. Restaure as fotos, se preciso: `tar xzf storage_20261005_0330.tar.gz` dentro do volume `storage`.
4. Suba de novo: `docker compose ... start api worker` e confira `/ready`.

Teste a restauração a cada três meses num banco descartável; backup que nunca foi restaurado não é backup.

## 6. Trocar o JWT_SECRET

O `JWT_SECRET` assina só os tokens de acesso, que valem 15 minutos. As sessões usam refresh tokens opacos guardados como hash no banco e não dependem dele. Para trocar:

1. Gere um segredo novo: `openssl rand -base64 48`.
2. Atualize `JWT_SECRET` no `infra/.env.production`.
3. Recrie a API: `docker compose -f infra/compose.production.yaml --env-file infra/.env.production up -d api`.

Quem estava logado recebe um `401` na próxima chamada e o site renova a sessão sozinho com o refresh token, sem pedir senha. Troque o segredo uma vez por ano e sempre que ele possa ter vazado. Se houver suspeita de sessões roubadas, revogue todas no banco: `UPDATE sessions SET revoked_at = now() WHERE revoked_at IS NULL;` (todos precisarão entrar de novo).

## 7. Email (SMTP)

O worker envia os emails (boas vindas, convites, recuperação de senha, pedidos, agendamentos, orçamentos) pelo servidor de `SMTP_URL`. Em desenvolvimento ele aponta para o Mailpit.

1. Escolha um provedor transacional (Amazon SES, Brevo, Mailgun, Postmark ou o SMTP do provedor do domínio).
2. Configure SPF, DKIM e DMARC do domínio conforme as instruções do provedor; sem isso os emails caem no spam.
3. Preencha `SMTP_URL` no formato `smtps://USUARIO:SENHA@smtp.provedor.com:465` (ou `smtp://...:587`, que usa STARTTLS). Caracteres especiais da senha precisam de codificação de URL (`@` vira `%40`).
4. Ajuste `MAIL_FROM` para um endereço do domínio verificado.
5. Recrie o worker e teste com "Esqueci minha senha".

Falhas de envio não se perdem: ficam no outbox e são tentadas de novo com espera crescente, até 8 vezes (ADR 0009). Para ver o que está pendente: `SELECT topic, attempts, last_error FROM outbox WHERE processed_at IS NULL;`.

## 8. Compressão no proxy

O Caddy comprime as respostas com `encode zstd gzip` (`infra/caddy/Caddyfile`). Os arquivos do site já saem do build com versões gzip e brotli e o HTML renderizado é comprimido pelo próprio Nuxt; o Caddy não comprime de novo o que já chega com `Content-Encoding`. Assim as respostas JSON da API também saem compactadas. Se trocar o Caddy por outro proxy (nginx, Traefik), ligue gzip ou brotli para `application/json`, `text/html`, `text/css`, `application/javascript` e `image/svg+xml`.

## 9. Monitoramento

| Caminho | Responde | Uso |
|---|---|---|
| `GET /health` | `200 {"status":"ok"}` enquanto o processo da API está de pé | verificação de vida; healthcheck da imagem |
| `GET /ready` | `200 {"status":"ready"}` quando o banco responde, `503 {"status":"unavailable"}` quando não | verificação de prontidão; é o que o monitor externo deve olhar |

Recomendações:

* Um monitor externo gratuito (UptimeRobot, Better Stack ou Healthchecks.io) chamando `https://SEU_DOMINIO/ready` e a página inicial a cada 5 minutos, com alerta por email ou WhatsApp.
* `docker compose ... ps` mostra o estado de saúde de cada container; `docker compose ... logs -f api worker` mostra os logs em JSON (pino), com `requestId` em cada linha para cruzar com os erros que o site mostra.
* Acompanhe o espaço em disco do volume do banco, do volume de fotos e da pasta de backups.
* Rotação de logs do Docker: em `/etc/docker/daemon.json`, use `"log-driver": "local"` ou `json-file` com `max-size` para não encher o disco.

## 10. Checklist antes de abrir para o público

* `JWT_SECRET` e `POSTGRES_PASSWORD` gerados aleatoriamente e guardados num cofre de senhas.
* SPF, DKIM e DMARC válidos e um email de teste recebido fora do spam.
* Backup diário rodando, copiado para fora do servidor e uma restauração testada.
* Monitor externo de `/ready` ativo.
* Super usuário criado e dados da loja revisados em Configurações.
* `docs/SEGURANCA_CHECKLIST.md` revisado.
