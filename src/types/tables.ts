// ============================================================
// TABLE ENTRY TYPES
// ============================================================

import type { ApplyOption, DurationType } from "./state.js";

/**
 * Apply option as stored in response tables (raw format).
 * Note: This differs from ApplyOption in state.ts which uses tableEntryId.
 * The transformation from id -> tableEntryId happens in server.js.
 */
export interface TableApplyOption {
  id: string;
  label: string;
}

/**
 * Response table entry for stress and panic rolls.
 * Defines the outcome for a given roll total range.
 */
export interface TableEntry {
  min: number;
  max: number;
  id: string;
  label: string;
  description: string;
  severity: number;
  persistent: boolean;
  durationType?: DurationType;
  durationValue?: unknown;
  stressDelta?: number;
  applyOptions?: TableApplyOption[];
}
