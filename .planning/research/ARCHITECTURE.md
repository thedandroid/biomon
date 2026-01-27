# Architecture Patterns: TypeScript Socket.io Node.js Applications

**Domain:** Real-time Socket.io server with TypeScript
**Researched:** 2026-01-27
**Confidence:** HIGH (based on Socket.io 4.x patterns and TypeScript best practices)

## Executive Summary

TypeScript Socket.io applications benefit from centralizing type definitions in dedicated type files, using interface-based event maps for compile-time safety, and organizing handlers into modular controller functions. The current BIOMON codebase's 887-line monolithic server.js should be decomposed into typed modules during migration, with types extracted to a central location that serves as the "contract" between client and server.

**Key architectural shift:** Types become the source of truth, handlers become type-safe consumers.

## Recommended Architecture

### Type-First Structure

```
src/
├── types/
│   ├── events.ts          # Socket.io event type maps
│   ├── state.ts           # State shape and player types
│   ├── effects.ts         # Effect and roll event types
│   └── index.ts           # Re-export all types
├── handlers/
│   ├── playerHandlers.ts  # player:add, player:update, player:remove
│   ├── rollHandlers.ts    # roll:trigger, roll:apply, roll:undo
│   ├── effectHandlers.ts  # effect:clear, condition:toggle
│   └── sessionHandlers.ts # session:save, session:load, session:list
├── utils/
│   ├── validation.ts      # Type-safe clamp, validation helpers
│   ├── ids.ts             # ID generation
│   └── playerHelpers.ts   # ensurePlayerFields with types
├── data/
│   ├── responseTables.ts  # Typed stress/panic tables
│   └── constants.ts       # Typed constants
├── persistence/
│   ├── autosave.ts        # Typed autosave logic
│   └── sessionManager.ts  # Campaign load/save with types
├── createServer.ts        # Typed server factory
└── server.ts              # Thin entry point, wires handlers
```

**Rationale:** Types in one place, consumed everywhere. Handlers organized by domain. Server.ts becomes a router, not a monolith.

### Type Definition Patterns

#### 1. Event Type Maps (Socket.io 4.x Pattern)

**Location:** `src/types/events.ts`

**Pattern:** Define separate interfaces for client-to-server and server-to-client events, then apply to Socket.io generics.

```typescript
// Client -> Server events
interface ClientToServerEvents {
  "player:add": (payload: {
    name?: string;
    maxHealth?: number;
    health?: number;
    stress?: number;
    resolve?: number;
  }) => void;

  "player:update": (payload: {
    id: string;
    name?: string;
    maxHealth?: number;
    health?: number;
    stress?: number;
    resolve?: number;
  }) => void;

  "player:remove": (payload: { id: string }) => void;

  "roll:trigger": (payload: {
    playerId: string;
    rollType: "stress" | "panic";
    modifiers?: number;
  }) => void;

  "roll:apply": (payload: {
    playerId: string;
    eventId: string;
    tableEntryId?: string;
  }) => void;

  // ... all other events
}

// Server -> Client events
interface ServerToClientEvents {
  state: (state: GameState) => void;
  "session:save:result": (result: SaveResult) => void;
  "session:load:result": (result: LoadResult) => void;
  "session:list:result": (campaigns: Campaign[]) => void;
  "session:export:result": (state: GameState) => void;
  "session:import:result": (result: ImportResult) => void;
  "session:autosave:info": (info: AutosaveInfo) => void;
}

// Inter-server events (not used in BIOMON, but part of Socket.io typing)
interface InterServerEvents {}

// Socket data (per-connection metadata)
interface SocketData {
  userId?: string;
  connectedAt: number;
}

// Export typed Socket and Server
export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
```

**Why this pattern:**
- TypeScript validates event names at compile time
- Payload shapes are enforced
- IDE autocomplete shows available events and their signatures
- Refactoring event names updates all usage sites automatically

#### 2. State Types (Central Schema)

**Location:** `src/types/state.ts`

**Pattern:** Define state shape with strict types, avoiding `any` or implicit types.

```typescript
export interface Player {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  stress: number;
  resolve: number;
  activeEffects: Effect[];
  lastRollEvent: RollEvent | null;
}

export interface Effect {
  id: string;
  type: string;
  label: string;
  severity: 1 | 2 | 3 | 4 | 5;
  createdAt: number;
  durationType: "manual" | "scene" | "round" | "shift";
  durationValue?: number;
  clearedAt: number | null;
}

export interface RollEvent {
  eventId: string;
  playerId: string;
  type: "stress" | "panic";
  total: number;
  die: number;
  stress: number;
  resolve: number;
  modifiers: number;
  tableEntryId: string;
  timestamp: number;
  applied: boolean;
  appliedEffectId: string | null;
  appliedTableEntryId?: string;
  appliedTableEntryLabel?: string;
  appliedTableEntryDescription?: string;
  appliedTableEntryStressDelta?: number;
  appliedStressDuplicate?: boolean;
  stressDeltaApplied?: boolean;
  stressDeltaAppliedValue?: number;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: "info" | "stress" | "panic" | "health" | "system";
  message: string;
  details: string | null;
}

export interface SessionMetadata {
  campaignName: string | null;
  createdAt: string | null;
  lastSaved: string | null;
  sessionCount: number;
}

export interface GameState {
  players: Player[];
  rollEvents: RollEvent[];
  missionLog: LogEntry[];
  metadata: SessionMetadata;
}
```

**Why strict types here:**
- `severity: 1 | 2 | 3 | 4 | 5` instead of `number` catches out-of-range values
- `durationType` as union type prevents typos
- `null` vs `undefined` distinction made explicit
- State shape matches JSON persistence format

#### 3. Table Entry Types

**Location:** `src/types/effects.ts` or `src/data/responseTables.ts`

**Pattern:** Type the game data tables with discriminated unions for different entry types.

```typescript
interface BaseTableEntry {
  min: number;
  max: number;
  id: string;
  label: string;
  description: string;
  severity: 1 | 2 | 3 | 4 | 5;
  persistent: boolean;
}

interface PersistentEntry extends BaseTableEntry {
  persistent: true;
  durationType: "manual" | "scene" | "round" | "shift";
  durationValue?: number;
  applyOptions?: Array<{ id: string; label: string }>;
}

interface NonPersistentEntry extends BaseTableEntry {
  persistent: false;
  stressDelta?: number;
}

export type TableEntry = PersistentEntry | NonPersistentEntry;

export type StressTable = readonly TableEntry[];
export type PanicTable = readonly TableEntry[];
```

**Why discriminated unions:**
- TypeScript narrows types based on `persistent` flag
- Can't access `durationType` on non-persistent entries (compile error)
- `readonly` prevents accidental table mutation
- Table as const assertion ensures data integrity

### Component Boundaries

| Component | Responsibility | Dependencies | Exports |
|-----------|---------------|--------------|---------|
| **types/** | Type definitions only | None (pure types) | All interfaces, types, type guards |
| **handlers/** | Socket event logic | types, utils, data, persistence | Handler registration functions |
| **utils/** | Pure validation/helpers | types | Type-safe utility functions |
| **data/** | Game tables & constants | types | Typed lookup functions |
| **persistence/** | File I/O operations | types, Node fs/path | Save/load with typed return values |
| **createServer.ts** | Server factory | Socket.io, Express | Typed Server and Socket |
| **server.ts** | Entry point, wiring | All handlers, createServer | None (runs application) |

**Key principle:** Types flow downward, functions flow upward. Types have no dependencies. Business logic imports types.

## Migration Order Recommendations

### Phase 1: Foundation (Type Definitions)

**Order:** Bottom-up from pure data to server logic

1. **Create `src/types/` directory structure**
   - Extract state interfaces from existing code
   - Define event type maps based on current socket.on() handlers
   - Type table entries and constants

2. **Convert `responseTables.js` → `responseTables.ts`**
   - Already pure data, no side effects
   - Add types to STRESS_TABLE and PANIC_TABLE
   - Type resolveEntry() and getEntryById() return values
   - Minimal migration risk

3. **Convert `utils.js` → `utils.ts`**
   - Already pure functions
   - Add explicit parameter and return types
   - Use generics for clamp<T extends number>() if beneficial
   - Type guards for runtime validation

**Why this order:** Pure data → pure functions → stateful logic. Foundation types enable everything else.

### Phase 2: Infrastructure (Server & Persistence)

4. **Convert `createServer.js` → `createServer.ts`**
   - Apply Socket.io generic types
   - Return typed Server and Socket instances
   - CORS configuration remains runtime

5. **Extract persistence logic from server.js → `src/persistence/`**
   - Type file read/write operations
   - Define SaveResult, LoadResult types
   - Error handling with typed Result<T, E> pattern

**Why this order:** Server setup and persistence are isolated concerns. Can be typed without touching handler logic.

### Phase 3: Handlers (Event Logic)

6. **Extract and type handlers from server.js → `src/handlers/`**
   - Group by domain (player, roll, effect, session)
   - Each handler file exports registration function:
     ```typescript
     export function registerPlayerHandlers(
       socket: TypedSocket,
       state: GameState,
       broadcast: () => void
     ): void {
       socket.on("player:add", (payload) => {
         // TypeScript knows payload shape
       });
     }
     ```
   - Handlers are now testable in isolation

7. **Refactor `server.ts` to wire handlers**
   - io.on("connection") becomes thin router
   - Calls registration functions from each handler module
   - State management logic extracted to separate module

**Why this order:** Handlers depend on types and utils. Extract after foundation is typed.

### Phase 4: Tests & Validation

8. **Convert test files to TypeScript**
   - `utils.test.js` → `utils.test.ts`
   - `responseTables.test.js` → `responseTables.test.ts`
   - `server.integration.test.js` → `server.integration.test.ts`
   - Use typed Socket.io test clients

9. **Update build configuration**
   - Configure TypeScript compiler (tsconfig.json)
   - Update esbuild bundler to compile .ts files
   - Ensure pkg still produces working executable

**Why last:** Tests validate the migration worked. Build config must handle all TypeScript.

## Handler Organization Patterns

### Current Pattern (Monolithic)

```javascript
// server.js line 310-855 (545 lines of handlers)
io.on("connection", (socket) => {
  socket.on("player:add", (payload) => { /* 24 lines */ });
  socket.on("player:remove", (payload) => { /* 8 lines */ });
  socket.on("player:update", (payload) => { /* 36 lines */ });
  // ... 17 more event handlers inline
});
```

**Problems:**
- 887 lines in one file
- No separation of concerns
- Hard to test individual handlers
- Difficult to reason about scope

### Recommended Pattern (Modular)

```typescript
// src/handlers/playerHandlers.ts
import type { TypedSocket } from "../types/events";
import type { GameState } from "../types/state";
import { clamp, newId } from "../utils/validation";
import { ensurePlayerFields } from "../utils/playerHelpers";
import { DEFAULT_MAX_HEALTH, MAX_HEALTH_CAP } from "../data/constants";

export function registerPlayerHandlers(
  socket: TypedSocket,
  state: GameState,
  broadcast: () => void,
  addLogEntry: (type: string, message: string, details?: string) => void
): void {
  socket.on("player:add", (payload) => {
    // TypeScript validates payload shape automatically
    const name = (payload.name ?? "").trim().slice(0, 40) || "UNNAMED";
    const maxHealth = clamp(
      payload.maxHealth ?? DEFAULT_MAX_HEALTH,
      1,
      MAX_HEALTH_CAP
    );

    state.players.push({
      id: newId(),
      name,
      maxHealth,
      health: clamp(payload.health ?? maxHealth, 0, maxHealth),
      stress: clamp(payload.stress ?? 0, 0, 10),
      resolve: clamp(payload.resolve ?? 0, 0, 10),
      activeEffects: [],
      lastRollEvent: null,
    });

    addLogEntry("system", `CREW MEMBER ADDED: ${name}`);
    broadcast();
  });

  socket.on("player:update", (payload) => {
    const player = state.players.find((p) => p.id === payload.id);
    if (!player) return;

    ensurePlayerFields(player);

    if (payload.name !== undefined) {
      player.name = payload.name.trim().slice(0, 40) || player.name;
    }

    if (payload.maxHealth !== undefined) {
      player.maxHealth = clamp(payload.maxHealth, 1, MAX_HEALTH_CAP);
      if (player.health > player.maxHealth) {
        player.health = player.maxHealth;
      }
    }

    // ... rest of update logic

    broadcast();
  });

  socket.on("player:remove", (payload) => {
    const player = state.players.find((p) => p.id === payload.id);
    const name = player?.name ?? "UNKNOWN";

    state.players = state.players.filter((p) => p.id !== payload.id);
    addLogEntry("system", `CREW MEMBER REMOVED: ${name}`);
    broadcast();
  });
}
```

```typescript
// src/server.ts (new thin entry point)
import { createServer } from "./createServer";
import { loadAutosave, scheduleSave } from "./persistence/autosave";
import { registerPlayerHandlers } from "./handlers/playerHandlers";
import { registerRollHandlers } from "./handlers/rollHandlers";
import { registerEffectHandlers } from "./handlers/effectHandlers";
import { registerSessionHandlers } from "./handlers/sessionHandlers";
import type { GameState } from "./types/state";

const { app, server, io } = createServer({
  corsOrigin: process.env.BIOMON_CORS_ORIGIN || "http://localhost:3051",
});

const state: GameState = loadAutosave() || initializeEmptyState();

function broadcast(): void {
  // Backfill player fields for consistency
  state.players.forEach(ensurePlayerFields);

  // Broadcast to main namespace
  io.emit("state", state);

  // Broadcast to external namespace
  io.of("/external").emit("state", state);

  // Schedule autosave
  scheduleSave(state);
}

io.on("connection", (socket) => {
  // Send initial state
  state.players.forEach(ensurePlayerFields);
  socket.emit("state", state);

  // Register all handler modules
  registerPlayerHandlers(socket, state, broadcast, addLogEntry);
  registerRollHandlers(socket, state, broadcast, addLogEntry);
  registerEffectHandlers(socket, state, broadcast, addLogEntry);
  registerSessionHandlers(socket, state, broadcast);

  // Connection lifecycle
  socket.on("disconnect", (reason) => {
    console.log(`[DISCONNECT] ${socket.id} (${reason})`);
  });
});

// External namespace setup
io.of("/external").on("connection", (socket) => {
  console.log(`[EXTERNAL] Client connected: ${socket.id}`);
  state.players.forEach(ensurePlayerFields);
  socket.emit("state", state);
});

const PORT = process.env.PORT || 3050;
server.listen(PORT, () => {
  console.log(`Party dashboard running on http://localhost:${PORT}`);
  console.log(`GM panel: http://localhost:${PORT}/gm`);
});
```

**Benefits:**
- server.ts is ~80 lines instead of 887
- Each handler module is independently testable
- Import graph shows dependencies clearly
- Types enforce consistency across modules
- Can mock dependencies for unit tests

## Data Flow with Types

### Current Flow (JavaScript)

```javascript
// Client emits
socket.emit("player:add", { name: "Ripley", stress: 3 });

// Server receives (no type checking)
socket.on("player:add", (payload) => {
  // payload is 'any' - could be anything
  const name = String(payload?.name ?? ""); // defensive coercion
  const stress = clamp(payload?.stress ?? 0, 0, 10); // runtime validation
  // ...
});
```

### TypeScript Flow

```typescript
// types/events.ts defines contract
interface ClientToServerEvents {
  "player:add": (payload: {
    name?: string;
    stress?: number;
    // ... other fields
  }) => void;
}

// Server handler is type-safe
socket.on("player:add", (payload) => {
  // payload is { name?: string; stress?: number; ... }
  // TypeScript knows the shape at compile time

  // Still do runtime validation for untrusted input
  const name = (payload.name ?? "").trim().slice(0, 40) || "UNNAMED";
  const stress = clamp(payload.stress ?? 0, 0, 10);

  // But typos caught: payload.stres would be compile error
});
```

**Key distinction:** Types document the contract, but don't eliminate need for validation. Socket.io payloads are still untrusted network input. Types prevent bugs in handler logic, validation prevents malicious input.

## Patterns to Follow

### Pattern 1: Type Guards for Runtime Validation

**What:** Functions that narrow TypeScript types at runtime.

**When:** Converting untyped input (JSON files, network payloads) to typed values.

**Example:**
```typescript
// types/guards.ts
export function isPlayer(value: unknown): value is Player {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.health === "number" &&
    typeof obj.maxHealth === "number" &&
    typeof obj.stress === "number" &&
    typeof obj.resolve === "number" &&
    Array.isArray(obj.activeEffects) &&
    (obj.lastRollEvent === null || typeof obj.lastRollEvent === "object")
  );
}

// persistence/autosave.ts
export function loadAutosave(): GameState | null {
  try {
    const data = JSON.parse(fs.readFileSync(AUTOSAVE_PATH, "utf8"));

    if (!isGameState(data)) {
      console.error("[AUTOSAVE] Invalid state shape");
      return null;
    }

    return data; // TypeScript knows this is GameState
  } catch (err) {
    return null;
  }
}
```

### Pattern 2: Branded Types for IDs

**What:** Use TypeScript brands to distinguish different ID types.

**When:** Preventing mixing up player IDs, effect IDs, event IDs.

**Example:**
```typescript
// types/ids.ts
declare const brand: unique symbol;

type Brand<T, B> = T & { [brand]: B };

export type PlayerId = Brand<string, "PlayerId">;
export type EffectId = Brand<string, "EffectId">;
export type EventId = Brand<string, "EventId">;

export function playerId(id: string): PlayerId {
  return id as PlayerId;
}

// Usage
interface Player {
  id: PlayerId; // can't pass EffectId by mistake
  name: string;
  // ...
}

socket.on("player:remove", (payload: { id: PlayerId }) => {
  // TypeScript ensures payload.id is PlayerId, not just any string
});
```

**Tradeoff:** Adds type safety but requires casting. Use for critical ID boundaries (player, effect, event).

### Pattern 3: Result Type for Operations

**What:** Use Result<T, E> instead of throwing errors.

**When:** File I/O, session operations that can fail gracefully.

**Example:**
```typescript
// types/result.ts
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

// persistence/sessionManager.ts
export function saveCampaign(
  state: GameState,
  campaignName: string
): Result<string, string> {
  try {
    const safeName = campaignName.replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
    const filename = `campaign-${safeName}.json`;
    const filepath = path.join(SESSIONS_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(state, null, 2), "utf8");

    return { success: true, value: filename };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error"
    };
  }
}

// Handler usage
socket.on("session:save", (payload) => {
  const result = saveCampaign(state, payload.campaignName);

  if (result.success) {
    socket.emit("session:save:result", { success: true, filename: result.value });
  } else {
    socket.emit("session:save:result", { success: false, error: result.error });
  }
});
```

**Benefits:** Forces error handling, no silent failures, composable with other Result operations.

### Pattern 4: Const Assertions for Tables

**What:** Use `as const` to make data structures deeply readonly.

**When:** Game tables that should never mutate.

**Example:**
```typescript
// data/responseTables.ts
export const STRESS_TABLE = [
  {
    min: -999,
    max: 0,
    id: "stress_keeping_cool",
    label: "Keeping Cool",
    description: "No effect.",
    severity: 1,
    persistent: false,
  },
  // ... rest of table
] as const;

// TypeScript infers:
// typeof STRESS_TABLE = readonly [{ min: -999, max: 0, ... }, ...]
// STRESS_TABLE[0].id is "stress_keeping_cool", not just string

export type StressTableEntry = typeof STRESS_TABLE[number];
// StressTableEntry is the union of all table entries
```

**Benefits:**
- Prevents accidental mutation
- Specific string literals in types (better autocomplete)
- Entries can't be added/removed at runtime

## Anti-Patterns to Avoid

### Anti-Pattern 1: Type Assertions Without Validation

**What goes wrong:** Using `as` to cast types without runtime checks.

**Why bad:** Breaks type safety at the boundary between runtime and compile time.

**Example of what NOT to do:**
```typescript
// BAD: No validation, assumes payload is correct
socket.on("player:add", (payload) => {
  const player = payload as Player; // DANGER: payload could be anything
  state.players.push(player);
});

// GOOD: Validate before trusting
socket.on("player:add", (payload) => {
  const player: Player = {
    id: newId(),
    name: (payload.name ?? "").trim().slice(0, 40) || "UNNAMED",
    health: clamp(payload.health ?? 5, 0, 10),
    // ... explicitly construct valid object
  };
  state.players.push(player);
});
```

### Anti-Pattern 2: Inline Types Instead of Shared Definitions

**What goes wrong:** Duplicating type definitions across files.

**Why bad:** Changes require updates in multiple places, types drift.

**Example of what NOT to do:**
```typescript
// BAD: Type defined inline in handler
function registerPlayerHandlers(
  socket: Socket,
  state: { players: Array<{ id: string; name: string; }> } // inline type
) {
  // ...
}

// BAD: Same type redefined elsewhere
function broadcast(
  state: { players: Array<{ id: string; name: string; }> } // duplicate
) {
  // ...
}

// GOOD: Centralized type
import type { GameState } from "../types/state";

function registerPlayerHandlers(socket: Socket, state: GameState) { }
function broadcast(state: GameState) { }
```

### Anti-Pattern 3: Optional Chaining Instead of Types

**What goes wrong:** Using `?.` everywhere instead of fixing types.

**Why bad:** Hides the real problem (unknown shapes), makes code defensive for no reason.

**Example of what NOT to do:**
```typescript
// BAD: payload could be anything, defend everywhere
socket.on("player:update", (payload) => {
  const id = payload?.id;
  const name = payload?.name;
  const player = state.players?.find((p) => p?.id === id);
  player?.activeEffects?.forEach(/* ... */);
});

// GOOD: Type the payload, trust in typed context
socket.on("player:update", (payload) => {
  // payload is typed via ClientToServerEvents
  const id = payload.id; // definitely exists per type
  const name = payload.name; // may be undefined per type (optional)
  const player = state.players.find((p) => p.id === id);
  if (player) {
    player.activeEffects.forEach(/* ... */); // no optional chaining needed
  }
});
```

**Guideline:** Optional chaining is for handling legitimate optional values, not for working around unknown types.

### Anti-Pattern 4: Splitting Across Too Many Files

**What goes wrong:** Creating a file for every single handler (20+ files).

**Why bad:** Navigation becomes tedious, related logic is fragmented.

**Example of what NOT to do:**
```
handlers/
├── playerAdd.ts         # One handler per file
├── playerUpdate.ts
├── playerRemove.ts
├── rollTrigger.ts
├── rollApply.ts
├── rollUndo.ts
├── rollClear.ts
├── rollApplyStressDelta.ts
├── effectClear.ts
├── conditionToggle.ts
├── sessionSave.ts
├── sessionLoad.ts
├── sessionList.ts
├── sessionClear.ts
├── sessionExport.ts
├── sessionImport.ts
└── partyClear.ts        # 17 tiny files
```

**Better:** Group by domain (player, roll, effect, session). 4-6 handler files total.

```
handlers/
├── playerHandlers.ts    # All player:* events
├── rollHandlers.ts      # All roll:* events
├── effectHandlers.ts    # effect:clear, condition:toggle
└── sessionHandlers.ts   # All session:* events
```

**Rule of thumb:** If handlers share state or helper functions, they belong in the same file.

## Scalability Considerations

### At Current Scale (~1,300 LOC, 17 events)

**Recommended structure:**
- 4 handler modules (player, roll, effect, session)
- 1 types directory with 3-4 type files
- 1 utils directory with 2-3 helper modules
- ~10 total TypeScript files (down from 1 monolith)

**Why this scales:** Each module is 100-200 lines, independently testable, clear boundaries.

### At 10x Scale (~13,000 LOC, 100+ events)

**Would need:**
- Domain-driven module structure (crew, combat, inventory, etc.)
- Shared handler utilities extracted (authentication, validation middleware)
- Event bus or command pattern for cross-domain operations
- State management library (MobX, Zustand, or custom observable)

**Migration path:** Current 4-handler structure extends to N-domain structure. Types remain centralized.

### At 100x Scale (100,000+ LOC)

**Architecture shift:**
- Microservices with separate Socket.io servers per domain
- Shared type package published as npm module
- Message queue between services
- Event sourcing for state changes

**Not relevant for BIOMON**, but the type-first structure enables this evolution without rewriting type definitions.

## Testing Strategy with Types

### Unit Tests (Utils & Pure Functions)

```typescript
// utils/validation.test.ts
import { describe, it, expect } from "vitest";
import { clamp, clampInt } from "./validation";

describe("clamp", () => {
  it("clamps within bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("handles NaN as lower bound", () => {
    expect(clamp(NaN, 0, 10)).toBe(0);
  });
});
```

**Types enable:** Exhaustive test coverage via type narrowing. TypeScript ensures all code paths are tested.

### Integration Tests (Event Handlers)

```typescript
// handlers/playerHandlers.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { io as ioClient } from "socket.io-client";
import { createServer } from "../createServer";
import type { TypedServer } from "../types/events";
import type { GameState } from "../types/state";

describe("Player Handlers", () => {
  let server: TypedServer;
  let state: GameState;

  beforeEach(() => {
    const result = createServer({ corsOrigin: "*" });
    server = result.io;
    state = { players: [], rollEvents: [], missionLog: [], metadata: {} };

    // Register handlers
    server.on("connection", (socket) => {
      registerPlayerHandlers(socket, state, () => {}, () => {});
    });
  });

  it("adds player with valid payload", (done) => {
    const client = ioClient("http://localhost:3050");

    client.on("connect", () => {
      client.emit("player:add", { name: "Ripley", stress: 5 });
    });

    client.on("state", (newState: GameState) => {
      expect(newState.players).toHaveLength(1);
      expect(newState.players[0].name).toBe("Ripley");
      expect(newState.players[0].stress).toBe(5);
      client.disconnect();
      done();
    });
  });
});
```

**Types enable:**
- Test client knows exact event signatures
- State assertions are type-checked
- Mock implementations must match real signatures

### Type Testing (Type-Level Assertions)

```typescript
// types/events.test-d.ts (using vitest or tsd)
import { expectType } from "vitest";
import type { ClientToServerEvents, TypedSocket } from "./events";

// Verify event signatures are correct
expectType<ClientToServerEvents["player:add"]>(
  (payload: { name?: string }) => {}
);

// Verify socket.on accepts correct events
expectType<TypedSocket["on"]>(
  (event: "player:add", handler: (payload: { name?: string }) => void) => {}
);
```

**Types enable:** Test the type definitions themselves, catch regressions in type changes.

## Build Configuration

### tsconfig.json (Strict Mode)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

**Key flags:**
- `strict: true` — All strict checks enabled
- `noImplicitAny: true` — No implicit any types
- `strictNullChecks: true` — null and undefined are distinct
- `moduleResolution: "node"` — Use Node.js resolution for imports

### esbuild Integration

```javascript
// build.js (updated for TypeScript)
import esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/server.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outfile: "dist/server.bundled.cjs",
  external: ["socket.io"], // Don't bundle Socket.io
  sourcemap: true,
  minify: process.env.NODE_ENV === "production",
});
```

**Why esbuild:** Already in use, fast, supports TypeScript natively, produces CommonJS for pkg.

### package.json Scripts

```json
{
  "scripts": {
    "build": "tsc --noEmit && node build.js",
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.bundled.cjs",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsx": "^4.7.0",
    "@types/node": "^20.0.0",
    "@types/express": "^5.0.0"
  }
}
```

**Key changes:**
- `tsc --noEmit` validates types without emitting (esbuild handles compilation)
- `tsx` for development with TypeScript support
- New `typecheck` script for CI

## Migration Checklist

### Pre-Migration

- [ ] Audit current Socket.io event names (17 total)
- [ ] Document payload shapes for each event
- [ ] Identify all state mutations
- [ ] List all utility functions and their signatures
- [ ] Review persistence layer (JSON read/write)

### During Migration

- [ ] Create types/ directory structure
- [ ] Define event type maps (ClientToServerEvents, ServerToClientEvents)
- [ ] Define state types (GameState, Player, Effect, RollEvent)
- [ ] Convert responseTables.js → .ts (pure data)
- [ ] Convert utils.js → .ts (pure functions)
- [ ] Convert createServer.js → .ts (apply Socket.io generics)
- [ ] Extract handlers from server.js → handlers/ modules
- [ ] Extract persistence logic → persistence/ modules
- [ ] Refactor server.ts to wire handlers
- [ ] Update tests to use typed imports
- [ ] Configure tsconfig.json and build scripts
- [ ] Verify all tests pass
- [ ] Verify pkg build produces working executable

### Post-Migration

- [ ] Update documentation with type examples
- [ ] Add type testing for event signatures
- [ ] Document migration patterns for future reference
- [ ] Consider gradual type improvements (branded types, Result type)

## Expected File Structure After Migration

```
biomon/
├── src/
│   ├── types/
│   │   ├── events.ts          # Socket.io event type maps
│   │   ├── state.ts           # GameState, Player, Effect types
│   │   ├── effects.ts         # TableEntry, RollEvent types
│   │   ├── results.ts         # Result<T, E> utility type
│   │   └── index.ts           # Re-export all types
│   ├── handlers/
│   │   ├── playerHandlers.ts  # player:add, player:update, player:remove
│   │   ├── rollHandlers.ts    # roll:trigger, roll:apply, roll:undo, roll:clear
│   │   ├── effectHandlers.ts  # effect:clear, condition:toggle
│   │   └── sessionHandlers.ts # session:save, session:load, session:list, etc.
│   ├── utils/
│   │   ├── validation.ts      # clamp, clampInt with types
│   │   ├── ids.ts             # newId() with typed return
│   │   └── playerHelpers.ts   # ensurePlayerFields with types
│   ├── data/
│   │   ├── responseTables.ts  # Typed STRESS_TABLE, PANIC_TABLE
│   │   └── constants.ts       # Typed constants
│   ├── persistence/
│   │   ├── autosave.ts        # loadAutosave, scheduleSave with types
│   │   └── sessionManager.ts  # saveCampaign, loadCampaign with Result
│   ├── createServer.ts        # Typed server factory
│   └── server.ts              # Entry point (~100 lines)
├── dist/
│   └── server.bundled.cjs     # Compiled output for pkg
├── public/                     # Client code (unchanged)
├── test/                       # Test files (migrated to .ts)
├── tsconfig.json               # TypeScript configuration
├── build.js                    # esbuild bundler (TypeScript-aware)
└── package.json                # Updated scripts

Total TypeScript files: ~15-20
Lines per file: 50-200
Largest file: server.ts (~100 lines, down from 887)
```

## Summary of Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Types in dedicated directory** | Central source of truth, imported everywhere |
| **Socket.io generic types** | Compile-time event validation |
| **Handler extraction** | Independent testability, clear boundaries |
| **Modular structure (4 handler files)** | Balance between organization and navigability |
| **Strict TypeScript mode** | Maximum type safety, worth initial effort |
| **esbuild for compilation** | Already in use, fast, TypeScript support built-in |
| **Result type for I/O** | Explicit error handling, no silent failures |
| **Type guards for validation** | Runtime safety at trust boundaries |

---

**Next Steps for Roadmap:**

1. **Phase 1 foundation (types, pure data)** likely 1 milestone
2. **Phase 2 infrastructure (server, persistence)** likely 1 milestone
3. **Phase 3 handlers (extract and type)** likely 2-3 milestones (group by domain)
4. **Phase 4 tests & validation** likely 1 milestone

**Research confidence:** HIGH - patterns based on Socket.io 4.x official documentation and established TypeScript best practices.
