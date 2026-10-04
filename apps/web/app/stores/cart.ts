import type { ApiSchemas } from '@rc/contracts';
import { defineStore } from 'pinia';

export type Cart = ApiSchemas['Cart'];
export type CartLine = Cart['items'][number];
export type CartProduct = CartLine['product'];

/** Visitor cart line kept in this browser, with a copy of the product so the cart shows without the API. */
export interface GuestLine {
  productId: number;
  quantity: number;
  product: CartProduct;
}

export const GUEST_CART_KEY = 'rc-cart';
/** Limits of the API (PUT /me/cart/items and POST /me/cart/merge). */
export const MAX_QUANTITY = 99;
export const MAX_LINES = 50;

function isGuestLine(value: unknown): value is GuestLine {
  if (typeof value !== 'object' || value === null) return false;
  const line = value as Partial<GuestLine>;
  return (
    typeof line.productId === 'number' &&
    typeof line.quantity === 'number' &&
    line.quantity > 0 &&
    typeof line.product?.slug === 'string' &&
    typeof line.product.priceCents === 'number'
  );
}

function readGuest(): GuestLine[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(GUEST_CART_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isGuestLine).slice(0, MAX_LINES) : [];
  } catch {
    return [];
  }
}

function writeGuest(lines: GuestLine[]): void {
  try {
    if (lines.length === 0) localStorage.removeItem(GUEST_CART_KEY);
    else localStorage.setItem(GUEST_CART_KEY, JSON.stringify(lines));
  } catch {
    // Storage blocked or full: the cart still works until the page is closed.
  }
}

/** Same line the API answers for a signed in cart, computed from the copy kept in the browser. */
export function guestLineView(line: GuestLine): CartLine {
  const stock = line.product.stockAvailable;
  const problem = stock <= 0 ? 'unavailable' : line.quantity > stock ? 'insufficient' : null;
  return {
    product: line.product,
    quantity: line.quantity,
    subtotalCents: line.product.priceCents * line.quantity,
    problem,
  };
}

/** Product fields the cart keeps, from a catalog or detail answer. */
export function cartProductOf(product: ProductSummary | ProductDetail): CartProduct {
  const cover = 'cover' in product ? product.cover : (product.images[0] ?? null);
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    priceCents: product.priceCents,
    stockAvailable: product.stockAvailable,
    cover: cover ? { width: cover.width, height: cover.height, url: cover.url, srcset: cover.srcset } : null,
  };
}

/**
 * Cart of RF-21 (UC Comprar Produto). Visitors keep it in localStorage; signed in people use /me/cart, and
 * signing in merges the visitor cart into the account (POST /me/cart/merge). Quantities never pass the stock.
 */
export const useCartStore = defineStore('cart', () => {
  const auth = useAuthStore();
  const api = useApi();
  const toast = useToast();

  const guest = ref<GuestLine[]>([]);
  const server = ref<Cart | null>(null);
  /** True once the cart of the current person was read, so pages can show skeletons until then. */
  const loaded = ref(false);
  const busy = ref(false);
  let merging: Promise<void> | null = null;

  const remote = computed(() => auth.signedIn);
  const items = computed<CartLine[]>(() =>
    remote.value ? (server.value?.items ?? []) : guest.value.map(guestLineView),
  );
  const count = computed(() => items.value.reduce((sum, line) => sum + line.quantity, 0));
  const totalCents = computed(() => items.value.reduce((sum, line) => sum + line.subtotalCents, 0));
  const ready = computed(() => items.value.length > 0 && items.value.every((line) => line.problem === null));

  function quantityOf(productId: number): number {
    return items.value.find((line) => line.product.id === productId)?.quantity ?? 0;
  }

  function saveGuest(lines: GuestLine[]): void {
    guest.value = lines;
    writeGuest(lines);
  }

  /** Runs a change of the signed in cart; a refused change shows the reason and keeps the cart as it was. */
  async function change(action: () => Promise<Cart>): Promise<boolean> {
    busy.value = true;
    try {
      server.value = await action();
      return true;
    } catch (error) {
      toast.error({ title: toApiError(error).message });
      return false;
    } finally {
      busy.value = false;
    }
  }

  /** Puts a line at an exact quantity, capped by the stock and the API limit. */
  async function setQuantity(product: CartProduct, wanted: number): Promise<boolean> {
    const quantity = Math.min(Math.max(1, Math.floor(wanted)), MAX_QUANTITY);
    if (remote.value) {
      return change(() =>
        unwrap(
          api.PUT('/api/v1/me/cart/items/{productId}', {
            params: { path: { productId: product.id } },
            body: { quantity },
          }),
        ),
      );
    }
    const existing = guest.value.some((line) => line.productId === product.id);
    if (!existing && guest.value.length >= MAX_LINES) {
      toast.error({ title: `O carrinho aceita até ${MAX_LINES} produtos diferentes.` });
      return false;
    }
    const capped = Math.min(quantity, Math.max(product.stockAvailable, 1));
    const line: GuestLine = { productId: product.id, quantity: capped, product };
    saveGuest(
      existing
        ? guest.value.map((item) => (item.productId === product.id ? line : item))
        : [...guest.value, line],
    );
    return true;
  }

  /** Adds units of a product on top of what is already in the cart. */
  async function add(product: CartProduct, quantity = 1): Promise<boolean> {
    const total = quantityOf(product.id) + quantity;
    if (total > product.stockAvailable) {
      toast.error({
        title:
          product.stockAvailable === 0
            ? 'Este produto acabou de esgotar.'
            : `Temos só ${countLabel(product.stockAvailable, 'unidade disponível', 'unidades disponíveis')}.`,
      });
      return false;
    }
    const done = await setQuantity(product, total);
    if (done) {
      toast.success({
        title: `${product.name} no carrinho.`,
        description: countLabel(total, 'unidade', 'unidades'),
      });
    }
    return done;
  }

  async function remove(productId: number): Promise<boolean> {
    if (remote.value) {
      return change(() =>
        unwrap(api.DELETE('/api/v1/me/cart/items/{productId}', { params: { path: { productId } } })),
      );
    }
    saveGuest(guest.value.filter((line) => line.productId !== productId));
    return true;
  }

  /** Visitor cart: refreshes price and stock of each copy, since they may have changed since it was added. */
  async function refreshGuest(): Promise<void> {
    const lines = await Promise.all(
      guest.value.map(async (line) => {
        try {
          const product = await unwrap(
            api.GET('/api/v1/products/{id}', { params: { path: { id: line.product.slug } } }),
          );
          return { ...line, product: cartProductOf(product) };
        } catch (error) {
          // A product that no longer exists stays as unavailable; a network failure keeps the copy.
          if (toApiError(error).status !== 404) return line;
          return { ...line, product: { ...line.product, stockAvailable: 0 } };
        }
      }),
    );
    saveGuest(lines);
  }

  /** Reads the cart of the current person: the account cart, or the visitor cart with fresh prices. */
  async function load(): Promise<void> {
    // Right after signing in, the merge decides the account cart; reading before it ends could show it empty.
    await merging;
    try {
      if (remote.value) server.value = await unwrap(api.GET('/api/v1/me/cart'));
      else {
        guest.value = readGuest();
        await refreshGuest();
      }
    } catch {
      // Without a connection the page shows what it has; the next visit tries again.
    } finally {
      loaded.value = true;
    }
  }

  /** After signing in: joins the visitor cart into the account (capped by stock) and forgets the local copy. */
  function syncAfterSignIn(): Promise<void> {
    merging = mergeGuest();
    return merging;
  }

  async function mergeGuest(): Promise<void> {
    const lines = readGuest();
    try {
      server.value =
        lines.length > 0
          ? await unwrap(
              api.POST('/api/v1/me/cart/merge', {
                body: { items: lines.map(({ productId, quantity }) => ({ productId, quantity })) },
              }),
            )
          : await unwrap(api.GET('/api/v1/me/cart'));
      if (lines.length > 0) saveGuest([]);
      loaded.value = true;
    } catch {
      // The visitor cart stays in this browser and is merged on the next sign in.
    }
  }

  /** Back to the visitor cart of this browser, after signing out. */
  function switchToGuest(): void {
    server.value = null;
    guest.value = readGuest();
    loaded.value = true;
  }

  /** The API empties the account cart when the order is placed. */
  function clearAfterOrder(): void {
    server.value = { items: [], itemCount: 0, totalCents: 0, ready: false };
    saveGuest([]);
  }

  return {
    guest,
    server,
    loaded,
    busy,
    items,
    count,
    totalCents,
    ready,
    quantityOf,
    add,
    setQuantity,
    remove,
    load,
    syncAfterSignIn,
    switchToGuest,
    clearAfterOrder,
  };
});
