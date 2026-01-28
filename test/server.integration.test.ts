// Integration tests for Socket.io event handlers
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { createServer, type Server as HttpServer } from "http";
import { Server } from "socket.io";
import express from "express";
import type {
  GameState,
  Player,
  RollEvent,
  Effect,
  LastRollEvent,
  TableEntry,
  ClientToServerEvents,
  ServerToClientEvents,
} from "../src/types/index.js";
import { resolveEntry, getEntryById } from "../responseTables.ts";
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
} from "../utils.ts";

// Typed Socket.IO aliases
type TypedClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

function resolveNextHigherDifferentEntry(
  rollType: "stress" | "panic",
  total: number,
  currentEntryId: string | null
): TableEntry | null {
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

describe("Socket.io integration tests", () => {
  let io: TypedServer;
  let clientSocket: TypedClientSocket;
  let httpServer: HttpServer;
  let state: GameState;

  function pushRollEvent(ev: RollEvent): void {
    state.rollEvents.push(ev);
    if (state.rollEvents.length > ROLL_FEED_CAP) {
      state.rollEvents.splice(0, state.rollEvents.length - ROLL_FEED_CAP);
    }
  }

  function broadcast(): void {
    for (const p of state.players) ensurePlayerFields(p);
    io.emit("state", state);
  }

  beforeAll(async () => {
    state = {
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
    
    const app = express();
    httpServer = createServer(app);
    io = new Server(httpServer);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Server startup timeout"));
      }, 5000);

      httpServer.listen(() => {
        const port = httpServer.address().port;

        // Set up Socket.io server handlers
        io.on("connection", (socket) => {
          for (const p of state.players) ensurePlayerFields(p);
          socket.emit("state", state);

          socket.on("player:add", (payload) => {
            const name = String(payload?.name ?? "").trim().slice(0, 40) || "UNNAMED";
            const maxHealth = clamp(payload?.maxHealth ?? DEFAULT_MAX_HEALTH, 1, MAX_HEALTH_CAP);

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

            if (rollType === "panic" && entry?.persistent && hasLiveEffect(p, entry.id)) {
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
            broadcast();
          });

          socket.on("roll:apply", (payload) => {
            const playerId = String(payload?.playerId ?? "");
            const eventId = String(payload?.eventId ?? "");
            const chosenTableEntryId = payload?.tableEntryId !== undefined ? String(payload.tableEntryId) : null;

            const p = state.players.find((x) => x.id === playerId);
            if (!p) return;
            ensurePlayerFields(p);

            const lr = p.lastRollEvent;
            if (!lr || String(lr.eventId ?? "") !== eventId) return;
            if (lr.applied) return;

            const rollType = lr.type === "panic" ? "panic" : "stress";
            const baseEntry = getEntryById(rollType, lr.tableEntryId) || resolveEntry(rollType, lr.total);

            let entry = baseEntry;
            if (chosenTableEntryId) {
              const allowed = Array.isArray(baseEntry.applyOptions)
                ? baseEntry.applyOptions.some((o) => String(o?.id ?? "") === chosenTableEntryId)
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

            if (rollType === "stress" && entry.persistent && hasLiveEffect(p, entry.id)) {
              p.stress = clampInt(clampInt(p.stress ?? 0, 0, MAX_STRESS) + 1, 0, MAX_STRESS);
              lr.appliedEffectId = null;
              broadcast();
              return;
            }

            if (entry.persistent) {
              const effect = {
                id: newId(),
                type: entry.id,
                label: entry.label,
                severity: clampInt(entry.severity ?? (rollType === "panic" ? 4 : 2), 1, 5),
                createdAt: Date.now(),
                durationType: String(entry.durationType ?? "manual"),
                durationValue: entry.durationValue,
                clearedAt: null,
              };

              p.activeEffects.push(effect);
              lr.appliedEffectId = effect.id;
            } else {
              lr.appliedEffectId = null;
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

            if (p.lastRollEvent && p.lastRollEvent.appliedEffectId === effectId) {
              p.lastRollEvent.applied = false;
              p.lastRollEvent.appliedEffectId = null;
              p.lastRollEvent.appliedTableEntryId = null;
              p.lastRollEvent.appliedTableEntryLabel = null;
              p.lastRollEvent.appliedTableEntryDescription = null;
              p.lastRollEvent.appliedTableEntryStressDelta = null;
            }

            broadcast();
          });
        });

        // Connect client socket
        clientSocket = ioClient(`http://localhost:${port}`);
      
        clientSocket.on("connect", () => {
          clearTimeout(timeout);
          resolve();
        });
      
        clientSocket.on("connect_error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    });
  });

  afterAll(async () => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.close();
    }
    if (io) {
      io.close();
    }
    if (httpServer) {
      return new Promise((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    // Reset state before each test
    state = {
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
  });

  describe("player:add", () => {
    it("should add a new player with default values", async () => {
      clientSocket.emit("player:add", { name: "Test Player" });

      const newState = await new Promise((resolve) => {
        clientSocket.once("state", resolve);
      });

      expect(newState.players).toHaveLength(1);
      expect(newState.players[0].name).toBe("Test Player");
      expect(newState.players[0].health).toBe(5);
      expect(newState.players[0].maxHealth).toBe(5);
      expect(newState.players[0].stress).toBe(0);
      expect(newState.players[0].resolve).toBe(0);
      expect(newState.players[0].activeEffects).toEqual([]);
      expect(newState.players[0].id).toBeTruthy();
    });

    it("should add player with custom values", async () => {
      clientSocket.emit("player:add", {
        name: "Custom Player",
        health: 3,
        maxHealth: 7,
        stress: 5,
        resolve: 2,
      });

      const newState = await new Promise((resolve) => {
        clientSocket.once("state", resolve);
      });

      expect(newState.players).toHaveLength(1);
      const player = newState.players[0];
      expect(player.name).toBe("Custom Player");
      expect(player.health).toBe(3);
      expect(player.maxHealth).toBe(7);
      expect(player.stress).toBe(5);
      expect(player.resolve).toBe(2);
    });

    it("should handle unnamed player", async () => {
      clientSocket.emit("player:add", { name: "" });

      const newState = await new Promise((resolve) => {
        clientSocket.once("state", resolve);
      });

      expect(newState.players[0].name).toBe("UNNAMED");
    });

    it("should truncate long names to 40 characters", async () => {
      const longName = "A".repeat(50);
      clientSocket.emit("player:add", { name: longName });

      const newState = await new Promise((resolve) => {
        clientSocket.once("state", resolve);
      });

      expect(newState.players[0].name).toHaveLength(40);
    });

    it("should clamp health values", async () => {
      clientSocket.emit("player:add", {
        name: "Test",
        health: 20,
        maxHealth: 15,
      });

      const newState = await new Promise((resolve) => {
        clientSocket.once("state", resolve);
      });

      const player = newState.players[0];
      expect(player.maxHealth).toBe(10); // MAX_HEALTH_CAP
      expect(player.health).toBe(10);
    });

    it("should clamp stress to MAX_STRESS", async () => {
      clientSocket.emit("player:add", {
        name: "Test",
        stress: 99,
      });

      const newState = await new Promise((resolve) => {
        clientSocket.once("state", resolve);
      });

      expect(newState.players[0].stress).toBe(10);
    });
  });

  describe("player:remove", () => {
    it("should remove a player by id", async () => {
      state.players.push({
        id: "test-id-123",
        name: "Test Player",
        health: 5,
        maxHealth: 5,
        stress: 0,
        resolve: 0,
        activeEffects: [],
        lastRollEvent: null,
      });

      clientSocket.emit("player:remove", { id: "test-id-123" });

      const newState = await new Promise((resolve) => {
        clientSocket.once("state", resolve);
      });

      expect(newState.players).toHaveLength(0);
    });

    it("should not affect other players", async () => {
      state.players.push(
        {
          id: "player-1",
          name: "Player 1",
          health: 5,
          maxHealth: 5,
          stress: 0,
          resolve: 0,
          activeEffects: [],
          lastRollEvent: null,
        },
        {
          id: "player-2",
          name: "Player 2",
          health: 5,
          maxHealth: 5,
          stress: 0,
          resolve: 0,
          activeEffects: [],
          lastRollEvent: null,
        },
      );

      clientSocket.emit("player:remove", { id: "player-1" });

      const newState = await new Promise((resolve) => {
        clientSocket.once("state", resolve);
      });

      expect(newState.players).toHaveLength(1);
      expect(newState.players[0].id).toBe("player-2");
    });
  });

  describe("player:update", () => {
    beforeEach(() => {
      state.players.push({
        id: "test-player",
        name: "Original Name",
        health: 5,
        maxHealth: 5,
        stress: 3,
        resolve: 1,
        activeEffects: [],
        lastRollEvent: null,
      });
    });

    it("should update player name", async () => {
      clientSocket.emit("player:update", {
        id: "test-player",
        name: "Updated Name",
      });

      const newState = await new Promise((resolve) => {
        clientSocket.once("state", resolve);
      });

      expect(newState.players[0].name).toBe("Updated Name");
    });

    it("should update player health", async () => {
      clientSocket.emit("player:update", {
        id: "test-player",
        health: 2,
      });

      const newState = await new Promise((resolve) => {
        clientSocket.once("state", resolve);
      });

      expect(newState.players[0].health).toBe(2);
    });

    it("should update player stress", async () => {
      clientSocket.emit("player:update", {
        id: "test-player",
        stress: 7,
      });

      const newState = await new Promise((resolve) => {
        clientSocket.once("state", resolve);
      });

      expect(newState.players[0].stress).toBe(7);
    });

    it("should cap health at maxHealth when updating maxHealth", async () => {
      clientSocket.emit("player:update", {
        id: "test-player",
        maxHealth: 3,
      });

      const newState = await new Promise((resolve) => {
        clientSocket.once("state", resolve);
      });

      expect(newState.players[0].maxHealth).toBe(3);
      expect(newState.players[0].health).toBe(3);
    });

    it("should not update non-existent player", async () => {
      const originalState = JSON.parse(JSON.stringify(state));
      clientSocket.emit("player:update", {
        id: "non-existent",
        stress: 10,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(state.players[0].stress).toBe(originalState.players[0].stress);
    });
  });

  describe("party:clear", () => {
    it("should clear all players and roll events", async () => {
      state.players.push({
        id: "player-1",
        name: "Test",
        health: 5,
        maxHealth: 5,
        stress: 0,
        resolve: 0,
        activeEffects: [],
        lastRollEvent: null,
      });
      state.rollEvents.push({ eventId: "test-event" });

      clientSocket.emit("party:clear");

      const newState = await new Promise((resolve) => {
        clientSocket.once("state", resolve);
      });

      expect(newState.players).toHaveLength(0);
      expect(newState.rollEvents).toHaveLength(0);
    });
  });

  describe("roll:trigger", () => {
    beforeEach(() => {
      state.players.push({
        id: "test-player",
        name: "Test Player",
        health: 5,
        maxHealth: 5,
        stress: 3,
        resolve: 1,
        activeEffects: [],
        lastRollEvent: null,
      });
    });

    it("should create a stress roll event", async () => {
      clientSocket.emit("roll:trigger", {
        playerId: "test-player",
        rollType: "stress",
        modifiers: 0,
      });

      const newState = await new Promise((resolve) => {
        clientSocket.once("state", resolve);
      });

      const player = newState.players[0];
      expect(player.lastRollEvent).toBeDefined();
      expect(player.lastRollEvent.type).toBe("stress");
      expect(player.lastRollEvent.die).toBeGreaterThanOrEqual(1);
      expect(player.lastRollEvent.die).toBeLessThanOrEqual(6);
      expect(player.lastRollEvent.stress).toBe(3);
      expect(player.lastRollEvent.resolve).toBe(1);
      expect(newState.rollEvents).toHaveLength(1);
    });

    it("should create a panic roll event", async () => {
      clientSocket.emit("roll:trigger", {
        playerId: "test-player",
        rollType: "panic",
        modifiers: 2,
      });

      const newState = await new Promise((resolve) => {
        clientSocket.once("state", resolve);
      });

      const player = newState.players[0];
      expect(player.lastRollEvent).toBeDefined();
      expect(player.lastRollEvent.type).toBe("panic");
      expect(player.lastRollEvent.modifiers).toBe(2);
    });

    it("should not create roll for non-existent player", async () => {
      clientSocket.emit("roll:trigger", {
        playerId: "non-existent",
        rollType: "stress",
        modifiers: 0,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(state.rollEvents).toHaveLength(0);
    });
  });

  describe("roll:apply", () => {
    beforeEach(() => {
      const player = {
        id: "test-player",
        name: "Test Player",
        health: 5,
        maxHealth: 5,
        stress: 5,
        resolve: 0,
        activeEffects: [],
        lastRollEvent: {
          type: "stress",
          eventId: "test-event-123",
          total: 5,
          die: 5,
          stress: 5,
          resolve: 0,
          modifiers: 0,
          tableEntryId: "stress_frantic",
          tableEntryLabel: "Frantic",
          tableEntryDescription: "Test description",
          tableEntryStressDelta: 0,
          duplicateAdjusted: false,
          duplicateFromId: null,
          duplicateFromLabel: null,
          duplicateNote: null,
          applyOptions: null,
          appliedTableEntryId: null,
          appliedTableEntryLabel: null,
          appliedTableEntryDescription: null,
          appliedTableEntryStressDelta: null,
          timestamp: Date.now(),
          applied: false,
          appliedEffectId: null,
        },
      };
      state.players.push(player);
    });

    it("should apply a roll result and create persistent effect", async () => {
      clientSocket.emit("roll:apply", {
        playerId: "test-player",
        eventId: "test-event-123",
      });

      const newState = await new Promise((resolve) => {
        clientSocket.once("state", resolve);
      });

      const player = newState.players[0];
      expect(player.lastRollEvent.applied).toBe(true);
      expect(player.activeEffects.length).toBeGreaterThan(0);
    });

    it("should not re-apply an already applied roll", async () => {
      state.players[0].lastRollEvent.applied = true;
      const effectCountBefore = state.players[0].activeEffects.length;

      clientSocket.emit("roll:apply", {
        playerId: "test-player",
        eventId: "test-event-123",
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(state.players[0].activeEffects).toHaveLength(effectCountBefore);
    });
  });

  describe("effect:clear", () => {
    beforeEach(() => {
      state.players.push({
        id: "test-player",
        name: "Test Player",
        health: 5,
        maxHealth: 5,
        stress: 3,
        resolve: 1,
        activeEffects: [
          {
            id: "effect-123",
            type: "stress_jumpy",
            label: "Jumpy",
            severity: 2,
            createdAt: Date.now(),
            durationType: "manual",
            clearedAt: null,
          },
        ],
        lastRollEvent: null,
      });
    });

    it("should clear an active effect", async () => {
      clientSocket.emit("effect:clear", {
        playerId: "test-player",
        effectId: "effect-123",
      });

      const newState = await new Promise((resolve) => {
        clientSocket.once("state", resolve);
      });

      const effect = newState.players[0].activeEffects[0];
      expect(effect.clearedAt).toBeTruthy();
    });

    it("should not clear non-existent effect", async () => {
      clientSocket.emit("effect:clear", {
        playerId: "test-player",
        effectId: "non-existent",
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      const effect = state.players[0].activeEffects[0];
      expect(effect.clearedAt).toBeNull();
    });
  });
});
