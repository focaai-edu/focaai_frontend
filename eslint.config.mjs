import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
    },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
    },
  },
];
