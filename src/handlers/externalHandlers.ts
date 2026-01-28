import type { TypedServer, GameState, HandlerDependencies } from "./types.js";

export function registerExternalHandlers(
  io: TypedServer,
  state: GameState,
  deps: Pick<HandlerDependencies, "ensurePlayerFields">,
): void {
  // External namespace for read-only access
  const externalNamespace = io.of("/external");

  externalNamespace.on("connection", (socket) => {
    console.log(`[EXTERNAL] Client connected: ${socket.id}`);

    // Send initial state on connection
    for (const p of state.players) deps.ensurePlayerFields(p);
    socket.emit("state", state);

    socket.on("disconnect", (reason) => {
      console.log(`[EXTERNAL] Client disconnected: ${socket.id} (${reason})`);
    });

    // External namespace intentionally has no event handlers
    // It only receives broadcasts, providing true read-only access
  });
}
