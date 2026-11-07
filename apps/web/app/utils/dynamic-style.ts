import type { ObjectDirective } from 'vue';

/** CSS declarations by property name in kebab case, such as `{ 'background-color': '#184E86' }`. */
export type DynamicStyle = Readonly<Record<string, string>>;

/** Sets the declarations of `next` and removes the ones only `previous` had, through the CSSOM. */
export function applyDynamicStyle(element: HTMLElement, next: DynamicStyle, previous: DynamicStyle): void {
  for (const property of Object.keys(previous)) {
    if (!(property in next)) element.style.removeProperty(property);
  }
  for (const [property, value] of Object.entries(next)) element.style.setProperty(property, value);
}

/**
 * `v-dynamic-style`, the replacement for `:style`. The CSP blocks style attributes (no 'unsafe-inline' in
 * style-src, docs/SEGURANCA.md), and a `:style` binding renders one in the server HTML. Writes through the
 * CSSOM are allowed, so this directive renders nothing on the server and sets the values once the element
 * exists in the browser. Values known at build time belong in classes instead.
 */
export const dynamicStyleDirective: ObjectDirective<HTMLElement, DynamicStyle> = {
  mounted: (element, { value }) => applyDynamicStyle(element, value, {}),
  updated: (element, { value, oldValue }) => applyDynamicStyle(element, value, oldValue ?? {}),
  getSSRProps: () => ({}),
};

declare module 'vue' {
  interface GlobalDirectives {
    vDynamicStyle: typeof dynamicStyleDirective;
  }
}
