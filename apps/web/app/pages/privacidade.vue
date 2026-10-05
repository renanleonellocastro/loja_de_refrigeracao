<script setup lang="ts">
import { STORE_INFO } from '~/utils/store';

/** Public privacy policy (docs/SEGURANCA.md section 6). The version is recorded with the consent at sign up. */
usePageSeo({
  title: 'Política de privacidade | Refrigeração Castro',
  description: 'Como a Refrigeração Castro usa, guarda e protege os seus dados pessoais.',
  path: '/privacidade',
});

const VERSION = '03/10/2026';

const SECTIONS = [
  {
    title: 'Por que usamos seus dados',
    text: 'Usamos seus dados para atender você: vender produtos para retirada na loja, fazer orçamentos e combinar visitas técnicas. A base legal é a execução do contrato com você e, para manter o histórico da loja, o nosso legítimo interesse.',
  },
  {
    title: 'O que pedimos',
    text: 'Nome, email e telefone para falar com você, e o endereço quando você pede uma visita. O CPF só é pedido quando é necessário, por exemplo para emitir nota fiscal. Nossos registros técnicos não guardam nome, email, telefone nem CPF.',
  },
  {
    title: 'Transparência',
    text: 'Esta política fica sempre aberta a qualquer pessoa. Quando você cria a conta, guardamos a data e a versão da política que você aceitou.',
  },
  {
    title: 'Acesso e portabilidade',
    text: 'Você pode baixar todos os seus dados a qualquer momento, em um arquivo JSON, na aba Privacidade do seu perfil.',
  },
  {
    title: 'Exclusão da conta',
    text: 'Você pode excluir sua conta na aba Privacidade do seu perfil. Seus dados pessoais são apagados na hora. Pedidos e serviços continuam guardados sem identificar você, porque a loja precisa deles para as obrigações fiscais.',
  },
  {
    title: 'Por quanto tempo guardamos',
    text: 'Sessões encerradas são apagadas em 30 dias. Fotos de serviços concluídos há mais de 5 anos são removidas automaticamente.',
  },
] as const;
</script>

<template>
  <article class="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
    <p class="rc-eyebrow text-link">LGPD</p>
    <h1 class="mt-2 text-3xl font-extrabold text-text sm:text-4xl">Política de privacidade</h1>
    <p class="mt-3 text-text-muted">
      Versão de {{ VERSION }}. Na {{ STORE_INFO.name }}, seus dados servem só para atender você.
    </p>

    <section v-for="section in SECTIONS" :key="section.title" class="mt-8">
      <h2 class="text-xl font-bold text-text">{{ section.title }}</h2>
      <p class="mt-2 leading-relaxed text-text-muted">{{ section.text }}</p>
    </section>

    <section class="mt-8">
      <h2 class="text-xl font-bold text-text">Encarregado pelos dados</h2>
      <p class="mt-2 leading-relaxed text-text-muted">
        O responsável pelos seus dados é o dono da loja, {{ STORE_INFO.legalName }}, CNPJ
        {{ STORE_INFO.cnpj }}. Para qualquer dúvida ou pedido, escreva para
        <a :href="`mailto:${STORE_INFO.email}`" class="font-semibold text-link hover:underline">{{
          STORE_INFO.email
        }}</a>
        ou ligue para
        <a :href="STORE_INFO.phoneHref" class="font-semibold text-link hover:underline">{{
          STORE_INFO.phone
        }}</a
        >.
      </p>
    </section>
  </article>
</template>
