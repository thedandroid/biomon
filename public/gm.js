const socket = io();

const addForm = document.getElementById("addForm");
const openAddBtn = document.getElementById("openAdd");
const closeAddBtn = document.getElementById("closeAdd");
const addModal = document.getElementById("addModal");
const nameEl = document.getElementById("name");
const healthEl = document.getElementById("health");
const maxHealthEl = document.getElementById("maxHealth");
const stressEl = document.getElementById("stress");
const resolveEl = document.getElementById("resolve");
const gmList = document.getElementById("gmList");
const missionLog = document.getElementById("missionLog");
const clearPartyBtn = document.getElementById("clearParty");

let lastState = { players: [], missionLog: [] };
let isInitialLoad = true;

// Ephemeral UI state (not synced)
const ui = {
  modsByPlayerId: new Map(),
};

function fmt(n, digits = 0) {
  return Number(n).toFixed(digits);
}

function render() {
  if (isInitialLoad) {
    // Show loading state on initial page load
    gmList.innerHTML = `
      <div class="loading-overlay">
        <div class="spinner-lg"></div>
        <div class="loading-text">CONNECTING TO BIOMON...</div>
      </div>
    `;
    return;
  }
  
  gmList.innerHTML = "";
  for (const p of lastState.players) {
    const card = document.createElement("div");
    card.className = "gm-card";

    const hd = document.createElement("div");
    hd.className = "gm-card-hd";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="gm-name">${escapeHtml(p.name)}</div>
      <div class="mini">ID: <span class="pill">${escapeHtml(p.id.slice(0, 8))}</span></div>
    `;

    const actions = document.createElement("div");
    actions.className = "gm-actions";

    const del = document.createElement("button");
    del.className = "btn btn-ghost";
    del.textContent = "REMOVE";
    del.addEventListener("click", () =>
      socket.emit("player:remove", { id: p.id }),
    );

    actions.appendChild(del);
    hd.appendChild(left);
    hd.appendChild(actions);

    const rename = document.createElement("div");
    rename.className = "slider-row";
    rename.innerHTML = `
      <div class="mini">NAME</div>
      <input class="inp" style="padding:8px" value="${escapeAttr(p.name)}" maxlength="40" />
    `;
    const nameInput = rename.querySelector("input");
    let renameTimer = null;
    nameInput.addEventListener("input", () => {
      clearTimeout(renameTimer);
      renameTimer = setTimeout(() => {
        socket.emit("player:update", { id: p.id, name: nameInput.value });
      }, 300);
    });

    const healthRow = sliderRowHealth(p, (v) => {
      socket.emit("player:update", { id: p.id, health: Number(v) });
    });

    const stressRow = sliderRow("STRESS", 0, 10, 1, p.stress, (v) => {
      socket.emit("player:update", { id: p.id, stress: Number(v) });
    });

    const resolveRow = sliderRow("RESOLVE", 0, 10, 1, p.resolve ?? 0, (v) => {
      socket.emit("player:update", { id: p.id, resolve: Number(v) });
    });

    const conditions = conditionToggles(p);
    const effects = effectsPanel(p);
    const roller = rollerPanel(p);

    card.appendChild(hd);
    card.appendChild(rename);
    card.appendChild(sliderRowMaxHealth(p));
    card.appendChild(healthRow);
    card.appendChild(stressRow);
    card.appendChild(resolveRow);
    card.appendChild(conditions);
    card.appendChild(roller);
    card.appendChild(effects);

    gmList.appendChild(card);
  }
}

function conditionToggles(p) {
  const wrap = document.createElement("div");
  wrap.className = "conditions-row";
  
  // Single condition supported now
  const condition = "FATIGUE";
  
  // Helper to check if condition is active
  const isActive = (c) => {
    const type = `condition_${c.toLowerCase()}`;
    return (p.activeEffects || []).some(e => e.type === type && !e.clearedAt);
  };

  wrap.innerHTML = "<div class=\"mini\" style=\"margin-bottom: 6px;\">CONDITION</div>";
  
  const active = isActive(condition);
  const btn = document.createElement("button");
  // Use btn-block style logic (width 100%) or just let it fill the div if we don't use the grid class
  btn.className = `btn ${active ? "btn-condition-active" : "btn-condition-inactive"}`;
  btn.style.width = "100%"; 
  btn.textContent = condition;
  btn.title = `Toggle ${condition} condition`;
  
  btn.addEventListener("click", () => {
    socket.emit("condition:toggle", { 
      playerId: p.id, 
      condition: condition.toLowerCase(), 
    });
  });
  
  wrap.appendChild(btn);
  return wrap;
}

function rollerPanel(p) {
  const wrap = document.createElement("div");
  wrap.className = "roller";

  const modValue = ui.modsByPlayerId.has(p.id)
    ? ui.modsByPlayerId.get(p.id)
    : 0;

  wrap.innerHTML = `
    <div class="roller-hd">
      <div class="mini">ROLLER</div>
      <div class="roller-actions">
        <button class="btn btn-primary" data-act="stress">STRESS ROLL</button>
        <button class="btn btn-ghost" data-act="panic">PANIC ROLL</button>
      </div>
    </div>

    <div class="roller-row">
      <div class="mini">MOD</div>
      <div class="roller-mod">
        <button class="btn btn-ghost" data-act="mod-">-1</button>
        <input class="inp roller-inp" type="number" step="1" min="-10" max="10" value="${escapeAttr(modValue)}" />
        <button class="btn btn-ghost" data-act="mod+">+1</button>
      </div>
    </div>
  `;

  const modInput = wrap.querySelector("input");
  const setMod = (n) => {
    const v = Number(n);
    const clamped = Number.isFinite(v)
      ? Math.max(-10, Math.min(10, Math.trunc(v)))
      : 0;
    ui.modsByPlayerId.set(p.id, clamped);
    modInput.value = String(clamped);
  };

  modInput.addEventListener("change", () => setMod(modInput.value));

  wrap
    .querySelector("[data-act='mod-']")
    .addEventListener("click", () => setMod(Number(modInput.value || 0) - 1));
  wrap
    .querySelector("[data-act='mod+']")
    .addEventListener("click", () => setMod(Number(modInput.value || 0) + 1));

  wrap.querySelector("[data-act='stress']").addEventListener("click", () => {
    socket.emit("roll:trigger", {
      playerId: p.id,
      rollType: "stress",
      modifiers: Number(modInput.value || 0),
    });
  });
  wrap.querySelector("[data-act='panic']").addEventListener("click", () => {
    socket.emit("roll:trigger", {
      playerId: p.id,
      rollType: "panic",
      modifiers: Number(modInput.value || 0),
    });
  });

  const lr = p.lastRollEvent;
  if (lr && lr.eventId) {
    const out = document.createElement("div");
    out.className = `roller-out ${lr.type === "panic" ? "roller-out-panic" : "roller-out-stress"}`;

    const when = new Date(Number(lr.timestamp || Date.now()));
    const showLabel = lr.appliedTableEntryLabel || lr.tableEntryLabel || "";
    const showDesc =
        lr.appliedTableEntryDescription || lr.tableEntryDescription || "";

    out.innerHTML = `
        <div class="roller-out-header">
          <div class="mini">LAST ${escapeHtml(String(lr.type || "").toUpperCase())} ROLL</div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="mini timestamp">${escapeHtml(when.toLocaleTimeString())}</div>
            <button class="btn-close-roll" data-act="clear-roll" title="Clear roll history">×</button>
          </div>
        </div>

        <div class="roller-result-main">
          <div class="roller-big-number">${escapeHtml(String(lr.total))}</div>
          <div class="roller-result-text">
            <div class="roller-entry-label">${escapeHtml(showLabel)}</div>
            <div class="roller-entry-desc">${escapeHtml(showDesc)}</div>
          </div>
        </div>

        <div class="roller-math-row">
           <span class="pill-sm">D6: ${escapeHtml(String(lr.die))}</span>
           <span class="pill-sm">Stress: ${escapeHtml(String(lr.stress))}</span>
           ${lr.resolve ? `<span class="pill-sm">Resolve: -${escapeHtml(String(lr.resolve))}</span>` : ""}
           ${lr.modifiers ? `<span class="pill-sm">Mod: ${lr.modifiers > 0 ? "+" : ""}${escapeHtml(String(lr.modifiers))}</span>` : ""}
        </div>

        ${lr.duplicateAdjusted && lr.duplicateNote ? `
          <div class="roller-note warn">
            <span class="icon">⚠</span> ${escapeHtml(String(lr.duplicateNote))}
          </div>` : ""
}

        <div class="roller-actions-area">
          <div class="roller-apply-slot"></div>
          <button class="btn btn-ghost btn-sm" data-act="undo" ${lr.applied || lr.stressDeltaApplied ? "" : "disabled"}>UNDO</button>
        </div>
      `;

    const applySlot = out.querySelector(".roller-apply-slot");
      
    // Manual Stress Adjustment (if delta exists)
    const delta = Number(
      lr.appliedTableEntryStressDelta !== null &&
          lr.appliedTableEntryStressDelta !== undefined
        ? lr.appliedTableEntryStressDelta
        : lr.tableEntryStressDelta,
    );

    if (Number.isFinite(delta) && delta !== 0 && !lr.applied) {
      // Only show this hint if not applied yet, or maybe keep it?
      // Actually, typically we want to auto-apply stress changes if possible, 
      // but the system is manual. Let's keep the manual button but style it better.
    }
      
    // We will rebuild the actions logic slightly cleaner
    const options = Array.isArray(lr.applyOptions) ? lr.applyOptions : null;
    const isDuplicateStress =
        !lr.applied &&
        lr.type !== "panic" &&
        (Array.isArray(p.activeEffects) ? p.activeEffects : []).some(
          (e) =>
            !e?.clearedAt &&
            String(e?.type ?? "") === String(lr.tableEntryId ?? ""),
        );

    if (lr.applied) {
      const b = document.createElement("button");
      b.className = "btn btn-ghost btn-sm btn-disabled";
      b.innerHTML = "<span class=\"check-icon\">✓</span> APPLIED";
      applySlot.appendChild(b);
    } else if (isDuplicateStress) {
      const b = document.createElement("button");
      b.className = "btn btn-primary btn-sm btn-glow";
      b.title = "Duplicate stress response already active: apply as STRESS +1.";
      b.textContent = "APPLY: STRESS +1";
      b.addEventListener("click", () => {
        socket.emit("roll:apply", { playerId: p.id, eventId: lr.eventId });
      });
      applySlot.appendChild(b);
    } else if (options && options.length >= 2) {
      // Multi-option handling
      options.forEach((opt, idx) => {
        const b = document.createElement("button");
        // Highlight first option as primary
        b.className = `btn btn-sm ${idx === 0 ? "btn-primary" : "btn-ghost"}`;
        b.textContent = String(opt.label || "APPLY").toUpperCase();
        b.addEventListener("click", () => {
          socket.emit("roll:apply", {
            playerId: p.id,
            eventId: lr.eventId,
            tableEntryId: opt.tableEntryId,
          });
        });
        applySlot.appendChild(b);
      });
    } else if (lr.tableEntryPersistent) {
      // Only show APPLY button for persistent effects
      const b = document.createElement("button");
      b.className = "btn btn-primary btn-sm btn-glow";
      b.textContent = "APPLY EFFECT";
      b.addEventListener("click", () => {
        socket.emit("roll:apply", { playerId: p.id, eventId: lr.eventId });
      });
      applySlot.appendChild(b);
    }

    // Add the stress adjustment button *after* the main apply button if relevant
    if (Number.isFinite(delta) && delta !== 0) {
      if (lr.stressDeltaApplied) {
        // Show as applied
        const b = document.createElement("button");
        b.className = "btn btn-ghost btn-sm btn-disabled";
        b.innerHTML = `<span class="check-icon">✓</span> STRESS ${delta > 0 ? "+" : ""}${delta}`;
        applySlot.appendChild(b);
      } else {
        // Show as actionable
        const b = document.createElement("button");
        b.className = "btn btn-ghost btn-sm";
        b.title = "Adjust this crew member's stress (manual).";
        b.innerHTML = `STRESS <span style="color:${delta > 0 ? "var(--warn)" : "var(--ok)"}">${delta > 0 ? "+" : ""}${delta}</span>`;
        b.addEventListener("click", () => {
          socket.emit("roll:applyStressDelta", {
            playerId: p.id,
            eventId: lr.eventId,
          });
        });
        applySlot.appendChild(b);
      }
    }

    out.querySelector("[data-act='undo']").addEventListener("click", () => {
      socket.emit("roll:undo", { playerId: p.id, eventId: lr.eventId });
    });

    out.querySelector("[data-act='clear-roll']").addEventListener("click", () => {
      socket.emit("roll:clear", { playerId: p.id });
    });

    wrap.appendChild(out);
  }

  return wrap;
}

function effectsPanel(p) {
  const wrap = document.createElement("div");
  wrap.className = "effects";

  const live = (Array.isArray(p.activeEffects) ? p.activeEffects : []).filter(
    (e) => !e.clearedAt && e.type !== "condition_fatigue",
  );
  wrap.innerHTML = `
    <div class="effects-hd">
      <div class="mini">ACTIVE EFFECTS</div>
      <div class="mini">${escapeHtml(String(live.length))}</div>
    </div>
  `;


  if (!live.length) {
    const empty = document.createElement("div");
    empty.className = "mini";
    empty.style.marginTop = "8px";
    empty.textContent = "NONE";
    wrap.appendChild(empty);
    return wrap;
  }

  const list = document.createElement("div");
  list.className = "effects-list";

  for (const e of live) {
    const row = document.createElement("div");
    row.className = "effect-row";
    row.innerHTML = `
      <div class="effect-left">
        <span class="effect-label">${escapeHtml(e.label || e.type || "EFFECT")}</span>
      </div>
      <button class="btn btn-ghost">CLEAR</button>
    `;
    row.querySelector("button").addEventListener("click", () => {
      socket.emit("effect:clear", { playerId: p.id, effectId: e.id });
    });
    list.appendChild(row);
  }

  wrap.appendChild(list);
  return wrap;
}

function sliderRowHealth(p, onCommit) {
  const maxH = Number(p.maxHealth ?? 5);
  const curH = Number(p.health ?? 0);
  const row = document.createElement("div");
  row.className = "slider-row";
  row.innerHTML = `
    <div class="mini">HEALTH</div>
    <input type="range" min="0" max="${escapeAttr(maxH)}" step="1" value="${escapeAttr(curH)}" />
    <div class="pill">${escapeHtml(fmt(curH))}/${escapeHtml(fmt(maxH))}</div>
  `;
  const input = row.querySelector("input");
  const pill = row.querySelector(".pill");

  input.addEventListener("input", () => {
    pill.textContent = `${fmt(input.value)}/${fmt(maxH)}`;
  });

  input.addEventListener("change", () => {
    onCommit(input.value);
  });

  return row;
}

function sliderRowMaxHealth(p) {
  const row = document.createElement("div");
  row.className = "slider-row";
  row.innerHTML = `
    <div class="mini">MAX HP</div>
    <input type="range" min="1" max="10" step="1" value="${escapeAttr(p.maxHealth ?? 5)}" />
    <div class="pill">${escapeHtml(fmt(p.maxHealth ?? 5))}</div>
  `;
  const input = row.querySelector("input");
  const pill = row.querySelector(".pill");

  input.addEventListener("input", () => {
    pill.textContent = fmt(input.value);
  });

  input.addEventListener("change", () => {
    socket.emit("player:update", { id: p.id, maxHealth: Number(input.value) });
  });

  return row;
}

function sliderRow(label, min, max, step, value, onCommit) {
  const row = document.createElement("div");
  row.className = "slider-row";
  row.innerHTML = `
    <div class="mini">${label}</div>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${escapeAttr(value)}" />
    <div class="pill">${escapeHtml(fmt(value))}</div>
  `;
  const input = row.querySelector("input");
  const pill = row.querySelector(".pill");

  // While dragging: update UI only (no network spam / re-render fights)
  input.addEventListener("input", () => {
    pill.textContent = fmt(input.value);
  });

  // When user releases (or keyboard commit): send update once
  input.addEventListener("change", () => {
    onCommit(input.value);
  });

  return row;
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
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function setModalOpen(open) {
  if (!addModal) return;
  
  if (open) {
    // Opening: remove closing class, add open class, focus input
    addModal.classList.remove("closing");
    addModal.classList.add("open");
    addModal.setAttribute("aria-hidden", "false");
    setTimeout(() => nameEl?.focus?.(), 50);
  } else {
    // Closing: add closing class, wait for animation, then remove open class
    addModal.classList.add("closing");
    addModal.setAttribute("aria-hidden", "true");
    setTimeout(() => {
      addModal.classList.remove("open", "closing");
    }, 200); // Match CSS transition duration
  }
}

openAddBtn?.addEventListener("click", () => setModalOpen(true));
closeAddBtn?.addEventListener("click", () => setModalOpen(false));
addModal?.addEventListener("click", (e) => {
  const t = e.target;
  if (t && t.getAttribute && t.getAttribute("data-close") === "1")
    setModalOpen(false);
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setModalOpen(false);
});

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  socket.emit("player:add", {
    name: nameEl.value,
    health: Number(healthEl.value),
    stress: Number(stressEl.value),
    resolve: Number(resolveEl?.value ?? 0),
    maxHealth: Number(maxHealthEl.value),
  });
  nameEl.value = "";
  maxHealthEl.value = 5;
  healthEl.value = 5;
  stressEl.value = 0;
  if (resolveEl) resolveEl.value = 0;

  setModalOpen(false);
});

clearPartyBtn.addEventListener("click", () => {
  socket.emit("party:clear");
});

socket.on("state", (s) => {
  lastState = s || { players: [], missionLog: [] };
  isInitialLoad = false; // Clear initial loading state
  render();
  renderLog();
  updateSessionStatus(s);
});

function renderLog() {
  if (!missionLog) return;
  
  const entries = Array.isArray(lastState.missionLog) ? lastState.missionLog : [];
  
  // Diff check: if same length and first ID matches, skip (optimization)
  const currentFirst = missionLog.querySelector(".log-entry");
  if (currentFirst && entries.length > 0 && currentFirst.dataset.id === entries[0].id) {
    return;
  }
  
  missionLog.innerHTML = "";
  
  if (entries.length === 0) {
    const el = document.createElement("div");
    el.className = "log-entry system";
    el.innerHTML = `<span class="log-ts">[${new Date().toLocaleTimeString()}]</span> <span class="log-msg">READY.</span>`;
    missionLog.appendChild(el);
    return;
  }
  
  // Render newest first (state.missionLog is sorted newest first)
  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = `log-entry ${entry.type || "info"}`;
    row.dataset.id = entry.id;
    
    const ts = new Date(entry.timestamp).toLocaleTimeString();
    
    let html = `<span class="log-ts">[${ts}]</span> <span class="log-msg">${escapeHtml(entry.message)}</span>`;
    
    if (entry.details) {
      html += `<span class="log-detail">${escapeHtml(entry.details)}</span>`;
    }
    
    row.innerHTML = html;
    missionLog.appendChild(row);
  }
}

// ============================================================
// SESSION MANAGEMENT
// ============================================================

const sessionModal = document.getElementById("sessionModal");
const openSessionBtn = document.getElementById("openSession");
const closeSessionBtn = document.getElementById("closeSession");
const btnNewSession = document.getElementById("btnNewSession");
const btnSaveCampaign = document.getElementById("btnSaveCampaign");
const btnExport = document.getElementById("btnExport");
const btnImport = document.getElementById("btnImport");
const campaignNameInput = document.getElementById("campaignName");
const campaignList = document.getElementById("campaignList");
const lastSavedTimeEl = document.getElementById("lastSavedTime");
const importFileInput = document.getElementById("importFileInput");

function setSessionModalOpen(open) {
  if (!sessionModal) return;
  
  if (open) {
    // Opening: remove closing class, add open class, load campaigns
    sessionModal.classList.remove("closing");
    sessionModal.classList.add("open");
    sessionModal.setAttribute("aria-hidden", "false");
    setTimeout(() => loadCampaignList(), 50);
  } else {
    // Closing: add closing class, wait for animation, then remove open class
    sessionModal.classList.add("closing");
    sessionModal.setAttribute("aria-hidden", "true");
    setTimeout(() => {
      sessionModal.classList.remove("open", "closing");
    }, 200); // Match CSS transition duration
  }
}

openSessionBtn.addEventListener("click", () => setSessionModalOpen(true));
closeSessionBtn.addEventListener("click", () => setSessionModalOpen(false));

sessionModal.addEventListener("click", (e) => {
  if (e.target.dataset.close) setSessionModalOpen(false);
});

function updateSessionStatus(state) {
  if (state?.metadata?.lastSaved) {
    const date = new Date(state.metadata.lastSaved);
    lastSavedTimeEl.textContent = date.toLocaleString();
  } else {
    lastSavedTimeEl.textContent = "never";
  }
  
  if (state?.metadata?.campaignName) {
    campaignNameInput.placeholder = `Current: ${state.metadata.campaignName}`;
  }
}

// New Session
btnNewSession.addEventListener("click", async () => {
  const confirmed = await toast.confirm(
    "Clear current session and start fresh? This cannot be undone.",
    { title: "New Session", confirmText: "Clear Session" },
  );
  if (!confirmed) return;
  
  socket.emit("session:clear");
  campaignNameInput.value = "";
  toast.success("New session started.");
});

// Save Campaign
btnSaveCampaign.addEventListener("click", () => {
  const name = campaignNameInput.value.trim();
  if (!name) {
    toast.warning("Please enter a campaign name.");
    return;
  }
  
  btnSaveCampaign.disabled = true;
  btnSaveCampaign.innerHTML = '<span class="spinner" style="margin-right: 8px;"></span>SAVING...';
  socket.emit("session:save", { campaignName: name });
});

socket.on("session:save:result", (result) => {
  btnSaveCampaign.disabled = false;
  btnSaveCampaign.textContent = "SAVE CAMPAIGN";
  
  if (result.success) {
    toast.success(`Campaign saved: ${result.filename}`);
    campaignNameInput.value = "";
    loadCampaignList();
  } else {
    toast.error(`Failed to save campaign: ${result.error}`);
  }
});

// Load Campaign List
function loadCampaignList() {
  // Show loading state
  campaignList.innerHTML = `
    <div class="loading-overlay">
      <div class="spinner"></div>
      <div class="loading-text">LOADING CAMPAIGNS...</div>
    </div>
  `;
  socket.emit("session:list");
}

socket.on("session:list:result", (campaigns) => {
  if (!campaigns || campaigns.length === 0) {
    campaignList.innerHTML = '<div class="hint" style="padding: 14px">No saved campaigns found.</div>';
    return;
  }
  
  campaignList.innerHTML = "";
  for (const camp of campaigns) {
    const item = document.createElement("div");
    item.className = "campaign-item";
    
    const name = document.createElement("div");
    name.className = "campaign-name";
    name.textContent = camp.campaignName;
    
    const meta = document.createElement("div");
    meta.className = "campaign-meta";
    const savedDate = new Date(camp.lastSaved).toLocaleString();
    meta.textContent = `${camp.playerCount} players • Session ${camp.sessionCount} • ${savedDate}`;
    
    item.appendChild(name);
    item.appendChild(meta);
    
    item.addEventListener("click", async () => {
      const confirmed = await toast.confirm(
        `Load campaign "${camp.campaignName}"? Current session will be replaced.`,
        { title: "Load Campaign", confirmText: "Load" },
      );
      if (confirmed) {
        socket.emit("session:load", { filename: camp.filename });
      }
    });
    
    campaignList.appendChild(item);
  }
});

socket.on("session:load:result", (result) => {
  if (result.success) {
    toast.success("Campaign loaded successfully!");
    setSessionModalOpen(false);
  } else {
    toast.error(`Failed to load campaign: ${result.error}`);
  }
});

// Export Backup
btnExport.addEventListener("click", () => {
  btnExport.disabled = true;
  btnExport.innerHTML = '<span class="spinner" style="margin-right: 8px;"></span>EXPORTING...';
  socket.emit("session:export");
});

socket.on("session:export:result", (state) => {
  btnExport.disabled = false;
  btnExport.textContent = "EXPORT BACKUP";
  
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.download = `biomon-backup-${timestamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Backup exported!");
});

// Import Backup
btnImport.addEventListener("click", () => {
  importFileInput.click();
});

importFileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      const confirmed = await toast.confirm(
        "Import this backup? Current session will be replaced.",
        { title: "Import Backup", confirmText: "Import" },
      );
      if (confirmed) {
        socket.emit("session:import", data);
      }
    } catch (err) {
      toast.error("Failed to parse backup file: " + err.message);
    }
  };
  reader.readAsText(file);
  importFileInput.value = ""; // Reset for next use
});

socket.on("session:import:result", (result) => {
  if (result.success) {
    toast.success("Backup imported successfully!");
    setSessionModalOpen(false);
  } else {
    toast.error(`Failed to import backup: ${result.error}`);
  }
});

// Auto-save recovery prompt
socket.on("session:autosave:info", (info) => {
  if (info.found && info.playerCount > 0) {
    const savedDate = new Date(info.timestamp).toLocaleString();
    const msg = `Previous session found (${info.playerCount} players, saved ${savedDate}). Session has been automatically restored.`;
    setTimeout(() => toast.info(msg, { title: "Session Restored", duration: 6000 }), 500);
  }
});

// Connection status
socket.on("connect", () => {
  console.log("Connected to server");
});

socket.on("disconnect", () => {
  toast.warning("Disconnected from server. Attempting to reconnect...", { 
    duration: 0, 
    title: "Connection Lost", 
  });
});

socket.on("connect_error", () => {
  toast.error("Failed to connect to server.", { 
    duration: 0,
    title: "Connection Error", 
  });
});

// Initial render to show loading state
render();

