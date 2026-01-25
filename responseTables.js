// BIOMON - Stress & Panic Response Tables
// Alien RPG Evolved — Stress & Panic tables

/**
 * Entry shape:
 * { min, max, id, label, description, severity, persistent, durationType, durationValue, applyOptions }
 *
 * `applyOptions` (optional):
 * For special-case results where the GM may need to apply an alternate outcome,
 * include an array like: [{ id: "panic_seek_cover", label: "Seek Cover" }, { id: "panic_scream", label: "Scream" }]
 */

const STRESS_TABLE = [
  {
    min: -999,
    max: 0,
    id: "stress_keeping_cool",
    label: "Keeping Cool",
    description: "No effect.",
    severity: 1,
    persistent: false,
  },
  {
    min: 1,
    max: 1,
    id: "stress_jumpy",
    label: "Jumpy",
    description:
      "When you push a skill roll, you gain +2 stress level instead of +1.",
    severity: 2,
    persistent: true,
    durationType: "manual",
  },
  {
    min: 2,
    max: 2,
    id: "stress_tunnel_vision",
    label: "Tunnel Vision",
    description: "All skill rolls based on Wits get -2 dice.",
    severity: 2,
    persistent: true,
    durationType: "manual",
  },
  {
    min: 3,
    max: 3,
    id: "stress_aggravated",
    label: "Aggravated",
    description: "All skill rolls based on Empathy get -2 dice.",
    severity: 2,
    persistent: true,
    durationType: "manual",
  },
  {
    min: 4,
    max: 4,
    id: "stress_shakes",
    label: "Shakes",
    description: "All skill rolls based on Agility get -2 dice.",
    severity: 2,
    persistent: true,
    durationType: "manual",
  },
  {
    min: 5,
    max: 5,
    id: "stress_frantic",
    label: "Frantic",
    description: "All skill rolls based on Strength get -2 dice.",
    severity: 2,
    persistent: true,
    durationType: "manual",
  },
  {
    min: 6,
    max: 6,
    id: "stress_deflated",
    label: "Deflated",
    description:
      "You cannot push any skill rolls. If you are Jumpy (#1 above), remove that response, and ignore any further Jumpy results while Deflated.",
    severity: 3,
    persistent: true,
    durationType: "manual",
  },
  {
    min: 7,
    max: 999,
    id: "stress_mess_up",
    label: "Mess Up",
    description:
      "Your action fails regardless of successes rolled and you gain +1 stress level.",
    severity: 4,
    persistent: false,
    stressDelta: 1,
  },
];

const PANIC_TABLE = [
  {
    min: -999,
    max: 0,
    id: "panic_keeping_cool",
    label: "Keeping Cool",
    description: "No effect.",
    severity: 1,
    persistent: false,
  },
  {
    min: 1,
    max: 1,
    id: "panic_spooked",
    label: "Spooked",
    description: "Stress level +1 for you.",
    severity: 2,
    persistent: false,
    stressDelta: 1,
  },
  {
    min: 2,
    max: 2,
    id: "panic_noisy",
    label: "Noisy",
    description:
      "Any enemies nearby (GM's discretion) are automatically alerted to your presence.",
    severity: 2,
    persistent: false,
  },
  {
    min: 3,
    max: 3,
    id: "panic_twitchy",
    label: "Twitchy",
    description:
      "Make an immediate supply roll for air, ammo, or power (GM's discretion).",
    severity: 2,
    persistent: false,
  },
  {
    min: 4,
    max: 4,
    id: "panic_lose_item",
    label: "Lose Item",
    description:
      "You lose a weapon or other important item. The GM decides which one. In combat, you can pick up the item with a quick action. Out of combat, you need an OBSERVATION roll and a stretch of time to find the item.",
    severity: 3,
    persistent: false,
  },
  {
    min: 5,
    max: 5,
    id: "panic_paranoid",
    label: "Paranoid",
    description:
      "You cannot give or receive help on skill rolls until panic ends.",
    severity: 3,
    persistent: true,
    durationType: "manual",
  },
  {
    min: 6,
    max: 6,
    id: "panic_hesitant",
    label: "Hesitant",
    description:
      "You automatically get the #10 initiative card in combat until your panic stops. If several PCs are Hesitant, draw the highest value cards randomly.",
    severity: 3,
    persistent: true,
    durationType: "manual",
  },
  {
    min: 7,
    max: 7,
    id: "panic_freeze",
    label: "Freeze",
    description:
      "You're frozen by fear, losing your next turn and unable to perform any interrupt actions before then.",
    severity: 4,
    persistent: true,
    durationType: "manual",
  },
  {
    min: 8,
    max: 8,
    id: "panic_seek_cover",
    label: "Seek Cover",
    description:
      "You immediately seek (full) cover in the zone, if it is cluttered. This is an interrupt action breaking the turn order. Once in cover, your stress level is reduced 1 step, but you lose your next turn and are unable to perform any interrupt actions before then. If you are in an open zone, you Scream instead.",
    severity: 4,
    persistent: true,
    durationType: "manual",
    stressDelta: -1,
    applyOptions: [
      { id: "panic_seek_cover", label: "Apply: Seek Cover" },
      { id: "panic_scream", label: "Apply: Scream" },
    ],
  },
  {
    min: 9,
    max: 9,
    id: "panic_scream",
    label: "Scream",
    description:
      "You scream your lungs out, losing your next turn and unable to perform any interrupt actions before then. Your stress level is reduced 1 step, but every friendly PC in the zone must make an immediate panic roll.",
    severity: 4,
    persistent: true,
    durationType: "manual",
    stressDelta: -1,
  },
  {
    min: 10,
    max: 10,
    id: "panic_flee",
    label: "Flee",
    description:
      "You immediately move away from the source of panic, into any adjacent zone, if such a move is possible. This is an interrupt action breaking the turn order. After the move, your stress level is reduced 1 step, but all friendly PCs in the starting zone get stress level +1. On your next turn and subsequent turns, you must spend all your actions to continue to move away, until you find a (reasonably) safe place, where you must remain until your panic stops. You cannot perform interrupt actions before then. If you cannot move out of your zone, you become Catatonic instead.",
    severity: 5,
    persistent: true,
    durationType: "manual",
    stressDelta: -1,
    applyOptions: [
      { id: "panic_flee", label: "Apply: Flee" },
      { id: "panic_catatonic", label: "Apply: Catatonic" },
    ],
  },
  {
    min: 11,
    max: 11,
    id: "panic_frenzy",
    label: "Frenzy",
    description:
      "You immediately attack the nearest person or creature, friendly or not. Every friendly PC in the zone must make an immediate panic roll. You won't stop until you or the target is broken, or until your panic stops. You cannot perform interrupt actions before then.",
    severity: 5,
    persistent: true,
    durationType: "manual",
  },
  {
    min: 12,
    max: 999,
    id: "panic_catatonic",
    label: "Catatonic",
    description:
      "You're doomed! You collapse to the floor and can't move, rambling or staring blankly into oblivion, until your panic stops.",
    severity: 5,
    persistent: true,
    durationType: "manual",
  },
];

function pickEntryByTotal(table, total) {
  const n = Number(total);
  for (const e of table) {
    if (n >= e.min && n <= e.max) return e;
  }
  // Should never happen because we include wide ranges.
  return table[table.length - 1];
}

function getTable(rollType) {
  return rollType === "panic" ? PANIC_TABLE : STRESS_TABLE;
}

function resolveEntry(rollType, total) {
  const table = getTable(rollType);
  return pickEntryByTotal(table, total);
}

function getEntryById(rollType, entryId) {
  const id = String(entryId ?? "");
  const table = getTable(rollType);
  return table.find((e) => e.id === id) || null;
}

export {
  STRESS_TABLE,
  PANIC_TABLE,
  resolveEntry,
  getEntryById,
};
