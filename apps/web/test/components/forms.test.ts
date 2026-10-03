import { mountSuspended } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, nextTick } from 'vue';
import BaseCheckbox from '~/components/base/Checkbox.vue';
import BaseField from '~/components/base/Field.vue';
import BaseMaskedField from '~/components/base/MaskedField.vue';
import BasePasswordField from '~/components/base/PasswordField.vue';
import BasePhotoUpload from '~/components/base/PhotoUpload.vue';
import BaseSelect from '~/components/base/Select.vue';
import BaseSwitch from '~/components/base/Switch.vue';
import BaseTextArea from '~/components/base/TextArea.vue';
import BaseTextField from '~/components/base/TextField.vue';

describe('BaseField', () => {
  it('links label, hint and error to the control', async () => {
    const wrapper = await mountSuspended(BaseField, {
      props: { label: 'Email', hint: 'Usamos para avisos.', error: 'Email inválido.', required: true },
      slots: {
        default: (slot: { id: string; describedBy?: string; invalid: boolean }) =>
          h('input', {
            id: slot.id,
            'aria-describedby': slot.describedBy,
            'data-invalid': String(slot.invalid),
          }),
      },
    });
    const input = wrapper.get('input');
    const label = wrapper.get('label');
    expect(label.attributes('for')).toBe(input.attributes('id'));
    expect(label.text()).toContain('*');
    const ids = input.attributes('aria-describedby')!.split(' ');
    expect(ids).toHaveLength(2);
    expect(wrapper.get(`[id="${ids[0]}"]`).text()).toBe('Email inválido.');
    expect(input.attributes('data-invalid')).toBe('true');
  });

  it('hides the label visually and describes nothing without hint or error', async () => {
    const wrapper = await mountSuspended(BaseField, {
      props: { label: 'Buscar', hideLabel: true },
      slots: {
        default: (slot: { describedBy?: string }) => h('input', { 'aria-describedby': slot.describedBy }),
      },
    });
    expect(wrapper.get('label').classes()).toContain('sr-only');
    expect(wrapper.get('input').attributes('aria-describedby')).toBeUndefined();
  });
});

describe('BaseTextField', () => {
  it('binds the model and passes input attributes', async () => {
    const wrapper = await mountSuspended(BaseTextField, {
      props: {
        label: 'Email',
        modelValue: 'a',
        type: 'email',
        inputmode: 'email',
        autocomplete: 'email',
        placeholder: 'nome@exemplo.com',
        name: 'email',
        'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }),
      },
    });
    const input = wrapper.get('input');
    expect(input.attributes()).toMatchObject({ type: 'email', inputmode: 'email', name: 'email' });
    await input.setValue('ana@castro.com');
    expect(wrapper.props('modelValue')).toBe('ana@castro.com');
  });

  it('shows error state, prefix and suffix from props and slots', async () => {
    const wrapper = await mountSuspended(BaseTextField, {
      props: { label: 'Peso', prefix: '≈', suffix: 'kg', error: 'Obrigatório', disabled: true },
    });
    expect(wrapper.text()).toContain('≈');
    expect(wrapper.text()).toContain('kg');
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true');
    expect(wrapper.get('input').attributes('disabled')).toBeDefined();
    const slotted = await mountSuspended(BaseTextField, {
      props: { label: 'Buscar' },
      slots: { prefix: () => h('svg', { 'data-prefix': '' }), suffix: () => h('svg', { 'data-suffix': '' }) },
    });
    expect(slotted.find('[data-prefix]').exists()).toBe(true);
    expect(slotted.find('[data-suffix]').exists()).toBe(true);
  });

  it('exposes focus', async () => {
    const wrapper = await mountSuspended(BaseTextField, {
      props: { label: 'Nome' },
      attachTo: document.body,
    });
    (wrapper.vm as unknown as { focus: () => void }).focus();
    expect(document.activeElement).toBe(wrapper.get('input').element);
    wrapper.unmount();
  });
});

describe('BaseTextArea', () => {
  it('counts characters when limited', async () => {
    const wrapper = await mountSuspended(BaseTextArea, {
      props: { label: 'Problema', modelValue: 'Não gela', maxlength: 100, error: 'Conte mais.' },
    });
    expect(wrapper.text()).toContain('8/100');
    await wrapper.get('textarea').setValue('Não gela nada');
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['Não gela nada']);
    expect(wrapper.get('textarea').attributes('aria-invalid')).toBe('true');
    const plain = await mountSuspended(BaseTextArea, { props: { label: 'Obs' } });
    expect(plain.text()).not.toContain('/');
  });
});

describe('BasePasswordField', () => {
  it('toggles visibility with an accessible button', async () => {
    const wrapper = await mountSuspended(BasePasswordField, { props: { modelValue: 'segredo' } });
    expect(wrapper.get('input').attributes('type')).toBe('password');
    const toggle = wrapper.get('button');
    expect(toggle.attributes('aria-label')).toBe('Mostrar senha');
    await toggle.trigger('click');
    expect(wrapper.get('input').attributes('type')).toBe('text');
    await wrapper.get('input').setValue('novo');
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['novo']);
    expect(wrapper.get('button').attributes('aria-label')).toBe('Ocultar senha');
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true');
  });

  it('shows the strength meter for new passwords', async () => {
    const wrapper = await mountSuspended(BasePasswordField, {
      props: { showStrength: true, modelValue: '', autocomplete: 'new-password' },
    });
    expect(wrapper.text()).toContain('Use pelo menos 8 caracteres.');
    await wrapper.setProps({ modelValue: 'abc' });
    expect(wrapper.text()).toContain('Força da senha: Muito fraca.');
    await wrapper.setProps({ modelValue: 'abcdefgh' });
    expect(wrapper.text()).toContain('Fraca');
    await wrapper.setProps({ modelValue: 'abcdefG1' });
    expect(wrapper.text()).toContain('Razoável');
    await wrapper.setProps({ modelValue: 'abcdefG1!xyz' });
    expect(wrapper.text()).toContain('Forte');
    const bars = wrapper.get('[data-testid="strength-meter"]').findAll('span');
    expect(bars.every((bar) => bar.classes().includes('bg-success'))).toBe(true);
  });

  it('shows the hint without the meter', async () => {
    const wrapper = await mountSuspended(BasePasswordField, { props: { hint: 'Sua senha atual.' } });
    expect(wrapper.text()).toContain('Sua senha atual.');
    expect(wrapper.find('[data-testid="strength-meter"]').exists()).toBe(false);
  });
});

describe('BaseMaskedField', () => {
  async function mountMask(mask: 'cpf' | 'cnpj' | 'phone' | 'cep' | 'money', modelValue: string | number) {
    const wrapper = await mountSuspended(BaseMaskedField, {
      props: {
        mask,
        label: 'Campo',
        modelValue,
        'onUpdate:modelValue': (value: string | number) => wrapper.setProps({ modelValue: value }),
      },
    });
    return wrapper;
  }

  it('shows formatted CPF and stores digits', async () => {
    const wrapper = await mountMask('cpf', '52998224725');
    const input = wrapper.get('input');
    expect(input.element.value).toBe('529.982.247-25');
    expect(input.attributes()).toMatchObject({ inputmode: 'numeric', maxlength: '14', autocomplete: 'off' });
    await input.setValue('111.444.777-3599');
    expect(wrapper.props('modelValue')).toBe('11144477735');
    expect(input.element.value).toBe('111.444.777-35');
  });

  it('uses the phone keyboard and placeholder', async () => {
    const wrapper = await mountMask('phone', '');
    expect(wrapper.get('input').attributes('inputmode')).toBe('tel');
    expect(wrapper.get('input').attributes('placeholder')).toBe('(19) 99999-9999');
    await wrapper.get('input').setValue('19998765432');
    expect(wrapper.get('input').element.value).toBe('(19) 99876-5432');
  });

  it('types money from the right as cents', async () => {
    const wrapper = await mountMask('money', 0);
    const input = wrapper.get('input');
    expect(input.element.value).toBe('R$ 0,00');
    expect(input.attributes('placeholder')).toBe('R$ 0,00');
    await input.setValue('R$ 0,001');
    expect(wrapper.props('modelValue')).toBe(1);
    await input.setValue('R$ 0,0123');
    expect(wrapper.props('modelValue')).toBe(123);
    expect(input.element.value).toBe('R$ 1,23');
  });

  it('accepts custom placeholder, autocomplete and errors', async () => {
    const wrapper = await mountSuspended(BaseMaskedField, {
      props: {
        mask: 'cep',
        label: 'CEP',
        placeholder: 'Seu CEP',
        autocomplete: 'postal-code',
        error: 'CEP inválido',
      },
    });
    const input = wrapper.get('input');
    expect(input.attributes('placeholder')).toBe('Seu CEP');
    expect(input.attributes('autocomplete')).toBe('postal-code');
    expect(input.attributes('aria-invalid')).toBe('true');
  });

  it('treats an empty money model as zero', async () => {
    const wrapper = await mountSuspended(BaseMaskedField, { props: { mask: 'money', label: 'Preço' } });
    expect(wrapper.get('input').element.value).toBe('R$ 0,00');
  });
});

describe('BaseCheckbox and BaseSwitch', () => {
  it('checkbox toggles with click and links its description', async () => {
    const wrapper = await mountSuspended(BaseCheckbox, {
      props: {
        label: 'Aceito',
        description: 'Política de privacidade',
        modelValue: false,
        'onUpdate:modelValue': (value: boolean) => wrapper.setProps({ modelValue: value }),
      },
    });
    const box = wrapper.get('button[role="checkbox"]');
    expect(box.attributes('aria-describedby')).toBe(`${box.attributes('id')}-description`);
    await box.trigger('click');
    expect(wrapper.props('modelValue')).toBe(true);
    expect(wrapper.get('label').attributes('for')).toBe(box.attributes('id'));
  });

  it('checkbox can be disabled', async () => {
    const wrapper = await mountSuspended(BaseCheckbox, { props: { label: 'Off', disabled: true } });
    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
    expect(wrapper.get('button').attributes('aria-describedby')).toBeUndefined();
  });

  it('switch toggles and can be disabled', async () => {
    const wrapper = await mountSuspended(BaseSwitch, {
      props: {
        label: 'Avisar',
        description: 'Por email',
        modelValue: false,
        'onUpdate:modelValue': (value: boolean) => wrapper.setProps({ modelValue: value }),
      },
    });
    const control = wrapper.get('button[role="switch"]');
    await control.trigger('click');
    expect(wrapper.props('modelValue')).toBe(true);
    expect(control.attributes('aria-describedby')).toContain('description');
    const off = await mountSuspended(BaseSwitch, { props: { label: 'Off', disabled: true } });
    expect(off.get('button').attributes('disabled')).toBeDefined();
    expect(off.get('button').attributes('aria-describedby')).toBeUndefined();
  });
});

describe('BaseSelect', () => {
  const options = [
    { value: 'mm', label: 'Mogi Mirim', description: 'Sem taxa' },
    { value: 'mg', label: 'Mogi Guaçu' },
    { value: 'it', label: 'Itapira' },
  ];

  it('shows the chosen label and filters by typing', async () => {
    const wrapper = await mountSuspended(BaseSelect, {
      props: {
        label: 'Cidade',
        options,
        modelValue: 'mg',
        error: 'Escolha uma cidade',
        'onUpdate:modelValue': (value: string | undefined) => wrapper.setProps({ modelValue: value }),
      },
      attachTo: document.body,
    });
    const input = wrapper.get('input');
    expect(input.element.value).toBe('Mogi Guaçu');
    expect(input.attributes('role')).toBe('combobox');
    expect(input.attributes('aria-invalid')).toBe('true');

    await input.trigger('click');
    await flushPromises();
    expect(document.body.textContent).toContain('Sem taxa');

    await input.setValue('ita');
    await flushPromises();
    const items = [...document.querySelectorAll('[role="option"]')];
    expect(items.map((item) => item.textContent?.trim())).toEqual(['Itapira']);

    await input.trigger('keydown', { key: 'ArrowDown' });
    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(wrapper.props('modelValue')).toBe('it');
    wrapper.unmount();
  });

  it('shows the empty message when nothing matches', async () => {
    const wrapper = await mountSuspended(BaseSelect, {
      props: { label: 'Cidade', options, emptyText: 'Não atendemos essa cidade.' },
      attachTo: document.body,
    });
    const input = wrapper.get('input');
    await input.trigger('click');
    await input.setValue('zzz');
    await flushPromises();
    expect(document.body.textContent).toContain('Não atendemos essa cidade.');
    expect(input.element.placeholder).toBe('Selecione ou digite para buscar');
    wrapper.unmount();
  });
});

describe('BasePhotoUpload', () => {
  const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubBrowser() {
    let n = 0;
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => `blob:${++n}`), revokeObjectURL: vi.fn() });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('no canvas in tests');
      }),
    );
  }

  function pick(input: HTMLInputElement, files: File[]) {
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  it('adds compressed photos from the gallery, previews and removes them', async () => {
    stubBrowser();
    const wrapper = await mountSuspended(BasePhotoUpload, {
      props: {
        max: 2,
        hint: 'Até 2 fotos.',
        modelValue: [],
        'onUpdate:modelValue': (files: File[]) => wrapper.setProps({ modelValue: files }),
      },
    });
    expect(wrapper.text()).toContain('0 de 2 fotos · Até 2 fotos.');
    const camera = wrapper.get('input[capture="environment"]');
    expect(camera.attributes('accept')).toBe('image/*');
    const gallery = wrapper.get('input[multiple]');

    pick(gallery.element as HTMLInputElement, [
      photo('a.jpg'),
      new File(['x'], 'b.pdf', { type: 'application/pdf' }),
    ]);
    await nextTick();
    expect(wrapper.text()).toContain('Preparando as fotos…');
    await flushPromises();
    expect(wrapper.props('modelValue')).toHaveLength(1);
    expect(wrapper.emitted('change')).toHaveLength(1);
    expect(wrapper.get('img').attributes('alt')).toBe('Foto 1: a.jpg');

    pick(wrapper.get('input[capture]').element as HTMLInputElement, [photo('b.jpg'), photo('c.jpg')]);
    await flushPromises();
    expect(wrapper.props('modelValue')).toHaveLength(2);
    expect(wrapper.find('[data-testid="dropzone"]').exists()).toBe(false);

    await wrapper.get('button[aria-label="Remover foto 1"]').trigger('click');
    expect(wrapper.props('modelValue')).toHaveLength(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1');
    wrapper.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:2');
  });

  it('ignores an empty pick and accepts dropped files', async () => {
    stubBrowser();
    const wrapper = await mountSuspended(BasePhotoUpload, {
      props: {
        error: 'Envie pelo menos uma foto.',
        modelValue: [],
        'onUpdate:modelValue': (files: File[]) => wrapper.setProps({ modelValue: files }),
      },
    });
    expect(wrapper.text()).toContain('Envie pelo menos uma foto.');
    pick(wrapper.get('input[multiple]').element as HTMLInputElement, []);
    await flushPromises();
    expect(wrapper.emitted('change')).toBeUndefined();

    const zone = wrapper.get('[data-testid="dropzone"]');
    await zone.trigger('dragover');
    expect(zone.classes()).toContain('border-primary');
    await zone.trigger('dragleave');
    expect(zone.classes()).toContain('border-danger');
    await zone.trigger('drop', { dataTransfer: { files: [photo('d.jpg')] } });
    await flushPromises();
    expect(wrapper.props('modelValue')).toHaveLength(1);
    await zone.trigger('drop', { dataTransfer: null });
    await nextTick();
    expect(wrapper.props('modelValue')).toHaveLength(1);
  });
});
