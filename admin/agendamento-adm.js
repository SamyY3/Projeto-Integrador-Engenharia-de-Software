(function () {
  "use strict";

  var PAGE_SIZE = 8;
  var agendamentosAll = [];
  var agendamentos = [];
  var currentPage = 1;
  var modals = { editOpen: false, deleteOpen: false, deleteId: 0 };

  function escHtml(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function initials(nome) {
    var parts = String(nome || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function rotuloNomeEcoponto(item) {
    var nome = String(item.nome_ecoponto || "").trim();
    if (!nome) {
      nome = String(item.ecoponto || item.origem || "").trim();
    }
    if (nome.toLowerCase() === "prefeitura" || nome.toLowerCase() === "ecoponto") {
      nome = "";
    }
    return nome || "—";
  }

  function rotuloFormaColeta(item) {
    return item.tipo_label || (item.tipo === "prefeitura" ? "Prefeitura" : "Ecoponto");
  }

  function origemInitials(nomeEcoponto, tipo) {
    var o = String(nomeEcoponto || "").trim();
    if (o === "—" || !o) {
      return tipo === "prefeitura" ? "PF" : "EP";
    }
    if (/^ecoponto\b/i.test(o)) {
      return "EP";
    }
    return initials(o);
  }

  function resumoFromList(list) {
    var em = 0;
    var concl = 0;
    var canc = 0;
    list.forEach(function (a) {
      var s = a.status || "";
      if (s === "concluida") concl++;
      else if (s === "cancelado") canc++;
      else em++;
    });
    return { total: list.length, em_andamento: em, concluidos: concl, cancelados: canc };
  }

  function statusGroup(status) {
    if (status === "concluida") return "concluida";
    if (status === "cancelado") return "cancelado";
    return "andamento";
  }

  function apiUrl() {
    return window.ecocoletaPhpUrl
      ? window.ecocoletaPhpUrl("listar-agendamentos-adm.php")
      : "api/listar-agendamentos-adm.php";
  }

  function phpUrl(path) {
    return window.ecocoletaPhpUrl ? window.ecocoletaPhpUrl(path) : "api/" + path;
  }

  function parseJsonResponse(text) {
    var raw = String(text).replace(/^\uFEFF/, "").trim();
    return JSON.parse(raw.indexOf("{") >= 0 ? raw.slice(raw.indexOf("{")) : raw);
  }

  function findAgendamento(id) {
    var n = parseInt(id, 10);
    if (!n) return null;
    return (
      agendamentosAll.find(function (a) {
        return parseInt(a.id_agendamento, 10) === n;
      }) || null
    );
  }

  function setBodyModalLock(open) {
    document.body.classList.toggle("plat-ag-modal-open", !!open);
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

  function loadAgendamentos(syncCatalog) {
    var url = apiUrl();
    if (syncCatalog) {
      url += (url.indexOf("?") >= 0 ? "&" : "?") + "sync=1";
    }
    return fetch(url, { credentials: "same-origin", cache: "no-store" })
      .then(function (r) {
        return r.text();
      })
      .then(function (text) {
        var raw = String(text).replace(/^\uFEFF/, "").trim();
        var data = JSON.parse(raw.indexOf("{") >= 0 ? raw.slice(raw.indexOf("{")) : raw);
        if (!data || data.sucesso !== true) {
          throw new Error((data && data.erro) || "Não foi possível carregar os agendamentos.");
        }
        return data;
      });
  }

  function statusLabel(status) {
    return statusMeta(status).label;
  }

  function statusMeta(status) {
    if (status === "concluida") {
      return { label: "Concluído", cls: "plat-ag-badge--concluido" };
    }
    if (status === "cancelado") {
      return { label: "Cancelado", cls: "plat-ag-badge--cancelado" };
    }
    return { label: "Em andamento", cls: "plat-ag-badge--andamento" };
  }

  function statusBadge(status) {
    var m = statusMeta(status);
    return '<span class="plat-ag-badge ' + m.cls + '">' + escHtml(m.label) + "</span>";
  }

  function updateKpis(resumo) {
    var total = document.getElementById("kpiTotal");
    var em = document.getElementById("kpiEmAndamento");
    var concl = document.getElementById("kpiConcluidos");
    var canc = document.getElementById("kpiCancelados");
    if (total) total.textContent = String(resumo.total ?? 0);
    if (em) em.textContent = String(resumo.em_andamento ?? 0);
    if (concl) concl.textContent = String(resumo.concluidos ?? 0);
    if (canc) canc.textContent = String(resumo.cancelados ?? 0);
  }

  function populateBairroFilter() {
    var select = document.getElementById("agFilterBairro");
    if (!select) return;

    var bairros = {};
    agendamentosAll.forEach(function (a) {
      var b = String(a.bairro || "").trim();
      if (b) bairros[b] = true;
    });

    var sorted = Object.keys(bairros).sort(function (a, b) {
      return a.localeCompare(b, "pt-BR");
    });

    var current = select.value;
    select.innerHTML = '<option value="">Todos os bairros</option>';
    sorted.forEach(function (b) {
      var opt = document.createElement("option");
      opt.value = b;
      opt.textContent = b;
      select.appendChild(opt);
    });
    if (current && bairros[current]) {
      select.value = current;
    }
  }

  function applyFilters() {
    var q = String(document.getElementById("agSearch")?.value || "")
      .trim()
      .toLowerCase();
    var statusFilter = String(document.getElementById("agFilterStatus")?.value || "");
    var bairroFilter = String(document.getElementById("agFilterBairro")?.value || "");

    agendamentos = agendamentosAll.filter(function (a) {
      if (statusFilter) {
        if (statusGroup(a.status) !== statusFilter) return false;
      }
      if (bairroFilter && String(a.bairro || "") !== bairroFilter) {
        return false;
      }
      if (q) {
        var hay = (
          rotuloNomeEcoponto(a) +
          " " +
          rotuloFormaColeta(a) +
          " " +
          String(a.bairro || "") +
          " " +
          String(a.responsavel || "")
        ).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    currentPage = 1;
    renderTable();
    renderPagination();
  }

  function totalPages() {
    return Math.max(1, Math.ceil(agendamentos.length / PAGE_SIZE));
  }

  function pageSlice() {
    var start = (currentPage - 1) * PAGE_SIZE;
    return agendamentos.slice(start, start + PAGE_SIZE);
  }

  function renderPagination() {
    var nav = document.getElementById("agPagination");
    var info = document.getElementById("agPaginationInfo");
    if (!nav || !info) return;

    var total = agendamentos.length;
    var pages = totalPages();
    if (currentPage > pages) currentPage = pages;

    var start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    var end = Math.min(currentPage * PAGE_SIZE, total);
    info.textContent =
      total === 0
        ? "Nenhum agendamento encontrado"
        : "Mostrando " + start + "–" + end + " de " + total;

    if (total === 0) {
      nav.innerHTML = "";
      return;
    }

    var html = "";
    if (currentPage > 1) {
      html +=
        '<button type="button" data-page="' +
        (currentPage - 1) +
        '" aria-label="Página anterior">‹</button>';
    }

    for (var p = 1; p <= pages; p++) {
      if (pages > 6 && p > 2 && p < pages - 1 && Math.abs(p - currentPage) > 1) {
        if (p === 3 || p === pages - 2) {
          html += '<button type="button" disabled aria-hidden="true">…</button>';
        }
        continue;
      }
      html +=
        '<button type="button" data-page="' +
        p +
        '"' +
        (p === currentPage ? ' class="is-active" aria-current="page"' : "") +
        ">" +
        p +
        "</button>";
    }

    if (currentPage < pages) {
      html +=
        '<button type="button" data-page="' +
        (currentPage + 1) +
        '" aria-label="Próxima página">›</button>';
    }

    nav.innerHTML = html;
    nav.querySelectorAll("[data-page]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentPage = parseInt(btn.getAttribute("data-page"), 10) || 1;
        renderTable();
        renderPagination();
      });
    });
  }

  function rotuloResponsavel(tipo, origem) {
    if (tipo === "prefeitura") return "Prefeitura";
    var o = String(origem || "").trim();
    if (o && o !== "—" && o.toLowerCase() !== "ecoponto") return o;
    return "Ecoponto";
  }

  function syncResponsavelEdit() {
    var tipoEl = document.getElementById("agEditTipo");
    var origemEl = document.getElementById("agEditOrigem");
    var respEl = document.getElementById("agEditResponsavel");
    if (!respEl) return;
    respEl.value = rotuloResponsavel(
      tipoEl ? tipoEl.value : "caminhao",
      origemEl ? origemEl.value : ""
    );
  }

  function openEditModal(id) {
    var el = document.getElementById("agModalEdit");
    var a = findAgendamento(id);
    if (!el || !a) return;

    document.getElementById("agEditId").value = String(a.id_agendamento);
    document.getElementById("agEditOrigem").value = rotuloNomeEcoponto(a);
    document.getElementById("agEditBairro").value = a.bairro || "—";
    document.getElementById("agEditData").value = a.data_coleta || "";
    document.getElementById("agEditSlot").value = String(
      typeof a.slot_ordem === "number" ? a.slot_ordem : 0
    );
    document.getElementById("agEditTipo").value =
      a.tipo === "prefeitura" ? "prefeitura" : "caminhao";
    document.getElementById("agEditStatus").value = a.status || "confirmado";
    syncResponsavelEdit();
    showModalError(document.getElementById("agEditError"), "");

    el.classList.remove("hidden");
    modals.editOpen = true;
    setBodyModalLock(true);
    var focusEl = document.getElementById("agEditResponsavel");
    if (focusEl) focusEl.focus();
  }

  function closeEditModal() {
    var el = document.getElementById("agModalEdit");
    if (el) el.classList.add("hidden");
    modals.editOpen = false;
    if (!modals.deleteOpen) setBodyModalLock(false);
  }

  function openDeleteModal(id) {
    var el = document.getElementById("agModalDelete");
    var a = findAgendamento(id);
    if (!el || !a) return;

    modals.deleteId = parseInt(id, 10);
    var nomeEcoponto = rotuloNomeEcoponto(a);
    var msgEl = document.getElementById("agDeleteMessage");
    if (msgEl) {
      msgEl.textContent =
        'Deseja excluir o agendamento de "' +
        nomeEcoponto +
        '" em ' +
        (a.bairro || "—") +
        "?";
    }
    showModalError(document.getElementById("agDeleteError"), "");

    el.classList.remove("hidden");
    modals.deleteOpen = true;
    setBodyModalLock(true);
  }

  function closeDeleteModal() {
    var el = document.getElementById("agModalDelete");
    if (el) el.classList.add("hidden");
    modals.deleteOpen = false;
    modals.deleteId = 0;
    if (!modals.editOpen) setBodyModalLock(false);
  }

  function patchAgendamento(updated) {
    var id = parseInt(updated.id_agendamento, 10);
    agendamentosAll = agendamentosAll.map(function (a) {
      return parseInt(a.id_agendamento, 10) === id ? updated : a;
    });
    updateKpis(resumoFromList(agendamentosAll));
    populateBairroFilter();
    applyFilters();
  }

  function removeAgendamento(id) {
    agendamentosAll = agendamentosAll.filter(function (a) {
      return parseInt(a.id_agendamento, 10) !== id;
    });
    updateKpis(resumoFromList(agendamentosAll));
    populateBairroFilter();
    applyFilters();
  }

  function saveAgendamento(ev) {
    ev.preventDefault();
    var btn = document.getElementById("agModalEditSave");
    var errEl = document.getElementById("agEditError");
    var payload = {
      id_agendamento: parseInt(document.getElementById("agEditId").value, 10),
      data_coleta: document.getElementById("agEditData").value,
      slot_ordem: parseInt(document.getElementById("agEditSlot").value, 10),
      tipo: document.getElementById("agEditTipo").value,
      status: document.getElementById("agEditStatus").value,
      responsavel: rotuloResponsavel(
        document.getElementById("agEditTipo").value,
        document.getElementById("agEditOrigem").value
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
        patchAgendamento(data.agendamento);
        closeEditModal();
      })
      .catch(function (err) {
        showModalError(errEl, err.message || "Erro ao salvar.");
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function confirmDeleteAgendamento() {
    var id = modals.deleteId;
    if (!id) return;

    var btn = document.getElementById("agModalDeleteConfirm");
    var errEl = document.getElementById("agDeleteError");
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
        removeAgendamento(id);
        closeDeleteModal();
      })
      .catch(function (err) {
        showModalError(errEl, err.message || "Erro ao excluir.");
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function setupModals() {
    var form = document.getElementById("agFormEdit");
    if (form) {
      form.addEventListener("submit", saveAgendamento);
    }

    var closePairs = [
      ["agModalEditClose", closeEditModal],
      ["agModalEditCancel", closeEditModal],
      ["agModalEditBackdrop", closeEditModal],
      ["agModalDeleteClose", closeDeleteModal],
      ["agModalDeleteCancel", closeDeleteModal],
      ["agModalDeleteBackdrop", closeDeleteModal],
    ];
    closePairs.forEach(function (pair) {
      var node = document.getElementById(pair[0]);
      if (node) {
        node.addEventListener("click", pair[1]);
      }
    });

    var confirmBtn = document.getElementById("agModalDeleteConfirm");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", confirmDeleteAgendamento);
    }

    var tipoEdit = document.getElementById("agEditTipo");
    if (tipoEdit) {
      tipoEdit.addEventListener("change", syncResponsavelEdit);
    }

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (modals.editOpen) closeEditModal();
      else if (modals.deleteOpen) closeDeleteModal();
    });
  }

  function onAction(id, tipo) {
    if (tipo === "edit") {
      openEditModal(id);
      return;
    }
    openDeleteModal(id);
  }

  function renderTable() {
    var body = document.getElementById("agendamentosBody");
    if (!body) return;

    var slice = pageSlice();
    if (!slice.length) {
      body.innerHTML =
        '<tr><td colspan="6" class="plat-ag-empty">Nenhum agendamento corresponde aos filtros.</td></tr>';
      return;
    }

    body.innerHTML = slice
      .map(function (a) {
        var nomeEcoponto = rotuloNomeEcoponto(a);
        var formaColeta = rotuloFormaColeta(a);
        return (
          '<tr data-id="' +
          escHtml(a.id_agendamento) +
          '">' +
          '<td><div class="plat-ag-user">' +
          '<span class="plat-ag-user__avatar" aria-hidden="true">' +
          escHtml(origemInitials(nomeEcoponto, a.tipo)) +
          "</span>" +
          "<span>" +
          '<span class="plat-ag-origem__nome">' +
          escHtml(nomeEcoponto) +
          "</span>" +
          '<span class="plat-ag-origem__tipo">' +
          escHtml(formaColeta) +
          "</span></span></div></td>" +
          "<td>" +
          escHtml(a.bairro || "—") +
          "</td>" +
          "<td>" +
          escHtml(a.horario_solicitacao || "—") +
          "</td>" +
          "<td>" +
          escHtml(a.responsavel || "—") +
          "</td>" +
          "<td>" +
          statusBadge(a.status) +
          '</td><td class="plat-ag-actions">' +
          '<button type="button" class="plat-icon-btn" data-edit="' +
          escHtml(a.id_agendamento) +
          '" aria-label="Editar agendamento de ' +
          escHtml(nomeEcoponto) +
          '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>' +
          '<button type="button" class="plat-icon-btn plat-icon-btn--danger" data-del="' +
          escHtml(a.id_agendamento) +
          '" aria-label="Excluir agendamento"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>' +
          "</td></tr>"
        );
      })
      .join("");

    body.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        onAction(btn.getAttribute("data-edit"), "edit");
      });
    });
    body.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        onAction(btn.getAttribute("data-del"), "del");
      });
    });
  }

  function setupFilters() {
    var search = document.getElementById("agSearch");
    var status = document.getElementById("agFilterStatus");
    var bairro = document.getElementById("agFilterBairro");

    if (search) {
      search.addEventListener("input", applyFilters);
    }
    if (status) {
      status.addEventListener("change", applyFilters);
    }
    if (bairro) {
      bairro.addEventListener("change", applyFilters);
    }

    var btnNovo = document.getElementById("btnNovoAgendamento");
    if (btnNovo) {
      btnNovo.addEventListener("click", function () {
        window.alert("Cadastro de agendamentos pelo painel estará disponível em breve.");
      });
    }

    var btnExportar = document.getElementById("btnExportar");
    if (btnExportar) {
      btnExportar.addEventListener("click", exportarAgendamentos);
    }
  }

  function exportarAgendamentos() {
    if (!window.EcocoletaExport) {
      window.alert("Módulo de exportação não carregado. Recarregue a página.");
      return;
    }
    if (!agendamentos.length) {
      window.alert("Não há agendamentos para exportar com os filtros atuais.");
      return;
    }

    var Ex = window.EcocoletaExport;
    var rows = agendamentos.map(function (a) {
      return [
        rotuloNomeEcoponto(a),
        rotuloFormaColeta(a),
        a.bairro || "—",
        a.horario_solicitacao || "—",
        a.responsavel || "—",
        statusLabel(a.status),
      ];
    });

    Ex.downloadExcel("agendamentos_plataforma_" + Ex.timestamp(), [
      {
        heading: "EcoColeta — Agendamentos",
        rows: [
          ["Total exportado", String(rows.length)],
          ["Filtro status", document.getElementById("agFilterStatus")?.value || "Todos"],
          ["Filtro bairro", document.getElementById("agFilterBairro")?.value || "Todos"],
        ],
      },
      {
        heading: "Lista de agendamentos",
        headers: [
          "Origem",
          "Tipo",
          "Bairro",
          "Data / horário",
          "Responsável",
          "Status",
        ],
        rows: rows,
      },
    ]);
  }

  function onDataLoaded(data) {
    agendamentosAll = Array.isArray(data.agendamentos) ? data.agendamentos : [];
    updateKpis(data.resumo || resumoFromList(agendamentosAll));
    populateBairroFilter();
    applyFilters();
  }

  function onLoadError(err) {
    var body = document.getElementById("agendamentosBody");
    if (body) {
      body.innerHTML =
        '<tr><td colspan="6" class="plat-ag-empty">' +
        escHtml(err.message || "Erro ao carregar.") +
        "</td></tr>";
    }
  }

  function init() {
    setupFilters();
    setupModals();

    if (!window.PlatAdmShell || typeof window.PlatAdmShell.init !== "function") {
      document.documentElement.classList.remove("plat-auth-checking");
      loadAgendamentos(false).then(onDataLoaded).catch(onLoadError);
      return;
    }

    window.PlatAdmShell.init()
      .then(function () {
        return loadAgendamentos(false);
      })
      .then(onDataLoaded)
      .catch(function (err) {
        if (err && err.message === "sessao") {
          return;
        }
        onLoadError(err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
