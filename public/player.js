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
    const needsInit = !it;
    
    if (needsInit) {
      // First time seeing this player ID - create new state with minimal defaults
      const ctx = canvas.getContext("2d");
      it = {
        canvas,
        ctx,
        buf: new Float32Array(canvas.width).fill(0), // Start with zeros
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
      
      // Update params BEFORE adding to items and BEFORE pre-filling
      it.params = { ...it.params, ...params };
      
      // Add to map so sample() can find it
      items.set(id, it);
      
      // DON'T pre-fill - let it fill naturally from tick()
      // Buffer starts with zeros, which will show as flatline initially
      // After ~8.67 seconds (520 frames), buffer will be fully populated
    } else {
      if (it.canvas !== canvas) {
        // Canvas was recreated (DOM refresh) - update references but keep buffer
        it.canvas = canvas;
        it.ctx = canvas.getContext("2d");
      }
      
      // Update params for existing item
      it.params = { ...it.params, ...params };
    }

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

    // If health is 0, flatline with minimal electrical noise
    if (hp <= 0) {
      it.t += 1 / 60;
      const tinyDrift = Math.sin((it.t * 0.1 + it.phase) * Math.PI * 2) * 0.002;
      const tinyNoise = (Math.random() - 0.5) * 0.006;
      return tinyDrift + tinyNoise;
    }

    // Heart rate varies with stress and health
    // Baseline: 60 BPM
    // Stress: +5 BPM per stress point (max +50 at stress 10)
    // Low health: +20 BPM when critically injured (compensatory tachycardia)
    const baseBPM = 60;
    const stressBPM = stress * 5;
    const injuryBPM = hpPct < 0.3 ? (1 - hpPct) * 20 : 0;
    const bpm = baseBPM + stressBPM + injuryBPM; // Range: 60-130 BPM
    const hz = bpm / 60;

    // Amplitude effects
    // Lower health -> weaker R wave (poor cardiac output)
    // Very low health -> more irregular beats (arrhythmia simulation)
    const baseAmp = 0.7 * (0.3 + 0.7 * hpPct); // Decreases with injury
    
    // High stress -> slightly increased amplitude (adrenaline)
    const stressAmpBoost = stress > 6 ? 1.1 : 1.0;
    const amp = baseAmp * stressAmpBoost;

    // Roll event overlay (stress: mild disturbance, panic: strong spike)
    const ev = it.params.event;
    const evActive = ev && ev.until && nowMs() < ev.until;
    const evIntensity = evActive
      ? Math.max(0, Math.min(1, Number(ev.intensity ?? 0)))
      : 0;
    const evPanic = evActive && ev.type === "panic";

    // Time progression (normalized)
    it.t += 1 / 60;
    let p = (it.t * hz + it.phase) % 1; // 0..1
    if (p < 0) p += 1; // Handle negative modulo

    // ECG waveform generation
    let y = 0;
    
    // P wave (atrial depolarization)
    // Smaller with high stress (anxiety flattens P wave)
    const pWaveAmp = 0.18 * (1 - stress * 0.03);
    if (p > 0.08 && p < 0.16) {
      const u = (p - 0.08) / 0.08;
      y += pWaveAmp * Math.sin(u * Math.PI);
    }
    
    // QRS complex (ventricular depolarization)
    if (p > 0.20 && p < 0.28) {
      const u = (p - 0.20) / 0.08;
      
      // Q wave (small dip)
      if (u < 0.25) {
        y += -0.2 * Math.sin(u * 4 * Math.PI);
      } 
      // R wave (tall spike) - main feature
      else if (u < 0.75) {
        const ru = (u - 0.25) / 0.5;
        y += 0.9 * Math.sin(ru * Math.PI);
      } 
      // S wave (small dip)
      else {
        const su = (u - 0.75) / 0.25;
        y += -0.15 * Math.sin(su * Math.PI);
      }
    }
    
    // T wave (ventricular repolarization)
    // Taller and wider with high stress (stress-induced T wave changes)
    const tWaveAmp = 0.3 * (1 + stress * 0.04);
    const tWaveWidth = stress > 7 ? 0.18 : 0.16; // Wider when very stressed
    const tWaveStart = 0.34;
    const tWaveEnd = tWaveStart + tWaveWidth;
    if (p > tWaveStart && p < tWaveEnd) {
      const u = (p - tWaveStart) / tWaveWidth;
      y += tWaveAmp * Math.sin(u * Math.PI);
    }

    // ST segment changes (between S and T wave)
    // Depression with low health (ischemia simulation)
    // Elevation with very high stress (acute stress response)
    let stChange = 0;
    if (p > 0.28 && p < 0.34) {
      if (hpPct < 0.4) {
        // ST depression (heart struggling)
        stChange = -0.08 * (1 - hpPct);
      } else if (stress >= 9) {
        // ST elevation (extreme stress)
        stChange = 0.06 * ((stress - 8) / 2);
      }
    }
    y += stChange;

    // Baseline drift (respiration artifact)
    // More pronounced with stress (heavy breathing)
    const driftFreq = 0.15 + (stress / 10) * 0.1; // Faster breathing when stressed
    const driftAmp = 0.05 + (stress / 10) * 0.03;
    const drift = Math.sin((it.t * driftFreq + it.phase) * Math.PI * 2) * driftAmp;
    
    // Baseline wander with low health (poor lead contact / patient movement)
    const healthWander = hpPct < 0.5 
      ? Math.sin((it.t * 0.08 + it.phase * 2) * Math.PI * 2) * 0.04 * (1 - hpPct)
      : 0;
    
    // High-frequency noise (muscle tremor, electrical interference)
    // Increases with stress (muscle tension) and low health (shivering, weakness)
    const noiseLevel = 0.008 + (stress / 10) * 0.015 + (1 - hpPct) * 0.01;
    const jitter = (stress > 0 || hpPct < 0.8 || evActive)
      ? (Math.random() - 0.5) * (noiseLevel + evIntensity * (evPanic ? 0.04 : 0.02))
      : 0;

    // Occasional ectopic beats (premature ventricular contractions)
    // More common with stress or injury
    let ectopicBeat = 0;
    const ectopicChance = (stress > 5 ? 0.005 : 0) + (hpPct < 0.5 ? 0.008 : 0);
    if (Math.random() < ectopicChance && p > 0.6 && p < 0.65) {
      // Wide, bizarre QRS (PVC)
      const pu = (p - 0.6) / 0.05;
      ectopicBeat = 0.6 * Math.sin(pu * Math.PI);
    }

    // Panic event spikes (only during active panic events)
    let panicSpike = 0;
    if (evActive && evPanic) {
      // Random large deflections during panic
      const spikeChance = 0.12;
      if (Math.random() < spikeChance) {
        panicSpike = (Math.random() - 0.5) * 1.2 * evIntensity;
      }
    }

    return y * amp + drift + healthWander + jitter + ectopicBeat + panicSpike;
  }

  function draw(it) {
    const c = it.canvas;
    const ctx = it.ctx;
    const W = c.width,
      H = c.height;

    const mid = Math.floor(H * 0.55);
    const scale = H * 0.32;

    // Clear the entire canvas first
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

    // Phosphor glow rendering with trailing fade and vertical gradient
    const baseColor = it.params.ecgColor || "rgba(108,255,184,1)";
    
    // Extract RGB from rgba string for glow
    const rgbMatch = baseColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    const r = rgbMatch ? rgbMatch[1] : "108";
    const g = rgbMatch ? rgbMatch[2] : "255";
    const b = rgbMatch ? rgbMatch[3] : "184";

    // Pass 1: Outer glow (widest, faintest)
    ctx.shadowBlur = 20;
    ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
    ctx.strokeStyle = `rgba(${r},${g},${b},0.3)`;
    ctx.lineWidth = 6;

    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const idx = (it.x + x) % W;
      const yy = mid - it.buf[idx] * scale;
      
      // Trailing fade: older samples fade out
      const distFromHead = (W + idx - it.x) % W;
      const fadeFactor = 1 - (distFromHead / W) * 0.5; // Fade from 1.0 to 0.5
      
      ctx.globalAlpha = 0.7 * fadeFactor;
      
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();

    // Pass 2: Inner glow (tighter, brighter)
    ctx.shadowBlur = 8;
    ctx.shadowColor = `rgba(${r},${g},${b},1)`;
    ctx.strokeStyle = `rgba(${r},${g},${b},0.8)`;
    ctx.lineWidth = 3;

    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const idx = (it.x + x) % W;
      const yy = mid - it.buf[idx] * scale;
      
      const distFromHead = (W + idx - it.x) % W;
      const fadeFactor = 1 - (distFromHead / W) * 0.5;
      
      ctx.globalAlpha = 0.9 * fadeFactor;
      
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();

    // Pass 3: Sharp main trace with vertical brightness gradient
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    
    // Create vertical gradient for the trace (brighter at peaks, dimmer at troughs)
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, `rgba(${r},${g},${b},0.6)`);    // Top - dimmer
    gradient.addColorStop(0.4, `rgba(${r},${g},${b},1.0)`);  // Upper-mid - bright
    gradient.addColorStop(0.6, `rgba(${r},${g},${b},1.0)`);  // Lower-mid - bright
    gradient.addColorStop(1, `rgba(${r},${g},${b},0.6)`);    // Bottom - dimmer
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;

    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const idx = (it.x + x) % W;
      const yy = mid - it.buf[idx] * scale;
      
      // Same trailing fade for consistency
      const distFromHead = (W + idx - it.x) % W;
      const fadeFactor = 1 - (distFromHead / W) * 0.5;
      
      ctx.globalAlpha = 1.0 * fadeFactor;
      
      if (x === 0) ctx.moveTo(x, yy);
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
