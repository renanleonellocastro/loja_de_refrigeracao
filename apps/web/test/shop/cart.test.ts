import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToast } from '~/composables/useToast';
import cartPlugin from '~/plugins/cart.client';
import { useAuthStore } from '~/stores/auth';
import { GUEST_CART_KEY, MAX_LINES, cartProductOf, guestLineView, useCartStore } from '~/stores/cart';
import { mockApi, problem, session } from '../support/api';
import { cart, cartProduct, detail, guestCart, product } from '../support/shop';

const CART = 'GET /api/v1/me/cart';
const MERGE = 'POST /api/v1/me/cart/merge';
const PUT = 'PUT /api/v1/me/cart/items/14';
const DELETE = 'DELETE /api/v1/me/cart/items/14';

const toastTitles = () => useToast().toasts.value.map((toast) => toast.title);
const stored = () => JSON.parse(localStorage.getItem(GUEST_CART_KEY) ?? '[]');

/** Signs in and lets the cart plugin of the app finish its own sync before the test goes on. */
async function signIn(): Promise<void> {
  useAuthStore().apply(session());
  await flushPromises();
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  useAuthStore().clear();
  await flushPromises();
  const store = useCartStore();
  store.guest = [];
  store.server = null;
  store.loaded = false;
  useToast().clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('cart helpers', () => {
  it('computes the problems of a visitor line', () => {
    const line = guestCart(2)[0]!;
    expect(guestLineView(line)).toMatchObject({ subtotalCents: 99800, problem: null });
    expect(guestLineView({ ...line, product: { ...line.product, stockAvailable: 1 } }).problem).toBe(
      'insufficient',
    );
    expect(guestLineView({ ...line, product: { ...line.product, stockAvailable: 0 } }).problem).toBe(
      'unavailable',
    );
  });

  it('keeps the product fields the cart needs', () => {
    expect(cartProductOf(product())).toEqual(cartProduct());
    expect(cartProductOf(product({ cover: null })).cover).toBeNull();
    expect(cartProductOf(detail())).toEqual(cartProduct());
    expect(cartProductOf(detail({ images: [] })).cover).toBeNull();
  });
});

describe('visitor cart', () => {
  it('adds, caps by stock, changes and removes lines in localStorage', async () => {
    mockApi();
    const store = useCartStore();
    expect(await store.add(cartProduct(), 2)).toBe(true);
    expect(toastTitles()).toContain('Compressor Embraco no carrinho.');
    expect(await store.add(cartProduct(), 1)).toBe(true);
    expect(store.count).toBe(3);
    expect(store.quantityOf(14)).toBe(3);
    expect(store.quantityOf(99)).toBe(0);
    expect(stored()[0].quantity).toBe(3);
    expect(await store.add(cartProduct(), 6)).toBe(false);
    expect(toastTitles()).toContain('Temos só 8 unidades disponíveis.');
    expect(await store.add(cartProduct({ id: 15, stockAvailable: 0 }))).toBe(false);
    expect(toastTitles()).toContain('Este produto acabou de esgotar.');
    // The stock dropped after it was added: the quantity cannot pass it.
    await store.setQuantity(cartProduct({ stockAvailable: 2 }), 5.7);
    expect(store.quantityOf(14)).toBe(2);
    await store.setQuantity(cartProduct({ stockAvailable: 0 }), 0);
    expect(store.quantityOf(14)).toBe(1);
    expect(store.totalCents).toBe(49900);
    expect(store.ready).toBe(false);
    expect(await store.remove(14)).toBe(true);
    expect(store.items).toEqual([]);
    expect(localStorage.getItem(GUEST_CART_KEY)).toBeNull();
  });

  it('refuses a new product when the cart is full', async () => {
    mockApi();
    const store = useCartStore();
    store.guest = Array.from({ length: MAX_LINES }, (_, index) => guestCart(1, { id: index + 100 })[0]!);
    expect(await store.setQuantity(cartProduct(), 1)).toBe(false);
    expect(toastTitles()).toContain('O carrinho aceita até 50 produtos diferentes.');
    expect(await store.setQuantity(cartProduct({ id: 100 }), 2)).toBe(true);
    expect(store.quantityOf(100)).toBe(2);
  });

  it('loads the saved cart with fresh prices and stock', async () => {
    localStorage.setItem(
      GUEST_CART_KEY,
      JSON.stringify([
        ...guestCart(1),
        ...guestCart(1, { id: 15, slug: 'sumiu' }),
        ...guestCart(1, { id: 16, slug: 'offline' }),
        { productId: 17, quantity: 0 },
        null,
      ]),
    );
    mockApi()
      .on('GET /api/v1/products/compressor-embraco', { body: detail({ priceCents: 45000 }) })
      .on('GET /api/v1/products/sumiu', problem(404, 'Produto não encontrado.'))
      .on('GET /api/v1/products/offline', new TypeError('offline'));
    const store = useCartStore();
    await store.load();
    expect(store.loaded).toBe(true);
    expect(store.items.map((line) => [line.product.priceCents, line.problem])).toEqual([
      [45000, null],
      [49900, 'unavailable'],
      [49900, null],
    ]);
  });

  it('survives broken or blocked storage', async () => {
    localStorage.setItem(GUEST_CART_KEY, '{oops');
    mockApi();
    const store = useCartStore();
    await store.load();
    expect(store.items).toEqual([]);
    localStorage.setItem(GUEST_CART_KEY, '{"a":1}');
    store.switchToGuest();
    expect(store.items).toEqual([]);
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    expect(await store.add(cartProduct())).toBe(true);
    expect(store.count).toBe(1);
  });
});

describe('signed in cart', () => {
  it('uses the account cart and shows refused changes', async () => {
    const api = mockApi()
      .on(CART, { body: cart([{ quantity: 1 }]) })
      .on(PUT, problem(409, 'Temos 2 unidade(s) disponível(is).'), { body: cart([{ quantity: 2 }]) })
      .on(DELETE, { body: cart([]) });
    await signIn();
    const store = useCartStore();
    await store.load();
    expect(store.count).toBe(1);
    expect(await store.add(cartProduct(), 2)).toBe(false);
    expect(toastTitles()).toContain('Temos 2 unidade(s) disponível(is).');
    expect(await store.add(cartProduct(), 1)).toBe(true);
    expect(api.called(PUT).at(-1)!.body).toEqual({ quantity: 2 });
    expect(store.count).toBe(2);
    expect(store.busy).toBe(false);
    await store.remove(14);
    expect(store.items).toEqual([]);
  });

  it('keeps what it has when the cart cannot load', async () => {
    mockApi().on(CART, new TypeError('offline'));
    await signIn();
    const store = useCartStore();
    await store.load();
    expect(store.loaded).toBe(true);
    expect(store.items).toEqual([]);
  });

  it('empties after the order is placed', async () => {
    mockApi().on(CART, { body: cart([{ quantity: 1 }]) });
    await signIn();
    const store = useCartStore();
    store.clearAfterOrder();
    expect(store.count).toBe(0);
  });
});

describe('cart plugin', () => {
  it('merges the visitor cart on sign in and goes back to it on sign out', async () => {
    const hooks: Record<string, () => void> = {};
    const nuxtApp = { hook: vi.fn((name: string, fn: () => void) => (hooks[name] = fn)) };
    await (cartPlugin as unknown as (app: typeof nuxtApp) => unknown)(nuxtApp);
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(guestCart(2)));
    const api = mockApi()
      .on(MERGE, new TypeError('offline'), new TypeError('offline'), { body: cart([{ quantity: 3 }]) })
      .on(CART, { body: cart([{ quantity: 3 }]) });
    hooks['app:mounted']!();
    const store = useCartStore();
    expect(store.count).toBe(2);
    expect(store.loaded).toBe(true);

    // The merges on sign in fail offline (the app plugin and this one): the visitor cart stays for the next try.
    await signIn();
    expect(api.called(MERGE).length).toBeGreaterThan(0);
    expect(stored()).toHaveLength(1);
    await store.syncAfterSignIn();
    expect(api.called(MERGE).at(-1)!.body).toEqual({ items: [{ productId: 14, quantity: 2 }] });
    expect(store.count).toBe(3);
    expect(localStorage.getItem(GUEST_CART_KEY)).toBeNull();
    await store.load();
    expect(api.called(CART).length).toBeGreaterThan(0);

    // Without a visitor cart, signing in just reads the account cart.
    await store.syncAfterSignIn();
    expect(store.count).toBe(3);

    useAuthStore().clear();
    await flushPromises();
    expect(store.server).toBeNull();
    expect(store.count).toBe(0);
  });
});
