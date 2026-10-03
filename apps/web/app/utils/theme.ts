export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'rc-theme';

export const THEME_OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Automático' },
];

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** Reads the saved preference. Storage may be missing or throw (private mode, blocked site data). */
export function readThemePreference(storage: () => Pick<Storage, 'getItem'>): ThemePreference {
  try {
    const saved = storage().getItem(THEME_STORAGE_KEY);
    return isThemePreference(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

export function writeThemePreference(
  storage: () => Pick<Storage, 'setItem'>,
  preference: ThemePreference,
): void {
  try {
    storage().setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The choice still applies to this visit; it just is not remembered.
  }
}

/** Explicit choices set `data-theme`; "system" removes it so the CSS media query decides. */
export function applyThemePreference(root: HTMLElement, preference: ThemePreference): void {
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
}

/**
 * Runs in <head> before the first paint so a saved theme never flashes the other one.
 * Kept as a string because nuxt.config.ts inlines it.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;
