
(function (global) {
  "use strict";

  var ACEITOS_CATALOGO = [
    { slug: "plastico", label: "Plástico", img: "assets/images/garrafa.png" },
    { slug: "papel", label: "Papel", img: "assets/images/papel.png" },
    { slug: "vidro", label: "Vidro", img: "assets/images/vidro.png" },
    { slug: "metal", label: "Metal", img: "assets/images/lata.png" },
    { slug: "madeira", label: "Madeira", img: "assets/images/madeira.png" },
    { slug: "eletronico", label: "Eletrônicos", img: "assets/images/eletronicos.png" },
    { slug: "eletronicos", label: "Eletrônicos", img: "assets/images/eletronicos.png" },
    { slug: "organico", label: "Orgânico", img: "assets/images/garrafa.png" },
  ];

  var NAO_ACEITOS_FIXOS = [
    { slug: "perigoso", label: "Resíduos<br>Perigosos", icon: "☠" },
    { slug: "pilhas", label: "Pilhas e<br>Baterias", icon: "🚫" },
    { slug: "organico", label: "Lixo<br>Orgânico", icon: "🚯" },
  ];

  function escHtml(v) {
    return String(v || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizarSlug(t) {
    return String(t || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function resolverBase() {
    var base = document.querySelector("base[data-app-base]");
    if (base && base.href) {
      try {
        return new URL("./", base.href).href;
      } catch (e) {
        return base.href;
      }
    }
    return global.location.href.replace(/[^/]*$/, "");
  }

  function assetUrl(path) {
    try {
      return new URL(path.replace(/^\//, ""), resolverBase()).href;
    } catch (e) {
      return path;
    }
  }

  function normalizarAceitos(lista) {
    if (!Array.isArray(lista)) return [];
    var out = [];
    lista.forEach(function (item) {
      var s = normalizarSlug(item);
      if (s && out.indexOf(s) === -1) out.push(s);
      if (s === "eletronicos" && out.indexOf("eletronico") === -1) out.push("eletronico");
      if (s === "eletronico" && out.indexOf("eletronicos") === -1) out.push("eletronicos");
    });
    if (out.length === 0) {
      return ["plastico", "papel", "vidro", "metal", "madeira", "eletronico"];
    }
    return out;
  }

  function formatarEndereco(ecoponto) {
    var endereco = String(ecoponto.endereco || "").trim();
    var cidade = String(ecoponto.cidade || "").trim();
    if (endereco && cidade && endereco.toLowerCase().indexOf(cidade.toLowerCase()) === -1) {
      return endereco + ", " + cidade;
    }
    return endereco || cidade || "—";
  }

  function htmlMateriaisAceitos(materiaisAceitos) {
    var aceitos = normalizarAceitos(materiaisAceitos);
    var vistos = {};
    var itens = "";

    ACEITOS_CATALOGO.forEach(function (mat) {
      if (vistos[mat.slug]) return;
      if (aceitos.indexOf(mat.slug) === -1 && mat.slug !== "eletronicos") return;
      vistos[mat.slug] = true;
      itens +=
        "<div>" +
        '<img src="' +
        escHtml(assetUrl(mat.img)) +
        '" alt="' +
        escHtml(mat.label) +
        '" width="48" height="48" loading="lazy" decoding="async">' +
        "<span>" +
        escHtml(mat.label) +
        "</span></div>";
    });

    return itens || '<p class="adm-eco-materiais-empty">Nenhum material cadastrado.</p>';
  }

  function htmlMateriaisNaoAceitos(materiaisAceitos) {
    var aceitos = normalizarAceitos(materiaisAceitos);
    var itens = "";

    NAO_ACEITOS_FIXOS.forEach(function (item) {
      if (item.slug === "organico" && aceitos.indexOf("organico") !== -1) return;
      if (item.slug === "pilhas" && (aceitos.indexOf("pilhas") !== -1 || aceitos.indexOf("baterias") !== -1)) {
        return;
      }
      itens +=
        "<div>" +
        '<span class="nao-aceito-icon" aria-hidden="true">' +
        item.icon +
        "</span><span>" +
        item.label +
        "</span></div>";
    });

    return itens;
  }

  function htmlHorario(ecoponto) {
    var horarios = String(ecoponto.horarios || "").trim();
    if (horarios && horarios.indexOf("-") !== -1) {
      var partes = horarios.split("-");
      var abre = (partes[0] || "08:00").trim();
      var fecha = (partes[1] || "18:00").trim();
      return (
        '<div class="horario-linha"><span>Seg - Sex:</span><strong>' +
        escHtml(abre) +
        " - " +
        escHtml(fecha) +
        "</strong></div>" +
        '<div class="horario-linha"><span>Sáb:</span><strong>' +
        escHtml(abre) +
        " - 14:00</strong></div>"
      );
    }
    return (
      '<div class="horario-linha"><span>Seg - Sex:</span><strong>08:00 - 18:00</strong></div>' +
      '<div class="horario-linha"><span>Sáb:</span><strong>08:00 - 14:00</strong></div>'
    );
  }

  function htmlCardEcoponto(ecoponto) {
    var nome = escHtml(ecoponto.nome || ecoponto.nome_ponto || "EcoPonto");
    var endereco = escHtml(formatarEndereco(ecoponto));
    var materiais = ecoponto.materiais_aceitos || [];

    return (
      '<div class="card-ecoponto card-ecoponto-dinamico adm-ecoponto-card-public">' +
      "<h2>" +
      nome +
      "</h2>" +
      '<p class="endereco"><span class="endereco-pin" aria-hidden="true">📍</span> ' +
      endereco +
      "</p>" +
      '<div class="horario">' +
      "<h3>Horário de Funcionamento</h3>" +
      htmlHorario(ecoponto) +
      "</div>" +
      '<div class="materiais">' +
      "<h3>Materiais Aceitos</h3>" +
      '<div class="icons">' +
      htmlMateriaisAceitos(materiais) +
      "</div></div>" +
      '<div class="nao-aceitos">' +
      "<h3>Não aceitos</h3>" +
      '<div class="icons icons-nao-aceitos">' +
      htmlMateriaisNaoAceitos(materiais) +
      "</div></div></div>"
    );
  }

  function htmlPainelMateriais(materiaisAceitos) {
    return (
      '<section class="adm-eco-materiais-panel" aria-label="Materiais do ecoponto">' +
      '<div class="adm-eco-materiais-block">' +
      "<h3>Materiais Aceitos</h3>" +
      '<div class="adm-eco-materiais-grid adm-eco-materiais-grid--ok">' +
      htmlMateriaisAceitos(materiaisAceitos)
        .replace(/<div>/g, '<div class="adm-eco-mat-item adm-eco-mat-item--ok">')
        .replace(/width="48"/g, 'width="40"') +
      "</div></div>" +
      '<div class="adm-eco-materiais-block adm-eco-materiais-block--no">' +
      "<h3>Não aceitos</h3>" +
      '<div class="adm-eco-materiais-grid adm-eco-materiais-grid--no">' +
      htmlMateriaisNaoAceitos(materiaisAceitos)
        .replace(/<div>/g, '<div class="adm-eco-mat-item adm-eco-mat-item--no">')
        .replace(/class="nao-aceito-icon"/g, 'class="adm-eco-mat-item__icon"') +
      "</div></div></section>"
    );
  }

  function montarCardEcoponto(container, ecoponto) {
    if (!container) return;
    container.innerHTML = htmlCardEcoponto(ecoponto || {});
    container.classList.remove("adm-ecoponto-card-wrap--loading");
  }

  function montarPainel(container, materiaisAceitos) {
    if (!container) return;
    container.innerHTML = htmlPainelMateriais(materiaisAceitos);
    container.classList.remove("adm-eco-materiais-panel--loading");
  }

  function extrairEcopontoDashboard(data) {
    if (!data) return {};
    var dash = data.dashboard || data;
    var eco = dash.ecoponto || {};
    var admin = data.admin || {};
    return {
      nome: eco.nome || admin.ecoponto || "EcoPonto",
      nome_ponto: eco.nome || admin.ecoponto || "EcoPonto",
      endereco: eco.endereco || admin.endereco || "",
      cidade: eco.cidade || admin.cidade || "",
      horarios: eco.horarios || admin.horarios || "",
      materiais_aceitos: dash.materiais_aceitos || eco.materiais_aceitos || [],
    };
  }

  function extrairMateriaisDashboard(data) {
    return extrairEcopontoDashboard(data).materiais_aceitos || [];
  }

  async function carregarCardEcoponto(container) {
    if (!container || container.dataset.ecopontoCardLoaded === "1") return;
    container.classList.add("adm-ecoponto-card-wrap--loading");
    var url = global.ecocoletaPhpUrl
      ? global.ecocoletaPhpUrl("adm-dashboard.php")
      : "api/adm-dashboard.php";
    var fetchJson = global.EcoAdm && global.EcoAdm.fetchJson;
    try {
      var data = fetchJson
        ? await fetchJson(url)
        : await fetch(url, { credentials: "same-origin", cache: "no-store" }).then(function (r) {
            return r.json();
          });
      if (container.dataset.ecopontoCardLoaded === "1") return;
      container.dataset.ecopontoCardLoaded = "1";
      montarCardEcoponto(container, extrairEcopontoDashboard(data));
    } catch (e) {
      if (container.dataset.ecopontoCardLoaded === "1") return;
      container.dataset.ecopontoCardLoaded = "1";
      montarCardEcoponto(container, {});
    }
  }

  async function carregarPainelMateriais(container) {
    if (!container || container.dataset.materiaisLoaded === "1") return;
    container.classList.add("adm-eco-materiais-panel--loading");
    var url = global.ecocoletaPhpUrl
      ? global.ecocoletaPhpUrl("adm-dashboard.php")
      : "api/adm-dashboard.php";
    var fetchJson = global.EcoAdm && global.EcoAdm.fetchJson;
    try {
      var data = fetchJson
        ? await fetchJson(url)
        : await fetch(url, { credentials: "same-origin", cache: "no-store" }).then(function (r) {
            return r.json();
          });
      container.dataset.materiaisLoaded = "1";
      montarPainel(container, extrairMateriaisDashboard(data));
    } catch (e) {
      container.dataset.materiaisLoaded = "1";
      montarPainel(container, []);
    }
  }

  function isHomeEcopontoPage() {
    return (
      document.body.classList.contains("admin-dashboard-page") &&
      !document.body.classList.contains("adm-coletas-page") &&
      !document.body.classList.contains("adm-materias-page") &&
      !document.body.classList.contains("adm-relatorio-page") &&
      !document.body.classList.contains("adm-config-page")
    );
  }

  function initCardsEcoponto() {
    document.querySelectorAll("[data-adm-ecoponto-card]").forEach(function (el) {
      carregarCardEcoponto(el);
    });
    if (!isHomeEcopontoPage()) return;
    document.querySelectorAll("[data-adm-ecoponto-materiais]").forEach(function (el) {
      carregarPainelMateriais(el);
    });
  }

  global.EcoAdmMateriais = {
    htmlCardEcoponto: htmlCardEcoponto,
    htmlPainelMateriais: htmlPainelMateriais,
    montarCardEcoponto: montarCardEcoponto,
    montarPainel: montarPainel,
    extrairEcopontoDashboard: extrairEcopontoDashboard,
    carregarCardEcoponto: carregarCardEcoponto,
    carregarPainelMateriais: carregarPainelMateriais,
    initCardsEcoponto: initCardsEcoponto,
    initPaineisMateriais: initCardsEcoponto,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCardsEcoponto);
  } else {
    initCardsEcoponto();
  }
})(window);
