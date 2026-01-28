// Utility functions for Party Visualizer Roller

import type { Player } from "./src/types/index.js";

// Constants
const DEFAULT_MAX_HEALTH: number = 5;
const MAX_HEALTH_CAP: number = 10;
const MAX_STRESS: number = 10;
const MAX_RESOLVE: number = 10;
const ROLL_FEED_CAP: number = 200;

/**
 * Clamps a number between a minimum and maximum value.
 * Returns the lower bound if the input is NaN.
 * @param {number} n - The number to clamp
 * @param {number} lo - The lower bound
 * @param {number} hi - The upper bound
 * @returns {number} The clamped value
 */
function clamp(n: number, lo: number, hi: number): number {
  n = Number(n);
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Clamps an integer between a minimum and maximum value.
 * Truncates decimal values before clamping.
 * @param {number} n - The number to clamp
 * @param {number} lo - The lower bound
 * @param {number} hi - The upper bound
 * @returns {number} The clamped integer value
 */
function clampInt(n: number, lo: number, hi: number): number {
  return clamp(Math.trunc(Number(n)), lo, hi);
}

/**
 * Generates a unique ID based on timestamp and random hex.
 * Node <19 doesn't always have crypto.randomUUID; keep it simple and unique enough.
 * @returns {string} A unique identifier
 */
function newId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Ensures a player object has all required fields with defaults.
 * Mutates the player object in place.
 * @param {object} p - The player object to ensure fields for
 */
function ensurePlayerFields(p: Partial<Player> | null | undefined): void {
  if (!p) return;
  if (p.maxHealth === undefined) p.maxHealth = DEFAULT_MAX_HEALTH;
  if (p.health === undefined)
    p.health = clamp(p.health ?? p.maxHealth, 0, p.maxHealth);
  if (p.stress === undefined) p.stress = 0;
  if (p.resolve === undefined) p.resolve = 0;
  if (!Array.isArray(p.activeEffects)) p.activeEffects = [];
  if (p.lastRollEvent === undefined) p.lastRollEvent = null;
}

/**
 * Checks if a player has a live (not cleared) effect of a given type.
 * @param {object} p - The player object
 * @param {string} effectType - The effect type ID to check for
 * @returns {boolean} True if the player has a live effect of that type
 */
function hasLiveEffect(p: Pick<Player, "activeEffects"> | null | undefined, effectType: string): boolean {
  const type = String(effectType ?? "");
  if (!type) return false;
  const list = Array.isArray(p?.activeEffects) ? p.activeEffects : [];
  return list.some((e) => !e?.clearedAt && String(e?.type ?? "") === type);
}

/**
 * Rolls a six-sided die.
 * @returns {number} A random integer between 1 and 6
 */
function d6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export {
  // Constants
  DEFAULT_MAX_HEALTH,
  MAX_HEALTH_CAP,
  MAX_STRESS,
  MAX_RESOLVE,
  ROLL_FEED_CAP,

  // Functions
  clamp,
  clampInt,
  newId,
  ensurePlayerFields,
  hasLiveEffect,
  d6,
};
