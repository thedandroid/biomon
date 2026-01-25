# BIOMON External Integration Guide

This guide provides technical documentation for integrating external applications with BIOMON via Socket.io to access real-time crew vitals, stress levels, and active effects.

## Overview

BIOMON broadcasts its complete application state to connected Socket.io clients whenever any change occurs (player added/removed, health/stress updated, effects applied/cleared, etc.). External tools can connect to BIOMON's Socket.io server to receive these real-time updates and build complementary functionality like initiative tracking, condition monitoring, or combat management.

**Use Cases**:
- Initiative trackers that need to know about turn-skipping effects
- Condition monitors displaying active panic/stress effects
- Combat managers tracking player status
- Campaign logging tools
- Custom dashboards

## Connection Setup

### Prerequisites

Install Socket.io client in your external application:

```bash
npm install socket.io-client
```

### Configuration

By default, BIOMON allows Socket.io connections from `http://localhost:3051`. To configure different origins, set the `BIOMON_CORS_ORIGIN` environment variable when starting BIOMON:

```bash
# Single origin
BIOMON_CORS_ORIGIN=http://localhost:3051 node server.js

# Multiple origins (comma-separated)
BIOMON_CORS_ORIGIN=http://localhost:3051,http://localhost:3052 node server.js
```

### Client Connection

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:3050", {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity
});

socket.on("connect", () => {
  console.log("Connected to BIOMON");
});

socket.on("state", (state) => {
  console.log("Received state update:", state);
  // Process state update in your application
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected from BIOMON:", reason);
});

socket.on("connect_error", (error) => {
  console.error("Connection error:", error.message);
});
```

## Events

### `state` (Broadcast)

Emitted to all connected clients whenever any state change occurs. This is the primary event for external integrations.

**Trigger conditions**:
- Player added or removed
- Player health, stress, or resolve changed
- Effects applied or cleared
- Roll events triggered
- Session loaded or cleared

**Payload structure**:
```javascript
{
  players: [
    {
      id: string,              // Unique player identifier
      name: string,            // Player/character name
      health: number,          // Current health (0 to maxHealth)
      maxHealth: number,       // Maximum health (1-10)
      stress: number,          // Current stress level (0-10)
      resolve: number,         // Resolve points (0-10)
      activeEffects: [...],    // Array of effect objects (see below)
      lastRollEvent: {...}     // Most recent roll event or null
    }
  ],
  rollEvents: [...],           // Array of recent roll events (max 200)
  missionLog: [...],           // Array of mission log entries (max 100)
  metadata: {
    campaignName: string | null,
    createdAt: string | null,  // ISO timestamp
    lastSaved: string | null,  // ISO timestamp
    sessionCount: number
  }
}
```

## Data Structures

### Player Object

```javascript
{
  id: "1234567890-abc123",     // Unique identifier
  name: "Ellen Ripley",         // Character name
  health: 3,                    // Current health
  maxHealth: 5,                 // Maximum health
  stress: 7,                    // Stress level (0-10)
  resolve: 2,                   // Resolve points (0-10)
  activeEffects: [
    {
      id: "effect-id",
      type: "panic_hesitant",
      label: "Hesitant",
      severity: 3,
      createdAt: 1234567890,
      durationType: "manual",
      durationValue: null,
      clearedAt: null
    }
  ],
  lastRollEvent: {
    type: "panic",
    eventId: "event-id",
    total: 8,
    die: 3,
    stress: 7,
    resolve: 2,
    modifiers: 0,
    tableEntryId: "panic_hesitant",
    tableEntryLabel: "Hesitant",
    tableEntryDescription: "...",
    // ... additional fields
  }
}
```

### Effect Object

```javascript
{
  id: string,                  // Unique effect instance identifier
  type: string,                // Effect type ID (e.g., "panic_hesitant", "stress_jumpy")
  label: string,               // Human-readable label
  severity: number,            // Severity level (1-5)
  createdAt: number,           // Unix timestamp when applied
  durationType: string,        // "manual", "turn", "round"
  durationValue: number | null,// Duration value (if applicable)
  clearedAt: number | null     // null = active, timestamp = cleared
}
```

**Active vs Cleared Effects**: Effects with `clearedAt === null` are active. Effects with a timestamp in `clearedAt` have been removed but remain in history.

### Initiative-Relevant Effect Types

These effects from the Panic table directly impact initiative or turn order:

| Effect Type | Label | Impact |
|-------------|-------|--------|
| `panic_hesitant` | Hesitant | Must draw initiative card #10. If multiple PCs are Hesitant, draw highest cards randomly. |
| `panic_freeze` | Freeze | Loses next turn, cannot perform interrupt actions. |
| `panic_seek_cover` | Seek Cover | Loses next turn after seeking cover, cannot perform interrupt actions. |
| `panic_scream` | Scream | Loses next turn, cannot perform interrupt actions. |
| `panic_flee` | Flee | Must spend all actions fleeing on subsequent turns until safe. |
| `panic_frenzy` | Frenzy | Must attack nearest person/creature on subsequent turns. |
| `panic_catatonic` | Catatonic | Cannot move or act until panic stops. |

**Example: Checking for Hesitant effect**:
```javascript
socket.on("state", (state) => {
  state.players.forEach(player => {
    const hasHesitant = player.activeEffects.some(
      effect => effect.type === "panic_hesitant" && effect.clearedAt === null
    );
    
    if (hasHesitant) {
      assignInitiativeCard(player.id, 10);
    }
  });
});
```

### Stress Effect Types

Stress effects generally don't impact turn order but may affect action efficiency:

| Effect Type | Label | Impact |
|-------------|-------|--------|
| `stress_jumpy` | Jumpy | +2 stress when pushing rolls instead of +1 |
| `stress_tunnel_vision` | Tunnel Vision | Wits-based rolls get -2 dice |
| `stress_aggravated` | Aggravated | Empathy-based rolls get -2 dice |
| `stress_shakes` | Shakes | Agility-based rolls get -2 dice |
| `stress_frantic` | Frantic | Strength-based rolls get -2 dice |
| `stress_deflated` | Deflated | Cannot push skill rolls |
| `stress_mess_up` | Mess Up | Action fails and +1 stress (immediate) |

### Condition Types

Manual conditions toggleable by the GM:

| Effect Type | Label | Impact |
|-------------|-------|--------|
| `condition_fatigue` | FATIGUE | -2 to all rolls (Alien RPG core rule) |

## Connection Management

### Reconnection Handling

Socket.io client automatically handles reconnection. On reconnect, BIOMON will immediately emit the current `state`:

```javascript
socket.on("connect", () => {
  // Connection established or re-established
  // State will be emitted shortly
});

socket.on("disconnect", (reason) => {
  if (reason === "io server disconnect") {
    // Server forcibly disconnected (e.g., CORS rejection)
    // Manual reconnection needed
    socket.connect();
  }
  // Otherwise, automatic reconnection will be attempted
});
```

### Error Handling

```javascript
socket.on("connect_error", (error) => {
  // Common causes:
  // - BIOMON not running
  // - CORS origin not allowed
  // - Network issue
  console.error("Failed to connect:", error.message);
});
```

### Multiple Clients

BIOMON supports multiple simultaneous external connections. All connected clients receive the same `state` broadcasts.

## Example: Initiative Tracker

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:3050", {
  reconnection: true,
  reconnectionDelay: 1000
});

let players = [];
let initiativeCards = new Map(); // playerId -> card number

socket.on("state", (state) => {
  players = state.players;
  updateInitiativeBoard();
});

function updateInitiativeBoard() {
  players.forEach(player => {
    // Check for Hesitant effect (must have card #10)
    const hasHesitant = player.activeEffects.some(
      e => e.type === "panic_hesitant" && !e.clearedAt
    );
    
    if (hasHesitant) {
      initiativeCards.set(player.id, 10);
    }
    
    // Check for turn-skipping effects
    const skipTurnEffects = [
      "panic_freeze",
      "panic_seek_cover",
      "panic_scream"
    ];
    
    const shouldSkipTurn = player.activeEffects.some(
      e => !e.clearedAt && skipTurnEffects.includes(e.type)
    );
    
    if (shouldSkipTurn) {
      markPlayerAsSkippingTurn(player.id);
    }
    
    // Check for forced action effects
    const hasFlee = player.activeEffects.some(
      e => e.type === "panic_flee" && !e.clearedAt
    );
    const hasFrenzy = player.activeEffects.some(
      e => e.type === "panic_frenzy" && !e.clearedAt
    );
    const hasCatatonic = player.activeEffects.some(
      e => e.type === "panic_catatonic" && !e.clearedAt
    );
    
    if (hasFlee) markPlayerAction(player.id, "MUST FLEE");
    if (hasFrenzy) markPlayerAction(player.id, "MUST ATTACK");
    if (hasCatatonic) markPlayerAction(player.id, "INCAPACITATED");
  });
  
  renderInitiativeUI();
}

function markPlayerAsSkippingTurn(playerId) {
  // Your UI logic here
}

function markPlayerAction(playerId, action) {
  // Your UI logic here
}

function renderInitiativeUI() {
  // Your rendering logic here
}
```

## Troubleshooting

### CORS Error: "blocked by CORS policy"

**Cause**: Your external tool's origin is not in BIOMON's allowed list.

**Solution**: Set `BIOMON_CORS_ORIGIN` when starting BIOMON:
```bash
BIOMON_CORS_ORIGIN=http://localhost:3051 node server.js
```

### Connection Refused / ECONNREFUSED

**Cause**: BIOMON is not running or is running on a different port.

**Solution**:
1. Verify BIOMON is running: `http://localhost:3050/gm` should load
2. Check if port is correct (default: 3050, configurable via `PORT` env var)
3. Ensure no firewall is blocking the connection

### No State Updates Received

**Cause**: Not listening to `state` event or connection not established.

**Solution**:
1. Verify `socket.on("connect")` fires
2. Ensure `socket.on("state", ...)` listener is registered
3. Check browser/terminal console for errors
4. Test connection by making changes in BIOMON GM panel (add player, change health)

### Stale Data on Initial Connection

**Cause**: No state update has occurred since connection.

**Solution**: BIOMON emits `state` immediately on connection. If you're not receiving it:
1. Check that your `state` event listener is registered before `connect` event
2. Verify the connection is fully established (`socket.connected === true`)

### Multiple Origins Not Working

**Cause**: Incorrect format for multiple origins.

**Solution**: Use comma-separated list with no spaces:
```bash
# Correct:
BIOMON_CORS_ORIGIN=http://localhost:3051,http://localhost:3052

# Incorrect:
BIOMON_CORS_ORIGIN="http://localhost:3051, http://localhost:3052"
```

## Security Notes

- External clients have **read-only** access via `state` broadcasts
- External clients **cannot emit events** that modify BIOMON state
- CORS restricts which origins can connect
- For LAN/remote access, configure CORS appropriately and use firewall rules
- This system is designed for local development and small gaming groups, not production environments

## Technical Notes

- **No persistence in external tools**: BIOMON is the single source of truth. If BIOMON restarts, external tools should resync from the new `state` broadcast.
- **Event frequency**: `state` is broadcast on every change. For high-frequency updates, consider debouncing in your external tool.
- **Buffer size**: `rollEvents` is capped at 200 entries, `missionLog` at 100 entries.
- **Autosave**: BIOMON autosaves to `sessions/autosave.json` every 1 second after changes. External tools should not read this file directly; use Socket.io instead.

## API Stability

The `state` event payload structure is considered stable. Any breaking changes will be noted in BIOMON release notes.

**Versioning**: BIOMON does not currently expose a version number via Socket.io. Track the version from BIOMON's `package.json` if needed.
