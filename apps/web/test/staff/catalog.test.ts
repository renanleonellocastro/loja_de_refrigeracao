import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useConfirm } from '~/composables/useConfirm';
import { useToast } from '~/composables/useToast';
import CategoriesPage from '~/pages/categorias.vue';
import ProductPage from '~/pages/produtos/gerenciar/[id].vue';
import ProductsPage from '~/pages/produtos/gerenciar/index.vue';
import NewProductPage from '~/pages/produtos/gerenciar/novo.vue';
import { useAuthStore } from '~/stores/auth';
import { MANAGER_USER, click, fill, mockApi, problem, session, submit } from '../support/api';
import { productFormFrom } from '~/utils/products';
import { detail, product } from '../support/shop';
import {
  ADMIN_USER,
  category,
  isDisabled,
  mockUploads,
  movement,
  openTab,
  paged,
  photo,
  pickFiles,
  press,
  settle,
  stubImages,
  text,
  toggle,
  wait,
} from '../support/staff';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateMock);

const toastTitles = () => useToast().toasts.value.map((toast) => toast.title);
const CATEGORIES = [category(7, 'Peças e acessórios', 3), category(1, 'Geladeiras', 0)];

afterEach(async () => {
  useAuthStore().clear();
  useToast().clear();
  useConfirm().settle(false);
  await settle();
  navigateMock.mockReset();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('product management list', () => {
  it('lists, searches, filters and shows the stock badges', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi()
      .on(
        'GET /api/v1/products',
        paged(
          [
            product({ lowStock: true }),
            product({ id: 2, slug: 'b', archived: true, stockAvailable: 0, cover: null }),
            product({ id: 3, slug: 'c', condition: 'USED' }),
          ],
          45,
        ),
        paged([product({ id: 21 })], 45),
        paged([]),
      )
      .on('GET /api/v1/categories', { body: CATEGORIES });
    const page = await mountSuspended(ProductsPage, { attachTo: document.body });
    await settle();
    const calls = () => api.called('GET /api/v1/products');
    expect(text()).toContain('Estoque baixo');
    expect(text()).toContain('Arquivado');
    expect(text()).toContain('Sem estoque');
    expect(text()).toContain('Usado');
    expect(page.find('a[href="/produtos/gerenciar/2"]').exists()).toBe(true);
    expect(calls()[0]!.url.searchParams.get('sort')).toBe('name');

    press('Próxima página');
    await settle();
    expect(calls()[1]!.url.searchParams.get('page')).toBe('2');

    await fill('Buscar produtos', 'compresor');
    await wait(350);
    await settle();
    expect(calls()[2]!.url.searchParams.get('q')).toBe('compresor');
    expect(calls()[2]!.url.searchParams.get('sort')).toBe('relevance');
    expect(text()).toContain('Nenhum produto com esses filtros');

    await fill('Categoria', '7');
    await settle();
    expect(calls().at(-1)!.url.searchParams.get('categoryId')).toBe('7');
    await fill('Condição', 'USED');
    await settle();
    expect(calls().at(-1)!.url.searchParams.get('condition')).toBe('USED');
    toggle('Só com estoque');
    await settle();
    expect(calls().at(-1)!.url.searchParams.get('available')).toBe('true');
    toggle('Mostrar arquivados');
    await settle();
    expect(calls().at(-1)!.url.searchParams.get('includeArchived')).toBe('true');

    click('Limpar filtros');
    await wait(350);
    await settle();
    const last = calls().at(-1)!.url.searchParams;
    expect([last.has('q'), last.has('categoryId'), last.has('condition'), last.has('available')]).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(last.get('includeArchived')).toBe('true');
    expect(text()).toContain('Nenhum produto cadastrado');
    page.unmount();
  });

  it('keeps working without categories and retries a failed list', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    mockApi()
      .on('GET /api/v1/products', problem(500, 'Erro.'), paged([product()]))
      .on('GET /api/v1/categories', problem(500, 'Erro.'));
    const page = await mountSuspended(ProductsPage, { attachTo: document.body });
    await settle();
    expect(text()).toContain('Algo esquentou por aqui');
    click('Tentar de novo');
    await settle();
    expect(text()).toContain('Compressor Embraco');
    expect(page.findAll('option').map((option) => option.text())).toEqual([
      'Todas as categorias',
      'Novos e usados',
      'Novo',
      'Usado',
    ]);
    page.unmount();
  });

  it('narrows by condition or stock alone', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    mockApi().on('GET /api/v1/products', paged([product()]), paged([]));
    const page = await mountSuspended(ProductsPage, { attachTo: document.body });
    await settle();
    await fill('Condição', 'NEW');
    await settle();
    expect(text()).toContain('Nenhum produto com esses filtros');
    await fill('Condição', '');
    toggle('Só com estoque');
    await settle();
    expect(text()).toContain('Nenhum produto com esses filtros');
    page.unmount();
  });
});

describe('new product page', () => {
  it('validates, shows API errors and opens the photos after saving', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi()
      .on('GET /api/v1/categories', problem(500, 'Erro.'), { body: CATEGORIES })
      .on(
        'POST /api/v1/products',
        problem(422, 'Confira os dados.', { errors: [{ path: 'name', message: 'Já existe.' }] }),
        { status: 201, body: detail({ id: 99 }) },
      );
    const page = await mountSuspended(NewProductPage, { attachTo: document.body });
    await settle();
    click('Tentar de novo');
    await settle();

    submit('Cadastrar produto');
    await settle();
    expect(text()).toContain('Escolha a categoria.');
    expect(api.called('POST /api/v1/products')).toHaveLength(0);

    await fill('Nome do produto', 'Filtro secador');
    await fill('Categoria', '7');
    await fill('Condição', 'USED');
    await fill('Marca', 'Danfoss');
    await fill('Modelo', ' ');
    await fill('Preço', '89,90');
    await fill('Estoque inicial', ' 5 ');
    await fill('Estoque mínimo', '2');
    await fill('Descrição', 'Para linha de refrigeração.');
    submit('Cadastrar produto');
    await settle();
    expect(text()).toContain('Já existe.');
    page.findComponent({ name: 'ProductsFields' }).vm.$emit('update:modelValue', {
      ...productFormFrom(null),
      name: 'Filtro secador',
      categoryId: '7',
      condition: 'USED',
      brand: 'Danfoss',
      priceCents: 8990,
      initialStock: '5',
      stockMin: '2',
      description: 'Para linha de refrigeração.',
    });
    await settle();

    submit('Cadastrar produto');
    await settle();
    expect(api.called('POST /api/v1/products')[1]!.body).toEqual({
      name: 'Filtro secador',
      categoryId: 7,
      brand: 'Danfoss',
      model: null,
      condition: 'USED',
      description: 'Para linha de refrigeração.',
      priceCents: 8990,
      stockMin: 2,
      initialStock: 5,
    });
    expect(toastTitles()).toContain('Produto cadastrado.');
    expect(navigateMock).toHaveBeenCalledWith('/produtos/gerenciar/99?aba=fotos');
    page.findComponent({ name: 'ProductsFields' }).vm.$emit('update:modelValue', productFormFrom(null));
    page.unmount();
  });
});

describe('product edit page', () => {
  const mountAt = (route: string) => mountSuspended(ProductPage, { route, attachTo: document.body });

  it('shows not found and server errors', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    mockApi()
      .on('GET /api/v1/products/14', problem(404, 'Não existe.'), problem(500, 'Erro.'))
      .on('GET /api/v1/categories', { body: CATEGORIES });
    const page = await mountAt('/produtos/gerenciar/14');
    await settle();
    expect(text()).toContain('não achamos');
    page.unmount();
    const again = await mountAt('/produtos/gerenciar/14');
    await settle();
    expect(text()).toContain('Algo esquentou por aqui');
    again.unmount();
  });

  it('saves with If-Match, explains a conflict and switches tabs', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi()
      .on('GET /api/v1/products/14', { body: detail({ version: 3 }) }, { body: detail({ version: 4 }) })
      .on('GET /api/v1/categories', { body: CATEGORIES })
      .on('PATCH /api/v1/products/14', problem(412, 'Mudou.'), problem(409, 'Outro erro.'), {
        body: detail({ version: 5, name: 'Compressor novo' }),
      })
      .on('GET /api/v1/products/14/stock-movements', paged([]));
    const page = await mountAt('/produtos/gerenciar/14?aba=outra');
    await settle();
    expect(text()).toContain('Compressor Embraco');
    expect(text()).toContain('Ver no catálogo');
    expect(text()).not.toContain('Excluir ou arquivar');

    await fill('Nome do produto', 'ab');
    submit('Salvar alterações');
    await settle();
    expect(text()).toContain('pelo menos 3 letras');

    await fill('Nome do produto', 'Compressor novo');
    submit('Salvar alterações');
    await settle();
    expect(api.called('PATCH /api/v1/products/14')[0]!.body).toMatchObject({ name: 'Compressor novo' });
    expect(text()).toContain('Outra pessoa alterou este produto');
    click('Carregar versão atual');
    await settle();
    expect(text()).not.toContain('Outra pessoa alterou este produto');

    await fill('Nome do produto', 'Compressor novo');
    submit('Salvar alterações');
    await settle();
    expect(toastTitles()).toContain('Outro erro.');
    submit('Salvar alterações');
    await settle();
    expect(toastTitles()).toContain('Alterações salvas.');
    expect(text()).toContain('Compressor novo');

    openTab('Estoque');
    await settle();
    expect(useRouter().currentRoute.value.query.aba).toBe('estoque');
    openTab('Dados');
    await settle();
    page.findComponent({ name: 'ProductsFields' }).vm.$emit('update:modelValue', productFormFrom(null));
    page.unmount();
  });

  it('lets the super user delete, archive and unarchive', async () => {
    useAuthStore().apply(session(ADMIN_USER));
    const api = mockApi()
      .on(
        'GET /api/v1/products/14',
        { body: detail() },
        { body: detail({ archived: true, archivedAt: '2026-10-03T15:00:00.000Z' }) },
      )
      .on('GET /api/v1/categories', { body: CATEGORIES })
      .on(
        'DELETE /api/v1/products/14',
        problem(500, 'Erro.'),
        { body: { result: 'archived' } },
        { body: { result: 'deleted' } },
      )
      .on('POST /api/v1/products/14/unarchive', problem(409, 'Não deu.'), { body: detail() });
    const page = await mountAt('/produtos/gerenciar/14');
    await settle();

    click('Excluir ou arquivar');
    await settle();
    expect(useConfirm().current.value!.title).toBe('Excluir este produto?');
    useConfirm().settle(false);
    await settle();
    expect(api.called('DELETE /api/v1/products/14')).toHaveLength(0);

    click('Excluir ou arquivar');
    await settle();
    useConfirm().settle(true);
    await settle();
    expect(toastTitles()).toContain('Algo deu errado do nosso lado. Tente de novo em instantes.');

    click('Excluir ou arquivar');
    await settle();
    useConfirm().settle(true);
    await settle();
    expect(toastTitles()).toContain('Produto arquivado.');
    expect(text()).toContain('Produto arquivado');
    expect(text()).not.toContain('Ver no catálogo');

    click('Desarquivar');
    await settle();
    expect(toastTitles()).toContain('Não deu.');
    click('Desarquivar');
    await settle();
    expect(toastTitles()).toContain('Produto de volta ao catálogo.');

    click('Excluir ou arquivar');
    await settle();
    useConfirm().settle(true);
    await settle();
    expect(toastTitles()).toContain('Produto excluído.');
    expect(navigateMock).toHaveBeenCalledWith('/produtos/gerenciar');
    page.unmount();
  });

  it('uploads, orders, covers and removes photos', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    stubImages();
    const gallery = [photo(1, true, 0), photo(2, false, 1), photo(3, false, 2)];
    const sent = mockUploads(
      { status: 413, body: { title: 'Grande', detail: 'Foto grande demais.' } },
      'error',
      { status: 201, body: [...gallery, photo(4, false, 3)] },
      { status: 201, body: gallery },
    );
    const api = mockApi()
      .on('GET /api/v1/products/14', { body: detail({ images: gallery }) })
      .on('GET /api/v1/categories', { body: CATEGORIES })
      .on(
        'PUT /api/v1/products/14/images/order',
        problem(500, 'Erro.'),
        { body: [gallery[1], gallery[0], gallery[2]] },
        { body: [gallery[2], gallery[1], gallery[0]] },
      )
      .on('DELETE /api/v1/products/14/images/3', problem(500, 'Erro.'), { status: 204 })
      .on('DELETE /api/v1/products/14/images/1', { status: 204 });
    const page = await mountAt('/produtos/gerenciar/14?aba=fotos');
    await settle();
    expect(text()).toContain('Capa');
    expect(isDisabled('Mover a foto 1 para trás')).toBe(true);
    expect(isDisabled('Mover a foto 3 para frente')).toBe(true);

    pickFiles(['a.jpg']);
    await settle();
    click('Enviar fotos');
    await settle();
    expect(sent[0]!.url).toBe('http://localhost:3001/api/v1/products/14/images');
    expect(sent[0]!.headers.authorization).toBe(`Bearer token-${MANAGER_USER.id}`);
    expect(toastTitles()).toContain('Foto grande demais.');
    click('Enviar fotos');
    await settle();
    expect(toastTitles()).toContain(
      'Não conseguimos falar com a loja agora. Confira sua conexão e tente de novo.',
    );
    click('Enviar fotos');
    await settle();
    expect(toastTitles()).toContain('Foto enviada.');
    expect(document.querySelectorAll('[data-image]')).toHaveLength(4);

    pickFiles(['b.jpg', 'c.jpg']);
    await settle();
    click('Enviar fotos');
    await settle();
    expect(toastTitles()).toContain('2 fotos enviadas.');
    expect((sent[3]!.form.getAll('files') as File[]).map((file) => file.name)).toEqual(['b.jpg', 'c.jpg']);

    press('Mover a foto 1 para frente');
    await settle();
    expect(toastTitles()).toContain('Algo deu errado do nosso lado. Tente de novo em instantes.');
    press('Mover a foto 1 para frente');
    await settle();
    expect(api.called('PUT /api/v1/products/14/images/order')[1]!.body).toEqual({ imageIds: [2, 1, 3] });

    const items = () => [...document.querySelectorAll<HTMLElement>('[data-image]')];
    items()[2]!.dispatchEvent(new Event('drop', { cancelable: true }));
    items()[2]!.dispatchEvent(new Event('dragstart'));
    items()[2]!.dispatchEvent(new Event('drop', { cancelable: true }));
    expect(api.called('PUT /api/v1/products/14/images/order')).toHaveLength(2);
    items()[2]!.dispatchEvent(new Event('dragstart'));
    await settle();
    items()[2]!.dispatchEvent(new Event('dragover', { cancelable: true }));
    items()[0]!.dispatchEvent(new Event('drop', { cancelable: true }));
    items()[0]!.dispatchEvent(new Event('dragend'));
    await settle();
    expect(api.called('PUT /api/v1/products/14/images/order')[2]!.body).toEqual({ imageIds: [3, 2, 1] });

    press('Mover a foto 2 para trás');
    await settle();
    expect(api.called('PUT /api/v1/products/14/images/order')[3]!.body).toEqual({ imageIds: [2, 3, 1] });

    press('Usar a foto 2 como capa');
    await settle();
    expect(api.called('PUT /api/v1/products/14/images/order')[4]!.body).toEqual({
      imageIds: [3, 2, 1],
      coverId: 2,
    });

    press('Remover a foto 1');
    await settle();
    expect(useConfirm().current.value!.description).toBe('Ela sai da galeria do produto.');
    useConfirm().settle(false);
    await settle();
    press('Remover a foto 1');
    await settle();
    useConfirm().settle(true);
    await settle();
    expect(toastTitles()).toContain('Algo deu errado do nosso lado. Tente de novo em instantes.');
    press('Remover a foto 1');
    await settle();
    useConfirm().settle(true);
    await settle();
    expect(toastTitles()).toContain('Foto removida.');

    press('Remover a foto 2');
    await settle();
    expect(useConfirm().current.value!.description).toContain('a próxima foto vira a capa');
    useConfirm().settle(true);
    await settle();
    expect(document.querySelectorAll('[data-image]')).toHaveLength(1);
    expect(text()).toContain('Capa');
    page.unmount();
  });

  it('shows the empty gallery and the photo limit', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    mockApi()
      .on(
        'GET /api/v1/products/14',
        { body: detail({ images: [] }) },
        { body: detail({ images: Array.from({ length: 20 }, (_, i) => photo(i + 1, i === 0, i)) }) },
      )
      .on('GET /api/v1/categories', { body: CATEGORIES });
    const page = await mountAt('/produtos/gerenciar/14?aba=fotos');
    await settle();
    expect(text()).toContain('Nenhuma foto ainda');
    expect(text()).toContain('Cabem mais 20');
    page.unmount();
    const full = await mountAt('/produtos/gerenciar/14?aba=fotos');
    await settle();
    expect(text()).toContain('O produto já tem 20 fotos');
    full.unmount();
  });

  it('lists the stock history and records a movement', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi()
      .on('GET /api/v1/products/14', { body: detail({ stockMin: 2 }) })
      .on('GET /api/v1/categories', { body: CATEGORIES })
      .on(
        'GET /api/v1/products/14/stock-movements',
        problem(500, 'Erro.'),
        paged(
          [
            movement(1, { reason: 'Nota 12' }),
            movement(2, { type: 'SALE', quantity: -1, orderId: 5, authorName: null }),
          ],
          30,
        ),
        paged([movement(3)], 30),
        paged([]),
      )
      .on(
        'POST /api/v1/products/14/stock-movements',
        problem(422, 'Confira.', { errors: [{ path: 'quantity', message: 'Grande demais.' }] }),
        { status: 201, body: { movement: movement(9), stockAvailable: 1, lowStock: true } },
      );
    const page = await mountAt('/produtos/gerenciar/14?aba=estoque');
    await settle();
    expect(text()).toContain('Algo esquentou por aqui');
    click('Tentar de novo');
    await settle();
    expect(text()).toContain('Nota 12');
    expect(text()).toContain('Venda');
    expect(text()).toContain('-1');
    expect(text()).toContain('+5');
    expect(page.find('a[href="/pedidos/5"]').exists()).toBe(true);
    press('Próxima página');
    await settle();
    expect(api.called('GET /api/v1/products/14/stock-movements')[2]!.url.searchParams.get('page')).toBe('2');

    click('Movimentar estoque');
    await settle();
    await fill('Tipo', 'LOSS');
    expect(text()).toContain('Item quebrado');
    submit('Salvar movimentação');
    await settle();
    expect(text()).toContain('Informe o motivo.');
    await fill('Tipo', 'ADJUSTMENT');
    await fill('Quantidade', '-2');
    await fill('Motivo', ' Contagem ');
    submit('Salvar movimentação');
    await settle();
    expect(text()).toContain('Grande demais.');
    submit('Salvar movimentação');
    await settle();
    expect(api.called('POST /api/v1/products/14/stock-movements')[1]!.body).toEqual({
      type: 'ADJUSTMENT',
      quantity: -2,
      reason: 'Contagem',
    });
    expect(toastTitles()).toContain('Estoque atualizado: 1 disponível.');
    expect(text()).toContain('Nenhuma movimentação ainda.');
    expect(text()).toContain('Estoque baixo');

    click('Movimentar estoque');
    await settle();
    await fill('Quantidade', '3');
    submit('Salvar movimentação');
    await settle();
    expect(api.called('POST /api/v1/products/14/stock-movements')[2]!.body).toEqual({
      type: 'IN',
      quantity: 3,
    });
    page.unmount();
  });

  it('reads the store default minimum', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    mockApi()
      .on('GET /api/v1/products/14', { body: detail() })
      .on('GET /api/v1/categories', { body: CATEGORIES })
      .on('GET /api/v1/products/14/stock-movements', paged([]));
    const page = await mountAt('/produtos/gerenciar/14?aba=estoque');
    await settle();
    expect(text()).toContain('padrão da loja');
    click('Movimentar estoque');
    await settle();
    press('Fechar');
    await settle();
    click('Movimentar estoque');
    await settle();
    click('Cancelar');
    await settle();
    page.unmount();
  });
});

describe('categories page', () => {
  it('creates, renames and reorders categories', async () => {
    useAuthStore().apply(session(ADMIN_USER));
    const api = mockApi()
      .on('GET /api/v1/categories', problem(500, 'Erro.'), { body: [] }, { body: CATEGORIES })
      .on('POST /api/v1/categories', problem(409, 'Já existe.'), { status: 201, body: category(9, 'Gás') })
      .on('PATCH /api/v1/categories/1', { body: category(1, 'Refrigeradores') })
      .on('PUT /api/v1/categories/order', problem(500, 'Erro.'), {
        body: [CATEGORIES[1], CATEGORIES[0]],
      });
    const page = await mountSuspended(CategoriesPage, { attachTo: document.body });
    await settle();
    click('Tentar de novo');
    await settle();
    expect(text()).toContain('Nenhuma categoria ainda');

    click('Nova categoria');
    await settle();
    submit('Criar categoria');
    await settle();
    expect(text()).toContain('pelo menos 2 letras');
    await fill('Nome da categoria', 'x'.repeat(61));
    submit('Criar categoria');
    await settle();
    expect(text()).toContain('Use até 60 letras');
    await fill('Nome da categoria', ' Gás ');
    submit('Criar categoria');
    await settle();
    expect(toastTitles()).toContain('Já existe.');
    submit('Criar categoria');
    await settle();
    expect(api.called('POST /api/v1/categories')[1]!.body).toEqual({ name: 'Gás' });
    expect(toastTitles()).toContain('Categoria Gás criada.');
    expect(text()).toContain('3 produtos');
    expect(text()).toContain('0 produtos');

    press('Renomear Geladeiras');
    await settle();
    expect(text()).toContain('Renomear Geladeiras');
    await fill('Nome da categoria', 'Refrigeradores');
    submit('Salvar nome');
    await settle();
    expect(toastTitles()).toContain('Categoria renomeada.');

    press('Renomear Geladeiras');
    await settle();
    press('Fechar');
    await settle();
    press('Renomear Geladeiras');
    await settle();
    click('Cancelar');
    await settle();

    expect(isDisabled('Subir Peças e acessórios')).toBe(true);
    press('Subir Geladeiras');
    await settle();
    expect(toastTitles()).toContain('Algo deu errado do nosso lado. Tente de novo em instantes.');
    press('Descer Peças e acessórios');
    await settle();
    expect(api.called('PUT /api/v1/categories/order')[1]!.body).toEqual({ ids: [1, 7] });
    page.unmount();
  });

  it('deletes empty categories and moves products before deleting', async () => {
    useAuthStore().apply(session(ADMIN_USER));
    const api = mockApi()
      .on('GET /api/v1/categories', { body: CATEGORIES })
      .on(
        'DELETE /api/v1/categories/1',
        problem(500, 'Erro.'),
        problem(409, 'Em uso.', { code: 'category-in-use' }),
        problem(409, 'Ainda em uso.'),
        { status: 204 },
      )
      .on('DELETE /api/v1/categories/7', { status: 204 });
    const page = await mountSuspended(CategoriesPage, { attachTo: document.body });
    await settle();

    press('Excluir Geladeiras');
    await settle();
    expect(useConfirm().current.value!.title).toBe('Excluir a categoria Geladeiras?');
    useConfirm().settle(false);
    await settle();
    press('Excluir Geladeiras');
    await settle();
    useConfirm().settle(true);
    await settle();
    expect(toastTitles()).toContain('Algo deu errado do nosso lado. Tente de novo em instantes.');

    // Archived products still belong to the category, so the API asks where they go.
    press('Excluir Geladeiras');
    await settle();
    useConfirm().settle(true);
    await settle();
    expect(text()).toContain('Ela tem produtos arquivados.');
    await fill('Mover produtos para', '7');
    click('Mover e excluir');
    await settle();
    expect(api.called('DELETE /api/v1/categories/1')[2]!.url.searchParams.get('moveTo')).toBe('7');
    expect(toastTitles()).toContain('Ainda em uso.');
    click('Mover e excluir');
    await settle();
    expect(toastTitles()).toContain('Categoria Geladeiras excluída.');
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    press('Excluir Peças e acessórios');
    await settle();
    expect(text()).toContain('Ela tem 3 produtos.');
    click('Mover e excluir');
    await settle();
    expect(text()).toContain('Escolha a categoria que recebe os produtos.');
    press('Fechar');
    await settle();
    press('Excluir Peças e acessórios');
    await settle();
    click('Cancelar');
    await settle();
    expect(api.called('DELETE /api/v1/categories/7')).toHaveLength(0);
    page.unmount();
  });
});
