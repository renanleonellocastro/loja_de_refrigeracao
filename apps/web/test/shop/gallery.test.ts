import { mountSuspended } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CatalogGallery from '~/components/catalog/Gallery.vue';
import { detail } from '../support/shop';

afterEach(() => {
  document.body.innerHTML = '';
});

async function mountGallery() {
  const wrapper = await mountSuspended(CatalogGallery, {
    props: { images: detail().images, name: 'Compressor' },
    attachTo: document.body,
  });
  const track = wrapper.get('[role="region"]').element as HTMLElement;
  Object.defineProperty(track, 'clientWidth', { value: 300, configurable: true });
  track.scrollTo = vi.fn();
  return { wrapper, track };
}

function dialog(): HTMLElement {
  return document.querySelector('[role="dialog"]')!;
}

function control(label: string): HTMLButtonElement {
  return dialog().querySelector(`[aria-label="${label}"]`)!;
}

async function press(key: string): Promise<KeyboardEvent> {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  dialog().querySelector('[aria-roledescription="foto ampliável"]')!.dispatchEvent(event);
  await flushPromises();
  return event;
}

async function pointer(type: string, clientX: number, pointerId = 1): Promise<void> {
  const stage = dialog().querySelector('[aria-roledescription="foto ampliável"]')!;
  stage.dispatchEvent(new PointerEvent(type, { pointerId, clientX, clientY: 0, bubbles: true }));
  await flushPromises();
}

async function openZoom(wrapper: Awaited<ReturnType<typeof mountGallery>>['wrapper'], photo: number) {
  await wrapper.get(`button[aria-label="Ampliar foto ${photo}"]`).trigger('click');
  await flushPromises();
  await vi.waitFor(() => expect(dialog()).not.toBeNull());
}

describe('CatalogGallery', () => {
  it('swipes, follows the arrows and the thumbnails', async () => {
    const { wrapper, track } = await mountGallery();
    const next = wrapper.get('button[aria-label="Próxima foto"]');
    const previous = wrapper.get('button[aria-label="Foto anterior"]');
    expect(previous.attributes('disabled')).toBeDefined();
    await next.trigger('click');
    expect(track.scrollTo).toHaveBeenCalledWith({ left: 300, behavior: 'smooth' });
    expect(wrapper.text()).toContain('2/2');
    expect(next.attributes('disabled')).toBeDefined();
    await previous.trigger('click');
    await wrapper.findAll('[aria-label^="Ver foto"]')[1]!.trigger('click');
    expect(wrapper.get('[aria-label="Ver foto 2"]').attributes('aria-current')).toBe('true');
    track.scrollLeft = 0;
    await wrapper.get('[role="region"]').trigger('scroll');
    expect(wrapper.text()).toContain('1/2');
    Object.defineProperty(track, 'clientWidth', { value: 0, configurable: true });
    await wrapper.get('[role="region"]').trigger('scroll');
    expect(wrapper.text()).toContain('1/2');
    expect(wrapper.findAll('img')[1]!.attributes('alt')).toBe('Compressor, foto 2');
    wrapper.unmount();
  });

  it('shows the placeholder without photos and no arrows for one photo', async () => {
    const none = await mountSuspended(CatalogGallery, { props: { images: [], name: 'Peça' } });
    expect(none.get('img').attributes('src')).toBe('/illustrations/produto-sem-foto.svg');
    expect(none.find('button').exists()).toBe(false);
    const one = await mountSuspended(CatalogGallery, {
      props: { images: detail().images.slice(0, 1), name: 'Peça' },
    });
    expect(one.find('button[aria-label="Próxima foto"]').exists()).toBe(false);
    expect(one.find('button[aria-label="Ampliar foto 1"]').exists()).toBe(true);
  });
});

describe('CatalogGalleryZoom', () => {
  it('zooms with the buttons and the keys, and changes the photo', async () => {
    const { wrapper } = await mountGallery();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await openZoom(wrapper, 1);
    expect(dialog().textContent).toContain('Compressor');
    expect(dialog().textContent).toContain('100%');
    expect(control('Reduzir').disabled).toBe(true);
    control('Ampliar').click();
    await flushPromises();
    expect(dialog().textContent).toContain('150%');
    control('Reduzir').click();
    await flushPromises();
    expect(dialog().textContent).toContain('100%');
    expect((await press('+')).defaultPrevented).toBe(true);
    expect(dialog().textContent).toContain('150%');
    expect((await press('a')).defaultPrevented).toBe(false);
    await press('0');
    await press('ArrowLeft');
    expect(dialog().textContent).toContain('1/2');
    await press('ArrowRight');
    expect(dialog().textContent).toContain('2/2');
    expect(control('Próxima foto').disabled).toBe(true);
    expect(dialog().querySelector('img')!.getAttribute('alt')).toBe('Compressor, foto 2');
    control('Foto anterior').click();
    await flushPromises();
    expect(dialog().textContent).toContain('1/2');
    control('Próxima foto').click();
    await flushPromises();
    wrapper.unmount();
  });

  it('follows the pointer and the wheel, and returns to the last photo seen', async () => {
    const { wrapper, track } = await mountGallery();
    await openZoom(wrapper, 1);
    await pointer('pointerdown', 200);
    await pointer('pointermove', 150);
    await pointer('pointerup', 100);
    expect(dialog().textContent).toContain('2/2');
    await pointer('pointerdown', 0);
    await pointer('pointercancel', 0);
    const stage = dialog().querySelector('[aria-roledescription="foto ampliável"]')!;
    stage.dispatchEvent(new WheelEvent('wheel', { deltaY: -500, bubbles: true, cancelable: true }));
    await flushPromises();
    expect(dialog().textContent).not.toContain('100%');
    control('Fechar').click();
    await flushPromises();
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
    expect(track.scrollTo).toHaveBeenLastCalledWith({ left: 300, behavior: 'smooth' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Ampliar foto 2');
    await openZoom(wrapper, 1);
    expect(dialog().textContent).toContain('100%');
    expect(dialog().textContent).toContain('1/2');
    wrapper.unmount();
  });
});
