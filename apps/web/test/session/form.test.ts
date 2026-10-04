import { mountSuspended } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { flattenPaths, useForm, type Form } from '~/composables/useForm';
import { useToast } from '~/composables/useToast';
import { ApiError } from '~/utils/api-error';

type Values = { name: string; tags: string[]; address: { cep: string } };
const INITIAL: Values = { name: '', tags: [], address: { cep: '' } };

async function setup(options: Parameters<typeof useForm<Values>>[1] = {}): Promise<Form<Values>> {
  let form!: Form<Values>;
  const Host = defineComponent({
    setup() {
      form = useForm(INITIAL, options);
      return () => h('input', { 'aria-invalid': form.error('name') ? 'true' : undefined });
    },
  });
  await mountSuspended(Host, { attachTo: document.body });
  return form;
}

afterEach(() => {
  useToast().clear();
  document.body.innerHTML = '';
});

describe('useForm', () => {
  it('flattens nested values into API paths', () => {
    expect(flattenPaths({ a: 1, b: { c: 2, d: { e: [3] } } })).toEqual({ a: 1, 'b.c': 2, 'b.d.e': [3] });
  });

  it('validates in the browser, focuses the problem and clears it while typing', async () => {
    const form = await setup({ validate: (values) => (values.name ? {} : { name: 'Informe o nome.' }) });
    expect(await form.submit(async () => {})).toBe(false);
    expect(form.error('name')).toBe('Informe o nome.');
    expect(document.activeElement?.getAttribute('aria-invalid')).toBe('true');
    form.values.tags.push('x');
    await flushPromises();
    expect(form.error('name')).toBe('Informe o nome.');
    form.values.name = 'Carla';
    await flushPromises();
    expect(form.error('name')).toBeUndefined();
    let sent: Values | null = null;
    expect(await form.submit(async (values) => void (sent = values))).toBe(true);
    expect(sent).toMatchObject({ name: 'Carla' });
    expect(form.pending.value).toBe(false);
  });

  it('puts API field errors next to the inputs and the rest in a toast', async () => {
    const form = await setup();
    await form.submit(async () => {
      throw new ApiError(422, 'Confira os campos.', 'validation', { 'address.cep': 'CEP inválido.' });
    });
    expect(form.error('address.cep')).toBe('CEP inválido.');
    expect(useToast().toasts.value).toHaveLength(0);
    await form.submit(async () => {
      throw new ApiError(422, 'Confira os campos.', 'validation', { other: 'Campo do servidor.' });
    });
    expect(useToast().toasts.value[0]).toMatchObject({
      title: 'Confira os campos.',
      description: 'Campo do servidor.',
    });
    await form.submit(async () => {
      throw new TypeError('offline');
    });
    expect(useToast().toasts.value[1]!.description).toBeUndefined();
    form.reset({ ...INITIAL, name: 'Nova' });
    expect(form.values.name).toBe('Nova');
    expect(form.errors.value).toEqual({});
  });

  it('shows general errors inline when asked', async () => {
    const form = await setup({ inline: true });
    await form.submit(async () => {
      throw new ApiError(422, 'Confira os campos.', 'validation', { other: 'Campo do servidor.' });
    });
    expect(form.message.value).toBe('Confira os campos. Campo do servidor.');
    await form.submit(async () => {
      throw new ApiError(401, 'Senha não confere.');
    });
    expect(form.message.value).toBe('Senha não confere.');
    expect(useToast().toasts.value).toHaveLength(0);
  });
});
