/**
 * Refrigeração Castro brand tokens. Colors come from the storefront: the blue wall,
 * the silver relief letters and a cold "frost" accent. See docs/DESIGN.md.
 */
export const palette = {
  castro: {
    50: '#EEF4FB',
    100: '#DCE8F6',
    200: '#B5CEEC',
    300: '#86ADDD',
    400: '#4F86C9',
    500: '#2A6DB5',
    600: '#1F5C9E',
    700: '#184E86',
    800: '#133F6D',
    900: '#0E2E52',
    950: '#091D35',
  },
  steel: {
    50: '#F6F7F9',
    100: '#ECEEF1',
    200: '#DDE0E5',
    300: '#C8CCD2',
    400: '#A3A9B2',
    500: '#7D8591',
    600: '#5B6470',
    700: '#454C56',
    800: '#2E333A',
    900: '#1C2026',
    950: '#14181F',
  },
  frost: { 200: '#BAE6FD', 300: '#7DD3FC', 400: '#38BDF8', 500: '#0EA5E9', 600: '#0284C7' },
  success: { 100: '#DCFCE7', 400: '#4ADE80', 600: '#15803D', 800: '#166534' },
  warning: { 100: '#FEF3C7', 400: '#FBBF24', 500: '#F59E0B', 800: '#92400E' },
  danger: { 100: '#FEE2E2', 400: '#F87171', 600: '#DC2626', 800: '#991B1B' },
  white: '#FFFFFF',
} as const;

export type SemanticName =
  | 'bg'
  | 'surface'
  | 'surface-raised'
  | 'surface-sunken'
  | 'border'
  | 'border-strong'
  | 'text'
  | 'text-muted'
  | 'text-inverse'
  | 'primary'
  | 'primary-hover'
  | 'on-primary'
  | 'brand-band'
  | 'on-brand-band'
  | 'accent'
  | 'focus'
  | 'link'
  | 'success'
  | 'success-soft'
  | 'on-success-soft'
  | 'warning'
  | 'warning-soft'
  | 'on-warning-soft'
  | 'danger'
  | 'danger-soft'
  | 'on-danger-soft';

export type SemanticColors = Record<SemanticName, string>;

export const light: SemanticColors = {
  bg: palette.steel[50],
  surface: palette.white,
  'surface-raised': palette.white,
  'surface-sunken': palette.steel[100],
  border: palette.steel[200],
  'border-strong': palette.steel[500],
  text: palette.steel[950],
  'text-muted': palette.steel[600],
  'text-inverse': palette.white,
  primary: palette.castro[700],
  'primary-hover': palette.castro[800],
  'on-primary': palette.white,
  'brand-band': palette.castro[700],
  'on-brand-band': palette.white,
  accent: palette.frost[600],
  focus: palette.frost[600],
  link: palette.castro[700],
  success: palette.success[600],
  'success-soft': palette.success[100],
  'on-success-soft': palette.success[800],
  warning: palette.warning[500],
  'warning-soft': palette.warning[100],
  'on-warning-soft': palette.warning[800],
  danger: palette.danger[600],
  'danger-soft': palette.danger[100],
  'on-danger-soft': palette.danger[800],
};

export const dark: SemanticColors = {
  bg: palette.castro[950],
  surface: '#0F2440',
  'surface-raised': '#15304F',
  'surface-sunken': '#081729',
  border: '#24405F',
  'border-strong': palette.castro[400],
  text: palette.steel[50],
  'text-muted': palette.steel[300],
  'text-inverse': palette.steel[950],
  primary: palette.castro[300],
  'primary-hover': palette.castro[200],
  'on-primary': palette.castro[950],
  'brand-band': palette.castro[800],
  'on-brand-band': palette.white,
  accent: palette.frost[300],
  focus: palette.frost[300],
  link: palette.castro[300],
  success: palette.success[400],
  'success-soft': '#0F3A24',
  'on-success-soft': palette.success[100],
  warning: palette.warning[400],
  'warning-soft': '#3D2A06',
  'on-warning-soft': palette.warning[100],
  danger: palette.danger[400],
  'danger-soft': '#45141A',
  'on-danger-soft': palette.danger[100],
};

export const typography = {
  display: "'Archivo', 'Arial Black', system-ui, sans-serif",
  body: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
} as const;

export const radius = { sm: '6px', md: '10px', lg: '16px', xl: '24px', full: '9999px' } as const;

export const shadow = {
  sm: '0 1px 2px rgb(9 29 53 / 0.08)',
  md: '0 4px 12px rgb(9 29 53 / 0.10), 0 1px 3px rgb(9 29 53 / 0.08)',
  lg: '0 16px 40px rgb(9 29 53 / 0.16), 0 4px 10px rgb(9 29 53 / 0.08)',
} as const;

export const motion = {
  fast: '120ms',
  base: '200ms',
  slow: '320ms',
  ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const;

export const breakpoints = { sm: 480, md: 768, lg: 1024, xl: 1280, '2xl': 1440 } as const;

/** Foreground and background pairs that must meet WCAG AA in both themes. */
export const contrastPairs: ReadonlyArray<{ fg: SemanticName; bg: SemanticName; min: number }> = [
  { fg: 'text', bg: 'bg', min: 4.5 },
  { fg: 'text', bg: 'surface', min: 4.5 },
  { fg: 'text', bg: 'surface-sunken', min: 4.5 },
  { fg: 'text-muted', bg: 'surface', min: 4.5 },
  { fg: 'text-muted', bg: 'bg', min: 4.5 },
  { fg: 'on-primary', bg: 'primary', min: 4.5 },
  { fg: 'on-primary', bg: 'primary-hover', min: 4.5 },
  { fg: 'on-brand-band', bg: 'brand-band', min: 4.5 },
  { fg: 'link', bg: 'surface', min: 4.5 },
  { fg: 'on-success-soft', bg: 'success-soft', min: 4.5 },
  { fg: 'on-warning-soft', bg: 'warning-soft', min: 4.5 },
  { fg: 'on-danger-soft', bg: 'danger-soft', min: 4.5 },
  { fg: 'focus', bg: 'surface', min: 3 },
  { fg: 'border-strong', bg: 'surface', min: 3 },
  { fg: 'danger', bg: 'surface', min: 3 },
];
