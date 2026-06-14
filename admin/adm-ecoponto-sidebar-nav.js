
(function () {
  "use strict";

  var NAV_ITEMS = [
    {
      id: "ecoponto",
      href: "admin/Home-ADM-Ecoponto.html",
      label: "Meu Ecoponto",
      icon: "adm-icon-home",
    },
    {
      id: "coletas",
      href: "admin/Coletas-ADM-Ecoponto.html",
      label: "Coletas",
      icon: "adm-icon-truck",
    },
    {
      id: "materiais",
      href: "admin/materias-ADM-Ecoponto.html",
      label: "Materiais",
      icon: "adm-icon-materiais",
    },
    {
      id: "relatorios",
      href: "admin/relatorio-ADM-Ecoponto.html",
      label: "Relatórios",
      icon: "adm-icon-reports",
    },
    {
      id: "configuracao",
      href: "admin/configuracoes-ADM-Ecoponto.html",
      label: "Configurações",
      icon: "adm-icon-settings",
    },
  ];

  var SIDE_ICON_PATHS = {
    "adm-icon-menu":
      '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
    "adm-icon-home":
      '<path d="M4 10.5 12 4l8 6.5V20a1.75 1.75 0 0 1-1.75 1.75H5.75A1.75 1.75 0 0 1 4 20v-9.5Z"/>' +
      '<path d="M10 21.75V14h4v7.75"/>',
    "adm-icon-truck":
      '<path d="M3.25 9h9.25V7h2.35l2.15 2.25H19.5v5.75H18"/>' +
      '<circle cx="7" cy="18" r="1.65"/>' +
      '<circle cx="16.5" cy="18" r="1.65"/>' +
      '<path d="M3.25 13.5H5.5M8.65 18H14.8"/>',
    "adm-icon-reports":
      '<path d="M14.25 2.25H8.25a1.75 1.75 0 0 0-1.75 1.75v15.5a1.75 1.75 0 0 0 1.75 1.75h7.5a1.75 1.75 0 0 0 1.75-1.75V7.75l-4.5-4.5Z"/>' +
      '<path d="M14.25 2.25v5.5h5.5"/>' +
      '<path d="M8.25 13.25h7.5M8.25 16.75h5.25"/>',
    "adm-icon-settings":
      '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>' +
      '<circle cx="12" cy="12" r="3"/>',
  };

  var STORAGE_KEY = "ecopontoAdmSidebarExpanded";

  function recycleIconSvg() {
    return (
      '<svg class="adm-eco-side-nav__svg adm-eco-side-nav__svg--recycle" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<text x="12" y="12" text-anchor="middle" dominant-baseline="central" fill="currentColor" ' +
      'font-size="17" font-family="Segoe UI Symbol, Apple Symbols, Noto Sans Symbols2, sans-serif">&#9851;</text>' +
      "</svg>"
    );
  }

  function iconSvg(iconId) {
    if (iconId === "adm-icon-materiais") {
      return recycleIconSvg();
    }
    var paths = SIDE_ICON_PATHS[iconId] || SIDE_ICON_PATHS["adm-icon-home"];
    return (
      '<svg class="adm-eco-side-nav__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      paths +
      "</svg>"
    );
  }

  function detectActiveId() {
    var path = location.pathname.replace(/\\/g, "/").toLowerCase();
    if (path.indexOf("coletas-adm-ecoponto") >= 0) return "coletas";
    if (path.indexOf("materias-adm-ecoponto") >= 0) return "materiais";
    if (path.indexOf("relatorio-adm-ecoponto") >= 0) return "relatorios";
    if (path.indexOf("configuracoes-adm-ecoponto") >= 0) return "configuracao";
    if (path.indexOf("home-adm-ecoponto") >= 0) return "ecoponto";
    return "";
  }

  function readSidebarExpanded() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) !== "0";
    } catch (e) {
      return true;
    }
  }

  function syncSidebarPrefClass(expanded) {
    var root = document.documentElement;
    root.classList.toggle("adm-sidebar-pref-expanded", expanded);
    root.classList.toggle("adm-sidebar-pref-collapsed", !expanded);
  }

  function applyAppSidebarLayout(expanded) {
    var app = document.querySelector(".adm-app");
    if (!app) return;
    var open = Boolean(expanded);
    app.setAttribute("data-sidebar-state", open ? "open" : "closed");
    app.style.setProperty("grid-template-columns", (open ? "280px" : "70px") + " 1fr", "important");
    app.classList.toggle("is-sidebar-expanded", open);
    app.classList.toggle("is-sidebar-collapsed", !open);
  }

  function invalidateMaps() {
    window.setTimeout(function () {
      [window.EcoColetaColetasMap, window.EcoColetaAdmMap].forEach(function (map) {
        if (map && typeof map.invalidateSize === "function") {
          map.invalidateSize();
        }
      });
    }, 280);
  }

  function markSidebarReady() {
    var app = document.querySelector(".adm-app");
    if (!app) return;
    window.requestAnimationFrame(function () {
      app.classList.add("is-sidebar-ready");
    });
  }

  function setExpanded(sidebar, toggle, expanded) {
    if (!sidebar) return;
    sidebar.classList.toggle("is-expanded", expanded);
    if (toggle) {
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      toggle.setAttribute(
        "aria-label",
        expanded ? "Recolher menu lateral" : "Expandir menu lateral"
      );
    }
    syncSidebarPrefClass(expanded);
    applyAppSidebarLayout(expanded);
    try {
      sessionStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
    } catch (e) {

    }
    invalidateMaps();
  }

  function setupToggle(sidebar, toggle, expanded) {
    if (!toggle) return;
    setExpanded(sidebar, toggle, expanded);
    toggle.addEventListener("click", function (e) {
      e.preventDefault();
      setExpanded(sidebar, toggle, !sidebar.classList.contains("is-expanded"));
    });
  }

  function renderSidebar() {
    var mount = document.getElementById("admSidebar");
    if (!mount) return;

    var active = detectActiveId();
    var expanded = readSidebarExpanded();
    var html =
      '<nav class="adm-eco-side-nav" aria-label="Navegação do painel">' +
      '<div class="adm-eco-side-nav__toggle-row">' +
      '<button type="button" class="adm-eco-side-nav__toggle" id="sidebarToggle" aria-label="Expandir menu lateral" aria-expanded="true" aria-controls="admEcoSideNavItems">' +
      iconSvg("adm-icon-menu") +
      "</button>" +
      '<span class="adm-eco-side-nav__toggle-spacer" aria-hidden="true"></span>' +
      "</div>" +
      '<div class="adm-eco-side-nav__items" id="admEcoSideNavItems">';

    NAV_ITEMS.forEach(function (item) {
      var isActive = item.id === active;
      html +=
        '<a href="' +
        item.href +
        '" class="adm-eco-side-nav__item' +
        (isActive ? " is-active" : "") +
        '"' +
        (isActive ? ' aria-current="page"' : "") +
        ">" +
        '<span class="adm-eco-side-nav__icon" aria-hidden="true">' +
        iconSvg(item.icon) +
        "</span>" +
        '<span class="adm-eco-side-nav__label">' +
        item.label +
        "</span>" +
        "</a>";
    });

    html +=
      "</div>" +
      '<div class="adm-eco-side-nav__footer">' +
      '<span class="adm-eco-side-nav__brand">EcoColeta</span>' +
      '<span class="adm-eco-side-nav__badge">Painel EcoPonto</span>' +
      "</div></nav>";

    mount.className = "adm-sidebar adm-sidebar--premium" + (expanded ? " is-expanded" : "");
    mount.setAttribute("aria-label", "Menu principal");
    mount.innerHTML = html;

    setupToggle(mount, document.getElementById("sidebarToggle"), expanded);
    markSidebarReady();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderSidebar);
  } else {
    renderSidebar();
  }
})();
