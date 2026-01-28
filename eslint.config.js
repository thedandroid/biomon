// ESLint flat config for ESLint v9+ with TypeScript support
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Node.js globals
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        console: "readonly",
        exports: "writable",
        global: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    rules: {
      // Style rules matching existing conventions
      indent: ["error", 2],
      quotes: ["error", "double", { avoidEscape: true }],
      semi: ["error", "always"],
      "comma-dangle": ["error", "always-multiline"],

      // Best practices
      "no-console": "off",
      "prefer-const": "warn",
      "no-var": "error",

      // ES6+
      "arrow-spacing": "error",
      "template-curly-spacing": "error",
      "object-shorthand": "warn",

      // Potential errors
      "no-undef": "error",
      "no-unreachable": "error",

      // TypeScript-specific: use TS rule instead of base
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // TypeScript files: enable type-checked rules
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // JavaScript files: disable type-checked rules and allow require imports
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // Frontend files use browser globals
    files: ["public/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        getComputedStyle: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        Blob: "readonly",
        URL: "readonly",
        FileReader: "readonly",
        // Socket.io client
        io: "readonly",
        // Toast notification system
        toast: "readonly",
      },
    },
  },
  {
    // Test files
    files: ["test/**/*.{js,ts}", "vitest.config.js", "eslint.config.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        // Vitest globals
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        // Node.js globals
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        console: "readonly",
        process: "readonly",
      },
    },
  },
  {
    ignores: [
      "node_modules/",
      "coverage/",
      "dist/",
      "*.min.js",
      "public/toast.js",
      // Temporarily ignored until integration test migration (06-02)
      "test/server.integration.test.ts",
    ],
  },
);
