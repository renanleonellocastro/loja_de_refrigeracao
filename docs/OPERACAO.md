# Guia de operação

Como colocar a Refrigeração Castro no ar e mantê-la funcionando: imagens Docker, variáveis de ambiente, migrações, backups, troca de segredos, email, compressão e monitoramento. A produção roda na Oracle Cloud gratuita, numa conta no nome do Eduardo, com entrada pelo Cloudflare Tunnel (ADR 0012, revisão de 17/10/2026); este guia vale para qualquer servidor Linux com Docker.

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
| `worker` | mesma imagem da API, comando `node dist/worker.js` | envia os emails do outbox, gera as variantes AVIF e WebP das fotos enviadas, vence orçamentos a cada hora e roda as tarefas de retenção de dados uma vez por dia (seção 4.5) |
| `web` | `infra/docker/web.Dockerfile` | site Nuxt renderizado no servidor em `:3000` |
| `postgres` | `postgres:17-alpine` | banco de dados, volume `postgres-data` |

As fotos de produtos e serviços ficam no volume `storage`, montado em `/data/storage` na API e no worker, ou em um serviço S3 compatível (seção 3.1).

## 2. Deploy com Docker

### Primeira vez

1. Aponte o domínio (registro A ou AAAA) para o servidor e libere as portas 80 e 443.
2. Instale o Docker com o plugin Compose e clone o repositório.
3. Crie o arquivo de configuração a partir do modelo e preencha os valores (seção 3):

   ```
   cp infra/env.production.sample infra/.env.production
   chmod 600 infra/.env.production
   ```

4. Baixe as imagens da versão escolhida em `IMAGE_TAG` e suba tudo (sem `IMAGE_TAG`, troque as duas linhas por `up -d --build`, que constrói no servidor):

   ```
   docker compose -f infra/compose.production.yaml --env-file infra/.env.production pull
   docker compose -f infra/compose.production.yaml --env-file infra/.env.production up -d
   ```

5. Confira: `curl https://SEU_DOMINIO/ready` deve responder `{"status":"ready"}`.
6. Crie o super usuário (seção 4.3).

### Imagens publicadas no GHCR

O workflow `.github/workflows/images.yml` constrói as duas imagens de produção para `linux/amd64` e `linux/arm64` (a VM Ampere da Oracle é arm64) e as publica no GitHub Container Registry a cada tag de versão `v*`:

| Imagem | Usada por |
|---|---|
| `ghcr.io/renanleonellocastro/refrigeracao-castro-api` | `api` e `worker` (o worker é a mesma imagem com o comando `node dist/worker.js`) |
| `ghcr.io/renanleonellocastro/refrigeracao-castro-web` | `web` |

Cada imagem recebe duas tags: a da versão (`v1.2.0`) e a do commit (`sha-1a2b3c4`). Não há `latest`: o servidor sempre diz qual versão roda. Pull requests que mexem em `infra/docker/` ou no workflow, e a execução manual pela aba Actions, constroem as duas plataformas sem publicar nada.

Para publicar uma versão:

```
git tag v1.2.0
git push origin v1.2.0
```

Custos no plano gratuito do GitHub: o repositório é público, então os minutos do Actions em runners padrão não são cobrados. O arm64 é construído por emulação (QEMU) no runner amd64; a primeira construção leva bem mais que a amd64, as seguintes reaproveitam o cache do Actions (limite de 10 GB por repositório, o mais antigo sai primeiro). No GHCR, pacotes públicos não têm limite de armazenamento nem de transferência; um pacote privado entra na cota gratuita da conta (500 MB de armazenamento e 1 GB de transferência por mês fora do Actions), que poucas versões das duas imagens em duas plataformas já ocupam. Na primeira publicação o GHCR cria os pacotes como privados: em Package settings de cada um, mude a visibilidade para pública (as imagens não têm segredos; a configuração vem do `.env.production`) ou, se ficarem privadas, apague versões antigas e faça `docker login ghcr.io` no servidor com um token que só lê pacotes.

### Atualizar para uma nova versão

Com as imagens do GHCR (recomendado no servidor ARM, sem construir nada lá):

1. Faça um backup se a versão tiver migrações (seção 5).
2. Troque `IMAGE_TAG` no `infra/.env.production` pela nova tag, por exemplo `IMAGE_TAG=v1.2.0`.
3. Baixe e suba:

   ```
   docker compose -f infra/compose.production.yaml --env-file infra/.env.production pull api worker web
   docker compose -f infra/compose.production.yaml --env-file infra/.env.production up -d
   ```

Para voltar uma versão, ponha a tag anterior em `IMAGE_TAG` e repita o passo 3; migrações já aplicadas continuam no banco, então restaure o backup se a versão nova tiver mudado o esquema de forma incompatível.

Sem `IMAGE_TAG` as imagens ficam com a tag `local` e são construídas no próprio servidor a partir do código: `git pull` seguido de `up -d --build`. A API aplica as migrações novas ao iniciar; o Compose só troca os containers que mudaram.

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
| `STORAGE_DRIVER` | API e worker | `local` (padrão, pasta `STORAGE_PATH`) ou `s3` (seção 3.1) |
| `STORAGE_PATH` | API e worker | pasta das fotos; `/data/storage` nas imagens |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | API e worker | só com `STORAGE_DRIVER=s3` (seção 3.1) |
| `SIGN_UP_LIMIT_PER_HOUR` | API | cadastros de cliente por IP por hora, padrão 10; só a stack de testes E2E aumenta |
| `NUXT_PUBLIC_API_BASE` | site | endereço público da API, lido quando o container inicia |

### 3.1 Fotos em disco ou em S3 compatível

A API grava a foto enviada (já validada pelos bytes, girada e sem EXIF) como `<chave>/original.webp` e agenda no outbox a geração das variantes. O worker escreve `<chave>/<largura>.avif` e `<chave>/<largura>.webp` nas larguras 320, 640, 960 e 1440 (nunca maiores que a foto). Enquanto o worker não termina, a rota `/api/v1/media` responde com o original, sem cache; depois, com a variante e cache de um ano (ADR 0010). O site usa `<picture>`: AVIF para quem aceita, WebP para os demais.

Com `STORAGE_DRIVER=local` (padrão) as fotos ficam em `STORAGE_PATH`. Com `STORAGE_DRIVER=s3` vão para um bucket de qualquer serviço compatível com a API S3:

| Variável | Uso |
|---|---|
| `S3_BUCKET` | nome do bucket, obrigatório; crie antes, privado (a API serve as fotos) |
| `S3_REGION` | região do serviço; padrão `us-east-1`. No Cloudflare R2 use `auto` |
| `S3_ENDPOINT` | vazio na AWS; endereço do serviço nos demais |
| `S3_FORCE_PATH_STYLE` | `true` põe o bucket no caminho da URL; quando vazio, liga sozinho se houver `S3_ENDPOINT` |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | chave de acesso com leitura, escrita, listagem e remoção no bucket; as duas juntas ou nenhuma (aí vale a cadeia padrão do SDK, como o papel da instância) |

Exemplos de `S3_ENDPOINT`:

* Oracle Object Storage: `https://<namespace>.compat.objectstorage.<região>.oraclecloud.com`, com chave de "Customer Secret Keys" e a região do bucket em `S3_REGION`.
* Cloudflare R2: `https://<id da conta>.r2.cloudflarestorage.com`, `S3_REGION=auto`.
* MinIO ou SeaweedFS local: `http://localhost:9000`.

Para migrar de `local` para `s3`, copie o conteúdo do volume `storage` para o bucket mantendo os caminhos (por exemplo `rclone copy /data/storage remoto:bucket`) e só então troque a variável. Com S3 o backup das fotos é o do próprio serviço (versionamento ou replicação do bucket); o `tar` do volume da seção 5 deixa de ser necessário.

## 4. Banco de dados

### 4.1 Migrações

As migrações SQL ficam em `apps/api/drizzle` e são aplicadas pela própria API ao iniciar, em ordem e uma única vez. Para criar uma nova durante o desenvolvimento, altere `apps/api/src/infra/db/schema.ts` e rode `pnpm --filter @rc/api db:generate`. Migrações nunca são editadas depois de publicadas.

### 4.2 Dados de exemplo só em desenvolvimento

`pnpm --filter @rc/api seed` cria categorias, produtos com fotos, tipos de serviço, as contas de exemplo com a senha conhecida `Castro-Dev-2026` e clientes com pedidos, orçamentos e solicitações de serviço em todos os estados. O seed dos testes E2E carrega só a parte básica, sem esse movimento. O script se recusa a rodar com `NODE_ENV=production` e a imagem de produção nem traz o código fonte necessário para executá-lo. Nunca aponte o seed para o banco de produção.

### 4.3 Primeiro super usuário

Em produção o banco começa vazio. Crie o super usuário direto no banco e use a recuperação de senha do site para definir a senha:

```
docker compose -f infra/compose.production.yaml --env-file infra/.env.production exec postgres \
  psql -U castro -d castro -c "INSERT INTO users (role, name, email, cpf, search_text, email_verified_at) VALUES ('ADMIN', 'Eduardo Castro', 'eduardo@refrigeracaocastro.com.br', '00000000000', 'eduardo castro', now());"
```

Troque nome, email e CPF pelos reais. Depois acesse `/esqueci-minha-senha` com esse email; o restante da equipe é cadastrado pela tela de Colaboradores e Gerentes, com convite por email.

### 4.4 Trilha de auditoria somente de inserção

A tabela `audit_logs` aceita só `INSERT` e `SELECT`: um gatilho no banco (migração `0005_audit_logs_append_only.sql`) recusa qualquer `UPDATE` ou `DELETE`, inclusive feito à mão pelo `psql`. A exclusão de conta pela LGPD anonimiza o usuário e mantém as entradas da auditoria, que passam a apontar para a conta anonimizada. A API e as migrações usam o mesmo usuário do banco (`POSTGRES_USER`), dono das tabelas; por isso não há `REVOKE` separado, e o `TRUNCATE` continua possível para esse dono (os testes o usam para limpar o banco). Nunca rode `TRUNCATE` ou `DROP` em `audit_logs` na produção.

### 4.5 Retenção de dados (LGPD)

O worker roda as tarefas de retenção ao iniciar e depois uma vez por dia, com os prazos de `docs/SEGURANCA.md` seção 6:

| O que | Quando sai | Como |
| --- | --- | --- |
| Sessões de login | 30 dias depois de expirarem ou de serem encerradas | linhas apagadas de `sessions` |
| Fotos de serviços | 5 anos depois de o serviço chegar a um estado final (concluído, recusado ou cancelado) | linhas de `media` do serviço e do relatório da visita apagadas; o arquivo sai do `storage` quando nenhuma outra foto usa a mesma chave |

O código fica em `apps/api/src/modules/retention`. Os dados do serviço (pedido, relatório, valores) continuam no banco para o histórico e as obrigações fiscais. A trilha de auditoria (seção 4.4) nunca é apagada por essas tarefas. Uma falha aparece no log do worker como `data retention failed` e a tarefa tenta de novo no dia seguinte.

## 5. Backups e restauração

### O que o backup guarda

`infra/backup/backup.sh` (ou `make backup`) cria uma pasta datada, por exemplo `backups/20261107_033000/`, com:

| Arquivo | Conteúdo |
|---|---|
| `db.dump` | `pg_dump` no formato custom (já compactado) |
| `counts.tsv` | linhas de cada tabela, contadas no mesmo snapshot do dump |
| `storage.tar.gz` | as fotos do volume `storage` (fica de fora com `BACKUP_STORAGE=none`, quando as fotos estão em S3) |
| `SHA256SUMS` | somas de verificação dos arquivos acima |

O dump e a contagem saem da mesma transação `REPEATABLE READ` (o `psql` exporta o snapshot e roda o `pg_dump` com ele), então batem mesmo com o site recebendo pedidos durante o backup. Depois o script apaga as pastas locais mais velhas que `BACKUP_RETENTION_DAYS` dias e, só se houver destino configurado, copia a pasta nova para fora do servidor.

Configuração, por variáveis de ambiente ou pelas linhas `BACKUP_*` do `infra/.env.production` (o ambiente tem prioridade; escreva os valores sem aspas):

| Variável | Padrão | Uso |
|---|---|---|
| `BACKUP_DIR` | `backups` na raiz do repositório | onde ficam as pastas; em produção, `/opt/castro/backups` |
| `BACKUP_RETENTION_DAYS` | `30` | dias de retenção local |
| `BACKUP_STORAGE` | `volume` | `none` quando `STORAGE_DRIVER=s3` (o bucket guarda as fotos, seção 3.1) |
| `BACKUP_RCLONE_REMOTE` | vazio | destino fora do servidor no formato do rclone, `remoto:bucket/pasta`; vazio desliga a cópia |
| `BACKUP_RCLONE_ENV_FILE` | vazio | arquivo com as variáveis `RCLONE_CONFIG_<REMOTO>_*` desse destino |
| `BACKUP_COMPOSE` | Compose de produção com `infra/.env.production` | comando do Compose da stack; o teste usa a stack descartável |

### Destino fora do servidor

A cópia usa a imagem oficial do rclone, sem instalar nada no servidor, e serve para qualquer destino que o rclone conheça. Ainda não há destino configurado: falta criar a conta e o bucket (a ADR 0012 prevê o Cloudflare R2 da loja). Exemplo para um serviço S3 compatível, num arquivo `/opt/castro/rclone.env` com `chmod 600`:

```
RCLONE_CONFIG_OFFSITE_TYPE=s3
RCLONE_CONFIG_OFFSITE_PROVIDER=Cloudflare
RCLONE_CONFIG_OFFSITE_ENDPOINT=https://<id da conta>.r2.cloudflarestorage.com
RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID=...
RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY=...
RCLONE_CONFIG_OFFSITE_NO_CHECK_BUCKET=true
```

e no `infra/.env.production`: `BACKUP_RCLONE_REMOTE=offsite:refrigeracao-castro-backups` e `BACKUP_RCLONE_ENV_FILE=/opt/castro/rclone.env`. Para Oracle Object Storage, troque `PROVIDER` por `Other` e o endpoint pelo da seção 3.1; para Backblaze B2 ou Google Drive, use o tipo do rclone correspondente. A chave deve enxergar só esse bucket. A retenção no destino (pelo menos 12 meses) é uma regra de ciclo de vida do próprio bucket.

### Agendar

Com `crontab -e`:

```
30 3 * * * cd /opt/castro/loja_de_refrigeracao && infra/backup/backup.sh >> /opt/castro/backups/backup.log 2>&1
```

### Teste de restauração

`make restore-test BACKUP=backups/20261107_033000` (ou `infra/backup/restore-test.sh <pasta>`) nunca toca na stack:

1. confere o `SHA256SUMS`;
2. restaura o `db.dump` num PostgreSQL novo, num container próprio que é removido no fim;
3. compara as linhas de cada tabela com o `counts.tsv`;
4. sorteia uma foto da tabela `media` restaurada e confere que o `storage.tar.gz` tem o original dela e que ele é um WebP de verdade.

Qualquer diferença termina com erro. Rode no servidor uma vez por mês sobre o backup mais recente; backup que nunca foi restaurado não é backup.

`make backup-test` faz o ciclo completo numa stack descartável: constrói a imagem da API, sobe PostgreSQL e API com `infra/backup/compose.backup-test.yaml` sobre o Compose de produção, preenche banco e fotos com os dados de exemplo do seed de desenvolvimento, roda o `backup.sh` e o `restore-test.sh` e apaga tudo, inclusive os volumes. O workflow `.github/workflows/backup.yml` roda o mesmo toda segunda feira, sob demanda e em pull requests que mexem em `infra/backup/`.

### Restaurar na produção

1. Pare quem escreve no banco: `docker compose ... stop api worker`.
2. Restaure o dump, recriando os objetos:

   ```
   docker compose -f infra/compose.production.yaml --env-file infra/.env.production exec -T postgres \
     pg_restore -U castro -d castro --clean --if-exists < backups/20261107_033000/db.dump
   ```

3. Restaure as fotos, se preciso:

   ```
   docker compose -f infra/compose.production.yaml --env-file infra/.env.production run --rm --no-deps -T api \
     tar -xzf - -C /data/storage < backups/20261107_033000/storage.tar.gz
   ```

4. Suba de novo: `docker compose ... start api worker` e confira `/ready`.

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
* Backup diário rodando, `BACKUP_RCLONE_REMOTE` configurado e um `make restore-test` aprovado no servidor.
* Monitor externo de `/ready` ativo.
* Super usuário criado e dados da loja revisados em Configurações.
* `docs/SEGURANCA_CHECKLIST.md` revisado.
