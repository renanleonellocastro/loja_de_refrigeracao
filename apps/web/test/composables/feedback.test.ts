import { afterEach, describe, expect, it, vi } from 'vitest';
import { useConfirm } from '~/composables/useConfirm';
import { useToast } from '~/composables/useToast';

describe('useToast', () => {
  afterEach(() => {
    useToast().clear();
    vi.useRealTimers();
  });

  it('shows and auto dismisses toasts by tone', () => {
    vi.useFakeTimers();
    const toast = useToast();
    toast.success({ title: 'Salvo' });
    toast.error({ title: 'Falhou' });
    toast.info({ title: 'Info', duration: 0 });
    expect(toast.toasts.value.map((t) => t.tone)).toEqual(['success', 'error', 'info']);
    vi.advanceTimersByTime(5000);
    expect(toast.toasts.value.map((t) => t.title)).toEqual(['Falhou', 'Info']);
    vi.advanceTimersByTime(3000);
    expect(toast.toasts.value.map((t) => t.title)).toEqual(['Info']);
  });

  it('undo runs the callback once and closes', () => {
    const onUndo = vi.fn();
    const toast = useToast();
    const id = toast.success({ title: 'Excluído', onUndo });
    toast.undo(id);
    expect(onUndo).toHaveBeenCalledOnce();
    expect(toast.toasts.value).toEqual([]);
    toast.undo(999);
  });

  it('dismisses by id', () => {
    const toast = useToast();
    const id = toast.info({ title: 'Oi' });
    toast.dismiss(id);
    expect(toast.toasts.value).toEqual([]);
  });
});

describe('useConfirm', () => {
  it('resolves with the answer and fills defaults', async () => {
    const { confirm, current, settle } = useConfirm();
    const answer = confirm({ title: 'Excluir?' });
    expect(current.value).toMatchObject({
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      danger: false,
    });
    settle(true);
    await expect(answer).resolves.toBe(true);
    expect(current.value).toBeNull();
  });

  it('cancels an unanswered question when a new one comes', async () => {
    const { confirm, settle } = useConfirm();
    const first = confirm({ title: 'Primeira', danger: true, confirmLabel: 'Sim', cancelLabel: 'Não' });
    const second = confirm({ title: 'Segunda' });
    await expect(first).resolves.toBe(false);
    settle(false);
    await expect(second).resolves.toBe(false);
  });
});
