# Roadmap: BIOMON TypeScript Migration

## Overview

This roadmap transforms the BIOMON server from JavaScript to TypeScript with strict mode, converting ~1,300 lines of server-side code across 4 files into a typed, modular codebase. The migration follows a bottom-up approach: tooling and types first, then utilities, infrastructure, handlers, and finally tests. Each phase builds on the previous, ensuring no `any` type leakage at module boundaries.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Tooling Foundation** - TypeScript infrastructure without converting source files
- [x] **Phase 2: Type Definitions** - Central type definitions as contracts between modules
- [x] **Phase 3: Pure Data & Utilities** - Convert pure functions and data modules
- [ ] **Phase 4: Server Infrastructure** - Convert server factory and add persistence types
- [ ] **Phase 5: Event Handler Migration** - Extract and type all Socket.io event handlers
- [ ] **Phase 6: Test Migration & Validation** - Convert test files and validate complete migration

## Phase Details

### Phase 1: Tooling Foundation
**Goal**: Establish TypeScript infrastructure without converting any source files
**Depends on**: Nothing (first phase)
**Requirements**: TS-BUILD (Update build process to compile TypeScript), TS-ESLINT (Update ESLint config for TypeScript)
**Success Criteria** (what must be TRUE):
  1. `npm run typecheck` runs without errors (on empty project)
  2. `npm run dev` starts development server with TypeScript support
  3. `npm run build` produces working executable
  4. All existing tests pass unchanged
  5. lint-staged handles TypeScript files
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Install TypeScript deps, create tsconfig.json, update scripts
- [x] 01-02-PLAN.md — Integrate typescript-eslint and update lint-staged

### Phase 2: Type Definitions
**Goal**: Create central type definitions that serve as contracts between modules
**Depends on**: Phase 1
**Requirements**: TS-TYPES (Define shared types for state, players, effects, events)
**Success Criteria** (what must be TRUE):
  1. Type files compile without errors via `npm run typecheck`
  2. All types exported and importable from src/types/
  3. No runtime code in type files (pure type definitions)
  4. Socket.io event maps defined with full payload shapes
**Plans**: 1 plan

Plans:
- [x] 02-01-PLAN.md — Create state types, event maps, table types, and barrel export in src/types/

### Phase 3: Pure Data & Utilities
**Goal**: Convert pure functions and data modules to TypeScript
**Depends on**: Phase 2
**Requirements**: TS-UTILS (Convert utils.js to TypeScript), TS-TABLES (Convert responseTables.js to TypeScript)
**Success Criteria** (what must be TRUE):
  1. utils.ts compiles with full type coverage (no `any`)
  2. responseTables.ts compiles with typed table entries and const assertions
  3. Existing tests import and pass with typed modules
  4. Functions have explicit parameter and return types
**Plans**: 1 plan

Plans:
- [x] 03-01-PLAN.md — Convert utils.js and responseTables.js to TypeScript with type annotations

### Phase 4: Server Infrastructure
**Goal**: Convert server factory and persistence logic to TypeScript
**Depends on**: Phase 3
**Requirements**: TS-CREATE-SERVER (Convert createServer.js to TypeScript)
**Success Criteria** (what must be TRUE):
  1. createServer.ts compiles with typed Socket.io Server and Socket generics
  2. Persistence functions typed with explicit return types
  3. Integration tests pass with typed server infrastructure
  4. Express middleware properly typed
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Event Handler Migration
**Goal**: Extract and type all Socket.io event handlers from monolithic server.js
**Depends on**: Phase 4
**Requirements**: TS-SERVER (Convert server.js to TypeScript with strict mode)
**Success Criteria** (what must be TRUE):
  1. All 17+ event handlers typed with full payload shapes
  2. Discriminated unions used for roll types (stress vs panic)
  3. All runtime validation preserved (52+ optional chaining sites)
  4. server.ts refactored to thin router (~80 LOC entry point)
  5. All existing tests pass
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

### Phase 6: Test Migration & Validation
**Goal**: Convert test files to TypeScript and validate complete migration
**Depends on**: Phase 5
**Requirements**: TS-TESTS (All tests pass after migration)
**Success Criteria** (what must be TRUE):
  1. All test files converted to TypeScript
  2. Full type coverage in tests (no `any`)
  3. pkg executable works correctly (build produces working binary)
  4. External integration tests pass
  5. No regression in functionality (all 50+ existing tests pass)
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Tooling Foundation | 2/2 | Complete | 2026-01-27 |
| 2. Type Definitions | 1/1 | Complete | 2026-01-27 |
| 3. Pure Data & Utilities | 1/1 | Complete | 2026-01-28 |
| 4. Server Infrastructure | 0/? | Not started | - |
| 5. Event Handler Migration | 0/? | Not started | - |
| 6. Test Migration & Validation | 0/? | Not started | - |
