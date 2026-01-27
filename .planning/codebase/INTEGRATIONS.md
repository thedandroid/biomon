# External Integrations

**Analysis Date:** 2026-01-27

## APIs & External Services

**Socket.io Real-Time API:**
- External Tools Integration - Read-only access for complementary applications
  - SDK/Client: socket.io-client 4.8.3
  - Connection point: `/external` namespace (read-only)
  - Default origin: http://localhost:3051
  - Config env var: `BIOMON_CORS_ORIGIN` (supports single origin or comma-separated list)

**Use Cases for External Integration:**
- Initiative trackers that need turn-skipping effect information
- Condition monitors displaying active panic/stress effects
- Combat managers tracking player status
- Campaign logging tools
- Custom dashboards

## Data Storage

**Databases:**
- None - No database system integrated

**File Storage:**
- Local filesystem only
  - Auto-save location: `sessions/autosave.json` (debounced every 1000ms)
  - Campaign saves: `sessions/campaign-*.json` (user-named)
  - Archived campaigns: `sessions/archived/` directory
  - Public UI assets: `public/` directory

**Caching:**
- In-memory state only
  - Roll event feed: Capped at 200 entries (`ROLL_FEED_CAP`)
  - Mission log: Capped at 100 entries (`MAX_LOG_ENTRIES`)

## Authentication & Identity

**Auth Provider:**
- None - No authentication system
- CORS-based isolation via configurable origin whitelist
- Access levels:
  - Default namespace (`/`): Full read/write access (intended for GM/Player UIs)
  - `/external` namespace: Read-only access (for external tools)

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Console logging only
  - Autosave status: `[AUTOSAVE]` prefix
  - Campaign operations: `[CAMPAIGN]` prefix
  - External connections: `[EXTERNAL]` prefix
  - Session management: `[SESSION]` prefix

## CI/CD & Deployment

**Hosting:**
- Self-hosted (standalone executables)
- No cloud platform integration

**CI Pipeline:**
- GitHub Actions
- Workflow: `.github/workflows/release.yml`
- Triggers: On GitHub release creation or manual dispatch
- Builds: Windows (node18-win-x64), macOS (node18-macos-x64), Linux (node18-linux-x64)
- Pipeline steps:
  1. Checkout code
  2. Setup Node.js 18 with npm cache
  3. Install dependencies (npm ci)
  4. Run linter (npm run lint)
  5. Run tests (npm test)
  6. Build executable (node build.js && pkg)
  7. Package with public folder (zip archives)
  8. Upload to GitHub release

## Environment Configuration

**Required env vars:**
- `PORT` - Server port (optional, default: 3050)
- `BIOMON_CORS_ORIGIN` - CORS origins (optional, default: http://localhost:3051)
- `NODE_ENV` - Set to "development" by nodemon during dev (optional)

**Secrets location:**
- No secrets management system detected
- All configuration via environment variables or `.env` file (see `.env.example`)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## Socket.io Event Protocol

**Broadcast Events (Server → Clients):**
- `state` - Full application state broadcast on connection and after any mutation
- `session:autosave:info` - Initial autosave status on connection

**Mutation Events (Client → Server):**
- Player management: `player:add`, `player:remove`, `player:update`
- Roll system: `roll:trigger`, `roll:apply`, `roll:applyStressDelta`, `roll:undo`, `roll:clear`
- Effects: `effect:clear`
- Conditions: `condition:toggle`
- Session: `session:save`, `session:load`, `session:list`, `session:clear`, `session:export`, `session:import`

**External Namespace (`/external`):**
- Receives: `state` broadcasts only
- Cannot emit: Mutation events (read-only enforcement)

## Cross-Cutting Integration Notes

**CORS Configuration:**
- Configured in `createServer.js` via `corsOrigin` option
- Parsed from `BIOMON_CORS_ORIGIN` env var in `server.js`
- Supports single origin string or comma-separated list
- Methods allowed: GET, POST
- Credentials: enabled

**State Broadcasting:**
- Auto-broadcast to both default and `/external` namespaces
- Triggered after any state mutation
- Includes: players, rollEvents, missionLog, metadata
- External tools receive full state snapshot on each broadcast

**Extensibility Pattern:**
- Socket.io namespaces provide integration boundaries
- Default namespace: Internal game logic (GM/Player)
- `/external` namespace: Read-only API for tools
- New integrations should follow this namespace pattern

---

*Integration audit: 2026-01-27*
