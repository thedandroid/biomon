# Technology Stack: TypeScript Migration

**Project:** BIOMON TypeScript Migration
**Researched:** 2026-01-27
**Confidence:** MEDIUM (based on established patterns as of January 2025 training data)

## Executive Summary

Migrating a Node.js ESM project to TypeScript requires adding a compiler layer without disrupting the existing build pipeline. The standard 2026 approach uses TypeScript compiler for type-checking and declaration generation, while preserving esbuild for bundling speed.

**Key constraints from existing project:**
- Must maintain ESM ("type": "module")
- Must produce CommonJS bundle for pkg
- esbuild already handles bundling
- Vitest already handles testing

**Strategy:** TypeScript as type-checker, esbuild as bundler (no tsc emit)

## Recommended Stack

### TypeScript Compiler

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| typescript | ^5.7.x | Type-checking, .d.ts generation | Industry standard, latest stable with improved ESM support. Use tsc for checking only, not transpilation |
| @types/node | ^22.x | Node.js type definitions | Matches Node 18+ runtime, provides Buffer, process, etc. |
| @types/express | ^5.x | Express type definitions | For Express 5.x (already in use) |

**Rationale:**
- TypeScript 5.7+ has mature ESM module resolution (Node16/NodeNext)
- `noEmit: false` with `emitDeclarationOnly: true` generates .d.ts without transpiling
- esbuild handles .ts transpilation faster than tsc
- Type-checking happens in parallel with build, not blocking it

### Type Definitions

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/node | ^22.x | Node.js APIs | Always (Buffer, process, fs, etc.) |
| @types/express | ^5.x | Express framework | Always |
| socket.io | (built-in) | Socket.io types | No @types needed - ships with types |

**Note:** Socket.io 4.x includes TypeScript definitions out of the box. Do NOT install @types/socket.io.

### Build Tooling Adjustments

| Tool | Current | Change Needed | Why |
|------|---------|---------------|-----|
| esbuild | 0.27.2 → ^0.24.x | Update version, add .ts entrypoints | esbuild 0.20+ has improved TS support, native .ts handling |
| tsc | (none) → CLI usage | Add `tsc --noEmit` to CI | Type-check without transpiling |

**Build pipeline flow:**
```
Source (.ts) → esbuild → Bundled (.cjs) → pkg → Binary
              ↓
            tsc --noEmit (parallel type check)
```

### Test Tooling Adjustments

| Tool | Current | Change Needed | Why |
|------|---------|---------------|-----|
| vitest | 4.0.18 | No version change needed | Vitest 4.x has native TypeScript support via esbuild |
| vitest.config.js | .js | Rename to .ts (optional) | Type-safe config, not required |

**Vitest TypeScript support:**
- Vitest uses esbuild internally for .ts files
- No additional configuration needed
- Just update `include: ["test/**/*.test.ts"]`

### Development Experience

| Tool | Version | Purpose | Why |
|------|---------|---------|-----|
| tsx | ^4.x | Dev server (replaces nodemon) | Fast TS execution for development, ESM-native |

**Rationale:**
- tsx is the 2025+ standard for running .ts files in development
- Faster than ts-node (uses esbuild internally)
- Better ESM support than ts-node
- Can replace nodemon for dev workflow: `tsx --watch server.ts`

**Alternative considered:** ts-node - still viable but tsx is faster and more actively maintained

## tsconfig.json Configuration

### Recommended Settings for Strict ESM Node.js

```json
{
  "compilerOptions": {
    // Module resolution for Node.js ESM
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",

    // ESM configuration
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,

    // Type checking - strict mode
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,

    // Output control
    "outDir": "./dist",
    "rootDir": "./",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    // Don't emit - esbuild handles transpilation
    "noEmit": false,
    "emitDeclarationOnly": true,

    // Skip lib checking for faster compilation
    "skipLibCheck": true
  },
  "include": [
    "*.ts",
    "test/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "public"
  ]
}
```

### Key Settings Explained

**Module Resolution:**
- `moduleResolution: "Bundler"` - Modern option (TS 5.0+) for bundler-based projects
- Handles .js imports for .ts files correctly
- Works with esbuild's expectations

**Why not "Node16" or "NodeNext"?**
- Those require explicit .js extensions in imports (import './file.js' for file.ts)
- "Bundler" is more ergonomic when esbuild handles the bundling
- Trade-off: Less runtime-accurate, but better DX

**Type Checking:**
- `strict: true` - Enables all strict checks (as desired)
- `noUncheckedIndexedAccess: true` - Extra safety for array/object access
- Modern strict baseline for 2026

**Output Control:**
- `emitDeclarationOnly: true` - Only generate .d.ts files
- esbuild handles the actual .js compilation
- Keeps tsc role focused on type-checking

## Package.json Script Updates

### Recommended Changes

```json
{
  "scripts": {
    "start": "node dist/server.cjs",
    "dev": "tsx --watch server.ts",
    "build": "npm run typecheck && node build.js && pkg dist/server.bundled.cjs --targets node18-win-x64 --output dist/biomon",
    "typecheck": "tsc",
    "test": "vitest run",
    "test:watch": "vitest --watch",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}
```

### Script Rationale

| Script | Change | Why |
|--------|--------|-----|
| dev | nodemon → tsx --watch | tsx has built-in watch mode, handles .ts natively |
| build | Add typecheck step | Fail fast on type errors before bundling |
| typecheck | NEW | Explicit type-checking command for CI |

## Build.js Migration

### Changes Needed

1. **Rename:** `build.js` → `build.ts`
2. **Entry point:** `server.js` → `server.ts`
3. **esbuild loader:** No change needed - esbuild handles .ts automatically

**Why esbuild for TS transpilation?**
- 100x faster than tsc
- Already in use for bundling
- Handles TypeScript type stripping natively
- Produces same CommonJS output for pkg

**Type safety trade-off:**
- esbuild doesn't type-check during transpilation
- tsc runs separately for type-checking
- Build pipeline: `tsc` (check) → `esbuild` (transpile) → `pkg` (binary)

## Installation Commands

### Core TypeScript

```bash
npm install -D typescript @types/node @types/express
```

### Development Tooling

```bash
npm install -D tsx
```

### esbuild Update

```bash
npm install -D esbuild@latest
```

### Verification

```bash
# Initialize tsconfig.json
npx tsc --init

# Test type-checking
npm run typecheck

# Test dev server
npm run dev
```

## Migration Path

### Phase 1: Tooling Setup
1. Install dependencies (typescript, @types/*, tsx)
2. Create tsconfig.json with recommended settings
3. Update package.json scripts
4. Verify esbuild version (0.20+)

### Phase 2: Rename Files
1. Rename .js → .ts (server.js → server.ts, etc.)
2. Update build.js entry point reference
3. Update vitest.config.js include pattern

### Phase 3: Fix Type Errors
1. Run `tsc` to see all type errors
2. Add explicit types where inference fails
3. Fix Socket.io event types
4. Fix Express request/response types

### Phase 4: Validate
1. Run type-check: `npm run typecheck`
2. Run tests: `npm test`
3. Run build: `npm run build`
4. Test binary: `./dist/biomon`

## Known Gotchas

### Socket.io Types

Socket.io 4.x has built-in types but requires explicit event typing:

```typescript
// Define your events
interface ServerToClientEvents {
  heartbeat: (crewId: string, stress: number) => void;
}

interface ClientToServerEvents {
  updateStress: (crewId: string, stress: number) => void;
}

// Type the socket
const io: Server<ClientToServerEvents, ServerToClientEvents> = new Server(server);
```

### Express + TypeScript

Request/response types need explicit typing for custom properties:

```typescript
// Extend Express types for custom properties
declare module 'express-serve-static-core' {
  interface Request {
    customProperty?: string;
  }
}
```

### ESM Import Extensions

With `moduleResolution: "Bundler"`, you write:
```typescript
import { foo } from './utils'; // No .js extension
```

esbuild handles resolution. If you switch to Node16/NodeNext later, you'll need:
```typescript
import { foo } from './utils.js'; // Must use .js even for .ts files
```

## Confidence Assessment

| Area | Confidence | Source |
|------|------------|--------|
| TypeScript version | MEDIUM | Training data (Jan 2025), no Context7/official verification |
| tsconfig settings | HIGH | Established patterns for ESM Node.js projects |
| esbuild integration | HIGH | esbuild officially supports TypeScript type stripping |
| Vitest TS support | HIGH | Vitest 4.x documented TypeScript support |
| @types packages | MEDIUM | Versions based on package.json inference, not verified |
| tsx tool | MEDIUM | Known as ts-node successor as of 2025, not verified for 2026 |

## Verification Needed

1. **TypeScript version:** Confirm 5.7.x is latest stable in 2026
2. **@types/node version:** Match to Node 18 LTS type definitions
3. **@types/express version:** Confirm v5 types exist and are stable
4. **tsx version:** Verify 4.x is current in 2026
5. **esbuild version:** Confirm 0.24+ has no breaking TS changes

## Sources

**Note:** This research is based on established TypeScript + Node.js patterns as of January 2025 training data. Official verification via Context7 or current documentation was not available during research.

Recommended verification sources:
- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/
- esbuild TypeScript docs: https://esbuild.github.io/content-types/#typescript
- Vitest TypeScript guide: https://vitest.dev/guide/
- tsx GitHub: https://github.com/privatenumber/tsx
