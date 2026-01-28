import type { TypedServer, TypedSocket, GameState, SessionDependencies } from "./types.js";

export function registerSessionHandlers(
  _io: TypedServer,
  socket: TypedSocket,
  state: GameState,
  deps: SessionDependencies,
): void {
  // session:save - lines 788-796
  socket.on("session:save", (payload) => {
    const campaignName = String(payload?.campaignName || "").trim() || "unnamed";
    const result = deps.saveCampaign(campaignName);
    socket.emit("session:save:result", result);
    if (result.success) {
      deps.addLogEntry("system", `CAMPAIGN SAVED: ${campaignName}`);
      deps.broadcast();
    }
  });

  // session:load - lines 798-810
  socket.on("session:load", (payload) => {
    const filename = String(payload?.filename || "").trim();
    if (!filename) {
      socket.emit("session:load:result", { success: false, error: "No filename provided" });
      return;
    }
    const result = deps.loadCampaign(filename);
    socket.emit("session:load:result", result);
    if (result.success) {
      deps.addLogEntry("system", `CAMPAIGN LOADED: ${state.metadata.campaignName || filename}`);
      deps.broadcast();
    }
  });

  // session:list - lines 812-815
  socket.on("session:list", () => {
    const campaigns = deps.listCampaigns();
    socket.emit("session:list:result", campaigns);
  });

  // session:clear - lines 817-821
  socket.on("session:clear", () => {
    deps.clearSession();
    deps.addLogEntry("system", "SESSION CLEARED");
    deps.broadcast();
  });

  // session:export - lines 823-825
  socket.on("session:export", () => {
    socket.emit("session:export:result", state);
  });

  // session:import - lines 827-851
  socket.on("session:import", (payload) => {
    try {
      if (!payload || typeof payload !== "object") {
        socket.emit("session:import:result", { success: false, error: "Invalid data" });
        return;
      }

      state.players = Array.isArray(payload.players) ? payload.players : [];
      state.rollEvents = Array.isArray(payload.rollEvents) ? payload.rollEvents : [];
      state.missionLog = Array.isArray(payload.missionLog) ? payload.missionLog : [];
      state.metadata = payload.metadata || {
        campaignName: null,
        createdAt: new Date().toISOString(),
        lastSaved: null,
        sessionCount: 0,
      };

      for (const p of state.players) deps.ensurePlayerFields(p);

      socket.emit("session:import:result", { success: true });
      deps.broadcast();
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      socket.emit("session:import:result", { success: false, error });
    }
  });

  // Send autosave info to GM on connection - line 854
  socket.emit("session:autosave:info", deps.autosaveInfo);
}
