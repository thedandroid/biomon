// ============================================================
// HANDLER TYPES
// ============================================================

import type { Server, Socket } from "socket.io";
import type {
  GameState,
  Player,
  RollType,
  ClientToServerEvents,
  ServerToClientEvents,
} from "../types/index.js";

// ============================================================
// TYPED SERVER/SOCKET
// ============================================================

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// ============================================================
// HANDLER DEPENDENCIES
// ============================================================

export interface HandlerDependencies {
  // State mutation helpers
  broadcast: () => void;
  addLogEntry: (type: string, message: string, details?: string | null) => void;
  scheduleSave: () => void;

  // Player utilities
  ensurePlayerFields: (player: Player) => void;

  // Validation utilities
  clamp: (val: number, min: number, max: number) => number;
  clampInt: (val: number, min: number, max: number) => number;

  // ID generation
  newId: () => string;

  // Roll utilities (for rollHandlers)
  d6: () => number;
  hasLiveEffect: (player: Player, effectId: string) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table entries have dynamic shapes
  resolveEntry: (rollType: RollType, total: number) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table entries have dynamic shapes
  getEntryById: (rollType: RollType, id: string) => any;
  resolveNextHigherDifferentEntry: (
    rollType: RollType,
    total: number,
    currentId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table entries have dynamic shapes
  ) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- roll events have dynamic structure
  pushRollEvent: (event: any) => void;

  // Constants
  DEFAULT_MAX_HEALTH: number;
  MAX_HEALTH_CAP: number;
  MAX_STRESS: number;
  MAX_RESOLVE: number;
}

// ============================================================
// SESSION DEPENDENCIES (extends for persistence)
// ============================================================

import type {
  AutosaveInfo,
  CampaignInfo,
  SaveResult,
  LoadResult,
} from "../types/index.js";

export interface SessionDependencies extends HandlerDependencies {
  saveCampaign: (campaignName: string) => SaveResult;
  loadCampaign: (filename: string) => LoadResult;
  listCampaigns: () => CampaignInfo[];
  clearSession: () => void;
  autosaveInfo: AutosaveInfo;
}

// Re-export socket types for handler modules
export type { GameState, Player, RollType };
