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
```

## Test Structure

Tests are located in the `test/` directory:

- **`responseTables.test.js`** - Tests for stress/panic table logic
  - Table structure validation
  - Entry resolution
  - ID lookup functionality
  - Apply options and special cases

- **`utils.test.js`** - Tests for server utility functions
  - `clamp()` - Value clamping within ranges
  - `clampInt()` - Integer truncation and clamping
  - `hasLiveEffect()` - Active effect checking

- **`selfcheck.test.js`** - Validation tests
  - Table coverage verification
  - Required field checks
  - ID uniqueness validation

## Coverage

Current test coverage: **46 tests passing**

Key areas covered:
- ✅ Stress & Panic table resolution
- ✅ Entry lookup by ID
- ✅ Range validation and edge cases
- ✅ Utility function behavior
- ✅ Table structure integrity

## Writing New Tests

Example test structure:

```javascript
import { describe, it, expect } from "vitest";

describe("Feature Name", () => {
  it("should do something specific", () => {
    const result = someFunction(input);
    expect(result).toBe(expected);
  });
});
```

## Future Testing Goals

- [ ] Socket.io event handler integration tests
- [ ] Player state management tests
- [ ] Roll event processing tests
- [ ] Effect lifecycle tests
- [ ] Frontend component tests (if refactored to modules)
