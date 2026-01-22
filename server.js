// BIOMON - Biological Monitoring System
// Alien RPG Crew Vitals & Stress Monitor
// Run: npm i express socket.io
// Start: node server.js
// GM:     http://localhost:3050/gm
// Players:http://localhost:3050/
const path = require("path");
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

// In-memory party state
const state = {
  players: [
    // { id, name, health, maxHealth, stress: 0..10 }
  ],
  rollEvents: [],
};

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
});

const PORT = process.env.PORT || 3050;
server.listen(PORT, () => {
  console.log(`Party dashboard running on http://localhost:${PORT}`);
  console.log(`GM panel: http://localhost:${PORT}/gm`);
});
