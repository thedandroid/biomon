# Architecture

**Analysis Date:** 2026-01-27

## Pattern Overview

**Overall:** Event-driven real-time system with dual-channel real-time sync

**Key Characteristics:**
- Socket.io-based bidirectional event streaming between server and clients
- Server maintains single canonical in-memory state object with file-based persistence
- Clients subscribe to state broadcasts and emit mutations as event payloads
- Separate read-only external namespace for third-party integrations
- Game mechanics (stress/panic tables) decoupled from event handlers

## Layers

**Server Core (`/Users/daniel/Projects/biomon/server.js`):**
- Purpose: Central event hub, state container, persistence coordinator
- Location: `server.js` (887 lines)
- Contains: Socket.io event handlers, state mutations, file I/O, session management
- Depends on: Express, Socket.io, `createServer.js`, `responseTables.js`, `utils.js`, Node fs/path
- Used by: All clients and external integrations

**Client Presentation (`/Users/daniel/Projects/biomon/public/`):**
- Purpose: Render state changes in real-time, emit user actions
- Location: `public/player.js`, `public/gm.js`, `public/*.html`
- Contains: DOM rendering, event listeners, local animation state, Socket.io client
- Depends on: Server state broadcasts, Canvas API (for ECG animation)
- Used by: End users (GM and players)

**Mechanics Abstraction (`/Users/daniel/Projects/biomon/responseTables.js`):**
- Purpose: Encapsulate Alien RPG stress/panic resolution logic
- Location: `responseTables.js` (278 lines)
- Contains: STRESS_TABLE, PANIC_TABLE, resolveEntry(), getEntryById()
- Depends on: Pure data, no external dependencies
- Used by: Server event handlers, tests

**Utilities (`/Users/daniel/Projects/biomon/utils.js`):**
- Purpose: Provide reusable math and validation helpers
- Location: `utils.js` (97 lines)
- Contains: clamp(), clampInt(), newId(), ensurePlayerFields(), hasLiveEffect(), d6()
- Depends on: Pure functions, Math, Date
- Used by: Server, tests

**Server Factory (`/Users/daniel/Projects/biomon/createServer.js`):**
- Purpose: Decouple server creation logic for testability
- Location: `createServer.js` (36 lines)
- Contains: Express + Socket.io server setup with CORS configuration
- Depends on: Express, Socket.io, http module
- Used by: `server.js`, integration tests

## Data Flow

**Initialization Flow:**

1. Server loads `server.js` → calls `createServer()` → sets up Express + Socket.io
2. Loads autosave from `sessions/autosave.json` into memory or initializes empty state
3. Starts listening on PORT (default 3050)
4. Clients connect via Socket.io → receive initial state broadcast
5. External clients connect to `/external` namespace → receive read-only state broadcasts

**GM Mutation Flow:**

1. GM user action (e.g., add player, modify stress) → emits Socket.io event (e.g., `player:add`)
2. Server event handler receives payload, validates input, mutates in-memory `state`
3. Handler calls `broadcast()` → emits new state to all connected clients
4. `broadcast()` triggers `scheduleSave()` → debounced write to `autosave.json`
5. All clients receive new state → render updated UI

**Roll Trigger Flow:**

1. Player/GM clicks "Roll Stress/Panic" → emits `roll:trigger` event with player ID and modifiers
2. Server calculates: d6 + stress - resolve + modifiers = total
3. Looks up table entry in `responseTables.js` using `resolveEntry(rollType, total)`
4. Checks for duplicate panic effects using `hasLiveEffect()`
5. Creates rollEvent object, stores in `state.rollEvents` and `player.lastRollEvent`
6. Logs to mission log via `addLogEntry()`
7. Broadcasts updated state

**Roll Apply Flow:**

1. GM reviews roll, clicks "Apply" with optional custom effect choice
2. Client emits `roll:apply` with chosen table entry ID
3. Server retrieves persistent effect metadata from `responseTables.js`
4. Creates effect object, adds to `player.activeEffects`, marks roll as applied
5. Handles duplicate stress special case: +1 stress instead of applying duplicate
6. Broadcasts state

**Session Persistence:**

1. Campaign saved with `session:save` → writes `sessions/campaign-{name}.json`
2. Campaign loaded with `session:load` → reads JSON, restores all state
3. Autosave happens every mutation (debounced 1000ms) → `sessions/autosave.json`
4. Server lists campaigns via directory scan in `session:list`

**External Integration (Read-Only):**

1. External client connects to `/external` namespace
2. Receives state broadcasts on every mutation
3. Cannot emit any events (no handlers registered)
4. Intended for monitoring dashboards, logging systems, external HUDs

**State Management:**

The canonical state object structure:

```javascript
state = {
  players: [
    {
      id,                    // newId() generated
      name,
      health,
      maxHealth,
      stress,                // 0-10
      resolve,               // 0-10
      activeEffects: [       // persistent effects in play
        { id, type, label, severity, createdAt, durationType, clearedAt }
      ],
      lastRollEvent: {       // most recent roll for this player
        eventId,
        total,
        die,
        stress,
        resolve,
        modifiers,
        tableEntryId,
        applied,             // whether effect was applied
        appliedEffectId,
        stressDeltaApplied,
        stressDeltaAppliedValue,
        // ... other metadata
      }
    }
  ],
  rollEvents: [],            // Array capped at ROLL_FEED_CAP (200)
  missionLog: [],            // Array capped at MAX_LOG_ENTRIES (100)
  metadata: {
    campaignName,
    createdAt,
    lastSaved,
    sessionCount
  }
}
```

## Key Abstractions

**Response Tables:**
- Purpose: Map roll totals to game effects
- Examples: `responseTables.js` exports STRESS_TABLE and PANIC_TABLE
- Pattern: Array of entries with min/max range matching, lazy lookup via `pickEntryByTotal()`

**Effects System:**
- Purpose: Represent ongoing consequences (stress conditions, panic states)
- Stored in: `player.activeEffects` array
- Cleared by: Setting `clearedAt` timestamp (soft delete, not removed from array)
- Checked by: `hasLiveEffect()` utility for duplicate detection

**Roll Event History:**
- Purpose: Track every roll and its resolution for undo/audit
- Stored in: `state.rollEvents` (global) and `player.lastRollEvent` (per-player, most recent)
- Bounded by: ROLL_FEED_CAP (200 events max) to prevent memory bloat
- Used for: Undo operations, mission log entries, player history

**Mission Log:**
- Purpose: Human-readable narrative of session events
- Entries: { id, timestamp, type, message, details }
- Bounded by: MAX_LOG_ENTRIES (100) with newest-first ordering
- Types: "info", "stress", "panic", "health", "system"

## Entry Points

**HTTP Routes:**
- Location: `server.js` lines 49-54
- `GET /` → serves `public/player.html` (player crew view)
- `GET /gm` → serves `public/gm.html` (GM control panel)
- All other paths → static file serving from `public/` directory

**Socket.io Main Namespace:**
- Location: `server.js` lines 310-855
- Entry: `io.on("connection")` handles new client connections
- Initial event: Emits current state on connect
- All mutation events handled here (player:add, roll:trigger, etc.)

**Socket.io External Namespace:**
- Location: `server.js` lines 863-878
- Entry: `io.of("/external").on("connection")`
- No handlers registered (read-only by design)
- Receives all state broadcasts

**Startup:**
- Location: `server.js` lines 274-887
- Loads autosave or initializes fresh state
- Binds server to PORT, logs startup info

## Error Handling

**Strategy:** Defensive input validation, graceful fallbacks, console logging

**Patterns:**

1. **Payload Validation:** All event handlers validate payload fields with defaults
   - Example: `const name = String(payload?.name ?? "").trim().slice(0, 40) || "UNNAMED"`
   - Approach: Type coercion, trimming, length capping, fallback values

2. **Numeric Clamping:** All numeric inputs clamped to valid ranges
   - Example: `clamp(payload.health, 0, maxHealth)`
   - Uses `clamp()` and `clampInt()` utilities to prevent out-of-range state

3. **File I/O:** Try-catch with error logging to console
   - Example: Load campaign errors return `{ success: false, error: msg }`
   - Autosave failures logged but don't break state mutations

4. **Missing Players:** Event handlers check if player exists before mutating
   - Example: `const p = state.players.find(x => x.id === id); if (!p) return;`
   - Silent return on missing player (no error event)

5. **Persistence Fallback:** Autosave on every mutation ensures no data loss between saves
   - Debounced to prevent filesystem thrashing
   - Failures logged but application continues

## Cross-Cutting Concerns

**Logging:**
- Console-based: `console.log()` for events, `console.error()` for failures
- Categories: [ROLL:STRESS], [ROLL:PANIC], [AUTOSAVE], [CAMPAIGN], [SESSION], [EFFECT:CLEAR], [CONDITION:*]
- Timestamp patterns: Logged with Date.now() in events, ISO strings in metadata

**Validation:**
- Input: Payload field validation in every event handler
- State: `ensurePlayerFields()` backfills missing player attributes on broadcast
- Game Rules: Duplicate effect detection, bounds checking on stress/resolve/health

**Authentication:**
- Not implemented. Design assumes trusted network (same machine or secure intranet)
- CORS origin configurable via `BIOMON_CORS_ORIGIN` env var
- External namespace provides no mutation capability (architecture-level security)

**Broadcasting:**
- Every mutation followed by `broadcast()` call
- `broadcast()` emits to main namespace AND `/external` namespace
- Backfills player fields before broadcasting to ensure consistency

---

*Architecture analysis: 2026-01-27*
