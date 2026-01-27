# Codebase Structure

**Analysis Date:** 2026-01-27

## Directory Layout

```
/Users/daniel/Projects/biomon/
├── server.js               # Main server entry point (887 lines)
├── createServer.js         # Server factory for testability (36 lines)
├── utils.js                # Utility functions (97 lines)
├── responseTables.js       # Stress/panic game tables (278 lines)
├── build.js                # Build script for pkg bundler
├── package.json            # Dependencies, scripts, metadata
├── package-lock.json       # Locked dependency versions
├── vitest.config.js        # Test runner configuration
├── eslint.config.js        # Linting configuration
├── nodemon.json            # Dev server auto-reload config
├── .env.example            # Environment variable template
├── .gitignore              # Git exclusions
├── .prettierrc              # Code formatter config (if present)
├── README.md               # Project documentation
├── INTEGRATION.md          # Integration guide
├── AGENTS.md               # Agent documentation
│
├── public/                 # Static assets & client code
│   ├── player.html         # Player crew view (75 lines)
│   ├── gm.html             # GM control panel (450+ lines)
│   ├── player.js           # Player client logic (771 lines)
│   ├── gm.js               # GM client logic (835 lines)
│   ├── toast.js            # Toast notification system (184 lines)
│   ├── styles.css          # Unified styling (29k lines)
│   └── favicon.png         # App icon
│
├── test/                   # Test files
│   ├── server.integration.test.js      # Socket.io event handlers
│   ├── responseTables.test.js          # Game table resolution
│   ├── utils.test.js                   # Utility function tests
│   ├── integration.external.test.js    # External namespace tests
│   ├── selfcheck.test.js               # Self-check validation
│   └── README.md                       # Testing documentation
│
├── scripts/                # Utility scripts
│   └── selfcheck.js        # Session validation tool
│
├── sessions/               # Data storage (created at runtime)
│   ├── autosave.json       # Auto-saved session state
│   ├── archived/           # Backup/archive directory
│   └── campaign-*.json     # Manually saved campaigns
│
├── .github/
│   └── workflows/          # CI/CD workflows
│
├── .husky/                 # Git hooks
├── .planning/
│   └── codebase/           # This codebase analysis directory
└── screenshots/            # Documentation screenshots
```

## Directory Purposes

**Root Level:**
- **server.js**: Entry point for application. Runs on `npm start`. Sets up Express routes, Socket.io handlers, file persistence.
- **createServer.js**: Extracted server setup logic shared by production and tests.
- **utils.js**: Reusable functions (clamp, validation, ID generation). Imported by server and tests.
- **responseTables.js**: Game mechanics data and lookup functions. Pure data module.
- **build.js**: Prepares application for pkg binary compilation (esbuild bundling).
- **package.json**: Project metadata, dependencies (express, socket.io), dev tools (vitest, eslint).
- **public/**: Served as static files by Express. Contains all client UI code.
- **test/**: Test suite run by `npm test` via vitest.
- **scripts/**: Utility scripts like selfcheck.js.
- **sessions/**: Data persistence directory. Created at runtime if missing.

**public/ Directory:**
- **player.html/player.js**: Read-only crew vitals view. Shows health/stress indicators, ECG animation.
- **gm.html/gm.js**: Control panel. Add/remove players, trigger rolls, apply effects, manage sessions.
- **toast.js**: Toast notification system used by both views.
- **styles.css**: Unified stylesheet for all UI. Handles responsive layout, animations, theming.
- **favicon.png**: Branding image served on all pages.

**test/ Directory:**
- **server.integration.test.js**: Tests all Socket.io event handlers by creating in-process server.
- **responseTables.test.js**: Tests game table resolution and edge cases.
- **utils.test.js**: Tests utility functions (clamp, hasLiveEffect, etc.).
- **integration.external.test.js**: Tests read-only external namespace.
- **selfcheck.test.js**: Tests session file validation.

**sessions/ Directory:**
- **autosave.json**: Auto-saved state, loaded on server startup. Replaced on every mutation.
- **campaign-*.json**: Named campaign saves created via GM "Save" button.
- **archived/**: Directory for manual backups (not auto-populated).

## Key File Locations

**Entry Points:**

| File | Purpose | How Invoked |
|------|---------|------------|
| `server.js` | Main server loop | `npm start` or `node server.js` |
| `public/player.html` | Player view | HTTP GET / |
| `public/gm.html` | GM view | HTTP GET /gm |

**Configuration:**

| File | Purpose | Effect |
|------|---------|--------|
| `package.json` | Dependencies, scripts | Controls what packages are available, how to run the app |
| `.env` (from .env.example) | Environment variables | BIOMON_CORS_ORIGIN sets CORS policy, PORT sets listen port |
| `nodemon.json` | Dev server config | Auto-restarts on file changes during `npm run dev` |
| `eslint.config.js` | Linting rules | Enforced on `npm run lint` |
| `vitest.config.js` | Test configuration | Controls test runner behavior |

**Core Logic:**

| File | Purpose | Exports |
|------|---------|---------|
| `server.js` | Event handlers, state mutations | Main application (no exports) |
| `responseTables.js` | Game data | `STRESS_TABLE`, `PANIC_TABLE`, `resolveEntry()`, `getEntryById()` |
| `utils.js` | Shared utilities | `clamp()`, `clampInt()`, `newId()`, `ensurePlayerFields()`, `hasLiveEffect()`, `d6()`, constants |
| `createServer.js` | Server setup | `createServer(options)` → `{ app, server, io }` |

**Client Logic:**

| File | Purpose | Dependencies |
|------|---------|--------------|
| `public/player.js` | Player view logic | Socket.io client, canvas API for ECG |
| `public/gm.js` | GM panel logic | Socket.io client, DOM manipulation |
| `public/toast.js` | Notifications | DOM only, no external deps |

**Testing:**

| File | Purpose | Tests |
|------|---------|-------|
| `test/server.integration.test.js` | Socket.io handlers | player:add, player:remove, roll:trigger, roll:apply, roll:undo, etc. |
| `test/responseTables.test.js` | Table resolution | Entry lookup, stress/panic results |
| `test/utils.test.js` | Utility functions | clamp, clampInt, hasLiveEffect |
| `test/integration.external.test.js` | Read-only namespace | External client connect/disconnect, no mutations |

## Naming Conventions

**Files:**

- `*.js` — All JavaScript files (Node.js and browser)
- `*.html` — Entry pages (player.html, gm.html)
- `*.css` — Styling
- `*.test.js` — Test files (vitest convention)
- `*.json` — Config and data files
- Lowercase kebab-case or camelCase (no uppercase except acronyms)

**Directories:**

- `public/` — Client-facing assets
- `test/` — All test files (co-located by module name)
- `sessions/` — Persistent data
- `scripts/` — Utility scripts
- `.github/`, `.husky/`, `.planning/` — Configuration directories (leading dot)

**Modules & Exports:**

- `server.js` — Default module, no named exports (runs as main entry)
- `responseTables.js` — Named exports (STRESS_TABLE, PANIC_TABLE, functions)
- `utils.js` — Named exports of utility functions and constants
- `createServer.js` — Named export `createServer()` function

**Socket.io Events:**

- Namespace separator: `:` (e.g., `player:add`, `roll:trigger`)
- Verb-object pattern: `{action}:{entity}` (e.g., `effect:clear`, `session:save`)
- Result events: `{action}:{entity}:result` (e.g., `session:load:result`)

**Game Data Identifiers:**

- Table entry IDs: `{rollType}_{effect_name}` (e.g., `stress_jumpy`, `panic_paranoid`)
- Player IDs: `{timestamp}-{randomHex}` via `newId()`
- Effect IDs: Same pattern as player IDs
- Event IDs: Same pattern as player IDs

## Where to Add New Code

**New Feature (e.g., new game mechanic):**

1. Add table data to `responseTables.js`:
   - New entry to STRESS_TABLE or PANIC_TABLE
   - Entry format: `{ min, max, id, label, description, severity, persistent, durationType, stressDelta }`

2. Add Socket.io handler to `server.js`:
   - Follow pattern of existing handlers (lines 314-815)
   - Validate inputs with defaults
   - Mutate state
   - Call `broadcast()`

3. Add UI controls to client:
   - `public/player.js` or `public/gm.js` depending on who controls it
   - Emit Socket.io event with validated payload

4. Add tests:
   - `test/server.integration.test.js` for Socket.io logic
   - `test/utils.test.js` if you added utilities

**New Component/Module:**

1. Utility functions:
   - Add to `utils.js` with JSDoc comments
   - Export from utils.js
   - Import in `server.js` and tests

2. Server event namespace:
   - Extract handler logic to a separate function (like `broadcast()`)
   - Call it from event handler
   - Register listener in `io.on("connection")` block

3. Client UI component:
   - Create helper function in `public/gm.js` or `public/player.js`
   - Return DOM element via `document.createElement()`
   - Attach event listeners for Socket.io emissions
   - Insert into DOM

**Utilities/Helpers:**

- **Shared math/validation:** Add to `utils.js`
- **Game rules:** Add to `responseTables.js` or as `resolveEntry()` caller
- **Server helpers:** Add as function above `io.on("connection")` in `server.js`
- **Client helpers:** Add as function in same file as consumer (player.js or gm.js)

## Special Directories

**public/:**
- Purpose: Static HTTP assets served directly by Express
- Generated: No (all manually maintained)
- Committed: Yes (part of version control)
- Access: Served at `/` root with `app.use(express.static(publicDir))`
- Note: For pkg builds, copied to dist/ directory

**test/:**
- Purpose: Test suite
- Generated: No (manually written)
- Committed: Yes
- Run: `npm test` (vitest)
- Config: `vitest.config.js`
- Pattern: Co-located by module (server.integration.test.js matches server.js)

**sessions/:**
- Purpose: Runtime data persistence
- Generated: Yes (created at startup if missing)
- Committed: No (in .gitignore)
- Contents:
  - `autosave.json` — Auto-saved state (replaced on every mutation)
  - `campaign-*.json` — Named save files (created by GM)
  - `archived/` — Manual backups directory
- Note: When running in pkg binary, uses process.cwd() instead of __dirname for data access

**dist/:**
- Purpose: Build output for pkg binary compilation
- Generated: Yes (`npm run build`)
- Committed: No (in .gitignore)
- Contains:
  - `server.bundled.cjs` — esbuild output, CommonJS format
  - `public/` — Copied static assets
  - `biomon` (or .exe) — Final executable after pkg builds

**.planning/codebase/:**
- Purpose: Architecture and structure analysis documents
- Generated: Yes (by GSD tools)
- Committed: Yes (reference documentation)
- Files: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md

---

*Structure analysis: 2026-01-27*
