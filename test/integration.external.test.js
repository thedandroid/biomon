import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { io as Client } from "socket.io-client";
import express from "express";
import http from "http";
import { Server } from "socket.io";

describe("External Integration via Socket.io", () => {
  let app;
  let server;
  let io;
  let port;
  let serverUrl;
  let externalClient;
  const activeClients = []; // Track all clients for cleanup

  // Helper function to track clients for cleanup
  const trackClient = (client) => {
    activeClients.push(client);
    return client;
  };

  const state = {
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

  beforeAll((done) => {
    // Create a minimal test server with CORS enabled
    app = express();
    server = http.createServer(app);
    io = new Server(server, {
      cors: {
        origin: "http://localhost:3051",
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    // Find available port
    server.listen(0, () => {
      port = server.address().port;
      serverUrl = `http://localhost:${port}`;
      
      // Setup Socket.io handlers
      io.on("connection", (socket) => {
        // Emit initial state on connection
        socket.emit("state", state);

        // Handle player:add for testing state updates
        socket.on("player:add", (payload) => {
          const newPlayer = {
            id: `${Date.now()}-test`,
            name: payload?.name || "Test Player",
            health: payload?.health ?? 5,
            maxHealth: payload?.maxHealth ?? 5,
            stress: payload?.stress ?? 0,
            resolve: payload?.resolve ?? 0,
            activeEffects: [],
            lastRollEvent: null,
          };
          state.players.push(newPlayer);
          // Broadcast to both namespaces
          io.emit("state", state);
          io.of("/external").emit("state", state);
        });

        // Handle player:update for testing effect changes
        socket.on("player:update", (payload) => {
          const player = state.players.find(p => p.id === payload.id);
          if (player && payload.activeEffects) {
            player.activeEffects = payload.activeEffects;
            // Broadcast to both namespaces
            io.emit("state", state);
            io.of("/external").emit("state", state);
          }
        });
      });
      
      // Setup /external namespace (read-only)
      const externalNamespace = io.of("/external");
      externalNamespace.on("connection", (socket) => {
        // Send initial state
        socket.emit("state", state);
        
        // No event handlers - read-only namespace
      });

      done();
    });
  });

  afterEach(() => {
    // Disconnect all tracked clients after each test
    activeClients.forEach(client => {
      if (client && client.connected) {
        client.disconnect();
      }
    });
    activeClients.length = 0; // Clear array
  });

  afterAll((done) => {
    if (externalClient) {
      externalClient.disconnect();
    }
    io.close();
    server.close(done);
  });

  beforeEach(() => {
    // Clear state between tests
    state.players = [];
    state.rollEvents = [];
    state.missionLog = [];
  });

  describe("CORS Configuration", () => {
    it("allows external client connection from allowed origin", (done) => {
      externalClient = trackClient(Client(`${serverUrl}/external`, {
        reconnection: false,
        extraHeaders: {
          origin: "http://localhost:3051",
        },
      }));

      externalClient.on("connect", () => {
        expect(externalClient.connected).toBe(true);
        externalClient.disconnect();
        done();
      });

      externalClient.on("connect_error", (error) => {
        done(new Error(`Connection failed: ${error.message}`));
      });
    });

    it("successfully connects without origin header (Node.js client)", (done) => {
      // Node.js Socket.io clients don't send Origin headers by default,
      // so this tests that the server accepts connections without Origin
      externalClient = trackClient(Client(`${serverUrl}/external`, {
        reconnection: false,
      }));

      externalClient.on("connect", () => {
        expect(externalClient.connected).toBe(true);
        done();
      });

      externalClient.on("connect_error", (error) => {
        done(new Error(`Connection failed: ${error.message}`));
      });
    });

    it("rejects connection from disallowed origin", (done) => {
      // Test that a disallowed origin is rejected
      externalClient = trackClient(Client(`${serverUrl}/external`, {
        reconnection: false,
        extraHeaders: {
          origin: "http://evil.com",
        },
      }));

      externalClient.on("connect", () => {
        done(new Error("Should not connect with disallowed origin"));
      });

      externalClient.on("connect_error", (error) => {
        // Connection should fail with CORS error
        expect(error).toBeDefined();
        done();
      });
    });
  });

  describe("State Broadcasts", () => {
    it("receives initial state on connection", (done) => {
      externalClient = trackClient(Client(`${serverUrl}/external`, {
        reconnection: false,
      }));

      externalClient.on("state", (receivedState) => {
        expect(receivedState).toHaveProperty("players");
        expect(receivedState).toHaveProperty("rollEvents");
        expect(receivedState).toHaveProperty("missionLog");
        expect(receivedState).toHaveProperty("metadata");
        expect(Array.isArray(receivedState.players)).toBe(true);
        done();
      });
    });

    it("receives state updates when player is added", (done) => {
      let stateUpdateCount = 0;

      externalClient = trackClient(Client(`${serverUrl}/external`, {
        reconnection: false,
      }));

      externalClient.on("state", (receivedState) => {
        stateUpdateCount++;

        if (stateUpdateCount === 1) {
          // First state is initial (empty)
          expect(receivedState.players.length).toBe(0);
          
          // Trigger a player add from a different client
          const gmClient = trackClient(Client(serverUrl, { reconnection: false }));
          gmClient.on("connect", () => {
            gmClient.emit("player:add", {
              name: "Ellen Ripley",
              health: 5,
              maxHealth: 5,
              stress: 3,
            });
          });
        } else if (stateUpdateCount === 2) {
          // Second state should have the new player
          expect(receivedState.players.length).toBe(1);
          expect(receivedState.players[0].name).toBe("Ellen Ripley");
          expect(receivedState.players[0].stress).toBe(3);
          done();
        }
      });
    });

    it("receives state updates when effects are applied", (done) => {
      let stateUpdateCount = 0;
      let playerId;

      externalClient = trackClient(Client(`${serverUrl}/external`, {
        reconnection: false,
      }));

      externalClient.on("state", (receivedState) => {
        stateUpdateCount++;

        if (stateUpdateCount === 1) {
          // Add a player first
          const gmClient = trackClient(Client(serverUrl, { reconnection: false }));
          gmClient.on("connect", () => {
            gmClient.emit("player:add", {
              name: "Test Player",
              health: 5,
              stress: 7,
            });
          });
        } else if (stateUpdateCount === 2) {
          // Player added, now add an effect
          playerId = receivedState.players[0].id;
          const gmClient = trackClient(Client(serverUrl, { reconnection: false }));
          gmClient.on("connect", () => {
            gmClient.emit("player:update", {
              id: playerId,
              activeEffects: [
                {
                  id: "effect-123",
                  type: "panic_hesitant",
                  label: "Hesitant",
                  severity: 3,
                  createdAt: Date.now(),
                  durationType: "manual",
                  durationValue: null,
                  clearedAt: null,
                },
              ],
            });
          });
        } else if (stateUpdateCount === 3) {
          // Effect should be present
          const player = receivedState.players.find(p => p.id === playerId);
          expect(player.activeEffects.length).toBe(1);
          expect(player.activeEffects[0].type).toBe("panic_hesitant");
          expect(player.activeEffects[0].clearedAt).toBe(null);
          done();
        }
      });
    });
  });

  describe("Multiple External Clients", () => {
    it("supports multiple simultaneous external connections", (done) => {
      const client1 = trackClient(Client(`${serverUrl}/external`, { reconnection: false }));
      const client2 = trackClient(Client(`${serverUrl}/external`, { reconnection: false }));
      
      let client1Connected = false;
      let client2Connected = false;
      let client1ReceivedState = false;
      let client2ReceivedState = false;

      const checkComplete = () => {
        if (
          client1Connected &&
          client2Connected &&
          client1ReceivedState &&
          client2ReceivedState
        ) {
          client1.disconnect();
          client2.disconnect();
          done();
        }
      };

      client1.on("connect", () => {
        client1Connected = true;
        checkComplete();
      });

      client2.on("connect", () => {
        client2Connected = true;
        checkComplete();
      });

      client1.on("state", () => {
        client1ReceivedState = true;
        checkComplete();
      });

      client2.on("state", () => {
        client2ReceivedState = true;
        checkComplete();
      });
    });

    it("broadcasts state to all connected external clients", (done) => {
      const client1 = trackClient(Client(`${serverUrl}/external`, { reconnection: false }));
      const client2 = trackClient(Client(`${serverUrl}/external`, { reconnection: false }));
      
      let client1Updates = 0;
      let client2Updates = 0;

      client1.on("state", () => {
        client1Updates++;
        checkComplete();
      });

      client2.on("state", () => {
        client2Updates++;
        checkComplete();
      });

      const checkComplete = () => {
        // Both clients should receive at least 2 updates (initial + player add)
        if (client1Updates >= 2 && client2Updates >= 2) {
          client1.disconnect();
          client2.disconnect();
          done();
        }
      };

      // Wait for both to connect, then trigger an update
      Promise.all([
        new Promise(resolve => client1.on("connect", resolve)),
        new Promise(resolve => client2.on("connect", resolve)),
      ]).then(() => {
        const gmClient = trackClient(Client(serverUrl, { reconnection: false }));
        gmClient.on("connect", () => {
          gmClient.emit("player:add", {
            name: "Broadcast Test",
          });
        });
      });
    });
  });

  describe("Effect Data Structure", () => {
    it("provides complete effect information in state", (done) => {
      let playerId;

      externalClient = trackClient(Client(`${serverUrl}/external`, {
        reconnection: false,
      }));

      externalClient.on("state", (receivedState) => {
        if (receivedState.players.length === 0) {
          // Add player with effect
          const gmClient = trackClient(Client(serverUrl, { reconnection: false }));
          gmClient.on("connect", () => {
            gmClient.emit("player:add", {
              name: "Effect Test",
            });
          });
        } else if (!playerId) {
          // Player added, now add effect
          playerId = receivedState.players[0].id;
          const gmClient = trackClient(Client(serverUrl, { reconnection: false }));
          gmClient.on("connect", () => {
            gmClient.emit("player:update", {
              id: playerId,
              activeEffects: [
                {
                  id: "effect-456",
                  type: "panic_freeze",
                  label: "Freeze",
                  severity: 4,
                  createdAt: 1234567890,
                  durationType: "manual",
                  durationValue: null,
                  clearedAt: null,
                },
              ],
            });
          });
        } else {
          // Effect should be present with all fields
          const player = receivedState.players.find(p => p.id === playerId);
          const effect = player.activeEffects[0];
          
          expect(effect.id).toBe("effect-456");
          expect(effect.type).toBe("panic_freeze");
          expect(effect.label).toBe("Freeze");
          expect(effect.severity).toBe(4);
          expect(effect.createdAt).toBe(1234567890);
          expect(effect.durationType).toBe("manual");
          expect(effect.durationValue).toBe(null);
          expect(effect.clearedAt).toBe(null);
          done();
        }
      });
    });

    it("distinguishes between active and cleared effects", (done) => {
      let playerId;
      let updateCount = 0;

      externalClient = trackClient(Client(`${serverUrl}/external`, {
        reconnection: false,
      }));

      externalClient.on("state", (receivedState) => {
        updateCount++;

        if (updateCount === 1) {
          // Add player
          const gmClient = trackClient(Client(serverUrl, { reconnection: false }));
          gmClient.on("connect", () => {
            gmClient.emit("player:add", { name: "Clear Test" });
          });
        } else if (updateCount === 2) {
          // Add active and cleared effect
          playerId = receivedState.players[0].id;
          const gmClient = trackClient(Client(serverUrl, { reconnection: false }));
          gmClient.on("connect", () => {
            gmClient.emit("player:update", {
              id: playerId,
              activeEffects: [
                {
                  id: "active-effect",
                  type: "panic_hesitant",
                  label: "Hesitant",
                  severity: 3,
                  createdAt: Date.now(),
                  durationType: "manual",
                  clearedAt: null, // Active
                },
                {
                  id: "cleared-effect",
                  type: "panic_freeze",
                  label: "Freeze",
                  severity: 4,
                  createdAt: Date.now() - 10000,
                  durationType: "manual",
                  clearedAt: Date.now(), // Cleared
                },
              ],
            });
          });
        } else if (updateCount === 3) {
          const player = receivedState.players.find(p => p.id === playerId);
          
          // Should have both effects in array
          expect(player.activeEffects.length).toBe(2);
          
          // Active effect has clearedAt === null
          const activeEffect = player.activeEffects.find(e => e.id === "active-effect");
          expect(activeEffect.clearedAt).toBe(null);
          
          // Cleared effect has clearedAt timestamp
          const clearedEffect = player.activeEffects.find(e => e.id === "cleared-effect");
          expect(clearedEffect.clearedAt).not.toBe(null);
          expect(typeof clearedEffect.clearedAt).toBe("number");
          
          done();
        }
      });
    });
  });

  describe("Initiative-Relevant Effects", () => {
    it("provides panic_hesitant effect for initiative card #10", (done) => {
      let playerId;

      externalClient = trackClient(Client(`${serverUrl}/external`, {
        reconnection: false,
      }));

      externalClient.on("state", (receivedState) => {
        if (receivedState.players.length === 0) {
          const gmClient = trackClient(Client(serverUrl, { reconnection: false }));
          gmClient.on("connect", () => {
            gmClient.emit("player:add", { name: "Hesitant Test" });
          });
        } else if (!playerId) {
          playerId = receivedState.players[0].id;
          const gmClient = trackClient(Client(serverUrl, { reconnection: false }));
          gmClient.on("connect", () => {
            gmClient.emit("player:update", {
              id: playerId,
              activeEffects: [
                {
                  id: "hesitant-effect",
                  type: "panic_hesitant",
                  label: "Hesitant",
                  severity: 3,
                  createdAt: Date.now(),
                  durationType: "manual",
                  clearedAt: null,
                },
              ],
            });
          });
        } else {
          const player = receivedState.players.find(p => p.id === playerId);
          const hasHesitant = player.activeEffects.some(
            e => e.type === "panic_hesitant" && e.clearedAt === null,
          );
          
          expect(hasHesitant).toBe(true);
          done();
        }
      });
    });

    it("provides turn-skipping effects for initiative tracking", (done) => {
      let playerId;

      externalClient = trackClient(Client(`${serverUrl}/external`, {
        reconnection: false,
      }));

      externalClient.on("state", (receivedState) => {
        if (receivedState.players.length === 0) {
          const gmClient = trackClient(Client(serverUrl, { reconnection: false }));
          gmClient.on("connect", () => {
            gmClient.emit("player:add", { name: "Freeze Test" });
          });
        } else if (!playerId) {
          playerId = receivedState.players[0].id;
          const gmClient = trackClient(Client(serverUrl, { reconnection: false }));
          gmClient.on("connect", () => {
            gmClient.emit("player:update", {
              id: playerId,
              activeEffects: [
                {
                  id: "freeze-effect",
                  type: "panic_freeze",
                  label: "Freeze",
                  severity: 4,
                  createdAt: Date.now(),
                  durationType: "manual",
                  clearedAt: null,
                },
              ],
            });
          });
        } else {
          const player = receivedState.players.find(p => p.id === playerId);
          
          const turnSkipEffects = ["panic_freeze", "panic_seek_cover", "panic_scream"];
          const shouldSkipTurn = player.activeEffects.some(
            e => turnSkipEffects.includes(e.type) && e.clearedAt === null,
          );
          
          expect(shouldSkipTurn).toBe(true);
          done();
        }
      });
    });
  });
});
