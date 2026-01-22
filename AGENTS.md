# Agent Guidelines for Party Visualizer Roller

This document provides coding agents with essential information about build commands, code style, and conventions for this repository.

## Project Overview

**Party Vitals + Alien RPG Evolved Stress & Panic Roller** is a real-time web application for tracking party status in Alien RPG games. It uses:
- **Backend**: Node.js with Express (v5.2.1) and Socket.io (v4.8.3)
- **Frontend**: Vanilla JavaScript (no frameworks), HTML5, CSS3
- **No TypeScript**: Pure JavaScript implementation
- **No Build Tools**: Static file serving (no Vite, Webpack, etc.)
- **State Management**: In-memory (no database)

## Build/Run Commands

### Installation
```bash
npm install
```

### Running the Application
```bash
npm start
# or
node server.js
```
- GM view: `http://localhost:3050/gm`
- Player view: `http://localhost:3050/`
- Default port: 3050 (override with `PORT` environment variable)

### Testing
```bash
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
npm run test:ui          # Run tests with interactive UI
npm run selfcheck        # Legacy table validation script
```
**Test Framework**: Vitest with 67 tests covering utilities, responseTables, and Socket.io integration.
- **Coverage**: 93.33% on responseTables.js
- **Test files**: Located in `test/` directory
- See `test/README.md` for detailed testing guide

### Linting/Formatting
**Note**: There are NO configured linters or formatters (no ESLint config, Prettier, etc.) at the project level. Code review is manual.

## Project Structure

```
party-visualizer-roller/
├── server.js              # Main Express/Socket.io server (432 lines)
├── responseTables.js      # Stress & Panic table definitions + lookup logic
├── package.json           # Dependencies (express, socket.io, vitest)
├── vitest.config.js       # Test configuration
├── public/                # Static frontend files
│   ├── player.html       # Player view interface
│   ├── player.js         # Player-side logic with ECG animation
│   ├── gm.html           # Game Master view interface
│   ├── gm.js             # GM control panel logic
│   └── styles.css        # Medical console-themed styling
├── test/                  # Test files (67 tests)
│   ├── utils.test.js     # Utility function tests
│   ├── responseTables.test.js  # Table logic tests
│   ├── selfcheck.test.js # Validation tests
│   ├── server.integration.test.js  # Socket.io tests
│   └── README.md         # Testing guide
└── scripts/
    └── selfcheck.js      # Legacy table validation utility
```

## Code Style Guidelines

### Language & Syntax
- **ES6+ JavaScript**: Use modern syntax (arrow functions, destructuring, template literals, const/let)
- **No TypeScript**: Pure JavaScript throughout
- **No JSX**: Vanilla DOM manipulation

### Imports & Exports
- **Backend**: CommonJS (`require`/`module.exports`)
  ```javascript
  const { resolveEntry, getEntryById } = require("./responseTables");
  module.exports = { STRESS_TABLE, PANIC_TABLE, resolveEntry };
  ```
- **Frontend**: No module system (scripts loaded via `<script>` tags)

### Formatting Conventions
- **Indentation**: 2 spaces
- **Quotes**: Double quotes `"` for strings (but be consistent with existing code)
- **Line length**: No strict limit (most lines under 80-100 chars, but some longer)
- **Semicolons**: Always use semicolons
- **Trailing commas**: Used in multi-line objects/arrays

### Naming Conventions
- **Variables/Functions**: camelCase (`clamp`, `newId`, `hasLiveEffect`, `pushRollEvent`)
- **Constants**: UPPER_SNAKE_CASE for global constants (`MAX_STRESS`, `DEFAULT_MAX_HEALTH`, `ROLL_FEED_CAP`)
- **DOM Elements**: camelCase with `El` suffix (`gmList`, `nameEl`, `healthEl`)
- **Socket Events**: Namespaced with colon (`player:add`, `roll:trigger`, `effect:clear`)
- **CSS Classes**: kebab-case (`gm-card`, `slider-row`, `mini`)

### Functions
- **Prefer arrow functions** for callbacks and simple utilities:
  ```javascript
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  ```
- **Use traditional function declarations** for major functions:
  ```javascript
  function ensurePlayerFields(p) { /* ... */ }
  ```
- **Pure functions preferred**: Most utility functions are stateless
- **Keep functions focused**: Single responsibility principle

### Data Structures
- **Plain objects** for state (`state.players`, player objects)
- **Arrays** for collections
- **No classes**: Functional composition preferred
- **Map/Set** for local UI state tracking (see `ecgEngine`, `alertState`)

### State Management
- **Backend**: Single in-memory `state` object in `server.js:26-31`
- **Frontend**: `lastState` or `state` variable storing latest Socket.io broadcast
- **Real-time sync**: All state changes broadcast via `io.emit("state", state)`
- **No persistence**: State resets on server restart

### Error Handling
- **Input validation**: Clamp/sanitize user inputs
  ```javascript
  const name = String(payload?.name ?? "").trim().slice(0, 40) || "UNNAMED";
  p.stress = clamp(payload.stress, 0, MAX_STRESS);
  ```
- **Defensive checks**: Use optional chaining and nullish coalescing
  ```javascript
  const type = String(effectType ?? "");
  const list = Array.isArray(p?.activeEffects) ? p.activeEffects : [];
  ```
- **No try/catch blocks**: Code relies on defensive programming instead
- **Assertions in tests**: `selfcheck.js` uses custom `assert` function

### Security
- **HTML escaping**: Always escape user input for DOM insertion
  ```javascript
  // In gm.js and player.js
  function escapeHtml(s) { /* ... */ }
  function escapeAttr(s) { /* ... */ }
  ```
- **Input length limits**: Truncate names, clamp numeric values
- **No eval()**: Never use eval or Function constructor

### Comments
- **JSDoc-style headers** for complex functions/files
  ```javascript
  /**
   * Entry shape:
   * { min, max, id, label, description, severity, persistent, durationType, durationValue, applyOptions }
   */
  ```
- **Inline comments** for non-obvious logic
  ```javascript
  // Node <19 doesn't always have crypto.randomUUID; keep it simple
  ```
- **eslint-disable** where necessary (e.g., `/* eslint-disable no-console */` in `selfcheck.js`)

### DOM Manipulation
- **Direct DOM API**: Use `createElement`, `appendChild`, `innerHTML`, `addEventListener`
- **No jQuery**: Vanilla JavaScript only
- **Template strings** for HTML generation (with escaping!)
  ```javascript
  left.innerHTML = `
    <div class="gm-name">${escapeHtml(p.name)}</div>
    <div class="mini">ID: <span class="pill">${escapeHtml(p.id.slice(0, 8))}</span></div>
  `;
  ```

### Canvas (ECG Animation)
- **Custom engine**: See `ecgEngine` in `player.js:17-183`
- **RequestAnimationFrame**: For smooth 60fps animation
- **Stateful per-canvas**: Each player card has independent ECG state

### Socket.io Patterns
- **Event naming**: Use namespaced format (`player:add`, `roll:trigger`)
- **Payload validation**: Always validate/sanitize incoming payloads
- **Broadcast after mutations**: Call `broadcast()` after state changes
- **Connection handling**: Emit initial state on `io.on("connection")`

## Testing Guidelines

### Current Testing
- **Test Framework**: Vitest with v8 coverage
- **67 tests**: Unit tests, integration tests, validation tests
- **93.33% coverage** on responseTables.js
- **Test location**: `test/` directory
- See `test/README.md` for complete testing guide

### Test Categories
- **Unit tests** (`test/utils.test.js`): Utility functions (clamp, clampInt, hasLiveEffect)
- **Table tests** (`test/responseTables.test.js`): Entry resolution, lookup, validation
- **Integration tests** (`test/server.integration.test.js`): Socket.io event handlers
- **Validation tests** (`test/selfcheck.test.js`): Table coverage and structure

### Writing New Tests
```javascript
import { describe, it, expect } from "vitest";

describe("Feature Name", () => {
  it("should do something specific", () => {
    const result = someFunction(input);
    expect(result).toBe(expected);
  });
});
```

### Running Tests
- Run `npm test` before committing changes
- Use `npm run test:watch` during development
- Check coverage with `npm run test:coverage`

## Common Patterns

### ID Generation
```javascript
function newId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
```

### Clamping Values
```javascript
function clamp(n, lo, hi) {
  n = Number(n);
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
```

### Socket Event Flow
1. Frontend emits event: `socket.emit("player:update", { id, health: 3 })`
2. Backend handler validates and mutates state
3. Backend broadcasts to all clients: `io.emit("state", state)`
4. Frontend receives and re-renders: `socket.on("state", (newState) => { ... })`

## File Modification Guidelines

- **server.js**: Add new Socket.io handlers following existing pattern (validate → mutate → broadcast → log)
- **responseTables.js**: Maintain table structure; update `selfcheck.js` when adding fields
- **public/*.js**: Keep separation between GM and Player views; share utilities via copy (no shared module)
- **styles.css**: Medical console theme (cyan/green colors, monospace font, retro aesthetic)

## Deployment Notes

- No build step required
- Runs on any Node.js environment (v14+)
- Single-process server (no clustering/workers)
- No database setup needed
- Environment variable: `PORT` (default 3050)
