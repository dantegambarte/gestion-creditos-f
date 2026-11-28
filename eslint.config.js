// @ts-check
// Lint is incremental: CI and the pre-commit hook lint only changed files,
// so existing code is fixed as it is touched instead of in one mass reformat.
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const chaiFriendly = require('eslint-plugin-chai-friendly');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', '.claude/**', 'node_modules/**', '.angular/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommended, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      // Test doubles often need loose typing.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['cypress/**/*.ts'],
    // Chai assertions such as `expect(x).to.be.true` are expressions by design.
    extends: [chaiFriendly.configs.recommendedFlat],
    rules: {
      // `declare global { namespace Cypress {...} }` is the documented way to type custom commands.
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended],
    rules: {
      // Loose `== null` checks intentionally cover both null and undefined.
      '@angular-eslint/template/eqeqeq': ['error', { allowNullOrUndefined: true }],
    },
  },
);
