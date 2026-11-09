export default {
  plugins: ['./scripts/stylelint-color-contract.mjs'],
  ignoreFiles: [
    'Frontend/public/assets/js/vendor/**',
    'Frontend/public/assets/css/ui-preview.css',
  ],
  rules: {
    'app-codici-password/valid-accent-colors': true,
    'block-no-empty': true,
    'color-no-invalid-hex': true,
    'declaration-block-no-duplicate-custom-properties': true,
    'declaration-block-no-duplicate-properties': [true, {
      ignore: ['consecutive-duplicates-with-different-values'],
    }],
    'no-duplicate-at-import-rules': true,
    'no-invalid-position-at-import-rule': true,
  },
};
