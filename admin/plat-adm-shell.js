
(function (global) {
  "use strict";

  var LOGIN_PAGE = "admin/Login-ADM.html";
  var SESSION_URL = global.ecocoletaPhpUrl
    ? global.ecocoletaPhpUrl("admin-plataforma-session.php")
    : "admin/admin-plataforma-session.php";
  var SIDEBAR_KEY = "ecocoletaPlatSidebarExpanded";

  function parseJsonServidor(text) {
    var raw = String(text || "").replace(/^\uFEFF/, "").trim();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (e) {
      var idx = raw.indexOf('{"');
      if (idx >= 0) return JSON.parse(raw.slice(idx));
      throw e;
    }
  }

  function inicialDoNome(nome) {
    var parte = String(nome || "A").trim().split(/\s+/)[0];
    return (parte.charAt(0) || "A").toUpperCase();
  }

  global.PlatAdmShell = {
    loginPage: LOGIN_PAGE,
    sessionUrl: SESSION_URL,

    fetchSession: function () {
      return fetch(SESSION_URL, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      }).then(function (r) {
        return r.text();
      }).then(parseJsonServidor);
    },

    applyAdminUi: function (admin) {
      var nome = admin.nome || "Administrador";
      var el = {
        initial: document.getElementById("profileInitial"),
        name: document.getElementById("profileName"),
        email: document.getElementById("profileEmail"),
        role: document.getElementById("profileRole"),
      };
      if (el.initial) el.initial.textContent = inicialDoNome(nome);
      if (el.name) el.name.textContent = nome;
      if (el.email) el.email.textContent = admin.email || "—";
      if (el.role) el.role.textContent = admin.cargo || "Plataforma EcoColeta";
      localStorage.setItem("ecocoletaPlatAdminLoggedIn", "true");
      localStorage.setItem("ecocoletaPlatAdminName", nome);
      localStorage.setItem("ecocoletaPlatAdminEmail", admin.email || "");
      localStorage.setItem("ecocoletaPlatAdminCargo", admin.cargo || "");
      if (admin.foto_perfil) {
        localStorage.setItem("ecocoletaPlatAdminFoto", admin.foto_perfil);
      }
    },

    setupSidebar: function () {
      var sidebar = document.getElementById("platSidebar");
      if (!sidebar || sidebar.classList.contains("plat-sidebar--premium")) {
        return;
      }
      var toggle = document.getElementById("sidebarToggle");
      var labels = document.getElementById("platSidebarLabels");
      if (!toggle) return;

      if (localStorage.getItem(SIDEBAR_KEY) === "1") {
        sidebar.classList.add("is-expanded");
        toggle.setAttribute("aria-expanded", "true");
        if (labels) labels.setAttribute("aria-hidden", "false");
      }

      toggle.addEventListener("click", function () {
        var open = sidebar.classList.toggle("is-expanded");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        if (labels) labels.setAttribute("aria-hidden", open ? "false" : "true");
        localStorage.setItem(SIDEBAR_KEY, open ? "1" : "0");
      });
    },

    setupProfileMenu: function () {
      var btn = document.getElementById("profileToggle");
      var menu = document.getElementById("profileMenu");
      if (!btn || !menu) return;

      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var isHidden = menu.classList.toggle("hidden");
        btn.setAttribute("aria-expanded", isHidden ? "false" : "true");
      });

      document.addEventListener("click", function () {
        menu.classList.add("hidden");
        btn.setAttribute("aria-expanded", "false");
      });
      menu.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    },

    setupLogout: function () {
      var logoutBtn = document.getElementById("logoutAdmin");
      if (!logoutBtn) return;
      logoutBtn.addEventListener("click", function () {
        logoutBtn.disabled = true;
        fetch(SESSION_URL + "?acao=logout", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        })
          .catch(function () {})
          .finally(function () {
            localStorage.removeItem("ecocoletaPlatAdminLoggedIn");
            localStorage.removeItem("ecocoletaPlatAdminName");
            localStorage.removeItem("ecocoletaPlatAdminEmail");
            localStorage.removeItem("ecocoletaPlatAdminCargo");
            global.location.replace(LOGIN_PAGE);
          });
      });
    },

    guardAuth: function () {
      return global.PlatAdmShell.fetchSession().then(function (data) {
        if (!data || data.sucesso !== true || !data.admin) {
          global.location.replace(LOGIN_PAGE);
          return Promise.reject(new Error("sessao"));
        }
        global.PlatAdmShell.applyAdminUi(data.admin);
        return data.admin;
      });
    },

    init: function () {
      global.PlatAdmShell.setupSidebar();
      global.PlatAdmShell.setupProfileMenu();
      global.PlatAdmShell.setupLogout();
      return global.PlatAdmShell.guardAuth().finally(function () {
        document.documentElement.classList.remove("plat-auth-checking");
      });
    },
  };
})(window);
