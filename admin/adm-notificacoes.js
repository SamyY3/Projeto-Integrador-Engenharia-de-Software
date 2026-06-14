

(function () {
  "use strict";

  const POLL_MS = 90000;
  const ICON_SVG = {
    bell:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">' +
      '<path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5"/>' +
      '<path d="M10 20a2 2 0 0 0 4 0"/>' +
      "</svg>",
    purple:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">' +
      '<rect x="4" y="5" width="16" height="15" rx="2"/>' +
      '<path d="M8 3v4M16 3v4M4 10h16"/>' +
      "</svg>",
    green:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">' +
      '<path d="M20 7 10 17l-5-5"/>' +
      "</svg>",
    yellow:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">' +
      '<path d="M12 3.5 14.6 9l5.9.5-4.5 3.8 1.4 5.7L12 16.8 6.6 19l1.4-5.7L3.5 9.5 9.4 9 12 3.5Z"/>' +
      "</svg>",
  };

  function apiUrl() {
    return window.ecocoletaPhpUrl
      ? window.ecocoletaPhpUrl("adm-notificacoes.php")
      : "api/adm-notificacoes.php";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tempoRelativo(iso) {
    if (!iso) return "agora";
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "agora";
    const diff = Math.max(0, Date.now() - t);
    const min = Math.floor(diff / 60000);
    if (min < 1) return "agora";
    if (min < 60) return "há " + min + " min";
    const h = Math.floor(min / 60);
    if (h < 24) return "há " + h + " h";
    const d = Math.floor(h / 24);
    return "há " + d + " dia" + (d === 1 ? "" : "s");
  }

  let cache = null;
  let pollTimer = null;

  function updateBadges(count) {
    const n = Math.max(0, parseInt(count, 10) || 0);
    document.querySelectorAll("[data-adm-notif-badge]").forEach((badge) => {
      if (n > 0) {
        badge.textContent = n > 99 ? "99+" : String(n);
        badge.classList.remove("hidden");
      } else {
        badge.textContent = "";
        badge.classList.add("hidden");
      }
    });
  }

  function badgeClass(badge, variant) {
    const b = String(badge || "").toLowerCase();
    if (b === "ação" || b === "acao" || b === "urgente") {
      return " notif-item__badge--action";
    }
    if (b === "nova" || variant === "novo") {
      return " notif-item__badge--novo";
    }
    if (b === "hoje" || variant === "hoje") {
      return " notif-item__badge--hoje";
    }
    if (b === "kpi" || variant === "kpi") {
      return " notif-item__badge--kpi";
    }
    return "";
  }

  function variantNotificacao(n) {
    const tipo = String(n.tipo || "").toLowerCase();
    const titulo = String(n.titulo || "").toLowerCase();
    const badge = String(n.badge || "").toLowerCase();
    const icone = String(n.icone || "").toLowerCase();

    if (
      tipo === "coleta_agendada" ||
      badge === "nova" ||
      titulo.includes("nova coleta") ||
      titulo.includes("agendad")
    ) {
      return "novo";
    }
    if (
      titulo.includes("andamento") ||
      badge === "ação" ||
      badge === "acao" ||
      icone === "yellow"
    ) {
      return "andamento";
    }
    if (titulo.includes("conclu") || tipo.includes("conclu")) {
      return "concluida";
    }
    if (
      titulo.includes("coletas hoje") ||
      titulo.includes("coleta hoje") ||
      badge === "hoje"
    ) {
      return "hoje";
    }
    if (tipo === "material" || badge === "kpi") {
      return "kpi";
    }
    if (
      tipo === "sistema" &&
      (titulo.includes("relatório") || titulo.includes("relatorio"))
    ) {
      return "sistema";
    }
    if (titulo.includes("morador")) {
      return "info";
    }
    if (icone === "green") return "concluida";
    if (icone === "purple") return "sistema";
    if (icone === "blue" || icone === "bell") return "hoje";
    return "info";
  }

  function renderItem(n) {
    const variant = variantNotificacao(n);
    const tipo = escapeHtml(n.icone || "bell");
    const icone = ICON_SVG[n.icone] || ICON_SVG.bell;
    const badge = n.badge
      ? '<span class="badge notif-item__badge' +
        badgeClass(n.badge, variant) +
        '">' +
        escapeHtml(n.badge) +
        "</span>"
      : "";
    const variantCls = " notif-item--" + variant;
    const unreadCls = n.lida ? "" : " notif-item--unread";
    const unreadAttr = n.lida ? "" : ' data-unread="1"';
    const link = n.link ? ' data-href="' + escapeHtml(n.link) + '"' : "";
    const titulo = n.titulo ? String(n.titulo).trim() : "";
    const mensagem = n.mensagem ? String(n.mensagem).trim() : "";
    const tituloHtml = titulo
      ? '<strong class="notif-item__title">' + escapeHtml(titulo) + "</strong>"
      : "";
    const textoHtml = mensagem
      ? '<p class="notif-item__text">' + escapeHtml(mensagem) + "</p>"
      : titulo
        ? ""
        : '<p class="notif-item__text">Nova atualização no painel.</p>';

    return (
      '<article class="item notif-item' +
      variantCls +
      unreadCls +
      '"' +
      unreadAttr +
      link +
      ' data-id="' +
      n.id +
      '">' +
      '<span class="icon notif-item__icon notif-item__icon--' +
      tipo +
      '">' +
      icone +
      "</span>" +
      '<div class="notif-item__content">' +
      tituloHtml +
      textoHtml +
      '<time class="notif-item__time">' +
      escapeHtml(tempoRelativo(n.criado_em)) +
      "</time>" +
      "</div>" +
      badge +
      "</article>"
    );
  }

  function renderBody(body, data) {
    if (!body) return;
    const importantes = (data && data.importantes) || [];
    const outras = (data && data.outras) || [];

    if (!importantes.length && !outras.length) {
      body.innerHTML =
        '<p class="notif-empty">Nenhuma notificação no momento.</p>';
      return;
    }

    let html = "";
    if (importantes.length) {
      html += '<p class="section-title">IMPORTANTE</p><section class="section">';
      importantes.forEach((n) => {
        html += renderItem(n);
      });
      html += "</section>";
    }
    if (outras.length) {
      html += '<p class="section-title">OUTRAS</p><section class="section">';
      outras.forEach((n) => {
        html += renderItem(n);
      });
      html += "</section>";
    }
    body.innerHTML = html;

    body.querySelectorAll(".item[data-href]").forEach((el) => {
      el.addEventListener("click", () => {
        const href = el.getAttribute("data-href");
        const id = parseInt(el.getAttribute("data-id") || "0", 10);
        if (id > 0) {
          marcarLida(id).catch(() => {});
        }
        if (href) {
          window.location.href = href;
        }
      });
    });
  }

  async function apiPost(acao, extra) {
    const fd = new FormData();
    fd.append("acao", acao);
    if (extra) {
      Object.keys(extra).forEach((k) => fd.append(k, extra[k]));
    }
    const res = await fetch(apiUrl(), {
      method: "POST",
      body: fd,
      credentials: "same-origin",
      cache: "no-store",
    });
    const text = await res.text();
    try {
      return JSON.parse(text.replace(/^\uFEFF/, "").trim());
    } catch (e) {
      return { sucesso: false, erro: "Resposta inválida do servidor." };
    }
  }

  async function carregar(force, bodyEl) {
    const body =
      bodyEl || document.querySelector("[data-adm-notif-body]");
    if (!body) return null;

    if (cache && !force) {
      renderBody(body, cache);
      updateBadges(cache.nao_lidas || 0);
      return cache;
    }

    body.innerHTML = '<p class="notif-status">Carregando…</p>';
    const data = await apiPost("listar");
    if (!data || data.sucesso !== true) {
      body.innerHTML =
        '<p class="notif-error">' +
        escapeHtml((data && data.erro) || "Erro ao carregar.") +
        "</p>";
      return null;
    }

    cache = data;
    renderBody(body, data);
    updateBadges(data.nao_lidas || 0);
    return data;
  }

  async function marcarLida(id) {
    await apiPost("marcar_lida", { id_notificacao: String(id) });
    cache = null;
    const body = document.querySelector("[data-adm-notif-body]");
    if (body) await carregar(true, body);
  }

  async function marcarTodasLidas() {
    await apiPost("marcar_todas_lidas");
    cache = null;
    updateBadges(0);
    const body = document.querySelector("[data-adm-notif-body]");
    if (body) {
      body.innerHTML =
        '<p class="notif-empty">Todas as notificações foram lidas.</p>';
    }
  }

  function mountBell() {
    const actions = document.querySelector(".adm-header-actions");
    if (!actions || document.getElementById("admNotifWrapper")) return;

    const wrap = document.createElement("div");
    wrap.id = "admNotifWrapper";
    wrap.className = "notif-wrapper adm-notif-wrapper";
    wrap.innerHTML =
      '<button type="button" class="notif-btn" aria-label="Notificações" aria-expanded="false">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5"/>' +
      '<path d="M10 20a2 2 0 0 0 4 0"/>' +
      "</svg>" +
      '<span class="notif-badge hidden" data-adm-notif-badge></span>' +
      "</button>" +
      '<div class="notif-overlay hidden" aria-hidden="true">' +
      '<div class="notif-box" role="dialog" aria-label="Notificações">' +
      '<div class="header notif-head">' +
      '<div class="notif-head__text">' +
      "<h2>Notificações</h2>" +
      '<p class="notif-head__sub">Alertas e atualizações do EcoPonto</p>' +
      "</div>" +
      '<button type="button" class="close-notif notif-close" aria-label="Fechar">&times;</button>' +
      "</div>" +
      '<div class="notif-body" data-adm-notif-body>' +
      '<p class="notif-status">Carregando…</p>' +
      "</div>" +
      '<div class="notif-foot">' +
      '<button type="button" class="notif-mark-all" data-adm-notif-mark-all>Marcar todas como lidas</button>' +
      "</div>" +
      "</div></div>";

    const profile = actions.querySelector(".adm-profile-btn");
    if (profile) {
      actions.insertBefore(wrap, profile);
    } else {
      actions.appendChild(wrap);
    }

    const btn = wrap.querySelector(".notif-btn");
    const overlay = wrap.querySelector(".notif-overlay");
    const closeBtn = wrap.querySelector(".close-notif");
    const markAll = wrap.querySelector("[data-adm-notif-mark-all]");

    function positionOverlay() {
      const rect = btn.getBoundingClientRect();
      const gap = 10;
      const pad = 12;
      overlay.style.position = "fixed";
      overlay.style.top = Math.round(rect.bottom + gap) + "px";
      overlay.style.right = Math.round(Math.max(pad, window.innerWidth - rect.right)) + "px";
      overlay.style.left = "auto";
      overlay.style.width = "";
    }

    function close() {
      overlay.classList.remove("show");
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
      btn.setAttribute("aria-expanded", "false");
    }

    function open() {
      overlay.classList.remove("hidden");
      positionOverlay();
      overlay.setAttribute("aria-hidden", "false");
      btn.setAttribute("aria-expanded", "true");
      requestAnimationFrame(() => overlay.classList.add("show"));
      carregar(true).catch(() => {});
    }

    window.addEventListener("resize", () => {
      if (overlay.classList.contains("show")) positionOverlay();
    });

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (overlay.classList.contains("hidden")) open();
      else close();
    });

    closeBtn.addEventListener("click", close);
    markAll.addEventListener("click", () => {
      marcarTodasLidas().catch(() => {});
    });

    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  function iniciar() {
    mountBell();
    carregar(true).catch(() => {});
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = window.setInterval(() => {
      if (document.hidden) return;
      cache = null;
      carregar(true).catch(() => {});
    }, POLL_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }

  window.addEventListener("ecocoleta:adm-notificacoes-atualizar", () => {
    cache = null;
    carregar(true).catch(() => {});
  });
})();
