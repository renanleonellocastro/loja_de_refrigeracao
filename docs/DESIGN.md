# Identidade visual e design system

O sistema precisa parecer a Refrigeração Castro, não um painel genérico. A referência é a fachada da loja em Mogi Mirim: letreiro prateado em relevo sobre parede azul, com o mascote segurando a chave inglesa formando o "R" de Refrigeração.

## 1. Marca

### Logo

O arquivo atual (`imagens/logo.png`) é uma foto do letreiro. O primeiro trabalho de design é redesenhá-lo em vetor (SVG), fiel ao original:

* **Logo completo horizontal**: mascote + "EFRIGERAÇÃO" sobre "CASTRO", como na fachada.
* **Símbolo**: só o mascote com a chave, para favicon, ícone do app instalado, avatar de redes e marcador do mapa.
* **Versões**: prata com relevo sobre azul (uso principal, cabeçalho e hero), azul sobre branco, branco chapado, monocromático para impressão de etiquetas.
* **Área de respiro** igual à altura da letra "C" de CASTRO; tamanho mínimo de 120 px de largura para o logo completo e 24 px para o símbolo.

Se existir um arquivo vetorial original da fachada, ele substitui o redesenho (questão Q1 em [REQUISITOS.md](REQUISITOS.md)).

### Cores

Extraídas da foto da fachada e ajustadas para contraste AA.

| Token | Valor | Uso |
|---|---|---|
| `castro-blue-900` | `#0E2E52` | Fundo do rodapé, modo escuro |
| `castro-blue-700` | `#184E86` | **Cor principal**: cabeçalho, botões primários, links |
| `castro-blue-500` | `#2A6DB5` | Hover, destaques |
| `castro-blue-100` | `#DCE8F6` | Fundos suaves, seleção |
| `steel-300` | `#C8CCD2` | Prata do letreiro: bordas, ícones sobre azul, relevo do logo |
| `steel-600` | `#5B6470` | Texto secundário |
| `ink-900` | `#14181F` | Texto principal |
| `frost-400` | `#38BDF8` | Acento "gelo": foco, indicadores, detalhes de ilustração (frio) |
| `success-600` | `#15803D` | Concluído, disponível, retirado |
| `warning-500` | `#F59E0B` | Aguardando, estoque baixo |
| `danger-600` | `#DC2626` | Cancelado, erro, exclusão |

O amarelo `#fcba03` do protótipo é aposentado: não está na fachada. Cada estado de pedido, solicitação e orçamento tem cor e ícone fixos, usados em todo o sistema (badge de estado).

### Tipografia

* **Títulos**: Archivo (peso 800, largura expandida), que lembra as letras largas e pesadas do letreiro.
* **Texto e interface**: Inter (400, 500, 600), números tabulares em preços e tabelas.
* Fontes auto hospedadas, subconjunto latino, `font-display: swap`.
* Escala fluida com `clamp()`: corpo de 16 px no celular a 17 px no desktop; títulos de 28 px a 48 px.

### Elementos gráficos

* Superfícies com o azul da parede e um leve relevo prateado nos títulos de destaque (efeito do letreiro, só em hero e cabeçalho).
* Linhas de "ar frio" (curvas finas em `frost-400`) como detalhe decorativo de seções.
* Ícones de linha (Lucide), traço de 1,75 px, cantos arredondados.
* Fotos reais da loja, da equipe e de serviços sempre que possível (Q1); ilustrações apenas em estados vazios.

### Voz e tom

Próxima, direta e confiável, como o atendimento de balcão de uma loja de bairro que conhece o cliente pelo nome. Frases curtas, verbos no imperativo nos botões ("Pedir orçamento", "Agendar visita"), sem jargão técnico para o cliente. Erros dizem o que aconteceu e o que fazer. Exemplos:

* Vazio: "Nenhum pedido por aqui ainda. Que tal dar uma olhada nos produtos?"
* Sucesso: "Pronto! Recebemos sua solicitação. A gente responde em até 1 dia útil."
* Erro: "Não conseguimos salvar agora. Confira sua conexão e tente de novo."

## 2. Design system

Tokens em `packages/design-tokens` (fonte única) geram as variáveis CSS do Tailwind CSS v4 e as cores dos emails. Componentes em `apps/web/app/components/base`, construídos sobre primitivas acessíveis (Reka UI) e documentados no Storybook com casos de uso e testes visuais.

| Grupo | Componentes |
|---|---|
| Ações | Botão (primário, secundário, fantasma, perigo; tamanhos; carregando), botão de ícone, menu de ações |
| Formulários | Campo de texto, área de texto, senha com mostrar e força, select com busca, data e período, upload de fotos com prévia e câmera no celular, máscaras de CPF, CNPJ, telefone, CEP e dinheiro, mensagens de erro em linha |
| Exibição | Card, card de produto, badge de estado, avatar, linha do tempo, galeria com zoom e gesto de deslizar, tabela responsiva (vira lista de cards no celular), descrição em pares |
| Feedback | Toast com desfazer, alerta, diálogo de confirmação, esqueleto, estado vazio, barra de progresso |
| Navegação | Cabeçalho público, barra lateral, trilho, barra inferior, abas, migalhas, paginação, busca global da equipe |
| Agenda | Visões de mês, semana, dia e lista; cartão de serviço colorido por técnico; arrastar e soltar no desktop |

## 3. Layouts responsivos

| | Celular (até 767 px) | Tablet (768 a 1023 px) | Desktop (1024 px ou mais) |
|---|---|---|---|
| Site público | Cabeçalho compacto com menu em gaveta, botão flutuante de WhatsApp, catálogo em 2 colunas | Catálogo em 3 colunas | Cabeçalho completo, catálogo em 4 colunas com filtros laterais |
| Área do cliente | Barra inferior: Início, Produtos, Serviços, Pedidos, Perfil | Trilho lateral com ícones | Barra lateral com rótulos |
| Área da equipe | Barra inferior com as 4 ações do papel e menu "Mais"; formulários em tela cheia | Trilho lateral; listas e detalhe lado a lado | Barra lateral, painel em grade, listas com detalhe lateral |
| Agenda | Lista do dia com deslizar entre dias | Semana | Mês, semana e dia |
| Tabelas | Cards empilhados | Tabela com colunas prioritárias | Tabela completa |

Regras gerais: mobile first; contêiner máximo de 1280 px; espaçamento em múltiplos de 4 px; alvos de toque de 44 px; respeito a `prefers-reduced-motion` e às áreas seguras do iPhone.

## 4. Mapa de telas

### Público
Início · Produtos (catálogo) · Produto · Serviços · Orçamento e agendamento (chamada para entrar) · Sobre · Contato e localização · Política de privacidade · Entrar · Criar conta · Esqueci minha senha · Definir senha (convite e recuperação)

### Cliente
Carrinho · Fechar pedido · Meus pedidos · Pedido · Solicitar agendamento · Meus agendamentos · Agendamento (com conversa) · Solicitar orçamento · Meus orçamentos · Orçamento · Perfil · Privacidade · Notificações

### Colaborador
Hoje (agenda do dia) · Agenda · Serviço (com finalizar) · Venda no balcão · Clientes · Notificações · Perfil

### Gerente e Super usuário
Painel · Pedidos · Venda no balcão · Solicitações · Orçamentos · Agenda da equipe · Aprovações · Produtos · Produto (editar, fotos, estoque) · Clientes · Colaboradores · Notificações · Perfil

### Somente Super usuário
Gerentes · Categorias · Tipos de reparo · Configurações da loja · Auditoria

## 5. Emails

Templates responsivos com a marca (cabeçalho azul com o logo prateado, rodapé com endereço, telefone e WhatsApp), versão em texto puro, testados nos principais clientes de email. Um template por evento descrito nos casos de uso.
