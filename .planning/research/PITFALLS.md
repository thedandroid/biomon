# Domain Pitfalls: TypeScript Migration

**Domain:** JavaScript to TypeScript migration (Node.js server, Socket.io, ESM, esbuild)
**Researched:** 2026-01-27
**Confidence:** MEDIUM (based on training data and codebase analysis; no external verification available)

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: ESM + TypeScript Extension Resolution Mismatch
**What goes wrong:** TypeScript compiler produces `.js` imports from `.ts` sources, but Node.js ESM requires explicit `.js` extensions in import statements. Writing `import { foo } from "./utils"` works in TS but fails at runtime.

**Why it happens:** TypeScript doesn't rewrite import paths. With `"type": "module"` in package.json, Node.js enforces ESM rules: all relative imports must include extensions. TS files import other TS files as `.js` (the output extension), not `.ts`.

**Consequences:**
- Code compiles successfully
- Runtime crashes with "Cannot find module" errors
- esbuild bundling may mask the issue (bundles work, but direct Node execution fails)

**Prevention:**
1. Configure TypeScript with `"moduleResolution": "bundler"` or `"node16"/"nodenext"`
2. Write imports as `.js` extensions even in `.ts` files: `import { foo } from "./utils.js"`
3. Test unbundled compilation output with Node directly, not just through esbuild

**Detection:**
- `tsc` succeeds but `node dist/server.js` fails
- Error: "Cannot find module './utils' imported from..."
- Works in bundled build, fails in direct TypeScript compilation

**Phase mapping:** Phase 1 (tsconfig setup) must configure this correctly before any file conversion.

---

### Pitfall 2: Socket.io Event Type Safety Theater
**What goes wrong:** Declaring typed Socket.io events without runtime validation. Types exist at compile time but payloads are still `any` at runtime. Optional chaining gets removed because "types guarantee it exists."

**Why it happens:**
- Socket.io TypeScript support uses declaration merging for event maps
- Developers assume typed events = validated data
- Code review sees types and approves removing runtime checks
- Attackers or buggy clients can send any payload shape

**Consequences:**
- Type system shows `payload.field` exists, runtime throws `undefined is not a function`
- Security vulnerability if business logic assumes validated input
- Harder to debug (type says it should work)

**Prevention:**
1. **Keep all runtime validation** — optional chaining, `String()`, `clamp()` calls must stay
2. Types document the *expected* shape, not the *guaranteed* shape
3. Use runtime validation libraries (zod, io-ts) for event payloads if removing manual checks
4. Add comment: `// Runtime validation required - payloads are untrusted`

**Detection:**
- Pull request removes optional chaining: `payload?.name` → `payload.name`
- Missing `String()` coercion after migration
- Test suite doesn't test malformed payloads

**Phase mapping:**
- Phase 2 (type definitions): Document that types are documentation, not validation
- Phase 3 (file conversion): Flag any removal of runtime checks in code review

---

### Pitfall 3: `any` Escape Hatches During Incremental Migration
**What goes wrong:** Converting files one-by-one leads to liberal `any` usage at module boundaries. File compiles, passes type checking, but provides no safety. `any` spreads like a virus through the codebase.

**Why it happens:**
- Mixed JS/TS codebase during migration
- `tsc` can't infer types from untyped JS imports
- Quick fix: `const x: any = require('./oldFile.js')`
- Time pressure prevents proper typing
- Each new `any` makes the next one easier to justify

**Consequences:**
- "TypeScript migration" with no actual type safety
- Silent bugs that types should have caught
- Technical debt that's harder to fix later (becomes "expected" behavior)
- False confidence in type coverage

**Prevention:**
1. Enable `"noImplicitAny": true` in strict mode from day one
2. Convert dependency graphs bottom-up (utils → modules → server)
3. Create `.d.ts` type stubs for unconverted files rather than using `any`
4. Use `// @ts-expect-error` with explanation for temporary issues, not `any`
5. Add lint rule to detect `any` usage (ESLint `@typescript-eslint/no-explicit-any`)

**Detection:**
- Grep for `: any` in source files
- Type coverage report shows <90% coverage
- Tests pass but type-related bugs appear in production

**Phase mapping:**
- Phase 1 (tsconfig): Enable `noImplicitAny` before converting files
- Phase 3 (file conversion): Convert in dependency order: utils.ts → responseTables.ts → createServer.ts → server.ts

---

### Pitfall 4: esbuild vs tsc Compilation Discrepancies
**What goes wrong:** Code compiles and bundles with esbuild but `tsc --noEmit` reports errors, or vice versa. Team uses esbuild in development, ignores `tsc` errors, ships type-unsafe code.

**Why it happens:**
- esbuild is a transpiler (syntax transformation only), not a type checker
- esbuild is fast, becomes the default build tool
- `tsc` type checking is slower, runs less frequently
- Different strictness levels between tools

**Consequences:**
- CI/CD uses esbuild only → type errors reach production
- Code passes esbuild but fails tsc in pre-commit hook → frustration
- Type system inconsistencies between dev and CI

**Prevention:**
1. **Run both tools:** esbuild for fast builds, tsc for type checking
2. Add `tsc --noEmit` to test script: `"test": "tsc --noEmit && vitest run"`
3. Add to pre-commit hook: lint-staged runs tsc on changed files
4. CI must run `tsc --noEmit` as a separate step
5. Document: "esbuild builds, tsc validates types"

**Detection:**
- CI passes but code has type errors
- Local build works but PR fails type check in CI
- Developer confusion: "It compiles on my machine"

**Phase mapping:**
- Phase 1 (tooling): Configure both tsc and esbuild, wire into test/lint workflow
- Phase 4 (CI/CD): Ensure both tools run in CI pipeline

---

## Moderate Pitfalls

Mistakes that cause delays or technical debt.

### Pitfall 5: Overusing Unions Instead of Discriminated Unions
**What goes wrong:** Event payloads typed as `{ type: string; data: any }` instead of discriminated unions. TypeScript can't narrow types, developers add assertions.

**Why it happens:**
- Quick fix: model everything as key-value pairs
- Discriminated unions require upfront design
- Lack of TypeScript experience with advanced features

**Prevention:**
```typescript
// Bad: No type narrowing possible
type Event = { type: string; playerId?: string; amount?: number };

// Good: TypeScript can narrow based on type field
type Event =
  | { type: 'stress:add'; playerId: string; amount: number }
  | { type: 'player:remove'; playerId: string }
  | { type: 'session:save'; filename: string };
```

**Detection:**
- Many `as` type assertions in event handlers
- Optional properties everywhere: `field?: string`

**Phase mapping:** Phase 2 (type definitions) should model events as discriminated unions.

---

### Pitfall 6: Converting Tests Before Source Files
**What goes wrong:** Test files converted to TypeScript before source files, creating type mismatches. Tests import untyped JS modules, use `any`, lose type safety benefits.

**Why it happens:**
- "Tests are independent, can migrate separately"
- Vitest supports TS out-of-box, seems easy
- Excitement to use typed test framework

**Prevention:**
1. Convert source files first, tests second
2. Exception: Create `types.ts` first, use in tests before migration
3. Update `vitest.config.js` to `vitest.config.ts` only after test files migrate

**Detection:**
- Test files are `.ts` but import from `.js` sources
- Test type annotations use `any` heavily

**Phase mapping:**
- Phase 3: Convert server files before test files
- Phase 5: Migrate test files after source stabilizes

---

### Pitfall 7: Missing `@types` Packages for Dependencies
**What goes wrong:** After migration, imports from packages like `express` or `socket.io` have `any` types. No autocomplete, no type safety.

**Why it happens:**
- Forgot to install type declaration packages
- Not all libraries ship with types
- Types exist but aren't discovered automatically

**Prevention:**
1. Check which deps need `@types/*` packages:
   - Express: `npm i -D @types/express @types/node`
   - Socket.io: Ships types (v4.x+), no separate package needed
2. Run `tsc --noEmit` early to detect missing types
3. For packages without types: create minimal `.d.ts` shim

**Detection:**
- Hovering over imports shows `any` in IDE
- No autocomplete for library methods
- `tsc` warning: "Could not find declaration file for module 'X'"

**Phase mapping:** Phase 1 (dependencies) installs all type packages before file conversion.

---

### Pitfall 8: Path Alias Configuration Mismatch
**What goes wrong:** tsconfig uses path aliases (`@/utils`) but esbuild/Vitest don't resolve them. Code compiles with tsc but runtime fails.

**Why it happens:**
- tsconfig `paths` configuration is TS-only
- esbuild, Vitest, Node.js don't read tsconfig paths automatically
- Each tool needs separate configuration

**Prevention:**
1. **Avoid path aliases for simple projects** — explicit relative imports are clearer
2. If using aliases, configure ALL tools:
   - tsconfig: `"paths": { "@/*": ["./src/*"] }`
   - esbuild: Add custom path resolver plugin
   - Vitest: Add `alias` to vite config
   - Node: Use `--experimental-loader` or transpile
3. Document: "Path aliases require coordination across 4+ tools"

**Detection:**
- tsc succeeds, esbuild fails to resolve imports
- Tests fail with "Cannot find module '@/utils'"

**Phase mapping:** Phase 1 (decision) — decide to avoid path aliases for this small codebase.

---

### Pitfall 9: Global Type Pollution from Test Files
**What goes wrong:** Test files declare global types (`declare global { ... }`) that leak into production types. Type-only test helpers appear in server compilation.

**Why it happens:**
- Vitest's `globals: true` makes test functions globally available
- Test-specific type declarations in non-isolated files
- tsconfig includes test files in main project compilation

**Prevention:**
1. Separate tsconfig for tests: `tsconfig.test.json` extends base
2. Exclude test files from main tsconfig: `"exclude": ["test/**/*"]`
3. Keep test type declarations in test files only

**Detection:**
- Production code has `describe`, `it`, `expect` available (shouldn't be)
- Type checking runs on test files during prod build

**Phase mapping:** Phase 1 (tsconfig structure) should create separate configs for src and test.

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 10: Forgetting to Update `lint-staged` for TypeScript
**What goes wrong:** Pre-commit hooks still run `eslint *.js` but ignore `.ts` files. Type errors reach commits.

**Why it happens:**
- Glob pattern in lint-staged config is outdated
- Forgot to update ESLint config for TS parser

**Prevention:**
```json
{
  "lint-staged": {
    "*.{js,ts}": ["eslint --fix"],
    "*.ts": ["tsc --noEmit --pretty"]
  }
}
```

**Phase mapping:** Phase 1 (tooling) updates lint-staged and ESLint config.

---

### Pitfall 11: `__dirname` and `__filename` Confusion
**What goes wrong:** Code uses ESM-style `import.meta.url` and `fileURLToPath()`. TypeScript types are wrong for `import.meta`.

**Why it happens:**
- ESM doesn't have `__dirname`, must use `import.meta.url`
- TypeScript's `import.meta` types depend on `module` setting
- Confusion during esbuild bundling (which provides `__dirname` shims)

**Prevention:**
1. Keep existing `fileURLToPath(import.meta.url)` pattern
2. Ensure tsconfig has `"module": "ES2020"` or later
3. Type will be correct: `import.meta: ImportMeta`
4. esbuild bundling to CommonJS already handles this (see build.js)

**Detection:**
- `import.meta` has type error in TS
- esbuild bundle works but unbundled TS compilation fails

**Phase mapping:** Phase 1 (tsconfig) validates module settings support `import.meta`.

---

### Pitfall 12: Over-Strict Types Break Backward Compatibility
**What goes wrong:** Adding strict types to existing APIs changes runtime behavior. Clients sending extra fields now fail validation.

**Why it happens:**
- Types add constraints that didn't exist in JS
- Overzealous validation: `type Player = { id, name, health }` (no extra fields allowed in validators)
- Breaking change for external integrations

**Prevention:**
1. Types should be permissive for external input: use `& { [key: string]: unknown }` for extra fields
2. Don't add runtime validators that types don't require
3. Test with real-world client payloads (including extra fields)

**Detection:**
- External clients break after migration
- Tests with exact payloads pass, real clients fail

**Phase mapping:** Phase 6 (testing) includes external integration tests with real client behavior.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| tsconfig setup | ESM extension resolution (Pitfall 1) | Use `"moduleResolution": "bundler"`, document `.js` import requirement |
| Type definitions | Socket.io type safety theater (Pitfall 2) | Comment all event types: "Runtime validation still required" |
| File conversion | `any` escape hatches (Pitfall 3) | Enable `noImplicitAny`, convert bottom-up (utils first) |
| Build pipeline | esbuild vs tsc discrepancy (Pitfall 4) | Run both: esbuild for build, tsc for validation |
| Testing migration | Converting tests before source (Pitfall 6) | Convert server files first, tests last |
| External validation | Over-strict types (Pitfall 12) | Test with real external clients, not just unit tests |

---

## Confidence Notes

**Sources:**
- Based on training data (TypeScript migration patterns, Socket.io typing, ESM/CommonJS interop)
- Codebase analysis (existing patterns in biomon: ESM, optional chaining, esbuild setup)
- No external verification via WebSearch or Context7 (tools unavailable)

**Confidence level: MEDIUM**
- Pitfalls 1, 3, 4, 7, 8, 11: HIGH confidence (well-documented TS/ESM issues)
- Pitfall 2: HIGH confidence (Socket.io event typing is a known weak point)
- Pitfalls 5, 6, 9, 10, 12: MEDIUM confidence (common patterns but project-dependent)

**Known gaps:**
- Could not verify Socket.io 4.8.3 specific typing behavior via Context7
- Could not check recent TypeScript 5.x ESM improvements via official docs
- Vitest TypeScript integration specifics not verified against current docs

**Recommendations for validation:**
1. Cross-check Pitfall 1 (ESM extensions) against current TypeScript handbook
2. Test Pitfall 2 (Socket.io typing) with a small prototype before full migration
3. Verify esbuild TypeScript handling (Pitfall 4) with your specific config
