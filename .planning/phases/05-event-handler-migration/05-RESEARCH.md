# Phase 5: Event Handler Migration - Research

**Researched:** 2026-01-28
**Domain:** Socket.IO event handler extraction and TypeScript migration with discriminated unions
**Confidence:** HIGH

## Summary

Phase 5 extracts 18 Socket.IO event handlers from the monolithic `server.js` (887 lines) into modular, fully-typed handler files. The domain involves:
- **Event handler organization**: Modular registration pattern vs. centralized handlers
- **Discriminated unions**: Type-safe handling of roll types (stress vs panic) with automatic type narrowing
- **Runtime validation preservation**: Maintaining 53+ defensive programming sites (`?.`, `??`, `String()`, etc.)
- **Thin router pattern**: Reducing `server.ts` to ~80 LOC entry point that delegates to handlers
- **Testing strategy**: Ensuring existing integration tests continue to pass

The standard approach is Socket.IO's **modular handler registration pattern** where each feature domain (player, roll, session, effect) exports a registration function that receives `(io, socket, state)` and sets up its event listeners. This keeps the main entry point clean while maintaining event discoverability through consistent naming conventions.

The critical insight is that **discriminated unions on `rollType`** provide compile-time type safety for the stress vs panic logic paths, but Socket.IO types are **compile-time only**—all 53+ runtime validation sites must be preserved unchanged.

**Primary recommendation:** Extract handlers by feature domain (player, roll, session, effect, condition), use discriminated union types for roll payloads, keep all runtime validation intact, and refactor `server.ts` into a thin router that imports and registers handler modules.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.9.3 | Type-checker | Already installed Phase 1 |
| socket.io | ^4.8.3 | WebSocket server | Has first-class TypeScript support since v3 |
| Node.js | 18+ | Runtime | Built-in ESM support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| src/types/events.ts | - | Socket.IO event maps | Already exists from Phase 2 |
| src/types/state.ts | - | Game state types | Already exists from Phase 2 |
| vitest | ^4.0.18 | Test framework | Already installed for integration tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Modular handlers | Single file with all handlers | Single file becomes unmaintainable at scale (already 887 LOC) |
| Manual discriminated unions | Runtime type guards only | Lose compile-time type narrowing benefits |
| Zod runtime validation | Keep existing validation | Zod adds dependency + migration overhead; existing validation proven |
| Class-based handlers | Function-based registration | Classes add complexity without benefit for this simple event delegation |

**Installation:**
```bash
# No new dependencies needed - all libraries already installed
```

## Architecture Patterns

### Recommended Project Structure
```
server.ts                    # Thin router (~80 LOC)
src/
  handlers/
    playerHandlers.ts        # player:add, player:remove, player:update
    rollHandlers.ts          # roll:trigger, roll:apply, roll:applyStressDelta, roll:undo, roll:clear
    effectHandlers.ts        # effect:clear
    conditionHandlers.ts     # condition:toggle
    sessionHandlers.ts       # session:save, session:load, session:list, session:clear, session:export, session:import
    externalHandlers.ts      # External namespace connection handler
  types/
    events.ts                # Socket.IO event maps (already exists)
    state.ts                 # GameState type (already exists)
    tables.ts                # Table types (already exists)
```

### Pattern 1: Modular Handler Registration
**What:** Each feature domain exports a `registerXHandlers(io, socket, state, deps)` function
**When to use:** For organizing 18+ event handlers by feature domain
**Example:**
```typescript
// Source: https://socket.io/docs/v4/server-application-structure/
// src/handlers/playerHandlers.ts
import type { TypedServer, TypedSocket } from "../types/index.js";
import type { GameState } from "../types/index.js";

interface HandlerDependencies {
  broadcast: () => void;
  addLogEntry: (type: string, message: string, details?: string | null) => void;
  ensurePlayerFields: (player: any) => void;
  clamp: (val: number, min: number, max: number) => number;
  newId: () => string;
  DEFAULT_MAX_HEALTH: number;
  MAX_HEALTH_CAP: number;
  MAX_STRESS: number;
  MAX_RESOLVE: number;
}

export function registerPlayerHandlers(
  io: TypedServer,
  socket: TypedSocket,
  state: GameState,
  deps: HandlerDependencies
): void {
  socket.on("player:add", (payload) => {
    const name = String(payload?.name ?? "").trim().slice(0, 40) || "UNNAMED";
    const maxHealth = deps.clamp(
      payload?.maxHealth ?? deps.DEFAULT_MAX_HEALTH,
      1,
      deps.MAX_HEALTH_CAP,
    );

    state.players.push({
      id: deps.newId(),
      name,
      maxHealth,
      health: deps.clamp(payload?.health ?? maxHealth, 0, maxHealth),
      stress: deps.clamp(payload?.stress ?? 0, 0, deps.MAX_STRESS),
      resolve: deps.clamp(payload?.resolve ?? 0, 0, deps.MAX_RESOLVE),
      activeEffects: [],
      lastRollEvent: null,
    });

    deps.addLogEntry("system", `CREW MEMBER ADDED: ${name}`);
    deps.broadcast();
  });

  socket.on("player:remove", (payload) => {
    const id = String(payload?.id ?? "");
    const p = state.players.find(x => x.id === id);
    const name = p ? p.name : "UNKNOWN";

    state.players = state.players.filter((p) => p.id !== id);
    deps.addLogEntry("system", `CREW MEMBER REMOVED: ${name}`);
    deps.broadcast();
  });

  socket.on("player:update", (payload) => {
    // ... similar pattern with all defensive validation
  });
}
```

**Key points:**
- Registration function receives `io`, `socket`, `state`, and `deps`
- All utility dependencies injected (testable without globals)
- Each handler preserves exact runtime validation from original
- Type safety from `TypedSocket` provides autocomplete

**Pros:**
- Entrypoint stays clean (~80 LOC router)
- Handlers grouped by feature domain
- Easy to test individual handler modules
- Clear separation of concerns

**Cons:**
- Event names spread across multiple files (mitigated by naming convention `register*Handlers`)

### Pattern 2: Discriminated Unions for Roll Types
**What:** Use TypeScript discriminated unions to enforce type safety between stress and panic roll logic
**When to use:** For `roll:trigger` and `roll:apply` handlers that have different behavior per roll type
**Example:**
```typescript
// Source: https://www.codespud.com/2025/discriminated-unions-examples-typescript/
// Discriminated union on rollType field
type StressRoll = {
  rollType: "stress";
  // Stress-specific behavior
  duplicateBehavior: "increment_stress"; // +1 stress on duplicate
};

type PanicRoll = {
  rollType: "panic";
  // Panic-specific behavior
  duplicateBehavior: "bump_to_next"; // Next higher table entry on duplicate
};

type RollContext = StressRoll | PanicRoll;

function handleDuplicateResult(context: RollContext, entry: any, player: any): void {
  // TypeScript narrows type based on rollType discriminant
  if (context.rollType === "panic") {
    // context is PanicRoll here - bump to next higher entry
    const bumped = resolveNextHigherDifferentEntry("panic", total, entry.id);
    // ...
  } else {
    // context is StressRoll here - increment stress
    player.stress = clamp(player.stress + 1, 0, MAX_STRESS);
    // ...
  }
}
```

**Key points:**
- `rollType` field is the discriminant (literal `"stress"` or `"panic"`)
- TypeScript automatically narrows types in conditional branches
- Compile-time guarantee that all cases are handled
- Runtime behavior still validated with defensive programming

### Pattern 3: Thin Router Entry Point
**What:** Reduce `server.ts` to minimal initialization + handler registration
**When to use:** Main server entry point after extracting all handlers
**Example:**
```typescript
// Source: Thin controller pattern - https://launchkit.tech/blog/claude-code-opus-4-5-complete-guide
// server.ts (~80 LOC target)
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import express from "express";
import { createServer } from "./createServer.js";
import { registerPlayerHandlers } from "./src/handlers/playerHandlers.js";
import { registerRollHandlers } from "./src/handlers/rollHandlers.js";
import { registerEffectHandlers } from "./src/handlers/effectHandlers.js";
import { registerConditionHandlers } from "./src/handlers/conditionHandlers.js";
import { registerSessionHandlers } from "./src/handlers/sessionHandlers.js";
import { registerExternalHandlers } from "./src/handlers/externalHandlers.js";
import type { GameState } from "./src/types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Server setup
const { app, server, io } = createServer({
  corsOrigin: process.env.BIOMON_CORS_ORIGIN || "http://localhost:3051"
});

// Static files and routes
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));
app.get("/", (_req, res) => res.sendFile(path.join(publicDir, "player.html")));
app.get("/gm", (_req, res) => res.sendFile(path.join(publicDir, "gm.html")));

// State initialization
const state: GameState = loadAutosave() || initializeEmptyState();

// Broadcast helper
function broadcast(): void {
  io.emit("state", state);
  io.of("/external").emit("state", state);
  scheduleSave();
}

// Dependencies object
const deps = {
  broadcast,
  addLogEntry,
  ensurePlayerFields,
  // ... all utility functions
};

// Register all handlers
io.on("connection", (socket) => {
  socket.emit("state", state);

  registerPlayerHandlers(io, socket, state, deps);
  registerRollHandlers(io, socket, state, deps);
  registerEffectHandlers(io, socket, state, deps);
  registerConditionHandlers(io, socket, state, deps);
  registerSessionHandlers(io, socket, state, deps);
});

// External namespace
registerExternalHandlers(io, state);

// Start server
const PORT = process.env.PORT || 3050;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
```

**Key points:**
- Server entry point is declarative, not procedural
- All handler logic delegated to feature modules
- Dependencies explicitly passed (no hidden globals)
- Easy to understand flow: setup → register → start

### Pattern 4: Preserve All Runtime Validation
**What:** Keep every defensive programming site unchanged during migration
**When to use:** All handler migrations (critical for security)
**Example:**
```typescript
// Source: https://socket.io/docs/v4/typescript/ - "do not replace proper validation"
// BEFORE migration (JavaScript)
socket.on("player:add", (payload) => {
  const name = String(payload?.name ?? "").trim().slice(0, 40) || "UNNAMED";
  const maxHealth = clamp(payload?.maxHealth ?? DEFAULT_MAX_HEALTH, 1, MAX_HEALTH_CAP);
  // ... 53+ similar validation sites
});

// AFTER migration (TypeScript) - VALIDATION UNCHANGED
socket.on("player:add", (payload) => {
  // payload is typed as PlayerAddPayload but still untrusted at runtime
  const name = String(payload?.name ?? "").trim().slice(0, 40) || "UNNAMED";
  const maxHealth = clamp(payload?.maxHealth ?? DEFAULT_MAX_HEALTH, 1, MAX_HEALTH_CAP);
  // ... exact same validation
});
```

**Validation patterns to preserve:**
- Optional chaining: `payload?.field`
- Nullish coalescing: `?? defaultValue`
- Type coercion: `String()`, `Number()`, `clampInt()`
- Range clamping: `clamp(value, min, max)`
- String sanitization: `.trim()`, `.slice(0, maxLen)`
- Array validation: `Array.isArray(x) ? x : []`
- Field backfilling: `ensurePlayerFields(p)`

**Count:** 53 optional chaining/nullish coalescing sites in current `server.js`

### Anti-Patterns to Avoid
- **Removing runtime validation:** TypeScript types don't validate at runtime—keep all `String()`, `??`, `?.` patterns
- **Handler god objects:** Don't create a single `Handlers` class—use modular registration functions
- **Circular dependencies:** Handlers shouldn't import each other—only shared dependencies
- **Testing anti-pattern:** Don't mock `socket.on` calls—use real Socket.IO test clients
- **Discriminant mixing:** Don't use `rollType` for both type narrowing AND string concatenation (keep logic separate)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Socket.IO event validation | Custom validation decorators | Existing defensive programming (`??`, `String()`, `clamp()`) | Already proven, no new dependencies, 53+ validation sites |
| Roll type routing | If/else chains with string checks | Discriminated unions with `rollType` field | TypeScript provides automatic type narrowing |
| Handler registration | Manual `socket.on()` calls in main file | Modular `register*Handlers()` functions | Official Socket.IO pattern, keeps entry point clean |
| Dependency injection | Global imports in handlers | Explicit `deps` parameter | Testable without mocking globals |
| Event name discovery | IDE search across files | Consistent naming (`register*Handlers`) + TypeScript types | `ClientToServerEvents` interface lists all events |

**Key insight:** Existing runtime validation is comprehensive and proven—don't replace it with a library (Zod, io-ts). TypeScript discriminated unions provide the type safety benefits without runtime overhead.

## Common Pitfalls

### Pitfall 1: Trusting Discriminated Unions for Runtime Safety
**What goes wrong:** Assuming `rollType: "stress" | "panic"` prevents malicious payloads at runtime
**Why it happens:** Discriminated unions are compile-time only—clients can send anything
**How to avoid:** Keep runtime checks even with discriminated union types
**Warning signs:** Removing `String(payload?.rollType ?? "stress")` validation
**Prevention:**
```typescript
// WRONG - trusting type
socket.on("roll:trigger", (payload) => {
  const rollType = payload.rollType; // Could be undefined/malicious at runtime!
  // ...
});

// CORRECT - validate then narrow
socket.on("roll:trigger", (payload) => {
  const rollType = payload?.rollType === "panic" ? "panic" : "stress";
  // Now safe to use in discriminated union context
});
```
**Source:** [Socket.IO TypeScript Documentation](https://socket.io/docs/v4/typescript/) - "These type hints do not replace proper validation"

### Pitfall 2: Handler Module Circular Dependencies
**What goes wrong:** `rollHandlers.ts` imports from `effectHandlers.ts`, which imports from `rollHandlers.ts`
**Why it happens:** Shared logic between handler modules creates import cycles
**How to avoid:** Extract shared logic to utility modules, not between handlers
**Warning signs:** "Circular dependency detected" in esbuild output
**Prevention:**
```typescript
// WRONG - handlers importing each other
// rollHandlers.ts
import { clearEffect } from "./effectHandlers.js"; // ❌ Circular!

// CORRECT - shared utilities
// src/utils/effectUtils.ts
export function clearEffectById(state, playerId, effectId) { ... }

// rollHandlers.ts
import { clearEffectById } from "../utils/effectUtils.js"; // ✅ No cycle
```

### Pitfall 3: Lost Context in Handler Registration
**What goes wrong:** Handler function references `state` before it's loaded from autosave
**Why it happens:** Closure captures stale reference before `loadAutosave()` mutates state
**How to avoid:** Pass `state` as parameter to registration functions, don't close over global
**Warning signs:** Handlers operating on empty initial state instead of loaded state
**Prevention:**
```typescript
// WRONG - closure over stale state
const state = { players: [] };
registerHandlers(io, socket); // Captures empty state
loadAutosave(state); // Mutates state, but handlers already closed over old reference

// CORRECT - pass state as parameter
const state = loadAutosave() || { players: [] };
io.on("connection", (socket) => {
  registerHandlers(io, socket, state); // Handlers receive current state
});
```

### Pitfall 4: Breaking Existing Tests
**What goes wrong:** Integration tests fail after handler extraction
**Why it happens:** Tests duplicate server setup logic that has now changed
**How to avoid:** Keep handler registration pattern compatible with test setup
**Warning signs:** `test/server.integration.test.js` failures
**Prevention:**
```typescript
// Ensure tests can still do:
io.on("connection", (socket) => {
  // Tests may set up handlers individually for isolation
  registerPlayerHandlers(io, socket, testState, testDeps);
});

// Don't force all-or-nothing registration
```

### Pitfall 5: Over-Engineering Handler Abstraction
**What goes wrong:** Creating abstract `BaseHandler` class with `handle()` method
**Why it happens:** Applying OOP patterns from other languages/frameworks
**How to avoid:** Keep simple functional registration pattern—no classes needed
**Warning signs:** Code complexity increases but functionality unchanged
**Prevention:**
```typescript
// WRONG - unnecessary abstraction
abstract class BaseHandler {
  abstract handle(socket: TypedSocket, state: GameState): void;
}
class PlayerHandler extends BaseHandler { ... }

// CORRECT - simple function
export function registerPlayerHandlers(io, socket, state, deps) {
  socket.on("player:add", (payload) => { ... });
  socket.on("player:remove", (payload) => { ... });
}
```

### Pitfall 6: Inconsistent Handler Naming
**What goes wrong:** Some handlers named `playerHandlers.ts`, others `handle-session.ts`, others `rollEventHandlers.ts`
**Why it happens:** No naming convention enforced
**How to avoid:** Use consistent pattern: `{domain}Handlers.ts` with `register{Domain}Handlers()` export
**Warning signs:** Hard to find handlers in file tree
**Prevention:**
```
✅ CONSISTENT:
src/handlers/playerHandlers.ts    → registerPlayerHandlers()
src/handlers/rollHandlers.ts       → registerRollHandlers()
src/handlers/sessionHandlers.ts    → registerSessionHandlers()

❌ INCONSISTENT:
src/handlers/player.ts             → setupPlayerEvents()
src/handlers/handle-roll.ts        → initRollHandlers()
src/handlers/sessionSocketIO.ts    → registerSessions()
```

## Code Examples

Verified patterns from official sources and existing codebase:

### Complete Handler Module (rollHandlers.ts)
```typescript
// Source: Socket.IO application structure + existing server.js logic
// src/handlers/rollHandlers.ts
import type { TypedServer, TypedSocket } from "../types/index.js";
import type { GameState, RollType } from "../types/index.js";

interface RollDependencies {
  broadcast: () => void;
  addLogEntry: (type: string, message: string, details?: string | null) => void;
  ensurePlayerFields: (player: any) => void;
  resolveEntry: (rollType: RollType, total: number) => any;
  getEntryById: (rollType: RollType, id: string) => any;
  resolveNextHigherDifferentEntry: (rollType: RollType, total: number, currentId: string) => any;
  hasLiveEffect: (player: any, effectId: string) => boolean;
  pushRollEvent: (event: any) => void;
  clampInt: (val: number, min: number, max: number) => number;
  clamp: (val: number, min: number, max: number) => number;
  d6: () => number;
  newId: () => string;
  MAX_STRESS: number;
  MAX_RESOLVE: number;
}

export function registerRollHandlers(
  io: TypedServer,
  socket: TypedSocket,
  state: GameState,
  deps: RollDependencies
): void {
  socket.on("roll:trigger", (payload) => {
    const playerId = String(payload?.playerId ?? "");
    const rollType: RollType = payload?.rollType === "panic" ? "panic" : "stress";
    const modifiers = deps.clampInt(payload?.modifiers ?? 0, -10, 10);

    const p = state.players.find((x) => x.id === playerId);
    if (!p) return;
    deps.ensurePlayerFields(p);

    const die = deps.d6();
    const stress = deps.clampInt(p.stress ?? 0, 0, deps.MAX_STRESS);
    const resolve = deps.clampInt(p.resolve ?? 0, 0, deps.MAX_RESOLVE);
    const total = die + stress - resolve + modifiers;

    let entry = deps.resolveEntry(rollType, total);
    let duplicateAdjusted = false;
    let duplicateNote = null;
    let duplicateFromId = null;
    let duplicateFromLabel = null;

    // Discriminated union type narrowing - Panic-specific duplicate handling
    if (rollType === "panic" && entry?.persistent && deps.hasLiveEffect(p, entry.id)) {
      const bumped = deps.resolveNextHigherDifferentEntry("panic", total, entry.id);
      if (bumped) {
        duplicateAdjusted = true;
        duplicateFromId = String(entry.id);
        duplicateFromLabel = String(entry.label || entry.id);
        entry = bumped;
        duplicateNote = `Duplicate result (${duplicateFromLabel}) already active — showing next higher response.`;
      }
    }

    // ... rest of handler logic (exact copy from server.js)
    deps.addLogEntry(rollType, `${p.name.toUpperCase()} ${rollType.toUpperCase()} ROLL: ${entry.label || entry.id}`);
    deps.broadcast();
  });

  socket.on("roll:apply", (payload) => {
    // ... exact logic from server.js with all validation
  });

  socket.on("roll:applyStressDelta", (payload) => {
    // ... exact logic from server.js with all validation
  });

  socket.on("roll:undo", (payload) => {
    // ... exact logic from server.js with all validation
  });

  socket.on("roll:clear", (payload) => {
    // ... exact logic from server.js with all validation
  });
}
```

### Thin Router Pattern (server.ts)
```typescript
// Source: Thin controller best practice
// server.ts
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "./createServer.js";
import { registerPlayerHandlers } from "./src/handlers/playerHandlers.js";
import { registerRollHandlers } from "./src/handlers/rollHandlers.js";
import { registerEffectHandlers } from "./src/handlers/effectHandlers.js";
import { registerConditionHandlers } from "./src/handlers/conditionHandlers.js";
import { registerSessionHandlers } from "./src/handlers/sessionHandlers.js";
import { registerExternalHandlers } from "./src/handlers/externalHandlers.js";
import { loadAutosave, initializeEmptyState, scheduleSave } from "./src/persistence/index.js";
import { addLogEntry, ensurePlayerFields } from "./src/utils/index.js";
import type { GameState } from "./src/types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize server
const { app, server, io } = createServer({
  corsOrigin: process.env.BIOMON_CORS_ORIGIN || "http://localhost:3051"
});

// Serve static files
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));
app.get("/", (_req, res) => res.sendFile(path.join(publicDir, "player.html")));
app.get("/gm", (_req, res) => res.sendFile(path.join(publicDir, "gm.html")));

// Load or initialize state
const state: GameState = loadAutosave() || initializeEmptyState();

// Broadcast helper
function broadcast(): void {
  io.emit("state", state);
  io.of("/external").emit("state", state);
  scheduleSave();
}

// Collect dependencies
const deps = { broadcast, addLogEntry, ensurePlayerFields, /* ... all utilities */ };

// Register main namespace handlers
io.on("connection", (socket) => {
  socket.emit("state", state);
  registerPlayerHandlers(io, socket, state, deps);
  registerRollHandlers(io, socket, state, deps);
  registerEffectHandlers(io, socket, state, deps);
  registerConditionHandlers(io, socket, state, deps);
  registerSessionHandlers(io, socket, state, deps);
});

// Register external namespace handlers
registerExternalHandlers(io, state);

// Start server
const PORT = process.env.PORT || 3050;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`GM panel: http://localhost:${PORT}/gm`);
});
```

### Discriminated Union for Roll Logic
```typescript
// Source: TypeScript discriminated unions best practices
// Type definitions with discriminant
interface BaseRollContext {
  playerId: string;
  total: number;
  entry: any;
  player: any;
}

interface StressRollContext extends BaseRollContext {
  rollType: "stress"; // Literal type discriminant
}

interface PanicRollContext extends BaseRollContext {
  rollType: "panic"; // Literal type discriminant
}

type RollContext = StressRollContext | PanicRollContext;

// TypeScript automatically narrows based on rollType
function applyDuplicateLogic(context: RollContext, deps: any): void {
  if (context.rollType === "panic") {
    // TypeScript knows context is PanicRollContext here
    // Panic: bump to next higher table entry
    const bumped = deps.resolveNextHigherDifferentEntry("panic", context.total, context.entry.id);
    // ...
  } else {
    // TypeScript knows context is StressRollContext here
    // Stress: add +1 stress level
    context.player.stress = deps.clamp(context.player.stress + 1, 0, deps.MAX_STRESS);
    // ...
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic server file | Modular handler registration | Socket.IO best practice 2020+ | Maintainability, testability |
| Manual type guards | Discriminated unions | TypeScript 2.0+ (2016) | Automatic type narrowing |
| String literal checks | Literal types with `as const` | TypeScript 3.4+ (2019) | Compile-time exhaustiveness checks |
| Global state access | Dependency injection | Modern best practice | Testable without global mocks |
| Handler duplication in tests | Shared handler modules | Integration test pattern 2023+ | Single source of truth |

**Deprecated/outdated:**
- **Namespace string typing**: Old approach used `socket.on("event", ...)` with string literals—now use typed event maps from `ClientToServerEvents`
- **Single server.js file**: Monolithic files were common in early Node.js—modular structure is now standard for 500+ LOC servers
- **if/else type checking**: Manual `if (typeof x === "string")` replaced by discriminated unions with automatic narrowing

## Open Questions

Things that couldn't be fully resolved:

1. **Handler dependency injection granularity**
   - What we know: Handlers need ~20 utility functions + constants
   - What's unclear: Pass individual functions or group into categories (e.g., `validation`, `tables`, `state`)?
   - Recommendation: Start with single `deps` object containing all utilities. If testing reveals coupling issues, split into logical groups (`tableDeps`, `validationDeps`, etc.).

2. **Integration test migration strategy**
   - What we know: `test/server.integration.test.js` duplicates server setup with manual `socket.on()` calls
   - What's unclear: Should tests import handler modules or continue duplicating?
   - Recommendation: Phase 5 extracts handlers but keeps tests unchanged. Validate tests still pass. Phase 6 (if planned) could migrate tests to import handler modules for better maintainability.

3. **Persistence layer extraction timing**
   - What we know: Persistence functions (`loadAutosave`, `saveCampaign`, etc.) are still in `server.js`
   - What's unclear: Should Phase 5 extract persistence to `src/persistence/` or leave for Phase 6?
   - Recommendation: Phase 5 focuses on event handlers. Leave persistence inline in `server.ts` to limit scope. Extract persistence in future phase if needed for testability.

## Sources

### Primary (HIGH confidence)
- [Socket.IO TypeScript Documentation](https://socket.io/docs/v4/typescript/) - Event map typing, generic parameters
- [Socket.IO Application Structure](https://socket.io/docs/v4/server-application-structure/) - Modular handler registration pattern
- [TypeScript Discriminated Unions Explained](https://www.convex.dev/typescript/advanced/type-operators-manipulation/typescript-discriminated-union) - Discriminated union patterns
- [Ten Common TypeScript Discriminated Union Examples](https://www.codespud.com/2025/discriminated-unions-examples-typescript/) - Practical discriminated union patterns
- [Socket.IO Testing Documentation](https://socket.io/docs/v4/testing/) - TypeScript testing examples

### Secondary (MEDIUM confidence)
- [Real-time communication with Socket.io using TypeScript](https://dev.to/nickfelix/how-to-implement-socketio-using-typescript-3ne2) - Modular handler examples
- [How to modularize a socket.io intensive app using middleware](https://oskosk.net/2015/10/how-to-modularize-a-socket-io-intensive-app-using-middleware/) - Handler extraction patterns
- [Claude Code with Opus 4.5: Complete Guide (2026)](https://launchkit.tech/blog/claude-code-opus-4-5-complete-guide) - Thin router pattern
- [Effective Integration Testing Strategies for Socket.IO Applications](https://moldstud.com/articles/p-effective-integration-testing-strategies-for-socketio-applications-best-practices-and-tips) - Testing best practices

### Tertiary (LOW confidence)
- [socket.io-mock-ts](https://github.com/james-elicx/socket.io-mock-ts) - TypeScript Socket.IO mocking library (for future test migration)
- [zod-sockets](https://github.com/RobinTail/zod-sockets) - Runtime validation library (alternative to existing validation, not recommended for this phase)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Socket.IO v4 has first-class TypeScript support, modular pattern is official recommendation
- Architecture: HIGH - Official Socket.IO docs provide explicit modular handler pattern with examples
- Pitfalls: HIGH - Official TypeScript docs warn about runtime validation, known migration issues documented
- Discriminated unions: HIGH - TypeScript language feature since 2.0, well-documented with exhaustiveness checking
- Testing: MEDIUM - Integration test strategy is project-specific, requires validation after migration

**Research date:** 2026-01-28
**Valid until:** 60 days (stable ecosystem—Socket.IO v4, TypeScript v5 are mature)
