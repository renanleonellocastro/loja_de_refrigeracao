# Manual do usuário

Guia curto dos principais fluxos do sistema da Refrigeração Castro, separado por papel. As imagens são do sistema real com os dados de exemplo do ambiente de desenvolvimento. No celular o menu da equipe fica na barra inferior (o botão Mais abre o restante); no computador ele fica na lateral esquerda.

* [Cliente](#cliente)
* [Colaborador (técnico)](#colaborador-técnico)
* [Gerente](#gerente)
* [Super usuário](#super-usuário)
* [Dúvidas comuns](#dúvidas-comuns)

## Cliente

### Criar a conta

Em **Entrar**, toque em **Criar conta**. Informe nome, email, telefone e uma senha forte e aceite a política de privacidade; CPF e endereço são opcionais e o endereço se completa sozinho pelo CEP. Você entra na hora e recebe um email de boas vindas. Se a loja cadastrou você no balcão, chega um convite por email para definir a senha.

<img src="assets/manual/cliente-criar-conta.webp" alt="Tela de criar conta no celular" width="300">

### Comprar para retirar na loja

1. Em **Produtos**, busque pelo nome ou filtre por categoria, marca, condição (novo ou usado revisado) e preço.
2. Abra o produto para ver fotos, descrição e disponibilidade e toque em **Adicionar ao carrinho**.
3. No **Carrinho**, ajuste as quantidades e toque em **Fechar pedido**. O estoque fica reservado para você.
4. Acompanhe em **Pedidos**: o pedido começa **Em análise**, passa para **Aguardando retirada** quando a loja separa e para **Retirado** no balcão. Você recebe um email a cada mudança e pode cancelar enquanto ele estiver em análise.

![Página do produto](assets/manual/cliente-produto.webp)

![Carrinho com o resumo do pedido](assets/manual/cliente-carrinho.webp)

### Pedir uma visita técnica

Em **Agendar visita** (ou no botão da página inicial), escolha o serviço, diga qual é o aparelho e descreva o problema. Mostre o problema com fotos, se puder, e marque as datas e períodos (manhã ou tarde) que ficam bons. Confira o endereço da visita e envie. A loja pode responder pela conversa da solicitação, aprova e marca o técnico; tudo aparece em **Agendamentos**, de onde também dá para cancelar até a véspera.

<img src="assets/manual/cliente-agendar.webp" alt="Formulário de agendamento no celular" width="300">

![Meus agendamentos](assets/manual/cliente-agendamentos.webp)

### Pedir um orçamento

Em **Orçamento**, escolha o tipo de serviço e descreva o que precisa (fotos ajudam). Quando a loja responde, o orçamento mostra o valor, o que está incluído e a validade. Dentro da validade você pode **aceitar**, escolhendo as datas da visita, ou **recusar**. Orçamentos não respondidos a tempo vencem sozinhos.

![Pedido de orçamento](assets/manual/cliente-orcamento.webp)

### Minha conta e privacidade

Em **Perfil** você muda seus dados, endereço e senha. Um email novo só passa a valer depois de confirmado pelo link enviado a ele. Na aba de privacidade dá para baixar todos os seus dados e excluir a conta; os pedidos e serviços ficam anônimos no histórico da loja.

![Meus pedidos](assets/manual/cliente-pedidos.webp)

## Colaborador (técnico)

### O dia de trabalho

A tela **Hoje** mostra as visitas do dia em ordem, com cliente, endereço e horário. Em **Agenda** você vê as suas visitas por mês, semana, dia ou lista.

<img src="assets/manual/colaborador-hoje.webp" alt="Visitas do dia no celular" width="300">

![Agenda do técnico](assets/manual/colaborador-agenda.webp)

### Atender e finalizar um serviço

Abra a visita para ver o problema com as fotos do cliente, o telefone e o botão de rota no mapa. Ao terminar, preencha **Finalizar serviço**: se encontrou defeito, o reparo feito e as peças trocadas, com fotos do serviço. A finalização vai para a aprovação da gerência; se ela devolver para ajuste, a visita volta para você com o motivo.

<img src="assets/manual/colaborador-atendimento.webp" alt="Atendimento com o formulário de finalização" width="300">

### Venda no balcão

Em **Balcão**, escolha o cliente (se ele ainda não tiver cadastro, peça para um gerente cadastrar), adicione os produtos e confirme. O estoque é baixado na hora e a venda entra no histórico do cliente.

![Venda no balcão](assets/manual/colaborador-balcao.webp)

### Clientes

Em **Clientes** você busca qualquer cliente por nome, email, telefone ou CPF e vê os dados de contato.

## Gerente

O gerente faz tudo o que o colaborador faz e cuida da operação da loja. O **Painel** reúne pedidos em análise, prontos para retirada, solicitações novas, orçamentos a responder, finalizações a aprovar, a agenda de hoje e os produtos com estoque baixo.

![Painel do gerente](assets/telas/painel.webp)

### Pedidos

Em **Pedidos**, filtre por situação, abra o pedido, imprima a etiqueta de separação e marque **Pronto para retirada** e depois **Retirado**. Cancelamentos pedem um motivo, que vai para o cliente.

![Fila de pedidos](assets/manual/gerente-pedidos.webp)

### Solicitações de visita e agenda

1. Em **Solicitações**, abra uma solicitação nova, converse com o cliente se faltar alguma informação e **aprove** ou **recuse** com o motivo.
2. Na solicitação aprovada, marque o técnico e o horário. A **Agenda** mostra todos os técnicos com cores diferentes e impede horários sobrepostos; dá para remarcar arrastando ou pela visita.
3. Em **Aprovações**, revise as finalizações dos técnicos e aprove com o valor cobrado ou devolva para ajuste.

![Solicitações de visita](assets/manual/gerente-solicitacoes.webp)

![Detalhe de uma solicitação](assets/manual/gerente-solicitacao.webp)

![Agenda da equipe](assets/manual/gerente-agenda.webp)

### Orçamentos

Em **Orçamentos**, abra os pedidos novos e responda com o valor, a validade em dias, o que está incluído e observações. O cliente é avisado por email e na central de notificações.

![Orçamentos](assets/manual/gerente-orcamentos.webp)

### Produtos e estoque

Em **Produtos**, cadastre e edite produtos com preço, condição e categoria, adicione fotos do produto (a primeira vira capa e dá para reordenar) e registre entradas, ajustes e perdas de estoque. Produtos abaixo do mínimo aparecem no painel.

![Gerenciar produtos](assets/manual/gerente-produtos.webp)

### Clientes

O gerente também cadastra clientes, que recebem um convite por email. O detalhe do cliente mostra os 5 últimos pedidos e as 5 últimas solicitações de serviço, cada um com link para a sua tela.

![Detalhe do cliente com os últimos pedidos e solicitações](assets/manual/gerente-cliente.webp)

## Super usuário

O super usuário faz tudo o que o gerente faz e ainda administra a equipe e a loja.

### Equipe

Em **Colaboradores** e **Gerentes**, cadastre as pessoas com CPF; elas recebem um convite por email para definir a senha. No detalhe dá para editar os dados ou excluir (os dados pessoais são apagados e o histórico fica anônimo). O detalhe do colaborador mostra os 5 últimos atendimentos.

![Lista de colaboradores](assets/manual/admin-colaboradores.webp)

![Detalhe do colaborador com os últimos atendimentos](assets/manual/admin-colaborador.webp)

### Configurações, categorias e tipos de serviço

* **Configurações:** dados da loja (endereço, telefones, WhatsApp, horários) usados no site, e o estoque mínimo padrão.
* **Categorias:** crie, renomeie, reordene e exclua categorias; ao excluir uma categoria com produtos, escolha para onde eles vão.
* **Tipos de serviço:** os serviços oferecidos no site, no agendamento e no orçamento. Cadastre e altere nome, descrição e duração estimada (de 15 a 1440 minutos); desative um serviço para tirá-lo do site sem perder o histórico e ative de novo quando quiser. Ao excluir um serviço que já foi usado em solicitações ou orçamentos, ele fica apenas desativado.

![Configurações da loja](assets/manual/admin-configuracoes.webp)

![Categorias](assets/manual/admin-categorias.webp)

### Auditoria

Em **Auditoria**, consulte quem fez cada ação administrativa (cadastros, edições, exclusões, mudanças de preço e estoque), quando e o que mudou.

![Trilha de auditoria](assets/manual/admin-auditoria.webp)

## Dúvidas comuns

* **Esqueci a senha:** em Entrar, toque em **Esqueci minha senha** e siga o link enviado por email.
* **Não recebi o email:** confira o spam. A loja pode reenviar o convite pelo cadastro da pessoa.
* **Notificações:** o sino no topo mostra os avisos de pedidos, agendamentos e orçamentos; os mesmos avisos também chegam por email.
* **Tema escuro:** o botão de tema no topo alterna entre claro, escuro e o tema do aparelho.
