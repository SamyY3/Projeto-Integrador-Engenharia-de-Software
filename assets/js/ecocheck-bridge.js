

(function () {
  "use strict";

  var LOADING_MAX_MS = 12000;
  var loadingTimer = null;

  window.EcoCheckConfig = window.EcoCheckConfig || {};
  if (!window.EcoCheckConfig.apiUrl) {
    var path = window.location.pathname.replace(/\\/g, "/");
    var m = path.match(/^(.*\/)(?:auth|admin|pages|mapa)\/[^/]+$/);
    var base = m ? m[1] : path.replace(/\/[^/]*$/, "/");
    if (base && base.charAt(base.length - 1) !== "/") {
      base += "/";
    }
    window.EcoCheckConfig.apiUrl = (base || "/") + "api/ecocheck-api.php";
  }

  var ICON_MARKUP =
    '<span class="ecocheck-trigger__icon" data-ecocheck-icon aria-hidden="true">' +
    '<svg class="ecocheck-icon ecocheck-icon--loading" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="8.5" stroke="#c5d9cc" stroke-width="2.5"/>' +
    '<path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" stroke="#12895d" stroke-width="2.5" stroke-linecap="round"/>' +
    "</svg>" +
    '<svg class="ecocheck-icon ecocheck-icon--verified" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path class="ecocheck-check-path" d="M7.2 12.3l2.8 2.7 6.8-7" stroke="#0f6b38" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg></span>";

  function isVerified() {
    return !!(
      window.EcoCheck &&
      typeof window.EcoCheck.hasValidToken === "function" &&
      window.EcoCheck.hasValidToken()
    );
  }

  function clearLoadingTimer() {
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
  }

  function setLabel(btn, text) {
    var label = btn.querySelector(".ecocheck-trigger__label");
    if (label) label.textContent = text;
  }

  function upgradeTriggerMarkup(btn) {
    if (!btn) return;
    var iconWrap = btn.querySelector("[data-ecocheck-icon]");
    if (!iconWrap) {
      var oldIcon = btn.querySelector(".ecocheck-trigger__icon");
      if (oldIcon) oldIcon.outerHTML = ICON_MARKUP;
    } else if (
      iconWrap.querySelector(".ecocheck-icon--idle") ||
      iconWrap.querySelector(".ecocheck-icon--pending") ||
      iconWrap.querySelector(".ecocheck-icon--verified circle") ||
      iconWrap.querySelector(".ecocheck-icon--verified rect")
    ) {
      iconWrap.outerHTML = ICON_MARKUP;
    }
    var title = btn.querySelector(".ecocheck-trigger__title");
    if (title && !btn.querySelector(".ecocheck-trigger__label")) {
      title.className = "ecocheck-trigger__label";
    }
    if (!btn.querySelector(".ecocheck-trigger__label")) {
      var lbl = document.createElement("span");
      lbl.className = "ecocheck-trigger__label";
      lbl.textContent = "Não sou um robô";
      var mainEl = btn.querySelector(".ecocheck-trigger__main");
      if (mainEl) mainEl.appendChild(lbl);
    }
    if (!btn.querySelector(".ecocheck-trigger__brand")) {
      var brand = document.createElement("span");
      brand.className = "ecocheck-trigger__brand";
      brand.setAttribute("aria-hidden", "true");
      brand.innerHTML =
        '<span class="ecocheck-trigger__brand-name">EcoCheck</span>' +
        '<span class="ecocheck-trigger__brand-tag">ANTI-BOT</span>';
      btn.appendChild(brand);
    }
    btn.querySelector(".ecocheck-trigger__status")?.remove();
    btn.querySelector(".ecocheck-trigger__sub")?.remove();
  }

  function applyTriggerState(btn, state) {
    if (!btn) return;
    upgradeTriggerMarkup(btn);

    btn.classList.remove("is-idle", "is-pending", "is-loading", "is-verified", "is-challenge");

    if (state === "verified" || isVerified()) {
      btn.classList.add("is-verified");
      setLabel(btn, "Verificado");
      btn.disabled = true;
      btn.setAttribute("aria-label", "Verificação EcoCheck concluída");
      return;
    }

    if (state === "loading") {
      btn.classList.add("is-loading");
      setLabel(btn, "Verificando…");
      btn.disabled = true;
      btn.setAttribute("aria-label", "Verificando EcoCheck");
      return;
    }

    if (state === "challenge") {
      btn.classList.add("is-challenge");
      setLabel(btn, "Não sou um robô");
      btn.disabled = false;
      btn.setAttribute("aria-label", "Conclua o puzzle EcoCheck");
      return;
    }

    btn.classList.add("is-idle");
    setLabel(btn, "Não sou um robô");
    btn.disabled = false;
    btn.setAttribute("aria-label", "Abrir verificação EcoCheck");
  }

  function forEachTrigger(fn) {
    document.querySelectorAll("[data-ecocheck-open]").forEach(fn);
  }

  function updateStatus() {
    clearLoadingTimer();
    var state = isVerified() ? "verified" : "idle";
    forEachTrigger(function (btn) {
      applyTriggerState(btn, state);
    });
  }

  function setAllLoading() {
    clearLoadingTimer();
    forEachTrigger(function (btn) {
      applyTriggerState(btn, "loading");
    });
    loadingTimer = setTimeout(function () {
      loadingTimer = null;
      if (!isVerified()) {
        forEachTrigger(function (btn) {
          applyTriggerState(btn, "idle");
        });
      } else {
        updateStatus();
      }
    }, LOADING_MAX_MS);
  }

  function setAllChallenge() {
    clearLoadingTimer();
    if (isVerified()) {
      updateStatus();
      return;
    }
    forEachTrigger(function (btn) {
      applyTriggerState(btn, "challenge");
    });
  }

  function bindTriggers() {
    var opening = false;
    forEachTrigger(function (btn) {
      if (btn.getAttribute("data-ecocheck-bound") === "1") return;
      btn.setAttribute("data-ecocheck-bound", "1");
      upgradeTriggerMarkup(btn);
      applyTriggerState(btn, isVerified() ? "verified" : "idle");

      btn.addEventListener("click", async function () {
        if (isVerified() || opening) return;

        if (!window.EcoCheck || typeof window.EcoCheck.open !== "function") {
          alert("EcoCheck não carregou. Verifique ecocheck.iife.js.");
          return;
        }

        opening = true;
        try {
          await window.EcoCheck.open();
        } catch (e) {

        } finally {
          opening = false;
        }
        updateStatus();
      });
    });
    updateStatus();
  }

  document.addEventListener("ecocheck:challenge-ready", setAllChallenge);
  document.addEventListener("ecocheck:verifying", setAllLoading);
  document.addEventListener("ecocheck:verify-done", function () {
    clearLoadingTimer();
    if (isVerified()) {
      updateStatus();
      return;
    }
    var modalOpen = document.querySelector("#ecocheck-root .ec-overlay");
    if (modalOpen) {
      forEachTrigger(function (btn) {
        applyTriggerState(btn, "challenge");
      });
      return;
    }
    setAllChallenge();
  });
  document.addEventListener("ecocheck:verified", updateStatus);
  document.addEventListener("ecocheck:modal-closed", function () {
    if (!isVerified()) updateStatus();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindTriggers);
  } else {
    bindTriggers();
  }

  document.addEventListener("ecocheck:ready", bindTriggers);

  function resetVerification() {
    clearLoadingTimer();
    if (window.EcoCheck && typeof window.EcoCheck.clearToken === "function") {
      window.EcoCheck.clearToken();
    }
    if (window.EcoAntiBot && typeof window.EcoAntiBot.reset === "function") {
      window.EcoAntiBot.reset();
    }
    forEachTrigger(function (btn) {
      applyTriggerState(btn, "idle");
    });
  }

  document.addEventListener("ecocheck:reset", resetVerification);

  window.EcoCheckBridge = {
    updateStatus: updateStatus,
    reset: resetVerification,
  };
})();
