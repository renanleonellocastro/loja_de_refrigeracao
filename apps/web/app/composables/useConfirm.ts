import { shallowRef } from 'vue';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions get the red button and the warning icon. */
  danger?: boolean;
}

export interface ConfirmRequest extends Required<Omit<ConfirmOptions, 'description'>> {
  description?: string;
  resolve: (confirmed: boolean) => void;
}

// Confirmations only happen in the browser after a click, so module state is safe here.
const current = shallowRef<ConfirmRequest | null>(null);

function settle(confirmed: boolean): void {
  current.value?.resolve(confirmed);
  current.value = null;
}

function confirm(options: ConfirmOptions): Promise<boolean> {
  // A new question replaces an unanswered one, which counts as canceled.
  settle(false);
  return new Promise<boolean>((resolve) => {
    current.value = {
      title: options.title,
      description: options.description,
      confirmLabel: options.confirmLabel ?? 'Confirmar',
      cancelLabel: options.cancelLabel ?? 'Cancelar',
      danger: options.danger ?? false,
      resolve,
    };
  });
}

/** Promise based confirmation modal for destructive actions (RNF-04), rendered by BaseConfirmDialog in app.vue. */
export function useConfirm() {
  return { current, confirm, settle };
}
