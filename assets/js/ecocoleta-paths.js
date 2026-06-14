

(function (global) {
  "use strict";

  var path = global.location.pathname.replace(/\\/g, "/");
  var folderMatch = path.match(/^(.*\/)(?:auth|admin|pages|mapa)\/[^/]+$/);
  var projectRoot = folderMatch ? folderMatch[1] : path.replace(/\/[^/]*$/, "/") || "/";
  if (projectRoot.charAt(projectRoot.length - 1) !== "/") {
    projectRoot += "/";
  }

  var baseEl = document.querySelector("base[data-app-base]");
  if (baseEl) {
    baseEl.href = projectRoot;
  }

  var AUTH_PHP =
    /^(login|cadastro|recuperar|resetar_senha|verificar_cadastro|verificar_codigo_recuperacao|vc)\.php$/i;
  var ADMIN_PHP = /^(Login-ADM(?:-Ecoponto)?|login-adm-pontos|admin-(?:plataforma|ecoponto)-session)\.php$/i;

  function resolvePhpPath(arquivoPhp) {
    var name = String(arquivoPhp || "").replace(/^\//, "");
    if (/^(auth|admin|api)\//i.test(name)) {
      return name;
    }
    if (name.indexOf("/") >= 0) {
      return name;
    }
    if (AUTH_PHP.test(name)) {
      return "auth/" + name;
    }
    if (ADMIN_PHP.test(name)) {
      return "admin/" + name;
    }
    return "api/" + name;
  }

  function absUrl(relativePath) {
    var rel = String(relativePath || "").replace(/^\//, "");
    return new URL(rel, global.location.origin + projectRoot).href;
  }

  global.ecocoletaProjectRoot = projectRoot;

  global.ecocoletaAppBaseUrl = function () {
    return global.location.origin + projectRoot;
  };

  var PAGE_ALIASES = {
    "relatorio.html": "pagina-relatorio.html",
    "relatorio-mensal": "relatorio-mensal.html",
    "index.html": "tela-inicia.html",
  };

  var PUBLIC_PAGES = {
    "tela-inicia.html": 1,
    "pagina-relatorio.html": 1,
    "como-funciona.html": 1,
    "ecopontos.html": 1,
    "premios-disponiveis.html": 1,
    "educacao-ambiental.html": 1,
    "quem-somos.html": 1,
    "Ranking.html": 1,
    "perfil.html": 1,
    "agendar-coleta.html": 1,
    "formulario-coleta.html": 1,
    "balanca-ecoponto.html": 1,
    "edicaoperfil.html": 1,
    "relatorio-mensal.html": 1,
    "mapa.html": 1,
    "notif-popup.html": 1,
    "apoiador.html": 1,
  };

  function normalizePageName(pageFile) {
    var name = String(pageFile || "").replace(/^\//, "").replace(/^pages\//i, "");
    var base = name.split("?")[0].split("#")[0];
    return PAGE_ALIASES[base] || name;
  }

  global.ecocoletaPageUrl = function (pageFile) {
    var canonical = normalizePageName(pageFile).replace(/^pages\//i, "");
    return absUrl(canonical);
  };

  global.ecocoletaPhpUrl = function (arquivoPhp) {
    if (global.location.protocol === "file:") {
      return null;
    }
    return absUrl(resolvePhpPath(arquivoPhp));
  };

  global.ecocoletaAssetUrl = function (relativePath) {
    var clean = String(relativePath || "").replace(/^\//, "");
    if (/^Imagens\//i.test(clean)) {
      clean = clean.replace(/^Imagens\//i, "assets/images/");
    }
    return absUrl(clean);
  };

  global.ecocoletaLoadScrollbarStyles = function () {
    var html = document.documentElement;
    var pathNow = global.location.pathname.replace(/\\/g, "/");
    if (html.classList.contains("auth-view")) return;
    if (/\/auth\//i.test(pathNow)) return;
    if (document.body && document.body.classList.contains("auth")) return;
    if (document.getElementById("eco-scrollbar-styles")) return;
    var link = document.createElement("link");
    link.id = "eco-scrollbar-styles";
    link.rel = "stylesheet";
    link.href = absUrl("assets/css/scrollbar-ecocoleta.css?v=2");
    document.head.appendChild(link);
  };

  global.ecocoletaLoadScrollbarStyles();

  function fixLegacyPageLinks() {
    document.querySelectorAll("a[href]").forEach(function (anchor) {
      var href = anchor.getAttribute("href") || "";
      if (
        !href ||
        /^(https?:)?\/\//i.test(href) ||
        /^(mailto:|tel:|#|javascript:)/i.test(href) ||
        /^(auth|admin|api|assets|ecocheck|mapa)\//i.test(href)
      ) {
        return;
      }
      var hashIdx = href.indexOf("#");
      var queryIdx = href.indexOf("?");
      var cut = href.length;
      if (hashIdx >= 0) cut = Math.min(cut, hashIdx);
      if (queryIdx >= 0) cut = Math.min(cut, queryIdx);
      var pathPart = href.slice(0, cut);
      var suffix = href.slice(cut);
      var file = pathPart.split("/").pop();
      if (!file || !/\.html$/i.test(file)) {
        if (/^pages\//i.test(pathPart)) {
          var page = pathPart.replace(/^pages\//i, "");
          anchor.setAttribute("href", global.ecocoletaPageUrl(page) + suffix);
        }
        return;
      }
      var canonical = normalizePageName(file).split("?")[0].split("#")[0];
      if (PUBLIC_PAGES[canonical] || PAGE_ALIASES[file]) {
        anchor.setAttribute("href", global.ecocoletaPageUrl(canonical) + suffix);
        return;
      }
      var AUTH_PAGES = {
        "login.html": 1,
        "cadastro.html": 1,
        "recuperar.html": 1,
        "nova-senha.html": 1,
        "verificacao.html": 1,
        "verificar-cadastro.html": 1,
        "resetar.html": 1,
        "senha-criada.html": 1,
        "login-temp.html": 1,
      };
      if (AUTH_PAGES[canonical]) {
        anchor.setAttribute("href", absUrl("auth/" + canonical) + suffix);
        return;
      }
      if (/\.html$/i.test(file) && /^(Login-ADM|Home-ADM|Coletas-ADM|materias-ADM|relatorio-ADM|configuracoes|ecoponto-adm|agendamento-adm|usuarios-adm|relatorio-adm|mapa-publico-adm|edicao-perfil-admin)/i.test(file)) {
        anchor.setAttribute("href", absUrl("admin/" + file) + suffix);
      }
    });
  }

  function applyHdLogoAssets() {
    var version = "v=6";
    var logoSvg = absUrl("assets/images/logo-ecocoleta.svg?" + version);
    var logo1x = absUrl("assets/images/logo.2.png?" + version);
    var logo2x = absUrl("assets/images/logo.2@2x.png?" + version);
    var logoHeader = absUrl("assets/images/logo.2.bak.png?" + version);
    var selector =
      "img.eco-brand-img, img.auth-logo-img, .auth-brand img, .footer-logo-link img, .login-brand img, .eco-premium-brand img, .logo-link img, .adm-header-brand img, .plat-header-brand img";
    document.querySelectorAll(selector).forEach(function (img) {
      var src = String(img.getAttribute("src") || "");
      if (
        src.indexOf("logo.2") === -1 &&
        src.indexOf("logo-ecocoleta") === -1 &&
        src.indexOf("telas.png") === -1
      ) {
        return;
      }

      if (img.closest("header.topo")) {
        img.src = logoHeader;
        img.removeAttribute("srcset");
        img.sizes = "(max-width: 900px) 160px, 192px";
        img.setAttribute("width", "192");
        img.setAttribute("height", "84");
        img.setAttribute("decoding", "async");
        return;
      }

      img.src = logoSvg;
      img.srcset = logo1x + " 1x, " + logo2x + " 2x";
      if (img.classList.contains("auth-logo-img") || img.closest(".auth-brand") || img.closest(".auth")) {
        img.sizes = "(max-width: 520px) 220px, 256px";
        img.setAttribute("width", "256");
        img.setAttribute("height", "112");
      } else if (
        img.closest("header.topo") ||
        img.closest(".topo") ||
        img.closest("header.adm-header") ||
        img.closest("header.plat-header") ||
        img.closest(".adm-header-brand") ||
        img.closest(".plat-header-brand")
      ) {
        img.sizes = "(max-width: 900px) 160px, 192px";
        img.setAttribute("width", "192");
        img.setAttribute("height", "84");
      } else if (img.closest("#ecocoleta-site-footer") || img.closest(".footer-logo-link")) {
        img.sizes = "184px";
        img.setAttribute("width", "184");
        img.setAttribute("height", "80");
      }
      img.setAttribute("decoding", "async");
    });
  }

  function onDomReady() {
    fixLegacyPageLinks();
    applyHdLogoAssets();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onDomReady);
  } else {
    onDomReady();
  }

  global.ecocoletaApplyHdLogo = applyHdLogoAssets;

  (function installFetchCache() {
    if (global.EcoColetaFetch) return;
    var memory = Object.create(null);
    var inflight = Object.create(null);

    function now() {
      return Date.now();
    }

    function parseJsonSafe(text) {
      return JSON.parse(String(text || "").replace(/^\uFEFF/, "").trim());
    }

    function fetchJson(url, options) {
      var opts = options || {};
      var key = opts.cacheKey || url;
      var ttl = typeof opts.ttlMs === "number" ? opts.ttlMs : 60000;
      var force = !!opts.force;
      var hit = memory[key];

      if (!force && hit && now() - hit.t < ttl) {
        return Promise.resolve(hit.data);
      }
      if (!force && inflight[key]) {
        return inflight[key];
      }

      var fetchOpts = {
        method: opts.method || "GET",
        credentials: opts.credentials || "same-origin",
        cache: opts.cache || "default",
        signal: opts.signal,
        headers: opts.headers,
        body: opts.body,
      };

      var promise = fetch(url, fetchOpts)
        .then(function (res) {
          return res.text().then(function (text) {
            if (!res.ok) {
              var err = new Error("HTTP " + res.status);
              err.status = res.status;
              err.body = text;
              throw err;
            }
            var data = parseJsonSafe(text);
            if ((opts.method || "GET").toUpperCase() === "GET" && ttl > 0) {
              memory[key] = { t: now(), data: data };
            }
            return data;
          });
        })
        .finally(function () {
          delete inflight[key];
        });

      inflight[key] = promise;
      return promise;
    }

    global.EcoColetaFetch = {
      fetchJson: fetchJson,
      invalidate: function (key) {
        if (!key) {
          memory = Object.create(null);
          return;
        }
        delete memory[key];
      },
      getCached: function (key) {
        var hit = memory[key];
        return hit ? hit.data : null;
      },
    };
  })();
})(window);
