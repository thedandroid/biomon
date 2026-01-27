# Project Research Summary

**Project:** BIOMON TypeScript Migration
**Domain:** JavaScript to TypeScript migration (Node.js server, Socket.io, ESM)
**Researched:** 2026-01-27
**Confidence:** MEDIUM-HIGH

## Executive Summary

Migrating BIOMON from JavaScript to TypeScript follows a well-established pattern for Node.js Socket.io applications. The recommended approach uses TypeScript as a type-checker only (no transpilation) while preserving the existing esbuild bundling pipeline. The current ~1300 LOC codebase with its 887-line monolithic server.js presents an ideal opportunity to decompose into typed modules during migration, improving both type safety and maintainability.

The highest-value TypeScript features for this project are **typed Socket.io events** and **strict mode**. The codebase currently has 52+ optional chaining operations (`payload?.field`) for defensive runtime validation. TypeScript's compile-time type checking will catch shape mismatches at build time, though critical runtime validation must be preserved since Socket.io payloads remain untrusted network input. The Socket.io 4.x generic types (`Server<ClientToServerEvents, ServerToClientEvents>`) provide IDE autocomplete and refactoring safety across all 17 event handlers.

The primary risks are: (1) ESM module resolution mismatches causing runtime failures despite successful compilation, (2) removing runtime validation because "types handle it," and (3) `any` type proliferation during incremental migration. All three are preventable with proper tsconfig configuration, code review discipline, and bottom-up migration order. The migration should take approximately 5-6 phases, starting with tooling setup and type definitions before touching any source files.

## Key Findings

### Recommended Stack

TypeScript 5.7+ with `moduleResolution: "Bundler"` for optimal esbuild integration. The existing build pipeline (esbuild for bundling, pkg for binary generation) remains unchanged; TypeScript only adds a type-checking layer.

**Core technologies:**
- **typescript ^5.7.x**: Type-checking and declaration generation (no transpilation; esbuild handles that)
- **@types/node ^22.x**: Node.js API types matching current runtime
- **@types/express ^5.x**: Express framework types for request/response handling
- **tsx ^4.x**: Fast TypeScript execution for development (replaces nodemon)

**Build pipeline flow:**
```
Source (.ts) -> esbuild -> Bundled (.cjs) -> pkg -> Binary
              |
              tsc --noEmit (parallel type check)
```

**Key tsconfig decisions:**
- `strict: true` from day one (enables all strict checks)
- `moduleResolution: "Bundler"` (ergonomic imports without .js extensions)
- `emitDeclarationOnly: true` (only generate .d.ts, not transpiled JS)
- `noImplicitAny: true` (prevent `any` escape hatches)

### Expected Features

**Must have (table stakes):**
- Strict mode with full type checking
- Explicit function signatures on all exported functions
- Interface definitions for domain objects (Player, Effect, RollEvent, State)
- Type-safe Socket.io event definitions (ClientToServerEvents, ServerToClientEvents)
- Const assertions for lookup tables (responseTables)
- ESM module resolution configuration

**Should have (differentiators):**
- Socket.io typed events with full payload shapes
- Discriminated unions for roll types (stress vs panic)
- Branded types for IDs (PlayerId, EffectId, EventId)
- Readonly state constraints where appropriate
- Type guards for payload validation

**Defer to post-MVP:**
- Zod runtime validation (adds complexity, not needed for internal tool)
- Complex generic utilities (YAGNI until proven needed)
- Exhaustive type coverage (focus on event handlers first)

### Architecture Approach

Transform the 887-line monolithic server.js into a modular structure with centralized type definitions that serve as the "contract" between components. Types flow downward (no dependencies), handlers consume types and export registration functions, server.ts becomes a thin router (~80 lines).

**Target directory structure:**
```
src/
  types/         # Central type definitions (events, state, effects)
  handlers/      # Grouped by domain (player, roll, effect, session)
  utils/         # Type-safe validation helpers
  data/          # Typed response tables and constants
  persistence/   # File I/O with typed Result returns
  createServer.ts
  server.ts      # Entry point (~80 lines, down from 887)
```

**Major components:**
1. **types/** - Event type maps, state interfaces, discriminated unions (no dependencies)
2. **handlers/** - 4 modules (player, roll, effect, session) with typed Socket event handlers
3. **utils/** - Type-safe clamp, validation, ID generation functions
4. **persistence/** - Result<T, E> pattern for file operations, autosave logic

### Critical Pitfalls

1. **ESM Extension Resolution Mismatch** - TypeScript compiles but Node.js ESM fails at runtime. **Prevention:** Use `moduleResolution: "Bundler"`, test unbundled output directly with Node.

2. **Socket.io Type Safety Theater** - Removing runtime validation because "types guarantee it." **Prevention:** Keep ALL optional chaining and runtime validation; types are documentation, not enforcement.

3. **`any` Escape Hatches** - Liberal `any` usage at module boundaries during incremental migration. **Prevention:** Enable `noImplicitAny` from day one, convert files bottom-up (utils -> server).

4. **esbuild vs tsc Discrepancies** - Code bundles with esbuild but has tsc errors that go undetected. **Prevention:** Run both tools; add `tsc --noEmit` to test script and CI pipeline.

5. **Converting Tests Before Source** - Creates type mismatches when test files import untyped JS modules. **Prevention:** Convert source files first, tests last.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Tooling Foundation
**Rationale:** Must establish TypeScript infrastructure before converting any files; prevents configuration drift and ensures all tools work together from the start.
**Delivers:** tsconfig.json, TypeScript dependencies, updated package.json scripts, lint-staged configuration.
**Addresses:** Table stakes (strict mode, module resolution)
**Avoids:** Pitfalls 1, 4, 7, 8, 10 (ESM resolution, esbuild/tsc discrepancy, missing @types, path aliases)

### Phase 2: Type Definitions
**Rationale:** Types must exist before files can use them; central type definitions enable parallel conversion of independent modules.
**Delivers:** `/src/types/` directory with events.ts (Socket.io maps), state.ts (GameState, Player, Effect), effects.ts (TableEntry, RollEvent).
**Uses:** TypeScript interfaces, discriminated unions, branded types
**Implements:** Architecture pattern of types as central contract
**Avoids:** Pitfall 5 (overusing generic unions instead of discriminated unions)

### Phase 3: Pure Data & Utilities
**Rationale:** Utilities and response tables have no dependencies on other code; easiest to convert and validates tooling works correctly.
**Delivers:** utils.ts, responseTables.ts with full type annotations
**Addresses:** Const assertions for tables, type-safe validation functions
**Avoids:** Pitfall 3 (converting bottom-up prevents `any` at boundaries)

### Phase 4: Server Infrastructure
**Rationale:** createServer and persistence logic are isolated concerns that depend only on types; validates Socket.io generic types work.
**Delivers:** createServer.ts with typed Server/Socket, persistence/ modules with Result<T, E> pattern
**Uses:** Socket.io generic types, Result type for I/O operations
**Implements:** Server factory and file persistence components

### Phase 5: Event Handler Migration
**Rationale:** Handlers are the core business logic; must have all dependencies typed first. This is the largest phase.
**Delivers:** handlers/ directory with 4 modules (player, roll, effect, session), refactored server.ts as thin router
**Addresses:** Type-safe event handlers, discriminated unions for roll types
**Avoids:** Pitfall 2 (keeping runtime validation despite typed events), Pitfall 9 (test file isolation)

### Phase 6: Test Migration & Validation
**Rationale:** Tests converted last to validate against typed source; ensures migration didn't break behavior.
**Delivers:** TypeScript test files, typed test utilities, updated vitest configuration
**Addresses:** Test type safety, external integration verification
**Avoids:** Pitfall 6 (tests after source), Pitfall 12 (over-strict types breaking clients)

### Phase Ordering Rationale

- **Bottom-up dependency order:** Types -> utilities -> infrastructure -> handlers -> tests. This prevents `any` at module boundaries.
- **Isolated concerns first:** utils.ts and responseTables.ts can be converted independently, validating tooling before tackling server.ts.
- **Handler extraction as dedicated phase:** The 887-line server.js requires careful decomposition; doing this as a separate phase allows focused attention.
- **Tests last:** Ensures tests validate the final typed system, not intermediate states.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Handler Migration):** Complex phase with most code changes; may need phase-specific research on Socket.io event typing patterns and handler extraction strategies.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Tooling):** Well-documented tsconfig patterns for ESM Node.js projects
- **Phase 2 (Types):** Standard TypeScript interface definitions
- **Phase 3 (Utils):** Pure function typing is straightforward
- **Phase 4 (Infrastructure):** Socket.io generics are documented in official docs
- **Phase 6 (Tests):** Vitest TypeScript support is native

## Key Decisions (Derived from Research)

| Decision | Rationale | Source |
|----------|-----------|--------|
| TypeScript as type-checker only (no transpilation) | esbuild handles transpilation 100x faster; tsc for validation only | STACK.md |
| `moduleResolution: "Bundler"` | Best ergonomics for esbuild-based projects; no .js extension requirement | STACK.md |
| Enable strict mode from day one | Core value proposition of TypeScript; prevents `any` proliferation | FEATURES.md, PITFALLS.md |
| Keep all runtime validation | Socket.io types are compile-time only; payloads still untrusted | PITFALLS.md |
| Convert files bottom-up | Prevents `any` at module boundaries; dependencies typed before dependents | ARCHITECTURE.md |
| 4 handler modules (not 17 files) | Balance between organization and navigability; group by domain | ARCHITECTURE.md |
| Defer Zod to post-MVP | Adds complexity; TypeScript types sufficient for internal tool | FEATURES.md |
| Use discriminated unions for rolls | stress vs panic have different rules; compiler ensures exhaustive handling | FEATURES.md |
| Branded types for IDs | Prevents mixing PlayerId, EffectId, EventId at compile time | FEATURES.md |

## Migration Order

1. **tsconfig.json + dependencies** - Foundation before any file conversion
2. **types/ directory** - Central type definitions
3. **utils.ts + responseTables.ts** - Pure data, no dependencies
4. **createServer.ts** - Apply Socket.io generics
5. **persistence/ modules** - Extract from server.js with types
6. **handlers/ modules** - Extract and type all event handlers
7. **server.ts refactor** - Thin router wiring handlers
8. **Test files** - Convert after source stabilizes
9. **Build verification** - Ensure pkg binary still works

## Tooling Stack

| Tool | Version | Purpose |
|------|---------|---------|
| typescript | ^5.7.x | Type-checking (tsc --noEmit) |
| @types/node | ^22.x | Node.js API types |
| @types/express | ^5.x | Express framework types |
| tsx | ^4.x | Development server (replaces nodemon) |
| esbuild | existing | Transpilation and bundling (unchanged) |
| vitest | existing | Test runner with native TS support |

**New package.json scripts:**
```json
{
  "dev": "tsx --watch server.ts",
  "build": "npm run typecheck && node build.js && pkg dist/server.bundled.cjs ...",
  "typecheck": "tsc --noEmit"
}
```

## Architecture Pattern

**Type-first modular architecture:**
- Types are the source of truth, defined in `/src/types/` with no dependencies
- Handlers are grouped by domain (4 modules) and consume types
- Server.ts is a thin router (~80 LOC) that wires handlers to Socket.io
- Pure functions in utils/ are independently testable
- File I/O uses Result<T, E> pattern for explicit error handling

**Key architectural shift:** From monolithic server.js (887 lines) to modular structure (15-20 files, 50-200 lines each).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | TypeScript 5.7 and tsx versions based on 2025 training data, not verified for 2026 |
| Features | HIGH | Socket.io typed events and TypeScript patterns are well-documented |
| Architecture | HIGH | Established patterns for modular TypeScript applications |
| Pitfalls | MEDIUM-HIGH | ESM/TypeScript pitfalls well-known; Socket.io specifics less verified |

**Overall confidence:** MEDIUM-HIGH

The migration approach follows well-established patterns. Main uncertainty is around specific tool versions (TypeScript 5.7, tsx 4.x) which should be verified against current npm registry.

### Gaps to Address

- **TypeScript version verification:** Confirm 5.7.x is latest stable before starting Phase 1
- **Socket.io 4.8.3 typing specifics:** Test typed events with small prototype before Phase 5
- **pkg compatibility:** Verify pkg still works with esbuild-compiled TypeScript output
- **@types/express v5:** Confirm v5 types exist and are stable

## Open Questions

1. **Test migration timing:** Migrate tests alongside source files or after? Research recommends after; validate this fits team workflow.
2. **Type sharing with client:** Should client-side code use same types? Current scope is server-only; consider extracting to /shared for future client adoption.
3. **Runtime validation boundary:** Where is the trust boundary? Current approach treats all Socket.io payloads as untrusted.

## Sources

### Primary (HIGH confidence)
- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/
- Socket.io TypeScript guide: https://socket.io/docs/v4/typescript/
- esbuild TypeScript docs: https://esbuild.github.io/content-types/#typescript

### Secondary (MEDIUM confidence)
- Codebase analysis: server.js (887 LOC), utils.js (98 LOC), responseTables.js (~200 LOC)
- Identified 18 client->server events, 10 server->client events
- Found 52+ optional chaining sites for payload validation

### Tertiary (LOW confidence - needs validation)
- TypeScript 5.7.x as "latest stable" (based on 2025 training data)
- tsx 4.x as current version (verify against npm)
- @types/express v5 availability (verify against npm)

---
*Research completed: 2026-01-27*
*Ready for roadmap: yes*
