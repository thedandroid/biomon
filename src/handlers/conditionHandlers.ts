import type { TypedServer, TypedSocket, GameState, HandlerDependencies } from "./types.js";

export function registerConditionHandlers(
  _io: TypedServer,
  socket: TypedSocket,
  state: GameState,
  deps: HandlerDependencies,
): void {
  // condition:toggle - lines 743-782
  socket.on("condition:toggle", (payload) => {
    const playerId = String(payload?.playerId ?? "");
    const condition = String(payload?.condition ?? "").toLowerCase();

    // Validate condition name - Only "fatigue" is supported now
    const VALID_CONDITIONS = ["fatigue"];
    if (!VALID_CONDITIONS.includes(condition)) return;

    const p = state.players.find((x) => x.id === playerId);
    if (!p) return;
    deps.ensurePlayerFields(p);

    const type = `condition_${condition}`;
    const label = condition.toUpperCase();

    // Check if already active (and not cleared)
    const existing = (p.activeEffects || []).find((e) => e.type === type && !e.clearedAt);

    if (existing) {
      // Toggle OFF
      existing.clearedAt = Date.now();
      console.log(`[CONDITION:REMOVE] ${p.name} ${condition}`);
      deps.addLogEntry("info", `${p.name} RECOVERED FROM: ${label}`);
    } else {
      // Toggle ON
      const effect = {
        id: deps.newId(),
        type,
        label,
        severity: 1,
        createdAt: Date.now(),
        durationType: "manual" as const,
        clearedAt: null,
      };
      p.activeEffects.push(effect);
      console.log(`[CONDITION:ADD] ${p.name} ${condition}`);
      deps.addLogEntry("info", `${p.name} IS NOW FATIGUED`);
    }
    deps.broadcast();
  });
}
