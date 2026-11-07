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

HTTPS obrigatório com HSTS (só no build de produção); Content Security Policy sem `unsafe-inline` (o site usa nonce por resposta com `strict-dynamic`, em `apps/web/server/plugins/security-headers.ts`; a API usa `default-src 'none'`, veja abaixo); `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; `Cross-Origin-Opener-Policy` e `Cross-Origin-Resource-Policy` restritos ao próprio site; `Permissions-Policy` restritiva (câmera desligada: o envio de fotos usa o campo de arquivo, que abre a câmera nativa); CORS apenas para `APP_ORIGIN` com credenciais.

### Content Security Policy do site

`script-src 'self' 'nonce-…' 'strict-dynamic'` e `style-src 'self' 'nonce-…'`, sem `unsafe-inline`, `unsafe-eval` nem `unsafe-hashes` (`apps/web/app/utils/security.ts`). Um CSS injetado não roda, então não dá para vazar dados por seletores nem mudar a aparência da página.

* **Nonce por resposta**: o plugin do Nitro gera 16 bytes aleatórios a cada página e coloca o nonce em toda tag `<script>` e `<style>` do HTML (o CSS que o Nuxt embute no `<head>` com `features.inlineStyles`). Páginas servidas do cache do servidor (#180) recebem um nonce novo em todas as tags e em todas as diretivas do cabeçalho (`withFreshNonce`).
* **Bibliotecas**: o FullCalendar cria o próprio `<style>` e copia o nonce da primeira tag `<script nonce>` da página. As folhas de estilo dos chunks saem como `<link rel="stylesheet">` do próprio site.
* **Atributos `style` são bloqueados**. Um `:style` do Vue vira atributo no HTML do servidor, por isso os componentes não usam `:style` (o ESLint proíbe `:style` e `style=` em `apps/web/app`). Valores fixos viram classes (a máscara do logo); valores calculados usam a diretiva `v-dynamic-style` (`app/utils/dynamic-style.ts`), que não gera nada no servidor e escreve pelo CSSOM (`element.style.setProperty`) no navegador, o que a CSP permite. No navegador o próprio Vue, o Reka UI e as transições também escrevem pelo CSSOM.
* **Exceções conhecidas**: o guia `/design` renderiza só no navegador, porque os componentes do Reka UI (abas, interruptor, caixa de seleção) geram atributos `style` no servidor; numa página pública renderizada no servidor, use esses componentes só depois de alguma interação ou dentro de `<ClientOnly>`. A foto da fachada em `/sobre` usa um `<picture>` simples, porque o `<NuxtPicture>` do `@nuxt/image` gera um `onerror` inline que a CSP bloqueia.
* **Verificação**: `apps/e2e/tests/csp.spec.ts` falha com qualquer violação nas páginas principais dos três dispositivos, contra o build de produção ([TESTES.md](TESTES.md), seção 6), e o ZAP baseline (`make zap`) não aceita mais a regra 10055.

Situação item a item do ASVS nível 1 em [SEGURANCA_CHECKLIST.md](SEGURANCA_CHECKLIST.md).

## 5. Segredos e repositório

* Nenhum segredo no Git; `infra/env.sample` documenta as variáveis.
* gitleaks e Semgrep no CI; gitleaks também em hook de pre commit. Ações do GitHub fixadas por SHA.
* `pnpm audit` bloqueia o merge com alertas altos em pull requests e pushes. Exceções só para alertas sem versão corrigida que atingem apenas ferramentas de build ou desenvolvimento, listadas com justificativa em `pnpm-workspace.yaml` (`auditConfig.ignoreGhsas`) e revistas a cada atualização de dependências.
* Na execução noturna o código não mudou, então um alerta novo não reprova o CI: `infra/audit-report.sh` abre uma única issue com o rótulo `seguranca` (ou atualiza a que estiver aberta, comentando só quando aparece um alerta novo) e a fecha quando a auditoria fica limpa.
* O Dependabot (`.github/dependabot.yml`) abre toda segunda um pull request agrupado com as atualizações menores e de correção, com espera de 7 dias para versões novas, e pull requests de correção de segurança assim que um alerta é publicado.
* Os arquivos `.http` com tokens e o script com hash de senha do protótipo saem do repositório no M0. Os tokens antigos já expiraram, mas o `JWT_KEY` usado na época deve ser considerado comprometido e não reaproveitado.

## 6. LGPD

| Tema | Como atendemos |
|---|---|
| Base legal | Execução de contrato (pedidos e serviços) e legítimo interesse (histórico da loja); registrada na política de privacidade. |
| Transparência | Política de privacidade pública e aceite registrado no cadastro com data e versão. |
| Minimização | CPF só quando necessário; logs sem nome, email, telefone ou CPF. |
| Acesso e portabilidade | `GET /me/data-export` em JSON. |
| Eliminação | Exclusão da conta com anonimização; pedidos e serviços mantidos sem identificação para obrigações fiscais. |
| Retenção | Sessões expiradas ou encerradas apagadas em 30 dias; fotos de serviços finalizados (concluídos, recusados ou cancelados) há mais de 5 anos removidas; as duas tarefas rodam uma vez por dia no worker (`docs/OPERACAO.md` seção 4.5). |
| Encarregado | Contato do responsável pelos dados exibido na política (dono da loja). |

## 7. Operação

Backups diários do banco com retenção de 30 dias e teste mensal de restauração; dependências atualizadas automaticamente pelo Dependabot com o CI completo; trilha de auditoria imutável das ações administrativas.
