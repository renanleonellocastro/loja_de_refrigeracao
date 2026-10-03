import type { Ref } from 'vue';

/** Items in the cart, shown on the header badge. Milestone M5 replaces this state with the cart store. */
export function useCartCount(): Ref<number> {
  return useState<number>('cart-count', () => 0);
}
