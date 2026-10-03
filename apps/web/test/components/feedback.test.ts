import { mountSuspended } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, nextTick } from 'vue';
import BaseAlert from '~/components/base/Alert.vue';
import BaseConfirmDialog from '~/components/base/ConfirmDialog.vue';
import BaseDialog from '~/components/base/Dialog.vue';
import BaseProgressBar from '~/components/base/ProgressBar.vue';
import BaseToastRegion from '~/components/base/ToastRegion.vue';
import { useConfirm } from '~/composables/useConfirm';
import { useToast } from '~/composables/useToast';

const byText = (text: string) =>
  [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === text)!;

describe('BaseAlert', () => {
  it('uses alert for danger and warning, status otherwise', async () => {
    for (const [tone, role] of [
      ['info', 'status'],
      ['success', 'status'],
      ['warning', 'alert'],
      ['danger', 'alert'],
    ] as const) {
      const wrapper = await mountSuspended(BaseAlert, { props: { tone }, slots: { default: () => 'Texto' } });
      expect(wrapper.attributes('role')).toBe(role);
      expect(wrapper.find('button').exists()).toBe(false);
    }
  });

  it('can be dismissed', async () => {
    const wrapper = await mountSuspended(BaseAlert, {
      props: { title: 'Feriado', dismissible: true },
      slots: { default: () => 'Fechado' },
    });
    expect(wrapper.text()).toContain('Feriado');
    await wrapper.get('button[aria-label="Fechar aviso"]').trigger('click');
    expect(wrapper.emitted('dismiss')).toHaveLength(1);
  });
});

describe('BaseProgressBar', () => {
  it('reports a clamped value', async () => {
    const wrapper = await mountSuspended(BaseProgressBar, {
      props: { label: 'Enviando', value: 140, showValue: true },
    });
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('100');
    expect(wrapper.text()).toContain('100%');
    await wrapper.setProps({ value: -5 });
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('0');
  });

  it('is indeterminate without a value', async () => {
    const wrapper = await mountSuspended(BaseProgressBar, {
      props: { label: 'Preparando', showValue: true },
    });
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBeUndefined();
    expect(wrapper.text()).not.toContain('%');
  });
});

describe('BaseDialog', () => {
  it('opens with title, description and footer, and closes with Escape', async () => {
    const wrapper = await mountSuspended(BaseDialog, {
      props: {
        open: true,
        title: 'Agendar visita',
        description: 'Escolha o período.',
        size: 'lg',
        'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
      },
      slots: {
        default: () => 'Corpo',
        footer: () => h('button', 'Confirmar'),
        icon: () => h('span', { id: 'icon' }),
      },
      attachTo: document.body,
    });
    await flushPromises();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Agendar visita');
    expect(dialog.textContent).toContain('Escolha o período.');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(document.getElementById('icon')).not.toBeNull();
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushPromises();
    expect(wrapper.props('open')).toBe(false);
    wrapper.unmount();
  });

  it('closes with the close button and can hide it', async () => {
    const wrapper = await mountSuspended(BaseDialog, {
      props: {
        open: true,
        title: 'Mais',
        'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
      },
      attachTo: document.body,
    });
    await flushPromises();
    (document.querySelector('[aria-label="Fechar"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(wrapper.props('open')).toBe(false);
    wrapper.unmount();

    const bare = await mountSuspended(BaseDialog, {
      props: { open: true, title: 'Sem fechar', hideClose: true },
    });
    await flushPromises();
    expect(document.querySelector('[aria-label="Fechar"]')).toBeNull();
    bare.unmount();
  });
});

describe('BaseConfirmDialog', () => {
  afterEach(() => useConfirm().settle(false));

  it('resolves true on confirm and shows the danger style', async () => {
    const wrapper = await mountSuspended(BaseConfirmDialog, { attachTo: document.body });
    const answer = useConfirm().confirm({
      title: 'Excluir produto?',
      description: 'Some do catálogo.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain('Some do catálogo.');
    expect(byText('Excluir').className).toContain('bg-danger');
    byText('Excluir').click();
    await expect(answer).resolves.toBe(true);
    wrapper.unmount();
  });

  it('resolves false on cancel and on Escape', async () => {
    const wrapper = await mountSuspended(BaseConfirmDialog, { attachTo: document.body });
    const first = useConfirm().confirm({ title: 'Sair?' });
    await flushPromises();
    expect(byText('Confirmar').className).toContain('bg-primary');
    byText('Cancelar').click();
    await expect(first).resolves.toBe(false);

    const second = useConfirm().confirm({ title: 'Sair de novo?' });
    await flushPromises();
    document
      .querySelector('[role="dialog"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(second).resolves.toBe(false);
    wrapper.unmount();
  });
});

describe('BaseToastRegion', () => {
  afterEach(() => useToast().clear());

  it('renders toasts with roles, undo and close', async () => {
    const wrapper = await mountSuspended(BaseToastRegion);
    const toast = useToast();
    const onUndo = vi.fn();
    toast.success({ title: 'Salvo', description: 'Tudo certo.', onUndo });
    toast.error({ title: 'Falhou' });
    toast.info({ title: 'Oi' });
    await nextTick();
    expect(wrapper.get('[aria-live="polite"]').exists()).toBe(true);
    expect(wrapper.findAll('[role="status"]')).toHaveLength(2);
    expect(wrapper.get('[role="alert"]').text()).toContain('Falhou');
    expect(wrapper.text()).toContain('Tudo certo.');

    const undo = wrapper.findAll('button').find((b) => b.text() === 'Desfazer')!;
    await undo.trigger('click');
    expect(onUndo).toHaveBeenCalledOnce();
    await wrapper.findAll('button[aria-label="Fechar notificação"]')[0]!.trigger('click');
    expect(toast.toasts.value.map((t) => t.title)).toEqual(['Oi']);
  });
});
