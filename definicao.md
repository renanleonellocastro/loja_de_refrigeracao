# Definição do Sistema

Este documento contém uma descrição mais detalhada de como o sistema se comporta para cada cenário de uso pelos seus usuários. Também contém informações
sobre a prioridade de implementação, desenvolvimento e produção das funcionalidades do sistema além de detalhar as ferramentas que são usadas no desenvolvimento do mesmo.


## Descrição das Funcionalidades

Esta sessão mostrará uma a uma das funcionalidades e descreverá com mais detalhes o que é realizado pelo sistema em cada umas dessas funcionalidades. O objetivo é
auxiliar o desenvolvedor a compreender o que é esperado pelo cliente na execução de cada funcionalidade, auxiliando assim o desenvolvimento da mesma.

### Cadastrar Cliente

Os atores com acesso a funcionalidade de cadastrar cliente são: Cliente, Gerente e Super usuário.

1.  O usuário executará a funcionalidade **Cadastrar Cliente**.
2.  O sistema exibe ao usuário um formulário para preenchimento dos seguintes dados: **Nome completo, E-mail, Telefone, Senha, Confirmação de Senha, Endereço**.
3.  O usuário prenche o formulário e clica no botão **Cadastrar**.
4.  O usuário é autenticado ao sistema e um e-mail é enviado para ele com os dados do seu cadastro.
5.  Fim da funcionalidade.

### Consultar Clientes

Os atores com acesso a funcionalidade de consultar clientes são: Colaborador, Gerente e Super usuário.

1.  O usuário executará a funcionalidade **Consultar Clientes**.
2.  O sistema exibe ao usuário uma lista com todos os nomes dos clientes cadastrados e exibe um campo de entrada para busca.
3.  O usuário digita o nome da pessoa no campo de busca e o sistema começará a filtrar por esse nome e diminuirá as ocorrências aparecidas na tela.
4.  O usuário seleciona na tela o nome buscado.
5.  Os seguintes dados do cliente selecionado é exibido na tela: **Nome completo, E-mail, Telefone, Endereço e Últimos serviços realizados**.
6.  Fim da funcionalidade.

### Consultar Perfil do Usuário

Os atores com acesso a funcionalidade de consultar perfil do usuário são: Cliente, Colaborador, Gerente e Super usuário.

1.  O usuário realiza a autenticação no sistema.
2.  O usuário executará a funcionalidade **Consultar Perfil do Usuário**.
3.  O sistema exibe na tela os seguintes dados do usuário: **Nome completo, E-mail, Telefone, Endereço e Últimos serviços realizados**.
4.  O sistema também exibe na tela um botão para edição dos dados **Nome completo, E-mail, Telefone e Endereço** do usuário.
5.  O sistema exibe na tela um botão para troca de senha.
6.  Fim da funcionalidade.

### Solicitar Agendamento de Reparo/Manutenção

Os atores com acesso a funcionalidade de solicitar agendamento de reparo/manutenção são: Cliente, Gerente e Super usuário.

1.  O usuário realiza a autenticação no sistema.
2.  O usuário executará a funcionalidade **Solicitar Agendamento de Reparo/Manutenção**.
3.  O sistema exibe na tela um formulário com os seguintes campos: **Tipo de Produto, Marca do Produto, Modelo do produto, Descrição do Problema, Datas Disponíveis para Visitação do Técnico, Fotos do Produto**.
4.  O usuário preenche os campos e clica no botão solicitar agendamento.
5.  O sistema exibe uma mensagem dizendo que a solicitação foi realizada com sucesso e que em breve a loja responderá.
6.  A solicitação é enviada por e-mail para os usuários do tipo gerente e super usuários.
7.  O usuário gerente acessa o sistema e clica no botão "Solicitações Pendentes".
8.  O sistema exibe ao usuário gerente todas as solicitações de agendamento realizadas.
9.  O usuário gerente clica no botão **Visualizar** referente a solicitação do usuário solicitante.
10. O usuário gerente responde a solicitação e seleciona uma data. O campo resposta/questionamentos deve ser preenchido com detalhes sobre o serviço ou novas perguntas ao usuário solicitante.
11. O usuário gerente ou super usuário clica no botão **Enviar Resposta/Questionamentos**.
12. O usuário gerente clica no botão **Aprovar Solicitação**.
13. O usuário gerente registra o serviço a ser realizado na agenda de trabalho de um colaborador que estiver disponível.
14. Um e-mail é enviado ao usuário solicitante informando a confirmação do agendamento de reparo/manutenção.
15. O usuário solicitante acessa o status atual do agendamento clicando no botão **Agendamentos**.
16. O usuário solicitante responde os questionamentos da loja visualizados no status do agendamento.
17. Fim da funcionalidade.

### Consultar Agenda

Os atores com acesso a funcionalidade de consultar agenda são: Colaborador, Gerente e Super usuário.

1.  O usuário realiza a autenticação no sistema.
2.  O usuário executará a funcionalidade **Consultar Agenda**.
3.  O usuário é do tipo colaborador e será exibido na tela os serviços agendados nas datas agendadas que devem ser realizados por este usuário.
4.  O usuário é do tipo gerente ou super usuário e será exibido na tela os serviços agendados nas datas agendadas que devem ser realizados por todos os colaboradores.
5.  Deve ser exibido a agenda em formato de mês, semana e dia. O usuário pode escolher o tipo de exibição.
6.  Fim da Funcionalidade.

### Comprar Produto

Os atores com acesso a funcionalidade de compra de produto são: Cliente, Colaborador, Gerente e Super usuário.

1.  O usuário selecionará um produto e executará a funcionalidade **Comprar Produto**.
2.  O usuário não está autenticado no sistema com as suas credenciais.
3.  É exibido uma informação para que o usuário se autentique ao sistema ou que o mesmo realize o cadastro no sistema.
4.  O usuário se autentica ao sistema.
5.  É gerada uma ordem de compra e a mesma é mostrada ao usuário para confirmação.
6.  O usuário confirma a ordem.
7.  O status do produto é atualizado para **Em análise**.
8.  O sistema subtrai a quantidade de produtos em estoque de acordo com o que foi comprado pelo cliente.
9.  Uma ordem de compra é emitida e enviada por e-mail para os usuários do tipo **Gerente**.
10. O usuário do tipo **Gerente** separa o produto na loja e o embrulha com uma etiqueta com os dados da ordem de compra.
11. O usuário do tipo **Gerente** atualiza o status do produto. O novo status do produto é **Aguardando Retirada**.
12. O usuário que executou a funcionalidade **Comprar Produto** retira o produto na loja.
13. O usuário do tipo **Gerente** atualiza o status do produto. O novo status do produto é **Retirado**.
14. Fim da funcionalidade.


## Prioridade de Desenvolvimento das Funcionalidades

Esta sessão listará as funcionalidades mais requisitadas pelo cliente e esta lista estará ordenada por prioridade de desenvolvimento, ou seja, de cima para
baixo quais funcionalidades devem ser implementadas/testadas/produzidas primeiro.

1. **Cadastrar Cliente**
2. **Consultar Clientes**
3. **Consultar Perfil do Usuário**
4. **Solicitar Agendamento de Reparo/Manutenção**
5. **Consultar Agenda**

## Ferramentas Utilizadas no Desenvolvimento

* **Javascript** - Linguagem de programação utilizada para desenvolvimento das aplicações do cliente e da loja. 
* **NodeJS**     - Framework utilizado para auxiliar no desenvolvimento da aplicação da loja que provavelmente estará funcionando em um servidor.
* **VueJS**      - Framework utilizado para auxiliar no desenvolvimento da aplicação cliente que funcionará nos navegadores dos clientes, administradores, gerentes e colaboradores da loja. 
* **GitHub**     - Ferramenta utilizada para gerir as atividades do projeto e também para gerir o armazenamento do código fonte da aplicação.
