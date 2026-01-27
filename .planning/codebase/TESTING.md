# Testing Patterns

**Analysis Date:** 2026-01-27

## Test Framework

**Runner:**
- Vitest 4.0.18
- Config: `vitest.config.js`
- Environment: Node.js (no browser simulation)
- Globals enabled: `globals: true`

**Assertion Library:**
- Built-in expect (Vitest native)
- No additional assertion library needed

**Run Commands:**
```bash
npm test              # Run all tests once
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
npm run test:ui      # Browser UI (experimental)
```

**Configuration Details:**
- `vitest.config.js` defines:
  - Test files: `test/**/*.test.js` (glob pattern)
  - Coverage provider: `v8`
  - Coverage reporters: `["text", "json", "html"]`
  - Coverage excludes: `node_modules/`, `public/`, `scripts/`, `*.config.js`

## Test File Organization

**Location:**
- Dedicated `test/` directory (separate from source)
- Co-location NOT used - all tests in one directory

**Naming:**
- Pattern: `[module].test.js`
- Examples: `utils.test.js`, `server.integration.test.js`, `responseTables.test.js`

**Structure:**
```
test/
├── server.integration.test.js    # Socket.io integration tests
├── integration.external.test.js  # External client integration
├── utils.test.js                 # Utility function unit tests
├── responseTables.test.js        # Table data validation
└── selfcheck.test.js             # Schema/structure validation
```

## Test Structure

**Suite Organization:**
```javascript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

describe("Socket.io integration tests", () => {
  let io, clientSocket, httpServer;
  let state;

  beforeAll(async () => {
    // One-time setup: create server, start listening
    state = { players: [], rollEvents: [] };
    // ... server initialization
  });

  afterAll(async () => {
    // One-time cleanup: close connections, shutdown server
    if (clientSocket?.connected) clientSocket.close();
    if (io) io.close();
    if (httpServer) return new Promise(resolve => httpServer.close(resolve));
  });

  beforeEach(() => {
    // Reset state before each test
    state = { players: [], rollEvents: [] };
  });

  describe("player:add", () => {
    it("should add a new player with default values", async () => {
      // Arrange: setup test data (if needed, beyond beforeEach)
      clientSocket.emit("player:add", { name: "Test Player" });

      // Act: trigger behavior with Promise wrapper for async Socket.io
      const newState = await new Promise((resolve) => {
        clientSocket.once("state", resolve);
      });

      // Assert: verify results
      expect(newState.players).toHaveLength(1);
      expect(newState.players[0].name).toBe("Test Player");
    });
  });
});
```

**Key Patterns:**
- `describe()` blocks for logical grouping
- Nested `describe()` for testing specific methods/functions
- `beforeAll()` for expensive one-time setup (server creation)
- `beforeEach()` for test isolation (reset state)
- `afterAll()` for cleanup (close connections)
- `async/await` for asynchronous operations

## Mocking

**Framework:** None used

**When Mocking is NOT Appropriate:**
- Integration tests use real Socket.io server and clients
- Real HTTP server created with `createServer()` function
- Real state object used (not mocked)

**Pattern When Needed (would follow):**
- Vitest includes `vi` object for spying/mocking if needed
- Currently no external APIs mocked (no external integrations in codebase)
- File I/O operations NOT mocked in integration tests

**What NOT to Mock:**
- Socket.io server/client in integration tests
- HTTP server operations
- State objects being tested
- Database operations (not applicable)

## Fixtures and Factories

**Test Data:**
- Inline object creation in test files:
  ```javascript
  state.players.push({
    id: "test-id-123",
    name: "Test Player",
    health: 5,
    maxHealth: 5,
    stress: 0,
    resolve: 0,
    activeEffects: [],
    lastRollEvent: null,
  });
  ```

**Reusable Helper Functions:**
From `server.integration.test.js`:
```javascript
function resolveNextHigherDifferentEntry(rollType, total, currentEntryId) {
  // Logic to find next table entry
  const startId = String(currentEntryId ?? "");
  let t = clampInt(total, -999, 999);
  for (let i = 0; i < 25; i++) {
    t += 1;
    const next = resolveEntry(rollType, t);
    if (next && String(next.id ?? "") && String(next.id ?? "") !== startId)
      return next;
  }
  return null;
}

function pushRollEvent(ev) {
  state.rollEvents.push(ev);
  if (state.rollEvents.length > ROLL_FEED_CAP) {
    state.rollEvents.splice(0, state.rollEvents.length - ROLL_FEED_CAP);
  }
}

function broadcast() {
  for (const p of state.players) ensurePlayerFields(p);
  io.emit("state", state);
}
```

**Location:**
- Helper functions defined in same test file, above first test
- Closures capture shared state (`state`, `io`)

**Fixtures Pattern:**
- `beforeEach()` provides clean state for each test
- Within-test setup for specific scenarios:
  ```javascript
  it("should update player name", async () => {
    // Test-specific setup
    state.players.push({
      id: "test-player",
      name: "Original Name",
      // ...
    });

    // Act & Assert
  });
  ```

## Coverage

**Requirements:** None enforced (no threshold configured)

**View Coverage:**
```bash
npm run test:coverage
```

**Output:**
- Text summary in terminal
- HTML report in `coverage/` directory
- JSON report for CI integration

**Current Coverage:**
- Primary modules fully tested: `utils.js`, `responseTables.js`
- Integration tests cover Socket.io event handlers extensively
- External integration tests cover CORS and state broadcast
- Estimated line coverage: 70-80%+ (based on test depth)

## Test Types

**Unit Tests:**
- Location: `utils.test.js`, `responseTables.test.js`
- Scope: Individual pure functions
- Approach: Direct function calls with various inputs
- Example from `utils.test.js`:
  ```javascript
  describe("clamp", () => {
    it("should clamp value within range", () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(15, 0, 10)).toBe(10);
      expect(clamp(-5, 0, 10)).toBe(0);
    });
  });
  ```
- Edge cases tested: NaN, undefined, string coercion, boundary values

**Integration Tests:**
- Location: `server.integration.test.js`
- Scope: Socket.io event handlers with real server
- Approach: Create real server, connect client socket, emit/listen for events
- Covers: Player CRUD, roll mechanics, effect management, state broadcasts
- Tests verify complete flows (e.g., roll trigger → apply → undo)

**External Integration Tests:**
- Location: `integration.external.test.js`
- Scope: Read-only external client connections via `/external` namespace
- Approach: Real server with separate `/external` namespace
- Covers: CORS configuration, state broadcasts to external clients, multiple client synchronization
- Tests verify: External clients can connect and receive state updates

**Validation Tests:**
- Location: `selfcheck.test.js`, `responseTables.test.js`
- Scope: Data structure and schema validation
- Checks:
  - Required fields present: `min`, `max`, `id`, `label`, `description`
  - No gaps in table coverage (all totals -10 to 30 resolve to entry)
  - No overlapping ranges
  - Unique IDs within each table

## Common Patterns

**Async Testing (Socket.io events):**
```javascript
it("should add a new player with default values", async () => {
  clientSocket.emit("player:add", { name: "Test Player" });

  // Wrap Socket.io event listener in Promise
  const newState = await new Promise((resolve) => {
    clientSocket.once("state", resolve);
  });

  expect(newState.players).toHaveLength(1);
});
```

**Pattern explanation:**
- `clientSocket.emit()` sends event to server
- `clientSocket.once()` listens for single response
- Promise wraps the callback for `await` syntax
- Server broadcasts state via `io.emit("state", state)`
- Test receives broadcasted state and resolves Promise

**Timeout Safety:**
```javascript
beforeAll(async () => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Server startup timeout"));
    }, 5000);

    httpServer.listen(() => {
      const port = httpServer.address().port;
      // ... setup complete
      clearTimeout(timeout);
      resolve();
    });
  });
});
```

**Error Testing:**
```javascript
it("should not update non-existent player", async () => {
  const originalState = JSON.parse(JSON.stringify(state));

  clientSocket.emit("player:update", {
    id: "non-existent",
    stress: 10,
  });

  // Wait for potential broadcast
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Verify state unchanged
  expect(state.players[0].stress).toBe(originalState.players[0].stress);
});
```

**Assertion Patterns:**
```javascript
// Existence checks
expect(newState.players).toHaveLength(1);
expect(player.lastRollEvent).toBeDefined();
expect(effect.clearedAt).toBeNull();

// Value comparisons
expect(player.name).toBe("Test Player");
expect(player.health).toBe(5);
expect(player.stress).toBeLessThanOrEqual(10);

// Range checks
expect(die).toBeGreaterThanOrEqual(1);
expect(die).toBeLessThanOrEqual(6);

// Property presence
expect(newState).toHaveProperty("players");
expect(receivedState).toHaveProperty("rollEvents");

// Array/object shape
expect(newState.players[0]).toHaveProperty("id");
expect(effect).toEqual(expectedEffect);
```

**Cleanup Pattern:**
```javascript
afterEach(() => {
  // Disconnect all tracked clients after each test
  activeClients.forEach(client => {
    if (client && client.connected) {
      client.disconnect();
    }
  });
  activeClients.length = 0; // Clear array
});

afterAll(async () => {
  if (externalClient) {
    externalClient.disconnect();
  }
  io.close();
  await new Promise((resolve) => server.close(resolve));
});
```

**Multi-Client Testing:**
```javascript
it("supports multiple simultaneous external connections", async () => {
  const client1 = trackClient(Client(`${serverUrl}/external`, { reconnection: false }));
  const client2 = trackClient(Client(`${serverUrl}/external`, { reconnection: false }));

  await Promise.all([
    new Promise((resolve) => {
      let connected = false;
      let receivedState = false;

      client1.on("connect", () => {
        connected = true;
        if (receivedState) resolve();
      });

      client1.on("state", () => {
        receivedState = true;
        if (connected) resolve();
      });
    }),
    // ... similar for client2
  ]);

  client1.disconnect();
  client2.disconnect();
});
```

## Test Maintenance

**When Tests Break:**
1. Check Socket.io event names match actual emitted events
2. Verify server startup completes within timeout
3. Ensure state cleanup in `beforeEach()` - incomplete resets cause cross-test pollution
4. Check for race conditions in multi-client tests (use timeouts)
5. Validate message structure in event payloads

**When Adding New Tests:**
1. Place in `test/[feature].test.js`
2. Use existing patterns for consistency
3. Add helper functions for reusable logic
4. Include both happy path and error cases
5. Clean up resources in `afterEach()` and `afterAll()`

---

*Testing analysis: 2026-01-27*
