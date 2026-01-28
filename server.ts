// BIOMON - Biological Monitoring System
// Alien RPG Crew Vitals & Stress Monitor
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import express from "express";
import { createServer } from "./createServer.js";
import { resolveEntry, getEntryById } from "./responseTables.js";
import {
  clamp,
  clampInt,
  newId,
  ensurePlayerFields,
  hasLiveEffect,
  d6,
  DEFAULT_MAX_HEALTH,
  MAX_HEALTH_CAP,
  MAX_STRESS,
  MAX_RESOLVE,
  ROLL_FEED_CAP,
} from "./utils.js";
import {
  registerPlayerHandlers,
  registerRollHandlers,
  registerEffectHandlers,
  registerConditionHandlers,
  registerSessionHandlers,
  registerExternalHandlers,
} from "./src/handlers/index.js";
import type { SessionDependencies } from "./src/handlers/index.js";
import type {
  GameState,
  RollType,
  AutosaveInfo,
  SaveResult,
  LoadResult,
  CampaignInfo,
  RollEvent,
  LogEntryType,
} from "./src/types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When running in pkg, use current working directory for data storage
// In pkg, __dirname points inside the snapshot which is read-only
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pkg runtime check
const isPackaged = typeof (process as any).pkg !== "undefined";
const dataDir = isPackaged ? process.cwd() : __dirname;

// Create server with CORS configuration from environment variable
// Supports single origin or comma-separated list
const corsOrigin = process.env.BIOMON_CORS_ORIGIN || "http://localhost:3051";
const { app, server, io } = createServer({ corsOrigin });

// Serve static files
// For pkg builds, look for public/ directory next to the executable
// This allows users to customize the UI if needed
const publicDir = isPackaged
  ? path.join(path.dirname(process.execPath), "public")
  : path.join(__dirname, "public");

app.use(express.static(publicDir));
app.get("/", (_req, res) => res.sendFile(path.join(publicDir, "player.html")));
app.get("/gm", (_req, res) => res.sendFile(path.join(publicDir, "gm.html")));

// ============================================================
// PERSISTENCE LAYER (kept inline per research recommendation)
// ============================================================

const SESSIONS_DIR = path.join(dataDir, "sessions");
const AUTOSAVE_PATH = path.join(SESSIONS_DIR, "autosave.json");
const AUTOSAVE_DEBOUNCE_MS = 1000; // Max once per second

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}
const ARCHIVED_DIR = path.join(SESSIONS_DIR, "archived");
if (!fs.existsSync(ARCHIVED_DIR)) {
  fs.mkdirSync(ARCHIVED_DIR, { recursive: true });
}

// In-memory party state
const state: GameState = {
  players: [],
  rollEvents: [],
  missionLog: [],
  metadata: {
    campaignName: null,
    createdAt: null,
    lastSaved: null,
    sessionCount: 0,
  },
};

// Debounced auto-save
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      state.metadata.lastSaved = new Date().toISOString();
      fs.writeFileSync(AUTOSAVE_PATH, JSON.stringify(state, null, 2), "utf8");
      console.log("[AUTOSAVE] State saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[AUTOSAVE] Failed to save:", message);
    }
  }, AUTOSAVE_DEBOUNCE_MS);
}

// Load autosave on startup
function loadAutosave(): AutosaveInfo {
  try {
    if (fs.existsSync(AUTOSAVE_PATH)) {
      const data = fs.readFileSync(AUTOSAVE_PATH, "utf8");
      const loaded = JSON.parse(data) as GameState;

      // Restore state
      state.players = Array.isArray(loaded.players) ? loaded.players : [];
      state.rollEvents = Array.isArray(loaded.rollEvents)
        ? loaded.rollEvents
        : [];
      state.missionLog = Array.isArray(loaded.missionLog)
        ? loaded.missionLog
        : [];
      state.metadata = loaded.metadata || {
        campaignName: null,
        createdAt: null,
        lastSaved: null,
        sessionCount: 0,
      };

      // Backfill player fields for any older saves
      for (const p of state.players) ensurePlayerFields(p);

      const savedAt = state.metadata.lastSaved
        ? new Date(state.metadata.lastSaved).toLocaleString()
        : "unknown time";

      console.log(`[AUTOSAVE] Loaded previous session (saved: ${savedAt})`);
      console.log(
        `[AUTOSAVE] Players: ${state.players.length}, Campaign: ${state.metadata.campaignName || "unnamed"}`,
      );

      return {
        found: true,
        timestamp: state.metadata.lastSaved ?? undefined,
        playerCount: state.players.length,
        campaignName: state.metadata.campaignName ?? undefined,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[AUTOSAVE] Failed to load:", message);
  }

  // Initialize metadata if no save found
  state.metadata = {
    campaignName: null,
    createdAt: new Date().toISOString(),
    lastSaved: null,
    sessionCount: 0,
  };

  return { found: false };
}

// Max log entries to keep
const MAX_LOG_ENTRIES = 100;

function addLogEntry(
  type: string,
  message: string,
  details: string | null = null,
): void {
  const entry = {
    id: newId(),
    timestamp: Date.now(),
    type: type as LogEntryType,
    message,
    details,
  };

  state.missionLog.unshift(entry); // Add to start (newest first)

  if (state.missionLog.length > MAX_LOG_ENTRIES) {
    state.missionLog = state.missionLog.slice(0, MAX_LOG_ENTRIES);
  }
}

// Save campaign with custom name
function saveCampaign(campaignName: string): SaveResult {
  try {
    const safeName = campaignName.replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
    const filename = `campaign-${safeName}.json`;
    const filepath = path.join(SESSIONS_DIR, filename);

    state.metadata.campaignName = campaignName;
    state.metadata.lastSaved = new Date().toISOString();
    state.metadata.sessionCount += 1;

    fs.writeFileSync(filepath, JSON.stringify(state, null, 2), "utf8");
    console.log(`[CAMPAIGN] Saved: ${filename}`);

    return { success: true, filename };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[CAMPAIGN] Save failed:", message);
    return { success: false, error: message };
  }
}

// Load campaign by filename
function loadCampaign(filename: string): LoadResult {
  try {
    const filepath = path.join(SESSIONS_DIR, filename);
    if (!fs.existsSync(filepath)) {
      return { success: false, error: "File not found" };
    }

    const data = fs.readFileSync(filepath, "utf8");
    const loaded = JSON.parse(data) as GameState;

    state.players = Array.isArray(loaded.players) ? loaded.players : [];
    state.rollEvents = Array.isArray(loaded.rollEvents)
      ? loaded.rollEvents
      : [];
    state.missionLog = Array.isArray(loaded.missionLog)
      ? loaded.missionLog
      : [];
    state.metadata = loaded.metadata || {
      campaignName: null,
      createdAt: new Date().toISOString(),
      lastSaved: null,
      sessionCount: 0,
    };

    for (const p of state.players) ensurePlayerFields(p);

    console.log(`[CAMPAIGN] Loaded: ${filename}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[CAMPAIGN] Load failed:", message);
    return { success: false, error: message };
  }
}

// List available campaigns
function listCampaigns(): CampaignInfo[] {
  try {
    const files = fs.readdirSync(SESSIONS_DIR);
    const campaigns = files
      .filter((f) => f.startsWith("campaign-") && f.endsWith(".json"))
      .map((filename) => {
        try {
          const filepath = path.join(SESSIONS_DIR, filename);
          const stats = fs.statSync(filepath);
          const data = JSON.parse(
            fs.readFileSync(filepath, "utf8"),
          ) as GameState;

          return {
            filename,
            campaignName:
              data.metadata?.campaignName ||
              filename.replace("campaign-", "").replace(".json", ""),
            lastSaved: data.metadata?.lastSaved || stats.mtime.toISOString(),
            playerCount: data.players?.length || 0,
            sessionCount: data.metadata?.sessionCount || 0,
          };
        } catch {
          return null;
        }
      })
      .filter((c): c is CampaignInfo => c !== null)
      .sort(
        (a, b) =>
          new Date(b.lastSaved).getTime() - new Date(a.lastSaved).getTime(),
      );

    return campaigns;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[CAMPAIGN] List failed:", message);
    return [];
  }
}

// Clear current session
function clearSession(): void {
  state.players = [];
  state.rollEvents = [];
  state.missionLog = [];
  state.metadata = {
    campaignName: null,
    createdAt: new Date().toISOString(),
    lastSaved: null,
    sessionCount: 0,
  };
  console.log("[SESSION] Cleared");
}

// Load autosave on startup
const autosaveInfo = loadAutosave();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function pushRollEvent(ev: RollEvent): void {
  state.rollEvents.push(ev);
  if (state.rollEvents.length > ROLL_FEED_CAP) {
    state.rollEvents.splice(0, state.rollEvents.length - ROLL_FEED_CAP);
  }
}

function resolveNextHigherDifferentEntry(
  rollType: RollType,
  total: number,
  currentEntryId: string,
): unknown {
  // Uses resolveEntry repeatedly to find the next *different* result.
  // For our tables, increasing total by 1 maps to the next row.
  const startId = String(currentEntryId ?? "");
  let t = clampInt(total, -999, 999);
  for (let i = 0; i < 25; i++) {
    t += 1;
    const next = resolveEntry(rollType, t);
    if (next && String(next.id ?? "") && String(next.id ?? "") !== startId)
      return next;
  }
  return null;
}

function broadcast(): void {
  // Backfill new fields for older in-memory state
  for (const p of state.players) ensurePlayerFields(p);

  // Broadcast to main namespace (GM/Player views)
  io.emit("state", state);

  // Broadcast to external namespace (read-only external tools)
  io.of("/external").emit("state", state);

  scheduleSave(); // Auto-save after every state change
}

// ============================================================
// HANDLER DEPENDENCIES
// ============================================================

const deps: SessionDependencies = {
  broadcast,
  addLogEntry,
  scheduleSave,
  ensurePlayerFields,
  clamp,
  clampInt,
  newId,
  d6,
  hasLiveEffect,
  resolveEntry,
  getEntryById,
  resolveNextHigherDifferentEntry,
  pushRollEvent,
  DEFAULT_MAX_HEALTH,
  MAX_HEALTH_CAP,
  MAX_STRESS,
  MAX_RESOLVE,
  saveCampaign,
  loadCampaign,
  listCampaigns,
  clearSession,
  autosaveInfo,
};

// ============================================================
// CONNECTION HANDLER
// ============================================================

io.on("connection", (socket) => {
  for (const p of state.players) ensurePlayerFields(p);
  socket.emit("state", state);

  // Register all handlers
  registerPlayerHandlers(io, socket, state, deps);
  registerRollHandlers(io, socket, state, deps);
  registerEffectHandlers(io, socket, state, deps);
  registerConditionHandlers(io, socket, state, deps);
  registerSessionHandlers(io, socket, state, deps);
});

// Register external namespace handlers
registerExternalHandlers(io, state, deps);

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 3050;
server.listen(PORT, () => {
  console.log(`Party dashboard running on http://localhost:${PORT}`);
  console.log(`GM panel: http://localhost:${PORT}/gm`);
  if (autosaveInfo.found) {
    console.log(
      `[INFO] Previous session loaded. ${state.players.length} player(s) restored.`,
    );
  }
});
