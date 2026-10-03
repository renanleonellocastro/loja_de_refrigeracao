import type { Ref } from 'vue';

const browserStorage = () => window.localStorage;

/** Light, dark or automatic theme. The head script in nuxt.config.ts applies the saved choice before paint. */
export function useTheme(): {
  preference: Ref<ThemePreference>;
  setPreference: (preference: ThemePreference) => void;
} {
  const preference = useState<ThemePreference>('theme-preference', () => 'system');

  onMounted(() => {
    preference.value = readThemePreference(browserStorage);
  });

  function setPreference(next: ThemePreference): void {
    preference.value = next;
    writeThemePreference(browserStorage, next);
    applyThemePreference(document.documentElement, next);
  }

  return { preference, setPreference };
}
