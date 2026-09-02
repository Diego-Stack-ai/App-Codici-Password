module.exports = [
  {
    files: ["**/*.js"],
    ignores: ["node_modules/**"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        Buffer: "readonly",
        console: "readonly",
        exports: "writable",
        fetch: "readonly",
        module: "writable",
        process: "readonly",
        require: "readonly",
        setTimeout: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", {argsIgnorePattern: "^_"}],
    },
  },
];
