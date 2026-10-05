# Checklist OWASP ASVS nível 1

Revisão de segurança antes do lançamento (#86), feita em outubro de 2026 contra o [ASVS 4.0.3](https://owasp.org/www-project-application-security-verification-standard/) nível 1 e [SEGURANCA.md](SEGURANCA.md). Ficam de fora os capítulos que não se aplicam ao sistema (sem SOAP, GraphQL, WebSocket, XML, LDAP, deserialização de objetos nem dispositivos).

Legenda: **OK** atendido e verificado; **Parcial** atendido em parte, com o que falta descrito; **Pendente** depende de algo fora do código; **N/A** não se aplica.

## V1 Arquitetura

| Item | Requisito | Status | Como atendemos |
|---|---|---|---|
| 1.14.6 | Sem tecnologias inseguras do lado do cliente | OK | Sem Flash, applets ou plugins; site em Nuxt com CSP. |

## V2 Autenticação

| Item | Requisito | Status | Como atendemos |
|---|---|---|---|
| 2.1.1 | Senha com pelo menos 12 caracteres | Parcial | Mínimo de 8 (decisão de [SEGURANCA.md](SEGURANCA.md) seção 1, seguindo o NIST 800-63B) com bloqueio de senhas vazadas comuns. |
| 2.1.2, 2.1.3 | Senhas longas aceitas e sem truncamento | OK | Argon2id recebe a senha inteira; o limite é o do esquema Zod. |
| 2.1.4 | Qualquer caractere Unicode | OK | Sem restrição de alfabeto. |
| 2.1.5, 2.1.6 | Troca de senha exige a atual | OK | `PUT /me/password` confere a senha atual. |
| 2.1.7 | Senhas vazadas rejeitadas | OK | Lista de senhas comuns em `apps/api/src/modules/auth/passwords.ts`. |
| 2.1.9 | Sem regras de composição | OK | Nenhuma exigência de maiúscula, número ou símbolo. |
| 2.1.10, 2.1.11 | Sem troca periódica obrigatória; colar senha permitido | OK | Nenhuma expiração; campos aceitam colar e gerenciadores de senha. |
| 2.1.12 | Mostrar a senha digitada | OK | Botão de mostrar no campo de senha do site. |
| 2.2.1 | Proteção contra força bruta | OK | Login: 5 falhas por email e 20 por IP a cada 15 minutos (no banco). Pedido de recuperação: 5 por IP a cada 15 minutos; cadastro: 10 por IP por hora; consulta de CEP: 30 por IP por minuto. Links de convite, recuperação e confirmação usam tokens de 256 bits, inviáveis de adivinhar. |
| 2.2.3 | Aviso após mudanças de credencial | OK | Email ao trocar ou recuperar a senha. |
| 2.3.1 | Senhas iniciais aleatórias e de uso único | OK | Equipe recebe convite com link de uso único; ninguém define a senha de outra pessoa. |
| 2.4.1 | Senhas guardadas com função resistente | OK | Argon2id com os parâmetros da OWASP. |
| 2.5.1 a 2.5.4 | Recuperação segura, sem dicas nem perguntas secretas | OK | Link com token de uso único, validade curta e hash no banco; resposta 202 sempre, exista ou não a conta. |
| 2.5.6 | Recuperação não revela a conta | OK | Mesma resposta para email cadastrado ou não. |
| 2.7.x, 2.8.x | Segundo fator | N/A | Fora do escopo do nível 1 para esta loja. |

## V3 Sessão

| Item | Requisito | Status | Como atendemos |
|---|---|---|---|
| 3.1.1 | Token de sessão fora da URL | OK | Token de acesso no cabeçalho `Authorization`; refresh em cookie. |
| 3.2.1 a 3.2.3 | Token novo no login, aleatório e guardado com segurança | OK | Refresh de 256 bits, hash no banco, rotativo; token de acesso só em memória no navegador. |
| 3.3.1 | Logout invalida a sessão | OK | `DELETE /auth/sessions/current` revoga a sessão e apaga o cookie. |
| 3.3.2 | Expiração | OK | Acesso de 15 minutos; refresh de 30 dias com rotação e detecção de reuso (revoga a família). |
| 3.4.1 a 3.4.5 | Cookie `Secure`, `HttpOnly`, `SameSite`, prefixo e caminho | OK | `rc_refresh`: `HttpOnly; Secure` (produção); `SameSite=Strict; Path=/api/v1/auth`. |
| 3.5.x | Tokens sem estado | OK | JWT HS256 com segredo de 32 caracteres ou mais, obrigatório em produção. |
| 3.7.1 | Reautenticação em ações sensíveis | OK | Troca de senha e exclusão da conta pedem a senha atual. |

## V4 Controle de acesso

| Item | Requisito | Status | Como atendemos |
|---|---|---|---|
| 4.1.1, 4.1.2 | Regras aplicadas no servidor e não alteráveis pelo cliente | OK | Permissão checada no plugin de autenticação antes da validação. |
| 4.1.3 | Menor privilégio | OK | Matriz em `packages/contracts/src/permissions.ts`. |
| 4.1.5 | Negação por padrão e falha segura | OK | Rota sem permissão declarada impede o app de subir (teste em `app.test.ts`). |
| 4.2.1 | Proteção contra IDOR | OK | Verificação de posse nos serviços (pedidos, solicitações, orçamentos, agenda), com 404 para recurso alheio. Revisão por amostragem nesta entrega: `orders/orders.ts`, `services/requests.ts`, `quotes/quotes.ts`, `agenda/agenda.ts`. Teste da matriz chama toda rota com todo papel. |
| 4.2.2 | Proteção contra CSRF | OK | API autenticada por cabeçalho `Authorization`; o único cookie é `SameSite=Strict` e restrito a `/api/v1/auth`. |
| 4.3.1 | Interfaces administrativas protegidas | OK | Painel exige papel de gerente ou administrador na API. |
| 4.3.2 | Listagem de diretórios desativada | OK | Arquivos só por `/api/v1/media/{key}/{file}` com chave validada por expressão regular. |

## V5 Validação e codificação

| Item | Requisito | Status | Como atendemos |
|---|---|---|---|
| 5.1.1 a 5.1.5 | Validação positiva de toda entrada | OK | Esquemas Zod em todas as rotas, campos desconhecidos rejeitados. O Schemathesis no CI acha entradas que escapam (veja [TESTES.md](TESTES.md)). |
| 5.2.x | Sanitização | OK | Vue escapa toda saída; os dois `v-html`/`innerHTML` do site recebem SVG próprio e JSON-LD gerado com `JSON.stringify`. |
| 5.3.1 a 5.3.4 | Codificação de saída e consultas parametrizadas | OK | Drizzle com parâmetros; nenhuma SQL montada por concatenação de entrada. |
| 5.3.8, 5.3.9 | Sem injeção de comando nem LFI | OK | Nenhum `child_process` em código de produção; nome de arquivo gerado pelo servidor. |
| 5.5.x | Deserialização segura | OK | Só JSON e multipart; corpo limitado a 1 MB (8 MB por foto). |

## V7 Erros e logs

| Item | Requisito | Status | Como atendemos |
|---|---|---|---|
| 7.1.1, 7.1.2 | Logs sem credenciais nem dados pessoais | OK | `authorization` e `cookie` mascarados; erros de consulta registram só o erro do driver, sem os parâmetros (que podem ter dados pessoais). |
| 7.4.1 | Mensagem genérica em erro inesperado | OK | RFC 9457 com `requestId`; nenhum detalhe interno. Erros de dados do PostgreSQL causados pela entrada (texto com NUL, número fora da faixa) viram 422. |

## V8 Proteção de dados

| Item | Requisito | Status | Como atendemos |
|---|---|---|---|
| 8.2.1 | Sem cache de dados sensíveis | OK | Respostas autenticadas sem `Cache-Control` público; token de acesso só em memória. |
| 8.3.1 | Dados sensíveis fora da URL | OK | Senhas e tokens no corpo; os tokens de links de email são de uso único. |
| 8.3.2 | Exportação e exclusão dos dados do usuário | OK | `GET /me/data-export` e `DELETE /me` com anonimização (LGPD). |

## V9 Comunicação

| Item | Requisito | Status | Como atendemos |
|---|---|---|---|
| 9.1.1 | TLS em todo o tráfego | Pendente | Depende do provedor da ADR 0012. A API e o site já mandam HSTS de 2 anos em produção. |

## V10 Código malicioso

| Item | Requisito | Status | Como atendemos |
|---|---|---|---|
| 10.3.2 | Integridade de dependências e ações | OK | Lockfile congelado, `blockExoticSubdeps` e `trustPolicy: no-downgrade` no pnpm, espera de 7 dias para versões novas no Renovate, ações do GitHub fixadas por SHA, `pnpm audit` e gitleaks no CI. |

## V12 Arquivos

| Item | Requisito | Status | Como atendemos |
|---|---|---|---|
| 12.1.1 | Limite de tamanho | OK | 8 MB por foto e limite de quantidade por envio. |
| 12.3.1, 12.3.2 | Nome do arquivo não vem do usuário | OK | Chave por hash do conteúdo. |
| 12.4.1 | Arquivos fora da raiz web e com tipo validado | OK | Tipo detectado pelos bytes (sharp), reprocessado para WebP sem EXIF e localização; limite de pixels padrão do sharp contra bombas de descompressão. |
| 12.5.1 | Só tipos esperados servidos | OK | `/media` serve apenas `image/webp` com `nosniff`. |

## V13 API

| Item | Requisito | Status | Como atendemos |
|---|---|---|---|
| 13.1.1 | Mesma codificação em todos os componentes | OK | JSON UTF-8 e problemas em `application/problem+json`, ambos documentados na OpenAPI. |
| 13.2.1 | Métodos HTTP restritos | OK | Só os métodos registrados respondem; os demais dão 404. |
| 13.2.2 | Esquema validado antes do uso | OK | Zod em toda entrada; Schemathesis valida o contrato no CI. |

## V14 Configuração

| Item | Requisito | Status | Como atendemos |
|---|---|---|---|
| 14.2.1 | Componentes atualizados | OK | Renovate semanal com CI completo. |
| 14.3.2 | Sem modo de depuração em produção | OK | Configuração validada; sem devtools no build. |
| 14.3.3 | Cabeçalhos sem versões | OK | A API não revela versão e o site remove o `x-powered-by`. |
| 14.4.1 | `Content-Type` com charset | OK | Fastify e Nitro definem o tipo em toda resposta. |
| 14.4.3 | Content Security Policy | OK | Site: nonce por resposta com `strict-dynamic`, sem `unsafe-inline` em scripts, `frame-ancestors 'none'` (só no build de produção; o servidor de desenvolvimento do Vite precisa de scripts inline). API: `default-src 'none'`, exceto a página `/api/docs`. |
| 14.4.4 | `X-Content-Type-Options: nosniff` | OK | API e site. |
| 14.4.5 | HSTS | OK | API e site em produção, 2 anos com subdomínios. |
| 14.4.6 | `Referrer-Policy` | OK | `strict-origin-when-cross-origin` na API e no site. |
| 14.4.7 | Proteção contra enquadramento | OK | `frame-ancestors 'none'` e `X-Frame-Options: DENY`. |
| 14.5.3 | CORS restrito | OK | Só `APP_ORIGIN`, com credenciais; qualquer outra origem recebe o cabeçalho fixo e o navegador bloqueia. |
| | `Permissions-Policy` | OK | Câmera, microfone, localização, pagamento e USB desligados (o envio de fotos usa o campo de arquivo, que abre a câmera nativa sem a API do navegador). |

## Pendências fora deste PR

* Varredura com OWASP ZAP no ambiente de homologação (#86), quando o provedor da ADR 0012 estiver definido.
* TLS e certificados no provedor (9.1.1).
