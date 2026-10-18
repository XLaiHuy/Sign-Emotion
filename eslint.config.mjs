export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'output/**', 'public/**', '.codegraph/**', '.venv/**'],
  },
  {
    files: ['scripts/**/*.mjs', 'scripts/browser-pipeline-30min-benchmark.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'valid-typeof': 'error',
    },
  },
];
