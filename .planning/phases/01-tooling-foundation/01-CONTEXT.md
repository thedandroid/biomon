# Phase 1: Tooling Foundation - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish TypeScript infrastructure without converting any source files. This phase delivers tsconfig.json, TypeScript dependencies, updated package.json scripts, and lint-staged configuration. Source files remain .js until later phases.

</domain>

<decisions>
## Implementation Decisions

### tsconfig Strictness
- Full strict mode enabled from day one (`strict: true`)
- Use `moduleResolution: "Bundler"` for best esbuild integration (no .js extension requirement)
- Generate declaration files (.d.ts) for potential future client sharing
- Source files will live in `src/` directory

### Development Workflow
- Replace nodemon with tsx (`tsx --watch`) for development server
- Vitest configured to use tsx — can import .ts files immediately
- Add dedicated `npm run typecheck` command for explicit type-checking

### Type-Check Integration
- Pre-commit hook via lint-staged runs type-checking on staged TypeScript files
- Configure ESLint with typescript-eslint for type-aware linting

### Existing File Handling
- Phase 1 sets up tooling only — no file renames or conversions
- Files remain .js and stay in current location during this phase
- Later phases will move files to src/ and convert to .ts

### Claude's Discretion
- Build command structure (type-check then bundle vs separate)
- lint-staged specifics (staged files only vs project-wide type-check)
- allowJs configuration for transition period
- When to create src/ directory (Phase 1 vs later phases)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard TypeScript tooling patterns. Research already established that esbuild handles transpilation and tsc is for type-checking only.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-tooling-foundation*
*Context gathered: 2026-01-27*
