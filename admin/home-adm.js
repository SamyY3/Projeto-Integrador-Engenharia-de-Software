(function () {
  "use strict";

  var chartMateriais = null;
  var chartRuas = null;
  var dashboardData = null;
  var agendamentosList = [];
  var modals = {
    ecoponto: false,
    coletas: false,
    agEdit: false,
    agDelete: false,
    deleteAgId: 0,
  };

  function escHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function phpUrl(path) {
    return window.ecocoletaPhpUrl ? window.ecocoletaPhpUrl(path) : "api/" + path;
  }

  function apiUrl(sync) {
    var url = phpUrl("dashboard-plataforma-adm.php");
    if (sync) {
      url += (url.indexOf("?") >= 0 ? "&" : "?") + "sync=1";
    }
    return url;
  }

  function parseJsonResponse(text) {
    var raw = String(text).replace(/^\uFEFF/, "").trim();
    return JSON.parse(raw.indexOf("{") >= 0 ? raw.slice(raw.indexOf("{")) : raw);
  }

  function loadDashboard(sync) {
    return fetch(apiUrl(sync), { credentials: "same-origin", cache: "no-store" })
      .then(function (r) {
        return r.text();
      })
      .then(function (text) {
        var data = parseJsonResponse(text);
        if (!data || data.sucesso !== true) {
          throw new Error((data && data.erro) || "Não foi possível carregar o dashboard.");
        }
        var dash = data.dashboard || {};
        if (data.meta && !dash.meta) {
          dash.meta = data.meta;
        }
        if (dash.meta && dash.meta.fonte !== "banco") {
          console.warn("[Home-ADM] Resposta sem fonte banco:", dash.meta);
        }
        return dash;
      });
  }

  function formatKpiColetas(n) {
    return Number(n || 0).toLocaleString("pt-BR");
  }

  function formatKpiUsuarios(n) {
    return Number(n || 0).toLocaleString("pt-BR");
  }

  function formatKpiKg(n) {
    return Math.round(Number(n || 0)).toLocaleString("pt-BR") + " Kg";
  }

  function formatKpiTaxa(n) {
    return Math.round(Number(n || 0)) + "%";
  }

  function badgeStatus(status) {
    var map = {
      confirmado: ["Confirmado", "plat-status--confirmado"],
      andamento: ["Em andamento", "plat-status--andamento"],
      coletado: ["Coletado", "plat-status--coletado"],
      cancelado: ["Cancelado", "plat-status--cancelado"],
    };
    var item = map[status] || ["—", "plat-status--confirmado"];
    return '<span class="plat-status ' + item[1] + '">' + escHtml(item[0]) + "</span>";
  }

  function applyKpis(kpis) {
    var map = {
      kpiColetas: formatKpiColetas(kpis.coletas),
      kpiUsuarios: formatKpiUsuarios(kpis.usuarios_ativos),
      kpiKg: formatKpiKg(kpis.kg_reciclaveis),
      kpiTaxa: formatKpiTaxa(kpis.taxa_reciclagem),
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = map[id];
    });
  }

  function findAgendamento(id) {
    var n = parseInt(id, 10);
    if (!n) return null;
    return (
      agendamentosList.find(function (a) {
        return parseInt(a.id_agendamento, 10) === n;
      }) || null
    );
  }

  function statusParaFormulario(a) {
    var s = a.status_db || a.status || "confirmado";
    if (s === "coletado") return "concluida";
    return s;
  }

  function renderAgendamentos(list) {
    var body = document.getElementById("agendamentosBody");
    if (!body) return;

    agendamentosList = Array.isArray(list) ? list.slice() : [];

    if (!agendamentosList.length) {
      body.innerHTML =
        '<tr><td colspan="6" class="plat-ag-empty">Nenhum agendamento recente.</td></tr>';
      return;
    }

    body.innerHTML = agendamentosList
      .map(function (row) {
        var id = parseInt(row.id_agendamento, 10) || 0;
        return (
          "<tr>" +
          "<td>" +
          escHtml(row.id) +
          "</td>" +
          "<td>" +
          escHtml(row.usuario) +
          "</td>" +
          "<td>" +
          escHtml(row.data) +
          "</td>" +
          "<td>" +
          escHtml(row.ecoponto) +
          "</td>" +
          "<td>" +
          badgeStatus(row.status) +
          '</td><td class="plat-home-actions">' +
          '<button type="button" class="plat-icon-btn" data-edit-ag="' +
          id +
          '" aria-label="Editar agendamento ' +
          escHtml(row.id) +
          '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>' +
          '<button type="button" class="plat-icon-btn plat-icon-btn--danger" data-del-ag="' +
          id +
          '" aria-label="Excluir agendamento"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>' +
          "</td></tr>"
        );
      })
      .join("");

    body.querySelectorAll("[data-edit-ag]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openAgEditModal(btn.getAttribute("data-edit-ag"));
      });
    });
    body.querySelectorAll("[data-del-ag]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openAgDeleteModal(btn.getAttribute("data-del-ag"));
      });
    });
  }

  function updatePageMeta(meta) {
    var sub = document.querySelector(".plat-page-sub");
    if (!sub) return;
    if (meta && meta.fonte === "banco") {
      if (meta.tem_dados) {
        sub.textContent =
          "Rede EcoColeta · dados em tempo real do banco de dados (MySQL)";
      } else {
        sub.textContent =
          "Rede EcoColeta · banco conectado; cadastre entregas e agendamentos para preencher os gráficos";
      }
      return;
    }
    sub.textContent = "Rede EcoColeta · não foi possível confirmar a origem dos dados";
  }

  function renderLegendRuas(ruas) {
    var list = document.getElementById("legendRuas");
    if (!list) return;
    if (!ruas || !ruas.length) {
      list.innerHTML =
        '<li class="plat-legend-empty">Sem entregas com rua cadastrada no banco.</li>';
      return;
    }
    list.innerHTML = ruas
      .map(function (r) {
        return (
          '<li><span class="plat-legend-swatch" style="background:' +
          escHtml(r.cor) +
          '"></span><span>' +
          escHtml(r.nome) +
          "</span><strong>" +
          escHtml(r.pct) +
          "%</strong></li>"
        );
      })
      .join("");
  }

  function destroyCharts() {
    if (chartMateriais) {
      chartMateriais.destroy();
      chartMateriais = null;
    }
    if (chartRuas) {
      chartRuas.destroy();
      chartRuas = null;
    }
  }

  function initCharts(materiais, ruas) {
    if (typeof Chart === "undefined") return;
    destroyCharts();

    Chart.defaults.font.family = '"Sora", system-ui, sans-serif';
    Chart.defaults.color = "#5c766a";

    var mat = materiais || { labels: [], values: [], colors: [] };
    var canvasMateriais = document.getElementById("chartMateriais");
    if (canvasMateriais) {
      chartMateriais = new Chart(canvasMateriais, {
        type: "bar",
        data: {
          labels: mat.labels || [],
          datasets: [
            {
              data: mat.values || [],
              backgroundColor: mat.colors || "#0f6b38",
              borderRadius: 10,
              borderSkipped: false,
              maxBarThickness: 52,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, border: { display: false } },
            y: {
              beginAtZero: true,
              grid: { color: "rgba(15, 107, 74, 0.08)" },
              border: { display: false },
            },
          },
        },
      });
    }

    var canvasRuas = document.getElementById("chartRuas");
    if (canvasRuas && ruas && ruas.length) {
      chartRuas = new Chart(canvasRuas, {
        type: "doughnut",
        data: {
          labels: ruas.map(function (r) {
            return r.nome;
          }),
          datasets: [
            {
              data: ruas.map(function (r) {
                return r.pct;
              }),
              backgroundColor: ruas.map(function (r) {
                return r.cor;
              }),
              borderWidth: 3,
              borderColor: "#ffffff",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: { legend: { display: false } },
        },
      });
    }
  }

  function renderDashboard(data) {
    dashboardData = data || {};
    updatePageMeta(dashboardData.meta || null);
    applyKpis(dashboardData.kpis || {});
    renderLegendRuas(dashboardData.ruas || []);
    renderAgendamentos(dashboardData.agendamentos || []);
    initCharts(dashboardData.materiais, dashboardData.ruas);
  }

  function showLoadError(err) {
    updatePageMeta(null);
    applyKpis({ coletas: 0, usuarios_ativos: 0, kg_reciclaveis: 0, taxa_reciclagem: 0 });
    var body = document.getElementById("agendamentosBody");
    if (body) {
      body.innerHTML =
        '<tr><td colspan="6" class="plat-ag-empty">' +
        escHtml(err.message || "Erro ao carregar.") +
        "</td></tr>";
    }
  }

  function refreshDashboard() {
    return loadDashboard(false).then(renderDashboard);
  }

  function updateModalLock() {
    var open =
      modals.ecoponto || modals.coletas || modals.agEdit || modals.agDelete;
    document.body.classList.toggle("plat-home-modal-open", open);
  }

  function showModalError(el, msg) {
    if (!el) return;
    if (!msg) {
      el.textContent = "";
      el.classList.add("hidden");
      return;
    }
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function openModal(key) {
    var el = document.getElementById(key);
    if (!el) return;
    el.classList.remove("hidden");
    if (key === "homeEcopontoModal") modals.ecoponto = true;
    if (key === "homeColetasModal") modals.coletas = true;
    if (key === "homeAgModalEdit") modals.agEdit = true;
    if (key === "homeAgModalDelete") modals.agDelete = true;
    updateModalLock();
  }

  function closeModal(key) {
    var el = document.getElementById(key);
    if (el) el.classList.add("hidden");
    if (key === "homeEcopontoModal") modals.ecoponto = false;
    if (key === "homeColetasModal") modals.coletas = false;
    if (key === "homeAgModalEdit") modals.agEdit = false;
    if (key === "homeAgModalDelete") {
      modals.agDelete = false;
      modals.deleteAgId = 0;
    }
    updateModalLock();
  }

  function setupModalCloseHandlers() {
    document.querySelectorAll("[data-close]").forEach(function (node) {
      node.addEventListener("click", function () {
        closeModal(node.getAttribute("data-close"));
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (modals.agDelete) closeModal("homeAgModalDelete");
      else if (modals.agEdit) closeModal("homeAgModalEdit");
      else if (modals.ecoponto) closeModal("homeEcopontoModal");
      else if (modals.coletas) closeModal("homeColetasModal");
    });
  }

  function openEcopontoModal() {
    document.getElementById("homeEcopontoIdPev").value = "0";
    document.getElementById("homeEcopontoCatalogId").value = "";
    document.getElementById("homeEcopontoName").value = "";
    document.getElementById("homeEcopontoBairro").value = "";
    document.getElementById("homeEcopontoCity").value = "Juazeiro do Norte";
    document.getElementById("homeEcopontoAddress").value = "";
    document.getElementById("homeEcopontoLat").value = "";
    document.getElementById("homeEcopontoLng").value = "";
    document.getElementById("homeEcopontoStatus").value = "ativo";
    document.getElementById("homeEcopontoCapacidade").value = "70";
    document.getElementById("homeEcopontoResponsavel").value = "";
    showModalError(document.getElementById("homeEcopontoError"), "");
    var title = document.getElementById("homeEcopontoModalTitle");
    if (title) title.textContent = "Novo ecoponto";
    openModal("homeEcopontoModal");
    document.getElementById("homeEcopontoName").focus();
  }

  function saveEcoponto(ev) {
    ev.preventDefault();
    var btn = document.getElementById("homeEcopontoSave");
    var errEl = document.getElementById("homeEcopontoError");
    var latVal = document.getElementById("homeEcopontoLat").value.trim();
    var lngVal = document.getElementById("homeEcopontoLng").value.trim();
    var payload = {
      id_pev: parseInt(document.getElementById("homeEcopontoIdPev").value, 10) || 0,
      catalog_id: document.getElementById("homeEcopontoCatalogId").value.trim(),
      name: document.getElementById("homeEcopontoName").value.trim(),
      bairro: document.getElementById("homeEcopontoBairro").value.trim(),
      city: document.getElementById("homeEcopontoCity").value.trim(),
      address: document.getElementById("homeEcopontoAddress").value.trim(),
      lat: latVal === "" ? null : parseFloat(latVal),
      lng: lngVal === "" ? null : parseFloat(lngVal),
      status: document.getElementById("homeEcopontoStatus").value,
      capacidade: parseInt(document.getElementById("homeEcopontoCapacidade").value, 10) || 70,
      responsavel: document.getElementById("homeEcopontoResponsavel").value.trim(),
    };

    if (!payload.name) {
      showModalError(errEl, "Informe o nome do ecoponto.");
        return;
      }

    if (btn) btn.disabled = true;
    showModalError(errEl, "");

    fetch(phpUrl("salvar-ecoponto-adm.php"), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.text().then(parseJsonResponse);
      })
      .then(function (data) {
        if (!data || data.sucesso !== true) {
          throw new Error((data && data.erro) || "Não foi possível salvar o ecoponto.");
        }
        closeModal("homeEcopontoModal");
        return refreshDashboard();
      })
      .catch(function (err) {
        showModalError(errEl, err.message || "Erro ao salvar.");
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function openColetasModal() {
    openModal("homeColetasModal");
  }

  function rotuloResponsavelAg(tipo, origem) {
    if (tipo === "prefeitura") return "Prefeitura";
    var o = String(origem || "").trim();
    if (o && o !== "—" && o.toLowerCase() !== "ecoponto") return o;
    return "Ecoponto";
  }

  function syncHomeAgResponsavel() {
    var respEl = document.getElementById("homeAgEditResponsavel");
    if (!respEl) return;
    respEl.value = rotuloResponsavelAg(
      document.getElementById("homeAgEditTipo").value,
      document.getElementById("homeAgEditOrigem").value
    );
  }

  function openAgEditModal(id) {
    var a = findAgendamento(id);
    if (!a) return;

    document.getElementById("homeAgEditId").value = String(a.id_agendamento);
    document.getElementById("homeAgEditOrigem").value = a.ecoponto || "—";
    document.getElementById("homeAgEditBairro").value = a.bairro || "—";
    document.getElementById("homeAgEditData").value = a.data_coleta || "";
    document.getElementById("homeAgEditSlot").value = String(
      typeof a.slot_ordem === "number" ? a.slot_ordem : 0
    );
    document.getElementById("homeAgEditTipo").value =
      a.tipo === "prefeitura" ? "prefeitura" : "caminhao";
    document.getElementById("homeAgEditStatus").value = statusParaFormulario(a);
    syncHomeAgResponsavel();
    showModalError(document.getElementById("homeAgEditError"), "");
    openModal("homeAgModalEdit");
    var tipoEl = document.getElementById("homeAgEditTipo");
    if (tipoEl) tipoEl.focus();
  }

  function saveAgendamento(ev) {
    ev.preventDefault();
    var btn = document.getElementById("homeAgEditSave");
    var errEl = document.getElementById("homeAgEditError");
    var payload = {
      id_agendamento: parseInt(document.getElementById("homeAgEditId").value, 10),
      data_coleta: document.getElementById("homeAgEditData").value,
      slot_ordem: parseInt(document.getElementById("homeAgEditSlot").value, 10),
      tipo: document.getElementById("homeAgEditTipo").value,
      status: document.getElementById("homeAgEditStatus").value,
      responsavel: rotuloResponsavelAg(
        document.getElementById("homeAgEditTipo").value,
        document.getElementById("homeAgEditOrigem").value
      ),
    };

    if (btn) btn.disabled = true;
    showModalError(errEl, "");

    fetch(phpUrl("salvar-agendamento-adm.php"), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.text().then(parseJsonResponse);
      })
      .then(function (data) {
        if (!data || data.sucesso !== true) {
          throw new Error((data && data.erro) || "Não foi possível salvar.");
        }
        closeModal("homeAgModalEdit");
        return refreshDashboard();
      })
      .catch(function (err) {
        showModalError(errEl, err.message || "Erro ao salvar.");
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function openAgDeleteModal(id) {
    var a = findAgendamento(id);
    if (!a) return;

    modals.deleteAgId = parseInt(id, 10);
    var msgEl = document.getElementById("homeAgDeleteMessage");
    if (msgEl) {
      msgEl.textContent =
        'Deseja excluir o agendamento ' +
        (a.id || "") +
        " (" +
        (a.ecoponto || "—") +
        ")?";
    }
    showModalError(document.getElementById("homeAgDeleteError"), "");
    openModal("homeAgModalDelete");
  }

  function confirmDeleteAgendamento() {
    var id = modals.deleteAgId;
    if (!id) return;

    var btn = document.getElementById("homeAgDeleteConfirm");
    var errEl = document.getElementById("homeAgDeleteError");
    if (btn) btn.disabled = true;
    showModalError(errEl, "");

    fetch(phpUrl("excluir-agendamento-adm.php"), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_agendamento: id }),
    })
      .then(function (r) {
        return r.text().then(parseJsonResponse);
      })
      .then(function (data) {
        if (!data || data.sucesso !== true) {
          throw new Error((data && data.erro) || "Não foi possível excluir.");
        }
        closeModal("homeAgModalDelete");
        return refreshDashboard();
      })
      .catch(function (err) {
        showModalError(errEl, err.message || "Erro ao excluir.");
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function setupToolbar() {
    var btnEco = document.getElementById("btnAdicionarEcoponto");
    var btnCol = document.getElementById("btnGerenciarColetas");
    var btnVer = document.getElementById("btnVerTodosAgendamentos");

    if (btnEco) btnEco.addEventListener("click", openEcopontoModal);
    if (btnCol) btnCol.addEventListener("click", openColetasModal);
    if (btnVer) btnVer.addEventListener("click", openColetasModal);

    var formEco = document.getElementById("homeEcopontoForm");
    if (formEco) formEco.addEventListener("submit", saveEcoponto);

    var formAg = document.getElementById("homeAgFormEdit");
    if (formAg) formAg.addEventListener("submit", saveAgendamento);

    var btnDel = document.getElementById("homeAgDeleteConfirm");
    if (btnDel) btnDel.addEventListener("click", confirmDeleteAgendamento);
  }

  function init() {
    setupModalCloseHandlers();
    setupToolbar();

    var homeAgTipo = document.getElementById("homeAgEditTipo");
    if (homeAgTipo) {
      homeAgTipo.addEventListener("change", syncHomeAgResponsavel);
    }

    if (!window.PlatAdmShell || typeof window.PlatAdmShell.init !== "function") {
      document.documentElement.classList.remove("plat-auth-checking");
      loadDashboard(false).then(renderDashboard).catch(showLoadError);
      return;
    }

    window.PlatAdmShell.init()
      .then(function () {
        return loadDashboard(false);
      })
      .then(renderDashboard)
      .catch(function (err) {
        if (err && err.message === "sessao") return;
        showLoadError(err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
