# Codebase Concerns

**Analysis Date:** 2026-01-27

## Tech Debt

**Monolithic Server State Management:**
- Issue: The entire application state is held in a single in-memory object in `/Users/daniel/Projects/biomon/server.js` (lines 74-86). No database abstraction layer exists, making it difficult to transition to persistent storage or scale beyond a single process.
- Files: `server.js`
- Impact: Cannot easily run multiple server instances, no support for distributed game sessions, autosave can be lost on crash
- Fix approach: Extract state management into a dedicated module with a persistence interface; consider adding database support (Redis/PostgreSQL) for production use

**Duplicated Event Handler Logic:**
- Issue: Socket.io event handler implementations in `server.js` are nearly identical to integration test setup in `test/server.integration.test.js` (server.js lines 314-851 vs test/server.integration.test.js lines 70-400+). Logic duplication makes maintenance harder.
- Files: `server.js`, `test/server.integration.test.js`
- Impact: Bug fixes or feature changes need to be replicated in two places; test suite doesn't verify production code paths
- Fix approach: Extract event handlers into a shared module that both server and tests can import and use

**Payload Validation Gap:**
- Issue: 52+ instances of optional chaining (`payload?.field`) in `server.js` without formal schema validation. Input validation relies on individual `?.` checks scattered throughout event handlers (lines 314-851).
- Files: `server.js`
- Impact: Malformed payloads silently fail or behave unpredictably; no clear contract for API changes; difficult to document expected input shapes
- Fix approach: Implement schema validation (e.g., Zod) or create formal event payload interfaces; validate at entry point of each socket event

**Implicit Type Coercion:**
- Issue: Heavy reliance on type coercion (String conversion, Number clamping) instead of explicit type guards. Examples: line 315 `String(payload?.name ?? "")`, line 398 `rollType === "panic" ? "panic" : "stress"` with string comparison
- Files: `server.js`, `createServer.js`, `utils.js`
- Impact: Type-related bugs hard to trace; no compile-time safety without TypeScript; string ID comparisons prone to whitespace/case errors
- Fix approach: Migrate to TypeScript or add JSDoc type annotations; create enums for fixed values like `rollType`

## Known Bugs

**ID Collision Vulnerability:**
- Bug: The `newId()` function in `utils.js` (line 41-43) uses `Date.now()` + random hex, but only 16 bits of entropy from `Math.random()`. Two IDs generated in quick succession could theoretically collide.
- Symptoms: If many players are added/removed rapidly or IDs are generated in parallel, duplicate IDs could cause state conflicts
- Files: `utils.js` (lines 41-43), used throughout `server.js`
- Trigger: Run 100+ rapid `player:add` calls in quick succession; inspect `state.players` for duplicate `id` values
- Workaround: IDs are unlikely to collide in practice due to millisecond granularity, but not cryptographically guaranteed

**Unhandled Edge Case in Campaign Loading:**
- Bug: `listCampaigns()` in `server.js` (lines 227-257) silently catches file read errors with `catch (_err) { return null }` (line 245), skipping malformed campaign files. A truncated or corrupted JSON file will disappear from the list without warning.
- Symptoms: Campaign file is lost from the list; no error indication in GM UI
- Files: `server.js` (lines 227-257)
- Trigger: Create `sessions/campaign-test.json`, truncate file mid-JSON, run `session:list`
- Workaround: Manually inspect `sessions/` directory for orphaned files

**Session Import Lacks Validation:**
- Bug: `session:import` event (server.js lines 827-851) accepts any object and assigns it to state without validating structure. A malformed import (missing `players` array, corrupted metadata) will corrupt the session state.
- Symptoms: Session becomes unusable after bad import; players may have missing fields; undefined behavior in roll calculations
- Files: `server.js` (lines 827-851)
- Trigger: Call `session:import` with `{ players: "not an array" }` or `{ metadata: null }`
- Workaround: None; server restart required to reload autosave

## Security Considerations

**CORS Configuration Allows Client-Side Injection:**
- Risk: CORS origin is parsed from `BIOMON_CORS_ORIGIN` env var (server.js line 37) and passed to Socket.io without strict validation. If misconfigured with a wildcard or malicious origin, external tools can modify game state.
- Files: `server.js` (line 37), `createServer.js` (lines 19-25)
- Current mitigation: CORS origin defaults to `http://localhost:3051` (single-origin); comma-separated format is split and trimmed
- Recommendations:
  - Validate each origin is a valid URL before passing to Socket.io
  - Reject wildcard origins (`*`, `http://*`)
  - Document that `/external` namespace is read-only and intentionally blocks mutations
  - Add logging for CORS rejection attempts

**File Path Traversal Risk in Campaign Loading:**
- Risk: `loadCampaign()` accepts a `filename` parameter (server.js line 196) and constructs path with `path.join(SESSIONS_DIR, filename)`. If client sends `../../../etc/passwd`, Node's `path.join()` safely normalizes it, but no explicit validation prevents access outside `SESSIONS_DIR`.
- Files: `server.js` (lines 196-224)
- Current mitigation: Node.js `path.join()` already prevents traversal attacks
- Recommendations:
  - Add explicit validation: `if (filename.includes('..') || filename.startsWith('/')) reject`
  - Whitelist allowed campaign filenames (e.g., only `campaign-*.json`)

**HTML Escaping is Implemented Client-Side Only:**
- Risk: Escaping logic exists in `public/gm.js` (lines 476-491) and `public/player.js` (line 742), but display logic is in JS. If JavaScript is disabled or attacker intercepts WebSocket, raw HTML injection is possible on server broadcasts.
- Files: `public/gm.js`, `public/player.js`
- Current mitigation: All user-generated fields (player names) are escaped before DOM insertion
- Recommendations:
  - Add server-side HTML sanitization (remove dangerous tags) as defense-in-depth
  - Consider CSP headers to restrict inline script execution
  - Document that player names are limited to 40 characters (line 318, 358)

**Autosave Data Integrity:**
- Risk: Autosave writes occur asynchronously with debouncing (server.js line 62: 1000ms). If server crashes between state change and autosave, up to 1 second of gameplay is lost. No checksum verification on autosave files.
- Files: `server.js` (lines 88-101, 307)
- Current mitigation: Autosave is debounced to avoid I/O thrashing
- Recommendations:
  - Add write verification: read back autosave file after write, compare checksum
  - Consider write-ahead logging for critical state changes (new player, health update)
  - Add autosave error alerts to GM UI

## Performance Bottlenecks

**Inefficient Campaign List Operations:**
- Problem: `listCampaigns()` (server.js lines 227-257) reads **every** campaign file from disk on each `session:list` call. With N campaigns, this requires N file reads and N JSON parses.
- Files: `server.js` (lines 227-257)
- Cause: No in-memory cache of campaign metadata; full re-scan every time
- Improvement path:
  - Cache campaign list in memory, invalidate on save/load
  - Or use filesystem watch to update cache on file changes
  - Or move campaign metadata to a separate index file

**Roll Event Feed Unbounded History:**
- Problem: `rollEvents` array is capped at 200 entries (server.js line 8: `ROLL_FEED_CAP = 200`), but all entries are kept in memory and broadcast to every connected client on each state emission.
- Files: `server.js` (lines 276-281)
- Cause: No pagination or lazy-loading; entire feed is serialized and sent to browser
- Improvement path:
  - Implement server-side pagination (e.g., last 50 events only on connect, load more on demand)
  - Compress roll event data before broadcast
  - Archive old events to disk/database instead of keeping in memory

**Mission Log Unbounded Growth:**
- Problem: `missionLog` grows indefinitely until capped at `MAX_LOG_ENTRIES = 100` (line 154), but even 100 entries with full descriptions consume memory and bandwidth. With 10+ concurrent connections, each broadcast multiplies traffic.
- Files: `server.js` (lines 154-172)
- Cause: No archival strategy; logs kept in memory indefinitely
- Improvement path:
  - Archive logs to file at regular intervals
  - Implement lazy-load for GM UI (show only last 20, pagination)
  - Consider event sourcing for audit trail (append-only log to disk)

## Fragile Areas

**State Backfill Logic in Multiple Places:**
- Files: `server.js` (lines 122, 216, 299, 311, 844, 869)
- Why fragile: The `ensurePlayerFields()` call is scattered throughout the code (6+ places). Any new player field added to the schema must be updated in `utils.js` AND every call site verified. Missing a call site leaves players in inconsistent state.
- Safe modification: Create a "normalize" step in a single place (on state load), never assume data is normalized after socket events
- Test coverage: Only unit tests for `ensurePlayerFields()` exist; no integration test verifying fields are present after every mutation

**Duplicate Result Handling Logic:**
- Files: `server.js` (lines 283-295, 418-431, 554-572)
- Why fragile: Three different code paths handle "duplicate result" semantics (resolve next higher entry, duplicate panic adjustment, duplicate stress handling). Logic is similar but subtly different. Changes to duplicate rules are easy to miss.
- Safe modification: Extract duplicate checking into a shared function with clear contract
- Test coverage: `server.integration.test.js` has dedicated duplicate tests (lines 300+), but edge cases around simultaneous duplicate panic/stress rolls are untested

**Effect Lifecycle Management:**
- Files: `server.js` (lines 574-600, 661-675, 716-741, 759-782)
- Why fragile: Effects are created, cleared, toggled, and undone in different code paths. The `clearedAt` flag indicates cleared state, but logic for "live" effects must check both `clearedAt === null` and existence. No single place manages effect lifecycle.
- Safe modification: Create Effect/EffectManager class to encapsulate creation, clearing, querying
- Test coverage: Effects are tested in integration tests, but manual effect management (undo, clear) edge cases lack coverage

## Scaling Limits

**Single-Process Memory Limit:**
- Current capacity: ~500 players with full history before memory concerns (estimated ~1KB per player + effects)
- Limit: Node.js process runs out of memory; no horizontal scaling possible
- Scaling path:
  - Move state to Redis (in-memory cluster)
  - Implement session sharding (one process per campaign)
  - Add database persistence (PostgreSQL) for durability

**WebSocket Broadcast Latency:**
- Current capacity: ~100 concurrent connections before noticeable latency
- Limit: Each state broadcast (sent on every mutation) is serialized and sent to all connected clients; with 200+ entries in rollEvents + missionLog, payload is 10KB+
- Scaling path:
  - Implement selective broadcasts (only send changed fields)
  - Use binary serialization (MessagePack) instead of JSON
  - Split state into "GM" and "player" views, broadcast only relevant data
  - Add message queuing between state mutations and broadcast

**File System Autosave Contention:**
- Current capacity: Autosave works fine for 1 server, but if multiple instances write same file, data loss occurs
- Limit: No file locking; simultaneous writes corrupt autosave.json
- Scaling path:
  - Move autosave to database with optimistic locking
  - Or use file-based locks with retry logic

## Dependencies at Risk

**`pkg` Package Has Known Vulnerability:**
- Risk: `pkg` (v5.8.1) has CVE-2021-3129 (Local Privilege Escalation). Used to bundle server into executable for distribution.
- Impact: Bundled executable on Windows may be exploitable if file permissions are misconfigured
- Migration plan:
  - Evaluate alternatives: `pkg-fetch`, `esbuild`, `ncc`
  - Or update to newer `pkg` version if available
  - Or distribute as source + Node.js instead of standalone binary

**Express 5.2.1 (Pre-Release):**
- Risk: Express 5.x is pre-release (marked `^5.2.1`). Breaking changes may occur in patch releases; some middleware may not be compatible.
- Impact: Unexpected compatibility issues, missing security patches if locked to old 5.x
- Migration plan:
  - Pin to exact version or move to Express 4.x (stable)
  - Or regularly test against latest Express 5 patches

**Socket.io 4.8.3 - Missing Client Reconnection Timeout:**
- Risk: Socket.io doesn't have a built-in reconnection timeout. If client loses connection (network down) for extended period, server keeps the old socket in memory indefinitely (with new connections), leading to memory leak.
- Impact: Stale sockets accumulate over days/weeks, consuming memory
- Migration plan:
  - Implement server-side cleanup: disconnect sockets with no activity for 24+ hours
  - Or upgrade Socket.io to 5.x if available and stable
  - Add monitoring/alerts for socket count

## Missing Critical Features

**No Audit Trail:**
- Problem: No record of who made what changes and when. If a player's stress was incorrectly set, there's no way to review the change history or revert.
- Blocks: Dispute resolution, debugging gameplay issues, compliance with game record-keeping
- Recommendation: Implement event sourcing (append-only log of all mutations) in `server.js`

**No Session Backup Mechanism:**
- Problem: Campaign files are only backed up if user manually clicks "Save". Autosave can be lost on crash.
- Blocks: Disaster recovery, reliable long-term campaigns
- Recommendation: Implement periodic versioned snapshots (e.g., every 5 minutes, keep last 12 versions)

**No Role-Based Access Control:**
- Problem: Any client can emit any event. No distinction between GM and player; socket connection doesn't verify identity.
- Blocks: Public/shared game servers, competitive integrity, malicious client protection
- Recommendation: Add simple auth: GM requires password on connect, players get read-only namespace only

## Test Coverage Gaps

**Server State Mutations Not Fully Tested:**
- What's not tested: Complex state transitions like "apply effect -> apply stress delta -> undo" in a single rollback scenario; state consistency after cascading effect clears
- Files: `server.js` (lines 514-701 apply/undo logic)
- Risk: Undo logic may leave state partially applied (stress applied but effect not cleared, or vice versa)
- Priority: High (core gameplay mechanic)
- Recommendation: Add integration test suite for effect lifecycle (apply → stress → undo chains)

**Public Client-Side Logic Untested:**
- What's not tested: All rendering, animation, and UI logic in `public/gm.js` and `public/player.js` (~1600 lines total)
- Files: `public/gm.js`, `public/player.js`
- Risk: UI bugs break GM/player experience; no confidence in refactoring
- Priority: Medium (backend focused, but UI regression risk)
- Recommendation: Add Vitest setup for browser-like environment (jsdom), test DOM rendering and event handlers

**Edge Cases in Duplicate Resolution:**
- What's not tested: Rolling duplicate panic while another is being resolved; applying a panic with applyOptions when a duplicate adjustment is in progress
- Files: `server.js` (lines 418-431, 533-544)
- Risk: Race conditions in concurrent roll applications
- Priority: Medium (unlikely in single GM, but possible in stressed scenarios)
- Recommendation: Add stress tests with parallel socket events

**Campaign File Corruption Scenarios:**
- What's not tested: Loading truncated JSON, missing fields, type mismatches in persisted data
- Files: `server.js` (lines 196-224)
- Risk: Silent data loss on import of corrupted campaigns
- Priority: Medium (data integrity concern)
- Recommendation: Add round-trip persistence tests (save campaign → corrupt file → load → verify recovery)

---

*Concerns audit: 2026-01-27*
