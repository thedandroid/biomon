// BIOMON - Biological Monitoring System
// Alien RPG Crew Vitals & Stress Monitor
// Run: npm i express socket.io
// Start: node server.js
// GM:     http://localhost:3050/gm
// Players:http://localhost:3050/
const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { resolveEntry, getEntryById } = require("./responseTables");
const {
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
} = require("./utils");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "player.html")),
);
app.get("/gm", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "gm.html")),
);

// ============================================================
// PERSISTENCE LAYER
// ============================================================

const SESSIONS_DIR = path.join(__dirname, "sessions");
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
const state = {
  players: [
    // { id, name, health, maxHealth, stress: 0..10 }
  ],
  rollEvents: [],
  metadata: {
    campaignName: null,
    createdAt: null,
    lastSaved: null,
    sessionCount: 0,
  },
};

// Debounced auto-save
let saveTimeout = null;
function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      state.metadata.lastSaved = new Date().toISOString();
      fs.writeFileSync(AUTOSAVE_PATH, JSON.stringify(state, null, 2), "utf8");
      console.log("[AUTOSAVE] State saved");
    } catch (err) {
      console.error("[AUTOSAVE] Failed to save:", err.message);
    }
  }, AUTOSAVE_DEBOUNCE_MS);
}

// Load autosave on startup
function loadAutosave() {
  try {
    if (fs.existsSync(AUTOSAVE_PATH)) {
      const data = fs.readFileSync(AUTOSAVE_PATH, "utf8");
      const loaded = JSON.parse(data);
      
      // Restore state
      state.players = Array.isArray(loaded.players) ? loaded.players : [];
      state.rollEvents = Array.isArray(loaded.rollEvents) ? loaded.rollEvents : [];
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
      console.log(`[AUTOSAVE] Players: ${state.players.length}, Campaign: ${state.metadata.campaignName || "unnamed"}`);
      
      return {
        found: true,
        timestamp: state.metadata.lastSaved,
        playerCount: state.players.length,
        campaignName: state.metadata.campaignName,
      };
    }
  } catch (err) {
    console.error("[AUTOSAVE] Failed to load:", err.message);
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

// Save campaign with custom name
function saveCampaign(campaignName) {
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
    console.error("[CAMPAIGN] Save failed:", err.message);
    return { success: false, error: err.message };
  }
}

// Load campaign by filename
function loadCampaign(filename) {
  try {
    const filepath = path.join(SESSIONS_DIR, filename);
    if (!fs.existsSync(filepath)) {
      return { success: false, error: "File not found" };
    }
    
    const data = fs.readFileSync(filepath, "utf8");
    const loaded = JSON.parse(data);
    
    state.players = Array.isArray(loaded.players) ? loaded.players : [];
    state.rollEvents = Array.isArray(loaded.rollEvents) ? loaded.rollEvents : [];
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
    console.error("[CAMPAIGN] Load failed:", err.message);
    return { success: false, error: err.message };
  }
}

// List available campaigns
function listCampaigns() {
  try {
    const files = fs.readdirSync(SESSIONS_DIR);
    const campaigns = files
      .filter(f => f.startsWith("campaign-") && f.endsWith(".json"))
      .map(filename => {
        try {
          const filepath = path.join(SESSIONS_DIR, filename);
          const stats = fs.statSync(filepath);
          const data = JSON.parse(fs.readFileSync(filepath, "utf8"));
          
          return {
            filename,
            campaignName: data.metadata?.campaignName || filename.replace("campaign-", "").replace(".json", ""),
            lastSaved: data.metadata?.lastSaved || stats.mtime.toISOString(),
            playerCount: data.players?.length || 0,
            sessionCount: data.metadata?.sessionCount || 0,
          };
        } catch (_err) {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.lastSaved) - new Date(a.lastSaved));
    
    return campaigns;
  } catch (err) {
    console.error("[CAMPAIGN] List failed:", err.message);
    return [];
  }
}

// Clear current session
function clearSession() {
  state.players = [];
  state.rollEvents = [];
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

function pushRollEvent(ev) {
  state.rollEvents.push(ev);
  if (state.rollEvents.length > ROLL_FEED_CAP) {
    state.rollEvents.splice(0, state.rollEvents.length - ROLL_FEED_CAP);
  }
}

function resolveNextHigherDifferentEntry(rollType, total, currentEntryId) {
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

function broadcast() {
  // Backfill new fields for older in-memory state
  for (const p of state.players) ensurePlayerFields(p);
  io.emit("state", state);
  scheduleSave(); // Auto-save after every state change
}

io.on("connection", (socket) => {
  for (const p of state.players) ensurePlayerFields(p);
  socket.emit("state", state);

  socket.on("player:add", (payload) => {
    const name =
      String(payload?.name ?? "")
        .trim()
        .slice(0, 40) || "UNNAMED";
    const maxHealth = clamp(
      payload?.maxHealth ?? DEFAULT_MAX_HEALTH,
      1,
      MAX_HEALTH_CAP,
    );

    state.players.push({
      id: newId(),
      name,
      maxHealth,
      health: clamp(payload?.health ?? maxHealth, 0, maxHealth),
      stress: clamp(payload?.stress ?? 0, 0, MAX_STRESS),
      resolve: clamp(payload?.resolve ?? 0, 0, MAX_RESOLVE),
      activeEffects: [],
      lastRollEvent: null,
    });

    broadcast();
  });

  socket.on("player:remove", (payload) => {
    const id = String(payload?.id ?? "");
    state.players = state.players.filter((p) => p.id !== id);
    broadcast();
  });

  socket.on("player:update", (payload) => {
    const id = String(payload?.id ?? "");
    const p = state.players.find((x) => x.id === id);
    if (!p) return;

    ensurePlayerFields(p);

    if (payload?.name !== undefined)
      p.name = String(payload.name).trim().slice(0, 40) || p.name;

    if (payload?.maxHealth !== undefined) {
      p.maxHealth = clamp(payload.maxHealth, 1, MAX_HEALTH_CAP);
      if (p.health > p.maxHealth) p.health = p.maxHealth;
    }

    if (payload?.health !== undefined) {
      const maxH = clamp(p.maxHealth ?? DEFAULT_MAX_HEALTH, 1, MAX_HEALTH_CAP);
      p.health = clamp(payload.health, 0, maxH);
    }

    if (payload?.stress !== undefined)
      p.stress = clamp(payload.stress, 0, MAX_STRESS);

    if (payload?.resolve !== undefined)
      p.resolve = clamp(payload.resolve, 0, MAX_RESOLVE);

    broadcast();
  });

  socket.on("party:clear", () => {
    state.players = [];
    state.rollEvents = [];
    broadcast();
  });

  socket.on("roll:trigger", (payload) => {
    const playerId = String(payload?.playerId ?? "");
    const rollType = payload?.rollType === "panic" ? "panic" : "stress";
    const modifiers = clampInt(payload?.modifiers ?? 0, -10, 10);

    const p = state.players.find((x) => x.id === playerId);
    if (!p) return;
    ensurePlayerFields(p);

    const die = d6();
    const stress = clampInt(p.stress ?? 0, 0, MAX_STRESS);
    const resolve = clampInt(p.resolve ?? 0, 0, MAX_RESOLVE);
    const total = die + stress - resolve + modifiers;

    let entry = resolveEntry(rollType, total);
    let duplicateAdjusted = false;
    let duplicateNote = null;
    let duplicateFromId = null;
    let duplicateFromLabel = null;

    // Alien RPG rule: if you roll a duplicate Panic response that's already applied,
    // you instead use the next highest response on the panic table.
    if (
      rollType === "panic" &&
      entry?.persistent &&
      hasLiveEffect(p, entry.id)
    ) {
      const bumped = resolveNextHigherDifferentEntry("panic", total, entry.id);
      if (bumped) {
        duplicateAdjusted = true;
        duplicateFromId = String(entry.id);
        duplicateFromLabel = String(entry.label || entry.id);
        entry = bumped;
        duplicateNote = `Duplicate result (${duplicateFromLabel}) already active — showing next higher response.`;
      }
    }

    const stressDelta = clampInt(entry.stressDelta ?? 0, -10, 10);
    const applyOptions = Array.isArray(entry.applyOptions)
      ? entry.applyOptions
        .map((o) => {
          const id = String(o?.id ?? "");
          const ent = getEntryById(rollType, id);
          if (!ent) return null;
          return {
            tableEntryId: ent.id,
            label: String(o?.label ?? ent.label),
          };
        })
        .filter(Boolean)
      : null;
    const timestamp = Date.now();
    const eventId = newId();

    const rollEvent = {
      eventId,
      playerId,
      rollType,
      die,
      stress,
      resolve,
      modifiers,
      total,
      tableEntryId: entry.id,
      label: entry.label,
      description: entry.description,
      stressDelta,
      duplicateAdjusted,
      duplicateFromId,
      duplicateFromLabel,
      timestamp,
    };

    p.lastRollEvent = {
      type: rollType,
      eventId,
      total,
      die,
      stress,
      resolve,
      modifiers,
      tableEntryId: entry.id,
      tableEntryLabel: entry.label,
      tableEntryDescription: entry.description,
      tableEntryStressDelta: stressDelta,
      duplicateAdjusted,
      duplicateFromId,
      duplicateFromLabel,
      duplicateNote,
      applyOptions,
      appliedTableEntryId: null,
      appliedTableEntryLabel: null,
      appliedTableEntryDescription: null,
      appliedTableEntryStressDelta: null,
      timestamp,
      applied: false,
      appliedEffectId: null,
    };

    pushRollEvent(rollEvent);
    console.log(
      `[ROLL:${rollType.toUpperCase()}] ${p.name} d6=${die} stress=${stress} resolve=${resolve} mod=${modifiers} => total=${total} (${entry.id})`,
    );
    broadcast();
  });

  socket.on("roll:apply", (payload) => {
    const playerId = String(payload?.playerId ?? "");
    const eventId = String(payload?.eventId ?? "");
    const chosenTableEntryId =
      payload?.tableEntryId !== undefined ? String(payload.tableEntryId) : null;

    const p = state.players.find((x) => x.id === playerId);
    if (!p) return;
    ensurePlayerFields(p);

    const lr = p.lastRollEvent;
    if (!lr || String(lr.eventId ?? "") !== eventId) return;
    if (lr.applied) return;

    const rollType = lr.type === "panic" ? "panic" : "stress";
    const baseEntry =
      getEntryById(rollType, lr.tableEntryId) ||
      resolveEntry(rollType, lr.total);

    let entry = baseEntry;
    if (chosenTableEntryId) {
      const allowed = Array.isArray(baseEntry.applyOptions)
        ? baseEntry.applyOptions.some(
          (o) => String(o?.id ?? "") === chosenTableEntryId,
        )
        : false;
      if (allowed) {
        const picked = getEntryById(rollType, chosenTableEntryId);
        if (picked) entry = picked;
      }
    }

    lr.applied = true;
    lr.appliedTableEntryId = entry.id;
    lr.appliedTableEntryLabel = entry.label;
    lr.appliedTableEntryDescription = entry.description;
    lr.appliedTableEntryStressDelta = clampInt(entry.stressDelta ?? 0, -10, 10);

    // Alien RPG rule: if you roll a duplicate Stress response that is already applied,
    // you instead gain +1 stress level (GM still chooses to apply, not automatic).
    if (
      rollType === "stress" &&
      entry.persistent &&
      hasLiveEffect(p, entry.id)
    ) {
      p.stress = clampInt(
        clampInt(p.stress ?? 0, 0, MAX_STRESS) + 1,
        0,
        MAX_STRESS,
      );
      lr.appliedEffectId = null;
      console.log(
        `[ROLL:APPLY] ${p.name} stress duplicate=${entry.id} -> stress+1 (stress=${p.stress})`,
      );
      broadcast();
      return;
    }

    if (entry.persistent) {
      const effect = {
        id: newId(),
        type: entry.id,
        label: entry.label,
        severity: clampInt(
          entry.severity ?? (rollType === "panic" ? 4 : 2),
          1,
          5,
        ),
        createdAt: Date.now(),
        durationType: String(entry.durationType ?? "manual"),
        durationValue: entry.durationValue,
        clearedAt: null,
      };

      p.activeEffects.push(effect);
      lr.appliedEffectId = effect.id;
      console.log(
        `[ROLL:APPLY] ${p.name} ${rollType} -> effect=${effect.type} (${effect.id})`,
      );
    } else {
      lr.appliedEffectId = null;
      console.log(`[ROLL:APPLY] ${p.name} ${rollType} (no persistent effect)`);
    }

    broadcast();
  });

  socket.on("roll:undo", (payload) => {
    const playerId = String(payload?.playerId ?? "");
    const eventId = String(payload?.eventId ?? "");

    const p = state.players.find((x) => x.id === playerId);
    if (!p) return;
    ensurePlayerFields(p);

    const lr = p.lastRollEvent;
    if (!lr || String(lr.eventId ?? "") !== eventId) return;
    if (!lr.applied) return;

    const hadEffect = Boolean(lr.appliedEffectId);

    // If Apply created a persistent effect, clear it; otherwise just revert the applied flag.
    if (lr.appliedEffectId) {
      const eff = p.activeEffects.find((e) => e.id === lr.appliedEffectId);
      if (eff && !eff.clearedAt) eff.clearedAt = Date.now();
    }

    lr.applied = false;
    lr.appliedEffectId = null;
    lr.appliedTableEntryId = null;
    lr.appliedTableEntryLabel = null;
    lr.appliedTableEntryDescription = null;
    lr.appliedTableEntryStressDelta = null;

    console.log(
      `[ROLL:UNDO] ${p.name} event=${eventId} (effectCleared=${hadEffect})`,
    );
    broadcast();
  });

  socket.on("effect:clear", (payload) => {
    const playerId = String(payload?.playerId ?? "");
    const effectId = String(payload?.effectId ?? "");

    const p = state.players.find((x) => x.id === playerId);
    if (!p) return;
    ensurePlayerFields(p);

    const eff = p.activeEffects.find((e) => e.id === effectId);
    if (!eff) return;
    if (!eff.clearedAt) eff.clearedAt = Date.now();

    // If this effect was attached to the last roll event, un-apply that roll.
    if (p.lastRollEvent && p.lastRollEvent.appliedEffectId === effectId) {
      p.lastRollEvent.applied = false;
      p.lastRollEvent.appliedEffectId = null;
      p.lastRollEvent.appliedTableEntryId = null;
      p.lastRollEvent.appliedTableEntryLabel = null;
      p.lastRollEvent.appliedTableEntryDescription = null;
      p.lastRollEvent.appliedTableEntryStressDelta = null;
    }

    console.log(`[EFFECT:CLEAR] ${p.name} effect=${eff.type} (${eff.id})`);
    broadcast();
  });

  // ============================================================
  // SESSION MANAGEMENT
  // ============================================================

  socket.on("session:save", (payload) => {
    const campaignName = String(payload?.campaignName || "").trim() || "unnamed";
    const result = saveCampaign(campaignName);
    socket.emit("session:save:result", result);
    if (result.success) broadcast();
  });

  socket.on("session:load", (payload) => {
    const filename = String(payload?.filename || "").trim();
    if (!filename) {
      socket.emit("session:load:result", { success: false, error: "No filename provided" });
      return;
    }
    const result = loadCampaign(filename);
    socket.emit("session:load:result", result);
    if (result.success) broadcast();
  });

  socket.on("session:list", () => {
    const campaigns = listCampaigns();
    socket.emit("session:list:result", campaigns);
  });

  socket.on("session:clear", () => {
    clearSession();
    broadcast();
  });

  socket.on("session:export", () => {
    socket.emit("session:export:result", state);
  });

  socket.on("session:import", (payload) => {
    try {
      if (!payload || typeof payload !== "object") {
        socket.emit("session:import:result", { success: false, error: "Invalid data" });
        return;
      }
      
      state.players = Array.isArray(payload.players) ? payload.players : [];
      state.rollEvents = Array.isArray(payload.rollEvents) ? payload.rollEvents : [];
      state.metadata = payload.metadata || {
        campaignName: null,
        createdAt: new Date().toISOString(),
        lastSaved: null,
        sessionCount: 0,
      };
      
      for (const p of state.players) ensurePlayerFields(p);
      
      socket.emit("session:import:result", { success: true });
      broadcast();
    } catch (err) {
      socket.emit("session:import:result", { success: false, error: err.message });
    }
  });

  // Send autosave info to GM on connection
  socket.emit("session:autosave:info", autosaveInfo);
});

const PORT = process.env.PORT || 3050;
server.listen(PORT, () => {
  console.log(`Party dashboard running on http://localhost:${PORT}`);
  console.log(`GM panel: http://localhost:${PORT}/gm`);
  if (autosaveInfo.found) {
    console.log(`[INFO] Previous session loaded. ${state.players.length} player(s) restored.`);
  }
});
