// Toast notification system for BIOMON
// Usage: toast.show(message, options)

const toast = (() => {
  let container = null;
  let toastCounter = 0;

  // Initialize container
  function init() {
    if (container) return;
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  // Create and show a toast
  function show(message, options = {}) {
    init();

    const {
      type = "info", // 'info', 'success', 'warning', 'error'
      title = getTitleForType(type),
      duration = 4000, // Auto-dismiss after ms (0 = manual dismiss only)
      dismissible = true,
    } = options;

    const toastId = `toast-${Date.now()}-${toastCounter++}`;
    const toastEl = document.createElement("div");
    toastEl.className = `toast toast-${type}`;
    toastEl.id = toastId;

    const headerHTML = `
      <div class="toast-header">
        <div class="toast-title">${escapeHtml(title)}</div>
        ${dismissible ? '<button class="toast-close" aria-label="Close">×</button>' : ""}
      </div>
    `;

    const messageHTML = `<div class="toast-message">${escapeHtml(message)}</div>`;

    toastEl.innerHTML = headerHTML + messageHTML;

    // Click to dismiss
    if (dismissible) {
      const closeBtn = toastEl.querySelector(".toast-close");
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dismiss(toastId);
      });

      // Click toast body to dismiss
      toastEl.addEventListener("click", () => dismiss(toastId));
    }

    // Add to container
    container.appendChild(toastEl);

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => dismiss(toastId), duration);
    }

    return toastId;
  }

  // Dismiss a toast
  function dismiss(toastId) {
    const toastEl = document.getElementById(toastId);
    if (!toastEl) return;

    toastEl.classList.add("toast-exit");
    setTimeout(() => {
      if (toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
      }
    }, 250); // Match animation duration
  }

  // Dismiss all toasts
  function dismissAll() {
    if (!container) return;
    const toasts = container.querySelectorAll(".toast");
    toasts.forEach((t) => {
      t.classList.add("toast-exit");
    });
    setTimeout(() => {
      if (container) container.innerHTML = "";
    }, 250);
  }

  // Get default title for type
  function getTitleForType(type) {
    switch (type) {
    case "success":
      return "Success";
    case "warning":
      return "Warning";
    case "error":
      return "Error";
    case "info":
    default:
      return "Info";
    }
  }

  // Escape HTML
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Convenience methods
  function info(message, options = {}) {
    return show(message, { ...options, type: "info" });
  }

  function success(message, options = {}) {
    return show(message, { ...options, type: "success" });
  }

  function warning(message, options = {}) {
    return show(message, { ...options, type: "warning" });
  }

  function error(message, options = {}) {
    return show(message, { ...options, type: "error" });
  }

  // Confirm dialog replacement (using toasts)
  function confirm(message, options = {}) {
    return new Promise((resolve) => {
      init();

      const {
        title = "Confirm",
        confirmText = "Confirm",
        cancelText = "Cancel",
      } = options;

      const toastId = `toast-${Date.now()}-${toastCounter++}`;
      const toastEl = document.createElement("div");
      toastEl.className = "toast toast-warning";
      toastEl.id = toastId;

      toastEl.innerHTML = `
        <div class="toast-header">
          <div class="toast-title">${escapeHtml(title)}</div>
        </div>
        <div class="toast-message" style="margin-bottom: 12px;">${escapeHtml(message)}</div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button class="btn btn-sm toast-cancel-btn">${escapeHtml(cancelText)}</button>
          <button class="btn btn-sm toast-confirm-btn">${escapeHtml(confirmText)}</button>
        </div>
      `;

      const confirmBtn = toastEl.querySelector(".toast-confirm-btn");
      const cancelBtn = toastEl.querySelector(".toast-cancel-btn");

      confirmBtn.addEventListener("click", () => {
        dismiss(toastId);
        resolve(true);
      });

      cancelBtn.addEventListener("click", () => {
        dismiss(toastId);
        resolve(false);
      });

      container.appendChild(toastEl);
    });
  }

  return {
    show,
    dismiss,
    dismissAll,
    info,
    success,
    warning,
    error,
    confirm,
  };
})();
