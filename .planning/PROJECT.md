# BIOMON TypeScript Migration

## What This Is

Server-side TypeScript migration for BIOMON, a real-time stress/panic tracker for the Alien RPG. The Node.js server code has been converted from JavaScript to TypeScript with strict mode, providing compile-time type safety for all Socket.io event payloads, state mutations, and utility functions.

## Core Value

Type safety on the server — every Socket.io event payload, every state mutation, every utility function has explicit types that the compiler verifies.

## Requirements

### Validated

<!-- v1.0 TypeScript Migration - shipped 2026-01-28 -->

- ✓ Real-time state sync via Socket.io — existing
- ✓ Stress/panic roll resolution with table lookups — existing
- ✓ Player management (add, remove, update) — existing
- ✓ Effect lifecycle (create, apply, clear, undo) — existing
- ✓ Session persistence (autosave, manual save/load) — existing
- ✓ External read-only namespace for integrations — existing
- ✓ Mission log and roll event history — existing
- ✓ Cross-platform executable builds via pkg — existing
- ✓ Convert server.js to TypeScript with strict mode — v1.0
- ✓ Convert utils.js to TypeScript with explicit function signatures — v1.0
- ✓ Convert responseTables.js to TypeScript with typed table entries — v1.0
- ✓ Convert createServer.js to TypeScript — v1.0
- ✓ Define shared types for state, players, effects, events — v1.0
- ✓ Update build process to compile TypeScript — v1.0
- ✓ Update ESLint config for TypeScript — v1.0
- ✓ All tests pass after migration — v1.0

### Active

(No active requirements — milestone complete)

### Out of Scope

- Client-side TypeScript (public/*.js) — would require client build pipeline, separate project
- Database backend — current file-based persistence is fine for now
- Offline mode — real-time sync is core value

## Context

**Current state (v1.0 shipped):**
- 3,837 lines of TypeScript across server, handlers, types, and tests
- 6 handler modules replacing monolithic 887-line server.js (now 412 LOC thin router)
- Full type coverage with strict mode enabled
- 79 tests passing with typed Socket.IO clients

**Tech stack:**
- TypeScript 5.9 (type-checking only, esbuild transpiles)
- Socket.io with typed event contracts
- Express for HTTP server
- Vitest for testing
- esbuild + pkg for bundling

**Known issues:**
- pkg cross-compilation fails on macOS for Windows (platform limitation, bundle works via Node.js)
- Minor tech debt: eslint-disable for `any` on table entry types (documented decision)

## Constraints

- **Backward compatibility**: Existing clients work without changes
- **Build output**: Produces CommonJS bundle for pkg
- **Runtime validation**: All defensive programming preserved (types are compile-time only)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Server-side only | Client would require build pipeline, out of scope | ✓ Good |
| Strict mode from start | Catches more bugs, worth the extra effort | ✓ Good |
| TypeScript as type-checker only | esbuild handles transpilation, consistent with existing tooling | ✓ Good |
| moduleResolution: Bundler | Optimal esbuild integration | ✓ Good |
| Keep all runtime validation | Types are compile-time only, preserve defensive programming | ✓ Good |
| allowJs: true, checkJs: false | Enables gradual migration without checking JS files | ✓ Good |
| Thin router pattern | 412 LOC vs 887 LOC, modular handlers easier to test | ✓ Good |
| Keep persistence inline | Per research recommendation, extract if needed later | — Pending |
| Discriminated unions for rolls | Type-safe stress vs panic logic | ✓ Good |
| Dependency injection for handlers | Full testability, explicit dependencies | ✓ Good |

---
*Last updated: 2026-01-28 after v1.0 milestone*
