(function () {
  "use strict";

  var PAGE_SIZE = 8;
  var ecopontos = [];
  var map;
  var markersLayer;
  var selectedId = null;
  var currentPage = 1;
  var mapReady = false;

  function escHtml(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function phpUrl(file) {
    return window.ecocoletaPhpUrl
      ? window.ecocoletaPhpUrl(file)
      : "api/" + file;
  }

  function parseJsonResponse(text) {
    var raw = String(text).replace(/^\uFEFF/, "").trim();
    return JSON.parse(raw.indexOf("{") >= 0 ? raw.slice(raw.indexOf("{")) : raw);
  }

  function loadEcopontos(syncCatalog) {
    var url = phpUrl("listar-ecopontos.php");
    if (syncCatalog) {
      url += (url.indexOf("?") >= 0 ? "&" : "?") + "sync=1";
    }
    return fetch(url, { credentials: "same-origin", cache: "no-store" })
      .then(function (r) {
        return r.text();
      })
      .then(function (text) {
        var data = parseJsonResponse(text);
        if (!data || data.sucesso !== true) {
          throw new Error((data && data.erro) || "Não foi possível carregar os ecopontos.");
        }
        return data;
      });
  }

  function refreshEcopontos(syncCatalog) {
    return loadEcopontos(syncCatalog).then(function (data) {
      ecopontos = data.ecopontos || [];
      updateKpis(
        data.resumo || {
          total: ecopontos.length,
          ativos: 0,
          manutencao: 0,
        }
      );
      if (mapReady) {
        renderMap(selectedId);
      }
      renderTable();
      window.EcoColetaEcopontos = ecopontos.map(function (p) {
        return {
          id: p.id,
          id_pev: p.id_pev,
          name: p.name,
          address: p.address,
          city: p.city,
          lat: p.lat,
          lng: p.lng,
        };
      });
      return data;
    });
  }

  function badgeStatus(status) {
    if (status === "manutencao") {
      return '<span class="plat-badge plat-badge--manutencao">Em manutenção</span>';
    }
    return '<span class="plat-badge plat-badge--ativo">Ativo</span>';
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

  function hasValidCoords(p) {
    return (
      typeof p.lat === "number" &&
      !Number.isNaN(p.lat) &&
      typeof p.lng === "number" &&
      !Number.isNaN(p.lng)
    );
  }

  function updateKpis(resumo) {
    var total = document.getElementById("kpiTotal");
    var ativos = document.getElementById("kpiAtivos");
    var manut = document.getElementById("kpiManutencao");
    var legA = document.getElementById("legendAtivos");
    var legM = document.getElementById("legendManutencao");
    if (total) total.textContent = resumo.total;
    if (ativos) ativos.textContent = resumo.ativos;
    if (manut) manut.textContent = resumo.manutencao;
    if (legA) legA.textContent = resumo.ativos;
    if (legM) legM.textContent = resumo.manutencao;
  }

  function renderMap(highlightId) {
    if (!map || !markersLayer) return;
    markersLayer.clearLayers();
    var bounds = [];

    ecopontos.forEach(function (p) {
      if (!hasValidCoords(p)) {
        console.warn(
          "[EcoColeta] Ecoponto sem coordenadas — marcador omitido:",
          p.name || p.id,
          "(id_pev:",
          p.id_pev,
          ")"
        );
        return;
      }

      var highlighted = highlightId && p.id === highlightId;
      L.marker([p.lat, p.lng], {
        icon: pinIcon(p.status),
        zIndexOffset: highlighted ? 500 : 0,
      })
        .addTo(markersLayer)
        .bindPopup(
          "<strong>" +
            escHtml(p.name) +
            "</strong><br>" +
            escHtml(p.bairro) +
            " · " +
            escHtml(p.capacidade) +
            "%<br>" +
            badgeStatus(p.status)
        )
        .on("click", function () {
          selectRow(p.id, false);
        });
      bounds.push([p.lat, p.lng]);
    });

    if (highlightId && bounds.length) {
      var hp = ecopontos.find(function (x) {
        return x.id === highlightId && hasValidCoords(x);
      });
      if (hp) {
        map.setView([hp.lat, hp.lng], 14, { animate: true });
      }
    }

    if (bounds.length) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 11 });
    } else {
      map.setView([-7.22, -39.35], 9);
      console.warn("[EcoColeta] Nenhum ecoponto com coordenadas para exibir no mapa.");
    }

    window.requestAnimationFrame(function () {
      map.invalidateSize({ pan: false });
    });
  }

  function selectRow(id, scrollTable) {
    selectedId = id;
    document.querySelectorAll("#ecopontosTableBody tr").forEach(function (tr) {
      tr.classList.toggle("is-selected", tr.getAttribute("data-id") === id);
    });
    renderMap(id);
    if (scrollTable) {
      var row = document.querySelector('#ecopontosTableBody tr[data-id="' + id + '"]');
      if (row) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function findById(id) {
    return ecopontos.find(function (p) {
      return p.id === id;
    });
  }

  function renderTable() {
    var body = document.getElementById("ecopontosTableBody");
    if (!body) return;
    var totalPages = Math.max(1, Math.ceil(ecopontos.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    var start = (currentPage - 1) * PAGE_SIZE;
    var slice = ecopontos.slice(start, start + PAGE_SIZE);

    if (!slice.length) {
      body.innerHTML = '<tr><td colspan="6">Nenhum ecoponto cadastrado.</td></tr>';
      renderPagination(totalPages);
      return;
    }

    body.innerHTML = slice
      .map(function (p) {
        return (
          '<tr data-id="' +
          escHtml(p.id) +
          '" data-id-pev="' +
          escHtml(p.id_pev) +
          '" tabindex="0">' +
          "<td>" +
          escHtml(p.name) +
          "</td>" +
          "<td>" +
          escHtml(p.bairro) +
          "</td>" +
          "<td>" +
          badgeStatus(p.status) +
          "</td>" +
          "<td>" +
          escHtml(p.capacidade) +
          "%</td>" +
          "<td>" +
          escHtml(p.responsavel) +
          '</td><td class="plat-actions">' +
          '<button type="button" class="plat-icon-btn" data-edit="' +
          escHtml(p.id) +
          '" aria-label="Editar ' +
          escHtml(p.name) +
          '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>' +
          '<button type="button" class="plat-icon-btn plat-icon-btn--danger" data-del="' +
          escHtml(p.id) +
          '" aria-label="Excluir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>' +
          "</td></tr>"
        );
      })
      .join("");

    body.querySelectorAll("tr[data-id]").forEach(function (tr) {
      tr.addEventListener("click", function (e) {
        if (e.target.closest("button")) return;
        selectRow(tr.getAttribute("data-id"), false);
      });
      tr.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectRow(tr.getAttribute("data-id"), false);
        }
      });
    });

    body.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        openModal(btn.getAttribute("data-edit"));
      });
    });

    body.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        deleteEcoponto(btn.getAttribute("data-del"));
      });
    });

    if (selectedId) {
      var still = ecopontos.some(function (p) {
        return p.id === selectedId;
      });
      if (still) {
        body.querySelectorAll("tr").forEach(function (tr) {
          tr.classList.toggle("is-selected", tr.getAttribute("data-id") === selectedId);
        });
      } else {
        selectedId = null;
      }
    }

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    var nav = document.getElementById("ecopontosPagination");
    if (!nav) return;
    var html = "";
    if (currentPage > 1) {
      html += '<button type="button" data-page="' + (currentPage - 1) + '">&lt;</button>';
    }
    for (var i = 1; i <= totalPages; i++) {
      html +=
        '<button type="button" data-page="' +
        i +
        '" class="' +
        (i === currentPage ? "is-active" : "") +
        '">' +
        i +
        "</button>";
    }
    if (currentPage < totalPages) {
      html += '<button type="button" data-page="' + (currentPage + 1) + '">&gt;</button>';
    }
    nav.innerHTML = html;
    nav.querySelectorAll("[data-page]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentPage = parseInt(btn.getAttribute("data-page"), 10) || 1;
        renderTable();
      });
    });
  }

  function initMap() {
    var el = document.getElementById("ecoponto-adm-map");
    if (!el || typeof L === "undefined") return;
    map = L.map(el, { zoomControl: true, scrollWheelZoom: true }).setView([-7.22, -39.35], 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
    mapReady = true;
    renderMap(selectedId);
  }

  var modal = {
    el: null,
    form: null,
    open: false,
  };

  function getModalEls() {
    modal.el = document.getElementById("ecopontoModal");
    modal.form = document.getElementById("ecopontoForm");
    return modal.el && modal.form;
  }

  function openModal(editId) {
    if (!getModalEls()) return;
    var title = document.getElementById("ecopontoModalTitle");
    var p = editId ? findById(editId) : null;

    document.getElementById("ecopontoIdPev").value = p ? String(p.id_pev || 0) : "0";
    document.getElementById("ecopontoCatalogId").value = p ? p.id || p.catalog_id || "" : "";
    document.getElementById("ecopontoName").value = p ? p.name : "";
    document.getElementById("ecopontoBairro").value = p ? p.bairro : "";
    document.getElementById("ecopontoCity").value = p ? p.city : "";
    document.getElementById("ecopontoAddress").value = p ? p.address : "";
    document.getElementById("ecopontoLat").value =
      p && p.lat != null ? String(p.lat) : "";
    document.getElementById("ecopontoLng").value =
      p && p.lng != null ? String(p.lng) : "";
    document.getElementById("ecopontoStatus").value = p ? p.status || "ativo" : "ativo";
    document.getElementById("ecopontoCapacidade").value = p ? String(p.capacidade) : "70";
    document.getElementById("ecopontoResponsavel").value =
      p && p.responsavel && p.responsavel !== "—" ? p.responsavel : "";

    if (title) {
      title.textContent = p ? "Editar ecoponto" : "Novo ecoponto";
    }

    modal.el.classList.remove("hidden");
    modal.open = true;
    document.getElementById("ecopontoName").focus();
  }

  function closeModal() {
    if (!modal.el) return;
    modal.el.classList.add("hidden");
    modal.open = false;
  }

  function payloadFromForm() {
    var latVal = document.getElementById("ecopontoLat").value.trim();
    var lngVal = document.getElementById("ecopontoLng").value.trim();
    return {
      id_pev: parseInt(document.getElementById("ecopontoIdPev").value, 10) || 0,
      catalog_id: document.getElementById("ecopontoCatalogId").value.trim(),
      name: document.getElementById("ecopontoName").value.trim(),
      bairro: document.getElementById("ecopontoBairro").value.trim(),
      city: document.getElementById("ecopontoCity").value.trim(),
      address: document.getElementById("ecopontoAddress").value.trim(),
      lat: latVal === "" ? null : parseFloat(latVal),
      lng: lngVal === "" ? null : parseFloat(lngVal),
      status: document.getElementById("ecopontoStatus").value,
      capacidade: parseInt(document.getElementById("ecopontoCapacidade").value, 10) || 0,
      responsavel: document.getElementById("ecopontoResponsavel").value.trim(),
    };
  }

  function saveEcoponto(e) {
    if (e) e.preventDefault();
    var payload = payloadFromForm();
    if (!payload.name) {
      window.alert("Informe o nome do ecoponto.");
      return;
    }

    var btn = document.getElementById("ecopontoModalSave");
    if (btn) btn.disabled = true;

    fetch(phpUrl("salvar-ecoponto-adm.php"), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.text();
      })
      .then(function (text) {
        var data = parseJsonResponse(text);
        if (!data || data.sucesso !== true) {
          throw new Error((data && data.erro) || "Falha ao salvar.");
        }
        closeModal();
        selectedId = data.ecoponto && data.ecoponto.id ? data.ecoponto.id : selectedId;
        return refreshEcopontos(false);
      })
      .catch(function (err) {
        window.alert(err.message || "Erro ao salvar ecoponto.");
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function deleteEcoponto(id) {
    var p = findById(id);
    if (!p) return;
    if (!window.confirm('Excluir o ecoponto "' + p.name + '"?')) return;

    fetch(phpUrl("excluir-ecoponto-adm.php"), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_pev: p.id_pev }),
    })
      .then(function (r) {
        return r.text();
      })
      .then(function (text) {
        var data = parseJsonResponse(text);
        if (!data || data.sucesso !== true) {
          throw new Error((data && data.erro) || "Falha ao excluir.");
        }
        if (selectedId === id) selectedId = null;
        return refreshEcopontos(false);
      })
      .catch(function (err) {
        window.alert(err.message || "Erro ao excluir ecoponto.");
      });
  }

  function setupModal() {
    if (!getModalEls()) return;

    modal.form.addEventListener("submit", saveEcoponto);

    var closeBtn = document.getElementById("ecopontoModalClose");
    var cancelBtn = document.getElementById("ecopontoModalCancel");
    var backdrop = document.getElementById("ecopontoModalBackdrop");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
    if (backdrop) backdrop.addEventListener("click", closeModal);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.open) closeModal();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupModal();

    var btnAdd = document.getElementById("btnAddEcoponto");
    if (btnAdd) {
      btnAdd.addEventListener("click", function () {
        openModal(null);
      });
    }

    window.PlatAdmShell.init()
      .then(function () {
        return refreshEcopontos(false);
      })
      .then(function () {
        initMap();
      })
      .catch(function (err) {
        console.error(err);
        ecopontos = [];
        updateKpis({ total: 0, ativos: 0, manutencao: 0 });
        initMap();
        renderTable();
      });
  });
})();
