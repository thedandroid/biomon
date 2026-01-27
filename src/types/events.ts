// ============================================================
// SOCKET.IO TYPE DEFINITIONS
// ============================================================

import type { Server, Socket, Namespace } from "socket.io";
import type { GameState } from "./state.js";

// ============================================================
// PAYLOAD TYPES
// ============================================================

export interface PlayerAddPayload {
  name?: string;
  maxHealth?: number;
  health?: number;
  stress?: number;
  resolve?: number;
}

export interface PlayerUpdatePayload {
  id: string;
  name?: string;
  maxHealth?: number;
  health?: number;
  stress?: number;
  resolve?: number;
}

export interface RollTriggerPayload {
  playerId: string;
  rollType?: "stress" | "panic";
  modifiers?: number;
}

export interface RollApplyPayload {
  playerId: string;
  eventId: string;
  tableEntryId?: string;
}

export interface RollEventRef {
  playerId: string;
  eventId: string;
}

export interface EffectClearPayload {
  playerId: string;
  effectId: string;
}

export interface ConditionTogglePayload {
  playerId: string;
  condition: "fatigue";
}

export interface SessionSavePayload {
  campaignName?: string;
}

export interface SessionLoadPayload {
  filename: string;
}

// ============================================================
// RESPONSE TYPES
// ============================================================

export interface SaveResult {
  success: boolean;
  filename?: string;
  error?: string;
}

export interface LoadResult {
  success: boolean;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  error?: string;
}

export interface CampaignInfo {
  filename: string;
  campaignName: string;
  lastSaved: string;
  playerCount: number;
  sessionCount: number;
}

export interface AutosaveInfo {
  found: boolean;
  timestamp?: string;
  playerCount?: number;
  campaignName?: string;
}

// ============================================================
// SOCKET.IO EVENT MAPS
// ============================================================

export interface ClientToServerEvents {
  "player:add": (payload: PlayerAddPayload) => void;
  "player:remove": (payload: { id: string }) => void;
  "player:update": (payload: PlayerUpdatePayload) => void;
  "party:clear": () => void;
  "roll:trigger": (payload: RollTriggerPayload) => void;
  "roll:apply": (payload: RollApplyPayload) => void;
  "roll:applyStressDelta": (payload: RollEventRef) => void;
  "roll:undo": (payload: RollEventRef) => void;
  "roll:clear": (payload: { playerId: string }) => void;
  "effect:clear": (payload: EffectClearPayload) => void;
  "condition:toggle": (payload: ConditionTogglePayload) => void;
  "session:save": (payload: SessionSavePayload) => void;
  "session:load": (payload: SessionLoadPayload) => void;
  "session:list": () => void;
  "session:clear": () => void;
  "session:export": () => void;
  "session:import": (payload: GameState) => void;
}

export interface ServerToClientEvents {
  "state": (state: GameState) => void;
  "session:save:result": (result: SaveResult) => void;
  "session:load:result": (result: LoadResult) => void;
  "session:list:result": (campaigns: CampaignInfo[]) => void;
  "session:export:result": (state: GameState) => void;
  "session:import:result": (result: ImportResult) => void;
  "session:autosave:info": (info: AutosaveInfo) => void;
}

// External namespace (read-only)
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ExternalClientToServerEvents {
  // Intentionally empty - read-only namespace accepts no events
}

export interface ExternalServerToClientEvents {
  "state": (state: GameState) => void;
}

// ============================================================
// TYPED SERVER/SOCKET ALIASES
// ============================================================

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
export type TypedExternalNamespace = Namespace<
  ExternalClientToServerEvents,
  ExternalServerToClientEvents
>;
