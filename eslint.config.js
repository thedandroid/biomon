// ESLint flat config for ESLint v9+
const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
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
      // Style rules matching AGENTS.md conventions
      indent: ["error", 2],
      quotes: ["error", "double", { avoidEscape: true }],
      semi: ["error", "always"],
      "comma-dangle": ["error", "always-multiline"],
      
      // Best practices
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off", // Console logging is intentional
      "prefer-const": "warn",
      "no-var": "error",
      
      // ES6+
      "arrow-spacing": "error",
      "template-curly-spacing": "error",
      "object-shorthand": "warn",
      
      // Potential errors
      "no-undef": "error",
      "no-unreachable": "error",
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
      },
    },
  },
  {
    // Test files and config use ES modules
    files: ["test/**/*.js", "vitest.config.js", "eslint.config.js"],
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
      "*.min.js",
    ],
  },
];
