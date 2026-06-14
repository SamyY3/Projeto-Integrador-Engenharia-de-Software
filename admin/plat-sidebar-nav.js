

(function () {
  "use strict";

  var NAV_ITEMS = [
    { id: "inicial", href: "admin/Home-ADM.html", label: "Inicial", icon: "adm-icon-home" },
    { id: "ecopontos", href: "admin/ecoponto-adm.html", label: "Ecopontos", icon: "plat-icon-map" },
    { id: "agendamentos", href: "admin/agendamento-adm.html", label: "Agendamentos", icon: "plat-icon-calendar" },
    { id: "usuarios", href: "admin/usuarios-adm.html", label: "Usuários", icon: "plat-icon-users" },
    {
      id: "graficos",
      href: "admin/Home-ADM.html#plat-charts-section",
      label: "Gráficos",
      icon: "plat-icon-chart",
    },
    { id: "relatorios", href: "admin/relatorio-adm.html", label: "Relatórios", icon: "adm-icon-reports" },
    { id: "configuracao", href: "admin/configuracoes-adm.html", label: "Configuração", icon: "adm-icon-settings" },
  ];

  var SIDE_ICON_PATHS = {
    "adm-icon-menu":
      '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
    "adm-icon-home":
      '<path d="M4 10.5 12 4l8 6.5V20a1.75 1.75 0 0 1-1.75 1.75H5.75A1.75 1.75 0 0 1 4 20v-9.5Z"/>' +
      '<path d="M10 21.75V14h4v7.75"/>',
    "plat-icon-map":
      '<path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Z"/>' +
      '<circle cx="12" cy="9" r="2.5"/>',
    "plat-icon-calendar":
      '<path d="M8 3v2M16 3v2M4 9h16"/>' +
      '<rect x="6" y="5" width="12" height="14" rx="2"/>',
    "plat-icon-users":
      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>' +
      '<circle cx="9" cy="7" r="4"/>' +
      '<path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    "plat-icon-chart":
      '<path d="M4 20V10M10 20V4M16 20v-6M22 20V8"/>',
    "adm-icon-reports":
      '<path d="M14.25 2.25H8.25a1.75 1.75 0 0 0-1.75 1.75v15.5a1.75 1.75 0 0 0 1.75 1.75h7.5a1.75 1.75 0 0 0 1.75-1.75V7.75l-4.5-4.5Z"/>' +
      '<path d="M14.25 2.25v5.5h5.5"/>' +
      '<path d="M8.25 13.25h7.5M8.25 16.75h5.25"/>',
    "adm-icon-settings":
      '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>' +
      '<circle cx="12" cy="12" r="3"/>',
  };

  var STORAGE_KEY = "platAdmSidebarExpanded";

  function iconSvg(iconId) {
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
    var hash = (location.hash || "").toLowerCase();

    if (path.indexOf("agendamento-adm") >= 0) return "agendamentos";
    if (path.indexOf("usuarios-adm") >= 0) return "usuarios";
    if (path.indexOf("relatorio-adm") >= 0) return "relatorios";
    if (path.indexOf("ecoponto-adm") >= 0 || path.indexOf("mapa-publico-adm") >= 0) {
      return "ecopontos";
    }
    if (path.indexOf("home-adm") >= 0) {
      return hash === "#plat-charts-section" ? "graficos" : "inicial";
    }
    if (path.indexOf("configuracoes-adm") >= 0) return "configuracao";
    return "";
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
    try {
      sessionStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
    } catch (e) {

    }
  }

  function setupToggle(sidebar, toggle) {
    if (!toggle) return;

    var expanded = true;
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "0") {
        expanded = false;
      }
    } catch (e) {
      expanded = true;
    }

    setExpanded(sidebar, toggle, expanded);

    toggle.addEventListener("click", function (e) {
      e.preventDefault();
      setExpanded(sidebar, toggle, !sidebar.classList.contains("is-expanded"));
    });
  }

  function renderSidebar() {
    var mount = document.getElementById("platSidebar");
    if (!mount) return;

    var active = detectActiveId();
    var html =
      '<nav class="adm-eco-side-nav" aria-label="Navegação da plataforma">' +
      '<div class="adm-eco-side-nav__toggle-row">' +
      '<button type="button" class="adm-eco-side-nav__toggle" id="sidebarToggle" aria-label="Expandir menu lateral" aria-expanded="true" aria-controls="platSideNavItems">' +
      iconSvg("adm-icon-menu") +
      "</button>" +
      '<span class="adm-eco-side-nav__toggle-spacer" aria-hidden="true"></span>' +
      "</div>" +
      '<div class="adm-eco-side-nav__items" id="platSideNavItems">';

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
      '<span class="adm-eco-side-nav__badge">Painel Plataforma</span>' +
      "</div></nav>";

    mount.className = "plat-sidebar plat-sidebar--premium is-expanded";
    mount.setAttribute("aria-label", "Menu principal");
    mount.innerHTML = html;

    setupToggle(mount, document.getElementById("sidebarToggle"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderSidebar);
  } else {
    renderSidebar();
  }
})();
