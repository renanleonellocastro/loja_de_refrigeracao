# Segurança e privacidade

Referência: OWASP ASVS nível 1, com itens do nível 2 em autenticação e controle de acesso, e LGPD.

## 1. Autenticação e sessão

* Senhas com Argon2id (parâmetros recomendados pela OWASP); mínimo de 8 caracteres, verificação contra lista de senhas vazadas comuns, sem regras de composição forçadas.
* Token de acesso JWT de 15 minutos assinado com HS256, mantido só em memória no navegador.
* Refresh token aleatório de 256 bits, guardado como hash no banco, rotativo, em cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`; reutilização de token antigo revoga a família inteira.
* Troca ou recuperação de senha encerra todas as outras sessões.
* Limite de 5 tentativas de login por email e 20 por IP a cada 15 minutos; mensagens que não revelam se o email existe.
* Links de convite, recuperação e confirmação de email com token de uso único, validade curta e guardado como hash.

## 2. Controle de acesso

* Negação por padrão: toda rota declara a permissão exigida; rota sem declaração não registra (teste garante).
* Verificação de posse no serviço (não só na rota): um cliente só enxerga seus pedidos, solicitações e orçamentos; um colaborador só seus serviços.
* Matriz de permissões de [REQUISITOS.md](REQUISITOS.md) testada exaustivamente.

## 3. Entrada e saída

* Toda entrada validada por esquema Zod; campos desconhecidos rejeitados.
* SQL apenas por consultas parametrizadas (Drizzle).
* Uploads: tipo detectado pelos bytes do arquivo (JPEG, PNG, WebP, HEIC convertido), até 8 MB, reprocessados com `sharp` (remove EXIF e localização), nome gerado pelo servidor, servidos com `Content-Disposition` seguro.
* Erros nunca expõem detalhes internos; o `requestId` liga a resposta ao log.

## 4. Cabeçalhos e transporte

HTTPS obrigatório com HSTS; Content Security Policy sem `unsafe-inline` em scripts; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; `Permissions-Policy` restritiva (câmera liberada só nas telas de upload); CORS apenas para `APP_ORIGIN` com credenciais.

## 5. Segredos e repositório

* Nenhum segredo no Git; `.env.example` documenta as variáveis.
* gitleaks no CI e em hook de pre commit.
* Os arquivos `.http` com tokens e o script com hash de senha do protótipo saem do repositório no M0. Os tokens antigos já expiraram, mas o `JWT_KEY` usado na época deve ser considerado comprometido e não reaproveitado.

## 6. LGPD

| Tema | Como atendemos |
|---|---|
| Base legal | Execução de contrato (pedidos e serviços) e legítimo interesse (histórico da loja); registrada na política de privacidade. |
| Transparência | Política de privacidade pública e aceite registrado no cadastro com data e versão. |
| Minimização | CPF só quando necessário; logs sem nome, email, telefone ou CPF. |
| Acesso e portabilidade | `GET /me/data-export` em JSON. |
| Eliminação | Exclusão da conta com anonimização; pedidos e serviços mantidos sem identificação para obrigações fiscais. |
| Retenção | Sessões expiradas apagadas em 30 dias; fotos de serviços concluídos há mais de 5 anos removidas por tarefa agendada. |
| Encarregado | Contato do responsável pelos dados exibido na política (dono da loja). |

## 7. Operação

Backups diários do banco com retenção de 30 dias e teste mensal de restauração; dependências atualizadas automaticamente pelo Renovate com o CI completo; trilha de auditoria imutável das ações administrativas.
