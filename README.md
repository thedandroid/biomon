# Party Vitals + Alien RPG Evolved Stress & Panic Roller

A lightweight diegetic (medical console vibe) party status tracker with an integrated **Stress & Panic Roller** for Alien RPG Evolved.

## Rules summary (implemented)

- **Stress Dice** (from skill checks) can show one or more **1s**.
  - If **any Stress Die shows 1**, that triggers **one Stress Roll event** (not an automatic panic roll).
  - Multiple 1s still mean **one** Stress Roll for that check.
- **Panic Rolls are only made when the GM explicitly calls for one.**
- **Stress Rolls and Panic Rolls use the same formula:**

$$\text{total} = d6 + \text{current\_stress} - \text{resolve} + \text{situational\_modifiers}$$

- The difference is only which table is consulted:
  - **Stress Roll → Stress Table**
  - **Panic Roll → Panic Table**

## How to run

- Install deps: `npm install`
- Start: `node server.js`
- GM view: `http://localhost:3050/gm`
- Player view: `http://localhost:3050/`

## GM view — how to use the Roller

Each player has a **ROLLER** panel:

- **STRESS ROLL**: click when a skill check’s Stress Dice include **one or more 1s**.
- **PANIC ROLL**: click only when the GM calls for a panic roll.
- **MOD**: situational modifiers (quick `-1/+1` and direct input).
- Output shows `d6`, computed total, and the resolved table entry label + short description.
- **APPLY**:
  - Marks the roll as applied.
  - If the table entry is marked persistent, it adds a persistent effect tag to the player.
- **UNDO**: reverses the last Apply (clears the effect if one was created).
- **ACTIVE EFFECTS**: persistent tags can be **CLEARED** manually.

## Player view — what players see

- When a roll happens, the affected player’s card shows a brief alert banner with the **effect label**.
- Persistent effects show as **tags** (label only).
- ECG animation changes:
  - **Stress Roll**: subtle warning / mild disturbance
  - **Panic Roll**: strong warning / large spike
  - If a persistent panic-tagged effect is active, the card keeps a visible panic indicator until cleared.

## Tables

The Stress/Panic tables live in:

- [responseTables.js](responseTables.js)

This repo includes a **small placeholder set** (range-based entries). Fill in your preferred entries and tuning.

## Self-check

- Run: `npm run selfcheck`

This validates the placeholder tables resolve an entry for a range of totals.
