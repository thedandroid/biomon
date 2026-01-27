// ============================================================
// CORE TYPES
// ============================================================

export type RollType = "stress" | "panic";
export type LogEntryType = "info" | "stress" | "panic" | "health" | "system";
export type DurationType = "manual";

// ============================================================
// APPLY OPTION (for GM choice)
// ============================================================

export interface ApplyOption {
  tableEntryId: string;
  label: string;
}

// ============================================================
// EFFECT (persistent condition)
// ============================================================

export interface Effect {
  id: string;
  type: string;
  label: string;
  severity: number;
  createdAt: number;
  durationType: DurationType;
  durationValue?: unknown;
  clearedAt: number | null;
}

// ============================================================
// LAST ROLL EVENT (attached to player)
// ============================================================

export interface LastRollEvent {
  type: RollType;
  eventId: string;
  total: number;
  die: number;
  stress: number;
  resolve: number;
  modifiers: number;
  tableEntryId: string;
  tableEntryLabel: string;
  tableEntryDescription: string;
  tableEntryStressDelta: number;
  tableEntryPersistent: boolean;
  duplicateAdjusted: boolean;
  duplicateFromId: string | null;
  duplicateFromLabel: string | null;
  duplicateNote: string | null;
  applyOptions: ApplyOption[] | null;
  appliedTableEntryId: string | null;
  appliedTableEntryLabel: string | null;
  appliedTableEntryDescription: string | null;
  appliedTableEntryStressDelta: number | null;
  timestamp: number;
  applied: boolean;
  appliedEffectId: string | null;
  appliedStressDuplicate: boolean;
  stressDeltaApplied: boolean;
  stressDeltaAppliedValue: number | null;
}

// ============================================================
// PLAYER
// ============================================================

export interface Player {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  stress: number;
  resolve: number;
  activeEffects: Effect[];
  lastRollEvent: LastRollEvent | null;
}

// ============================================================
// ROLL EVENT (broadcast history)
// ============================================================

export interface RollEvent {
  eventId: string;
  playerId: string;
  rollType: RollType;
  die: number;
  stress: number;
  resolve: number;
  modifiers: number;
  total: number;
  tableEntryId: string;
  label: string;
  description: string;
  stressDelta: number;
  duplicateAdjusted: boolean;
  duplicateFromId: string | null;
  duplicateFromLabel: string | null;
  timestamp: number;
}

// ============================================================
// LOG ENTRY
// ============================================================

export interface LogEntry {
  id: string;
  timestamp: number;
  type: LogEntryType;
  message: string;
  details: string | null;
}

// ============================================================
// SESSION METADATA
// ============================================================

export interface SessionMetadata {
  campaignName: string | null;
  createdAt: string | null;
  lastSaved: string | null;
  sessionCount: number;
}

// ============================================================
// GAME STATE (root)
// ============================================================

export interface GameState {
  players: Player[];
  rollEvents: RollEvent[];
  missionLog: LogEntry[];
  metadata: SessionMetadata;
}
