(function () {
  "use strict";

  var ecopontosAll = [];
  var ecopontosFiltered = [];
  var selectedId = null;
  var map;
  var markersLayer;

  function escHtml(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function apiUrl() {
    var url = window.ecocoletaPhpUrl
      ? window.ecocoletaPhpUrl("listar-ecopontos.php")
      : "api/listar-ecopontos.php";
    return url;
  }

  function loadEcopontos() {
    return fetch(apiUrl(), { credentials: "same-origin", cache: "no-store" })
      .then(function (r) {
        return r.text();
      })
      .then(function (text) {
        var raw = String(text).replace(/^\uFEFF/, "").trim();
        var data = JSON.parse(raw.indexOf("{") >= 0 ? raw.slice(raw.indexOf("{")) : raw);
        if (!data || data.sucesso !== true) {
          throw new Error((data && data.erro) || "Não foi possível carregar os ecopontos.");
        }
        return data;
      });
  }

  function pinIcon(status) {
    var maint = status === "manutencao";
    return L.divIcon({
      className: "eco-marker" + (maint ? " eco-marker--maintenance" : ""),
      html:
        '<span class="eco-marker__symbol" aria-hidden="true"><span class="eco-marker__glyph">♻</span></span>',
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -34],
    });
  }

  function badgeHtml(status) {
    if (status === "manutencao") {
      return '<span class="plat-mp-badge plat-mp-badge--manutencao">Manutenção</span>';
    }
    return '<span class="plat-mp-badge plat-mp-badge--ativo">Disponível</span>';
  }

  function countCidades(list) {
    var cities = {};
    list.forEach(function (p) {
      var c = String(p.city || "").trim();
      if (c) cities[c] = true;
    });
    return Object.keys(cities).length;
  }

  function updateKpis(list, resumo) {
    var vis = document.getElementById("kpiVisiveis");
    var at = document.getElementById("kpiAtivos");
    var man = document.getElementById("kpiManutencao");
    var cid = document.getElementById("kpiCidades");

    var ativos = 0;
    var manut = 0;
    list.forEach(function (p) {
      if (p.status === "manutencao") manut++;
      else ativos++;
    });

    if (at) at.textContent = String(resumo?.ativos ?? ativos);
    if (man) man.textContent = String(resumo?.manutencao ?? manut);
    if (cid) cid.textContent = String(countCidades(list));
  }

  function populateCidadeFilter(list) {
    var select = document.getElementById("mpFilterCidade");
    if (!select) return;

    var cities = {};
    list.forEach(function (p) {
      var c = String(p.city || "").trim();
      if (c) cities[c] = true;
    });

    var sorted = Object.keys(cities).sort(function (a, b) {
      return a.localeCompare(b, "pt-BR");
    });

    var current = select.value;
    select.innerHTML = '<option value="">Todas</option>';
    sorted.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
    if (current && cities[current]) select.value = current;
  }

  function applyFilters() {
    var q = String(document.getElementById("mpSearch")?.value || "")
      .trim()
      .toLowerCase();
    var status = String(document.getElementById("mpFilterStatus")?.value || "");
    var cidade = String(document.getElementById("mpFilterCidade")?.value || "");

    ecopontosFiltered = ecopontosAll.filter(function (p) {
      if (status === "ativo" && p.status === "manutencao") return false;
      if (status === "manutencao" && p.status !== "manutencao") return false;
      if (cidade && String(p.city || "") !== cidade) return false;
      if (q) {
        var hay = (
          String(p.name || "") +
          " " +
          String(p.bairro || "") +
          " " +
          String(p.city || "") +
          " " +
          String(p.address || "")
        ).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (
      selectedId &&
      !ecopontosFiltered.some(function (p) {
        return p.id === selectedId;
      })
    ) {
      selectedId = null;
    }

    renderList();
    renderMap(selectedId);

    var countEl = document.getElementById("mpListCount");
    if (countEl) {
      countEl.textContent =
        ecopontosFiltered.length +
        (ecopontosFiltered.length === 1 ? " ponto" : " pontos");
    }

    var vis = document.getElementById("kpiVisiveis");
    if (vis) vis.textContent = String(ecopontosFiltered.length);
  }

  function selectPoint(id) {
    selectedId = id;
    renderList();
    renderMap(id);
    var btn = document.querySelector('.plat-mp-list-item[data-id="' + id + '"]');
    if (btn) btn.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function renderList() {
    var list = document.getElementById("mpList");
    var empty = document.getElementById("mpListEmpty");
    if (!list) return;

    if (!ecopontosFiltered.length) {
      list.innerHTML = "";
      if (empty) empty.classList.remove("hidden");
      return;
    }

    if (empty) empty.classList.add("hidden");

    list.innerHTML = ecopontosFiltered
      .map(function (p) {
        return (
          '<li role="listitem">' +
          '<button type="button" class="plat-mp-list-item' +
          (p.id === selectedId ? " is-selected" : "") +
          '" data-id="' +
          escHtml(p.id) +
          '">' +
          '<span class="plat-mp-list-item__name">' +
          escHtml(p.name) +
          "</span>" +
          '<span class="plat-mp-list-item__meta">' +
          "<span>" +
          escHtml(p.bairro || p.city || "—") +
          "</span>" +
          badgeHtml(p.status) +
          "</span></button></li>"
        );
      })
      .join("");

    list.querySelectorAll(".plat-mp-list-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectPoint(btn.getAttribute("data-id"));
      });
    });
  }

  function fitAllBounds() {
    if (!map || !markersLayer) return;
    var bounds = [];
    ecopontosFiltered.forEach(function (p) {
      if (typeof p.lat === "number" && typeof p.lng === "number") {
        bounds.push([p.lat, p.lng]);
      }
    });
    if (bounds.length) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [48, 48], maxZoom: 11 });
    }
    window.requestAnimationFrame(function () {
      map.invalidateSize({ pan: false });
    });
  }

  function renderMap(highlightId) {
    if (!map || !markersLayer) return;
    markersLayer.clearLayers();

    ecopontosFiltered.forEach(function (p) {
      if (typeof p.lat !== "number" || typeof p.lng !== "number") return;
      var highlighted = highlightId && p.id === highlightId;
      L.marker([p.lat, p.lng], {
        icon: pinIcon(p.status),
        zIndexOffset: highlighted ? 600 : 0,
      })
        .addTo(markersLayer)
        .bindPopup(
          "<strong>" +
            escHtml(p.name) +
            "</strong><br>" +
            escHtml(p.address || p.bairro) +
            "<br>" +
            badgeHtml(p.status)
        )
        .on("click", function () {
          selectPoint(p.id);
        });
    });

    if (highlightId) {
      var hp = ecopontosFiltered.find(function (x) {
        return x.id === highlightId;
      });
      if (hp) {
        map.setView([hp.lat, hp.lng], 14, { animate: true });
        return;
      }
    }
    fitAllBounds();
  }

  function initMap() {
    var el = document.getElementById("mapaPublicoAdm");
    if (!el || typeof L === "undefined") return;

    map = L.map(el, { zoomControl: true, scrollWheelZoom: true }).setView(
      [-7.22, -39.35],
      9
    );
    L.tileLayer("https:
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);

    window.addEventListener("resize", function () {
      if (map) map.invalidateSize({ pan: false });
    });
  }

  function setupFilters() {
    ["mpSearch", "mpFilterStatus", "mpFilterCidade"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(id === "mpSearch" ? "input" : "change", applyFilters);
    });

    var btnCenter = document.getElementById("btnCentralizar");
    if (btnCenter) {
      btnCenter.addEventListener("click", function () {
        selectedId = null;
        applyFilters();
        fitAllBounds();
      });
    }
  }

  function init() {
    if (!window.PlatAdmShell || typeof window.PlatAdmShell.init !== "function") {
      document.documentElement.classList.remove("plat-auth-checking");
      return;
    }

    window.PlatAdmShell.init()
      .then(function () {
        return loadEcopontos();
      })
      .then(function (data) {
        ecopontosAll = data.ecopontos || [];
        populateCidadeFilter(ecopontosAll);
        setupFilters();
        initMap();
        ecopontosFiltered = ecopontosAll.slice();
        updateKpis(ecopontosAll, data.resumo);
        applyFilters();
      })
      .catch(function (err) {
        console.error(err);
        var list = document.getElementById("mpList");
        if (list) {
          list.innerHTML = "";
        }
        var empty = document.getElementById("mpListEmpty");
        if (empty) {
          empty.textContent = "Não foi possível carregar o mapa.";
          empty.classList.remove("hidden");
        }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
