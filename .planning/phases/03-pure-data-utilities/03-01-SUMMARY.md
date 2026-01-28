---
phase: 03-pure-data-utilities
plan: 01
subsystem: type-conversion
tags: [typescript, utilities, data-tables, type-safety]

requires:
  - 02-01  # Type definitions (Player, TableEntry, RollType types)
provides:
  - utils.ts with full type coverage
  - responseTables.ts with typed tables and const assertions
  - TableApplyOption type for raw table data
affects:
  - 03-02  # Next conversion will follow same patterns

tech-stack:
  added: []
  patterns:
    - "const assertion with satisfies for typed data structures"
    - "Type-only imports for compile-time type checking"
    - "Separate types for raw vs transformed data (TableApplyOption vs ApplyOption)"

key-files:
  created:
    - utils.ts
    - responseTables.ts
  modified:
    - src/types/tables.ts

decisions:
  - id: table-apply-option-type
    decision: "Added TableApplyOption separate from ApplyOption to distinguish raw table format from transformed state format"
    rationale: "Raw tables use {id, label} while runtime state uses {tableEntryId, label}. Separate types prevent confusion and make transformation explicit."
    impact: "Type system now catches mismatches between table definitions and state transformations"

metrics:
  duration: "2.7 minutes"
  completed: "2026-01-28"
---

# Phase 03 Plan 01: Convert Utils & Response Tables Summary

JWT auth with refresh rotation using jose library

## One-Liner

Converted utils.js and responseTables.js to TypeScript with full type coverage, const assertions on table data, and a new TableApplyOption type.

## What Was Done

### Task 1: Convert utils.js to utils.ts

**Files:** utils.ts

Converted utility functions to TypeScript with explicit type annotations:

- Added type-only import for Player type from src/types
- Added explicit number type annotations to all constants (DEFAULT_MAX_HEALTH, MAX_HEALTH_CAP, etc.)
- Added parameter and return types to all functions:
  - `clamp(n: number, lo: number, hi: number): number`
  - `clampInt(n: number, lo: number, hi: number): number`
  - `newId(): string`
  - `ensurePlayerFields(p: Partial<Player> | null | undefined): void`
  - `hasLiveEffect(p: Pick<Player, "activeEffects"> | null | undefined, effectType: string): boolean`
  - `d6(): number`
- Kept all runtime validation unchanged (Number coercions, NaN checks, null coalescing)
- Deleted original utils.js

**Commit:** c20c7d5

### Task 2: Convert responseTables.js to responseTables.ts with type fix

**Files:** responseTables.ts, src/types/tables.ts

First, fixed type mismatch in src/types/tables.ts:

- Added `TableApplyOption` interface with `id: string` and `label: string` fields
- Updated `TableEntry.applyOptions` to use `TableApplyOption[]` instead of `ApplyOption[]`
- This distinguishes raw table format from transformed state format

Then converted response tables to TypeScript:

- Added type-only imports for TableEntry and RollType from src/types
- Applied const assertion with type validation to both tables:
  ```typescript
  const STRESS_TABLE = [...] as const satisfies readonly TableEntry[];
  const PANIC_TABLE = [...] as const satisfies readonly TableEntry[];
  ```
- Added parameter and return types to all functions:
  - `pickEntryByTotal(table: readonly TableEntry[], total: number): TableEntry`
  - `getTable(rollType: RollType | string): readonly TableEntry[]`
  - `resolveEntry(rollType: RollType | string, total: number): TableEntry`
  - `getEntryById(rollType: RollType | string, entryId: string | null | undefined): TableEntry | null`
- Changed `|| null` to `?? null` in getEntryById for consistency
- Kept all runtime validation (Number/String coercions)
- Deleted original responseTables.js

**Commit:** 1b4973d

## Decisions Made

### 1. TableApplyOption vs ApplyOption Type Split

**Context:** Raw table data uses `{id, label}` while runtime state uses `{tableEntryId, label}`.

**Decision:** Created separate `TableApplyOption` type for raw table definitions.

**Rationale:** Makes the transformation from table data to state data explicit. Type system now catches if we try to use raw table data where transformed state is expected.

**Impact:** Future conversions will benefit from this clarity. Server.js transformation logic will be type-safe.

### 2. Const Assertion with Satisfies Pattern

**Context:** Tables need both literal type inference and type validation.

**Decision:** Used `as const satisfies readonly TableEntry[]` pattern.

**Rationale:**
- `as const` provides literal type inference (string literals, not string)
- `satisfies` validates structure against TableEntry interface
- `readonly` matches immutability from `as const`

**Impact:** Best of both worlds - literal types for IDs plus compile-time validation.

### 3. Keep All Runtime Validation

**Context:** TypeScript types are compile-time only, but Socket.io events come from untrusted clients.

**Decision:** Kept all Number() coercions, NaN checks, null coalescing, and array checks.

**Rationale:** Types don't protect against runtime data. Defensive code is still required for robustness.

**Impact:** No change in runtime behavior - types are purely additive.

## Deviations from Plan

None - plan executed exactly as written.

## Metrics

- **Tasks completed:** 2/2
- **Files converted:** 2 (utils.ts, responseTables.ts)
- **Files modified:** 1 (src/types/tables.ts)
- **Tests passing:** 79/79
- **Type errors:** 0
- **Duration:** 2.7 minutes

## Next Phase Readiness

**Ready for:** Phase 03 Plan 02 (next utility/data conversion)

**Patterns established:**
- Type-only imports pattern works seamlessly
- Const assertion with satisfies for data structures
- All existing tests pass without modification
- Runtime validation coexists with type checking

**No blockers identified.**

## Key Learnings

### 1. Type-Only Imports Are Essential

Using `import type` instead of regular imports:
- Prevents circular dependencies
- Makes it clear types are compile-time only
- Keeps runtime bundles smaller (types erased at compile time)

### 2. Const Assertions Provide Rich Type Information

The `as const satisfies readonly T[]` pattern:
- Preserves literal types (e.g., "stress_jumpy" not string)
- Validates against interface at compile time
- Enables autocomplete and type narrowing
- Catches typos and structure errors

### 3. Defensive Code Is Still Required

TypeScript types don't eliminate need for runtime validation:
- Socket.io events come from client (untrusted)
- Types are erased at runtime
- Keep Number() coercions, null checks, etc.

## Artifacts

- `/Users/daniel/Projects/biomon/utils.ts` - Typed utility functions
- `/Users/daniel/Projects/biomon/responseTables.ts` - Typed response tables with const assertions
- `/Users/daniel/Projects/biomon/src/types/tables.ts` - Updated with TableApplyOption type
