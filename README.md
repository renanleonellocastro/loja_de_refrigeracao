# Loja de Refrigeração

Um software, de código aberto, que está em desenvolvimento utilizando a linguagem Javascript e combinação de ferramentas VUE.JS para a código que será executado no navegador e NODE.JS para o código que será executado no servidor. Tem por objetivo gerenciar uma loja de refrigeração chamada Refrigeração Castro, localizada em Mogi Mirim/SP, mas poderá servir como ponto de partida para outras lojas do segmento.

<p align="center">
  <img width="500" height="330" src="images/logo.png">
</p>

## Como Executar

O sistema ainda está em fase de planejamento, mas em breve começara a ser desenvolvido. As instruções de como executar serão adicionadas assim que o desenvolvimento começar.

## Funcionamento

O sistema funcionará contando com dois softwares na sua primeira versão. O primeiro software será desenvolvido para executar nos computadores dos clientes e funcionários da loja. Este software tem por objetivo oferecer aos clientes da loja as interfaces para cadastro de novo cliente, consulta de preços dos produtos oferecidos pela loja, agendamento de serviço de manutenção técnica e solicitação de orçamento de serviço especializado. Aos funcionários da loja, o software oferecerá as mesmas interfaces dos clientes da loja e também as interfaces de consulta de produtos no estoque, cadastramento de novos produtos, consulta da agenda de trabalho e consulta de clientes. O segundo software será desenvolvido para executar em um computador servidor e será o responsável por gerenciar todas as requisições realizadas pelos clientes e funcionários e também gerenciará o banco de dados o qual conterá todas as informações geradas após as requisições.

## Arquitetura do Sistema

O sistema será dividido em 2 subsistemas como mostrado abaixo:

- **1-) Sistema cliente**        : Interface de acesso ao sistema e envio de requisições pelos clientes e funcionários da loja.
- **2-) Sistema servidor**       : Gerente das requisições realizadas e gerente dos dados gerados pelo sistema.

## Quer contribuir?

Trata-se de um projeto de código aberto e qualquer contribuição é super bem vinda.

As tarefas estão visíveis na sessão **_Issues_** deste repositório e outras ainda estarão sendo adicionadas. Para quem deseja contribuir, basta escolher uma tarefa e realizar o **_FORK_** do projeto e então mão na massa!

Estamos abertos para tirar qualquer dúvida :).
