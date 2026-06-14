(function () {
  "use strict";

  var PAGE_SIZE = 8;
  var ADMIN_ID_OFFSET = 900000;
  var usuarios = [];
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

  function resumoFromList(list) {
    var admins = 0;
    var ativos = 0;
    list.forEach(function (u) {
      if (u.tipo === "admin") admins++;
      if (u.status === "ativo") ativos++;
    });
    return { total: list.length, administradores: admins, ativos: ativos };
  }

  function apiUrl() {
    return window.ecocoletaPhpUrl
      ? window.ecocoletaPhpUrl("listar-usuarios-adm.php")
      : "api/listar-usuarios-adm.php";
  }

  function phpUrl(path) {
    return window.ecocoletaPhpUrl ? window.ecocoletaPhpUrl(path) : "api/" + path;
  }

  function parseJsonResponse(text) {
    var raw = String(text).replace(/^\uFEFF/, "").trim();
    return JSON.parse(raw.indexOf("{") >= 0 ? raw.slice(raw.indexOf("{")) : raw);
  }

  function isPlataformaAdmin(u) {
    if (!u) return false;
    if (u.origem === "plataforma") return true;
    return parseInt(u.id_usuario, 10) >= ADMIN_ID_OFFSET;
  }

  function findUsuario(id) {
    var n = parseInt(id, 10);
    if (!n) return null;
    return (
      usuarios.find(function (u) {
        return parseInt(u.id_usuario, 10) === n;
      }) || null
    );
  }

  function setBodyModalLock(open) {
    document.body.classList.toggle("plat-us-modal-open", !!open);
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

  function loadUsuarios() {
    return fetch(apiUrl(), { credentials: "same-origin", cache: "no-store" })
      .then(function (r) {
        return r.text();
      })
      .then(function (text) {
        var data = parseJsonResponse(text);
        if (!data || data.sucesso !== true) {
          throw new Error((data && data.erro) || "Não foi possível carregar os usuários.");
        }
        return data;
      });
  }

  function tipoBadge(tipo, label) {
    var cls = tipo === "admin" ? "plat-us-badge--admin" : "plat-us-badge--usuario";
    var text = label || (tipo === "admin" ? "Admin" : "Usuário");
    return '<span class="plat-us-badge ' + cls + '">' + escHtml(text) + "</span>";
  }

  function statusBadge(status, label) {
    var cls = status === "inativo" ? "plat-us-badge--inativo" : "plat-us-badge--ativo";
    var text = label || (status === "inativo" ? "Inativo" : "Ativo");
    return '<span class="plat-us-badge ' + cls + '">' + escHtml(text) + "</span>";
  }

  function updateKpis(resumo) {
    var total = document.getElementById("kpiTotal");
    var admins = document.getElementById("kpiAdministradores");
    var ativos = document.getElementById("kpiAtivos");
    if (total) total.textContent = String(resumo.total ?? 0);
    if (admins) admins.textContent = String(resumo.administradores ?? 0);
    if (ativos) ativos.textContent = String(resumo.ativos ?? 0);
  }

  function totalPages() {
    return Math.max(1, Math.ceil(usuarios.length / PAGE_SIZE));
  }

  function pageSlice() {
    var start = (currentPage - 1) * PAGE_SIZE;
    return usuarios.slice(start, start + PAGE_SIZE);
  }

  function renderPagination() {
    var nav = document.getElementById("usPagination");
    var info = document.getElementById("usPaginationInfo");
    if (!nav || !info) return;

    var total = usuarios.length;
    var pages = totalPages();
    if (currentPage > pages) currentPage = pages;

    var start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    var end = Math.min(currentPage * PAGE_SIZE, total);
    info.textContent =
      total === 0
        ? "Nenhum usuário encontrado"
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

  function openEditModal(id) {
    var el = document.getElementById("usModalEdit");
    var u = findUsuario(id);
    if (!el || !u) return;

    var tipoSelect = document.getElementById("usEditTipo");
    var hint = document.getElementById("usEditHint");
    var plataforma = isPlataformaAdmin(u);

    document.getElementById("usEditId").value = String(u.id_usuario);
    document.getElementById("usEditNome").value = u.nome || "";
    document.getElementById("usEditEmail").value = u.email || "";
    if (tipoSelect) {
      tipoSelect.value = u.tipo === "admin" ? "admin" : "usuario";
      tipoSelect.disabled = plataforma;
    }
    document.getElementById("usEditStatus").value = u.status === "inativo" ? "inativo" : "ativo";
    showModalError(document.getElementById("usEditError"), "");

    if (hint) {
      hint.textContent = plataforma
        ? "Administrador da plataforma: o tipo permanece Admin."
        : "Alterações são salvas no banco de dados da plataforma.";
    }

    el.classList.remove("hidden");
    modals.editOpen = true;
    setBodyModalLock(true);
    document.getElementById("usEditNome").focus();
  }

  function closeEditModal() {
    var el = document.getElementById("usModalEdit");
    if (el) el.classList.add("hidden");
    var tipoSelect = document.getElementById("usEditTipo");
    if (tipoSelect) tipoSelect.disabled = false;
    modals.editOpen = false;
    if (!modals.deleteOpen) setBodyModalLock(false);
  }

  function openDeleteModal(id) {
    var el = document.getElementById("usModalDelete");
    var u = findUsuario(id);
    if (!el || !u) return;

    modals.deleteId = parseInt(id, 10);
    var msgEl = document.getElementById("usDeleteMessage");
    if (msgEl) {
      msgEl.textContent =
        'Deseja excluir o usuário "' + (u.nome || "—") + '" (' + (u.email || "—") + ")?";
    }
    showModalError(document.getElementById("usDeleteError"), "");

    el.classList.remove("hidden");
    modals.deleteOpen = true;
    setBodyModalLock(true);
  }

  function closeDeleteModal() {
    var el = document.getElementById("usModalDelete");
    if (el) el.classList.add("hidden");
    modals.deleteOpen = false;
    modals.deleteId = 0;
    if (!modals.editOpen) setBodyModalLock(false);
  }

  function patchUsuario(updated) {
    var id = parseInt(updated.id_usuario, 10);
    usuarios = usuarios.map(function (u) {
      return parseInt(u.id_usuario, 10) === id ? updated : u;
    });
    usuarios.sort(function (a, b) {
      return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });
    updateKpis(resumoFromList(usuarios));
    renderTable();
    renderPagination();
  }

  function removeUsuario(id) {
    usuarios = usuarios.filter(function (u) {
      return parseInt(u.id_usuario, 10) !== id;
    });
    updateKpis(resumoFromList(usuarios));
    var pages = totalPages();
    if (currentPage > pages) currentPage = pages;
    renderTable();
    renderPagination();
  }

  function saveUsuario(ev) {
    ev.preventDefault();
    var btn = document.getElementById("usModalEditSave");
    var errEl = document.getElementById("usEditError");
    var tipoSelect = document.getElementById("usEditTipo");
    var payload = {
      id_usuario: parseInt(document.getElementById("usEditId").value, 10),
      nome: document.getElementById("usEditNome").value.trim(),
      email: document.getElementById("usEditEmail").value.trim(),
      tipo: tipoSelect && !tipoSelect.disabled ? tipoSelect.value : "admin",
      status: document.getElementById("usEditStatus").value,
    };

    if (btn) btn.disabled = true;
    showModalError(errEl, "");

    fetch(phpUrl("salvar-usuario-adm.php"), {
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
        patchUsuario(data.usuario);
        closeEditModal();
      })
      .catch(function (err) {
        showModalError(errEl, err.message || "Erro ao salvar.");
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function confirmDeleteUsuario() {
    var id = modals.deleteId;
    if (!id) return;

    var btn = document.getElementById("usModalDeleteConfirm");
    var errEl = document.getElementById("usDeleteError");
    if (btn) btn.disabled = true;
    showModalError(errEl, "");

    fetch(phpUrl("excluir-usuario-adm.php"), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_usuario: id }),
    })
      .then(function (r) {
        return r.text().then(parseJsonResponse);
      })
      .then(function (data) {
        if (!data || data.sucesso !== true) {
          throw new Error((data && data.erro) || "Não foi possível excluir.");
        }
        removeUsuario(id);
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
    var form = document.getElementById("usFormEdit");
    if (form) form.addEventListener("submit", saveUsuario);

    [
      ["usModalEditClose", closeEditModal],
      ["usModalEditCancel", closeEditModal],
      ["usModalEditBackdrop", closeEditModal],
      ["usModalDeleteClose", closeDeleteModal],
      ["usModalDeleteCancel", closeDeleteModal],
      ["usModalDeleteBackdrop", closeDeleteModal],
    ].forEach(function (pair) {
      var node = document.getElementById(pair[0]);
      if (node) node.addEventListener("click", pair[1]);
    });

    var confirmBtn = document.getElementById("usModalDeleteConfirm");
    if (confirmBtn) confirmBtn.addEventListener("click", confirmDeleteUsuario);

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
    var body = document.getElementById("usuariosBody");
    if (!body) return;

    var slice = pageSlice();
    if (!slice.length) {
      body.innerHTML =
        '<tr><td colspan="5" class="plat-us-empty">Nenhum usuário cadastrado.</td></tr>';
      return;
    }

    body.innerHTML = slice
      .map(function (u) {
        var nome = u.nome || "—";
        return (
          '<tr data-id="' +
          escHtml(u.id_usuario) +
          '">' +
          '<td><div class="plat-us-user">' +
          '<span class="plat-us-user__avatar" aria-hidden="true">' +
          escHtml(initials(nome)) +
          "</span>" +
          "<span>" +
          escHtml(nome) +
          "</span></div></td>" +
          '<td class="plat-us-email">' +
          escHtml(u.email || "—") +
          "</td>" +
          "<td>" +
          tipoBadge(u.tipo, u.tipo_label) +
          "</td>" +
          "<td>" +
          statusBadge(u.status, u.status_label) +
          '</td><td class="plat-us-actions">' +
          '<button type="button" class="plat-icon-btn" data-edit="' +
          escHtml(u.id_usuario) +
          '" aria-label="Editar usuário ' +
          escHtml(nome) +
          '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>' +
          '<button type="button" class="plat-icon-btn plat-icon-btn--danger" data-del="' +
          escHtml(u.id_usuario) +
          '" aria-label="Excluir usuário"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>' +
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

  function loadUsuariosUi() {
    return loadUsuarios()
      .then(function (data) {
        usuarios = Array.isArray(data.usuarios) ? data.usuarios : [];
        updateKpis(data.resumo || resumoFromList(usuarios));
        currentPage = 1;
        renderTable();
        renderPagination();
      })
      .catch(function (err) {
        var body = document.getElementById("usuariosBody");
        if (body) {
          body.innerHTML =
            '<tr><td colspan="5" class="plat-us-empty">' +
            escHtml(err.message || "Erro ao carregar.") +
            "</td></tr>";
        }
      });
  }

  function init() {
    setupModals();

    if (!window.PlatAdmShell || typeof window.PlatAdmShell.init !== "function") {
      document.documentElement.classList.remove("plat-auth-checking");
      loadUsuariosUi();
      return;
    }

    window.PlatAdmShell.init()
      .then(function () {
        return loadUsuariosUi();
      })
      .catch(function (err) {
        if (err && err.message === "sessao") {
          return;
        }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
