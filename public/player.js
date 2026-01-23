const socket = io();

const cardsEl = document.getElementById("cards");
const linkStatusEl = document.getElementById("linkStatus");
const crewCountEl = document.getElementById("crewCount");
const partyStressEl = document.getElementById("partyStress");

let state = { players: [] };

// Local-only alert tracking: show a banner briefly when a new roll event arrives
const alertState = {
  seenEventIdByPlayer: new Map(),
  flashUntilByPlayer: new Map(),
};

// --- ECG animation engine (per-card scrolling waveform) ---
const ecgEngine = (() => {
  const items = new Map(); // id -> { canvas, ctx, buf, x, phase, t, params }
  let raf = null;

  function nowMs() {
    return Date.now();
  }

  function upsert(id, canvas, params) {
    let it = items.get(id);
    if (!it || it.canvas !== canvas) {
      const ctx = canvas.getContext("2d");
      it = {
        canvas,
        ctx,
        buf: new Float32Array(canvas.width).fill(0),
        x: 0,
        phase: Math.random() * 10,
        t: 0,
        params: {
          health: 5,
          maxHealth: 5,
          stress: 0,
          ecgColor: "rgba(108,255,184,1)",
          event: null,
        },
      };
      items.set(id, it);
    }
    it.params = { ...it.params, ...params };

    if (!raf) raf = requestAnimationFrame(tick);
  }

  function removeMissing(liveIds) {
    for (const id of items.keys()) {
      if (!liveIds.has(id)) items.delete(id);
    }
  }

  // Generate one ECG-like sample (baseline + QRS spike + small jitter)
  function sample(it) {
    const { health, maxHealth, stress } = it.params;

    const maxH = maxHealth || 5;
    const hp = Math.max(0, Math.min(maxH, health));
    const hpPct = maxH ? hp / maxH : 1;

    // If health is 0, the monitor should flatline.
    if (hp <= 0) {
      it.t += 1 / 60;
      const tinyDrift = Math.sin((it.t * 0.1 + it.phase) * Math.PI * 2) * 0.002;
      const tinyNoise = (Math.random() - 0.5) * 0.006;
      return tinyDrift + tinyNoise;
    }

    // Heart rate: higher stress -> faster; lower health -> slightly faster (panic / trauma)
    const bpm = 55 + (stress / 10) * 85 + (1 - hpPct) * 35; // 55..175-ish
    const hz = bpm / 60;

    // Amplitude: lower health -> weaker signal; higher stress -> noisier
    const amp = 0.75 * (0.45 + 0.55 * hpPct);
    const noise = 0.05 + (stress / 10) * 0.18;

    // Roll event overlay (stress: mild disturbance, panic: strong spike)
    const ev = it.params.event;
    const evActive = ev && ev.until && nowMs() < ev.until;
    const evIntensity = evActive
      ? Math.max(0, Math.min(1, Number(ev.intensity ?? 0)))
      : 0;
    const evPanic = evActive && ev.type === "panic";

    // Time progression (normalized)
    it.t += 1 / 60;
    const p = (it.t * hz + it.phase) % 1; // 0..1

    // Basic ECG shape: small P wave, sharp QRS, small T wave
    let y = 0;
    // P wave
    if (p > 0.08 && p < 0.16) {
      const u = (p - 0.08) / 0.08;
      y += 0.18 * Math.sin(u * Math.PI);
    }
    // QRS complex
    if (p > 0.22 && p < 0.26) {
      const u = (p - 0.22) / 0.04;
      // quick down-up-down
      y += u < 0.33 ? -0.35 : u < 0.66 ? 1.25 : -0.55;
    }
    // T wave
    if (p > 0.34 && p < 0.5) {
      const u = (p - 0.34) / 0.16;
      y += 0.3 * Math.sin(u * Math.PI);
    }

    // Baseline drift + noise (stress adds jitter)
    const drift = Math.sin((it.t * 0.35 + it.phase) * Math.PI * 2) * 0.06;
    const jitter =
      (Math.random() - 0.5) * (noise + evIntensity * (evPanic ? 0.3 : 0.12));

    // Additional event spikes for panic
    let spike = 0;
    if (evActive) {
      // occasional tall spike; more likely + taller for panic
      const chance = evPanic ? 0.09 : 0.04;
      if (Math.random() < chance) spike = (evPanic ? 1.9 : 0.9) * evIntensity;
    }

    return y * amp + drift + jitter + spike;
  }

  function draw(it) {
    const c = it.canvas;
    const ctx = it.ctx;
    const W = c.width,
      H = c.height;

    // Background
    ctx.clearRect(0, 0, W, H);

    // faint grid
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "rgba(15,42,39,1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const gx = 26;
    for (let x = 0; x <= W; x += gx) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    const gy = 18;
    for (let y = 0; y <= H; y += gy) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();

    const mid = Math.floor(H * 0.55);
    const scale = H * 0.32;

    // Draw waveform with phosphor glow and trailing fade
    const baseColor = it.params.ecgColor || "rgba(108,255,184,1)";
    
    // Extract RGB from rgba string for glow
    const rgbMatch = baseColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    const r = rgbMatch ? rgbMatch[1] : "108";
    const g = rgbMatch ? rgbMatch[2] : "255";
    const b = rgbMatch ? rgbMatch[3] : "184";

    // Pass 1: Phosphor glow (soft, blurred layer)
    ctx.shadowBlur = 12;
    ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
    ctx.strokeStyle = `rgba(${r},${g},${b},0.5)`;
    ctx.lineWidth = 3;

    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const idx = (it.x + x) % W;
      const yy = mid - it.buf[idx] * scale;
      
      // Trailing fade: older samples fade out
      const distFromHead = (W + idx - it.x) % W;
      const fadeFactor = 1 - (distFromHead / W) * 0.5; // Fade from 1.0 to 0.5
      
      ctx.globalAlpha = 0.6 * fadeFactor;
      
      if (x === 0) ctx.moveTo(0, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();

    // Pass 2: Sharp main trace (crisp, bright line on top)
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 2;

    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const idx = (it.x + x) % W;
      const yy = mid - it.buf[idx] * scale;
      
      // Same trailing fade for consistency
      const distFromHead = (W + idx - it.x) % W;
      const fadeFactor = 1 - (distFromHead / W) * 0.5;
      
      ctx.globalAlpha = 0.95 * fadeFactor;
      
      if (x === 0) ctx.moveTo(0, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();

    // scanline sheen
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "rgba(185,255,245,1)";
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

    ctx.globalAlpha = 1;
  }

  function tick() {
    // Advance each buffer by 1 pixel column per frame
    for (const it of items.values()) {
      const W = it.canvas.width;
      it.buf[it.x] = sample(it);
      it.x = (it.x + 1) % W;
      draw(it);
    }

    if (items.size) raf = requestAnimationFrame(tick);
    else raf = null;
  }

  return { upsert, removeMissing };
})();

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function resolveCssVarColor(color) {
  const c = String(color ?? "").trim();
  const m = /^var\((--[^)]+)\)$/.exec(c);
  if (!m) return c;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() ||
    c
  );
}

function classifyHealth(p) {
  const maxH = clamp(Number(p.maxHealth ?? 5), 1, 10);
  const hp = clamp(Number(p.health ?? 0), 0, maxH);
  const hpPct = maxH ? hp / maxH : 1;

  if (hpPct <= 0.2) return { label: "CRITICAL", color: "var(--bad)" };
  if (hpPct <= 0.5) return { label: "COMPROMISED", color: "var(--warn)" };
  return { label: "STABLE", color: "var(--ok)" };
}

function classifyStress(p) {
  const stress = Number(p.stress ?? 0);
  if (stress >= 8) return { label: "PANIC", color: "var(--panic)" };
  if (stress >= 5) return { label: "HIGH", color: "var(--warn)" };
  return { label: "OK", color: "var(--ok)" };
}

function activeEffects(p) {
  return (Array.isArray(p.activeEffects) ? p.activeEffects : []).filter(
    (e) => !e.clearedAt,
  );
}

function hasActivePanicEffect(p) {
  return activeEffects(p).some((e) =>
    String(e.type || "").startsWith("panic_"),
  );
}

function computeRollFlash(p) {
  const lr = p.lastRollEvent;
  if (!lr || !lr.eventId) return { show: false, kind: null };

  // Once the GM applies the roll, players should only see the resulting effect tags.
  if (lr.applied) {
    alertState.flashUntilByPlayer.set(p.id, 0);
    return { show: false, kind: null };
  }

  const prev = alertState.seenEventIdByPlayer.get(p.id);
  if (prev !== lr.eventId) {
    alertState.seenEventIdByPlayer.set(p.id, lr.eventId);
    alertState.flashUntilByPlayer.set(p.id, Date.now() + 12000);
  }

  const until = alertState.flashUntilByPlayer.get(p.id) || 0;
  const show = Date.now() < until;
  return { show, kind: lr.type === "panic" ? "panic" : "stress" };
}

function dotClassForHealth(statusLabel) {
  switch (String(statusLabel)) {
  case "CRITICAL":
    return "dot-bad";
  case "COMPROMISED":
    return "dot-warn";
  default:
    return "dot-ok";
  }
}

function dotClassForStress(statusLabel) {
  switch (String(statusLabel)) {
  case "PANIC":
    return "dot-panic";
  case "HIGH":
    return "dot-warn";
  default:
    return "dot-ok";
  }
}

function buildStatusChip(kindLabel, dotClass) {
  const chip = document.createElement("div");
  chip.className = "chip";

  const kind = document.createElement("span");
  kind.className = "chip-kind";
  kind.textContent = kindLabel;

  const dot = document.createElement("span");
  dot.className = `dot ${dotClass}`;

  chip.appendChild(kind);
  chip.appendChild(dot);
  return chip;
}

function render() {
  cardsEl.innerHTML = "";
  crewCountEl.textContent = String(state.players.length);

  const avgStress = state.players.length
    ? state.players.reduce((a, p) => a + Number(p.stress || 0), 0) /
    state.players.length
    : 0;
  partyStressEl.textContent = avgStress.toFixed(1);

  for (const p of state.players) {
    const hpSt = classifyHealth(p);
    const stressSt = classifyStress(p);

    const rollFlash = computeRollFlash(p);
    const panicPersist = hasActivePanicEffect(p);

    const card = document.createElement("div");
    card.className = `card${panicPersist ? " card-panic" : ""}`;

    const hd = document.createElement("div");
    hd.className = "card-hd";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="name">${escapeHtml(p.name)}</div>
    `;

    const chips = document.createElement("div");
    chips.className = "chips chips-bottom";

    chips.appendChild(
      buildStatusChip("HEALTH:", dotClassForHealth(hpSt.label)),
    );
    chips.appendChild(
      buildStatusChip("STRESS:", dotClassForStress(stressSt.label)),
    );

    hd.appendChild(left);

    const bars = document.createElement("div");
    bars.className = "bars";

    const maxHealth = clamp(Number(p.maxHealth ?? 5), 1, 10);
    const healthCur = clamp(Number(p.health ?? 0), 0, maxHealth);
    const healthPct = (healthCur / maxHealth) * 100;
    const stressPct = clamp((Number(p.stress || 0) / 10) * 100, 0, 100);

    bars.appendChild(
      bar(
        "HEALTH",
        `${healthCur.toFixed(0)}/${maxHealth.toFixed(0)}`,
        healthPct,
        false,
      ),
    );
    bars.appendChild(
      bar("STRESS", `${Number(p.stress || 0).toFixed(0)}/10`, stressPct, true),
    );

    // Alert banner (brief, when a roll happens)
    const lr = p.lastRollEvent;
    if (rollFlash.show && lr) {
      const alert = document.createElement("div");
      alert.className = `alert ${rollFlash.kind === "panic" ? "alert-panic" : "alert-stress"}`;
      const label = String(
        lr.tableEntryLabel || (rollFlash.kind === "panic" ? "PANIC" : "STRESS"),
      );
      alert.innerHTML = `
        <div>
          <div class="alert-title">${escapeHtml(rollFlash.kind === "panic" ? "PANIC ROLL" : "STRESS ROLL")}</div>
          <div class="alert-msg">${escapeHtml(label)}</div>
        </div>
      `;
      bars.appendChild(alert);
    }

    // Effect tags (no rules text)
    const live = activeEffects(p);
    if (live.length) {
      const tags = document.createElement("div");
      tags.className = "tags";
      for (const e of live) {
        const tag = document.createElement("div");
        const isPanic = String(e.type || "").startsWith("panic_");
        tag.className = `tag ${isPanic ? "tag-panic" : "tag-stress"}`;
        tag.textContent = String(e.label || "EFFECT").toUpperCase();
        tags.appendChild(tag);
      }
      bars.appendChild(tags);
    }

    card.appendChild(hd);
    // ECG strip
    const ecgWrap = document.createElement("div");
    ecgWrap.className = "ecg-wrap";
    const ecgLabel = document.createElement("div");
    ecgLabel.className = "ecg-label";
    ecgLabel.textContent = "ECG";
    const ecg = document.createElement("canvas");
    ecg.className = "ecg";
    ecg.width = 520; // internal resolution; CSS scales
    ecg.height = 54;

    ecgWrap.appendChild(ecgLabel);
    ecgWrap.appendChild(ecg);

    card.appendChild(bars);
    card.appendChild(ecgWrap);
    card.appendChild(chips);
    cardsEl.appendChild(card);

    // Register/update waveform driver
    ecgEngine.upsert(p.id, ecg, {
      health: Number(p.health ?? 0),
      maxHealth: Number(p.maxHealth ?? 5),
      stress: Number(p.stress ?? 0),
      ecgColor: resolveCssVarColor(panicPersist ? "var(--panic)" : hpSt.color),
      event: (() => {
        const lr = p.lastRollEvent;
        if (!lr || !lr.eventId) return null;
        if (lr.applied) return null;
        const until = alertState.flashUntilByPlayer.get(p.id) || 0;
        if (Date.now() >= until) return null;
        return {
          type: lr.type === "panic" ? "panic" : "stress",
          intensity: lr.type === "panic" ? 1.0 : 0.55,
          until,
        };
      })(),
    });

    // (ECG patch: could not auto-place; please re-run)
  }
  ecgEngine.removeMissing(new Set(state.players.map((p) => p.id)));
}

function bar(label, valueText, pct, isStress) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="bar-label"><div>${label}</div><div>${valueText}</div></div>
    <div class="bar"><div class="fill ${isStress ? "stress" : ""}" style="width:${pct}%"></div></div>
  `;
  return wrap;
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c],
  );
}

socket.on("connect", () => {
  linkStatusEl.textContent = "ONLINE";
});
socket.on("disconnect", () => {
  linkStatusEl.textContent = "OFFLINE";
});

socket.on("state", (s) => {
  state = s || { players: [] };
  render();
});

render();
