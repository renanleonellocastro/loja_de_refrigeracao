# API REST

A API é o produto: o site usa exatamente a mesma API pública que qualquer outro cliente usaria. A especificação OpenAPI 3.1 é gerada do código e publicada em `/api/v1/openapi.json`, com documentação navegável em `/api/docs`.

## 1. Convenções

| Tema | Regra |
|---|---|
| Base | `/api/v1`. Mudança incompatível cria `/api/v2`; campos novos não quebram clientes. |
| Recursos | Substantivos no plural em inglês (`/products`, `/orders`); sub recursos para composição (`/products/{id}/images`); ações de estado como sub recurso no singular (`POST /orders/{id}/cancellation`). |
| Recursos do usuário logado | Prefixo `/me` (`/me`, `/me/cart`, `/me/orders`). |
| Verbos | `GET` lê, `POST` cria ou dispara ação, `PATCH` altera parcialmente (JSON Merge Patch), `PUT` substitui coleções ordenadas, `DELETE` remove. |
| Formato | JSON, campos em `camelCase`, datas em ISO 8601 com fuso, dinheiro em centavos inteiros (`priceCents`), ids como inteiros. |
| Criação | `201 Created` com cabeçalho `Location` e o recurso no corpo. |
| Ação sem corpo de resposta | `204 No Content`. |
| Paginação | `?page=1&pageSize=20` (máximo 100) com resposta `{ "data": [...], "meta": { "page", "pageSize", "total" } }`; listas operacionais grandes aceitam `?cursor=`. |
| Filtros e ordenação | Parâmetros com o nome do campo (`?categoryId=2&condition=USED`), busca livre em `?q=`, ordenação em `?sort=-createdAt,name`. |
| Concorrência | Recursos editáveis por várias pessoas (produto, serviço na agenda) devolvem `ETag`; `PATCH` exige `If-Match` e responde `412` se o recurso mudou. |
| Idempotência | `POST /orders`, `POST /counter-sales`, `POST /service-requests` e `POST /quotes` aceitam `Idempotency-Key`; repetir a chave devolve a mesma resposta. |
| Erros | `application/problem+json` (RFC 9457) com `type`, `title`, `status`, `detail`, `instance`, `requestId` e, em validação, `errors: [{ "path", "message" }]` com mensagens em português. |
| Autenticação | `Authorization: Bearer <token de acesso>`. |
| Limites | Cabeçalhos `RateLimit` e `Retry-After` quando aplicável. |

### Códigos de estado usados

`200`, `201`, `204`, `304`, `400` (JSON inválido), `401` (sem autenticação), `403` (sem permissão), `404` (não existe ou não é visível para o usuário), `409` (conflito de estado ou de estoque), `412` (`If-Match` desatualizado), `413` (arquivo grande demais), `415` (tipo de arquivo não aceito), `422` (validação), `428` (`If-Match` ausente), `429` (limite de taxa), `500`.

Recurso de outro cliente responde `404`, não `403`, para não revelar existência.

### Exemplo de erro

```json
{
  "type": "https://refrigeracaocastro.com.br/problems/insufficient-stock",
  "title": "Estoque insuficiente",
  "status": 409,
  "detail": "Alguns itens não têm a quantidade pedida disponível.",
  "instance": "/api/v1/orders",
  "requestId": "01J9Z6V9F4QK3",
  "items": [{ "productId": 12, "requested": 3, "available": 1 }]
}
```

## 2. Catálogo de endpoints

### Autenticação e conta

| Método e caminho | Descrição | Acesso |
|---|---|---|
| `POST /auth/sessions` | Entrar | público |
| `POST /auth/sessions/refresh` | Renovar token | cookie de refresh |
| `DELETE /auth/sessions/current` | Sair | logado |
| `POST /auth/password-resets` | Pedir link de recuperação | público |
| `POST /auth/password-resets/{token}` | Definir nova senha | público com token |
| `POST /auth/invitations/{token}` | Aceitar convite e definir senha | público com token |
| `POST /auth/email-verifications/{token}` | Confirmar novo email | público com token |
| `GET /me` | Meu perfil | logado |
| `PATCH /me` | Editar perfil | logado |
| `PUT /me/password` | Trocar senha | logado |
| `GET /me/data-export` | Exportar meus dados (LGPD) | cliente |
| `DELETE /me` | Excluir minha conta | cliente |

### Usuários

| Método e caminho | Descrição | Acesso |
|---|---|---|
| `POST /customers` | Autocadastro de cliente | público |
| `POST /users` | Cadastro pela equipe com `role` (cliente com convite, colaborador, gerente) | gerente para cliente; super para equipe |
| `GET /users?role=&q=` | Listar e buscar | colaborador (clientes), gerente (clientes e colaboradores), super (todos) |
| `GET /users/{id}` | Detalhes com últimos pedidos e serviços | conforme matriz |
| `PATCH /users/{id}` | Editar | super |
| `DELETE /users/{id}` | Excluir com anonimização | super |
| `GET /addresses/lookup?cep=` | Consulta de CEP (ViaCEP com cache) | público, com limite de taxa |

### Catálogo e estoque

| Método e caminho | Descrição | Acesso |
|---|---|---|
| `GET /categories` | Listar | público |
| `POST /categories`, `PATCH /categories/{id}`, `DELETE /categories/{id}` | Gerenciar | super |
| `PUT /categories/order` | Reordenar | super |
| `GET /products?q=&categoryId=&condition=&brand=&minPriceCents=&maxPriceCents=&available=&sort=` | Catálogo | público |
| `GET /products/{idOrSlug}` | Detalhes | público |
| `POST /products` | Cadastrar | gerente |
| `PATCH /products/{id}` | Editar (com `If-Match`) | gerente |
| `DELETE /products/{id}` | Excluir ou arquivar | super |
| `POST /products/{id}/images` | Enviar foto (multipart) | gerente |
| `PUT /products/{id}/images/order` | Ordenar e escolher capa | gerente |
| `DELETE /products/{id}/images/{imageId}` | Remover foto | gerente |
| `GET /products/{id}/stock-movements` | Histórico de estoque | gerente |
| `POST /products/{id}/stock-movements` | Entrada, ajuste ou perda | gerente |

### Carrinho, pedidos e balcão

| Método e caminho | Descrição | Acesso |
|---|---|---|
| `GET /me/cart` | Ver carrinho | logado |
| `PUT /me/cart/items/{productId}` | Definir quantidade de um item | logado |
| `DELETE /me/cart/items/{productId}` | Remover item | logado |
| `POST /me/cart/merge` | Unir carrinho do visitante | logado |
| `POST /orders` | Fechar pedido do carrinho (ou em nome de cliente, para a equipe) | logado |
| `GET /me/orders` | Meus pedidos | logado |
| `GET /orders?status=&q=&from=&to=` | Fila de pedidos | gerente |
| `GET /orders/{id}` | Detalhes com linha do tempo | dono ou gerente |
| `POST /orders/{id}/ready-for-pickup` | Marcar pronto para retirada | gerente |
| `POST /orders/{id}/pickup` | Marcar retirado | gerente |
| `POST /orders/{id}/cancellation` | Cancelar com motivo | dono em análise, gerente |
| `GET /orders/{id}/label` | Etiqueta de separação (PDF) | gerente |
| `POST /counter-sales` | Venda no balcão | colaborador |

### Serviços

| Método e caminho | Descrição | Acesso |
|---|---|---|
| `GET /service-types` | Listar tipos | público |
| `GET /service-types/{id}` | Detalhes | público |
| `POST /service-types`, `PATCH /service-types/{id}`, `DELETE /service-types/{id}` | Gerenciar | super |
| `POST /service-requests` | Solicitar agendamento (JSON, com `Idempotency-Key`) | cliente; equipe em nome de cliente |
| `POST /service-requests/{id}/photos` | Enviar fotos do problema (multipart, até 6) | dono enquanto aberta, gerente |
| `GET /service-requests?status=&q=` | Solicitações visíveis: as suas (cliente), as atribuídas (colaborador), todas (gerente; `q` busca cliente ou número) | logado conforme matriz |
| `GET /service-requests/{id}` | Detalhes | dono, gerente, colaborador atribuído |
| `GET /service-requests/{id}/messages`, `POST /service-requests/{id}/messages` | Conversa | dono e gerente |
| `POST /service-requests/{id}/approval` | Aprovar | gerente |
| `POST /service-requests/{id}/rejection` | Recusar com motivo | gerente |
| `POST /service-requests/{id}/cancellation` | Cancelar | dono (até a véspera), gerente |
| `GET /appointments?from=&to=&employeeId=` | Agenda | colaborador (próprios), gerente |
| `POST /appointments` | Cadastrar serviço na agenda | gerente |
| `PATCH /appointments/{id}` | Alterar (com `If-Match`) | gerente |
| `DELETE /appointments/{id}` | Excluir da agenda | super |
| `POST /appointments/{id}/report` | Finalizar serviço (multipart com fotos) | colaborador atribuído |
| `POST /appointments/{id}/report/approval` | Aprovar finalização com `amountCents` | gerente |
| `POST /appointments/{id}/report/rework` | Devolver para ajuste | gerente |
| `GET /employees/availability?from=&to=` | Disponibilidade dos colaboradores | gerente |

### Orçamentos

| Método e caminho | Descrição | Acesso |
|---|---|---|
| `POST /quotes` | Solicitar | cliente; equipe em nome de cliente |
| `GET /me/quotes` | Meus orçamentos | cliente |
| `GET /quotes?status=` | Fila | gerente |
| `GET /quotes/{id}` | Detalhes | dono, gerente |
| `GET /quotes/{id}/messages`, `POST /quotes/{id}/messages` | Conversa | dono e gerente |
| `POST /quotes/{id}/answer` | Responder com valor e validade | gerente |
| `POST /quotes/{id}/acceptance` | Aceitar (cria solicitação de agendamento) | dono |
| `POST /quotes/{id}/decline` | Recusar | dono |
| `POST /quotes/{id}/cancellation` | Cancelar | dono |

### Painel, notificações e administração

| Método e caminho | Descrição | Acesso |
|---|---|---|
| `GET /dashboard` | Indicadores conforme o papel | colaborador, gerente |
| `GET /me/notifications?unread=` | Notificações | logado |
| `POST /me/notifications/{id}/read`, `POST /me/notifications/read-all` | Marcar como lidas | logado |
| `GET /store` | Dados públicos da loja (endereço, horários, contatos) | público |
| `PATCH /store` | Configurar a loja | super |
| `GET /audit-logs` | Auditoria | super |
| `GET /health`, `GET /ready` | Saúde do processo e das dependências | público (fora de `/api/v1`) |

## 3. Migração das rotas antigas

As rotas do protótipo (`/users/login`, `DELETE /users` com corpo, `PATCH /orders/:id` com estado livre etc.) não serão mantidas: não há clientes em produção que dependam delas. A tabela de correspondência fica no PR de remoção do legado.
