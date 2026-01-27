# Phase 1: Tooling Foundation - Research

**Researched:** 2026-01-27
**Domain:** TypeScript tooling infrastructure (tsconfig, tsx, typescript-eslint, lint-staged)
**Confidence:** HIGH

## Summary

This phase establishes TypeScript infrastructure without converting source files. Research confirms the user's prior decisions are well-aligned with current best practices: esbuild for transpilation (via tsx and the existing build.js), tsc for type-checking only, and `moduleResolution: "Bundler"` for optimal esbuild integration.

The standard approach is to:
1. Install TypeScript and tsx as dev dependencies
2. Create tsconfig.json with strict mode and bundler resolution
3. Replace nodemon with tsx watch in dev script
4. Integrate typescript-eslint with existing flat config
5. Configure lint-staged for TypeScript files

**Primary recommendation:** Use `tsx watch` for development, run `tsc --noEmit` for type-checking, and keep esbuild for production builds.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| typescript | ^5.9.3 | Type-checking and declaration generation | Official TypeScript compiler; tsc --noEmit for type-check only |
| tsx | ^4.21.0 | Development server with watch mode | esbuild-powered, drop-in node replacement, handles TS transparently |
| @types/node | ^25.0.10 | Node.js type definitions | Required for Node.js APIs in TypeScript |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| typescript-eslint | ^8.54.0 | TypeScript ESLint integration | Type-aware linting with flat config |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tsx | ts-node + nodemon | tsx is faster (esbuild), single tool vs two |
| tsx | native Node.js --experimental-strip-types | tsx more mature, better ecosystem support |
| typescript-eslint | @typescript-eslint/parser + @typescript-eslint/eslint-plugin | typescript-eslint is the unified package (recommended since v8) |

**Installation:**
```bash
npm install -D typescript tsx @types/node typescript-eslint
```

## Architecture Patterns

### Recommended tsconfig.json Structure
```json
{
  "compilerOptions": {
    // Type-checking
    "strict": true,
    "noEmit": true,

    // Module resolution for bundlers
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "lib": ["ES2022"],

    // Node.js ESM compatibility
    "esModuleInterop": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,

    // Declaration files for future sharing
    "declaration": true,
    "declarationMap": true,
    "declarationDir": "./dist/types",

    // Path configuration
    "rootDir": "./src",
    "baseUrl": ".",

    // JavaScript files during transition
    "allowJs": true,
    "checkJs": false,

    // Quality
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "coverage"]
}
```

### Pattern 1: Separate Type-Check from Transpilation
**What:** tsc for type-checking, esbuild/tsx for transpilation
**When to use:** Always in esbuild-based projects
**Example:**
```json
// package.json scripts
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "dev": "tsx watch server.ts",
    "build": "npm run typecheck && node build.js"
  }
}
```
**Source:** [esbuild FAQ](https://esbuild.github.io/faq/) - "Type checking is not planned for esbuild itself. Just run tsc separately."

### Pattern 2: Flat Config ESLint with TypeScript
**What:** ESLint 9 flat config using defineConfig and typescript-eslint
**When to use:** For type-aware linting
**Example:**
```javascript
// eslint.config.js
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Disable type-checked rules for JS files
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
```
**Source:** [typescript-eslint Getting Started](https://typescript-eslint.io/getting-started/)

### Anti-Patterns to Avoid
- **Running tsc for transpilation:** Use esbuild/tsx instead; tsc transpilation is slower
- **Using deprecated tseslint.config():** Use ESLint core's defineConfig() instead (deprecated in v8.33.0)
- **Mixing projectService and project in parserOptions:** Only use one; projectService is preferred
- **Setting checkJs: true immediately:** Adds compile time overhead; enable gradually after migration

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TypeScript watch mode | nodemon + tsc | tsx watch | Single tool, esbuild speed, handles TS natively |
| Type-check staged files | Custom tsc wrapper | tsc-files or project-wide tsc | tsc ignores tsconfig when given file list |
| ESLint TypeScript parser config | Manual parser/plugin setup | typescript-eslint package | Unified package handles parser, plugin, configs |
| tsconfig path resolution in Vitest | Manual alias config | vite-tsconfig-paths | Automatically reads tsconfig paths |

**Key insight:** TypeScript tooling has consolidated significantly. The typescript-eslint unified package, tsx for development, and esbuild for builds represent the current "blessed" stack.

## Common Pitfalls

### Pitfall 1: tsc with File List Ignores tsconfig.json
**What goes wrong:** Running `tsc file1.ts file2.ts` ignores tsconfig.json settings
**Why it happens:** TypeScript design - file arguments mean "compile these files only"
**How to avoid:** Run `tsc --noEmit` without file arguments, or use tsc-files package
**Warning signs:** Error "Option 'project' cannot be mixed with source files on a command line"

### Pitfall 2: lint-staged Type-Checking Only Staged Files
**What goes wrong:** Type errors in non-staged files aren't caught when staged file changes break them
**Why it happens:** If you change types in file A, file B might break but won't be type-checked
**How to avoid:** Run project-wide `tsc --noEmit` in pre-commit hook, not per-file
**Warning signs:** CI catches type errors that pre-commit hook missed

### Pitfall 3: moduleResolution Mismatch
**What goes wrong:** TypeScript can't find modules or complains about extensions
**Why it happens:** Using nodeNext with bundler, or bundler with node-style imports
**How to avoid:** Use `moduleResolution: "Bundler"` with esbuild; allows extensionless imports
**Warning signs:** "Cannot find module" errors for valid paths

### Pitfall 4: allowJs Without Proper Scope
**What goes wrong:** TypeScript tries to type-check all JS files, slowing down development
**Why it happens:** allowJs: true makes tsc process all included JS files
**How to avoid:** Start with checkJs: false, be specific with include/exclude patterns
**Warning signs:** Slow type-checking, thousands of files being processed

### Pitfall 5: Vitest Not Finding TypeScript Files
**What goes wrong:** Vitest can't import .ts files or resolve paths
**Why it happens:** Missing vite-tsconfig-paths plugin or wrong file patterns
**How to avoid:** Vitest uses esbuild natively for .ts files; add vite-tsconfig-paths if using path aliases
**Warning signs:** "Cannot find module" in test files

## Code Examples

Verified patterns from official sources:

### tsconfig.json for Phase 1 (Tooling Only)
```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "esModuleInterop": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "allowJs": true,
    "checkJs": false,
    "declaration": true,
    "declarationDir": "./dist/types"
  },
  "include": ["src/**/*", "*.js", "*.ts"],
  "exclude": ["node_modules", "dist", "coverage", "public"]
}
```

### package.json Scripts Update
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "tsx watch server.js",
    "typecheck": "tsc --noEmit",
    "build": "npm run typecheck && node build.js && pkg dist/server.bundled.cjs --targets node18-win-x64 --output dist/biomon",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "test": "vitest run",
    "prepare": "husky"
  }
}
```
**Note:** dev script uses tsx watch even for .js files - tsx handles both transparently.

### ESLint Flat Config with TypeScript Support
```javascript
// eslint.config.js
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
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    rules: {
      indent: ["error", 2],
      quotes: ["error", "double", { avoidEscape: true }],
      semi: ["error", "always"],
      "comma-dangle": ["error", "always-multiline"],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "prefer-const": "warn",
      "no-var": "error",
    },
  },
  {
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ["public/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        io: "readonly",
        toast: "readonly",
      },
    },
  },
  {
    ignores: ["node_modules/", "coverage/", "dist/", "*.min.js"],
  },
);
```
**Source:** [typescript-eslint](https://typescript-eslint.io/packages/typescript-eslint/)

### lint-staged Configuration
```json
{
  "lint-staged": {
    "*.{js,ts}": [
      "eslint --fix"
    ]
  }
}
```

### Pre-commit Hook (husky)
```bash
#!/usr/bin/env sh
npx lint-staged
npm run typecheck
npm test
```
**Note:** Run project-wide typecheck, not per-staged-file, to catch cross-file type errors.

### Vitest Configuration for TypeScript
```javascript
// vitest.config.js (or vitest.config.ts)
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.{js,ts}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "public/**",
        "scripts/**",
        "*.config.{js,ts}",
      ],
    },
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ts-node + nodemon | tsx watch | 2024 | Single tool, 10x faster via esbuild |
| @typescript-eslint/parser + plugin | typescript-eslint unified | v8 (2024) | Simpler imports, better defaults |
| parserOptions.project | parserOptions.projectService | v8 (2024) | Simpler config, auto tsconfig detection |
| tseslint.config() | eslint/config defineConfig() | ESLint 9.22 (2025) | Deprecated in typescript-eslint v8.33 |
| moduleResolution: node | moduleResolution: Bundler | TS 5.0 (2023) | No extension requirements with bundlers |

**Deprecated/outdated:**
- `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` separate packages: Use unified `typescript-eslint` package
- `tseslint.config()`: Deprecated in favor of ESLint core's `defineConfig()`
- `nodemon` for TypeScript: Use `tsx watch` instead

## Open Questions

Things that couldn't be fully resolved:

1. **When to create src/ directory**
   - What we know: Phase 1 doesn't convert files, but tsconfig needs rootDir
   - What's unclear: Should src/ exist empty in Phase 1 or be created in Phase 2?
   - Recommendation: Create src/ in Phase 1 with a placeholder, or adjust tsconfig include to handle root-level files during transition

2. **Type-aware ESLint rules performance**
   - What we know: projectService is recommended but newer than project option
   - What's unclear: Performance impact on this specific project size
   - Recommendation: Start with projectService; fall back to project if issues arise

3. **Declaration file generation timing**
   - What we know: User wants .d.ts for future client sharing
   - What's unclear: Should declarations be generated in build or separately?
   - Recommendation: Add declarations to build step only (tsc --emitDeclarationOnly)

## Sources

### Primary (HIGH confidence)
- [TypeScript Official TSConfig Reference](https://www.typescriptlang.org/tsconfig/) - moduleResolution, strict mode
- [typescript-eslint Getting Started](https://typescript-eslint.io/getting-started/) - v8.54.0 configuration
- [tsx Official Documentation](https://tsx.is/) - watch mode, esbuild integration
- [esbuild FAQ](https://esbuild.github.io/faq/) - type-checking separation rationale
- [Vitest Configuration](https://vitest.dev/config/) - TypeScript support

### Secondary (MEDIUM confidence)
- [Better Stack: TSX vs ts-node](https://betterstack.com/community/guides/scaling-nodejs/tsx-vs-ts-node/) - performance comparisons
- [typescript-eslint Project Service Blog](https://typescript-eslint.io/blog/project-service/) - projectService vs project
- [Total TypeScript: moduleResolution](https://www.totaltypescript.com/workshops/typescript-pro-essentials/configuring-typescript/the-moduleresolution-option-in-tsconfigjson) - bundler mode explanation

### Tertiary (LOW confidence)
- Community articles on migration patterns - verified against official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions verified via npm, official docs consulted
- Architecture: HIGH - patterns from official typescript-eslint and TypeScript docs
- Pitfalls: HIGH - documented in official GitHub issues and FAQs

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days - stable domain)
