import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.claude/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    // The CSP blocks style attributes (no 'unsafe-inline' in style-src, docs/SEGURANCA.md).
    files: ['apps/web/app/**/*.vue'],
    rules: {
      'vue/no-restricted-v-bind': [
        'error',
        { argument: 'style', message: 'Use classes or v-dynamic-style: the CSP blocks style attributes.' },
      ],
      'vue/no-restricted-static-attribute': [
        'error',
        { key: 'style', message: 'Use classes: the CSP blocks style attributes.' },
      ],
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // TypeScript already reports undefined names, including Nuxt auto imports.
    files: ['**/*.ts', '**/*.vue'],
    rules: { 'no-undef': 'off' },
  },
  {
    // The logo is a trusted SVG from app/assets/brand, inlined so it can follow currentColor.
    files: ['apps/web/app/components/AppLogo.vue'],
    rules: { 'vue/no-v-html': 'off' },
  },
  {
    // A limit checked after .trim() lets a padded value longer than the declared maxLength through.
    files: ['apps/api/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: [
            "CallExpression[callee.property.name='max'][callee.object.callee.property.name='trim']",
            "CallExpression[callee.property.name='max'][callee.object.callee.object.callee.property.name='trim']",
          ].join(', '),
          message: 'Use trimmedText() from shared/schemas.ts so the limit applies to the text as sent.',
        },
      ],
    },
  },
  {
    // Tests declare small probe components next to each other.
    files: ['apps/web/test/**/*.ts'],
    rules: { 'vue/one-component-per-file': 'off' },
  },
  {
    // k6 scripts run in the k6 runtime, which injects these globals (docs/TESTES.md, load test).
    files: ['tools/load/**/*.js'],
    languageOptions: { globals: { __ENV: 'readonly', __VU: 'readonly', __ITER: 'readonly' } },
  },
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'vue/multi-word-component-names': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
);
