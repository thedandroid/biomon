# Phase 6: Test Migration & Validation - Research

**Researched:** 2026-01-28
**Domain:** Vitest TypeScript test migration, Socket.IO typed test clients, pkg executable validation
**Confidence:** HIGH

## Summary

Phase 6 converts 5 JavaScript test files (79 tests) to TypeScript while maintaining zero test failures. The domain involves:
- **File extension migration**: `.test.js` to `.test.ts` with TypeScript syntax
- **Type coverage**: Adding types to all test fixtures, mocks, and assertions (no `any`)
- **Import path updates**: Changing `.js` imports to `.ts` for source files
- **Typed Socket.IO clients**: Using generic types for test clients
- **pkg executable validation**: Ensuring the build still produces a working binary
- **Vitest configuration**: Updating include patterns for `.test.ts` files

The standard approach is straightforward file-by-file migration since Vitest already supports TypeScript natively via esbuild. The project has existing type definitions (`src/types/`) that tests can import. The critical requirements are:
1. All 79 existing tests continue to pass
2. No `any` types in test code (use existing type definitions)
3. pkg-built executable works correctly
4. TypeScript strict mode satisfied for test files

**Primary recommendation:** Migrate test files one-by-one in dependency order (utils.test.ts first, integration tests last), update vitest.config.ts include pattern, and validate pkg binary after migration.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.0.18 | Test framework | Already installed, native TypeScript support via esbuild |
| typescript | ^5.9.3 | Type-checking | Already configured with strict: true |
| socket.io-client | ^4.8.3 | Test client for integration tests | Already installed, supports typed events |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/node | ^25.0.10 | Node.js types | Already installed for test assertions |
| src/types/*.ts | - | Existing type definitions | Import for test fixtures and assertions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-place file migration | Parallel .test.ts files | In-place is cleaner, no duplicate maintenance |
| Manual Socket.IO types | socket.io-mock-ts | Real client types better match production |
| No type assertions | as const assertions | Type assertions provide clearer intent |

**Installation:**
```bash
# No new dependencies needed - all already installed
```

## Architecture Patterns

### Recommended Migration Order
```
1. test/utils.test.ts           # Pure functions, no Socket.IO
2. test/responseTables.test.ts  # Pure functions, uses table types
3. test/selfcheck.test.ts       # Pure functions, table validation
4. test/server.integration.test.ts    # Socket.IO integration
5. test/integration.external.test.ts  # External namespace integration
```

**Rationale:** Start with simple unit tests (no I/O), then move to integration tests. This catches type errors incrementally.

### Pattern 1: Typed Test Fixtures
**What:** Create typed fixtures that match production interfaces
**When to use:** All test data objects (players, effects, state)
**Example:**
```typescript
// Source: src/types/state.ts + Vitest TypeScript docs
import type { Player, Effect, GameState } from "../src/types/index.js";

// Typed fixture with partial fields for testing
const createTestPlayer = (overrides: Partial<Player> = {}): Player => ({
  id: "test-id-123",
  name: "Test Player",
  health: 5,
  maxHealth: 5,
  stress: 0,
  resolve: 0,
  activeEffects: [],
  lastRollEvent: null,
  ...overrides,
});

// Test uses typed fixture
describe("player:add", () => {
  it("should add player with default values", async () => {
    const expected: Partial<Player> = {
      name: "Test Player",
      health: 5,
      stress: 0,
    };
    // ...
  });
});
```

### Pattern 2: Typed Socket.IO Test Clients
**What:** Use Socket.IO generic types for test clients
**When to use:** Integration tests with Socket.IO
**Example:**
```typescript
// Source: Socket.IO TypeScript docs + existing src/types/events.ts
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents, GameState } from "../src/types/index.js";

type TypedClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

describe("Socket.io integration tests", () => {
  let clientSocket: TypedClientSocket;

  beforeAll(async () => {
    clientSocket = ioClient(`http://localhost:${port}`) as TypedClientSocket;
    // ...
  });

  it("should receive typed state", async () => {
    const state = await new Promise<GameState>((resolve) => {
      clientSocket.on("state", resolve);
    });

    expect(state.players).toBeInstanceOf(Array);
  });
});
```

### Pattern 3: State Type for Integration Tests
**What:** Use GameState type for test state object
**When to use:** Server integration tests that manage state
**Example:**
```typescript
// Source: existing test/server.integration.test.js + types
import type { GameState, Player, RollEvent } from "../src/types/index.js";

describe("Socket.io integration tests", () => {
  let state: GameState;

  beforeAll(async () => {
    state = {
      players: [],
      rollEvents: [],
      missionLog: [],
      metadata: {
        campaignName: null,
        createdAt: null,
        lastSaved: null,
        sessionCount: 0,
      },
    };
    // ...
  });

  beforeEach(() => {
    state.players = [];
    state.rollEvents = [];
  });
});
```

### Pattern 4: vitest.config.ts Update
**What:** Update test file include pattern for TypeScript
**When to use:** After migration complete
**Example:**
```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
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
    include: ["test/**/*.test.{js,ts}"],  // Support both during transition
  },
});
```

### Anti-Patterns to Avoid
- **Using `any` for test data:** Import types from `src/types/` instead
- **Ignoring type errors with `// @ts-ignore`:** Fix the types properly
- **Type-only tests without assertions:** Runtime behavior must still be tested
- **Changing test logic during migration:** Types only, no behavior changes
- **Creating separate test types:** Use production types, not test-specific duplicates

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test fixture types | Manual interface definitions | Import from `src/types/index.js` | Single source of truth |
| Socket.IO client types | Custom client interface | Generic `ClientSocket<S, C>` | Socket.IO has built-in TypeScript support |
| State initialization | Inline object literals | Type-safe factory functions | Reusable, consistent fixtures |
| Promise type assertions | Manual `as` casts | Generic `Promise<T>` | Better type inference |
| Effect type validation | Runtime checks | TypeScript `satisfies` | Compile-time verification |

**Key insight:** All types needed for tests already exist in `src/types/`. The migration is about using them, not creating new ones.

## Common Pitfalls

### Pitfall 1: Import Path Extensions
**What goes wrong:** TypeScript complains about `.js` extensions when source files are now `.ts`
**Why it happens:** Source files migrated to `.ts` but test imports still use `.js`
**How to avoid:** Update imports: `from "../utils.js"` becomes `from "../utils.ts"` or extensionless `from "../utils"`
**Warning signs:** "Cannot find module '../utils.js'" errors
**Prevention:**
```typescript
// WRONG (after source migration)
import { clamp } from "../utils.js";

// CORRECT (with moduleResolution: Bundler)
import { clamp } from "../utils.ts";
// OR extensionless (also works with Bundler)
import { clamp } from "../utils";
```
**Note:** Check project's `moduleResolution`. With `"Bundler"`, both `.ts` and extensionless work.

### Pitfall 2: Untyped Promise Callbacks
**What goes wrong:** `state` in `clientSocket.on("state", (state) => {...})` is implicitly `any`
**Why it happens:** Callback parameter not explicitly typed
**How to avoid:** Use typed Promise with generic or annotate callback parameter
**Warning signs:** TypeScript warning about implicit any
**Prevention:**
```typescript
// WRONG - implicit any
clientSocket.on("state", (state) => {
  expect(state.players).toBeDefined(); // state is any
});

// CORRECT - typed Promise
const state = await new Promise<GameState>((resolve) => {
  clientSocket.on("state", resolve);
});

// ALSO CORRECT - annotated parameter
clientSocket.on("state", (state: GameState) => {
  expect(state.players).toBeDefined();
});
```

### Pitfall 3: Test Object Literal Type Mismatches
**What goes wrong:** Test fixtures missing required fields causes type errors
**Why it happens:** Full `Player` interface has required fields tests didn't need
**How to avoid:** Use `Partial<T>` for incomplete fixtures, or create factory functions
**Warning signs:** "Property 'lastRollEvent' is missing" type errors
**Prevention:**
```typescript
// WRONG - incomplete fixture
const player: Player = { name: "Test" }; // Missing required fields

// CORRECT - Partial for incomplete
const playerFixture: Partial<Player> = { name: "Test" };

// BETTER - Factory with defaults
const createPlayer = (overrides: Partial<Player> = {}): Player => ({
  id: "test-id",
  name: "Test",
  health: 5,
  maxHealth: 5,
  stress: 0,
  resolve: 0,
  activeEffects: [],
  lastRollEvent: null,
  ...overrides,
});
```

### Pitfall 4: Server/Client Socket Type Confusion
**What goes wrong:** Using server socket types for client socket
**Why it happens:** Both called "Socket" in different packages
**How to avoid:** Alias imports: `Socket as ClientSocket` from client, `Socket as ServerSocket` from server
**Warning signs:** Type error on emit/on with wrong event map
**Prevention:**
```typescript
// WRONG - using server types for client
import { Socket } from "socket.io";
const client: Socket = ioClient(...); // Wrong!

// CORRECT - use client types
import { Socket as ClientSocket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "../src/types/index.js";

type TypedClient = ClientSocket<ServerToClientEvents, ClientToServerEvents>;
const client: TypedClient = ioClient(...);
```

### Pitfall 5: pkg Binary Validation Skipped
**What goes wrong:** Tests pass but pkg build fails or produces broken binary
**Why it happens:** Test migration doesn't exercise build pipeline
**How to avoid:** Explicit build+run validation after all tests migrate
**Warning signs:** Build errors only discovered in CI or deployment
**Prevention:**
```bash
# After test migration complete, run full validation:
npm run build  # Includes typecheck
./dist/biomon --version  # Or appropriate validation command
```

### Pitfall 6: Breaking Test Behavior During Migration
**What goes wrong:** Tests pass but behavior changed during "type only" migration
**Why it happens:** Accidentally modifying assertions or test logic while adding types
**How to avoid:** Migrate types only, never change test logic. Diff before commit.
**Warning signs:** Test count changes, different coverage
**Prevention:** Before each file migration:
1. Run tests, note count and results
2. Add types ONLY
3. Run tests, verify identical results
4. Commit

## Code Examples

### Complete Test File Migration (utils.test.ts)
```typescript
// test/utils.test.ts
// Source: Migrated from test/utils.test.js with types from src/types/
import { describe, it, expect } from "vitest";
import { clamp, clampInt, hasLiveEffect } from "../utils.ts";
import type { Player, Effect } from "../src/types/index.js";

describe("Server utility functions", () => {
  describe("clamp", () => {
    it("should clamp value within range", () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(15, 0, 10)).toBe(10);
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it("should handle NaN by returning lower bound", () => {
      expect(clamp(NaN, 0, 10)).toBe(0);
      // TypeScript allows testing runtime behavior with any-like values
      expect(clamp("invalid" as unknown as number, 0, 10)).toBe(0);
      expect(clamp(undefined as unknown as number, 0, 10)).toBe(0);
    });
  });

  describe("hasLiveEffect", () => {
    it("should return true when player has live effect", () => {
      const player: Pick<Player, "activeEffects"> = {
        activeEffects: [
          {
            id: "e1",
            type: "panic_paranoid",
            label: "Paranoid",
            severity: 3,
            createdAt: Date.now(),
            durationType: "manual",
            clearedAt: null
          },
        ],
      };
      expect(hasLiveEffect(player, "panic_paranoid")).toBe(true);
    });

    it("should return false when effect is cleared", () => {
      const player: Pick<Player, "activeEffects"> = {
        activeEffects: [
          {
            id: "e1",
            type: "panic_paranoid",
            label: "Paranoid",
            severity: 3,
            createdAt: Date.now() - 1000,
            durationType: "manual",
            clearedAt: Date.now()
          },
        ],
      };
      expect(hasLiveEffect(player, "panic_paranoid")).toBe(false);
    });

    it("should return false when player is null", () => {
      expect(hasLiveEffect(null, "panic_paranoid")).toBe(false);
    });
  });
});
```

### Integration Test Migration Pattern
```typescript
// test/server.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { createServer } from "http";
import { Server, type Socket as ServerSocket } from "socket.io";
import express from "express";
import type {
  GameState,
  Player,
  RollEvent,
  ClientToServerEvents,
  ServerToClientEvents,
} from "../src/types/index.js";

// Typed client socket
type TypedClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

// Typed server
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

describe("Socket.io integration tests", () => {
  let io: TypedServer;
  let clientSocket: TypedClientSocket;
  let httpServer: ReturnType<typeof createServer>;
  let state: GameState;

  beforeAll(async () => {
    state = {
      players: [],
      rollEvents: [],
      missionLog: [],
      metadata: {
        campaignName: null,
        createdAt: null,
        lastSaved: null,
        sessionCount: 0,
      },
    };

    const app = express();
    httpServer = createServer(app);
    io = new Server(httpServer);

    // ... rest of setup
  });

  describe("player:add", () => {
    it("should add a new player with default values", async () => {
      clientSocket.emit("player:add", { name: "Test Player" });

      const newState = await new Promise<GameState>((resolve) => {
        clientSocket.once("state", resolve);
      });

      expect(newState.players).toHaveLength(1);
      const player: Player = newState.players[0];
      expect(player.name).toBe("Test Player");
      expect(player.health).toBe(5);
    });
  });
});
```

### Typed Test Factory Functions
```typescript
// test/fixtures/factories.ts (optional helper file)
import type { Player, Effect, GameState } from "../../src/types/index.js";

export const createTestPlayer = (overrides: Partial<Player> = {}): Player => ({
  id: `test-${Date.now()}`,
  name: "Test Player",
  health: 5,
  maxHealth: 5,
  stress: 0,
  resolve: 0,
  activeEffects: [],
  lastRollEvent: null,
  ...overrides,
});

export const createTestEffect = (overrides: Partial<Effect> = {}): Effect => ({
  id: `effect-${Date.now()}`,
  type: "stress_jumpy",
  label: "Jumpy",
  severity: 2,
  createdAt: Date.now(),
  durationType: "manual",
  clearedAt: null,
  ...overrides,
});

export const createTestState = (overrides: Partial<GameState> = {}): GameState => ({
  players: [],
  rollEvents: [],
  missionLog: [],
  metadata: {
    campaignName: null,
    createdAt: null,
    lastSaved: null,
    sessionCount: 0,
  },
  ...overrides,
});
```

### vitest.config.ts Final Configuration
```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
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
    // After full migration, can be just "test/**/*.test.ts"
    include: ["test/**/*.test.{js,ts}"],
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Untyped test fixtures | Imported production types | TypeScript 4.0+ | Catch test data errors at compile time |
| Manual Socket.IO mocks | Typed real clients | Socket.IO v4 (2021) | Tests match production behavior |
| Separate test types | Shared production types | Modern best practice | Single source of truth |
| jest with ts-jest | Vitest native TS | 2023+ | No transform config needed |
| `.test.js` with JSDoc | `.test.ts` with full types | 2024+ | Better IDE support, strict checking |

**Deprecated/outdated:**
- **ts-jest transform**: Vitest uses esbuild natively, no transform needed
- **@types/jest**: Use `vitest` types instead
- **Manual type assertions everywhere**: Let TypeScript infer from typed functions

## Open Questions

Things that couldn't be fully resolved:

1. **Test factory file location**
   - What we know: Factory functions help create typed fixtures
   - What's unclear: Should factories be in `test/fixtures/` or inline in test files?
   - Recommendation: Start inline. If duplication grows, extract to `test/fixtures/factories.ts`

2. **Import extension strategy**
   - What we know: Project uses `moduleResolution: "Bundler"` which allows flexibility
   - What's unclear: Use `.ts` extension, `.js` extension, or extensionless?
   - Recommendation: Match existing codebase convention. Current source files use `.js` extensions in imports even for `.ts` files. Keep consistent.

3. **pkg validation depth**
   - What we know: pkg creates Windows executable from bundled code
   - What's unclear: How to test executable functionality beyond "it runs"
   - Recommendation: Basic smoke test - verify binary exists and can start. Full integration testing of binary may be out of scope for this phase.

## Sources

### Primary (HIGH confidence)
- [Vitest Getting Started](https://vitest.dev/guide/) - TypeScript support, configuration
- [Vitest Testing Types](https://vitest.dev/guide/testing-types) - Type testing capabilities
- [Socket.IO TypeScript Documentation](https://socket.io/docs/v4/typescript/) - Typed clients/servers
- [Socket.IO Testing](https://socket.io/docs/v4/testing/) - TypeScript test examples
- Project's existing `src/types/index.ts` - Production type definitions

### Secondary (MEDIUM confidence)
- [TypeScript TSConfig strict](https://www.typescriptlang.org/tsconfig/strict.html) - Strict mode implications for tests
- [Vitest TypeScript Best Practices](https://decodefix.com/vitest-with-typescript-best-practices-and-examples/) - Community patterns
- [Medium: Integration tests for WebSockets](https://medium.com/@juaogui159/how-to-effectively-write-integration-tests-for-websockets-using-vitest-and-socket-io-360208978210) - Vitest + Socket.IO patterns

### Tertiary (LOW confidence)
- [socket.io-mock-ts](https://github.com/james-elicx/socket.io-mock-ts) - Alternative mock approach (not recommended for this project)
- [Vercel pkg](https://github.com/vercel/pkg) - Executable packaging documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vitest already configured, types already exist in project
- Architecture: HIGH - Migration pattern is straightforward file-by-file
- Pitfalls: HIGH - Common TypeScript migration issues well documented
- pkg validation: MEDIUM - Basic validation clear, deep testing unclear

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (30 days - stable domain, no rapid changes expected)
