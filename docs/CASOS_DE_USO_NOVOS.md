# Casos de uso complementares

Casos de uso que faltavam em [`definicao.md`](../definicao.md) para o sistema funcionar de ponta a ponta. Seguem o mesmo formato do documento original. Os requisitos correspondentes estão em [REQUISITOS.md](REQUISITOS.md).

### Autenticar

Os atores com acesso a essa funcionalidade são: Cliente, Colaborador, Gerente e Super usuário.

1.  O usuário executa a funcionalidade **Entrar**.
2.  O sistema exibe um formulário com **Email** e **Senha**, a opção **Mostrar senha** e o link **Esqueci minha senha**.
3.  O usuário preenche e clica em **Entrar**.
4.  O sistema autentica o usuário e o leva para a página de onde ele veio (por exemplo, o carrinho) ou para a página inicial do seu papel: catálogo para o cliente, agenda do dia para o colaborador, painel para gerente e super usuário.
5.  Fluxo alternativo: credenciais inválidas. O sistema exibe "Email ou senha incorretos" sem dizer qual dos dois está errado. Após 5 tentativas em 15 minutos o login daquele email fica bloqueado por 15 minutos.
6.  A sessão é renovada automaticamente enquanto o usuário usa o sistema. Após 30 dias sem uso, é encerrada.
7.  O usuário clica em **Sair** e a sessão é encerrada neste dispositivo.
8.  Fim da funcionalidade.

### Recuperar Senha

Os atores com acesso a essa funcionalidade são: Cliente, Colaborador, Gerente e Super usuário.

1.  O usuário clica em **Esqueci minha senha**.
2.  O sistema pede o **Email**.
3.  O sistema exibe sempre a mesma mensagem: "Se o email estiver cadastrado, você receberá um link em instantes", exista ou não a conta.
4.  O usuário recebe um email com um link válido por 30 minutos e de uso único.
5.  O usuário abre o link, informa **Nova senha** e **Confirmação**.
6.  O sistema altera a senha, encerra todas as sessões abertas do usuário e o autentica.
7.  Fim da funcionalidade.

### Alterar Senha

Os atores com acesso a essa funcionalidade são: Cliente, Colaborador, Gerente e Super usuário.

1.  No perfil, o usuário clica em **Trocar senha**.
2.  O sistema pede **Senha atual**, **Nova senha** e **Confirmação**, mostrando a força da nova senha.
3.  O sistema altera a senha, encerra as outras sessões e envia um email avisando da troca.
4.  Fim da funcionalidade.

### Editar Perfil

Os atores com acesso a essa funcionalidade são: Cliente, Colaborador, Gerente e Super usuário.

1.  No perfil, o usuário clica em **Editar**.
2.  O sistema exibe **Nome completo, Email, Telefone, CEP, Rua, Número, Complemento, Bairro, Cidade, UF**.
3.  Ao digitar o CEP, o sistema preenche rua, bairro, cidade e UF automaticamente.
4.  O usuário clica em **Salvar**. Se o email mudou, o novo email precisa ser confirmado por link antes de valer para o login.
5.  Fim da funcionalidade.

### Exportar Meus Dados e Excluir Minha Conta

Os atores com acesso a essa funcionalidade são: Cliente.

1.  No perfil, em **Privacidade**, o cliente clica em **Baixar meus dados** e recebe um arquivo JSON com tudo o que o sistema guarda sobre ele.
2.  O cliente clica em **Excluir minha conta**, confirma digitando a senha.
3.  O sistema anonimiza os dados pessoais, mantém pedidos e serviços sem identificação e encerra a sessão.
4.  Fim da funcionalidade.

### Cadastrar, Consultar e Excluir Gerente

Os atores com acesso a essa funcionalidade são: Super usuário.

1.  Igual aos casos de uso de Colaborador em `definicao.md`, com os dados **Nome completo, Email, Telefone, CPF, Endereço**.
2.  O gerente recebe um convite por email para definir a senha.
3.  A exclusão desativa o acesso imediatamente e anonimiza os dados pessoais, mantendo o histórico das ações.
4.  Fim da funcionalidade.

### Gerenciar Categorias

Os atores com acesso a essa funcionalidade são: Super usuário.

1.  O usuário acessa **Configurações > Categorias**.
2.  O sistema lista as categorias com a quantidade de produtos em cada uma.
3.  O usuário cadastra, renomeia, reordena ou exclui uma categoria.
4.  Categoria com produtos não pode ser excluída; o sistema oferece mover os produtos para outra categoria antes.
5.  Fim da funcionalidade.

### Editar Produto

Os atores com acesso a essa funcionalidade são: Gerente e Super usuário.

1.  Nos detalhes do produto, o usuário clica em **Editar**.
2.  O sistema exibe o formulário de Cadastrar Produto preenchido, com a galeria de fotos (adicionar, remover, arrastar para ordenar, escolher a capa).
3.  O usuário clica em **Salvar**. Se outra pessoa alterou o produto nesse meio tempo, o sistema avisa e mostra as diferenças em vez de sobrescrever.
4.  Fim da funcionalidade.

### Movimentar Estoque

Os atores com acesso a essa funcionalidade são: Gerente e Super usuário.

1.  Nos detalhes do produto, o usuário clica em **Movimentar estoque**.
2.  O sistema pede **Tipo (Entrada, Ajuste, Perda), Quantidade, Motivo**.
3.  O sistema registra a movimentação com autor e data e atualiza a quantidade disponível.
4.  O histórico de movimentações e reservas fica visível nos detalhes do produto.
5.  Quando a quantidade disponível fica abaixo do mínimo do produto, o painel mostra o alerta de estoque baixo.
6.  Fim da funcionalidade.

### Gerenciar Carrinho

Os atores com acesso a essa funcionalidade são: Visitante, Cliente, Colaborador, Gerente e Super usuário.

1.  O usuário clica em **Adicionar ao carrinho** em um produto disponível.
2.  O ícone do carrinho mostra a quantidade de itens.
3.  No carrinho, o usuário altera quantidades (limitadas ao disponível) ou remove itens e vê o total.
4.  O carrinho do visitante fica no navegador e é unido ao carrinho da conta quando ele entra.
5.  O usuário clica em **Fechar pedido** e segue para Comprar Produto.
6.  Fim da funcionalidade.

### Gerenciar Pedidos

Os atores com acesso a essa funcionalidade são: Gerente e Super usuário.

1.  O usuário acessa **Pedidos**.
2.  O sistema exibe os pedidos agrupados por estado (Em análise, Aguardando retirada, Retirado, Cancelado), com busca por número ou cliente.
3.  O usuário abre um pedido e clica em **Imprimir etiqueta** para separar o produto.
4.  O usuário clica em **Pronto para retirada** ou **Marcar como retirado**; o cliente recebe um email a cada mudança.
5.  O usuário pode **Cancelar** informando o motivo; o estoque reservado volta a ficar disponível.
6.  Fim da funcionalidade.

### Consultar Meus Pedidos

Os atores com acesso a essa funcionalidade são: Cliente, Colaborador, Gerente e Super usuário.

1.  O usuário acessa **Meus pedidos** (também visível no perfil).
2.  O sistema lista os pedidos com número, data, total e estado, do mais recente para o mais antigo.
3.  O usuário abre um pedido e vê itens, valores e a linha do tempo de estados.
4.  Enquanto o pedido estiver Em análise, o usuário pode cancelá-lo.
5.  Fim da funcionalidade.

### Responder Orçamento

Os atores com acesso a essa funcionalidade são: Gerente e Super usuário.

1.  O usuário acessa **Orçamentos** e abre um orçamento Solicitado.
2.  O sistema exibe tipo de serviço, descrição, fotos e dados do cliente, e um formulário com **Valor, Validade em dias, O que está incluído, Observações**.
3.  O usuário pode também enviar perguntas ao cliente antes de responder.
4.  O usuário clica em **Enviar orçamento**; o estado muda para Respondido e o cliente recebe um email.
5.  Fim da funcionalidade.

### Aceitar ou Recusar Orçamento

Os atores com acesso a essa funcionalidade são: Cliente.

1.  O cliente abre o orçamento Respondido pelo email ou por **Meus orçamentos**.
2.  O cliente clica em **Aceitar** ou **Recusar** (com motivo opcional).
3.  Ao aceitar, o sistema cria uma solicitação de agendamento já preenchida e pede as datas disponíveis para visita.
4.  Orçamento não respondido pelo cliente até a validade passa para Vencido automaticamente.
5.  Fim da funcionalidade.

### Consultar Meus Agendamentos

Os atores com acesso a essa funcionalidade são: Cliente.

1.  O cliente acessa **Meus agendamentos**.
2.  O sistema lista as solicitações com estado, data marcada e técnico responsável.
3.  O cliente abre uma solicitação, lê as mensagens da loja e responde.
4.  O cliente pode cancelar uma visita agendada até as 18h do dia anterior.
5.  Fim da funcionalidade.

### Painel da Equipe

Os atores com acesso a essa funcionalidade são: Colaborador, Gerente e Super usuário.

1.  Ao entrar, gerente e super usuário veem o painel com: pedidos em análise, solicitações e orçamentos pendentes, finalizações aguardando aprovação, agenda do dia por técnico, produtos com estoque baixo e faturamento de serviços aprovados no mês.
2.  O colaborador vê a própria agenda do dia e os serviços que ainda precisa finalizar.
3.  Cada indicador leva à lista filtrada correspondente.
4.  Fim da funcionalidade.

### Configurar a Loja

Os atores com acesso a essa funcionalidade são: Super usuário.

1.  O usuário acessa **Configurações > Loja**.
2.  O sistema exibe **Nome, CNPJ, Endereço, Telefones, WhatsApp, Horário de funcionamento por dia, Emails que recebem notificações, Mínimo padrão de estoque**.
3.  O usuário salva; o site público e os emails passam a usar os novos dados.
4.  Fim da funcionalidade.

### Consultar Notificações

Os atores com acesso a essa funcionalidade são: Cliente, Colaborador, Gerente e Super usuário.

1.  O ícone de sino mostra a quantidade de notificações não lidas.
2.  O usuário abre a central e vê os eventos que o envolvem (pedido pronto, nova solicitação, serviço atribuído, orçamento respondido etc.).
3.  Clicar em uma notificação marca como lida e abre o item relacionado.
4.  Fim da funcionalidade.

### Consultar Auditoria

Os atores com acesso a essa funcionalidade são: Super usuário.

1.  O usuário acessa **Configurações > Auditoria**.
2.  O sistema lista as ações administrativas com autor, data, recurso e valores antes e depois, com filtros por período, autor e tipo.
3.  Fim da funcionalidade.
