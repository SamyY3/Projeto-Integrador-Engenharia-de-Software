

(function (window, document) {
  "use strict";

  var TEMPO_MINIMO_MS = 800;
  var LOADING_MIN_MS = 320;
  var LOADING_MAX_MS = 2400;
  var ESTADO = new WeakMap();

  var interagiu = false;
  function marcarInteracao() {
    interagiu = true;
  }
  document.addEventListener("mousemove", marcarInteracao, { once: true, passive: true });
  document.addEventListener("keydown", marcarInteracao, { once: true, passive: true });
  document.addEventListener("touchstart", marcarInteracao, { once: true, passive: true });
  document.addEventListener("pointerdown", marcarInteracao, { once: true, passive: true });

  function acharWidgets(raiz) {
    if (raiz && raiz.matches && raiz.matches("[data-eco-antibot]")) return [raiz];
    var scope = raiz || document;
    return Array.prototype.slice.call(scope.querySelectorAll("[data-eco-antibot]"));
  }

  function pegarEstado(widget) {
    var s = ESTADO.get(widget);
    if (!s) {
      s = {
        verified: false,
        loading: false,
        iniciadoEm: Date.now(),
        cliques: 0,
        loadingTimer: null,
      };
      ESTADO.set(widget, s);
    }
    return s;
  }

  function limparTimers(s) {
    if (!s) return;
    if (s.loadingTimer) {
      clearTimeout(s.loadingTimer);
      s.loadingTimer = null;
    }
    if (s.loadingTimerMax) {
      clearTimeout(s.loadingTimerMax);
      s.loadingTimerMax = null;
    }
  }

  function emitirMudanca(widget, verified) {
    widget.dispatchEvent(
      new CustomEvent("eco-antibot:change", {
        detail: { verified: !!verified },
        bubbles: true,
      })
    );
  }

  function aplicarVerificado(widget, verified) {
    var s = pegarEstado(widget);
    s.verified = !!verified;
    s.loading = false;
    limparTimers(s);

    var btn = widget.querySelector(".eco-antibot-btn");
    if (btn) {
      btn.setAttribute("aria-checked", verified ? "true" : "false");
      btn.classList.toggle("is-verified", !!verified);
      btn.classList.remove("is-loading");
      btn.disabled = false;
    }
    widget.classList.toggle("is-verified-card", !!verified);
    widget.classList.remove("is-busy");
    widget.classList.remove("has-err");
    emitirMudanca(widget, verified);
  }

  function aplicarCarregando(widget, loading) {
    var s = pegarEstado(widget);
    s.loading = !!loading;

    var btn = widget.querySelector(".eco-antibot-btn");
    if (!btn) return;

    btn.classList.toggle("is-loading", !!loading);
    widget.classList.toggle("is-busy", !!loading);
    btn.disabled = !!loading;

    if (loading) {
      btn.classList.remove("is-verified");
      btn.setAttribute("aria-checked", "false");
      widget.classList.remove("is-verified-card");
    }
  }

  function mostrarErro(widget, msg) {
    var err = widget.querySelector(".eco-antibot-err");
    if (!err) {
      err = document.createElement("span");
      err.className = "eco-antibot-err";
      widget.appendChild(err);
    }
    err.textContent = msg || "";
    widget.classList.toggle("has-err", !!msg);
  }

  function concluirVerificacao(widget) {
    var s = pegarEstado(widget);
    if (!s.loading) return;
    aplicarCarregando(widget, false);
    aplicarVerificado(widget, true);
  }

  function iniciarVerificacao(widget) {
    var s = pegarEstado(widget);
    marcarInteracao();
    mostrarErro(widget, "");
    aplicarCarregando(widget, true);

    var atraso = LOADING_MIN_MS + Math.floor(Math.random() * 280);
    limparTimers(s);
    s.loadingTimer = setTimeout(function () {
      s.loadingTimer = null;
      concluirVerificacao(widget);
    }, atraso);

    s.loadingTimerMax = setTimeout(function () {
      s.loadingTimerMax = null;
      if (s.loading) concluirVerificacao(widget);
    }, LOADING_MAX_MS);
  }

  function inicializarWidget(widget) {
    if (widget.getAttribute("data-eco-antibot-ready") === "1") return;
    widget.setAttribute("data-eco-antibot-ready", "1");
    pegarEstado(widget);

    if (!widget.querySelector(".eco-antibot-hp")) {
      var hp = document.createElement("input");
      hp.type = "text";
      hp.className = "eco-antibot-hp";
      hp.name = "eco_antibot_hp";
      hp.tabIndex = -1;
      hp.autocomplete = "off";
      hp.setAttribute("aria-hidden", "true");
      widget.appendChild(hp);
    }

    var btn = widget.querySelector(".eco-antibot-btn");
    if (!btn) return;

    btn.addEventListener("click", function () {
      var s = pegarEstado(widget);

      if (s.loading) return;

      if (s.verified) {
        aplicarVerificado(widget, false);
        return;
      }

      s.cliques = (s.cliques || 0) + 1;
      iniciarVerificacao(widget);
    });

    btn.addEventListener("keydown", function (e) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        btn.click();
      }
    });
  }

  function validar(rootOuWidget) {
    var widgets = acharWidgets(rootOuWidget);
    if (widgets.length === 0) {
      return { ok: false, erro: "Verificacao anti-bot ausente na pagina." };
    }
    var widget = widgets[0];
    var s = pegarEstado(widget);

    if (s.loading) {
      mostrarErro(widget, "Aguarde a verificacao EcoCheck terminar.");
      return { ok: false, erro: "Verificacao EcoCheck em andamento." };
    }

    var hp = widget.querySelector(".eco-antibot-hp");
    if (hp && String(hp.value || "").trim() !== "") {
      mostrarErro(widget, "Falha na verificacao. Recarregue a pagina.");
      return { ok: false, erro: "Falha na verificacao anti-bot (honeypot)." };
    }

    var decorrido = Date.now() - (s.iniciadoEm || 0);
    if (decorrido < TEMPO_MINIMO_MS) {
      mostrarErro(widget, "Aguarde um instante antes de enviar.");
      return { ok: false, erro: "Envio rapido demais. Aguarde um instante." };
    }

    if (!interagiu) {
      mostrarErro(widget, "Interaja com a pagina antes de continuar.");
      return { ok: false, erro: "Sem interacao do usuario detectada." };
    }

    if (!s.verified) {
      mostrarErro(widget, 'Marque "Nao sou um robo" para continuar.');
      return { ok: false, erro: 'Marque "Nao sou um robo" para continuar.' };
    }

    mostrarErro(widget, "");
    return { ok: true, erro: null };
  }

  function resetar(rootOuWidget) {
    acharWidgets(rootOuWidget).forEach(function (w) {
      var s = pegarEstado(w);
      limparTimers(s);
      aplicarVerificado(w, false);
      mostrarErro(w, "");
      var hp = w.querySelector(".eco-antibot-hp");
      if (hp) hp.value = "";
      s.iniciadoEm = Date.now();
      s.cliques = 0;
    });
  }

  function isVerified(rootOuWidget) {
    var widgets = acharWidgets(rootOuWidget);
    if (widgets.length === 0) return false;
    var s = pegarEstado(widgets[0]);
    return !!s.verified && !s.loading;
  }

  function init(root) {
    acharWidgets(root).forEach(inicializarWidget);
  }

  window.EcoAntiBot = {
    init: init,
    validate: validar,
    reset: resetar,
    isVerified: isVerified,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      init();
    });
  } else {
    init();
  }
})(window, document);
