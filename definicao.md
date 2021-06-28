# Definição do Sistema

Este documento contém uma descrição mais detalhada de como o sistema se comporta para cada cenário de uso pelos seus usuários. Também contém informações
sobre a prioridade de implementação, desenvolvimento e produção das funcionalidades do sistema além de detalhar as ferramentas que são usadas no desenvolvimento do mesmo.


## Descrição das Funcionalidades

Esta sessão mostrará uma a uma das funcionalidades e descreverá com mais detalhes o que é realizado pelo sistema em cada umas dessas funcionalidades. O objetivo é
auxiliar o desenvolvedor a compreender o que é esperado pelo cliente na execução de cada funcionalidade, auxiliando assim o desenvolvimento da mesma.

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
