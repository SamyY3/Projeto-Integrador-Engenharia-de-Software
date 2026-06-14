
if (typeof window.ecocoletaLoadScrollbarStyles === "function") {
  window.ecocoletaLoadScrollbarStyles();
} else {
  (function () {
    var html = document.documentElement;
    var pathNow = window.location.pathname.replace(/\\/g, "/");
    if (html.classList.contains("auth-view") || /\/auth\//i.test(pathNow)) return;
    if (document.body && document.body.classList.contains("auth")) return;
    if (document.getElementById("eco-scrollbar-styles")) return;
    var base = document.querySelector("base[data-app-base]");
    var root = base ? base.href : "./";
    var link = document.createElement("link");
    link.id = "eco-scrollbar-styles";
    link.rel = "stylesheet";
    link.href = root + "assets/css/scrollbar-ecocoleta.css?v=2";
    document.head.appendChild(link);
  })();
}

document.addEventListener("DOMContentLoaded", () => {
  const API_URL = (function () {
    const prefix = /\/(pages|auth|admin|mapa)\//.test(window.location.pathname) ? "../" : "";
    return new URL(prefix + "api/notificacoes.php", window.location.href).href;
  })();
  const VIEWPORT_PAD = 12;
  const GAP = 10;
  const TAG = "div";
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

  const header = document.querySelector("header.topo");
  let ignoreOutsideClick = false;
  let notifCache = null;

  if (header) {
    const syncHeaderOffset = () => {
      const rect = header.getBoundingClientRect();
      const h = Math.ceil(Math.max(rect.height, header.offsetHeight, header.scrollHeight));
      document.documentElement.style.setProperty("--ecocoleta-header-offset", `${h}px`);
    };
    syncHeaderOffset();
    requestAnimationFrame(() => {
      syncHeaderOffset();
      requestAnimationFrame(syncHeaderOffset);
    });
    window.addEventListener("load", syncHeaderOffset, { once: true });
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(syncHeaderOffset, 80);
    }, { passive: true });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(syncHeaderOffset).catch(() => {});
    }
    const updateHeaderOnScroll = () => header.classList.toggle("scrolled", window.scrollY > 10);
    window.addEventListener("scroll", updateHeaderOnScroll, { passive: true });
    updateHeaderOnScroll();
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(syncHeaderOffset).observe(header);
    }
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tempoRelativo(iso) {
    if (!iso) return "";
    const data = new Date(iso);
    if (Number.isNaN(data.getTime())) return "";
    const min = Math.floor(Math.max(0, Date.now() - data.getTime()) / 60000);
    if (min < 1) return "agora mesmo";
    if (min < 60) return `há ${min} minuto${min === 1 ? "" : "s"}`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h} hora${h === 1 ? "" : "s"}`;
    const d = Math.floor(h / 24);
    return `há ${d} dia${d === 1 ? "" : "s"}`;
  }

  function buildNotifBoxShell() {
    return (
      `<${TAG} class="header notif-head">` +
      `<${TAG} class="notif-head__brand">` +
      `<span class="notif-head__glyph" aria-hidden="true">` +
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">` +
      `<path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5"/>` +
      `<path d="M10 20a2 2 0 0 0 4 0"/>` +
      `</svg></span>` +
      `<${TAG} class="notif-head__text">` +
      `<h2>Notificações</h2>` +
      `<p class="notif-head__sub">Atualizações da sua conta EcoColeta</p>` +
      `</${TAG}>` +
      `</${TAG}>` +
      `<button type="button" class="close-notif notif-close" aria-label="Fechar notificações">` +
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">` +
      `<path d="M6 6l12 12M18 6 6 18"/>` +
      `</svg></button>` +
      `</${TAG}>` +
      `<${TAG} class="notif-body" data-notif-body>` +
      `<p class="notif-status">Carregando notificações…</p>` +
      `</${TAG}>` +
      `<${TAG} class="notif-foot">` +
      `<button type="button" class="notif-mark-all" data-notif-mark-all>Marcar todas como lidas</button>` +
      `</${TAG}>`
    );
  }

  function badgeClass(badge, variant) {
    const b = String(badge || "").toLowerCase();
    if (b.includes("pt") || b.includes("+") || variant === "pontos") {
      return " notif-item__badge--pontos";
    }
    if (b.includes("prêmio") || b.includes("premio") || variant === "resgate") {
      return " notif-item__badge--resgate";
    }
    if (b.includes("revis") || variant === "revisao") {
      return " notif-item__badge--revisao";
    }
    if (variant === "alerta" || b === "0 pts") {
      return " notif-item__badge--alerta";
    }
    if (variant === "lembrete" || variant === "coleta") {
      return " notif-item__badge--coleta";
    }
    return "";
  }

  function variantNotificacao(n) {
    const tipo = String(n.tipo || "").toLowerCase();
    const titulo = String(n.titulo || "").toLowerCase();
    const mensagem = String(n.mensagem || "").toLowerCase();
    const icone = String(n.icone || "").toLowerCase();
    const prioridade = String(n.prioridade || "").toLowerCase();

    if (tipo === "resgate" || titulo.includes("prêmio") || titulo.includes("premio")) {
      return "resgate";
    }
    if (
      titulo.includes("revisão") ||
      titulo.includes("revisao") ||
      mensagem.includes("conta foi colocada em revisão")
    ) {
      return "revisao";
    }
    if (
      titulo.includes("penalidade") ||
      mensagem.includes("divergência") ||
      mensagem.includes("divergencia") ||
      mensagem.includes("ocorrência")
    ) {
      return "alerta";
    }
    if (tipo === "pontos" || titulo.includes("ecopoints") || titulo.includes("ecopontos")) {
      return "pontos";
    }
    if (
      tipo === "coleta" &&
      (prioridade === "importante" || mensagem.includes("lembrete"))
    ) {
      return "lembrete";
    }
    if (tipo === "coleta" || icone === "purple") {
      return "coleta";
    }
    if (tipo === "sistema") {
      return "sistema";
    }
    if (icone === "green") {
      return "sucesso";
    }
    return "info";
  }

  function linkNotificacao(n) {
    const tipo = String(n.tipo || "").toLowerCase();
    if (tipo === "coleta") return "formulario-coleta.html";
    if (tipo === "resgate") return "perfil.html";
    if (tipo === "pontos") return "perfil.html";
    if (tipo === "sistema") return "tela-inicia.html";
    return "";
  }

  function renderItem(n) {
    const variant = variantNotificacao(n);
    const tipo = escapeHtml(n.icone || "bell");
    const icone = ICON_SVG[n.icone] || ICON_SVG.bell;
    const badge = n.badge
      ? `<span class="badge notif-item__badge${badgeClass(n.badge, variant)}">${escapeHtml(n.badge)}</span>`
      : "";
    const unreadCls = n.lida ? "" : " notif-item--unread";
    const unreadAttr = n.lida ? "" : ' data-unread="1"';
    const variantCls = " notif-item--" + variant;
    const link = linkNotificacao(n);
    const linkAttr = link ? ` data-href="${escapeHtml(link)}"` : "";
    const titulo = n.titulo ? String(n.titulo).trim() : "";
    const mensagem = n.mensagem ? String(n.mensagem).trim() : "";
    const mostrarTitulo =
      titulo &&
      mensagem &&
      !mensagem.toLowerCase().startsWith(titulo.toLowerCase().slice(0, 12));
    const tituloHtml = mostrarTitulo
      ? `<strong class="notif-item__title">${escapeHtml(titulo)}</strong>`
      : "";
    const textoHtml = mensagem
      ? `<p class="notif-item__text">${escapeHtml(mensagem)}</p>`
      : titulo
        ? `<p class="notif-item__text">${escapeHtml(titulo)}</p>`
        : `<p class="notif-item__text">Nova notificação.</p>`;

    return (
      `<article class="item notif-item${variantCls}${unreadCls}"${unreadAttr}${linkAttr} data-id="${n.id}">` +
      `<span class="icon notif-item__icon notif-item__icon--${tipo}">${icone}</span>` +
      `<${TAG} class="notif-item__content">` +
      tituloHtml +
      textoHtml +
      `<time class="notif-item__time">${escapeHtml(tempoRelativo(n.criado_em))}</time>` +
      `</${TAG}>` +
      badge +
      `</article>`
    );
  }

  function bindNotifItems(body) {
    if (!body) return;
    body.querySelectorAll(".item[data-href]").forEach((el) => {
      el.addEventListener("click", () => {
        const href = el.getAttribute("data-href");
        const id = parseInt(el.getAttribute("data-id") || "0", 10);
        if (id > 0) {
          apiNotificacoes("marcar_lida", { id_notificacao: String(id) }).catch(() => {});
        }
        if (href) {
          window.location.href = href;
        }
      });
    });
  }

  function renderNotificacoes(body, data) {
    if (!body) return;
    const importantes = (data && data.importantes) || [];
    const outras = (data && data.outras) || [];

    if (!importantes.length && !outras.length) {
      body.innerHTML =
        `<div class="notif-empty-state">` +
        `<span class="notif-empty-state__icon" aria-hidden="true">` +
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">` +
        `<path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5"/>` +
        `<path d="M10 20a2 2 0 0 0 4 0"/>` +
        `</svg></span>` +
        `<p class="notif-empty-state__title">Tudo em dia</p>` +
        `<p class="notif-empty-state__text">Você não tem notificações no momento.</p>` +
        `</div>`;
      return;
    }

    let html = "";
    if (importantes.length) {
      html += `<p class="section-title">IMPORTANTE</p><section class="section">`;
      importantes.forEach((n) => { html += renderItem(n); });
      html += `</section>`;
    }
    if (outras.length) {
      html += `<p class="section-title">MAIS NOTIFICAÇÕES</p><section class="section">`;
      outras.forEach((n) => { html += renderItem(n); });
      html += `</section>`;
    }
    body.innerHTML = html;
    bindNotifItems(body);
  }

  function updateBadges(count) {
    const n = Math.max(0, parseInt(count, 10) || 0);
    document.querySelectorAll("[data-notif-badge]").forEach((badge) => {
      if (n > 0) {
        badge.textContent = n > 99 ? "99+" : String(n);
        badge.classList.remove("hidden");
      } else {
        badge.textContent = "";
        badge.classList.add("hidden");
      }
    });
  }

  async function apiNotificacoes(acao, extra) {
    const fd = new FormData();
    fd.append("acao", acao);
    if (extra) {
      Object.keys(extra).forEach((key) => fd.append(key, extra[key]));
    }
    const res = await fetch(API_URL, { method: "POST", body: fd, credentials: "same-origin" });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      return { sucesso: false, erro: "Resposta inválida do servidor." };
    }
  }

  async function carregarNotificacoes(force, bodyEl) {
    const bodies = bodyEl
      ? [bodyEl]
      : Array.from(document.querySelectorAll("[data-notif-body]"));

    if (notifCache && !force) {
      bodies.forEach((b) => renderNotificacoes(b, notifCache));
      updateBadges(notifCache.nao_lidas || 0);
      return notifCache;
    }

    bodies.forEach((b) => {
      b.innerHTML = `<p class="notif-status">Carregando notificações…</p>`;
    });

    const data = await apiNotificacoes("listar");
    if (!data || data.sucesso !== true) {
      const msg = escapeHtml((data && data.erro) || "Não foi possível carregar as notificações.");
      bodies.forEach((b) => {
        b.innerHTML = `<p class="notif-error">${msg}</p>`;
      });
      return null;
    }

    notifCache = data;
    bodies.forEach((b) => renderNotificacoes(b, data));
    updateBadges(data.nao_lidas || 0);
    return data;
  }

  async function marcarTodasLidas() {
    const data = await apiNotificacoes("marcar_todas_lidas");
    if (data && data.sucesso) {
      if (notifCache) {
        notifCache.nao_lidas = 0;
        (notifCache.importantes || []).forEach((n) => { n.lida = true; });
        (notifCache.outras || []).forEach((n) => { n.lida = true; });
      }
      document.querySelectorAll("[data-notif-body]").forEach((body) => {
        body.querySelectorAll(".item[data-unread]").forEach((el) => {
          el.removeAttribute("data-unread");
          el.classList.remove("notif-item--unread");
        });
      });
      updateBadges(0);
      window.dispatchEvent(new CustomEvent("ecocoleta:notificacoes-lidas"));
    }
  }

  function ensureBadge(wrapper) {
    const btn = wrapper.querySelector(".notif-btn");
    if (!btn || wrapper.querySelector("[data-notif-badge]")) return;
    const badge = document.createElement("span");
    badge.className = "notif-badge hidden";
    badge.setAttribute("data-notif-badge", "");
    btn.appendChild(badge);
  }

  function getOverlay(wrapper) {
    return wrapper._notifOverlayEl || wrapper.querySelector(".notif-overlay");
  }

  function mountOverlayPortal(wrapper, overlay) {
    if (!overlay || wrapper.classList.contains("adm-notif-wrapper")) return;
    if (overlay.parentElement !== document.body) {
      document.body.appendChild(overlay);
    }
    overlay.classList.add("notif-overlay--portal");
    wrapper._notifOverlayEl = overlay;
  }

  function prepareWrapper(wrapper) {
    if (!wrapper.classList.contains("adm-notif-wrapper")) {
      wrapper.classList.add("user-notif-wrapper");
    }
    const overlay = getOverlay(wrapper);
    if (!overlay) return null;
    mountOverlayPortal(wrapper, overlay);
    const box = overlay.querySelector(".notif-box");
    if (box) box.innerHTML = buildNotifBoxShell();
    ensureBadge(wrapper);
    return overlay;
  }

  const notifWrappers = Array.from(document.querySelectorAll(".notif-wrapper"));
  notifWrappers.forEach((wrapper) => {
    prepareWrapper(wrapper);
  });

  function positionOverlay(wrapper, overlay) {
    const btn = wrapper.querySelector(".notif-btn");
    if (!btn || !overlay) return;
    const rect = btn.getBoundingClientRect();
    const narrow = window.innerWidth <= 520;
    overlay.style.position = "fixed";
    overlay.style.bottom = "auto";
    if (narrow) {
      overlay.style.left = `${VIEWPORT_PAD}px`;
      overlay.style.right = `${VIEWPORT_PAD}px`;
      overlay.style.width = "auto";
      overlay.style.maxWidth = "none";
      overlay.style.top = `${Math.round(rect.bottom + GAP)}px`;
      return;
    }
    overlay.style.left = "auto";
    overlay.style.right = `${Math.round(Math.max(VIEWPORT_PAD, window.innerWidth - rect.right))}px`;
    overlay.style.width = "";
    overlay.style.maxWidth = "420px";
    overlay.style.top = `${Math.round(rect.bottom + GAP)}px`;
    requestAnimationFrame(() => {
      const panel = overlay.querySelector(".notif-box") || overlay;
      const panelRect = panel.getBoundingClientRect();
      if (panelRect.bottom > window.innerHeight - VIEWPORT_PAD) {
        overlay.style.top = `${Math.max(VIEWPORT_PAD, Math.round(rect.top - panelRect.height - GAP))}px`;
      }
      const nextRect = panel.getBoundingClientRect();
      if (nextRect.left < VIEWPORT_PAD) {
        overlay.style.left = `${VIEWPORT_PAD}px`;
        overlay.style.right = "auto";
      }
    });
  }

  function getNotifBackdrop() {
    let backdrop = document.getElementById("ecocoleta-notif-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "ecocoleta-notif-backdrop";
      backdrop.className = "notif-backdrop hidden";
      backdrop.setAttribute("aria-hidden", "true");
      document.body.appendChild(backdrop);
      backdrop.addEventListener("click", () => closeAllOverlays());
    }
    return backdrop;
  }

  function showNotifBackdrop() {
    const backdrop = getNotifBackdrop();
    backdrop.classList.remove("hidden");
    requestAnimationFrame(() => backdrop.classList.add("is-visible"));
  }

  function hideNotifBackdrop() {
    const backdrop = document.getElementById("ecocoleta-notif-backdrop");
    if (!backdrop) return;
    backdrop.classList.remove("is-visible");
    window.setTimeout(() => {
      if (!backdrop.classList.contains("is-visible")) {
        backdrop.classList.add("hidden");
      }
    }, 240);
  }

  function syncNotifOpenState() {
    const open = !!document.querySelector(".notif-overlay.show");
    document.body.classList.toggle("ecocoleta-notif-open", open);
  }

  function isNotifUiTarget(target) {
    if (!target || !target.closest) return false;
    if (target.closest("#ecocoleta-notif-backdrop")) return true;
    return notifWrappers.some((w) => {
      if (w.contains(target)) return true;
      const overlay = getOverlay(w);
      return overlay && overlay.contains(target);
    });
  }

  function closeOverlay(overlay) {
    if (!overlay) return;
    overlay.classList.remove("show");
    overlay.classList.add("hidden");
    if (!document.querySelector(".notif-overlay.show")) {
      hideNotifBackdrop();
    }
    syncNotifOpenState();
  }

  async function openOverlay(wrapper, overlay) {
    if (!overlay) return;
    mountOverlayPortal(wrapper, overlay);
    const isUserPanel = wrapper.classList.contains("user-notif-wrapper");
    if (isUserPanel) showNotifBackdrop();
    positionOverlay(wrapper, overlay);
    overlay.classList.remove("hidden");
    ignoreOutsideClick = true;
    requestAnimationFrame(() => {
      positionOverlay(wrapper, overlay);
      overlay.classList.add("show");
      syncNotifOpenState();
      setTimeout(() => { ignoreOutsideClick = false; }, 0);
    });
    const body = overlay.querySelector("[data-notif-body]");
    await carregarNotificacoes(true, body);
    positionOverlay(wrapper, overlay);
  }

  function closeAllOverlays() {
    notifWrappers.forEach((w) => closeOverlay(getOverlay(w)));
    hideNotifBackdrop();
  }

  function repositionOpenOverlays() {
    notifWrappers.forEach((wrapper) => {
      const overlay = getOverlay(wrapper);
      if (overlay && overlay.classList.contains("show")) {
        positionOverlay(wrapper, overlay);
      }
    });
  }

  let repositionOverlayRaf = 0;
  function scheduleRepositionOpenOverlays() {
    if (repositionOverlayRaf) {
      cancelAnimationFrame(repositionOverlayRaf);
    }
    repositionOverlayRaf = requestAnimationFrame(() => {
      repositionOverlayRaf = 0;
      repositionOpenOverlays();
    });
  }

  if (notifWrappers.length) {
    notifWrappers.forEach((wrapper) => {
      const notifBtn = wrapper.querySelector(".notif-btn");
      const notifOverlay = getOverlay(wrapper);
      if (!notifBtn || !notifOverlay) return;

      notifBtn.type = "button";
      notifBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (notifOverlay.classList.contains("show")) {
          closeOverlay(notifOverlay);
        } else {
          closeAllOverlays();
          openOverlay(wrapper, notifOverlay);
        }
      });

      const closeBtn = notifOverlay.querySelector(".close-notif");
      if (closeBtn) {
        closeBtn.type = "button";
        closeBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          closeOverlay(notifOverlay);
        });
      }

      const markAllBtn = notifOverlay.querySelector("[data-notif-mark-all]");
      if (markAllBtn) {
        markAllBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          void marcarTodasLidas();
        });
      }

      wrapper.addEventListener("click", (e) => e.stopPropagation());
    });

    window.addEventListener("resize", scheduleRepositionOpenOverlays, { passive: true });
    window.addEventListener("scroll", scheduleRepositionOpenOverlays, { passive: true });

    document.addEventListener("click", (e) => {
      if (ignoreOutsideClick) return;
      if (!isNotifUiTarget(e.target)) closeAllOverlays();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" || e.key === "Esc") closeAllOverlays();
    });

    apiNotificacoes("contar_nao_lidas").then((data) => {
      if (data && data.sucesso) updateBadges(data.nao_lidas || 0);
    }).catch(() => {});

    function aplicarSaldoDoPerfil(data) {
      if (!data || data.sucesso !== true || !data.usuario) return;
      const saldo = parseInt(data.usuario.saldo_ecopoints, 10);
      if (Number.isNaN(saldo) || saldo < 0) return;
      try {
        localStorage.setItem("userPoints", String(saldo));
      } catch (err) {}
      window.dispatchEvent(
        new CustomEvent("ecocoleta:saldo-atualizar", { detail: { saldo_ecopoints: saldo } })
      );
    }

    async function sincronizarSaldoUsuario(force) {
      const cached =
        !force && window.EcoColetaFetch && typeof window.EcoColetaFetch.getCached === "function"
          ? window.EcoColetaFetch.getCached("meu_perfil")
          : null;
      if (cached) {
        aplicarSaldoDoPerfil(cached);
        return;
      }
      const prefix = /\/(pages|auth|admin|mapa)\//.test(window.location.pathname) ? "../" : "";
      const perfilUrl = new URL(prefix + "api/meu_perfil.php", window.location.href).href;
      try {
        const data =
          window.EcoColetaFetch && typeof window.EcoColetaFetch.fetchJson === "function"
            ? await window.EcoColetaFetch.fetchJson(perfilUrl, {
                cacheKey: "meu_perfil",
                ttlMs: 90000,
                force: !!force,
              })
            : JSON.parse(
                await (
                  await fetch(perfilUrl, { method: "GET", credentials: "same-origin", cache: "no-store" })
                ).text()
              );
        aplicarSaldoDoPerfil(data);
      } catch (err) {}
    }

    window.addEventListener("ecocoleta:profile-loaded", (ev) => {
      aplicarSaldoDoPerfil(ev.detail);
    });

    let ultimoBadge = 0;
    let pollTimer = null;

    async function pollNotificacoes() {
      const data = await apiNotificacoes("contar_nao_lidas").catch(() => null);
      if (!data || !data.sucesso) return;
      const n = data.nao_lidas || 0;
      if (n !== ultimoBadge) {
        ultimoBadge = n;
        updateBadges(n);
        notifCache = null;
        await carregarNotificacoes(true);
        await sincronizarSaldoUsuario();
        window.dispatchEvent(new CustomEvent("ecocoleta:notificacoes-atualizar"));
      }
    }

    window.addEventListener("ecocoleta:notificacoes-atualizar", () => {
      notifCache = null;
      apiNotificacoes("contar_nao_lidas").then((data) => {
        if (data && data.sucesso) {
          ultimoBadge = data.nao_lidas || 0;
          updateBadges(ultimoBadge);
        }
      });
      void sincronizarSaldoUsuario();
    });

    apiNotificacoes("contar_nao_lidas").then((data) => {
      if (data && data.sucesso) ultimoBadge = data.nao_lidas || 0;
    }).catch(() => {});

    const POLL_MS = 45000;

    function startPollTimer() {
      if (pollTimer) return;
      pollTimer = window.setInterval(() => {
        if (document.hidden) return;
        void pollNotificacoes();
      }, POLL_MS);
    }

    function stopPollTimer() {
      if (!pollTimer) return;
      window.clearInterval(pollTimer);
      pollTimer = null;
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopPollTimer();
        return;
      }
      void pollNotificacoes();
      startPollTimer();
    });

    startPollTimer();
  }

  window.EcoColetaNotificacoes = {
    recarregar: () => {
      notifCache = null;
      return carregarNotificacoes(true);
    },
  };

  try {
    window.__ecocoletaNotifInit = true;
  } catch (err) {}
});
