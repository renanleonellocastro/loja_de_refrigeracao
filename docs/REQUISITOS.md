# Requisitos

Este documento consolida os requisitos do sistema da Refrigeração Castro. As regras de negócio vêm de [`definicao.md`](../definicao.md) (casos de uso originais) e de [CASOS_DE_USO_NOVOS.md](CASOS_DE_USO_NOVOS.md) (casos de uso que faltavam). Onde o documento original era ambíguo ou contraditório com o código, a decisão tomada está na seção 3.

## 1. Objetivo do produto

Um sistema web único, com a cara da Refrigeração Castro, que:

* apresenta a loja e seus serviços ao público de Mogi Mirim e região e permite comprar produtos para retirada na loja;
* permite que clientes peçam reparo, manutenção e orçamentos sem precisar ligar;
* organiza a agenda dos técnicos e o ciclo completo do serviço, da solicitação até a aprovação da finalização com o valor cobrado;
* controla produtos, estoque, pedidos e vendas no balcão;
* funciona igualmente bem no computador da loja, no tablet do balcão e no celular do técnico em campo.

## 2. Atores

| Ator | Papel no sistema | Código |
|---|---|---|
| Visitante | Pessoa não autenticada. Vê o site, o catálogo e pode se cadastrar. | `GUEST` |
| Cliente | Compra produtos, solicita agendamentos e orçamentos, acompanha tudo pelo perfil. | `CLIENT` |
| Colaborador | Técnico. Consulta a própria agenda, executa e finaliza serviços, vende no balcão. | `EMPLOYEE` |
| Gerente | Opera a loja: produtos, estoque, pedidos, solicitações, agenda de todos, aprovações. | `MANAGER` |
| Super usuário | Dono do sistema. Tudo que o gerente faz, mais exclusões, cadastros de equipe e configurações. | `ADMIN` |

Os papéis são hierárquicos para leitura de dados operacionais (gerente vê o que o colaborador vê), mas cada permissão é declarada explicitamente na matriz da seção 5. Não existe regra do tipo "papel menor ou igual a".

## 3. Decisões sobre ambiguidades do documento original

| # | Ponto | Decisão proposta |
|---|---|---|
| D1 | Consultar Produtos exige login no passo 1, mas Comprar Produto parte de um usuário não autenticado. | O catálogo e os detalhes do produto são públicos. Login só é exigido para fechar o pedido. |
| D2 | Momento da baixa de estoque (documento: na confirmação; código: na conclusão). | O estoque é **reservado** na confirmação do pedido (transação atômica). Volta ao estoque se o pedido for cancelado. A saída definitiva é registrada na retirada. |
| D3 | Estados do pedido. | `EM_ANALISE` (Em análise), `AGUARDANDO_RETIRADA`, `RETIRADO`, `CANCELADO`. Venda no balcão nasce em `RETIRADO`. |
| D4 | Cadastrar Cliente no balcão (pelo gerente) sem senha. | O gerente cadastra sem senha; o sistema envia ao cliente um convite por email para definir a senha. O cliente não fica com senha fixa. |
| D5 | CPF: obrigatório no banco, ausente no formulário de cliente. | CPF opcional para cliente (exigido apenas se ele quiser nota fiscal no futuro), obrigatório e validado para colaborador e gerente. Dígitos verificadores sempre validados quando informado. |
| D6 | Solicitar Orçamento não tem fluxo de resposta da loja. | Novos casos de uso: Responder Orçamento e Aceitar ou Recusar Orçamento. Orçamento aceito pode virar solicitação de agendamento. |
| D7 | Gerente e Super usuário aparecem como atores de Solicitar Agendamento e Solicitar Orçamento. | A equipe registra a solicitação **em nome de um cliente** (atendimento por telefone ou no balcão). |
| D8 | Exclusão de cliente ou colaborador com histórico. | Exclusão lógica com anonimização dos dados pessoais (LGPD). Pedidos e serviços continuam íntegros para o histórico da loja. |
| D9 | Exclusão de produto com pedidos. | Produto com histórico é **arquivado** (some do catálogo); só é apagado de fato se nunca foi vendido. |
| D10 | Gerentes não aparecem no diagrama de casos de uso como cadastráveis. | Novo caso de uso: Cadastrar, Consultar e Excluir Gerente, exclusivo do Super usuário (a API antiga já tinha as rotas). |
| D11 | Pagamento. | Fora do escopo da versão 1: o pagamento continua acontecendo na loja, na retirada ou na conclusão do serviço. Ver questão em aberto Q5. |
| D12 | Notificações. | Email em todos os eventos descritos nos casos de uso, mais uma central de notificações dentro do sistema. WhatsApp fica como evolução (Q6). |

## 4. Requisitos funcionais

Cada requisito aponta para o caso de uso de origem. Os identificadores são usados nas issues e nos testes E2E (`test.describe('RF-12 ...')`).

### Contas e acesso

* **RF-01** Autenticar com email e senha; manter a sessão ativa sem derrubar o usuário a cada hora; sair. (UC Autenticar)
* **RF-02** Recuperar senha por link enviado ao email, com validade de 30 minutos e uso único. (UC Recuperar Senha)
* **RF-03** Alterar a própria senha informando a atual. (UC Consultar Perfil, passo 5)
* **RF-04** Cadastrar cliente pelo próprio cliente (com senha) ou pela equipe (com convite por email). Email de boas vindas com os dados do cadastro. (UC Cadastrar Cliente)
* **RF-05** Consultar clientes com busca instantânea por nome, email, telefone ou CPF, com paginação. (UC Consultar Clientes)
* **RF-06** Ver e editar o próprio perfil: nome, email, telefone, endereço com preenchimento por CEP; ver últimos pedidos, serviços e orçamentos. (UC Consultar Perfil)
* **RF-07** Excluir cliente (Super usuário) com confirmação em modal e anonimização. (UC Excluir Clientes)
* **RF-08** Cadastrar, consultar e excluir colaboradores, com últimos serviços executados. (UCs de Colaborador)
* **RF-09** Cadastrar, consultar e excluir gerentes. (UC novo)
* **RF-10** LGPD: aceite da política de privacidade no cadastro, exportar meus dados, excluir minha conta. (UC novo)

### Catálogo e estoque

* **RF-11** Gerenciar categorias de produto (Super usuário). (UC novo)
* **RF-12** Cadastrar e editar produto: nome, categoria, marca, modelo, condição (novo ou usado), descrição, preço, quantidade, fotos. (UC Cadastrar Produto)
* **RF-13** Fotos de produto: várias por produto, ordenáveis, com uma capa; otimizadas automaticamente para cada tamanho de tela.
* **RF-14** Catálogo público com busca, filtro por categoria, condição, marca e faixa de preço, ordenação e paginação; produtos sem estoque aparecem esmaecidos com o aviso "Indisponível". (UC Consultar Produtos)
* **RF-15** Página de detalhes do produto com galeria, preço, disponibilidade e ação de adicionar ao carrinho.
* **RF-16** Excluir produto (Super usuário) com confirmação; arquivar quando houver histórico. (UC Excluir Produtos)
* **RF-17** Movimentações de estoque (entrada, ajuste, perda) com motivo, autor e histórico; alerta de estoque baixo configurável por produto. (UC novo)

### Pedidos e vendas

* **RF-18** Carrinho de compras persistente entre dispositivos do mesmo usuário. (Issue #8)
* **RF-19** Fechar pedido: revisão, confirmação, reserva atômica do estoque, email para cliente, gerentes e super usuários. (UC Comprar Produto)
* **RF-20** Gestão de pedidos pela equipe: fila por estado, mudança de estado com registro de quem e quando, impressão de etiqueta de separação. (UC Comprar Produto, passos 10 a 13)
* **RF-21** Cancelar pedido: cliente enquanto `EM_ANALISE`; gerente em qualquer estado não final; estoque devolvido.
* **RF-22** Vender no balcão: selecionar produtos e cliente comprador, confirmar, baixar estoque, email ao comprador e à gerência. (UC Vender Produto)
* **RF-23** Meus pedidos e histórico de pedidos na página do usuário. (Issue #12)

### Serviços

* **RF-24** Gerenciar tipos de reparo e manutenção (Super usuário cadastra, altera e exclui; todos consultam). (UCs de tipos)
* **RF-25** Solicitar agendamento: tipo de produto, marca, modelo, descrição do problema, datas e períodos disponíveis para visita, fotos. Email para gerentes e super usuários. (UC Solicitar Agendamento)
* **RF-26** Solicitações pendentes: a equipe visualiza, conversa com o cliente (perguntas e respostas registradas), aprova ou recusa. (UC Solicitar Agendamento, passos 7 a 12)
* **RF-27** Cadastrar o serviço aprovado na agenda de um colaborador disponível, com detecção de conflito de horário; email de confirmação ao cliente. (UC Cadastrar Serviço na Agenda)
* **RF-28** Consultar agenda em visualização de mês, semana, dia e lista; colaborador vê a própria, gerente e super usuário veem a de todos com filtro por colaborador. (UC Consultar Agenda)
* **RF-29** Alterar serviço na agenda (gerente e super usuário), inclusive arrastando no desktop; excluir serviço da agenda (super usuário). (UCs Alterar e Excluir)
* **RF-30** Finalizar serviço pelo colaborador no celular: defeito encontrado, descrição do defeito, reparo realizado, fotos; estado passa a "Aguardando aprovação da finalização"; email à gerência. (UC Finalizar Serviço)
* **RF-31** Aprovar finalização informando o valor do serviço; email ao cliente com o resumo. (UC Aprovar Finalização)
* **RF-32** Meus agendamentos: o cliente acompanha o estado, responde perguntas da loja e pode cancelar até a véspera. (UC Solicitar Agendamento, passos 15 e 16)

### Orçamentos

* **RF-33** Solicitar orçamento: tipo de serviço e descrição, fotos opcionais; email ao cliente com os dados e o estado. (UC Solicitar Orçamento)
* **RF-34** Responder orçamento: valor, prazo de validade, descrição do que está incluído. (UC novo)
* **RF-35** Aceitar ou recusar orçamento; aceite gera uma solicitação de agendamento preenchida; orçamento vence automaticamente. (UC novo)

### Site, painel e operação

* **RF-36** Página inicial com a marca, serviços, produtos em destaque, localização com mapa, horário de funcionamento e botão de WhatsApp.
* **RF-37** Páginas institucionais: sobre a loja, serviços, contato e política de privacidade.
* **RF-38** Painel da equipe: pedidos por estado, solicitações e orçamentos pendentes, agenda do dia, finalizações aguardando aprovação, estoque baixo.
* **RF-39** Configurações da loja pelo Super usuário: nome, endereço, telefones, WhatsApp, horários, emails que recebem notificações.
* **RF-40** Central de notificações dentro do sistema, com contador de não lidas.
* **RF-41** Trilha de auditoria das ações administrativas (quem, o quê, quando, valores antes e depois), consultável pelo Super usuário.

## 5. Matriz de permissões

Legenda: ✔ permitido, P próprio (somente os seus registros), N em nome de um cliente, ✖ negado.

| Ação | Visitante | Cliente | Colaborador | Gerente | Super |
|---|---|---|---|---|---|
| Ver catálogo e detalhes de produto | ✔ | ✔ | ✔ | ✔ | ✔ |
| Cadastrar cliente | ✔ (a si) | ✖ | ✖ | ✔ | ✔ |
| Consultar clientes | ✖ | ✖ | ✔ | ✔ | ✔ |
| Ver e editar perfil | ✖ | P | P | P | ✔ |
| Excluir cliente | ✖ | P (própria conta) | ✖ | ✖ | ✔ |
| Cadastrar, excluir colaborador | ✖ | ✖ | ✖ | ✖ | ✔ |
| Consultar colaboradores | ✖ | ✖ | ✖ | ✔ | ✔ |
| Cadastrar, consultar, excluir gerente | ✖ | ✖ | ✖ | ✖ | ✔ |
| Gerenciar categorias | ✖ | ✖ | ✖ | ✖ | ✔ |
| Cadastrar e editar produto, fotos, estoque | ✖ | ✖ | ✖ | ✔ | ✔ |
| Excluir produto | ✖ | ✖ | ✖ | ✖ | ✔ |
| Comprar produto (pedido) | ✖ | P | P | N | N |
| Cancelar pedido | ✖ | P (em análise) | ✖ | ✔ | ✔ |
| Gerenciar fila de pedidos | ✖ | ✖ | ✖ | ✔ | ✔ |
| Vender no balcão | ✖ | ✖ | ✔ | ✔ | ✔ |
| Consultar tipos de reparo | ✔ | ✔ | ✔ | ✔ | ✔ |
| Gerenciar tipos de reparo | ✖ | ✖ | ✖ | ✖ | ✔ |
| Solicitar agendamento | ✖ | P | ✖ | N | N |
| Responder, aprovar, recusar solicitação | ✖ | ✖ | ✖ | ✔ | ✔ |
| Cadastrar e alterar serviço na agenda | ✖ | ✖ | ✖ | ✔ | ✔ |
| Excluir serviço da agenda | ✖ | ✖ | ✖ | ✖ | ✔ |
| Consultar agenda | ✖ | ✖ | P | ✔ | ✔ |
| Finalizar serviço | ✖ | ✖ | P | ✖ | ✖ |
| Aprovar finalização | ✖ | ✖ | ✖ | ✔ | ✔ |
| Solicitar orçamento | ✖ | P | ✖ | N | N |
| Responder orçamento | ✖ | ✖ | ✖ | ✔ | ✔ |
| Aceitar ou recusar orçamento | ✖ | P | ✖ | ✖ | ✖ |
| Painel da equipe | ✖ | ✖ | ✔ (visão reduzida) | ✔ | ✔ |
| Configurações da loja, auditoria | ✖ | ✖ | ✖ | ✖ | ✔ |

A matriz é implementada como dado (`packages/contracts/src/permissions.ts`) e testada de forma exaustiva: para cada rota da API e cada papel existe um teste que confirma o código HTTP esperado (ver [TESTES.md](TESTES.md)).

## 6. Requisitos não funcionais

### Experiência e responsividade

* **RNF-01** Projeto mobile first com quatro faixas: celular (360 a 767 px), tablet (768 a 1023 px), desktop (1024 a 1439 px) e telas largas (1440 px ou mais). Nenhuma tela com rolagem horizontal a partir de 320 px.
* **RNF-02** Navegação adequada a cada dispositivo: barra inferior no celular, trilho lateral no tablet, barra lateral completa no desktop (área da equipe); topo com menu recolhível no site público.
* **RNF-03** Alvos de toque com no mínimo 44 por 44 px; formulários com teclado certo em cada campo (numérico para CPF, CEP e telefone, email para email) e máscaras brasileiras.
* **RNF-04** Feedback imediato em toda ação: estados de carregamento com esqueletos, mensagens de sucesso e erro claras em português, confirmação em modal para ações destrutivas, desfazer quando possível.
* **RNF-05** Modo claro e modo escuro, seguindo a preferência do sistema, com opção manual.
* **RNF-06** Acessibilidade WCAG 2.2 nível AA: contraste, foco visível, navegação completa por teclado, rótulos, leitores de tela. Zero violações do axe em todas as telas.

### Desempenho

* **RNF-07** Core Web Vitals no percentil 75 em celular intermediário com 4G: LCP abaixo de 2,0 s, INP abaixo de 200 ms, CLS abaixo de 0,1.
* **RNF-08** Lighthouse com nota mínima de 95 em desempenho, acessibilidade, boas práticas e SEO nas páginas públicas.
* **RNF-09** JavaScript inicial das páginas públicas abaixo de 150 KB comprimido; rotas da área logada carregadas sob demanda.
* **RNF-10** API: p95 abaixo de 150 ms nas leituras e abaixo de 300 ms nas escritas com 10 mil produtos, 50 mil pedidos e 50 usuários simultâneos (teste de carga k6).
* **RNF-11** Imagens servidas em AVIF ou WebP com `srcset`, dimensões declaradas e carregamento preguiçoso fora da primeira dobra.

### Qualidade

* **RNF-12** 100% de cobertura de linhas, ramos (branches), funções e instruções no backend e no frontend, verificada no CI. Pull request que reduza a cobertura não entra.
* **RNF-13** Todo caso de uso com pelo menos um teste E2E executado nos três dispositivos (celular, tablet, desktop).
* **RNF-14** TypeScript estrito, lint e formatação sem avisos.
* **RNF-15** A especificação OpenAPI é gerada do código e o cliente do frontend é gerado dela; divergência quebra o CI.

### API RESTful

* **RNF-16** API REST versionada em `/api/v1`, recursos no plural, verbos HTTP com a semântica correta, códigos de estado corretos, erros no formato RFC 9457, paginação, filtros e ordenação padronizados, idempotência nas criações sensíveis. Detalhes em [API.md](API.md).
* **RNF-17** Toda funcionalidade do frontend é feita pela API pública documentada; não há atalhos internos. A API sozinha permite operar a loja.

### Segurança e privacidade

* **RNF-18** Senhas com Argon2id; sessão com token de acesso curto e refresh rotativo em cookie `HttpOnly`, `Secure`, `SameSite=Strict`.
* **RNF-19** Limite de tentativas no login e na recuperação de senha; cabeçalhos de segurança (CSP, HSTS, `X-Content-Type-Options`); CORS restrito à origem do site.
* **RNF-20** Uploads validados pelo conteúdo real do arquivo, nomes gerados pelo servidor, tamanho máximo de 8 MB por imagem, metadados EXIF (inclusive localização) removidos.
* **RNF-21** LGPD: base legal registrada, política de privacidade, exportação e exclusão dos dados pessoais, logs sem dados pessoais.

### Operação

* **RNF-22** Ambiente local completo em um comando; deploy reproduzível por imagens Docker.
* **RNF-23** Logs estruturados com identificador da requisição; endpoints `/health` e `/ready`; backup diário do banco com teste de restauração.
* **RNF-24** Navegadores suportados: duas últimas versões de Chrome, Edge, Firefox, Safari (macOS e iOS) e Samsung Internet.
* **RNF-25** Interface e mensagens em português do Brasil; datas no formato `dd/mm/aaaa`, moeda em reais, fuso `America/Sao_Paulo`.

## 7. Questões em aberto

Respostas registradas na issue #15. Respondidas em 03/10/2026: Q1 (não há logo nem fotos; redesenho a partir da fachada), Q2 (ver [LOJA.md](LOJA.md), endereço a confirmar) e Q8 (sim). As demais seguem com o padrão proposto até nova decisão: sem pagamento online, sem WhatsApp automatizado, sem NFS-e, hospedagem e email definidos antes do M10.

* **Q1** Logo vetorial original existe? Fotos da loja, da equipe e de serviços para o site?
* **Q2** Dados da loja: endereço completo, telefones, WhatsApp, horário, redes sociais, CNPJ.
* **Q3** Hospedagem e domínio (ADR 0012).
* **Q4** Conta de email para envio (Gmail com senha de app, Brevo ou Resend no plano gratuito).
* **Q5** Pagamento online (Pix) entra em alguma versão?
* **Q6** Notificações por WhatsApp interessam? (há o projeto `whatsapp_automatic_planner`).
* **Q7** Integrar a emissão de NFS-e dos serviços com o projeto `nfse-automatica`?
* **Q8** Produtos usados e novos convivem no mesmo catálogo, com filtro por condição? (proposta: sim)
