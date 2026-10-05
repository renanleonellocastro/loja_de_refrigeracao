import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RouteLocationNormalized } from 'vue-router';
import ErrorPage from '~/error.vue';
import previewActor from '~/middleware/preview-actor';
import DesignAreaPage from '~/pages/design/area.vue';
import DesignPage from '~/pages/design/index.vue';
import { useConfirm } from '~/composables/useConfirm';
import { useCurrentActor } from '~/composables/useCurrentActor';
import { useToast } from '~/composables/useToast';

const { clearErrorMock } = vi.hoisted(() => ({ clearErrorMock: vi.fn() }));
mockNuxtImport('clearError', () => clearErrorMock);

const button = (text: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;

afterEach(() => {
  useToast().clear();
  useConfirm().settle(false);
  useActorPreview().value = null;
});

describe('error page', () => {
  it('picks the screen by status and retries on the same address', async () => {
    const notFound = await mountSuspended(ErrorPage, { props: { error: createError({ statusCode: 404 }) } });
    expect(notFound.text()).toContain('Procuramos em todas as prateleiras');
    const forbidden = await mountSuspended(ErrorPage, { props: { error: createError({ statusCode: 403 }) } });
    expect(forbidden.text()).toContain('Esta porta é só para a equipe');
    const server = await mountSuspended(ErrorPage, {
      props: { error: createError({ statusCode: 500 }) },
      route: '/servicos',
    });
    expect(server.text()).toContain('Erro 500');
    await server
      .findAll('button')
      .find((b) => b.text() === 'Tentar de novo')!
      .trigger('click');
    expect(clearErrorMock).toHaveBeenCalledWith({ redirect: '/servicos' });
  });
});

describe('preview-actor middleware', () => {
  it('previews the asked role, managers by default', async () => {
    const run = (query: Record<string, string>) =>
      previewActor({ query } as unknown as RouteLocationNormalized, {} as RouteLocationNormalized);
    await mountSuspended({ template: '<p />' });
    run({ papel: 'CLIENT' });
    expect(useCurrentActor().value).toBe('CLIENT');
    run({ papel: 'hacker' });
    expect(useCurrentActor().value).toBe('MANAGER');
  });
});

describe('design area preview', () => {
  it('switches roles and goes back to guest on leave', async () => {
    useActorPreview().value = 'EMPLOYEE';
    const page = await mountSuspended(DesignAreaPage);
    expect(page.get('[aria-current="true"]').text()).toBe('Colaborador');
    expect(page.findAll('tbody tr')).toHaveLength(3);
    page.unmount();
    expect(useCurrentActor().value).toBe('GUEST');
  });
});

describe('design page', () => {
  it('is not indexed and shows every section', async () => {
    const page = await mountSuspended(DesignPage, { attachTo: document.body });
    for (const id of [
      'marca',
      'acoes',
      'formularios',
      'exibicao',
      'feedback',
      'navegacao',
      'erros',
      'layouts',
    ]) {
      expect(page.find(`section#${id}`).exists()).toBe(true);
    }
    expect(page.findAll('[data-status]').length).toBeGreaterThan(18);
    page.unmount();
  });

  it('drives toasts, confirmation, dialog, table states and the alert', async () => {
    const page = await mountSuspended(DesignPage, { attachTo: document.body });
    const toast = useToast();

    button('Salvar com desfazer').click();
    await flushPromises();
    expect(toast.toasts.value[0]!.title).toBe('Pronto! Alterações salvas.');
    toast.undo(toast.toasts.value[0]!.id);
    expect(toast.toasts.value[0]!.title).toBe('Alteração desfeita.');

    button('Simular erro').click();
    expect(toast.toasts.value.at(-1)!.tone).toBe('error');

    button('Excluir produto').click();
    await flushPromises();
    expect(useConfirm().current.value!.danger).toBe(true);
    useConfirm().settle(true);
    await flushPromises();
    const removed = toast.toasts.value.at(-1)!;
    expect(removed.title).toBe('Produto excluído.');
    toast.undo(removed.id);
    expect(toast.toasts.value.at(-1)!.title).toBe('Produto restaurado.');

    button('Excluir produto').click();
    await flushPromises();
    useConfirm().settle(false);
    await flushPromises();

    button('Abrir diálogo').click();
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain('Agendar visita');
    button('Confirmar período').click();
    await flushPromises();
    button('Abrir diálogo').click();
    await flushPromises();
    button('Voltar').click();
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    button('carregando').click();
    await flushPromises();
    expect(page.find('[aria-label="Carregando"]').exists()).toBe(true);
    button('vazio').click();
    await flushPromises();
    expect(page.text()).toContain('Nenhum pedido por aqui ainda');

    await page.get('button[aria-label="Fechar aviso"]').trigger('click');
    expect(page.text()).not.toContain('Loja fechada no feriado');

    await page
      .findAll('input')
      .find((i) => i.element.id && i.attributes('inputmode') === 'numeric')!
      .setValue('1');
    page.unmount();
  });

  it('keeps every demo control interactive', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:1'), revokeObjectURL: vi.fn() });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('no canvas in tests');
      }),
    );
    const page = await mountSuspended(DesignPage, { attachTo: document.body });

    for (const input of page.findAll('input:not([type="radio"]):not([type="file"]):not([disabled])')) {
      await input.setValue('19');
    }
    for (const area of page.findAll('textarea')) await area.setValue('Barulho no motor');
    for (const control of page.findAll(
      'button[role="checkbox"]:not([disabled]), button[role="switch"]:not([disabled])',
    )) {
      await control.trigger('click');
    }

    const gallery = page.get('input[type="file"][multiple]').element as HTMLInputElement;
    Object.defineProperty(gallery, 'files', { value: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] });
    gallery.dispatchEvent(new Event('change'));
    await flushPromises();
    expect(page.find('img[alt^="Foto 1"]').exists()).toBe(true);

    await page.get('button[aria-label="Próxima página"]').trigger('click');
    expect(page.find('button[aria-label="Página 4"][aria-current="page"]').exists()).toBe(true);

    for (const tab of page.findAll('[role="tab"]')) {
      await tab.trigger('mousedown', { button: 0, ctrlKey: false });
    }
    await flushPromises();
    expect(page.text()).toContain('Nenhum orçamento em aberto.');
    expect(page.text()).toContain('Parece que a internet caiu');

    const combobox = page.get('input[role="combobox"]');
    await combobox.setValue('');
    await combobox.trigger('click');
    await flushPromises();
    await combobox.trigger('keydown', { key: 'ArrowDown' });
    await combobox.trigger('keydown', { key: 'Enter' });
    await flushPromises();

    button('Abrir diálogo').click();
    await flushPromises();
    document
      .querySelector('[role="dialog"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    page.unmount();
    vi.unstubAllGlobals();
  });

  it('runs the actions menu', async () => {
    const page = await mountSuspended(DesignPage, { attachTo: document.body });
    const toast = useToast();
    const open = async () => {
      button('Ações').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await flushPromises();
    };
    const pick = async (label: string) => {
      const item = [...document.querySelectorAll('[role="menuitem"]')].find((i) =>
        i.textContent?.includes(label),
      );
      (item as HTMLElement).click();
      await flushPromises();
    };
    await open();
    await pick('Editar');
    expect(toast.toasts.value.at(-1)!.title).toBe('Abrindo a edição…');
    await open();
    await pick('Excluir');
    expect(useConfirm().current.value!.title).toBe('Excluir este produto?');
    page.unmount();
  });
});
