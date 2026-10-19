# Padrão de qualidade do código

Vale para todo código de produção: `apps/api/src`, `apps/api/scripts`, `apps/web/app`, `apps/web/server`, `apps/web/scripts`, `packages/*`, `infra/*.mjs` e `tools/`. Testes, código gerado e migrações ficam de fora da regra de tamanho, mas seguem as regras de nomes e responsabilidade.

## Regras

1. **Toda função, método, callback, composable e store tem no máximo 12 linhas de corpo.** Conta da linha seguinte à assinatura até a linha que fecha o corpo, sem linhas em branco e sem linhas só de comentário. Assinatura em várias linhas não conta. Em componentes Vue valem as funções dentro de `<script>` e `<script setup>`; o template fica de fora, mas um template grande é sinal de que falta um subcomponente. Divida em funções auxiliares e subcomponentes com nomes claros em vez de espremer linhas: nada de vários comandos numa linha, linhas ilegíveis ou ternários gigantes para enganar a contagem.
2. **Responsabilidade única** por função, classe, módulo e componente. Uma função faz uma coisa num único nível de abstração, e o nome diz exatamente o quê.
3. **SOLID por inteiro**, não só a responsabilidade única:
   * **S**: separe busca de dados (composables), apresentação (componentes), formatação (utils), regras de domínio e persistência (repositórios).
   * **O** (aberto e fechado): comportamento novo entra por estratégia, adaptador, tabela de despacho ou composição, nunca aumentando cadeias de `if`/`else` ou `switch`.
   * **L** (Liskov): todo adaptador e todo dublê de teste cumpre o contrato inteiro da sua porta (mesmos erros, mesmas invariantes). Quando uma porta tem mais de uma implementação, os mesmos testes de contrato rodam contra todas.
   * **I** (segregação de interfaces): portas pequenas por caso de uso; componentes recebem só as props que usam; nada de serviços faz tudo nem módulos `utils` genéricos.
   * **D** (inversão de dependência): domínio e aplicação dependem de abstrações; banco, HTTP, relógio, geração de ids, aleatoriedade e variáveis de ambiente são injetados na raiz de composição (`buildApp` e plugins do Nuxt). Nada de globais escondidos nem singletons.
4. **Nomes** que revelam a intenção, sem abreviações além das universais (id, url, api, db). Nada de nomes de uma letra fora de lambdas mínimas. Booleanos leem como predicado (`is`, `has`, `can`, `should`), funções são verbos, classes e componentes são substantivos. Código, banco e rotas em inglês (ADR 0015); textos da interface em português.
5. **Sem código morto, sem código comentado, sem lógica duplicada** (extraia o auxiliar comum), sem números ou textos mágicos (use constantes com nome), sem `catch` genérico que engole erro, sem `any`.
6. Comentários explicam o porquê, nunca o quê. JSDoc só onde o contrato não é óbvio.
7. O comportamento não muda, a não ser para corrigir um defeito real: nesse caso o teste que mostra o defeito vem primeiro e o PR conta o que foi corrigido. O contrato público (OpenAPI e cliente gerado) fica idêntico, a não ser que o defeito esteja nele.

Também valem: DRY, KISS e YAGNI; alta coesão e baixo acoplamento; Lei de Deméter (sem longas cadeias atravessando outros objetos); diga, não pergunte; separação entre comando e consulta; cláusulas de guarda e falha rápida; imutabilidade por padrão (`readonly`, `as const`, objetos novos em vez de mutação); funções puras para a lógica; composição em vez de herança; erros explícitos e tipados; nenhum parâmetro booleano que troca o comportamento (divida a função); estrutura de módulos e nomes de arquivos consistentes.

## Como o `make check` verifica

`make check` roda os mesmos passos do job de qualidade do CI: build dos pacotes, OpenAPI e cliente sem divergência, ESLint e Prettier, fronteiras da API, TypeScript, a verificação estrita do tamanho das funções, testes com 100% de cobertura (num PostgreSQL descartável na porta 5482, que não encosta no banco de desenvolvimento) e o build do site. Rode `pnpm install` antes da primeira vez.

### Tamanho das funções (estrito)

O verificador fica em `tools/quality` (compilador do TypeScript para `.ts`, `.mjs` e `.cjs`, e `@vue/compiler-sfc` para os blocos `<script>` dos componentes), com a configuração em `tools/function_length.json`. A dívida antiga foi paga nas ondas de refatoração e a linha de base chegou a zero, então `make function-length` roda em modo estrito (`--strict`): qualquer função de produção com corpo acima de 12 linhas faz o `make check` e o CI falharem.

`make function-length-list` lista as funções acima do limite, da maior para a menor, para achar o que dividir.

`tools/function_length_baseline.json` fica vazio e não é mais usado pelo gate. O modo de catraca do verificador continua disponível só para a exceção de uma regra nova que entre com dívida; voltar a usar uma linha de base exige justificativa escrita no PR.

## Testes

Cobertura de 100% em linhas, ramos, funções e instruções continua obrigatória. Testes podem passar de 12 linhas só por tabelas de parametrização ou fixtures; auxiliares de teste seguem as mesmas regras de nomes e responsabilidade.
