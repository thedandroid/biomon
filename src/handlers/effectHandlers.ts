import type { TypedServer, TypedSocket, GameState, HandlerDependencies } from "./types.js";

export function registerEffectHandlers(
  _io: TypedServer,
  socket: TypedSocket,
  state: GameState,
  deps: HandlerDependencies,
): void {
  // effect:clear - lines 716-741
  socket.on("effect:clear", (payload) => {
    const playerId = String(payload?.playerId ?? "");
    const effectId = String(payload?.effectId ?? "");

    const p = state.players.find((x) => x.id === playerId);
    if (!p) return;
    deps.ensurePlayerFields(p);

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
    deps.addLogEntry("info", `${p.name} CONDITION CLEARED: ${eff.label}`);
    deps.broadcast();
  });
}
