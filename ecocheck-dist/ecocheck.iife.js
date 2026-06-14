/**
 * EcoCheck — bundle IIFE (gerado a partir da lógica em ecocheck/src)
 * Expõe window.EcoCheck e window.EcoAntiBot (compatível com formulários legados).
 */
(function (global) {
  "use strict";

  var TOKEN_KEY = "ecocheck_token";
  var TOKEN_EXP_KEY = "ecocheck_token_exp";

  /** HumanBehaviorValidator — detecta automação simples via trajetória do pointer. */
  function HumanBehaviorValidator() {
    this.samples = [];
    this.startedAt = 0;
  }

  HumanBehaviorValidator.prototype.start = function () {
    this.samples = [];
    this.startedAt = performance.now();
  };

  HumanBehaviorValidator.prototype.reset = function () {
    this.samples = [];
    this.startedAt = 0;
  };

  HumanBehaviorValidator.prototype.addSample = function (x, y) {
    if (!this.startedAt) this.startedAt = performance.now();
    var last = this.samples[this.samples.length - 1];
    if (last && last.x === x && last.y === y) return;
    this.samples.push({ x: x, y: y, t: performance.now() });
  };

  HumanBehaviorValidator.prototype.analyze = function () {
    var durationMs = this.startedAt ? performance.now() - this.startedAt : 0;
    var sampleCount = this.samples.length;

    if (durationMs < 350) {
      return this._fail("Interação muito rápida.", durationMs, sampleCount);
    }
    if (sampleCount < 4) {
      return this._fail("Poucos movimentos registrados.", durationMs, sampleCount);
    }

    var totalDistance = 0;
    var velocities = [];
    for (var i = 1; i < this.samples.length; i++) {
      var a = this.samples[i - 1];
      var b = this.samples[i];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var dist = Math.hypot(dx, dy);
      var dt = Math.max(1, b.t - a.t);
      totalDistance += dist;
      velocities.push(dist / dt);
    }

    var first = this.samples[0];
    var last = this.samples[this.samples.length - 1];
    var straightLine = Math.hypot(last.x - first.x, last.y - first.y);
    var straightRatio = totalDistance > 0 ? Math.min(1, straightLine / totalDistance) : 1;

    var avg = velocities.reduce(function (s, v) { return s + v; }, 0) / Math.max(1, velocities.length);
    var variance = velocities.reduce(function (s, v) { return s + Math.pow(v - avg, 2); }, 0) / Math.max(1, velocities.length);
    var velocityStd = Math.sqrt(variance);

    var metrics = {
      durationMs: Math.round(durationMs),
      sampleCount: sampleCount,
      straightRatio: Number(straightRatio.toFixed(4)),
      velocityStd: Number(velocityStd.toFixed(4)),
      totalDistance: Number(totalDistance.toFixed(2)),
    };

    if (straightRatio > 0.985 && velocityStd < 0.02 && durationMs < 900) {
      return { ok: false, reason: "Movimento retilíneo demais.", metrics: metrics };
    }
    if (velocityStd < 0.015 && durationMs < 1200) {
      return { ok: false, reason: "Velocidade suspeita.", metrics: metrics };
    }
    return { ok: true, metrics: metrics };
  };

  HumanBehaviorValidator.prototype._fail = function (reason, durationMs, sampleCount) {
    return {
      ok: false,
      reason: reason,
      metrics: {
        durationMs: Math.round(durationMs),
        sampleCount: sampleCount,
        straightRatio: 1,
        velocityStd: 0,
        totalDistance: 0,
      },
    };
  };

  /** VerificationService — API ecocheck-api.php + token em sessionStorage. */
  function VerificationService(apiUrl) {
    this.apiUrl = apiUrl || "ecocheck-api.php";
  }

  VerificationService.prototype.fetchChallenge = function () {
    var self = this;
    var url = this.apiUrl + "?action=challenge&_=" + Date.now();
    return fetch(url, { credentials: "same-origin", cache: "no-store" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.sucesso || !data.challengeId) {
          throw new Error(data.erro || "Não foi possível carregar o desafio.");
        }
        return {
          challengeId: data.challengeId,
          width: data.width || 300,
          height: data.height || 150,
          pieceSize: data.pieceSize || 52,
          pieceY: data.pieceY || 49,
          background: data.background,
          piece: data.piece,
        };
      });
  };

  VerificationService.prototype.verify = function (challengeId, positionX, metrics, honeypot) {
    var self = this;
    return fetch(this.apiUrl + "?action=verify", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeId: challengeId,
        positionX: Math.round(positionX),
        durationMs: metrics.durationMs,
        sampleCount: metrics.sampleCount,
        straightRatio: metrics.straightRatio,
        velocityStd: metrics.velocityStd,
        honeypot: honeypot || "",
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.sucesso && data.token) {
          self.saveToken(data.token, data.expiresIn || 600);
        }
        return data;
      });
  };

  VerificationService.prototype.saveToken = function (token, expiresInSec) {
    var exp = Date.now() + expiresInSec * 1000;
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(TOKEN_EXP_KEY, String(exp));
  };

  VerificationService.prototype.getToken = function () {
    var token = sessionStorage.getItem(TOKEN_KEY);
    var exp = Number(sessionStorage.getItem(TOKEN_EXP_KEY) || 0);
    if (!token || exp < Date.now()) {
      this.clearToken();
      return null;
    }
    return token;
  };

  VerificationService.prototype.hasValidToken = function () {
    return !!this.getToken();
  };

  VerificationService.prototype.clearToken = function () {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXP_KEY);
  };

  /** UI do modal + puzzle deslizante. */
  function EcoCheckUI(verificationService) {
    this.verificationService = verificationService;
    this.root = null;
    this.open = false;
    this.status = "idle";
    this.challenge = null;
    this.message = "";
    this.honeypot = "";
    this.resolveOpen = null;
    this._dragging = false;
    this._offsetX = 0;
    this._validator = new HumanBehaviorValidator();
    this._trackEl = null;
    this._pieceEl = null;
    this._handleEl = null;
    this._maxX = 0;
    this._openPromise = null;
    this._verifying = false;
  }

  EcoCheckUI.prototype.mount = function () {
    var existing = document.getElementById("ecocheck-root");
    if (existing) {
      this.root = existing;
      return;
    }
    if (!document.body) {
      return;
    }
    this.root = document.createElement("div");
    this.root.id = "ecocheck-root";
    document.body.appendChild(this.root);
  };

  EcoCheckUI.prototype.ensureRoot = function () {
    if (!this.root) {
      this.mount();
    }
    return !!this.root;
  };

  EcoCheckUI.prototype.render = function () {
    var self = this;
    if (!this.ensureRoot()) {
      return;
    }
    if (!this.open) {
      this.root.innerHTML = "";
      return;
    }

    var html =
      '<div class="ec-overlay" role="dialog" aria-modal="true" aria-labelledby="ecocheck-title">' +
      '<div class="ec-modal">' +
      '<div class="ec-modal__head">' +
      '<div><p class="ec-modal__brand">EcoCheck</p><h2 id="ecocheck-title" class="ec-modal__title">Verificação humana</h2></div>' +
      '<button type="button" class="ec-modal__close" data-ec-close aria-label="Fechar">×</button>' +
      "</div>" +
      '<div class="ec-modal__body">' +
      '<p class="ec-modal__hint">Arraste a peça do puzzle até o encaixe correto. Isso confirma que você não é um robô.</p>' +
      '<input type="text" name="ecocheck_hp" class="ec-hp" tabindex="-1" autocomplete="off" aria-hidden="true" data-ec-hp />' +
      '<div data-ec-content></div>' +
      "</div>" +
      '<div class="ec-modal__foot">' +
      '<button type="button" class="ec-btn ec-btn--ghost" data-ec-close>Cancelar</button>' +
      (this.status === "error" || this.status === "playing"
        ? '<button type="button" class="ec-btn ec-btn--primary" data-ec-reload>Novo puzzle</button>'
        : "") +
      "</div></div></div>";

    this.root.innerHTML = html;

    this.root.querySelectorAll("[data-ec-close]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        self.closeModal(false, "Verificação cancelada.");
      });
    });

    var reloadBtn = this.root.querySelector("[data-ec-reload]");
    if (reloadBtn) {
      reloadBtn.addEventListener("click", function () {
        self.loadChallenge();
      });
    }

    var hp = this.root.querySelector("[data-ec-hp]");
    if (hp) {
      hp.value = this.honeypot;
      hp.addEventListener("input", function (e) {
        self.honeypot = e.target.value;
      });
    }

    this.renderContent();
  };

  EcoCheckUI.prototype.renderContent = function () {
    var container = this.root.querySelector("[data-ec-content]");
    if (!container) return;

    if (this.status === "loading") {
      container.innerHTML =
        '<div class="ec-loading"><div class="ec-loading__spinner"></div><p class="ec-loading__text">Carregando desafio…</p></div>';
      return;
    }

    if (this.status === "success") {
      container.innerHTML =
        '<div class="ec-success"><div class="ec-success__icon">✓</div><p class="ec-success__text">' +
        escapeHtml(this.message || "Verificado com sucesso!") +
        "</p></div>";
      return;
    }

    if (this.status === "error") {
      container.innerHTML =
        '<div class="ec-error">' + escapeHtml(this.message || "Falha na verificação.") + "</div>";
      return;
    }

    if (this.status === "playing" && this.challenge) {
      container.innerHTML = "";
      this.mountPuzzle(container);
    }
  };

  EcoCheckUI.prototype.mountPuzzle = function (container) {
    var self = this;
    var c = this.challenge;
    this._maxX = c.width - c.pieceSize;
    this._offsetX = 0;
    this._validator.reset();
    this._dragging = false;

    var wrap = document.createElement("div");
    wrap.className = "ec-puzzle";

    var canvas = document.createElement("div");
    canvas.className = "ec-puzzle__canvas";
    canvas.style.width = c.width + "px";
    canvas.style.height = c.height + "px";

    if (c.background) {
      var bg = document.createElement("img");
      bg.className = "ec-puzzle__bg";
      bg.src = c.background;
      bg.alt = "";
      bg.draggable = false;
      canvas.appendChild(bg);
    } else {
      canvas.style.background = "linear-gradient(135deg, rgba(143,255,199,0.4), rgba(18,160,106,0.2))";
    }

    if (c.piece) {
      this._pieceEl = document.createElement("img");
      this._pieceEl.src = c.piece;
      this._pieceEl.alt = "";
      this._pieceEl.className = "ec-puzzle__piece";
      this._pieceEl.draggable = false;
      this._pieceEl.style.width = c.pieceSize + "px";
      this._pieceEl.style.height = c.pieceSize + "px";
      this._pieceEl.style.left = "0px";
      this._pieceEl.style.top = c.pieceY + "px";
      canvas.appendChild(this._pieceEl);
    }

    var stage = document.createElement("div");
    stage.className = "ec-puzzle__stage";

    this._trackEl = document.createElement("div");
    this._trackEl.className = "ec-puzzle__track";
    this._trackEl.style.width = c.width + "px";

    var hintTrack = document.createElement("p");
    hintTrack.className = "ec-puzzle__track-hint";
    hintTrack.textContent = "Deslize o botão verde até a peça encaixar";

    this._handleEl = document.createElement("div");
    this._handleEl.className = "ec-puzzle__handle";
    this._handleEl.setAttribute("role", "slider");
    this._handleEl.setAttribute("aria-label", "Arrastar peça do puzzle");
    this._handleEl.textContent = "⋮⋮";
    this._trackEl.appendChild(this._handleEl);

    stage.appendChild(canvas);
    stage.appendChild(hintTrack);
    stage.appendChild(this._trackEl);
    wrap.appendChild(stage);
    container.appendChild(wrap);

    this.updatePiecePosition(false);

    var docMove = null;
    var docUp = null;

    var onDown = function (clientX, clientY) {
      if (self._verifying) return;
      self._dragging = true;
      self._validator.start();
      self._validator.addSample(clientX, clientY);

      docMove = function (e) {
        if (!self._dragging) return;
        var p = e.touches && e.touches.length ? e.touches[0] : e;
        if (p) onMove(p.clientX, p.clientY);
      };
      docUp = function () {
        document.removeEventListener("mousemove", docMove);
        document.removeEventListener("mouseup", docUp);
        document.removeEventListener("touchmove", docMove);
        document.removeEventListener("touchend", docUp);
        document.removeEventListener("touchcancel", docUp);
        onUp();
      };

      document.addEventListener("mousemove", docMove);
      document.addEventListener("mouseup", docUp);
      document.addEventListener("touchmove", docMove, { passive: false });
      document.addEventListener("touchend", docUp);
      document.addEventListener("touchcancel", docUp);
    };

    var onMove = function (clientX, clientY) {
      if (!self._dragging || !self._trackEl || self._verifying) return;
      var rect = self._trackEl.getBoundingClientRect();
      var x = Math.max(0, Math.min(self._maxX, clientX - rect.left - c.pieceSize / 2));
      self._offsetX = x;
      self.updatePiecePosition(true);
      self._validator.addSample(clientX, clientY);
    };

    var onUp = function () {
      if (!self._dragging || self._verifying) return;
      self._dragging = false;
      var analysis = self._validator.analyze();
      if (!analysis.ok) {
        if (self._offsetX < 4) {
          return;
        }
        self.status = "error";
        self.message = analysis.reason || "Comportamento suspeito.";
        self.renderContent();
        setTimeout(function () {
          self.loadChallenge();
        }, 800);
        return;
      }
      self.handleVerify(self._offsetX, self._validator);
    };

    function bindDrag(el) {
      if (!el) return;
      el.addEventListener("mousedown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        onDown(e.clientX, e.clientY);
      });
      el.addEventListener("touchstart", function (e) {
        if (self._verifying) return;
        e.preventDefault();
        var t = e.touches[0];
        if (t) onDown(t.clientX, t.clientY);
      }, { passive: false });
    }

    if (this._pieceEl) bindDrag(this._pieceEl);
    bindDrag(this._handleEl);
  };

  EcoCheckUI.prototype.updatePiecePosition = function (dragging) {
    var c = this.challenge;
    var transition = dragging ? "none" : "left 0.15s ease";
    if (this._pieceEl) {
      this._pieceEl.style.left = this._offsetX + "px";
      this._pieceEl.style.transition = transition;
      this._pieceEl.style.cursor = dragging ? "grabbing" : "grab";
    }
    if (this._handleEl && c) {
      var handleHalf = 18;
      var left = this._offsetX + c.pieceSize / 2 - handleHalf;
      var maxLeft = Math.max(0, c.width - handleHalf * 2);
      if (left < 0) left = 0;
      if (left > maxLeft) left = maxLeft;
      this._handleEl.style.left = left + "px";
      this._handleEl.style.transition = transition;
    }
  };

  EcoCheckUI.prototype.loadChallenge = function () {
    var self = this;
    this.status = "loading";
    this.message = "";
    this.renderContent();
    return this.verificationService
      .fetchChallenge()
      .then(function (ch) {
        self.challenge = ch;
        self.status = "playing";
        self.renderContent();
        if (typeof document !== "undefined") {
          document.dispatchEvent(new CustomEvent("ecocheck:challenge-ready"));
        }
      })
      .catch(function (e) {
        self.status = "error";
        self.message = e.message || "Erro ao carregar puzzle.";
        self.renderContent();
      });
  };

  EcoCheckUI.prototype.handleVerify = function (positionX, validator) {
    var self = this;
    if (!this.challenge || this._verifying) return;
    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent("ecocheck:verifying"));
    }
    this._verifying = true;
    if (this._trackEl) this._trackEl.classList.add("ec-puzzle__track--busy");

    var metrics = validator.analyze().metrics;
    this.verificationService
      .verify(this.challenge.challengeId, positionX, metrics, this.honeypot)
      .then(function (result) {
        if (result.sucesso && result.token) {
          self.status = "success";
          self.message = result.mensagem || "Verificado com sucesso!";
          self.renderContent();
          setTimeout(function () {
            self.closeModal(true, null, result.token);
          }, 700);
          return;
        }
        self.status = "error";
        self.message = result.erro || "Falha na verificação.";
        self.renderContent();
        if (result.retry) {
          setTimeout(function () {
            self.loadChallenge();
          }, 900);
        }
      })
      .catch(function () {
        self.status = "error";
        self.message = "Erro ao verificar. Tente novamente.";
        self.renderContent();
      })
      .finally(function () {
        self._verifying = false;
        if (self._trackEl) self._trackEl.classList.remove("ec-puzzle__track--busy");
        if (typeof document !== "undefined") {
          document.dispatchEvent(new CustomEvent("ecocheck:verify-done"));
        }
      });
  };

  EcoCheckUI.prototype.showModal = function () {
    var self = this;
    if (this.open && this._openPromise) {
      return this._openPromise;
    }
    this.open = true;
    this.render();
    this._openPromise = this.loadChallenge().then(function () {
      return new Promise(function (resolve) {
        self.resolveOpen = resolve;
      });
    });
    return this._openPromise;
  };

  EcoCheckUI.prototype.closeModal = function (ok, erro, token) {
    this.open = false;
    this._openPromise = null;
    this._verifying = false;
    this.render();
    if (ok) {
      document.dispatchEvent(new CustomEvent("ecocheck:verified"));
      if (global.EcoCheckBridge && typeof global.EcoCheckBridge.updateStatus === "function") {
        global.EcoCheckBridge.updateStatus();
      }
    } else if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent("ecocheck:modal-closed"));
    }
    if (this.resolveOpen) {
      if (ok) {
        this.resolveOpen({ ok: true, token: token || this.verificationService.getToken() });
      } else {
        this.resolveOpen({ ok: false, erro: erro || "Verificação cancelada." });
      }
      this.resolveOpen = null;
    }
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var verificationService = null;
  var ui = null;
  var api = null;

  function getApiUrl() {
    return global.EcoCheckConfig && global.EcoCheckConfig.apiUrl
      ? global.EcoCheckConfig.apiUrl
      : "ecocheck-api.php";
  }

  function bootEcoCheck() {
    if (api) return;
    verificationService = new VerificationService(getApiUrl());
    ui = new EcoCheckUI(verificationService);
    ui.mount();
    api = {
      hasValidToken: function () {
        return verificationService.hasValidToken();
      },
      getToken: function () {
        return verificationService.getToken();
      },
      clearToken: function () {
        verificationService.clearToken();
      },
      open: function () {
        if (verificationService.hasValidToken()) {
          return Promise.resolve({ ok: true, token: verificationService.getToken() });
        }
        return ui.showModal();
      },
      ensureVerified: function () {
        if (verificationService.hasValidToken()) {
          return Promise.resolve({ ok: true, token: verificationService.getToken() });
        }
        return api.open();
      },
    };

    global.EcoCheck = api;
    global.EcoAntiBot = {
      init: function () {},
      validate: function () {
        var token = verificationService.getToken();
        if (!token) {
          return { ok: false, erro: 'Conclua a verificação EcoCheck "Não sou um robô".' };
        }
        return { ok: true, erro: null };
      },
      reset: function () {
        verificationService.clearToken();
      },
      isVerified: function () {
        return verificationService.hasValidToken();
      },
      openModal: function () {
        return api.open();
      },
    };

    document.dispatchEvent(new CustomEvent("ecocheck:ready"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootEcoCheck);
  } else {
    bootEcoCheck();
  }
})(window);
