/* ui/components.js — UI-компоненты: фото-модалка, авто-grow textarea, копирование */

(function () {
  // ---------- Textarea auto-grow (1 строка -> растёт до 2-3, дальше скролл) ----------
  window.attachAutoGrow = function attachAutoGrow(textarea, { maxRows = 3 } = {}) {
    if (!textarea) return;

    const lineHeight = () => {
      const lh = parseFloat(getComputedStyle(textarea).lineHeight || "20");
      return Number.isFinite(lh) ? lh : 20;
    };

    const resize = () => {
      textarea.style.height = "auto";
      const lh = lineHeight();
      const maxH = lh * maxRows + 16; // padding запас
      const next = Math.min(textarea.scrollHeight, maxH);
      textarea.style.height = next + "px";
      textarea.style.overflowY = textarea.scrollHeight > maxH ? "auto" : "hidden";
    };

    textarea.addEventListener("input", resize);
    setTimeout(resize, 0);
  };

  // ---------- Clipboard ----------
  window.copyTextToClipboard = async function copyTextToClipboard(text) {
    const value = String(text || "");
    if (!value) return false;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // fall through to legacy fallback
    }

    try {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "readonly");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.width = "1px";
      ta.style.height = "1px";
      ta.style.opacity = "0";
      ta.style.fontSize = "16px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, value.length);
      const ok = typeof document.execCommand === "function" && document.execCommand("copy");
      document.body.removeChild(ta);
      return Boolean(ok);
    } catch {
      return false;
    }
  };

  window.selectCopyField = function selectCopyField(input) {
    if (!input) return;
    try {
      input.focus();
      input.select();
      input.setSelectionRange(0, input.value.length);
    } catch {
      try {
        input.focus();
      } catch {
        // no-op
      }
    }
  };

  // ---------- Image modal (multiple photos) ----------
  let _modal = null;
  let _imgs = [];
  let _idx = 0;

  function ensureModal() {
    if (_modal) return _modal;

    const overlay = document.getElementById("imgModal");
    const img = document.getElementById("imgModalImg");
    const closeBtn = document.getElementById("imgClose");
    const prevBtn = document.getElementById("imgPrev");
    const nextBtn = document.getElementById("imgNext");
    const caption = document.getElementById("imgCaption");

    if (!overlay || !img || !closeBtn) {
      // If markup not present — silently no-op
      _modal = { ok: false };
      return _modal;
    }

    const close = () => {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    };

    closeBtn.onclick = close;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    img.addEventListener("click", close);

    if (prevBtn) prevBtn.onclick = () => showIndex(_idx - 1);
    if (nextBtn) nextBtn.onclick = () => showIndex(_idx + 1);

    document.addEventListener("keydown", (e) => {
      if (!overlay.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") showIndex(_idx - 1);
      if (e.key === "ArrowRight") showIndex(_idx + 1);
    });

    _modal = { ok: true, overlay, img, closeBtn, prevBtn, nextBtn, caption };
    return _modal;
  }

  function showIndex(i) {
    const modal = ensureModal();
    if (!modal.ok) return;

    if (!_imgs.length) return;
    _idx = (i + _imgs.length) % _imgs.length;

    const src = _imgs[_idx];
    modal.img.src = src;

    if (modal.caption) {
      modal.caption.textContent = _imgs.length > 1 ? `${_idx + 1} / ${_imgs.length}` : "";
    }

    // show/hide arrows
    if (modal.prevBtn) modal.prevBtn.style.display = _imgs.length > 1 ? "" : "none";
    if (modal.nextBtn) modal.nextBtn.style.display = _imgs.length > 1 ? "" : "none";

  }

  // public: open modal with one or many photos (urls or dataURLs)
  window.openImageModal = function openImageModal(photos, startIndex = 0) {
    const modal = ensureModal();
    if (!modal.ok) return;

    _imgs = (photos || []).map((u) => driveToDirect(u)).filter(Boolean);
    if (!_imgs.length) return;

    document.body.classList.add("modal-open");
    modal.overlay.classList.add("open");
    modal.overlay.setAttribute("aria-hidden", "false");
    showIndex(startIndex);
  };
})();
