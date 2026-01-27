// ============================================================
// TABLE ENTRY TYPES
// ============================================================

import type { ApplyOption, DurationType } from "./state.js";

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
  applyOptions?: ApplyOption[];
}
