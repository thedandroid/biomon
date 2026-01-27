# Phase 2: Type Definitions - Research

**Researched:** 2026-01-27
**Domain:** TypeScript type definitions for Socket.io events and application state
**Confidence:** HIGH

## Summary

Phase 2 establishes the type foundation that all subsequent phases depend on. The BIOMON codebase has well-defined implicit shapes: a `GameState` object containing players, roll events, mission log, and metadata; players with health/stress/resolve stats and active effects; and 17+ Socket.io events with varying payload shapes.

The recommended approach uses centralized type definitions in `src/types/` organized by domain (state, events, tables), with Socket.io generics for type-safe event handling. Discriminated unions should be used for roll types (stress vs panic) since they have different table entries and duplicate-handling rules. Branded types for IDs (PlayerId, EffectId, EventId) are optional but recommended for preventing accidental ID misuse.

**Primary recommendation:** Create pure type files (no runtime code) in `src/types/` with barrel exports, defining all interfaces before any source file conversion begins.

## Domain Analysis

### State Shapes Extracted from server.js

#### GameState (root state object)
```typescript
interface GameState {
  players: Player[];
  rollEvents: RollEvent[];
  missionLog: LogEntry[];
  metadata: SessionMetadata;
}
```

#### Player
```typescript
interface Player {
  id: string;                    // Generated via newId()
  name: string;                  // Max 40 chars, default "UNNAMED"
  health: number;                // 0 to maxHealth
  maxHealth: number;             // 1 to MAX_HEALTH_CAP (10)
  stress: number;                // 0 to MAX_STRESS (10)
  resolve: number;               // 0 to MAX_RESOLVE (10)
  activeEffects: Effect[];       // Persistent conditions
  lastRollEvent: LastRollEvent | null;  // Most recent roll result
}
```

#### Effect (persistent condition on player)
```typescript
interface Effect {
  id: string;                    // Generated via newId()
  type: string;                  // e.g., "stress_jumpy", "panic_freeze", "condition_fatigue"
  label: string;                 // Human-readable name
  severity: number;              // 1-5 scale
  createdAt: number;             // Date.now() timestamp
  durationType: string;          // "manual" (only type currently used)
  durationValue?: unknown;       // Reserved for future duration types
  clearedAt: number | null;      // Timestamp when cleared, or null if active
}
```

#### LastRollEvent (attached to player, tracks most recent roll)
```typescript
interface LastRollEvent {
  type: "stress" | "panic";
  eventId: string;
  total: number;
  die: number;                   // 1-6
  stress: number;
  resolve: number;
  modifiers: number;
  tableEntryId: string;
  tableEntryLabel: string;
  tableEntryDescription: string;
  tableEntryStressDelta: number;
  tableEntryPersistent: boolean;
  duplicateAdjusted: boolean;
  duplicateFromId: string | null;
  duplicateFromLabel: string | null;
  duplicateNote: string | null;
  applyOptions: ApplyOption[] | null;
  appliedTableEntryId: string | null;
  appliedTableEntryLabel: string | null;
  appliedTableEntryDescription: string | null;
  appliedTableEntryStressDelta: number | null;
  timestamp: number;
  applied: boolean;
  appliedEffectId: string | null;
  appliedStressDuplicate: boolean;
  stressDeltaApplied: boolean;
  stressDeltaAppliedValue: number | null;
}
```

#### RollEvent (stored in rollEvents array, broadcast history)
```typescript
interface RollEvent {
  eventId: string;
  playerId: string;
  rollType: "stress" | "panic";
  die: number;
  stress: number;
  resolve: number;
  modifiers: number;
  total: number;
  tableEntryId: string;
  label: string;
  description: string;
  stressDelta: number;
  duplicateAdjusted: boolean;
  duplicateFromId: string | null;
  duplicateFromLabel: string | null;
  timestamp: number;
}
```

#### LogEntry (mission log)
```typescript
interface LogEntry {
  id: string;
  timestamp: number;
  type: "info" | "stress" | "panic" | "health" | "system";
  message: string;
  details: string | null;
}
```

#### SessionMetadata
```typescript
interface SessionMetadata {
  campaignName: string | null;
  createdAt: string | null;      // ISO date string
  lastSaved: string | null;      // ISO date string
  sessionCount: number;
}
```

### Socket.io Events Extracted from server.js

#### Client-to-Server Events (17 events)

| Event | Payload Shape | Notes |
|-------|---------------|-------|
| `player:add` | `{ name?: string, maxHealth?: number, health?: number, stress?: number, resolve?: number }` | All optional with defaults |
| `player:remove` | `{ id: string }` | |
| `player:update` | `{ id: string, name?: string, maxHealth?: number, health?: number, stress?: number, resolve?: number }` | Partial update |
| `party:clear` | `void` (no payload) | |
| `roll:trigger` | `{ playerId: string, rollType?: "stress" \| "panic", modifiers?: number }` | |
| `roll:apply` | `{ playerId: string, eventId: string, tableEntryId?: string }` | tableEntryId for choice |
| `roll:applyStressDelta` | `{ playerId: string, eventId: string }` | |
| `roll:undo` | `{ playerId: string, eventId: string }` | |
| `roll:clear` | `{ playerId: string }` | |
| `effect:clear` | `{ playerId: string, effectId: string }` | |
| `condition:toggle` | `{ playerId: string, condition: string }` | condition = "fatigue" |
| `session:save` | `{ campaignName?: string }` | |
| `session:load` | `{ filename: string }` | |
| `session:list` | `void` (no payload) | |
| `session:clear` | `void` (no payload) | |
| `session:export` | `void` (no payload) | |
| `session:import` | `GameState` (full state object) | |

#### Server-to-Client Events (6 events)

| Event | Payload Shape | Notes |
|-------|---------------|-------|
| `state` | `GameState` | Full state broadcast |
| `session:save:result` | `{ success: boolean, filename?: string, error?: string }` | |
| `session:load:result` | `{ success: boolean, error?: string }` | |
| `session:list:result` | `CampaignInfo[]` | Array of campaign summaries |
| `session:export:result` | `GameState` | |
| `session:import:result` | `{ success: boolean, error?: string }` | |
| `session:autosave:info` | `AutosaveInfo` | Sent on connection |

#### External Namespace (/external)

Read-only namespace that only receives:
- `state` broadcasts (same as main namespace)

No client-to-server events accepted.

### Response Table Types (from responseTables.js)

#### TableEntry
```typescript
interface TableEntry {
  min: number;                   // Range minimum (inclusive)
  max: number;                   // Range maximum (inclusive)
  id: string;                    // Unique identifier, e.g., "stress_jumpy"
  label: string;                 // Display name
  description: string;           // Full text description
  severity: number;              // 1-5 scale
  persistent: boolean;           // Creates lasting effect
  durationType?: string;         // "manual" only currently
  durationValue?: unknown;       // Reserved
  stressDelta?: number;          // Stress change when applied
  applyOptions?: ApplyOption[];  // GM choice alternatives
}

interface ApplyOption {
  id: string;                    // TableEntry id to apply
  label: string;                 // Display label for option
}
```

### Utility Function Signatures (from utils.js)

```typescript
// Constants
const DEFAULT_MAX_HEALTH: number = 5;
const MAX_HEALTH_CAP: number = 10;
const MAX_STRESS: number = 10;
const MAX_RESOLVE: number = 10;
const ROLL_FEED_CAP: number = 200;

// Functions
function clamp(n: number, lo: number, hi: number): number;
function clampInt(n: number, lo: number, hi: number): number;
function newId(): string;
function ensurePlayerFields(p: Player): void;  // Mutates in place
function hasLiveEffect(p: Player, effectType: string): boolean;
function d6(): number;  // Returns 1-6
```

## Type Organization Strategy

### Recommended File Structure

```
src/
  types/
    index.ts           # Barrel export for all types
    state.ts           # GameState, Player, Effect, LogEntry, SessionMetadata
    events.ts          # ClientToServerEvents, ServerToClientEvents, payloads
    tables.ts          # TableEntry, ApplyOption, RollType
    rolls.ts           # RollEvent, LastRollEvent (or merge into state.ts)
```

### Alternative: Single File Approach

For a codebase this size (~1300 LOC), all types could reasonably fit in a single `types.ts` file (~150-200 lines). However, the multi-file approach is recommended because:

1. **Separation of concerns**: Event types vs state types vs table types
2. **Parallel development**: Different tasks can work on different type files
3. **Future extensibility**: Easier to add handler-specific types later
4. **Clear dependencies**: state.ts has no imports; events.ts imports from state.ts

### Barrel Export Pattern

```typescript
// src/types/index.ts
export * from './state.js';
export * from './events.js';
export * from './tables.js';
```

Note: Use `.js` extensions in imports when using `moduleResolution: "Bundler"` with esbuild (or omit extensions entirely if configured).

## Implementation Patterns

### Socket.io Generic Types

Based on official Socket.io TypeScript documentation:

```typescript
// src/types/events.ts
import type { Server, Socket } from 'socket.io';
import type { GameState, Player } from './state.js';

// Events client sends to server
interface ClientToServerEvents {
  'player:add': (payload: PlayerAddPayload) => void;
  'player:remove': (payload: { id: string }) => void;
  'player:update': (payload: PlayerUpdatePayload) => void;
  'party:clear': () => void;
  'roll:trigger': (payload: RollTriggerPayload) => void;
  'roll:apply': (payload: RollApplyPayload) => void;
  'roll:applyStressDelta': (payload: RollEventRef) => void;
  'roll:undo': (payload: RollEventRef) => void;
  'roll:clear': (payload: { playerId: string }) => void;
  'effect:clear': (payload: EffectClearPayload) => void;
  'condition:toggle': (payload: ConditionTogglePayload) => void;
  'session:save': (payload: SessionSavePayload) => void;
  'session:load': (payload: { filename: string }) => void;
  'session:list': () => void;
  'session:clear': () => void;
  'session:export': () => void;
  'session:import': (payload: GameState) => void;
}

// Events server sends to client
interface ServerToClientEvents {
  'state': (state: GameState) => void;
  'session:save:result': (result: SaveResult) => void;
  'session:load:result': (result: LoadResult) => void;
  'session:list:result': (campaigns: CampaignInfo[]) => void;
  'session:export:result': (state: GameState) => void;
  'session:import:result': (result: ImportResult) => void;
  'session:autosave:info': (info: AutosaveInfo) => void;
}

// Typed server and socket
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
```

### Discriminated Unions for Roll Types

The codebase has two roll types with different tables and rules:

```typescript
// src/types/tables.ts
type RollType = 'stress' | 'panic';

// Base table entry (common fields)
interface BaseTableEntry {
  min: number;
  max: number;
  id: string;
  label: string;
  description: string;
  severity: number;
  persistent: boolean;
  durationType?: 'manual';
  durationValue?: unknown;
  stressDelta?: number;
}

// Stress-specific entries
interface StressTableEntry extends BaseTableEntry {
  // No applyOptions in stress table
}

// Panic-specific entries (some have applyOptions)
interface PanicTableEntry extends BaseTableEntry {
  applyOptions?: ApplyOption[];
}

// Union type for table entries
type TableEntry = StressTableEntry | PanicTableEntry;
```

However, in practice the current codebase treats all entries uniformly with optional `applyOptions`. A simpler approach:

```typescript
interface TableEntry {
  min: number;
  max: number;
  id: string;
  label: string;
  description: string;
  severity: number;
  persistent: boolean;
  durationType?: 'manual';
  durationValue?: unknown;
  stressDelta?: number;
  applyOptions?: ApplyOption[];  // Only present on some panic entries
}
```

### Branded Types for IDs (Optional but Recommended)

```typescript
// src/types/state.ts

// Brand helper
type Brand<T, B> = T & { readonly __brand: B };

// Branded ID types
type PlayerId = Brand<string, 'PlayerId'>;
type EffectId = Brand<string, 'EffectId'>;
type EventId = Brand<string, 'EventId'>;
type TableEntryId = Brand<string, 'TableEntryId'>;

// Factory functions (runtime)
function createPlayerId(id: string): PlayerId {
  return id as PlayerId;
}
```

**Recommendation:** Start WITHOUT branded types for simplicity. Add them later if ID confusion becomes an actual problem. The codebase is small enough that plain strings are manageable.

### Payload Type Definitions

```typescript
// src/types/events.ts

// Player events
interface PlayerAddPayload {
  name?: string;
  maxHealth?: number;
  health?: number;
  stress?: number;
  resolve?: number;
}

interface PlayerUpdatePayload {
  id: string;
  name?: string;
  maxHealth?: number;
  health?: number;
  stress?: number;
  resolve?: number;
}

// Roll events
interface RollTriggerPayload {
  playerId: string;
  rollType?: 'stress' | 'panic';
  modifiers?: number;
}

interface RollApplyPayload {
  playerId: string;
  eventId: string;
  tableEntryId?: string;  // For GM choice when applyOptions exist
}

interface RollEventRef {
  playerId: string;
  eventId: string;
}

// Effect events
interface EffectClearPayload {
  playerId: string;
  effectId: string;
}

interface ConditionTogglePayload {
  playerId: string;
  condition: 'fatigue';  // Only valid value currently
}

// Session events
interface SessionSavePayload {
  campaignName?: string;
}

// Response types
interface SaveResult {
  success: boolean;
  filename?: string;
  error?: string;
}

interface LoadResult {
  success: boolean;
  error?: string;
}

interface ImportResult {
  success: boolean;
  error?: string;
}

interface CampaignInfo {
  filename: string;
  campaignName: string;
  lastSaved: string;
  playerCount: number;
  sessionCount: number;
}

interface AutosaveInfo {
  found: boolean;
  timestamp?: string;
  playerCount?: number;
  campaignName?: string;
}
```

## Gotchas and Edge Cases

### 1. Optional Fields vs Null vs Undefined

The codebase uses a mix of patterns:

| Field | Pattern | Recommendation |
|-------|---------|----------------|
| `lastRollEvent` | `null` when absent | Use `T \| null` |
| `clearedAt` | `null` when not cleared | Use `number \| null` |
| `campaignName` | `null` when unnamed | Use `string \| null` |
| `durationValue` | `undefined` when unused | Use optional `?:` |
| Payload fields | `undefined` when omitted | Use optional `?:` |

**Rule of thumb:**
- Use `| null` for "explicitly set to nothing" (the field is present but empty)
- Use `?:` (optional) for "might not be provided" (payload fields)

### 2. Runtime Validation Must Remain

The existing code has 52+ sites of optional chaining (`payload?.field`). These MUST remain even after adding types because:

- Socket.io payloads are untrusted network input
- Types are compile-time only; they don't validate runtime data
- Malicious or buggy clients can send malformed payloads

**Keep patterns like:**
```typescript
const id = String(payload?.id ?? "");
const name = String(payload?.name ?? "").trim().slice(0, 40) || "UNNAMED";
```

### 3. Type-Only Imports

Use `import type` for types that don't exist at runtime:

```typescript
// Correct - stripped during compilation
import type { Player, GameState } from './types/index.js';

// Also works but includes in bundle
import { Player, GameState } from './types/index.js';
```

For pure type files, all imports should be `import type`.

### 4. Const Assertions for Tables

Response tables should use `as const` for literal type inference:

```typescript
// responseTables.ts
export const STRESS_TABLE = [
  {
    min: -999,
    max: 0,
    id: "stress_keeping_cool",
    // ...
  },
  // ...
] as const satisfies readonly TableEntry[];

// Type becomes readonly and literal
type StressTableIds = typeof STRESS_TABLE[number]['id'];
// = "stress_keeping_cool" | "stress_jumpy" | ...
```

### 5. External Namespace Types

The `/external` namespace has different (more restricted) event maps:

```typescript
// External namespace - read-only
interface ExternalClientToServerEvents {
  // Empty - no events accepted
}

interface ExternalServerToClientEvents {
  'state': (state: GameState) => void;
}
```

### 6. The `ensurePlayerFields` Mutation Pattern

This function mutates objects in place, which TypeScript can track:

```typescript
// Current signature
function ensurePlayerFields(p: Player): void;

// More accurate signature showing mutation
function ensurePlayerFields(p: Partial<Player> & { id: string }): asserts p is Player;
```

However, the `asserts` pattern adds complexity. Simpler to keep `void` return and document the mutation.

## Recommended File Structure

```
src/
  types/
    index.ts           # Barrel export
    state.ts           # Core state interfaces
    events.ts          # Socket.io event maps and payloads
    tables.ts          # Response table types
```

### File Contents Breakdown

**state.ts (~80 lines)**
- `GameState`
- `Player`
- `Effect`
- `LastRollEvent`
- `RollEvent`
- `LogEntry`
- `SessionMetadata`
- Constants as types: `type LogEntryType = "info" | "stress" | "panic" | "health" | "system"`

**events.ts (~100 lines)**
- `ClientToServerEvents`
- `ServerToClientEvents`
- `ExternalClientToServerEvents`
- `ExternalServerToClientEvents`
- All payload interfaces
- All result interfaces
- `TypedServer`, `TypedSocket` type aliases

**tables.ts (~30 lines)**
- `RollType`
- `TableEntry`
- `ApplyOption`

**index.ts (~10 lines)**
- Barrel exports from all files

## Code Examples

### Complete Socket.io Event Map

```typescript
// src/types/events.ts
import type { Server, Socket, Namespace } from 'socket.io';
import type { GameState } from './state.js';

// ============================================================
// PAYLOAD TYPES
// ============================================================

export interface PlayerAddPayload {
  name?: string;
  maxHealth?: number;
  health?: number;
  stress?: number;
  resolve?: number;
}

export interface PlayerUpdatePayload {
  id: string;
  name?: string;
  maxHealth?: number;
  health?: number;
  stress?: number;
  resolve?: number;
}

export interface RollTriggerPayload {
  playerId: string;
  rollType?: 'stress' | 'panic';
  modifiers?: number;
}

export interface RollApplyPayload {
  playerId: string;
  eventId: string;
  tableEntryId?: string;
}

export interface RollEventRef {
  playerId: string;
  eventId: string;
}

export interface EffectClearPayload {
  playerId: string;
  effectId: string;
}

export interface ConditionTogglePayload {
  playerId: string;
  condition: 'fatigue';
}

export interface SessionSavePayload {
  campaignName?: string;
}

export interface SessionLoadPayload {
  filename: string;
}

// ============================================================
// RESPONSE TYPES
// ============================================================

export interface SaveResult {
  success: boolean;
  filename?: string;
  error?: string;
}

export interface LoadResult {
  success: boolean;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  error?: string;
}

export interface CampaignInfo {
  filename: string;
  campaignName: string;
  lastSaved: string;
  playerCount: number;
  sessionCount: number;
}

export interface AutosaveInfo {
  found: boolean;
  timestamp?: string;
  playerCount?: number;
  campaignName?: string;
}

// ============================================================
// SOCKET.IO EVENT MAPS
// ============================================================

export interface ClientToServerEvents {
  'player:add': (payload: PlayerAddPayload) => void;
  'player:remove': (payload: { id: string }) => void;
  'player:update': (payload: PlayerUpdatePayload) => void;
  'party:clear': () => void;
  'roll:trigger': (payload: RollTriggerPayload) => void;
  'roll:apply': (payload: RollApplyPayload) => void;
  'roll:applyStressDelta': (payload: RollEventRef) => void;
  'roll:undo': (payload: RollEventRef) => void;
  'roll:clear': (payload: { playerId: string }) => void;
  'effect:clear': (payload: EffectClearPayload) => void;
  'condition:toggle': (payload: ConditionTogglePayload) => void;
  'session:save': (payload: SessionSavePayload) => void;
  'session:load': (payload: SessionLoadPayload) => void;
  'session:list': () => void;
  'session:clear': () => void;
  'session:export': () => void;
  'session:import': (payload: GameState) => void;
}

export interface ServerToClientEvents {
  'state': (state: GameState) => void;
  'session:save:result': (result: SaveResult) => void;
  'session:load:result': (result: LoadResult) => void;
  'session:list:result': (campaigns: CampaignInfo[]) => void;
  'session:export:result': (state: GameState) => void;
  'session:import:result': (result: ImportResult) => void;
  'session:autosave:info': (info: AutosaveInfo) => void;
}

// External namespace (read-only)
export interface ExternalClientToServerEvents {
  // Intentionally empty - read-only namespace
}

export interface ExternalServerToClientEvents {
  'state': (state: GameState) => void;
}

// ============================================================
// TYPED SERVER/SOCKET ALIASES
// ============================================================

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
export type TypedExternalNamespace = Namespace<
  ExternalClientToServerEvents,
  ExternalServerToClientEvents
>;
```

### Complete State Types

```typescript
// src/types/state.ts

// ============================================================
// CORE TYPES
// ============================================================

export type RollType = 'stress' | 'panic';
export type LogEntryType = 'info' | 'stress' | 'panic' | 'health' | 'system';
export type DurationType = 'manual';

// ============================================================
// EFFECT (persistent condition)
// ============================================================

export interface Effect {
  id: string;
  type: string;
  label: string;
  severity: number;
  createdAt: number;
  durationType: DurationType;
  durationValue?: unknown;
  clearedAt: number | null;
}

// ============================================================
// APPLY OPTION (for GM choice)
// ============================================================

export interface ApplyOption {
  tableEntryId: string;
  label: string;
}

// ============================================================
// LAST ROLL EVENT (attached to player)
// ============================================================

export interface LastRollEvent {
  type: RollType;
  eventId: string;
  total: number;
  die: number;
  stress: number;
  resolve: number;
  modifiers: number;
  tableEntryId: string;
  tableEntryLabel: string;
  tableEntryDescription: string;
  tableEntryStressDelta: number;
  tableEntryPersistent: boolean;
  duplicateAdjusted: boolean;
  duplicateFromId: string | null;
  duplicateFromLabel: string | null;
  duplicateNote: string | null;
  applyOptions: ApplyOption[] | null;
  appliedTableEntryId: string | null;
  appliedTableEntryLabel: string | null;
  appliedTableEntryDescription: string | null;
  appliedTableEntryStressDelta: number | null;
  timestamp: number;
  applied: boolean;
  appliedEffectId: string | null;
  appliedStressDuplicate: boolean;
  stressDeltaApplied: boolean;
  stressDeltaAppliedValue: number | null;
}

// ============================================================
// PLAYER
// ============================================================

export interface Player {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  stress: number;
  resolve: number;
  activeEffects: Effect[];
  lastRollEvent: LastRollEvent | null;
}

// ============================================================
// ROLL EVENT (broadcast history)
// ============================================================

export interface RollEvent {
  eventId: string;
  playerId: string;
  rollType: RollType;
  die: number;
  stress: number;
  resolve: number;
  modifiers: number;
  total: number;
  tableEntryId: string;
  label: string;
  description: string;
  stressDelta: number;
  duplicateAdjusted: boolean;
  duplicateFromId: string | null;
  duplicateFromLabel: string | null;
  timestamp: number;
}

// ============================================================
// LOG ENTRY
// ============================================================

export interface LogEntry {
  id: string;
  timestamp: number;
  type: LogEntryType;
  message: string;
  details: string | null;
}

// ============================================================
// SESSION METADATA
// ============================================================

export interface SessionMetadata {
  campaignName: string | null;
  createdAt: string | null;
  lastSaved: string | null;
  sessionCount: number;
}

// ============================================================
// GAME STATE (root)
// ============================================================

export interface GameState {
  players: Player[];
  rollEvents: RollEvent[];
  missionLog: LogEntry[];
  metadata: SessionMetadata;
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Socket.io event typing | Manual type annotations on each handler | `Server<C, S>` generics | Official pattern, IDE autocomplete |
| ID string validation | Custom branded type system | Plain strings (for now) | Codebase too small to benefit |
| Runtime validation | Zod/io-ts schemas | Existing optional chaining | Already works, adds no dependencies |
| Type exports | Named exports from each file | Barrel `index.ts` | Standard pattern, single import point |

## Common Pitfalls

### Pitfall 1: Removing Runtime Validation
**What goes wrong:** Types compile, but malformed payloads crash at runtime
**Why it happens:** False confidence that "types guarantee shape"
**How to avoid:** Keep ALL existing `payload?.field` patterns; add types alongside, not instead of
**Warning signs:** Removing `String()`, `Number()`, optional chaining during migration

### Pitfall 2: Circular Type Dependencies
**What goes wrong:** Import loops between type files
**Why it happens:** events.ts imports state.ts, state.ts imports events.ts
**How to avoid:** Keep state.ts as leaf (no imports); events.ts imports state.ts
**Warning signs:** TypeScript "cannot find module" errors during compilation

### Pitfall 3: Runtime Code in Type Files
**What goes wrong:** Type files have side effects or bundle into output
**Why it happens:** Adding helper functions or constants to type files
**How to avoid:** Type files contain ONLY: `type`, `interface`, `export type`
**Warning signs:** Import statements without `type` keyword

### Pitfall 4: Over-Specific Literal Types
**What goes wrong:** Types too narrow for valid data
**Why it happens:** Using `as const` on dynamic data
**How to avoid:** Use union types (`'stress' | 'panic'`) not literal inference
**Warning signs:** Type errors on valid server responses

### Pitfall 5: Missing null/undefined Handling
**What goes wrong:** Type says `string`, runtime has `null`
**Why it happens:** Not auditing actual runtime values
**How to avoid:** Check server.js for every `null` assignment; mirror in types
**Warning signs:** Runtime "cannot read property of null" after migration

## Sources

### Primary (HIGH confidence)
- Socket.io TypeScript documentation: https://socket.io/docs/v4/typescript/
- TypeScript Handbook - Narrowing: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- Codebase analysis: server.js (887 LOC), utils.js (98 LOC), responseTables.js (~280 LOC)

### Secondary (MEDIUM confidence)
- [TypeScript Discriminated Unions](https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html)
- [Branded Types in TypeScript](https://egghead.io/blog/using-branded-types-in-typescript)
- [Where To Put Your Types](https://www.totaltypescript.com/where-to-put-your-types-in-application-code)

### Tertiary (LOW confidence - patterns, not verified for this project)
- [Branded Types Deep Dive](https://basarat.gitbook.io/typescript/main-1/nominaltyping)
- [Type Organization Patterns](https://www.becomebetterprogrammer.com/typescript-organizing-and-storing-types-and-interfaces/)

## Metadata

**Confidence breakdown:**
- State shapes: HIGH - Extracted directly from server.js code
- Event maps: HIGH - Extracted directly from socket.on handlers
- Socket.io patterns: HIGH - Official documentation verified
- File organization: MEDIUM - Best practices vary by team preference
- Branded types: MEDIUM - Recommended to defer, pattern well-known

**Research date:** 2026-01-27
**Valid until:** 60 days (types are stable, patterns don't change quickly)

---

*Phase: 02-type-definitions*
*Research completed: 2026-01-27*
