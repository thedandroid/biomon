import type { TypedServer, TypedSocket, GameState, HandlerDependencies } from "./types.js";

export function registerPlayerHandlers(
  _io: TypedServer,
  socket: TypedSocket,
  state: GameState,
  deps: HandlerDependencies,
): void {
  // player:add - lines 314-338
  socket.on("player:add", (payload) => {
    const name =
      String(payload?.name ?? "")
        .trim()
        .slice(0, 40) || "UNNAMED";
    const maxHealth = deps.clamp(
      payload?.maxHealth ?? deps.DEFAULT_MAX_HEALTH,
      1,
      deps.MAX_HEALTH_CAP,
    );

    state.players.push({
      id: deps.newId(),
      name,
      maxHealth,
      health: deps.clamp(payload?.health ?? maxHealth, 0, maxHealth),
      stress: deps.clamp(payload?.stress ?? 0, 0, deps.MAX_STRESS),
      resolve: deps.clamp(payload?.resolve ?? 0, 0, deps.MAX_RESOLVE),
      activeEffects: [],
      lastRollEvent: null,
    });

    deps.addLogEntry("system", `CREW MEMBER ADDED: ${name}`);
    deps.broadcast();
  });

  // player:remove - lines 340-348
  socket.on("player:remove", (payload) => {
    const id = String(payload?.id ?? "");
    const p = state.players.find((x) => x.id === id);
    const name = p ? p.name : "UNKNOWN";

    state.players = state.players.filter((p) => p.id !== id);
    deps.addLogEntry("system", `CREW MEMBER REMOVED: ${name}`);
    deps.broadcast();
  });

  // player:update - lines 350-386
  socket.on("player:update", (payload) => {
    const id = String(payload?.id ?? "");
    const p = state.players.find((x) => x.id === id);
    if (!p) return;

    deps.ensurePlayerFields(p);

    if (payload?.name !== undefined)
      p.name = String(payload.name).trim().slice(0, 40) || p.name;

    if (payload?.maxHealth !== undefined) {
      p.maxHealth = deps.clamp(payload.maxHealth, 1, deps.MAX_HEALTH_CAP);
      if (p.health > p.maxHealth) p.health = p.maxHealth;
    }

    if (payload?.health !== undefined) {
      const maxH = deps.clamp(p.maxHealth ?? deps.DEFAULT_MAX_HEALTH, 1, deps.MAX_HEALTH_CAP);
      const oldHealth = p.health;
      p.health = deps.clamp(payload.health, 0, maxH);

      if (p.health !== oldHealth) {
        if (p.health === 0) {
          deps.addLogEntry("health", `${p.name} CRITICAL: HEALTH DROPPED TO 0`);
        }
      }
    }

    if (payload?.stress !== undefined)
      p.stress = deps.clamp(payload.stress, 0, deps.MAX_STRESS);

    if (payload?.resolve !== undefined)
      p.resolve = deps.clamp(payload.resolve, 0, deps.MAX_RESOLVE);

    deps.broadcast();
  });

  // party:clear - lines 388-394
  socket.on("party:clear", () => {
    state.players = [];
    state.rollEvents = [];
    state.missionLog = [];
    deps.addLogEntry("system", "PARTY CLEARED");
    deps.broadcast();
  });
}
