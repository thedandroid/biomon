# BIOMON

> **Biological Monitoring System** — A Weyland-Yutani medical terminal for tracking crew vitals, stress, and panic responses in *Alien RPG* games.

A lightweight, diegetic party status tracker with an integrated **Stress & Panic Roller** for *Alien RPG*. Styled as a retro medical console with real-time ECG animations and atmospheric Weyland-Yutani theming.

---

## Features

- **Real-time crew monitoring** - Track health, stress, and resolve for all players
- **Integrated dice roller** - Automated Stress and Panic rolls with table lookup
- **Diegetic UI** - Medical terminal aesthetic with ECG waveforms
- **GM & Player views** - Separate interfaces for game master and players
- **Effect tracking** - Persistent panic/stress effects with visual indicators
- **No database required** - In-memory state, zero setup complexity

---

## Quick Start

### Installation

```bash
npm install
```

### Running the Server

```bash
npm start
# or
node server.js
```

### Access the App

- **GM View**: [http://localhost:3050/gm](http://localhost:3050/gm)
- **Player View**: [http://localhost:3050/](http://localhost:3050/)

Default port is `3050` (override with `PORT` environment variable).

---

## How It Works

BIOMON automates stress and panic resolution for *Alien RPG* games:

### Stress Rolls

When the GM triggers a **Stress Roll**, the tool:
1. Rolls a d6 automatically
2. Calculates: `d6 + current_stress - resolve + modifiers`
3. Looks up the result on the Stress Table
4. Displays the effect and applies it to the player

### Panic Rolls

When the GM triggers a **Panic Roll**, the tool:
1. Rolls a d6 automatically
2. Calculates: `d6 + current_stress - resolve + modifiers`
3. Looks up the result on the Panic Table
4. Displays the effect and applies it to the player

Both roll types use the same formula but consult different tables for the outcome.

---

## GM View — How to Use

### Player Management

Each player card displays:
- **Name** and **ID**
- **Health**, **Stress**, and **Resolve** sliders
- **Active effects** (persistent panic/stress conditions)
- **Roller panel** for triggering rolls

### Roller Panel

- **STRESS ROLL** — Click when a skill check's Stress Dice include **one or more 1s**
- **PANIC ROLL** — Click only when the GM explicitly calls for a panic roll
- **MOD** — Situational modifiers (quick `-1`/`+1` buttons and direct input)
- **Output** — Shows `d6` result, computed total, and resolved table entry (label + short description)
- **APPLY** — Marks the roll as applied; adds persistent effect tag if applicable
- **UNDO** — Reverses the last Apply (clears the effect if one was created)
- **ACTIVE EFFECTS** — Persistent tags can be manually **CLEARED**

### Roll Feed

- Live feed of all roll events
- Shows player name, roll type, result, and effect
- Limited to most recent rolls

---

## Player View — What Players See

### Visual Feedback

- When a roll happens, the affected player's card shows a **brief alert banner** with the effect label
- Persistent effects show as **tags** (label only)
- **ECG animation changes**:
  - **Stress Roll** → Subtle warning / mild disturbance
  - **Panic Roll** → Strong warning / large spike
  - If a persistent panic-tagged effect is active, the card keeps a visible panic indicator until cleared

### Privacy

- Players see their own stats and effects
- No access to GM controls or other players' hidden information

---

## Customization

### Stress & Panic Tables

The Stress/Panic tables are defined in [`responseTables.js`](responseTables.js).

This repository includes a **small placeholder set** (range-based entries). You can customize:
- Roll ranges (min/max)
- Effect labels and descriptions
- Persistent vs. temporary effects
- Severity levels

### Validation

Run the self-check to validate your tables:

```bash
npm run selfcheck
```

This ensures all possible roll totals resolve to a valid table entry.

---

## Testing

```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run test:ui          # Interactive UI
```

**Test Framework**: Vitest with 67 tests covering utilities, table logic, and Socket.io integration.

---

## Tech Stack

- **Backend**: Node.js, Express v5, Socket.io v4
- **Frontend**: Vanilla JavaScript (no frameworks), HTML5, CSS3
- **No TypeScript**: Pure JavaScript implementation
- **No Build Tools**: Static file serving
- **State**: In-memory (no database)

---

## Project Structure

```
biomon/
├── server.js              # Express/Socket.io server
├── responseTables.js      # Stress & Panic table definitions
├── utils.js               # Shared utility functions
├── public/                # Static frontend files
│   ├── gm.html           # GM view
│   ├── gm.js             # GM logic
│   ├── player.html       # Player view
│   ├── player.js         # Player logic + ECG animation
│   └── styles.css        # Medical console theming
└── test/                  # Test suite
```

---

## License

[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/)

This project is free to use, modify, and share for non-commercial purposes. See [LICENSE](LICENSE) for details.

---

## Contributing

Issues and pull requests welcome! See [`AGENTS.md`](AGENTS.md) for coding guidelines.
