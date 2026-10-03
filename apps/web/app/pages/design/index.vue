<script setup lang="ts">
import { ORDER_STATUSES, QUOTE_STATUSES, SERVICE_REQUEST_STATUSES } from '~/utils/status';
import { formatMoney, isValidCpf } from '~/utils/masks';
import { ROLE_LABELS, ROLES } from '@rc/contracts';
import { palette } from '@rc/design-tokens';
import { ArrowRight, Download, PackageCheck, Pencil, Plus, Search, Trash2, Truck } from 'lucide-vue-next';

/**
 * Living style guide: every base component in every state, in both themes.
 * It replaces Storybook (see docs/DESIGN.md section 2) and is covered by unit, E2E and axe tests.
 */
definePageMeta({ title: 'Design system' });
useHead({ title: 'Design system | Refrigeração Castro', meta: [{ name: 'robots', content: 'noindex' }] });

const toast = useToast();
const { confirm } = useConfirm();

const SECTIONS = [
  { id: 'marca', label: 'Marca' },
  { id: 'acoes', label: 'Ações' },
  { id: 'formularios', label: 'Formulários' },
  { id: 'exibicao', label: 'Exibição' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'navegacao', label: 'Navegação' },
  { id: 'erros', label: 'Páginas de erro' },
  { id: 'layouts', label: 'Layouts' },
];

const SWATCHES = [
  { name: 'castro', shades: palette.castro },
  { name: 'steel', shades: palette.steel },
  { name: 'frost', shades: palette.frost },
];

// Forms
const name = ref('Eduardo Castro');
const email = ref('');
const notes = ref('Geladeira Brastemp frost free, não gela embaixo.');
const password = ref('');
const city = ref<string | undefined>('mogi-mirim');
const accepted = ref(true);
const notify = ref(true);
const cpf = ref('52998224725');
const cnpj = ref('');
const phone = ref('19938041658');
const cep = ref('13800061');
const price = ref(129990);
const photos = ref<File[]>([]);

const CITIES: SelectOption[] = [
  { value: 'mogi-mirim', label: 'Mogi Mirim', description: 'Sem taxa de visita' },
  { value: 'mogi-guacu', label: 'Mogi Guaçu', description: 'Taxa de visita R$ 30,00' },
  { value: 'itapira', label: 'Itapira' },
  { value: 'estiva-gerbi', label: 'Estiva Gerbi' },
  { value: 'conchal', label: 'Conchal' },
];

// Display
const ORDER_ROWS = [
  {
    number: 'RC-000123',
    customer: 'Maria Aparecida',
    total: formatMoney(189900),
    date: '03/10/2026',
    status: 'PENDING_REVIEW',
  },
  {
    number: 'RC-000122',
    customer: 'João Batista',
    total: formatMoney(45990),
    date: '02/10/2026',
    status: 'READY_FOR_PICKUP',
  },
  {
    number: 'RC-000121',
    customer: 'Ana Lúcia',
    total: formatMoney(12500),
    date: '01/10/2026',
    status: 'PICKED_UP',
  },
];
const ORDER_COLUMNS: TableColumn[] = [
  { key: 'number', label: 'Pedido' },
  { key: 'customer', label: 'Cliente' },
  { key: 'date', label: 'Data', priority: 'low' },
  { key: 'status', label: 'Estado' },
  { key: 'total', label: 'Total', align: 'end' },
];
const tableState = ref<'dados' | 'carregando' | 'vazio'>('dados');

const TIMELINE: TimelineEvent[] = [
  {
    id: 3,
    title: 'Aguardando retirada',
    when: '03/10/2026 às 14:20',
    icon: PackageCheck,
    description: 'Separado no balcão por Eduardo.',
  },
  { id: 2, title: 'Em análise', when: '03/10/2026 às 10:05', icon: Truck },
  { id: 1, title: 'Pedido criado', when: '03/10/2026 às 09:58' },
];

const DETAILS: DescriptionItem[] = [
  { term: 'Cliente', detail: 'Maria Aparecida' },
  { term: 'Telefone', detail: formatPhone('19998765432') },
  { term: 'Endereço', detail: 'Rua Doutor Ulhoa Cintra, 91, Centro' },
  { term: 'Estado', detail: 'PENDING_REVIEW' },
];

// Feedback and navigation
const dialogOpen = ref(false);
const alertVisible = ref(true);
const progress = ref(64);
const page = ref(3);
const tab = ref('pedidos');

const TABS: TabItem[] = [
  { value: 'pedidos', label: 'Pedidos', count: 12 },
  { value: 'servicos', label: 'Serviços', count: 4 },
  { value: 'orcamentos', label: 'Orçamentos' },
];

const ERROR_TABS: TabItem[] = [
  { value: 'not-found', label: '404' },
  { value: 'server', label: '500' },
  { value: 'forbidden', label: 'Sem permissão' },
  { value: 'offline', label: 'Sem conexão' },
];
const errorTab = ref('not-found');

const MENU_ITEMS: MenuAction[] = [
  { label: 'Editar', icon: Pencil, onSelect: () => toast.info({ title: 'Abrindo a edição…' }) },
  { label: 'Baixar PDF', icon: Download, disabled: true },
  { label: 'Excluir', icon: Trash2, danger: true, separated: true, onSelect: () => void removeProduct() },
];

function save(): void {
  toast.success({
    title: 'Pronto! Alterações salvas.',
    onUndo: () => toast.info({ title: 'Alteração desfeita.' }),
  });
}

function fail(): void {
  toast.error({
    title: 'Não conseguimos salvar agora.',
    description: 'Confira sua conexão e tente de novo.',
  });
}

async function removeProduct(): Promise<void> {
  const confirmed = await confirm({
    title: 'Excluir este produto?',
    description: 'Ele some do catálogo na hora. Pedidos antigos continuam com o histórico.',
    confirmLabel: 'Excluir produto',
    danger: true,
  });
  if (confirmed)
    toast.success({ title: 'Produto excluído.', onUndo: () => toast.info({ title: 'Produto restaurado.' }) });
}

const roleNavigation = computed(() =>
  ROLES.map((role) => ({ role, label: ROLE_LABELS[role], navigation: navigationFor(role) })),
);
</script>

<template>
  <div>
    <section class="rc-wall relative overflow-hidden">
      <FrostLines class="pointer-events-none absolute -right-20 bottom-0 w-[40rem] text-frost-300/30" />
      <div class="rc-container relative py-12 sm:py-16">
        <p class="rc-eyebrow text-frost-200">Guia vivo · uso interno</p>
        <h1 class="mt-3 text-4xl font-extrabold text-white sm:text-5xl">Design system</h1>
        <p class="mt-3 max-w-2xl text-lg text-castro-100">
          Cores da fachada, letras prateadas e um toque de gelo. Todos os componentes, em todos os estados,
          nos dois temas.
        </p>
        <div class="mt-6"><ThemeToggle tone="brand" /></div>
      </div>
    </section>

    <div class="rc-container lg:grid lg:grid-cols-[12rem_1fr] lg:gap-12">
      <nav aria-label="Seções do guia" class="sticky top-20 hidden self-start pt-12 lg:block">
        <ul class="flex flex-col gap-0.5 border-l border-border">
          <li v-for="section in SECTIONS" :key="section.id">
            <a
              :href="`#${section.id}`"
              class="-ml-px flex min-h-10 items-center border-l-2 border-transparent pl-4 text-sm font-medium text-text-muted hover:border-primary hover:text-link"
            >
              {{ section.label }}
            </a>
          </li>
        </ul>
      </nav>

      <div class="min-w-0">
        <DesignSection
          id="marca"
          title="Marca"
          description="O letreiro da loja em vetor, a paleta tirada da fachada e a tipografia larga dos títulos."
        >
          <div class="grid min-w-0 gap-4 md:grid-cols-[2fr_1fr]">
            <div class="rc-wall flex min-h-44 min-w-0 items-center justify-center rounded-lg p-6 sm:p-8">
              <AppLogo relief class="h-14 sm:h-24" />
            </div>
            <div class="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
              <div
                class="flex items-center justify-center rounded-lg border border-border bg-surface p-6 text-link"
              >
                <AppLogo class="h-12" />
              </div>
              <div
                class="flex items-center justify-center gap-4 rounded-lg border border-border bg-surface p-6"
              >
                <AppLogo variant="symbol" class="h-12 text-link" />
                <span class="flex size-12 items-center justify-center rounded-lg bg-primary text-on-primary">
                  <AppLogo variant="symbol" class="h-8" />
                </span>
              </div>
            </div>
          </div>

          <DesignExample title="Paleta">
            <div class="flex flex-col gap-5">
              <div v-for="swatch in SWATCHES" :key="swatch.name">
                <p class="mb-2 font-mono text-sm text-text-muted">{{ swatch.name }}</p>
                <ul class="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
                  <li v-for="(hex, shade) in swatch.shades" :key="shade" class="flex flex-col gap-1">
                    <span
                      class="h-12 rounded-md ring-1 ring-black/5 ring-inset"
                      :style="{ backgroundColor: hex }"
                    />
                    <span class="text-xs font-semibold text-text">{{ shade }}</span>
                    <span class="font-mono text-[0.6875rem] text-text-muted uppercase">{{ hex }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </DesignExample>

          <DesignExample
            title="Tipografia"
            note="Archivo nos títulos, Inter no texto. Números tabulares em preços."
          >
            <div class="flex flex-col gap-4">
              <p class="font-display text-5xl font-extrabold text-text">Gelou na hora</p>
              <p class="font-display text-3xl font-bold text-text">Conserto com garantia</p>
              <p class="text-lg text-text">Atendimento de balcão, com nome e sobrenome.</p>
              <p class="text-text-muted">Texto secundário para explicações e detalhes de apoio.</p>
              <p class="text-2xl font-semibold text-text tabular-nums">{{ formatMoney(129990) }}</p>
            </div>
          </DesignExample>
        </DesignSection>

        <DesignSection
          id="acoes"
          title="Ações"
          description="Verbos no imperativo, um botão principal por tela."
        >
          <DesignExample title="Variantes">
            <div class="flex flex-wrap items-center gap-3">
              <BaseButton>Pedir orçamento</BaseButton>
              <BaseButton variant="secondary">Ver detalhes</BaseButton>
              <BaseButton variant="ghost">Cancelar</BaseButton>
              <BaseButton variant="danger">Excluir</BaseButton>
            </div>
          </DesignExample>
          <DesignExample title="Tamanhos, ícones e estados">
            <div class="flex flex-wrap items-center gap-3">
              <BaseButton size="sm">Pequeno</BaseButton>
              <BaseButton>Médio</BaseButton>
              <BaseButton size="lg">
                <template #icon><Plus /></template>
                Agendar visita
              </BaseButton>
              <BaseButton loading>Salvando</BaseButton>
              <BaseButton disabled>Indisponível</BaseButton>
              <BaseButton to="/produtos" variant="secondary">
                Ver produtos
                <ArrowRight class="size-5" aria-hidden="true" />
              </BaseButton>
            </div>
          </DesignExample>
          <DesignExample title="Botões de ícone" note="Sempre com rótulo acessível.">
            <div class="flex flex-wrap items-center gap-3">
              <BaseIconButton label="Buscar"><Search /></BaseIconButton>
              <BaseIconButton label="Editar" variant="secondary"><Pencil /></BaseIconButton>
              <BaseIconButton label="Adicionar" variant="primary"><Plus /></BaseIconButton>
              <BaseIconButton label="Excluir" size="sm" disabled><Trash2 /></BaseIconButton>
              <BaseMenu :items="MENU_ITEMS" heading="Produto">
                <template #trigger>
                  <BaseButton variant="secondary">Ações</BaseButton>
                </template>
              </BaseMenu>
            </div>
          </DesignExample>
        </DesignSection>

        <DesignSection
          id="formularios"
          title="Formulários"
          description="Rótulo sempre visível, teclado certo em cada campo e erro dizendo o que fazer."
        >
          <div class="grid gap-6 md:grid-cols-2">
            <BaseTextField v-model="name" label="Nome completo" autocomplete="name" required />
            <BaseTextField
              v-model="email"
              label="Email"
              type="email"
              inputmode="email"
              autocomplete="email"
              error="Digite um email válido, como nome@exemplo.com."
            />
            <BaseTextField
              label="Buscar produto"
              placeholder="Geladeira, filtro, gás…"
              hint="Busque por nome ou código."
            >
              <template #prefix><Search /></template>
            </BaseTextField>
            <BaseTextField label="Peso" inputmode="decimal" suffix="kg" disabled />
            <BaseSelect v-model="city" label="Cidade do atendimento" :options="CITIES" />
            <BasePasswordField
              v-model="password"
              label="Crie uma senha"
              autocomplete="new-password"
              show-strength
            />
            <div class="md:col-span-2">
              <BaseTextArea
                v-model="notes"
                label="Conte o problema"
                :maxlength="500"
                hint="Marca, modelo e o que está acontecendo."
              />
            </div>
          </div>

          <DesignExample
            title="Máscaras brasileiras"
            note="O valor guardado fica sem máscara; dinheiro em centavos."
          >
            <div class="grid gap-6 md:grid-cols-2">
              <BaseMaskedField
                v-model="cpf"
                mask="cpf"
                label="CPF"
                :hint="isValidCpf(String(cpf)) ? 'CPF válido.' : undefined"
              />
              <BaseMaskedField v-model="cnpj" mask="cnpj" label="CNPJ" />
              <BaseMaskedField v-model="phone" mask="phone" label="Celular" autocomplete="tel" />
              <BaseMaskedField v-model="cep" mask="cep" label="CEP" autocomplete="postal-code" />
              <BaseMaskedField
                v-model="price"
                mask="money"
                label="Preço"
                :hint="`Valor guardado: ${price} centavos.`"
              />
            </div>
          </DesignExample>

          <DesignExample title="Escolhas">
            <div class="grid gap-2 md:grid-cols-2">
              <BaseCheckbox
                v-model="accepted"
                label="Li e aceito a política de privacidade"
                description="Seus dados ficam só com a loja."
              />
              <BaseCheckbox label="Opção desativada" disabled />
              <BaseSwitch
                v-model="notify"
                label="Avisar por email"
                description="Quando o pedido mudar de estado."
              />
              <BaseSwitch label="Modo manutenção" disabled />
            </div>
          </DesignExample>

          <DesignExample
            title="Fotos"
            note="Comprime no navegador até 2048 px. No celular, abre a câmera traseira."
          >
            <BasePhotoUpload v-model="photos" hint="Até 6 fotos." />
          </DesignExample>
        </DesignSection>

        <DesignSection id="exibicao" title="Exibição">
          <DesignExample title="Estados" note="Cor e ícone fixos para cada estado em todo o sistema.">
            <div class="flex flex-col gap-4">
              <div
                v-for="group in [
                  { kind: 'order', label: 'Pedido', list: ORDER_STATUSES },
                  { kind: 'serviceRequest', label: 'Solicitação', list: SERVICE_REQUEST_STATUSES },
                  { kind: 'quote', label: 'Orçamento', list: QUOTE_STATUSES },
                ] as const"
                :key="group.kind"
              >
                <p class="mb-2 text-sm font-semibold text-text">{{ group.label }}</p>
                <div class="flex flex-wrap gap-2">
                  <BaseStatusBadge
                    v-for="status in group.list"
                    :key="status"
                    :kind="group.kind"
                    :status="status"
                  />
                </div>
              </div>
            </div>
          </DesignExample>

          <div class="grid gap-6 lg:grid-cols-2">
            <BaseCard title="Pedido RC-000123" description="Feito em 03/10/2026" :heading-level="3">
              <template #actions
                ><BaseStatusBadge kind="order" status="READY_FOR_PICKUP" size="sm"
              /></template>
              <BaseDescriptionList :items="DETAILS">
                <template #detail-3
                  ><BaseStatusBadge kind="order" status="PENDING_REVIEW" size="sm"
                /></template>
              </BaseDescriptionList>
              <template #footer>
                <div class="flex justify-end">
                  <BaseButton size="sm" variant="secondary">Ver pedido</BaseButton>
                </div>
              </template>
            </BaseCard>
            <BaseCard title="Linha do tempo" :heading-level="3">
              <BaseTimeline :events="TIMELINE" label="Histórico do pedido" />
            </BaseCard>
          </div>

          <DesignExample title="Pessoas">
            <div class="flex flex-wrap items-center gap-4">
              <BaseAvatar name="Eduardo Castro" size="lg" />
              <BaseAvatar name="Maria Aparecida" />
              <BaseAvatar name="João" size="sm" />
            </div>
          </DesignExample>

          <DesignExample
            title="Tabela responsiva"
            note="Tabela a partir do tablet, cards empilhados no celular."
          >
            <div class="mb-4 flex flex-wrap gap-2" role="group" aria-label="Estado da tabela">
              <BaseButton
                v-for="state in ['dados', 'carregando', 'vazio'] as const"
                :key="state"
                size="sm"
                :variant="tableState === state ? 'primary' : 'secondary'"
                :aria-pressed="tableState === state"
                @click="tableState = state"
              >
                {{ state }}
              </BaseButton>
            </div>
            <BaseResponsiveTable
              :columns="ORDER_COLUMNS"
              :rows="tableState === 'vazio' ? [] : ORDER_ROWS"
              row-key="number"
              caption="Últimos pedidos"
              :loading="tableState === 'carregando'"
            >
              <template #cell-status="{ value }">
                <BaseStatusBadge kind="order" :status="String(value)" size="sm" />
              </template>
              <template #empty>
                <BaseEmptyState
                  title="Nenhum pedido por aqui ainda"
                  text="Que tal dar uma olhada nos produtos?"
                  :heading-level="3"
                >
                  <template #action><BaseButton to="/produtos">Ver produtos</BaseButton></template>
                </BaseEmptyState>
              </template>
            </BaseResponsiveTable>
          </DesignExample>
        </DesignSection>

        <DesignSection
          id="feedback"
          title="Feedback"
          description="Toda ação responde na hora: sucesso, erro, carregando e confirmação antes de apagar."
        >
          <div class="grid gap-3">
            <BaseAlert
              v-if="alertVisible"
              title="Loja fechada no feriado"
              dismissible
              @dismiss="alertVisible = false"
            >
              Na segunda, 12/10, a loja não abre. Pedidos feitos no site são separados na terça.
            </BaseAlert>
            <BaseAlert tone="success" title="Pronto! Recebemos sua solicitação."
              >A gente responde em até 1 dia útil.</BaseAlert
            >
            <BaseAlert tone="warning">Estoque baixo: restam 2 unidades deste filtro.</BaseAlert>
            <BaseAlert tone="danger" title="Não conseguimos salvar agora."
              >Confira sua conexão e tente de novo.</BaseAlert
            >
          </div>

          <DesignExample title="Toasts, confirmação e diálogo">
            <div class="flex flex-wrap gap-3">
              <BaseButton variant="secondary" @click="save">Salvar com desfazer</BaseButton>
              <BaseButton variant="secondary" @click="fail">Simular erro</BaseButton>
              <BaseButton variant="danger" @click="removeProduct">
                <template #icon><Trash2 /></template>
                Excluir produto
              </BaseButton>
              <BaseButton variant="ghost" @click="dialogOpen = true">Abrir diálogo</BaseButton>
            </div>
            <BaseDialog
              v-model:open="dialogOpen"
              title="Agendar visita"
              description="Escolha o melhor período para o técnico ir até você."
            >
              <BaseSelect
                label="Período"
                :options="[
                  { value: 'MORNING', label: 'Manhã' },
                  { value: 'AFTERNOON', label: 'Tarde' },
                ]"
              />
              <template #footer>
                <BaseButton variant="secondary" @click="dialogOpen = false">Voltar</BaseButton>
                <BaseButton @click="dialogOpen = false">Confirmar período</BaseButton>
              </template>
            </BaseDialog>
          </DesignExample>

          <div class="grid gap-6 md:grid-cols-2">
            <DesignExample title="Carregando">
              <div class="flex flex-col gap-5">
                <div class="flex items-center gap-3 text-link">
                  <BaseSpinner class="size-6" label="Carregando pedidos" />
                  <span class="text-sm text-text-muted">Carregando pedidos…</span>
                </div>
                <BaseProgressBar label="Enviando fotos" :value="progress" show-value />
                <BaseProgressBar label="Preparando relatório" />
                <div class="flex items-center gap-3">
                  <BaseSkeleton class="size-12 rounded-full" />
                  <div class="flex flex-1 flex-col gap-2">
                    <BaseSkeleton class="h-4 w-3/4 rounded-sm" />
                    <BaseSkeleton class="h-3 w-1/2 rounded-sm" />
                  </div>
                </div>
              </div>
            </DesignExample>
            <DesignExample title="Estado vazio">
              <BaseEmptyState
                title="Nenhum agendamento"
                text="Quando você pedir uma visita, ela aparece aqui."
                :heading-level="3"
              >
                <template #action><BaseButton size="sm">Agendar visita</BaseButton></template>
              </BaseEmptyState>
            </DesignExample>
          </div>
        </DesignSection>

        <DesignSection id="navegacao" title="Navegação">
          <DesignExample title="Migalhas">
            <BaseBreadcrumbs
              :items="[
                { label: 'Início', to: '/' },
                { label: 'Produtos', to: '/produtos' },
                { label: 'Filtro de água' },
              ]"
            />
          </DesignExample>
          <DesignExample title="Abas">
            <BaseTabs v-model="tab" :tabs="TABS" label="Histórico">
              <template #pedidos><p class="text-text-muted">12 pedidos nos últimos 30 dias.</p></template>
              <template #servicos><p class="text-text-muted">4 serviços agendados.</p></template>
              <template #orcamentos><p class="text-text-muted">Nenhum orçamento em aberto.</p></template>
            </BaseTabs>
          </DesignExample>
          <DesignExample title="Paginação">
            <BasePagination v-model:page="page" :total="12" />
          </DesignExample>
        </DesignSection>

        <DesignSection
          id="erros"
          title="Páginas de erro"
          description="Dizem o que aconteceu e o que fazer, com o bom humor de quem entende de frio."
        >
          <BaseTabs v-model="errorTab" :tabs="ERROR_TABS" label="Tipos de erro">
            <template v-for="item in ERROR_TABS" :key="item.value" #[item.value]>
              <div class="rounded-lg border border-border bg-bg">
                <ErrorState :kind="item.value as ErrorKind" :heading-level="3" />
              </div>
            </template>
          </BaseTabs>
        </DesignSection>

        <DesignSection
          id="layouts"
          title="Layouts"
          description="Barra lateral no desktop, trilho no tablet e barra inferior no celular. Os itens vêm da matriz de permissões."
        >
          <ul class="grid gap-4 sm:grid-cols-2">
            <li v-for="entry in roleNavigation" :key="entry.role">
              <BaseCard :title="entry.label" :heading-level="3" interactive>
                <p class="text-sm text-text-muted">
                  {{ entry.navigation.items.length }} itens · barra inferior:
                  {{ entry.navigation.bottom.map((item) => item.label).join(', ') }}
                </p>
                <template #footer>
                  <NuxtLink
                    :to="`/design/area?papel=${entry.role}`"
                    class="inline-flex min-h-11 items-center gap-2 font-semibold text-link hover:underline"
                  >
                    Ver área como {{ entry.label.toLowerCase() }}
                    <ArrowRight class="size-4" aria-hidden="true" />
                  </NuxtLink>
                </template>
              </BaseCard>
            </li>
          </ul>
        </DesignSection>
      </div>
    </div>
  </div>
</template>
