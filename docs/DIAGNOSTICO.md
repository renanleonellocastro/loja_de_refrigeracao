# Diagnóstico do estado atual

Levantamento feito em 03/10/2026 sobre o `main` (último commit `7d341c9`, de 30/11/2022). Serve de ponto de partida para o replanejamento descrito em [ROTEIRO.md](ROTEIRO.md).

## 1. O que já existe

### Documentação

* `README.md`: visão geral, arquitetura em dois subsistemas (cliente e servidor), diagrama de casos de uso.
* `definicao.md`: 22 casos de uso descritos passo a passo, atores (Cliente, Colaborador, Gerente, Super usuário), prioridade dos cinco primeiros e ferramentas (JavaScript, Node.js, Vue.js, GitHub).
* `diagramas/diagrama_de_casos_de_uso.drawio` e a imagem exportada em `imagens/`.
* `imagens/logo.png`: foto da fachada da loja (letreiro prateado sobre azul, com o mascote segurando a chave inglesa formando o "R").

### Servidor (`server/`)

Node.js com Express 4, PostgreSQL via `pg` com SQL escrito à mão, JWT (`jsonwebtoken`), `bcrypt`, `multer` para upload de imagens.

| Recurso | Rotas existentes |
|---|---|
| Usuários | `POST /users` (cliente), `POST /users/employee`, `POST /users/manager`, `DELETE /users`, `DELETE /users/employee`, `DELETE /users/manager`, `POST /users/login`, `GET /users`, `GET /users/:id`, `PATCH /users/:id` |
| Categorias | `GET /categories`, `POST /categories`, `DELETE /categories` |
| Produtos | `GET /products` (filtro por nome e categoria), `GET/PATCH/DELETE /products/:id`, `GET/POST /products/:id/image`, `DELETE /products/:id/image/:imageid` |
| Pedidos | `GET /orders`, `GET /orders/user`, `GET /orders/:id`, `POST /orders`, `PATCH /orders/:id` (estado), `DELETE /orders/:id` |

Esquema em `server/database/create_database.sql`: `categories`, `users`, `products`, `productImages`, `orders`, `orderlines`. Testes apenas manuais em arquivos `.http`.

### Cliente (`client/`)

Vue 3 com Options API, Vue CLI 5 (descontinuado), Vue Router 4, `fetch` com a URL `http://localhost:3000` fixa no código. Telas: início (banner), login, cadastro de cliente, lista e detalhes de clientes, cadastro, lista e detalhes de produto (com galeria de imagens), logout automático quando o token expira. Paleta atual preto `#222` com amarelo `#fcba03`, que não corresponde à marca da loja.

### Issues

Abertas: #8 (carrinho de compras) e #12 (histórico de pedidos na página do usuário). Sem milestones.

## 2. Cobertura dos casos de uso

| Caso de uso (definicao.md) | API | Tela |
|---|---|---|
| Cadastrar Cliente | parcial (sem validação, sem email) | parcial (envia a senha fixa `doesnothave`) |
| Consultar Clientes | parcial (sem busca nem paginação) | parcial |
| Excluir Clientes | parcial (gerente também consegue, contrariando o documento) | parcial |
| Consultar Perfil do Usuário | parcial (sem troca de senha nem histórico) | parcial |
| Solicitar Agendamento de Reparo/Manutenção | não | não |
| Consultar Agenda | não | não |
| Solicitar Orçamento | não | não |
| Cadastrar Produto | sim (sem marca e modelo) | sim |
| Comprar Produto | parcial (estados diferentes do documento, sem email) | não |
| Vender Produto | parcial (só via API, sem tela) | não |
| Consultar Produtos | sim | sim |
| Excluir Produtos | sim (quebra se houver pedidos) | sim |
| Cadastrar/Consultar/Alterar/Excluir tipos de Reparo | não | não |
| Cadastrar/Alterar/Excluir serviço na agenda | não | não |
| Finalizar Serviço | não | não |
| Aprovar Finalização de Serviço | não | não |
| Cadastrar/Consultar/Excluir Colaborador | parcial (sem consulta dedicada) | não |

Resumo: aproximadamente 25% do escopo descrito está implementado, quase sempre de forma parcial. Todo o módulo de serviços (agendamento, agenda, orçamentos, finalização), que é o coração do negócio de uma refrigeração, ainda não existe.

## 3. Defeitos e riscos encontrados no código

### Segurança

1. `GET /orders/:orderid` não verifica o dono do pedido: qualquer usuário logado lê pedidos de outros (o próprio código tem um comentário sobre isso).
2. `GET /users` devolve todos os usuários com CPF, sem paginação.
3. Gerente consegue excluir clientes e cadastrar colaboradores, mas o documento restringe ao Super usuário.
4. Respostas de erro devolvem o objeto de erro do banco inteiro (`{ error: error }`), vazando detalhes internos.
5. CORS liberado para qualquer origem, configurado duas vezes; cabeçalho com nome errado (`Access-Control-Allow-Header`).
6. Token JWT guardado em `localStorage` (exposto a XSS); sem refresh, expira em 1 hora e derruba o usuário.
7. Sem limite de tentativas no login.
8. Arquivos `.http` publicados com tokens JWT e o script `teste.session.sql` com hash de senha do super usuário de teste. O repositório é público.
9. Nome do arquivo enviado montado com `originalname` do cliente; tipo do arquivo validado só pelo `mimetype` declarado.

### Corretude

1. `results.length` usado no lugar de `results.rows.length`: login com email inexistente gera erro 500 em vez de 401; produto inexistente gera 500 em vez de 404.
2. Baixa de estoque com `forEach(async ...)` sem `await` e sem transação: corrida entre pedidos simultâneos e estoque negativo possível.
3. Preço em `FLOAT`: arredondamento incorreto em valores monetários.
4. Variáveis globais implícitas (`query = ...`, `getAllProductImages = ...`), `constuctor` com erro de digitação em `utils/config.js`.
5. `GET /orders/user` lê `req.body` em uma requisição GET.
6. Códigos HTTP inconsistentes: 500 para erros de validação, 401 no lugar de 403, 201 em exclusões.
7. Exclusão de produto com pedidos falha por chave estrangeira; exclusão de usuário com pedidos também.
8. Estados do pedido no código (`NEW`, `INPROG`, `DONE`, `CANCELED`) diferentes do documento (Em análise, Aguardando Retirada, Retirado).
9. `DATABASE_URL` interpretada com `split(':')`, o que quebra com senhas contendo caracteres especiais.

### Manutenção

1. Zero testes automatizados; sem lint, sem CI.
2. Dependências sem uso (`package.json`, `randexp`, `pg-hstore`, `axios`, `json-server`).
3. Vue CLI descontinuado; Options API misturada com acesso a `$root` para estado global.
4. Branch `heroku` divergente do `main`.
5. URL da API fixa no cliente; sem variáveis de ambiente.

## 4. Conclusão

A documentação de negócio é a parte mais valiosa do repositório e é mantida como fonte dos requisitos. O código existente é um protótipo útil para entender as intenções, mas não atende aos requisitos de cobertura de 100%, segurança, desempenho e experiência. A proposta (ADR 0008) é construir a nova base em `apps/` reaproveitando o modelo de domínio, as regras e as telas como referência, e remover o código legado quando a nova base atingir paridade.
