# Testing Guide

This project uses [Vitest](https://vitest.dev/) as its testing framework.

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with interactive UI
npm run test:ui

# Legacy table validation script
npm run selfcheck
```

## Test Structure

Tests are located in the `test/` directory:

### Unit Tests

- **`utils.test.js`** - Tests for server utility functions
  - `clamp()` - Value clamping within ranges
  - `clampInt()` - Integer truncation and clamping
  - `hasLiveEffect()` - Active effect checking

- **`responseTables.test.js`** - Tests for stress/panic table logic
  - Table structure validation
  - Entry resolution by total
  - ID lookup functionality
  - Apply options and special cases
  - Persistent flags and stress deltas

- **`selfcheck.test.js`** - Validation tests
  - Table coverage verification (-10 to 30 range)
  - Required field checks
  - ID uniqueness validation
  - Range overlap detection

### Integration Tests

- **`server.integration.test.js`** - Socket.io event handler tests
  - `player:add` - Adding players with validation
  - `player:remove` - Removing players safely
  - `player:update` - Updating player fields with clamping
  - `party:clear` - Clearing all state
  - `roll:trigger` - Creating stress/panic rolls
  - `roll:apply` - Applying roll results and effects
  - `roll:undo` - Undoing applied rolls
  - `effect:clear` - Clearing active effects

## Test Coverage

Run `npm run test:coverage` to generate a detailed coverage report.

Current test status:
- **Unit tests**: 46 tests passing
- **Integration tests**: 21 tests (currently skipped, need setup refinement)
- **Total active**: 46 passing tests

Key areas covered:
- ✅ Stress & Panic table resolution
- ✅ Entry lookup by ID
- ✅ Range validation and edge cases
- ✅ Utility function behavior (clamp, clampInt, hasLiveEffect)
- ✅ Table structure integrity
- ⏸️ Socket.io event handlers (tests written, currently skipped)
- ⏸️ Player state management (tests written, currently skipped)
- ⏸️ Roll event processing (tests written, currently skipped)
- ⏸️ Effect lifecycle management (tests written, currently skipped)

## Writing New Tests

### Unit Test Example

```javascript
import { describe, it, expect } from "vitest";

describe("Feature Name", () => {
  it("should do something specific", () => {
    const result = someFunction(input);
    expect(result).toBe(expected);
  });
});
```

### Integration Test Example

```javascript
import { describe, it, expect, beforeEach } from "vitest";

describe("Socket event", () => {
  beforeEach(() => {
    // Reset state before each test
    state = { players: [], rollEvents: [] };
  });

  it("should handle event correctly", (done) => {
    clientSocket.emit("event:name", payload);

    clientSocket.once("state", (newState) => {
      expect(newState.players).toHaveLength(1);
      done();
    });
  });
});
```

## Test Configuration

Configuration is in `vitest.config.js`:
- **Environment**: Node.js
- **Coverage provider**: v8
- **Test files**: `test/**/*.test.js`
- **Excluded from coverage**: `node_modules/`, `public/`, `scripts/`, config files

## Future Testing Goals

- [x] Socket.io event handler integration tests (written, need setup refinement)
- [x] Player state management tests (written, need setup refinement)
- [x] Roll event processing tests (written, need setup refinement)
- [x] Effect lifecycle tests (written, need setup refinement)
- [ ] Enable integration tests by fixing Socket.io client connection in test environment
- [ ] Duplicate panic roll handling edge cases
- [ ] Duplicate stress roll +1 stress behavior
- [ ] Roll feed cap enforcement (200 events)
- [ ] Frontend component tests (if refactored to modules)
- [ ] E2E tests for GM and Player views

### Enabling Integration Tests

The Socket.io integration tests are currently skipped. To enable them:
1. Remove `.skip` from `describe.skip` in `test/server.integration.test.js`
2. Fix the client socket connection issue in the `beforeAll` hook
3. Run `npm test` to verify they pass
