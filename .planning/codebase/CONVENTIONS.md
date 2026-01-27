# Coding Conventions

**Analysis Date:** 2026-01-27

## Naming Patterns

**Files:**
- All lowercase with `.js` extension: `server.js`, `utils.js`, `responseTables.js`
- Descriptive names without hyphens or underscores: `createServer.js`, `responseTables.js`
- Test files follow pattern: `[module].test.js` (e.g., `utils.test.js`)

**Functions:**
- camelCase for all function names
- Descriptive verb-noun pattern: `resolveEntry()`, `getEntryById()`, `ensurePlayerFields()`, `hasLiveEffect()`
- Helper functions with clear intent: `clamp()`, `clampInt()`, `d6()`, `newId()`
- Single letter or abbreviated names acceptable for utility functions only

**Variables:**
- camelCase for variables: `lastState`, `gmList`, `previousPlayerStates`, `corsOrigin`
- Single letter `p` for player objects in tight loops (see `server.integration.test.js` line 46)
- `const` preferred over `let` (ESLint rule enforces `prefer-const`)
- `var` is forbidden (ESLint rule: `no-var: error`)
- DOM element references end with `El`: `cardsEl`, `gmList`, `nameEl`, `healthEl`
- State containers use descriptive names: `state`, `alertState`, `ui`
- Map/Set containers are explicit: `previousPlayerStates = new Map()`, `seenEventIdByPlayer = new Map()`

**Constants:**
- UPPERCASE_SNAKE_CASE: `DEFAULT_MAX_HEALTH`, `MAX_HEALTH_CAP`, `MAX_STRESS`, `MAX_RESOLVE`, `ROLL_FEED_CAP`
- Path constants use descriptive names: `SESSIONS_DIR`, `AUTOSAVE_PATH`, `AUTOSAVE_DEBOUNCE_MS`
- Configuration constants are module-scoped

**Types/Objects:**
- No explicit TypeScript - uses JSDoc comments for object shape documentation
- Object properties use camelCase: `{ id, name, health, maxHealth, stress, resolve, activeEffects }`
- IDs typically use timestamp-random pattern: ``${Date.now()}-${Math.random().toString(16).slice(2)}``

## Code Style

**Formatting:**
- ESLint enforces `indent: [error, 2]` - 2 spaces
- ESLint enforces `quotes: [error, "double"]` - double quotes required
- ESLint enforces `semi: [error, "always"]` - semicolons required
- ESLint enforces `comma-dangle: [error, "always-multiline"]` - trailing commas on multiline structures

**Linting:**
- ESLint v9+ with recommended config (`@eslint/js`)
- Config file: `eslint.config.js`
- Rules:
  - `no-console: off` - console logging is intentional (used for debug/info messages)
  - `no-unused-vars: [warn, { argsIgnorePattern: "^_" }]` - underscore prefix for intentionally unused parameters
  - `prefer-const: warn`
  - `no-var: error`
  - `arrow-spacing: error` - space around arrows in arrow functions
  - `object-shorthand: warn` - prefer `{ foo }` over `{ foo: foo }`
  - `no-undef: error`
  - `no-unreachable: error`

**Line Length:**
- No explicit limit enforced
- Typical max around 120 characters observed in tests and comments

## Import Organization

**Order:**
1. Node.js core modules (`path`, `fs`, `http`, `process`)
2. External packages (`express`, `socket.io`, `vitest`)
3. Local modules (relative imports with `./` or `../`)

**Examples from codebase:**
```javascript
// server.js style
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import express from "express";
import { createServer } from "./createServer.js";
import { resolveEntry, getEntryById } from "./responseTables.js";
```

**Path Aliases:**
- No aliases configured - all imports are relative paths
- Explicit relative imports preferred: `import { foo } from "./utils.js"`
- Test imports: `import { describe, it, expect } from "vitest"`

## Error Handling

**Patterns:**
- Try-catch blocks for file I/O operations (see `server.js` lines 104-140)
- Silent failures with logged errors for non-critical operations:
  ```javascript
  try {
    // operation
  } catch (err) {
    console.error("[CONTEXT] Failed to operation:", err.message);
  }
  ```
- Input validation through type coercion and clamping rather than exceptions:
  ```javascript
  // From utils.js
  function clamp(n, lo, hi) {
    n = Number(n);
    if (Number.isNaN(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
  }
  ```
- Guard clauses for early returns:
  ```javascript
  // From utils.js hasLiveEffect()
  if (!type) return false;
  if (!Array.isArray(p?.activeEffects)) return [];
  ```
- Optional chaining (`?.`) and nullish coalescing (`??`) used extensively for safe access

## Logging

**Framework:** `console` directly (no logging library)

**Patterns:**
- Prefixed console messages with context in brackets: `console.log("[AUTOSAVE] State saved")`
- Error logs include operation context: `console.error("[AUTOSAVE] Failed to save:", err.message)`
- Info logs for state transitions: `console.log("[AUTOSAVE] Loaded previous session (saved: ...)")`
- Used in development flow, not disabled in production

**Conventions:**
- Log level implied by method (`.log()`, `.error()`, `.warn()`)
- Messages are brief but informative
- Include relevant data (counts, names, timestamps)

## Comments

**When to Comment:**
- JSDoc blocks for exported functions with parameters and return types
- Inline comments for non-obvious logic (see `server.js` lines 30-46)
- Section headers using comment dividers: `// ============================================================`
- Explain the "why" not the "what" - code structure is self-explanatory

**JSDoc/TSDoc:**
- JSDoc used for exported functions with `@param`, `@returns` tags
- Example from `utils.js`:
  ```javascript
  /**
   * Clamps a number between a minimum and maximum value.
   * Returns the lower bound if the input is NaN.
   * @param {number} n - The number to clamp
   * @param {number} lo - The lower bound
   * @param {number} hi - The upper bound
   * @returns {number} The clamped value
   */
  function clamp(n, lo, hi) { ... }
  ```
- Include data structure descriptions in table files:
  ```javascript
  /**
   * Entry shape:
   * { min, max, id, label, description, severity, persistent, durationType, durationValue, applyOptions }
   */
  ```
- Not used for internal/private functions

## Function Design

**Size:**
- Functions range from 2-3 lines (e.g., `d6()`) to 80+ lines (complex Socket.io handlers)
- Helper functions under 15 lines common
- Handler functions in tests can be 100+ lines for complex state operations
- Prefer composition of smaller functions where applicable

**Parameters:**
- Single parameter objects for complex data (Socket.io event handlers)
  ```javascript
  socket.on("player:update", (payload) => {
    const id = String(payload?.id ?? "");
    // ... access payload properties
  });
  ```
- Multiple scalar parameters acceptable (e.g., `clamp(n, lo, hi)`)
- Destructuring used for clear parameter intent
- Default parameters acceptable: `(options = {})`

**Return Values:**
- Functions return early when conditions not met (guard clauses)
- Single return statement preferred
- Return objects/arrays for multiple values:
  ```javascript
  return {
    found: true,
    timestamp: state.metadata.lastSaved,
    playerCount: state.players.length,
  };
  ```
- Null/undefined acceptable for optional values, but returned consistently

## Module Design

**Exports:**
- Named exports preferred over default exports
- All exports are explicit at module end:
  ```javascript
  export {
    DEFAULT_MAX_HEALTH,
    MAX_HEALTH_CAP,
    clamp,
    clampInt,
    newId,
  };
  ```
- ES6 modules exclusively (no CommonJS `module.exports`)

**Barrel Files:**
- No barrel files used in codebase
- Each module exports specific items

**Module Scope:**
- Constants defined at top of file: `const DEFAULT_MAX_HEALTH = 5;`
- Internal state/caches below constants
- Functions defined after state
- Exports at bottom

**File Boundaries:**
- `utils.js`: Pure utility functions, constants
- `responseTables.js`: Data tables and table lookup functions
- `server.js`: Main server setup, Socket.io handlers, persistence logic
- `createServer.js`: Server factory function (reusable for tests)
- `public/*.js`: Client-side code (browser context, Socket.io client)
- `test/*.test.js`: Test files using Vitest

## Browser vs Node.js Code

**Node.js modules:**
- Use ES6 `import`/`export`
- Set `"type": "module"` in `package.json`
- Can use Node.js globals: `__dirname`, `__filename`, `process`
- File I/O via `fs` module

**Browser modules:**
- Same ES6 syntax but in browser context
- Access browser globals: `document`, `window`, `requestAnimationFrame`
- Socket.io client: `const socket = io()`
- Prefer `querySelector` over legacy DOM APIs

---

*Convention analysis: 2026-01-27*
