# Technology Stack

**Analysis Date:** 2026-01-27

## Languages

**Primary:**
- JavaScript (Node.js) - Server-side logic, Socket.io handlers, CLI utilities
- JavaScript (Browser) - Client-side UI, Socket.io client connections, frontend interactions

## Runtime

**Environment:**
- Node.js 18+ (specified in CI/CD and package configurations)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Express 5.2.1 - HTTP server and static file serving
- Socket.io 4.8.3 - Real-time bidirectional communication between server and clients
- Socket.io-client 4.8.3 - Browser client for Socket.io connections (dev dependency)

**Testing:**
- Vitest 4.0.18 - Test runner and assertion framework
- @vitest/coverage-v8 4.0.18 - Code coverage reporting with V8

**Build/Dev:**
- esbuild 0.27.2 - Fast bundler for converting ES modules to CommonJS
- pkg 5.8.1 - Compiles Node.js applications into standalone executables
- nodemon 3.1.11 - Development server auto-reload
- ESLint 9.39.2 - Code linting (flat config format)
- Husky 9.1.7 - Git hooks management
- lint-staged 16.2.7 - Pre-commit linting

## Key Dependencies

**Critical:**
- express 5.2.1 - Essential for HTTP server and route handling
- socket.io 4.8.3 - Core real-time communication protocol

**Infrastructure:**
- None detected - No database drivers, authentication libraries, or external service SDKs

## Configuration

**Environment:**
- `process.env.PORT` - Server port (default: 3050)
- `process.env.BIOMON_CORS_ORIGIN` - CORS origins for Socket.io clients (default: http://localhost:3051)
- `process.env.NODE_ENV` - Set to "development" by nodemon during dev

**Build:**
- `eslint.config.js` - ESLint v9 flat config with rules for Node.js, Browser, and Test environments
- `vitest.config.js` - Test runner configuration with V8 coverage provider
- `nodemon.json` - Development server watch configuration
- `build.js` - Custom build script for ES module to CommonJS bundling and pkg compilation
- `package.json` - Project manifest with scripts and pkg configuration

**File Storage:**
- Local filesystem only - Sessions saved to `sessions/` directory
- Auto-save location: `sessions/autosave.json`
- Campaign saves: `sessions/campaign-*.json`
- Public assets served from `public/` directory

## Platform Requirements

**Development:**
- Node.js 18+
- npm package manager
- Standard POSIX environment (or Windows with bash/PowerShell for CI)

**Production:**
- Deployable as standalone executable via pkg
- Cross-platform builds: Windows (x64), Linux (x64), macOS (x64)
- No external database or service dependencies required
- Requires `public/` folder alongside executable for UI assets

## Module System

**Format:**
- ES Modules (ESM) throughout codebase
- `"type": "module"` in package.json
- Build process transpiles to CommonJS (dist/server.bundled.cjs) for pkg compatibility

---

*Stack analysis: 2026-01-27*
