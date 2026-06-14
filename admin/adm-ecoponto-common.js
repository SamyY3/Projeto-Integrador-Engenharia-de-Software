(function (global) {
  "use strict";

  const LOGIN_PAGE = "Login-ADM-Ecoponto.html";
  const SESSION_URL = global.ecocoletaPhpUrl
    ? global.ecocoletaPhpUrl("admin-ecoponto-session.php")
    : "admin/admin-ecoponto-session.php";
  const SIDEBAR_STORAGE_KEY = "ecopontoAdmSidebarExpanded";

  function parseJsonServidor(text) {
    const raw = String(text || "").replace(/^\uFEFF/, "").trim();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (e) {
      const idx = raw.indexOf('{"');
      if (idx >= 0) return JSON.parse(raw.slice(idx));
      throw e;
    }
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
    });
    const data = parseJsonServidor(await response.text());
    if (!data || data.sucesso !== true) {
      const erro = (data && data.erro) || "Nao foi possivel carregar os dados.";
      throw new Error(erro);
    }
    return data;
  }

  function limparEcoCheckCliente() {
    try {
      sessionStorage.removeItem("ecocheck_token");
      sessionStorage.removeItem("ecocheck_token_exp");
    } catch (e) {

    }
    if (global.EcoCheckBridge && typeof global.EcoCheckBridge.reset === "function") {
      global.EcoCheckBridge.reset();
    } else if (global.EcoCheck && typeof global.EcoCheck.clearToken === "function") {
      global.EcoCheck.clearToken();
    }
    document.dispatchEvent(new CustomEvent("ecocheck:reset"));
  }

  function limparAdminLocal() {
    localStorage.removeItem("ecopontoAdminLoggedIn");
    localStorage.removeItem("ecopontoAdminName");
    localStorage.removeItem("ecopontoAdminEmail");
    localStorage.removeItem("ecopontoAdminPoint");
    localStorage.removeItem("ecopontoAdminEndereco");
    localStorage.removeItem("ecopontoAdminFoto");
    limparEcoCheckCliente();
  }

  function salvarAdminLocal(admin) {
    if (!admin) return;
    localStorage.setItem("ecopontoAdminLoggedIn", "true");
    localStorage.setItem("ecopontoAdminName", admin.nome || "");
    localStorage.setItem("ecopontoAdminEmail", admin.email || "");
    localStorage.setItem(
      "ecopontoAdminPoint",
      admin.ecoponto || admin.nome_ecoponto || ""
    );
    if (admin.endereco) {
      localStorage.setItem("ecopontoAdminEndereco", admin.endereco);
    }
    if (admin.foto_perfil) {
      localStorage.setItem("ecopontoAdminFoto", admin.foto_perfil);
    }
  }

  function obterBaseAppAdm() {
    const base = document.querySelector("base[data-app-base]");
    if (base && base.href) {
      try {
        return new URL(base.href, global.location.href).href;
      } catch (e) {
        return base.href;
      }
    }
    const path = global.location.pathname.replace(/\\/g, "/");
    const m = path.match(/^(.*\/)(?:admin|auth|pages|mapa)\/[^/]+$/);
    if (m) {
      return global.location.origin + m[1];
    }
    return global.location.origin + "/";
  }

  function resolverUrlFotoAdm(path, cacheBust) {
    if (!path) return "";
    const p = String(path).trim();
    if (/^(https?:|data:|blob:)/i.test(p)) {
      return p;
    }
    try {
      const url = new URL(p.replace(/^\//, ""), obterBaseAppAdm()).href;
      if (!cacheBust) return url;
      return url + (url.indexOf("?") >= 0 ? "&" : "?") + "_=" + Date.now();
    } catch (e) {
      return p;
    }
  }

  function isFotoAdminValida(path) {
    if (!path) return false;
    const p = String(path).trim().toLowerCase();
    if (!p || p === "null" || p === "undefined") return false;
    if (p.includes("logo") || p.includes("imagens/") || p.includes("ecocoleta.png")) {
      return false;
    }
    return (
      p.includes("uploads/") ||
      p.startsWith("data:image") ||
      p.startsWith("blob:") ||
      p.startsWith("http://") ||
      p.startsWith("https://")
    );
  }

  function garantirImgAvatarHeader(profileToggle) {
    if (!profileToggle) return null;
    const circle = profileToggle.querySelector(".adm-avatar__circle");
    if (!circle) return null;
    let img = circle.querySelector(".adm-avatar__photo");
    if (!img) {
      img = document.createElement("img");
      img.className = "adm-avatar__photo is-hidden";
      img.width = 44;
      img.height = 44;
      img.decoding = "async";
      img.alt = "";
      circle.insertBefore(img, circle.firstChild);
    }
    const fallback =
      circle.querySelector(".adm-profile-initial") ||
      circle.querySelector(".adm-avatar__initial");
    return { img, fallback };
  }

  function mostrarAvatarInicialEl(img, fallback, nome) {
    if (img) {
      img.classList.add("is-hidden");
      img.removeAttribute("src");
      img.onload = null;
      img.onerror = null;
    }
    if (fallback) {
      fallback.classList.remove("is-hidden");
      fallback.textContent = inicialDoNome(nome);
    }
  }

  function aplicarFotoAvatar(alvos, fotoPath, nome) {
    if (!alvos || !alvos.img || !alvos.fallback) return;
    const img = alvos.img;
    const fallback = alvos.fallback;
    const inicial = inicialDoNome(nome);
    fallback.textContent = inicial;

    if (!isFotoAdminValida(fotoPath)) {
      mostrarAvatarInicialEl(img, fallback, nome);
      return;
    }

    const url =
      /^data:image|^blob:/i.test(String(fotoPath))
        ? String(fotoPath)
        : resolverUrlFotoAdm(fotoPath, true);
    const aoErro = () => mostrarAvatarInicialEl(img, fallback, nome);
    const aoOk = () => {
      img.classList.remove("is-hidden");
      fallback.classList.add("is-hidden");
    };

    img.onload = aoOk;
    img.onerror = aoErro;
    img.alt = "Foto de " + (nome || "administrador");
    img.src = url;
    if (img.complete && img.naturalWidth > 0) {
      aoOk();
    }
  }

  function inicialDoNome(nome) {
    const parte = String(nome || "A").trim().split(/\s+/)[0];
    return (parte.charAt(0) || "A").toUpperCase();
  }

  function escHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function preencherPerfilHeader(els, admin) {
    const nome = admin.nome || "Administrador";
    const ecoponto = admin.ecoponto || "EcoPonto parceiro";
    const email = admin.email || "";
    const foto =
      admin.foto_perfil ||
      localStorage.getItem("ecopontoAdminFoto") ||
      "";
    if (els.profileInitial) els.profileInitial.textContent = inicialDoNome(nome);
    if (els.profileName) els.profileName.textContent = nome;
    if (els.profileEmail) els.profileEmail.textContent = email || "—";
    if (els.profilePoint) els.profilePoint.textContent = ecoponto;
    const avatarAlvos = garantirImgAvatarHeader(els.profileToggle);
    if (avatarAlvos) {
      aplicarFotoAvatar(avatarAlvos, foto, nome);
    }
  }

  function mostrarErroAuth(els, mensagem) {
    if (!els.authError) return;
    els.authError.textContent = mensagem;
    els.authError.classList.add("visible");
    document.documentElement.classList.remove("admin-auth-checking");
  }

  function loginAdminUrl() {
    try {
      return new URL("admin/" + LOGIN_PAGE, obterBaseAppAdm()).href;
    } catch (e) {
      return LOGIN_PAGE;
    }
  }

  function voltarLoginAdmin() {
    limparAdminLocal();
    global.location.replace(loginAdminUrl());
  }

  function mensagemSessaoExpirada(msg) {
    return /sess[aã]o administrativa/i.test(String(msg || ""));
  }

  let keepaliveTimer = null;

  function iniciarKeepaliveSessaoAdmin() {
    if (keepaliveTimer) {
      global.clearInterval(keepaliveTimer);
    }
    keepaliveTimer = global.setInterval(function () {
      if (document.hidden) return;
      fetch(SESSION_URL, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      }).catch(function () {});
    }, 4 * 60 * 1000);
  }

  async function encerrarSessao(els) {
    if (els.logout) els.logout.disabled = true;
    try {
      await fetch(SESSION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: "acao=logout",
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch (e) {

    }
    voltarLoginAdmin();
  }

  async function validarSessaoAdmin(els, onOk) {
    const controller = new AbortController();
    const timeoutId = global.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(SESSION_URL, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      global.clearTimeout(timeoutId);
      const data = parseJsonServidor(await response.text());
      if (!data || data.sucesso !== true || !data.admin) {
        const erro =
          (data && data.erro) || "Sessao administrativa expirada. Faca login novamente.";
        mostrarErroAuth(els, erro);
        if (mensagemSessaoExpirada(erro)) {
          global.setTimeout(voltarLoginAdmin, 2200);
        }
        return;
      }
      salvarAdminLocal(data.admin);
      preencherPerfilHeader(els, data.admin);
      iniciarKeepaliveSessaoAdmin();
      if (typeof onOk === "function") {
        await onOk(data.admin);
      }
    } catch (error) {
      global.clearTimeout(timeoutId);
      const demorou = error && error.name === "AbortError";
      mostrarErroAuth(
        els,
        demorou
          ? "O servidor demorou para responder. Confira Apache/MySQL e recarregue a pagina (F5)."
          : "Nao foi possivel validar a sessao. Verifique o Apache no XAMPP e recarregue."
      );
    }
  }

  function aplicarSidebarExpandida(els, expandida) {
    if (!els.sidebar || !els.sidebarToggle) return;
    const aberto = Boolean(expandida);
    els.sidebar.classList.toggle("is-expanded", aberto);
    els.sidebarToggle.setAttribute("aria-expanded", aberto ? "true" : "false");
    els.sidebarToggle.setAttribute(
      "aria-label",
      aberto ? "Recolher menu lateral" : "Expandir menu lateral"
    );
    if (els.sidebarLabels) {
      els.sidebarLabels.setAttribute("aria-hidden", aberto ? "false" : "true");
    }
    try {
      sessionStorage.setItem(SIDEBAR_STORAGE_KEY, aberto ? "1" : "0");
    } catch (e) {

    }
    global.setTimeout(() => {
      const maps = [
        global.EcoColetaColetasMap,
        global.EcoColetaAdmMap,
      ];
      maps.forEach((map) => {
        if (map && typeof map.invalidateSize === "function") map.invalidateSize();
      });
    }, 280);
  }

  function setupSidebar(els) {
    if (els.sidebar && els.sidebar.classList.contains("adm-sidebar--premium")) {
      return;
    }

    function alternarSidebar() {
      if (!els.sidebar) return;
      aplicarSidebarExpandida(
        els,
        !els.sidebar.classList.contains("is-expanded")
      );
    }
    function restaurarSidebar() {
      try {
        if (sessionStorage.getItem(SIDEBAR_STORAGE_KEY) === "1") {
          aplicarSidebarExpandida(els, true);
        }
      } catch (e) {

      }
    }
    if (els.sidebarToggle) {
      els.sidebarToggle.addEventListener("click", (e) => {
        e.preventDefault();
        alternarSidebar();
      });
    }
    restaurarSidebar();
  }

  function setupProfileMenu(els) {
    if (!els.profileToggle || !els.profileMenu) return;
    els.profileToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const fechado = els.profileMenu.classList.toggle("hidden");
      els.profileToggle.setAttribute("aria-expanded", fechado ? "false" : "true");
    });
    document.addEventListener("click", (event) => {
      if (
        els.profileMenu.contains(event.target) ||
        els.profileToggle.contains(event.target)
      ) {
        return;
      }
      els.profileMenu.classList.add("hidden");
      els.profileToggle.setAttribute("aria-expanded", "false");
    });
    if (els.logout) {
      els.logout.addEventListener("click", () => encerrarSessao(els));
    }
  }

  function badgeStatusColeta(status) {
    const map = {
      pendente: { cls: "adm-badge-confirmado", label: "Pendente" },
      aguardando_validacao: { cls: "adm-badge-andamento", label: "Aguardando validação" },
      confirmado: { cls: "adm-badge-confirmado", label: "Confirmado" },
      andamento: { cls: "adm-badge-andamento", label: "Em Andamento" },
      concluida: { cls: "adm-badge-coletado", label: "Concluída" },
      cancelado: { cls: "adm-badge-andamento", label: "Cancelado" },
    };
    const item = map[status] || map.confirmado;
    return (
      '<span class="adm-badge ' +
      item.cls +
      '">' +
      escHtml(item.label) +
      "</span>"
    );
  }

  function iconeTipoColeta(tipo, iconOnly) {
    const isPref = tipo === "prefeitura";
    const label = isPref ? "Prefeitura" : "EcoPonto";
    const mod = isPref ? "prefeitura" : "truck";
    const onlyIcon = iconOnly === true;
    const svg = isPref
      ? '<svg class="adm-tipo-chip__svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<path d="M4 21h16v-2H4v2Zm2-4h12l-1-10H7L6 17Zm2-8h8v2H8V9Zm0 3h6v2H8v-2Z"/>' +
        "</svg>"
      : '<svg class="adm-tipo-chip__svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<path d="M1.5 12.5h11.8l2.6-2.6h3.6V7.2L15.4 4.8H8.8V3H1.5v9.5Zm2.2 6.2a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Zm10.8 0a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z"/>' +
        "</svg>";
    return (
      '<span class="adm-tipo-chip adm-tipo-chip--' +
      mod +
      (onlyIcon ? " adm-tipo-chip--icon-only" : "") +
      '" title="' +
      escHtml(label) +
      '"' +
      (onlyIcon ? ' aria-label="' + escHtml(label) + '"' : "") +
      ">" +
      '<span class="adm-tipo-chip__icon" aria-hidden="true">' +
      svg +
      "</span>" +
      (onlyIcon
        ? ""
        : '<span class="adm-tipo-chip__label">' + escHtml(label) + "</span>") +
      "</span>"
    );
  }

  global.EcoAdm = {
    LOGIN_PAGE,
    SESSION_URL,
    SIDEBAR_STORAGE_KEY,
    parseJsonServidor,
    fetchJson,
    limparAdminLocal,
    salvarAdminLocal,
    inicialDoNome,
    obterBaseAppAdm,
    resolverUrlFotoAdm,
    isFotoAdminValida,
    garantirImgAvatarHeader,
    aplicarFotoAvatar,
    escHtml,
    preencherPerfilHeader,
    mostrarErroAuth,
    loginAdminUrl,
    voltarLoginAdmin,
    encerrarSessao,
    validarSessaoAdmin,
    iniciarKeepaliveSessaoAdmin,
    mensagemSessaoExpirada,
    aplicarSidebarExpandida,
    setupSidebar,
    setupProfileMenu,
    badgeStatusColeta,
    iconeTipoColeta,
  };
})(window);
