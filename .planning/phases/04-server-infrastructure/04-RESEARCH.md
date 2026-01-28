# Phase 4: Server Infrastructure - Research

**Researched:** 2026-01-28
**Domain:** TypeScript migration for Express + Socket.io server factory and persistence layer
**Confidence:** HIGH

## Summary

Phase 4 converts `createServer.js` (37 lines) and the persistence layer in `server.js` (~300 lines) to TypeScript. The domain involves:
- **Server factory**: Express app + HTTP server + Socket.io with typed generics
- **Persistence layer**: Node.js `fs` operations with error handling
- **Socket.io event handlers**: Already have typed event maps from Phase 2
- **Express middleware**: Static file serving with proper typing

The standard approach is to use Socket.io's four generic type parameters (`Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>`) and Express's built-in types from `@types/express`. Node.js built-in modules (`fs`, `path`, `http`) are fully typed via `@types/node` (already installed).

The critical insight is that Socket.io types provide **compile-time guarantees only**—runtime validation must remain in place. The official docs explicitly warn: "These type hints do not replace proper validation/sanitization of the input."

**Primary recommendation:** Convert `createServer.js` first (simpler, no state), then persistence functions in `server.js`, maintaining all existing runtime validation and error handling patterns.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.9.3 | Type-checker | Already installed Phase 1 |
| @types/node | ^25.0.10 | Node.js built-in types | Already installed, provides `fs`, `path`, `http` types |
| socket.io | ^4.8.3 | WebSocket server | Already installed, has built-in TypeScript support since v3 |
| express | ^5.2.1 | HTTP framework | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/express | (peer) | Express type definitions | Auto-installed with express v5 |
| src/types/events.ts | - | Socket.io event maps | Import `TypedServer`, `TypedSocket`, `TypedExternalNamespace` |
| src/types/state.ts | - | Game state types | Import `GameState` for persistence |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Socket.io generics | `Server` without generics | Lose all event type safety |
| Explicit return types | Inferred types | Explicit required for factories (Phase 1 decision) |
| `fs/promises` | `fs` sync APIs | Persistence already uses sync (keep consistency) |

**Installation:**
```bash
# No new dependencies needed - all types exist
```

## Architecture Patterns

### Recommended Project Structure
```
createServer.ts        # Factory (root, not src/ yet)
server.ts              # Main server (imports createServer)
src/
  types/
    events.ts          # TypedServer, TypedSocket aliases
    state.ts           # GameState type
```

### Pattern 1: Typed Server Factory Return
**What:** Factory functions return explicit types with all generics resolved
**When to use:** Server factory functions that will be imported by tests and main server
**Example:**
```typescript
// Source: Factory pattern best practices + Socket.io TypeScript docs
import express, { type Express } from "express";
import { createServer as createHTTPServer, type Server as HTTPServer } from "http";
import { Server } from "socket.io";
import type { TypedServer } from "./src/types/index.js";

interface ServerOptions {
  corsOrigin?: string | string[];
}

interface ServerInstance {
  app: Express;
  server: HTTPServer;
  io: TypedServer;
}

export function createServer(options: ServerOptions = {}): ServerInstance {
  const app = express();
  const server = createHTTPServer(app);

  // Parse CORS origin - supports single string or array
  let corsOrigin = options.corsOrigin || "http://localhost:3051";

  if (typeof corsOrigin === "string" && corsOrigin.includes(",")) {
    corsOrigin = corsOrigin.split(",").map(origin => origin.trim());
  }

  const io: TypedServer = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  return { app, server, io };
}
```

**Key points:**
- Explicit `ServerInstance` return type (factory pattern best practice)
- `TypedServer` from `src/types/events.ts` applies all Socket.io generics
- `corsOrigin` parsing maintains existing runtime logic
- `Express`, `HTTPServer` imported as types for clarity

### Pattern 2: File System Operations with Error Handling
**What:** Use try/catch for sync `fs` operations with typed error handling
**When to use:** All persistence functions (`loadAutosave`, `saveCampaign`, etc.)
**Example:**
```typescript
// Source: Node.js fs docs + TypeScript handbook
import fs from "fs";
import path from "path";
import type { GameState } from "./src/types/index.js";

interface AutosaveInfo {
  found: boolean;
  timestamp?: string;
  playerCount?: number;
  campaignName?: string;
}

function loadAutosave(autosavePath: string): AutosaveInfo {
  try {
    if (fs.existsSync(autosavePath)) {
      const data = fs.readFileSync(autosavePath, "utf8");
      const loaded = JSON.parse(data) as GameState; // Runtime assumes JSON is valid GameState

      return {
        found: true,
        timestamp: loaded.metadata?.lastSaved ?? undefined,
        playerCount: loaded.players?.length ?? 0,
        campaignName: loaded.metadata?.campaignName ?? undefined,
      };
    }
  } catch (err) {
    // Keep existing error handling - don't type `err` more narrowly
    console.error("[AUTOSAVE] Failed to load:", (err as Error).message);
  }

  return { found: false };
}
```

**Key points:**
- Keep existing try/catch structure (don't migrate to async)
- Explicit return type (`AutosaveInfo`)
- Use `as GameState` for JSON.parse (runtime validation still needed)
- Error type assertion `(err as Error).message` for console output
- Maintain all existing runtime validation after loading

### Pattern 3: Socket Handler Registration
**What:** Use `TypedSocket` for socket event handlers with typed payloads
**When to use:** All `io.on("connection")` and `socket.on()` handlers
**Example:**
```typescript
// Source: Socket.io TypeScript docs
import type { TypedServer, TypedSocket } from "./src/types/index.js";

const io: TypedServer = createServer().io;

io.on("connection", (socket: TypedSocket) => {
  // socket.emit is now typed
  socket.emit("state", state); // state must match GameState type

  // socket.on is now typed - payload is automatically PlayerAddPayload
  socket.on("player:add", (payload) => {
    // payload is typed as PlayerAddPayload from ClientToServerEvents
    const name = String(payload?.name ?? "").trim().slice(0, 40) || "UNNAMED";
    // ... keep all existing validation
  });
});
```

**Key points:**
- `TypedSocket` provides event type safety
- Payload types inferred from `ClientToServerEvents`
- **Keep all defensive coercions** (`String()`, `??`, `?.`)
- Types are compile-time only—runtime validation remains critical

### Pattern 4: Express Middleware and Routes
**What:** Use Express's built-in `Request`, `Response` types
**When to use:** All `app.get()`, `app.use()` handlers
**Example:**
```typescript
// Source: Express TypeScript best practices
import express, { type Request, type Response } from "express";

const app = express();

// Static files - no custom typing needed
app.use(express.static(publicDir));

// Routes with typed Request/Response
app.get("/", (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, "player.html"));
});

app.get("/gm", (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, "gm.html"));
});
```

**Key points:**
- Express v5 includes TypeScript types
- `Request` and `Response` don't need generics for simple routes
- Prefix unused params with `_` (ESLint convention)

### Pattern 5: Namespace Typing
**What:** Apply separate type parameters to Socket.io namespaces
**When to use:** External namespace (`io.of("/external")`)
**Example:**
```typescript
// Source: Socket.io namespace typing docs
import type { TypedExternalNamespace } from "./src/types/index.js";

const externalNamespace: TypedExternalNamespace = io.of("/external");

externalNamespace.on("connection", (socket) => {
  console.log(`[EXTERNAL] Client connected: ${socket.id}`);
  socket.emit("state", state); // Only emit allowed, no handlers
});
```

**Key points:**
- `TypedExternalNamespace` uses `ExternalClientToServerEvents` (empty)
- Read-only namespace enforced at type level
- Socket has no `.on()` handlers (intentional design)

### Anti-Patterns to Avoid
- **Removing runtime validation:** Types don't validate at runtime—keep all `String()`, `Number()`, `clamp()`, etc.
- **Using `any` for errors:** Use `unknown` or `Error` type assertions
- **Making persistence async:** Keep sync fs operations (existing design)
- **Generic overkill:** Express routes don't need `Request<ParamsDictionary, ...>` for simple cases
- **Forgetting CORS type:** `corsOrigin` is `string | string[]`, not just `string`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Socket.io typing | Manual event string typing | `TypedServer`, `TypedSocket` from `src/types/events.ts` | Event maps already exist from Phase 2 |
| Express types | Custom Request/Response interfaces | Built-in `express.Request`, `express.Response` | Ships with Express v5 |
| Node.js types | Custom fs/path/http types | `@types/node` (already installed) | Comprehensive, maintained |
| GameState type | Inline interface | Import from `src/types/state.ts` | Already exists from Phase 2 |
| Error typing | `any` | `unknown` with type guards or `Error` assertion | Type safety without over-constraining |

**Key insight:** Phase 2 created all Socket.io event types. Phase 4 consumes them—no new Socket.io type definitions needed, just apply existing generics.

## Common Pitfalls

### Pitfall 1: Trusting Socket.io Types for Security
**What goes wrong:** Removing runtime validation after adding types, assuming type safety = security
**Why it happens:** Misconception that TypeScript validates at runtime
**How to avoid:** Keep all defensive programming patterns from JavaScript version
**Warning signs:** Removing `String()`, `Number()`, `??`, `?.` operators during conversion
**Prevention:**
```typescript
// WRONG - trusting payload type
socket.on("player:add", (payload) => {
  state.players.push({
    id: newId(),
    name: payload.name,  // Could be undefined/malicious at runtime!
    // ...
  });
});

// CORRECT - keep runtime validation
socket.on("player:add", (payload) => {
  const name = String(payload?.name ?? "").trim().slice(0, 40) || "UNNAMED";
  // ... same defensive code as JS version
});
```
**Source:** [Socket.IO TypeScript Documentation](https://socket.io/docs/v4/typescript/) explicitly states: "These type hints do not replace proper validation/sanitization of the input."

### Pitfall 2: fs Error Handling Type Confusion
**What goes wrong:** TypeScript errors on `err.message` because `catch (err)` has type `unknown`
**Why it happens:** TypeScript 4.4+ made catch clause variables `unknown` by default
**How to avoid:** Use type assertion `(err as Error).message` or type guard
**Warning signs:** "Property 'message' does not exist on type 'unknown'"
**Prevention:**
```typescript
// Type-safe error handling
try {
  fs.writeFileSync(filepath, JSON.stringify(state, null, 2), "utf8");
} catch (err) {
  // Option 1: Type assertion (simpler)
  console.error("[AUTOSAVE] Failed:", (err as Error).message);

  // Option 2: Type guard (more robust)
  console.error("[AUTOSAVE] Failed:", err instanceof Error ? err.message : String(err));
}
```

### Pitfall 3: JSON.parse Type Assumptions
**What goes wrong:** `JSON.parse()` returns `any`, but treating result as fully validated `GameState`
**Why it happens:** Type assertion (`as GameState`) bypasses runtime validation
**How to avoid:** Use type assertion but keep field validation afterward
**Warning signs:** Runtime crashes on malformed JSON files
**Prevention:**
```typescript
const loaded = JSON.parse(data) as GameState;

// MUST still validate after assertion
state.players = Array.isArray(loaded.players) ? loaded.players : [];
state.rollEvents = Array.isArray(loaded.rollEvents) ? loaded.rollEvents : [];
// ... etc

// Backfill missing fields
for (const p of state.players) ensurePlayerFields(p);
```

### Pitfall 4: CORS Origin Type Confusion
**What goes wrong:** `corsOrigin` can be `string | string[]`, but only handling `string` case
**Why it happens:** Forgetting to check for array type before `.includes()`
**How to avoid:** Handle both types explicitly with type narrowing
**Warning signs:** TypeScript error: "Property 'includes' does not exist on type 'string | string[]'"
**Prevention:**
```typescript
interface ServerOptions {
  corsOrigin?: string | string[];
}

export function createServer(options: ServerOptions = {}): ServerInstance {
  let corsOrigin: string | string[] = options.corsOrigin || "http://localhost:3051";

  // Type narrowing - only call .includes() on string
  if (typeof corsOrigin === "string" && corsOrigin.includes(",")) {
    corsOrigin = corsOrigin.split(",").map(origin => origin.trim());
  }

  // Now corsOrigin is correctly typed for Socket.io
}
```

### Pitfall 5: Import Extension Requirements
**What goes wrong:** Import statements fail at runtime with "Cannot find module"
**Why it happens:** `"type": "module"` in package.json requires `.js` extensions (even for `.ts` files)
**How to avoid:** Use `.js` extensions in import paths (TypeScript resolves to `.ts` during type-checking)
**Warning signs:** `ERR_MODULE_NOT_FOUND` at runtime despite TypeScript compiling successfully
**Prevention:**
```typescript
// WRONG - no extension
import { TypedServer } from "./src/types/index";

// CORRECT - .js extension (resolves to .ts during type-check)
import type { TypedServer } from "./src/types/index.js";
```
**Note:** This is already configured in `tsconfig.json` with `"moduleResolution": "Bundler"` from Phase 1.

### Pitfall 6: Namespace Type Application Order
**What goes wrong:** Type errors when assigning namespace to typed variable
**Why it happens:** Generic parameters must match exactly between `Namespace<...>` and event maps
**How to avoid:** Use pre-defined type aliases from `src/types/events.ts`
**Warning signs:** "Type 'Namespace<DefaultEventsMap, ...>' is not assignable to type 'Namespace<...>'"
**Prevention:**
```typescript
// WRONG - inline generics might not match
const ns: Namespace<ExternalClientToServerEvents, ExternalServerToClientEvents> = io.of("/external");

// CORRECT - use pre-defined alias
import type { TypedExternalNamespace } from "./src/types/index.js";
const externalNamespace: TypedExternalNamespace = io.of("/external");
```

## Code Examples

Verified patterns from official sources and prior phases:

### Complete createServer.ts Conversion
```typescript
// Source: Factory pattern best practices + Socket.io docs
import express, { type Express } from "express";
import { createServer as createHTTPServer, type Server as HTTPServer } from "http";
import { Server } from "socket.io";
import type { TypedServer } from "./src/types/index.js";

interface ServerOptions {
  corsOrigin?: string | string[];
}

interface ServerInstance {
  app: Express;
  server: HTTPServer;
  io: TypedServer;
}

/**
 * Creates an Express + Socket.io server with CORS configuration
 * @param options - Server options
 * @param options.corsOrigin - CORS origin(s) to allow
 * @returns { app, server, io } - Express app, HTTP server, and typed Socket.io instance
 */
export function createServer(options: ServerOptions = {}): ServerInstance {
  const app = express();
  const server = createHTTPServer(app);

  // Parse CORS origin - supports single string or array
  let corsOrigin: string | string[] = options.corsOrigin || "http://localhost:3051";

  // If it's a string with commas, split it into an array
  if (typeof corsOrigin === "string" && corsOrigin.includes(",")) {
    corsOrigin = corsOrigin.split(",").map(origin => origin.trim());
  }

  const io: TypedServer = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  return { app, server, io };
}
```

### Persistence Function with Typed Returns
```typescript
// Source: Node.js fs documentation
import fs from "fs";
import path from "path";
import type { GameState } from "./src/types/index.js";

interface SaveResult {
  success: boolean;
  filename?: string;
  error?: string;
}

function saveCampaign(state: GameState, campaignName: string, sessionsDir: string): SaveResult {
  try {
    const safeName = campaignName.replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
    const filename = `campaign-${safeName}.json`;
    const filepath = path.join(sessionsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(state, null, 2), "utf8");
    console.log(`[CAMPAIGN] Saved: ${filename}`);

    return { success: true, filename };
  } catch (err) {
    console.error("[CAMPAIGN] Save failed:", (err as Error).message);
    return { success: false, error: (err as Error).message };
  }
}
```

### Socket Handler Registration Pattern
```typescript
// Source: Socket.io TypeScript docs + existing server.js
import type { TypedServer, TypedSocket } from "./src/types/index.js";
import type { GameState } from "./src/types/index.js";

function setupSocketHandlers(io: TypedServer, state: GameState): void {
  io.on("connection", (socket: TypedSocket) => {
    // Initial state broadcast
    socket.emit("state", state);

    // Typed event handler - payload is automatically PlayerAddPayload
    socket.on("player:add", (payload) => {
      // Keep all defensive programming from JS version
      const name = String(payload?.name ?? "").trim().slice(0, 40) || "UNNAMED";
      const maxHealth = clamp(
        payload?.maxHealth ?? DEFAULT_MAX_HEALTH,
        1,
        MAX_HEALTH_CAP,
      );

      state.players.push({
        id: newId(),
        name,
        maxHealth,
        health: clamp(payload?.health ?? maxHealth, 0, maxHealth),
        stress: clamp(payload?.stress ?? 0, 0, MAX_STRESS),
        resolve: clamp(payload?.resolve ?? 0, 0, MAX_RESOLVE),
        activeEffects: [],
        lastRollEvent: null,
      });

      broadcast(io, state);
    });

    // ... other handlers
  });
}
```

### __dirname Pattern for ES Modules
```typescript
// Source: Node.js ESM documentation
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use for file paths
const publicDir = path.join(__dirname, "public");
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Socket.io without types | Socket.io with generic type parameters | v3.0 (2020) | Type-safe event handlers, autocomplete |
| Express @types/express separate | Express v5 includes types | v5.0 (2024) | Built-in typing, no separate install |
| catch (err: any) | catch (err: unknown) | TypeScript 4.4 (2021) | More type-safe error handling |
| import from "url" | import { fileURLToPath } from "url" | ESM standard | Required for ES modules with __dirname |
| Untyped factory returns | Explicit interface return types | Best practice 2023+ | Better IDE support, clearer contracts |

**Deprecated/outdated:**
- **SocketIO namespace**: Old type definition used `SocketIO.Server` (pre-v3)—now use `Server` from "socket.io"
- **require() for built-ins**: Use ESM `import` syntax (project uses `"type": "module"`)
- **@types/express as devDep**: Express v5+ includes types, though @types/express still exists for v4 compatibility

## Open Questions

Things that couldn't be fully resolved:

1. **Integration test typing strategy**
   - What we know: Tests currently import both utilities and duplicate server logic
   - What's unclear: Whether tests should import typed `createServer` or continue duplicating handlers
   - Recommendation: Phase 4 converts `createServer.js` first, then assess if tests should import it. Phase 5 (if planned) might address server.js refactoring for testability.

2. **Persistence layer refactoring scope**
   - What we know: 8 persistence functions exist inline in `server.js`
   - What's unclear: Should persistence be extracted to separate module (e.g., `persistence.ts`) or remain inline?
   - Recommendation: Phase 4 requirement is "Convert to TypeScript"—keep inline for now. Extract to module in future phase if desired for testability.

3. **Express middleware type complexity**
   - What we know: Current middleware is simple (static files, two GET routes)
   - What's unclear: Whether to use `RequestHandler` type or inline `Request`/`Response`
   - Recommendation: Use simple `(req: Request, res: Response) => void` for current middleware. If middleware becomes complex (error handlers, custom properties), revisit with `RequestHandler<...>` generics.

## Sources

### Primary (HIGH confidence)
- [Socket.IO TypeScript Documentation](https://socket.io/docs/v4/typescript/) - Event map typing, generic parameters
- [Node.js fs API Documentation](https://nodejs.org/api/fs.html) - File system operations, error handling
- [TypeScript Handbook: Migrating from JavaScript](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html) - Official migration guide
- [Node.js File Paths Documentation](https://nodejs.org/en/learn/manipulating-files/nodejs-file-paths) - Path module and fileURLToPath usage
- [Working with file system paths and file URLs on Node.js](https://2ality.com/2022/07/nodejs-path.html) - ESM __dirname pattern

### Secondary (MEDIUM confidence)
- [Comprehensive Guide: Production-Ready Middleware in Node.js + TypeScript (2026 Edition)](https://virangaj.medium.com/comprehensive-guide-production-ready-middleware-in-node-js-typescript-2026-edition-f1c29184aacd) - Express middleware typing patterns
- [Typed Express Request and Response with TypeScript](https://plainenglish.io/blog/typed-express-request-and-response-with-typescript) - Express generics
- [Factory Method in TypeScript](https://refactoring.guru/design-patterns/factory-method/typescript/example) - Factory return types
- [Mastering Socket.IO with TypeScript](https://www.xjavascript.com/blog/socket-io-typescript/) - Socket.io best practices
- [Node.js 2025 Guide: Express.js with TypeScript](https://medium.com/@gabrieldrouin/node-js-2025-guide-how-to-setup-express-js-with-typescript-eslint-and-prettier-b342cd21c30d) - Recent Express + TypeScript guide

### Tertiary (LOW confidence)
- [Mock Factory Pattern in TypeScript](https://dev.to/davelosert/mock-factory-pattern-in-typescript-44l9) - Testing patterns (for future test migration)
- Stack Overflow discussions on Express typing - Various patterns, not authoritative

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed, TypeScript support is first-class
- Architecture: HIGH - Socket.io official docs + factory pattern well-documented
- Pitfalls: HIGH - Official Socket.io warning + known TypeScript migration issues
- Persistence: HIGH - Node.js fs module stable, @types/node comprehensive
- Express typing: MEDIUM - Express v5 types are new (2024), less documentation than v4

**Research date:** 2026-01-28
**Valid until:** 60 days (stable ecosystem—Socket.io v4, Express v5, TypeScript v5 are mature)
