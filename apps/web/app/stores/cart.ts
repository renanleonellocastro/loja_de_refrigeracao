import type { ApiSchemas } from '@rc/contracts';
import { defineStore } from 'pinia';
import type { ComputedRef, Ref } from 'vue';

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

interface CartState {
  guest: Ref<GuestLine[]>;
  server: Ref<Cart | null>;
  /** True once the cart of the current person was read, so pages can show skeletons until then. */
  loaded: Ref<boolean>;
  busy: Ref<boolean>;
}

type CartToast = Pick<ReturnType<typeof useToast>, 'error' | 'success'>;

/** Where the lines of the cart live: this browser for visitors, the account for signed in people. */
interface CartBackend {
  setQuantity(product: CartProduct, quantity: number): Promise<boolean>;
  remove(productId: number): Promise<boolean>;
  load(): Promise<void>;
}

const EMPTY_CART: Readonly<Cart> = { items: [], itemCount: 0, totalCents: 0, ready: false };

function clampQuantity(wanted: number): number {
  return Math.min(Math.max(1, Math.floor(wanted)), MAX_QUANTITY);
}

function stockLimitMessage(stockAvailable: number): string {
  if (stockAvailable === 0) return 'Este produto acabou de esgotar.';
  return `Temos só ${countLabel(stockAvailable, 'unidade disponível', 'unidades disponíveis')}.`;
}

/** Fresh price and stock of a visitor line, since they may have changed since it was added. */
async function refreshGuestLine(api: Api, line: GuestLine): Promise<GuestLine> {
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
}

function withLine(lines: readonly GuestLine[], line: GuestLine): GuestLine[] {
  const exists = lines.some((item) => item.productId === line.productId);
  if (!exists) return [...lines, line];
  return lines.map((item) => (item.productId === line.productId ? line : item));
}

/** Visitor cart kept in localStorage, with a copy of each product. */
class GuestCart implements CartBackend {
  private readonly state: CartState;
  private readonly api: Api;
  private readonly toast: CartToast;

  constructor(state: CartState, api: Api, toast: CartToast) {
    this.state = state;
    this.api = api;
    this.toast = toast;
  }

  async setQuantity(product: CartProduct, quantity: number): Promise<boolean> {
    if (this.isFullFor(product.id)) {
      this.toast.error({ title: `O carrinho aceita até ${MAX_LINES} produtos diferentes.` });
      return false;
    }
    const capped = Math.min(quantity, Math.max(product.stockAvailable, 1));
    this.save(withLine(this.state.guest.value, { productId: product.id, quantity: capped, product }));
    return true;
  }

  async remove(productId: number): Promise<boolean> {
    this.save(this.state.guest.value.filter((line) => line.productId !== productId));
    return true;
  }

  async load(): Promise<void> {
    this.state.guest.value = readGuest();
    this.save(await Promise.all(this.state.guest.value.map((line) => refreshGuestLine(this.api, line))));
  }

  /** Back to the visitor cart of this browser. */
  reload(): void {
    this.state.guest.value = readGuest();
  }

  save(lines: GuestLine[]): void {
    this.state.guest.value = lines;
    writeGuest(lines);
  }

  private isFullFor(productId: number): boolean {
    const lines = this.state.guest.value;
    return !lines.some((line) => line.productId === productId) && lines.length >= MAX_LINES;
  }
}

/** Cart of the signed in person, kept by the API (/me/cart). */
class AccountCart implements CartBackend {
  private readonly state: CartState;
  private readonly api: Api;
  private readonly toast: CartToast;

  constructor(state: CartState, api: Api, toast: CartToast) {
    this.state = state;
    this.api = api;
    this.toast = toast;
  }

  setQuantity(product: CartProduct, quantity: number): Promise<boolean> {
    return this.change(() =>
      unwrap(
        this.api.PUT('/api/v1/me/cart/items/{productId}', {
          params: { path: { productId: product.id } },
          body: { quantity },
        }),
      ),
    );
  }

  remove(productId: number): Promise<boolean> {
    return this.change(() =>
      unwrap(this.api.DELETE('/api/v1/me/cart/items/{productId}', { params: { path: { productId } } })),
    );
  }

  async load(): Promise<void> {
    this.state.server.value = await this.fetchCart();
  }

  /** Joins visitor lines into the account cart (the API caps them by stock); no lines just reads it. */
  async merge(lines: readonly GuestLine[]): Promise<void> {
    if (lines.length === 0) {
      this.state.server.value = await this.fetchCart();
      return;
    }
    const items = lines.map(({ productId, quantity }) => ({ productId, quantity }));
    this.state.server.value = await unwrap(this.api.POST('/api/v1/me/cart/merge', { body: { items } }));
  }

  private fetchCart(): Promise<Cart> {
    return unwrap(this.api.GET('/api/v1/me/cart'));
  }

  /** Runs a change of the signed in cart; a refused change shows the reason and keeps the cart as it was. */
  private async change(action: () => Promise<Cart>): Promise<boolean> {
    this.state.busy.value = true;
    try {
      this.state.server.value = await action();
      return true;
    } catch (error) {
      this.toast.error({ title: toApiError(error).message });
      return false;
    } finally {
      this.state.busy.value = false;
    }
  }
}

/** Collaborators of the cart actions: the two places a cart lives and how to tell which one is in use. */
interface CartParts {
  state: CartState;
  isRemote: ComputedRef<boolean>;
  items: ComputedRef<CartLine[]>;
  guest: GuestCart;
  account: AccountCart;
  toast: CartToast;
}

/** Actions of the cart, sent to the visitor or the account cart depending on who is signed in. */
class CartKeeper {
  private merging: Promise<void> | null = null;
  private readonly parts: CartParts;

  constructor(parts: CartParts) {
    this.parts = parts;
  }

  quantityOf(productId: number): number {
    return this.parts.items.value.find((line) => line.product.id === productId)?.quantity ?? 0;
  }

  /** Puts a line at an exact quantity, capped by the stock and the API limit. */
  setQuantity(product: CartProduct, wanted: number): Promise<boolean> {
    return this.backend().setQuantity(product, clampQuantity(wanted));
  }

  /** Adds units of a product on top of what is already in the cart. */
  async add(product: CartProduct, quantity = 1): Promise<boolean> {
    const total = this.quantityOf(product.id) + quantity;
    if (total > product.stockAvailable) {
      this.parts.toast.error({ title: stockLimitMessage(product.stockAvailable) });
      return false;
    }
    const done = await this.setQuantity(product, total);
    if (done) this.announceAdded(product, total);
    return done;
  }

  remove(productId: number): Promise<boolean> {
    return this.backend().remove(productId);
  }

  /** Reads the cart of the current person: the account cart, or the visitor cart with fresh prices. */
  async load(): Promise<void> {
    // Right after signing in, the merge decides the account cart; reading before it ends could show it empty.
    await this.merging;
    try {
      await this.backend().load();
    } catch {
      // Without a connection the page shows what it has; the next visit tries again.
    } finally {
      this.parts.state.loaded.value = true;
    }
  }

  /** After signing in: joins the visitor cart into the account (capped by stock) and forgets the local copy. */
  syncAfterSignIn(): Promise<void> {
    this.merging = this.mergeGuest();
    return this.merging;
  }

  /** Back to the visitor cart of this browser, after signing out. */
  switchToGuest(): void {
    this.parts.state.server.value = null;
    this.parts.guest.reload();
    this.parts.state.loaded.value = true;
  }

  /** The API empties the account cart when the order is placed. */
  clearAfterOrder(): void {
    this.parts.state.server.value = { ...EMPTY_CART, items: [] };
    this.parts.guest.save([]);
  }

  private backend(): CartBackend {
    return this.parts.isRemote.value ? this.parts.account : this.parts.guest;
  }

  private announceAdded(product: CartProduct, total: number): void {
    this.parts.toast.success({
      title: `${product.name} no carrinho.`,
      description: countLabel(total, 'unidade', 'unidades'),
    });
  }

  private async mergeGuest(): Promise<void> {
    const lines = readGuest();
    try {
      await this.parts.account.merge(lines);
      if (lines.length > 0) this.parts.guest.save([]);
      this.parts.state.loaded.value = true;
    } catch {
      // The visitor cart stays in this browser and is merged on the next sign in.
    }
  }
}

function createCartState(): CartState {
  return {
    guest: ref<GuestLine[]>([]),
    server: ref<Cart | null>(null),
    loaded: ref(false),
    busy: ref(false),
  };
}

function sumOf(lines: readonly CartLine[], amount: (line: CartLine) => number): number {
  return lines.reduce((sum, line) => sum + amount(line), 0);
}

function cartGetters(state: CartState, isRemote: ComputedRef<boolean>) {
  const items = computed<CartLine[]>(() =>
    isRemote.value ? (state.server.value?.items ?? []) : state.guest.value.map(guestLineView),
  );
  const count = computed(() => sumOf(items.value, (line) => line.quantity));
  const totalCents = computed(() => sumOf(items.value, (line) => line.subtotalCents));
  const ready = computed(() => items.value.length > 0 && items.value.every((line) => line.problem === null));
  return { items, count, totalCents, ready };
}

function createCartKeeper(
  state: CartState,
  getters: ReturnType<typeof cartGetters>,
  isRemote: ComputedRef<boolean>,
) {
  const api = useApi();
  const toast = useToast();
  const guest = new GuestCart(state, api, toast);
  const account = new AccountCart(state, api, toast);
  return new CartKeeper({ state, isRemote, items: getters.items, guest, account, toast });
}

function cartActions(keeper: CartKeeper) {
  return {
    quantityOf: keeper.quantityOf.bind(keeper),
    add: keeper.add.bind(keeper),
    setQuantity: keeper.setQuantity.bind(keeper),
    remove: keeper.remove.bind(keeper),
    load: keeper.load.bind(keeper),
    syncAfterSignIn: keeper.syncAfterSignIn.bind(keeper),
    switchToGuest: keeper.switchToGuest.bind(keeper),
    clearAfterOrder: keeper.clearAfterOrder.bind(keeper),
  };
}

/**
 * Cart of RF-21 (UC Comprar Produto). Visitors keep it in localStorage; signed in people use /me/cart, and
 * signing in merges the visitor cart into the account (POST /me/cart/merge). Quantities never pass the stock.
 */
export const useCartStore = defineStore('cart', () => {
  const auth = useAuthStore();
  const state = createCartState();
  const isRemote = computed(() => auth.signedIn);
  const getters = cartGetters(state, isRemote);
  const keeper = createCartKeeper(state, getters, isRemote);
  return { ...state, ...getters, ...cartActions(keeper) };
});
