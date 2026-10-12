import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // 要件定義書 8.1: any は使わない
      '@typescript-eslint/no-explicit-any': 'error',
      // 雛形の段階では未使用の引数を許す(中身を書けば自然に使われる)
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
    },
  },
  prettier,
);
