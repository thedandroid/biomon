# Phase 3: Pure Data & Utilities - Research

**Researched:** 2026-01-28
**Domain:** TypeScript migration of pure functions and data modules
**Confidence:** HIGH

## Summary

Phase 3 converts two JavaScript files to TypeScript: `utils.js` (6 functions, 5 constants) and `responseTables.js` (2 data tables, 3 functions). These are pure modules with no external dependencies, making them ideal candidates for conversion. The types needed (`Player`, `Effect`, `TableEntry`, `ApplyOption`, `RollType`) already exist in `src/types/`.

The standard approach is:
1. Rename `.js` to `.ts`
2. Add explicit type annotations to all function parameters and return types
3. Use `as const satisfies readonly TableEntry[]` for response tables
4. Import existing types from `src/types/`
5. Verify tests still pass with typed modules

**Primary recommendation:** Use `as const satisfies` pattern for response tables to get both literal type inference and type validation, then add explicit parameter/return types to all utility functions.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.9.3 | Type-checker | Already installed in Phase 1 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| src/types/ | - | Existing type definitions | Import `TableEntry`, `Player`, `ApplyOption` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `as const satisfies` | Type annotation only | Loses literal type inference for table IDs |
| Explicit return types | Inferred return types | Explicit is better for shared utilities (Phase 1 decision) |

**Installation:**
```bash
# No new dependencies - types exist from Phase 2
```

## Architecture Patterns

### Recommended File Structure
```
utils.ts           # Move from root to root (no src/ migration yet)
responseTables.ts  # Move from root to root (no src/ migration yet)
src/
  types/
    tables.ts      # Already contains TableEntry, ApplyOption
    state.ts       # Already contains Player, Effect
```

### Pattern 1: Const Assertions with Type Validation
**What:** Use `as const satisfies readonly T[]` for static data tables
**When to use:** Static lookup tables that need both literal inference and type safety
**Example:**
```typescript
// Source: TypeScript official docs + Total TypeScript
import type { TableEntry } from "./src/types/index.js";

const STRESS_TABLE = [
  {
    min: -999,
    max: 0,
    id: "stress_keeping_cool",
    label: "Keeping Cool",
    description: "No effect.",
    severity: 1,
    persistent: false,
  },
  // ... more entries
] as const satisfies readonly TableEntry[];

// Benefits:
// 1. Type-checked against TableEntry shape
// 2. Preserves literal types for 'id' field
// 3. Array is readonly (matches const assertion)
```

### Pattern 2: Explicit Function Type Annotations
**What:** Add parameter types and return types to all exported functions
**When to use:** All shared utility functions
**Example:**
```typescript
// Source: TypeScript handbook
function clamp(n: number, lo: number, hi: number): number {
  n = Number(n);
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

// For functions taking Player objects
import type { Player } from "./src/types/index.js";

function hasLiveEffect(p: Player | null | undefined, effectType: string): boolean {
  const type = String(effectType ?? "");
  if (!type) return false;
  const list = Array.isArray(p?.activeEffects) ? p.activeEffects : [];
  return list.some((e) => !e?.clearedAt && String(e?.type ?? "") === type);
}
```

### Pattern 3: Type-Only Imports
**What:** Use `import type` for types that don't exist at runtime
**When to use:** All type imports in converted modules
**Example:**
```typescript
// Correct - stripped during compilation, no runtime overhead
import type { Player, TableEntry, ApplyOption } from "./src/types/index.js";

// Constants export normally
export const DEFAULT_MAX_HEALTH = 5;
```

### Anti-Patterns to Avoid
- **Using `any` type:** The phase requirement is "no `any`" - use specific types or `unknown` with type guards
- **Removing runtime validation:** Keep all existing `String()`, `Number()`, `??`, `?.` patterns - types are compile-time only
- **Using type assertions (`as`):** Prefer `satisfies` for validation without widening
- **Making tables mutable:** Use `as const` to preserve readonly semantics

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TableEntry type | Define inline | Import from `src/types/tables.ts` | Already exists, prevents divergence |
| Player type | Define inline | Import from `src/types/state.ts` | Already exists with all fields |
| ApplyOption type | Define inline | Import from `src/types/state.ts` | Already exists |
| RollType union | Redefine | Import from `src/types/state.ts` | Already defined as `'stress' | 'panic'` |

**Key insight:** Phase 2 created all required types. Phase 3 consumes them - no new type definitions needed.

## Common Pitfalls

### Pitfall 1: Forgetting Readonly for Const Arrays
**What goes wrong:** Type error when using `as const satisfies T[]`
**Why it happens:** `as const` makes arrays readonly, but `T[]` is mutable
**How to avoid:** Use `readonly T[]` in the satisfies constraint
**Warning signs:** "Type 'readonly X[]' is not assignable to type 'X[]'"
```typescript
// Wrong
const TABLE = [...] as const satisfies TableEntry[];

// Correct
const TABLE = [...] as const satisfies readonly TableEntry[];
```

### Pitfall 2: Removing Defensive Coercions
**What goes wrong:** Runtime crashes on invalid input after migration
**Why it happens:** False confidence that types prevent bad data
**How to avoid:** Keep all `String()`, `Number()`, optional chaining
**Warning signs:** Removing `??`, `?.`, `String()`, `Number()` during conversion

### Pitfall 3: Implicit Any in Parameters
**What goes wrong:** Functions compile but with implicit `any`
**Why it happens:** TypeScript infers `any` when types are missing (strict mode catches this)
**How to avoid:** tsconfig has `strict: true` which includes `noImplicitAny`
**Warning signs:** ESLint `@typescript-eslint/no-unsafe-*` warnings

### Pitfall 4: Wrong Import Paths with moduleResolution: Bundler
**What goes wrong:** "Cannot find module" at compile time
**Why it happens:** Using wrong extension or missing extension in imports
**How to avoid:** Use `.js` extension in imports (esbuild/bundler convention)
**Warning signs:** Import errors that work at runtime but fail type-check
```typescript
// Correct with moduleResolution: "Bundler"
import type { Player } from "./src/types/index.js";

// Also works - no extension
import type { Player } from "./src/types/index";
```

### Pitfall 5: Incomplete TableEntry Type Coverage
**What goes wrong:** Some table entries fail type validation
**Why it happens:** `responseTables.js` has optional fields (`durationType`, `stressDelta`, `applyOptions`)
**How to avoid:** Verify `TableEntry` interface has all optional fields marked as `?:`
**Warning signs:** Type error on entries without `durationType` or `stressDelta`

## Code Examples

Verified patterns for this phase:

### utils.ts Complete Conversion
```typescript
// utils.ts
import type { Player } from "./src/types/index.js";

// Constants - explicit type annotations
const DEFAULT_MAX_HEALTH: number = 5;
const MAX_HEALTH_CAP: number = 10;
const MAX_STRESS: number = 10;
const MAX_RESOLVE: number = 10;
const ROLL_FEED_CAP: number = 200;

/**
 * Clamps a number between a minimum and maximum value.
 * Returns the lower bound if the input is NaN.
 */
function clamp(n: number, lo: number, hi: number): number {
  n = Number(n);
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Clamps an integer between a minimum and maximum value.
 * Truncates decimal values before clamping.
 */
function clampInt(n: number, lo: number, hi: number): number {
  return clamp(Math.trunc(Number(n)), lo, hi);
}

/**
 * Generates a unique ID based on timestamp and random hex.
 */
function newId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Ensures a player object has all required fields with defaults.
 * Mutates the player object in place.
 */
function ensurePlayerFields(p: Partial<Player> | null | undefined): void {
  if (!p) return;
  if (p.maxHealth === undefined) p.maxHealth = DEFAULT_MAX_HEALTH;
  if (p.health === undefined)
    p.health = clamp(p.health ?? p.maxHealth, 0, p.maxHealth);
  if (p.stress === undefined) p.stress = 0;
  if (p.resolve === undefined) p.resolve = 0;
  if (!Array.isArray(p.activeEffects)) p.activeEffects = [];
  if (p.lastRollEvent === undefined) p.lastRollEvent = null;
}

/**
 * Checks if a player has a live (not cleared) effect of a given type.
 */
function hasLiveEffect(
  p: Pick<Player, "activeEffects"> | null | undefined,
  effectType: string
): boolean {
  const type = String(effectType ?? "");
  if (!type) return false;
  const list = Array.isArray(p?.activeEffects) ? p.activeEffects : [];
  return list.some((e) => !e?.clearedAt && String(e?.type ?? "") === type);
}

/**
 * Rolls a six-sided die.
 */
function d6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export {
  DEFAULT_MAX_HEALTH,
  MAX_HEALTH_CAP,
  MAX_STRESS,
  MAX_RESOLVE,
  ROLL_FEED_CAP,
  clamp,
  clampInt,
  newId,
  ensurePlayerFields,
  hasLiveEffect,
  d6,
};
```

### responseTables.ts Complete Conversion
```typescript
// responseTables.ts
import type { TableEntry, RollType } from "./src/types/index.js";

const STRESS_TABLE = [
  {
    min: -999,
    max: 0,
    id: "stress_keeping_cool",
    label: "Keeping Cool",
    description: "No effect.",
    severity: 1,
    persistent: false,
  },
  // ... remaining entries unchanged, just typed
] as const satisfies readonly TableEntry[];

const PANIC_TABLE = [
  {
    min: -999,
    max: 0,
    id: "panic_keeping_cool",
    label: "Keeping Cool",
    description: "No effect.",
    severity: 1,
    persistent: false,
  },
  // ... remaining entries unchanged, just typed
] as const satisfies readonly TableEntry[];

function pickEntryByTotal(
  table: readonly TableEntry[],
  total: number
): TableEntry {
  const n = Number(total);
  for (const e of table) {
    if (n >= e.min && n <= e.max) return e;
  }
  return table[table.length - 1];
}

function getTable(rollType: RollType | string): readonly TableEntry[] {
  return rollType === "panic" ? PANIC_TABLE : STRESS_TABLE;
}

function resolveEntry(rollType: RollType | string, total: number): TableEntry {
  const table = getTable(rollType);
  return pickEntryByTotal(table, total);
}

function getEntryById(
  rollType: RollType | string,
  entryId: string | null | undefined
): TableEntry | null {
  const id = String(entryId ?? "");
  const table = getTable(rollType);
  return table.find((e) => e.id === id) ?? null;
}

export { STRESS_TABLE, PANIC_TABLE, resolveEntry, getEntryById };
```

### Test Import Update Pattern
```typescript
// test/utils.test.ts (minimal change)
import { describe, it, expect } from "vitest";
import { clamp, clampInt, hasLiveEffect } from "../utils.js"; // Note: still .js

// Tests remain unchanged - TypeScript is transparent to Vitest
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Type annotation on arrays | `as const satisfies readonly T[]` | TS 4.9 (2022) | Literal inference + type validation |
| Implicit return types | Explicit return types for exports | Always preferred | Better documentation, faster refactors |
| Type assertions (`as T`) | `satisfies T` | TS 4.9 (2022) | Type safety without widening |

**Deprecated/outdated:**
- `as Type` for type coercion: Use `satisfies` unless narrowing is actually needed
- Inline type definitions in converted files: Import from centralized `src/types/`

## Open Questions

None for this phase - all patterns are well-established and types exist from Phase 2.

## Sources

### Primary (HIGH confidence)
- [TypeScript Official Documentation - Migrating from JavaScript](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html) - function annotations, module exports
- [typescript-eslint explicit-function-return-type](https://typescript-eslint.io/rules/explicit-function-return-type/) - return type best practices
- [Total TypeScript - How to Use satisfies](https://www.totaltypescript.com/how-to-use-satisfies-operator) - as const satisfies pattern

### Secondary (MEDIUM confidence)
- [Better Stack - TypeScript as vs satisfies](https://betterstack.com/community/guides/scaling-nodejs/typescript-as-satisfies-type/) - when to use each
- [LogRocket - Complete Guide to Const Assertions](https://blog.logrocket.com/complete-guide-const-assertions-typescript/) - as const patterns

### Tertiary (LOW confidence)
- Community best practices on readonly arrays with satisfies - verified against official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, using existing types
- Architecture: HIGH - Well-established TypeScript migration patterns
- Pitfalls: HIGH - Common issues documented in TypeScript GitHub issues
- Code examples: HIGH - Verified against project types and tsconfig

**Research date:** 2026-01-28
**Valid until:** 2026-03-28 (60 days - stable TypeScript patterns)
