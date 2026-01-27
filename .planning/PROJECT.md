# BIOMON TypeScript Migration

## What This Is

Server-side TypeScript migration for BIOMON, a real-time stress/panic tracker for the Alien RPG. Converting the Node.js server code from JavaScript to TypeScript with strict mode to catch type-related bugs and make future refactoring safer.

## Core Value

Type safety on the server — every Socket.io event payload, every state mutation, every utility function has explicit types that the compiler verifies.

## Requirements

### Validated

<!-- Existing functionality that must continue working -->

- ✓ Real-time state sync via Socket.io — existing
- ✓ Stress/panic roll resolution with table lookups — existing
- ✓ Player management (add, remove, update) — existing
- ✓ Effect lifecycle (create, apply, clear, undo) — existing
- ✓ Session persistence (autosave, manual save/load) — existing
- ✓ External read-only namespace for integrations — existing
- ✓ Mission log and roll event history — existing
- ✓ Cross-platform executable builds via pkg — existing

### Active

<!-- TypeScript migration goals -->

- [ ] Convert server.js to TypeScript with strict mode
- [ ] Convert utils.js to TypeScript with explicit function signatures
- [ ] Convert responseTables.js to TypeScript with typed table entries
- [ ] Convert createServer.js to TypeScript
- [ ] Define shared types for state, players, effects, events
- [ ] Update build process to compile TypeScript
- [ ] Update ESLint config for TypeScript
- [ ] All tests pass after migration

### Out of Scope

- Client-side TypeScript (public/*.js) — would require client build pipeline, separate project
- Database backend — current file-based persistence is fine for now
- New features — this is a refactoring milestone, not feature work

## Context

**Current state:**
- ~1,300 lines of server-side JavaScript across 4 files
- 52+ instances of optional chaining (`payload?.field`) for runtime validation
- Heavy type coercion (`String()`, `Number()`, `clamp()`) throughout
- No compile-time type checking
- Tests duplicate server logic instead of importing shared handlers

**Why TypeScript:**
- Catch shape mismatches at compile time (e.g., accessing `player.stres` instead of `player.stress`)
- IDE autocomplete and refactoring support
- Self-documenting code through type annotations
- Safer event payload handling with typed Socket.io events

**Existing tooling:**
- ESLint 9.x with flat config
- Vitest for testing
- esbuild for bundling (already supports TypeScript)
- pkg for executable builds

## Constraints

- **Backward compatibility**: Existing clients must work without changes
- **Build output**: Must still produce CommonJS bundle for pkg
- **Test migration**: Tests should migrate alongside source files

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Server-side only | Client would require build pipeline, out of scope | — Pending |
| Strict mode from start | Catches more bugs, worth the extra effort | — Pending |
| Keep .js test files initially | Can migrate tests after source, reduces blast radius | — Pending |

---
*Last updated: 2026-01-27 after initialization*
