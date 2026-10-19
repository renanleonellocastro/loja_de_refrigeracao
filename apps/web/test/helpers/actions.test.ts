import { afterEach, describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { useToast } from '~/composables/useToast';
import { holdWhile, runOrToast } from '~/helpers/actions';
import { ApiError } from '~/utils/api-error';

const toastTitles = () => useToast().toasts.value.map((toast) => toast.title);

afterEach(() => useToast().clear());

describe('runOrToast', () => {
  it('answers true and shows nothing when the action works', async () => {
    expect(await runOrToast(async () => {})).toBe(true);
    expect(toastTitles()).toEqual([]);
  });

  it('answers false and shows the message of the failure in a toast', async () => {
    const failing = async () => {
      throw new ApiError(409, 'Já existe.');
    };
    expect(await runOrToast(failing)).toBe(false);
    expect(toastTitles()).toEqual(['Já existe.']);
  });
});

describe('holdWhile', () => {
  it('holds the state while the action runs and answers its result', async () => {
    const busy = ref(false);
    const result = await holdWhile(busy, true, false, async () => {
      expect(busy.value).toBe(true);
      return 7;
    });
    expect(result).toBe(7);
    expect(busy.value).toBe(false);
  });

  it('puts the idle state back when the action fails', async () => {
    const busy = ref<number | null>(null);
    const failing = holdWhile(busy, 3, null, async () => {
      throw new Error('boom');
    });
    await expect(failing).rejects.toThrow('boom');
    expect(busy.value).toBeNull();
  });
});
