
(function () {
  if (!window.ecocoletaPhpUrl) {
    var s = document.createElement("script");
    s.src = (/\/(pages|auth|admin|mapa)\//.test(window.location.pathname) ? "../" : "") + "assets/js/ecocoleta-paths.js?v=1";
    document.head.appendChild(s);
  }

  const MQ = "(max-width: 900px)";
  const DEFAULT_AVATAR = "assets/images/icons pessoa.png";

  function isLoggedIn() {
    return localStorage.getItem("loggedIn") === "true";
  }

  function syncGuestHeaderState() {
    const isGuest = !isLoggedIn();
    if (document.body) {
      document.body.classList.toggle("ecocoleta-guest", isGuest);
      document.body.classList.toggle("ecocoleta-authenticated", !isGuest);
    }
    document.querySelectorAll("header.topo .notif-wrapper").forEach(function (notif) {
      notif.classList.toggle("guest-hidden", isGuest);
      notif.style.display = isGuest ? "none" : "";
    });
  }

  function projectRootPrefix() {
    return /\/(pages|auth|admin|mapa)\//.test(window.location.pathname) ? "../" : "";
  }

  function appHref(relativeFromRoot) {
    var rel = String(relativeFromRoot || "").replace(/^\//, "");
    if (window.ecocoletaPageUrl && /\.html$/i.test(rel) && !/^(auth|admin|api|assets|ecocheck)/i.test(rel)) {
      return window.ecocoletaPageUrl(rel.replace(/^pages\//i, ""));
    }
    if (document.querySelector("base[data-app-base]")) {
      return rel;
    }
    return projectRootPrefix() + rel;
  }

  function serverPhpUrl(arquivoPhp) {
    if (window.ecocoletaPhpUrl) {
      return window.ecocoletaPhpUrl(arquivoPhp);
    }
    if (window.location.protocol === "file:") {
      return null;
    }
    return new URL(projectRootPrefix() + arquivoPhp, window.location.href).href;
  }

  function currentReturnUrl() {
    var path = window.location.pathname.replace(/\\/g, "/");
    var file = path.split("/").pop() + window.location.search + window.location.hash;
    if (/\/pages\//i.test(path)) {
      return "pages/" + file;
    }
    if (/\/auth\//i.test(path)) {
      return "auth/" + file;
    }
    return file;
  }

  function authUrl(file) {
    const authPage = file === "login.html" ? "auth/login.html" : file === "cadastro.html" ? "auth/cadastro.html" : file;
    return appHref(authPage) + "?redirect=" + encodeURIComponent(currentReturnUrl());
  }

  function openAuthModal(message) {
    let modal = document.getElementById("ecocoletaAuthModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "ecocoletaAuthModal";
      modal.className = "auth-modal-overlay hidden";
      var authRoot = window.ecocoletaProjectRoot || '/';
      modal.innerHTML =
        '<div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">' +
        '  <button type="button" class="auth-modal-close" aria-label="Fechar">&times;</button>' +
        '  <span class="auth-modal-badge">Conta EcoColeta</span>' +
        '  <h2 id="authModalTitle">Entre para continuar</h2>' +
        '  <p data-auth-message>Para usar esta funcionalidade, faça login ou crie sua conta gratuitamente.</p>' +
        '  <div class="auth-modal-actions">' +
        '    <a class="auth-login-btn" data-auth-login href="' + authRoot + 'auth/login.html">Fazer login</a>' +
        '    <a class="auth-register-btn" data-auth-register href="' + authRoot + 'auth/cadastro.html">Criar conta</a>' +
        '  </div>' +
        '</div>';
      document.body.appendChild(modal);
      modal.addEventListener("click", function (event) {
        if (event.target === modal || event.target.classList.contains("auth-modal-close")) {
          closeAuthModal();
        }
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" || event.key === "Esc") {
          closeAuthModal();
        }
      });
    }

    const msg = modal.querySelector("[data-auth-message]");
    const login = modal.querySelector("[data-auth-login]");
    const register = modal.querySelector("[data-auth-register]");
    if (msg) {
      msg.textContent = message || "Para usar esta funcionalidade, faça login ou crie sua conta gratuitamente.";
    }
    if (login) {
      login.href = authUrl("login.html");
    }
    if (register) {
      register.href = authUrl("cadastro.html");
    }
    modal.classList.remove("hidden");
    document.body.classList.add("auth-modal-open");
  }

  function closeAuthModal() {
    const modal = document.getElementById("ecocoletaAuthModal");
    if (modal) {
      modal.classList.add("hidden");
    }
    document.body.classList.remove("auth-modal-open");
  }

  window.EcoColetaAuth = window.EcoColetaAuth || {
    isLoggedIn: isLoggedIn,
    open: openAuthModal,
    requireLogin: function (message) {
      if (isLoggedIn()) {
        return true;
      }
      openAuthModal(message);
      return false;
    },
  };

  function isValidProfilePhoto(src) {
    if (!src) {
      return false;
    }
    return (
      src.indexOf("data:image") === 0 ||
      src.indexOf("uploads/") === 0 ||
      src.indexOf("assets/images/") === 0 ||
      src.indexOf("http://") === 0 ||
      src.indexOf("https://") === 0 ||
      src.indexOf("/") === 0
    );
  }

  function applyHeaderUser(profileLink, data) {
    syncGuestHeaderState();
    if (!profileLink) {
      return;
    }
    if (!isLoggedIn()) {
      const notif = profileLink.closest(".icones") ? profileLink.closest(".icones").querySelector(".notif-wrapper") : null;
      const icons = profileLink.closest(".icones");
      if (icons) {
        icons.classList.add("is-guest");
      }
      if (notif) {
        notif.classList.add("guest-hidden");
        notif.style.display = "none";
      }
      const registerLink = profileLink.parentElement
        ? profileLink.parentElement.querySelector(".user-register-link")
        : null;
      if (registerLink) {
        registerLink.remove();
      }
      profileLink.classList.add("user-login-link");
      profileLink.classList.remove("user-profile-link");
      profileLink.setAttribute("href", authUrl("login.html"));
      profileLink.setAttribute("aria-label", "Entrar na EcoColeta");
      profileLink.innerHTML = "<span>Entrar</span>";
      profileLink.addEventListener("click", function (event) {
        if (!isLoggedIn()) {
          event.preventDefault();
          openAuthModal("Entre ou crie uma conta para acessar seu perfil.");
        }
      }, { once: true });
      return;
    }

    const name = (data && data.nome ? String(data.nome) : localStorage.getItem("userName") || "Usuário").trim() || "Usuário";
    const notif = profileLink.closest(".icones") ? profileLink.closest(".icones").querySelector(".notif-wrapper") : null;
    const icons = profileLink.closest(".icones");
    if (icons) {
      icons.classList.remove("is-guest");
    }
    if (notif) {
      notif.classList.remove("guest-hidden");
      notif.style.display = "";
    }
    const registerLink = profileLink.parentElement ? profileLink.parentElement.querySelector(".user-register-link") : null;
    if (registerLink) {
      registerLink.remove();
    }
    const photoRaw = data && data.foto ? String(data.foto).trim() : localStorage.getItem("userFoto") || "";
    const photo = isValidProfilePhoto(photoRaw) ? photoRaw : DEFAULT_AVATAR;

    profileLink.classList.add("user-profile-link");
    profileLink.classList.remove("user-login-link");
    profileLink.setAttribute("href", appHref("pages/perfil.html"));
    profileLink.setAttribute("aria-label", "Abrir perfil de " + name);

    let img = profileLink.querySelector(".user-profile-photo");
    let label = profileLink.querySelector(".user-profile-name");

    if (!img) {
      img = document.createElement("img");
      img.className = "user-profile-photo";
      img.alt = "Foto de " + name;
    }
    if (!label) {
      label = document.createElement("span");
      label.className = "user-profile-name";
    }

    img.src = photo;
    img.alt = "Foto de " + name;
    img.onerror = function () {
      img.onerror = null;
      img.src = DEFAULT_AVATAR;
    };
    label.textContent = name.split(/\s+/).slice(0, 2).join(" ");

    profileLink.innerHTML = "";
    profileLink.appendChild(img);
    profileLink.appendChild(label);
  }

  function initHeaderUserProfile() {
    const header = document.querySelector("header.topo");
    if (!header || header.dataset.userProfileInit === "1") {
      return;
    }
    syncGuestHeaderState();
    const profileLink = header.querySelector('.icones a[href*="perfil"]');
    if (!profileLink) {
      return;
    }

    header.dataset.userProfileInit = "1";
    applyHeaderUser(profileLink, null);

    if (window.location.protocol === "file:") {
      return;
    }

    const perfilUrl = serverPhpUrl("meu_perfil.php");
    if (!perfilUrl) {
      return;
    }

    function applyPerfilResponse(data) {
      if (!data || data.sucesso !== true || !data.usuario) {
        const erro = data && data.erro ? String(data.erro) : "";
        if (erro.indexOf("Sessao") !== -1 || erro.indexOf("Sessão") !== -1) {
          localStorage.removeItem("loggedIn");
          applyHeaderUser(profileLink, null);
        }
        return;
      }
      try {
        window.dispatchEvent(new CustomEvent("ecocoleta:profile-loaded", { detail: data }));
      } catch (err) {}
      const user = data.usuario;
      if (user.nome != null) {
        localStorage.setItem("userName", String(user.nome));
      }
      if (user.foto_perfil) {
        localStorage.setItem("userFoto", String(user.foto_perfil));
      }
      applyHeaderUser(profileLink, {
        nome: user.nome,
        foto: user.foto_perfil,
      });
    }

    const fetchPerfil =
      window.EcoColetaFetch && typeof window.EcoColetaFetch.fetchJson === "function"
        ? window.EcoColetaFetch.fetchJson(perfilUrl, {
            cacheKey: "meu_perfil",
            ttlMs: 90000,
          })
        : fetch(perfilUrl, {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
          })
            .then((res) => res.text())
            .then((text) => JSON.parse(String(text || "").replace(/^\uFEFF/, "").trim()));

    fetchPerfil.then(applyPerfilResponse).catch(() => {});
  }

  function initMainNavMenu() {
    const menu = document.querySelector("header.topo .menu");
    if (!menu) {
      return;
    }
    const items = [
      ["tela-inicia.html", "Home"],
      ["pagina-relatorio.html", "Gerar Relatório"],
      ["como-funciona.html", "Como Funciona"],
      ["ecopontos.html", "EcoPontos"],
      ["premios-disponiveis.html", "Prêmios"],
      ["educacao-ambiental.html", "Educação"],
      ["quem-somos.html", "Quem Somos"],
      ["Ranking.html", "Ranking"],
    ];
    menu.innerHTML = items
      .map(function (pair) {
        return (
          "<li><a href=\"" +
          appHref(pair[0]) +
          "\">" +
          pair[1] +
          "</a></li>"
        );
      })
      .join("");
  }

  function initActiveHeaderLink() {
    const header = document.querySelector("header.topo");
    if (!header) {
      return;
    }
    const currentFile = (window.location.pathname.split("/").pop() || "tela-inicia.html").toLowerCase();
    const aliases = {
      "index.html": "tela-inicia.html",
      "": "tela-inicia.html",
      "relatorio-mensal.html": "pagina-relatorio.html",
      "formulario-coleta.html": "agendar-coleta.html",
    };
    const activeFile = aliases[currentFile] || currentFile;

    header.querySelectorAll(".menu a").forEach((link) => {
      const href = (link.getAttribute("href") || "").split("?")[0].split("#")[0];
      const linkFile = (href.split("/").pop() || "").toLowerCase();
      const normalizedLink = aliases[linkFile] || linkFile;
      const isActive = normalizedLink === activeFile;

      link.classList.toggle("active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function initPrivateActionGuards() {
    document.addEventListener("click", function (event) {
      if (isLoggedIn()) {
        return;
      }
      const target = event.target.closest(
        ".btn-editar, .btn-editar-endereco, #openDeleteAccountOverlay, #confirmarPerfilBtn, #editarEnderecoBtn, #agendaForm button[type='submit'], .coupon-button, [data-requires-auth]"
      );
      if (!target) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      openAuthModal("Essa ação precisa de uma conta EcoColeta. Faça login ou cadastre-se para continuar.");
    }, true);

    document.addEventListener("submit", function (event) {
      if (isLoggedIn()) {
        return;
      }
      if (event.target && event.target.matches("#agendaForm, #perfilForm, #perfilEditForm")) {
        event.preventDefault();
        event.stopPropagation();
        openAuthModal("Para enviar este formulário, faça login ou crie sua conta.");
      }
    }, true);
  }

  function initMobileNav() {
    const header = document.querySelector("header.topo");
    if (!header || header.dataset.mobileNavInit === "1") {
      return;
    }

    const navLeft = header.querySelector(".nav-left");
    const nav = navLeft
      ? navLeft.querySelector("nav")
      : header.querySelector("nav");
    const logo = navLeft ? navLeft.querySelector(".logo-link") : null;
    const icones = header.querySelector(".icones");

    if (!nav || !icones) {
      return;
    }

    header.dataset.mobileNavInit = "1";
    nav.id = "ecocoleta-main-nav";
    nav.classList.add("topo-mobile-nav");

    let btn = header.querySelector(".menu-hamburger");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "menu-hamburger";
      btn.setAttribute("aria-label", "Abrir menu de navegação");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", "ecocoleta-main-nav");
      btn.innerHTML = "<span aria-hidden=\"true\">☰</span>";

      icones.appendChild(btn);
    }

    let backdrop = document.querySelector(".topo-mobile-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "topo-mobile-backdrop hidden";
      backdrop.setAttribute("aria-hidden", "true");
      document.body.appendChild(backdrop);
    }

    const mql = window.matchMedia(MQ);

    function isMobile() {
      return mql.matches;
    }

    function placeNavDesktop() {
      if (!navLeft || !logo) {
        return;
      }
      if (nav.parentElement !== navLeft) {
        logo.insertAdjacentElement("afterend", nav);
      }
    }

    function placeNavMobile() {
      if (nav.parentElement !== document.body) {
        document.body.appendChild(nav);
      }
    }

    function syncNavPlacement() {
      if (isMobile()) {
        placeNavMobile();
      } else {
        closeMenu();
        placeNavDesktop();
      }
    }

    function closeMenu() {
      nav.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", "Abrir menu de navegação");
      const icon = btn.querySelector("span");
      if (icon) {
        icon.textContent = "☰";
      }
      backdrop.classList.add("hidden");
      backdrop.setAttribute("aria-hidden", "true");
      document.body.classList.remove("topo-menu-open");
    }

    function openMenu() {
      placeNavMobile();
      nav.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
      btn.setAttribute("aria-label", "Fechar menu de navegação");
      const icon = btn.querySelector("span");
      if (icon) {
        icon.textContent = "✕";
      }
      backdrop.classList.remove("hidden");
      backdrop.setAttribute("aria-hidden", "false");
      document.body.classList.add("topo-menu-open");
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isMobile()) {
        return;
      }
      if (nav.classList.contains("is-open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    backdrop.addEventListener("click", closeMenu);

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        if (isMobile()) {
          closeMenu();
        }
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" || e.key === "Esc") {
        closeMenu();
      }
    });

    document.addEventListener("click", (e) => {
      if (!isMobile() || !nav.classList.contains("is-open")) {
        return;
      }
      if (nav.contains(e.target) || btn.contains(e.target)) {
        return;
      }
      closeMenu();
    });

    mql.addEventListener("change", syncNavPlacement);

    window.addEventListener(
      "resize",
      () => {
        syncNavPlacement();
      },
      { passive: true }
    );

    syncNavPlacement();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initMainNavMenu();
      initHeaderUserProfile();
      initActiveHeaderLink();
      initPrivateActionGuards();
      initMobileNav();
    });
  } else {
    initMainNavMenu();
    initHeaderUserProfile();
    initActiveHeaderLink();
    initPrivateActionGuards();
    initMobileNav();
  }
})();
