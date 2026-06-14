(function () {
  "use strict";

  var state = {
    saved: null,
    draft: null,
    dirty: false,
    regenerarApiKey: false,
  };

  var ROLE_META = {
    admin: { initial: "AD", className: "admin" },
    gerente: { initial: "GE", className: "gerente" },
    visualizador: { initial: "VI", className: "visualizador" },
  };

  var ROLE_MODAL = {
    admin: {
      title: "Permissões de administrador do sistema",
      icon: "shield",
    },
    gerente: {
      title: "Permissões de gerentes de Ecopontos",
      icon: "user",
    },
    visualizador: {
      title: "Permissões de visualizadores",
      icon: "eye",
    },
  };

  var PERM_ICONS = {
    shield:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    user:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/></svg>',
    eye:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  };

  var modalRoleId = null;
  var platAdminsCache = [];

  var els = {};

  function configApiUrl() {
    return window.ecocoletaPhpUrl
      ? window.ecocoletaPhpUrl("configuracoes-plataforma-adm.php")
      : "api/configuracoes-plataforma-adm.php";
  }

  function platAdminsApiUrl() {
    return window.ecocoletaPhpUrl
      ? window.ecocoletaPhpUrl("adm-plataforma-administradores.php")
      : "api/adm-plataforma-administradores.php";
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderPlatAdmins(lista) {
    platAdminsCache = lista || [];
    var ul = $("cfgPlatAdminsList");
    if (!ul) return;
    if (!platAdminsCache.length) {
      ul.innerHTML = '<li class="plat-config-admins-empty">Nenhum administrador cadastrado.</li>';
      return;
    }
    ul.innerHTML = platAdminsCache
      .map(function (adm) {
        var id = adm.id_admin;
        var nome = escHtml(adm.nome || "—");
        var email = escHtml(adm.email || "—");
        var cargo = escHtml(adm.cargo_label || adm.cargo || "—");
        var ini = escHtml(adm.iniciais || "AD");
        var dis = adm.is_self ? " disabled" : "";
        return (
          '<li class="plat-config-admin-item" data-admin-id="' +
          id +
          '">' +
          '<span class="plat-config-admin-avatar" aria-hidden="true">' +
          ini +
          "</span>" +
          '<div class="plat-config-admin-meta"><strong>' +
          nome +
          "</strong><span>" +
          email +
          '</span><span class="plat-config-admin-role">' +
          cargo +
          "</span></div>" +
          '<div class="plat-config-admin-actions">' +
          '<button type="button" class="plat-btn plat-btn--ghost plat-btn--sm" data-plat-admin-action="edit" data-admin-id="' +
          id +
          '">Editar</button>' +
          '<button type="button" class="plat-btn plat-btn--danger plat-btn--sm" data-plat-admin-action="delete" data-admin-id="' +
          id +
          '"' +
          dis +
          ">Remover</button></div></li>"
        );
      })
      .join("");
  }

  function openPlatAdminModal(adm) {
    var modal = $("cfgModalPlatAdmin");
    if (!modal) return;
    var edit = Boolean(adm && adm.id_admin);
    var title = $("cfgModalPlatAdminTitle");
    if (title) title.textContent = edit ? "Editar administrador" : "Novo administrador";
    $("cfgPlatAdminId").value = edit ? String(adm.id_admin) : "";
    $("cfgPlatAdminNome").value = edit ? adm.nome || "" : "";
    $("cfgPlatAdminEmail").value = edit ? adm.email || "" : "";
    $("cfgPlatAdminCargo").value = edit ? adm.cargo || "" : "Administrador da plataforma";
    $("cfgPlatAdminSenha").value = "";
    modal.classList.remove("hidden");
    document.body.classList.add("plat-modal-open");
  }

  function closePlatAdminModal() {
    var modal = $("cfgModalPlatAdmin");
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.classList.remove("plat-modal-open");
  }

  function savePlatAdmin(event) {
    if (event) event.preventDefault();
    var id = parseInt($("cfgPlatAdminId").value, 10);
    var payload = {
      id_admin: id > 0 ? id : undefined,
      nome: $("cfgPlatAdminNome").value.trim(),
      email: $("cfgPlatAdminEmail").value.trim(),
      cargo: $("cfgPlatAdminCargo").value.trim(),
      senha: $("cfgPlatAdminSenha").value,
    };
    fetch(platAdminsApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(function (r) {
        return r.text();
      })
      .then(function (text) {
        var data = parseJsonResponse(text);
        if (!data || data.sucesso !== true) {
          throw new Error((data && data.erro) || "Não foi possível salvar.");
        }
        renderPlatAdmins(data.administradores || []);
        closePlatAdminModal();
        toast(data.mensagem || "Administrador salvo.", "success");
      })
      .catch(function (err) {
        toast(err.message || "Erro ao salvar administrador.", "error");
      });
  }

  function deletePlatAdmin(id) {
    if (!window.confirm("Remover este administrador da plataforma?")) return;
    fetch(platAdminsApiUrl(), {
      method: "DELETE",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
      body: JSON.stringify({ id_admin: id }),
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(function (r) {
        return r.text();
      })
      .then(function (text) {
        var data = parseJsonResponse(text);
        if (!data || data.sucesso !== true) {
          throw new Error((data && data.erro) || "Não foi possível remover.");
        }
        renderPlatAdmins(data.administradores || []);
        toast(data.mensagem || "Administrador removido.", "success");
      })
      .catch(function (err) {
        toast(err.message || "Erro ao remover.", "error");
      });
  }

  function setupPlatAdminsUi() {
    var btnAdd = $("btnAddPlatAdmin");
    if (btnAdd) {
      btnAdd.addEventListener("click", function () {
        openPlatAdminModal(null);
      });
    }
    var form = $("cfgPlatAdminForm");
    if (form) {
      form.addEventListener("submit", savePlatAdmin);
    }
    var list = $("cfgPlatAdminsList");
    if (list) {
      list.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-plat-admin-action]");
        if (!btn || btn.disabled) return;
        var id = parseInt(btn.getAttribute("data-admin-id") || "0", 10);
        if (id <= 0) return;
        var adm = platAdminsCache.find(function (a) {
          return a.id_admin === id;
        });
        var action = btn.getAttribute("data-plat-admin-action");
        if (action === "edit") openPlatAdminModal(adm || { id_admin: id });
        else if (action === "delete") deletePlatAdmin(id);
      });
    }
  }

  function parseJsonResponse(text) {
    var raw = String(text || "").replace(/^\uFEFF/, "").trim();
    var start = raw.indexOf("{");
    return JSON.parse(start >= 0 ? raw.slice(start) : raw);
  }

  function $(id) {
    return document.getElementById(id);
  }

  function bindEls() {
    els = {
      authError: $("configAuthError"),
      loading: $("cfgLoading"),
      grid: $("cfgGrid"),
      statusBadge: $("cfgStatusBadge"),
      statusText: $("cfgStatusText"),
      nomeSite: $("cfgNomeSite"),
      emailContato: $("cfgEmailContato"),
      temaLight: $("cfgTemaLight"),
      temaDark: $("cfgTemaDark"),
      rolesList: $("cfgRolesList"),
      notifColetas: $("cfgNotifColetas"),
      notifEcopontos: $("cfgNotifEcopontos"),
      notifRelatorios: $("cfgNotifRelatorios"),
      notifAtualizacoes: $("cfgNotifAtualizacoes"),
      apiKey: $("cfgApiKey"),
      recaptchaAtivo: $("cfgRecaptchaAtivo"),
      recaptchaBadge: $("cfgRecaptchaBadge"),
      recaptchaSite: $("cfgRecaptchaSite"),
      recaptchaSecret: $("cfgRecaptchaSecret"),
      toggleSecret: $("cfgToggleSecret"),
      badge2fa: $("cfg2faBadge"),
      savebar: $("cfgSavebar"),
      cancel: $("cfgCancel"),
      save: $("cfgSave"),
      toast: $("cfgToast"),
      modalSessoes: $("cfgModalSessoes"),
      sessoesList: $("cfgSessoesList"),
      modalPerm: $("cfgModalPerm"),
      permIcon: $("cfgPermIcon"),
      permTitle: $("cfgModalPermTitle"),
      permList: $("cfgPermList"),
      permSave: $("cfgPermSave"),
      modalSenha: $("cfgModalSenha"),
      senhaForm: $("cfgSenhaForm"),
      senhaAtual: $("cfgSenhaAtual"),
      senhaNova: $("cfgSenhaNova"),
      senhaConfirmar: $("cfgSenhaConfirmar"),
      senhaSubmit: $("cfgSenhaSubmit"),
      senhaFormError: $("cfgSenhaFormError"),
    };
  }

  function senhaApiUrl() {
    return window.ecocoletaPhpUrl
      ? window.ecocoletaPhpUrl("alterar-senha-plataforma-adm.php")
      : "api/alterar-senha-plataforma-adm.php";
  }

  function atualizarAdminNaLista(admin) {
    if (!admin || !admin.id_admin) return;
    var selfId = admin.id_admin;
    platAdminsCache = platAdminsCache.map(function (adm) {
      if (adm.id_admin !== selfId) return adm;
      return Object.assign({}, adm, {
        nome: admin.nome,
        email: admin.email,
        cargo: admin.cargo,
        cargo_label: admin.cargo_label || admin.cargo,
        iniciais: admin.iniciais || adm.iniciais,
      });
    });
    renderPlatAdmins(platAdminsCache);
  }

  function clearSenhaErrors() {
    ["cfgSenhaAtualError", "cfgSenhaNovaError", "cfgSenhaConfirmarError", "cfgSenhaFormError"].forEach(
      function (id) {
        var el = $(id);
        if (!el) return;
        el.textContent = "";
        el.classList.add("hidden");
      }
    );
    [els.senhaAtual, els.senhaNova, els.senhaConfirmar].forEach(function (input) {
      if (input) input.removeAttribute("aria-invalid");
    });
  }

  function setSenhaFieldError(inputId, errorId, msg) {
    var input = $(inputId);
    var err = $(errorId);
    if (err) {
      err.textContent = msg;
      err.classList.remove("hidden");
    }
    if (input) input.setAttribute("aria-invalid", "true");
  }

  function resetSenhaForm() {
    if (!els.senhaForm && !$("cfgSenhaForm")) return;
    clearSenhaErrors();
    if (els.senhaForm) els.senhaForm.reset();
  }

  function openSenhaModal() {
    resetSenhaForm();
    openModal("cfgModalSenha");
    if (els.senhaAtual) {
      window.setTimeout(function () {
        els.senhaAtual.focus();
      }, 80);
    }
  }

  function validarSenhaForm() {
    clearSenhaErrors();
    var atual = els.senhaAtual ? els.senhaAtual.value : "";
    var nova = els.senhaNova ? els.senhaNova.value : "";
    var conf = els.senhaConfirmar ? els.senhaConfirmar.value : "";
    var ok = true;

    if (!atual) {
      setSenhaFieldError("cfgSenhaAtual", "cfgSenhaAtualError", "Informe a senha atual.");
      ok = false;
    }
    if (!nova) {
      setSenhaFieldError("cfgSenhaNova", "cfgSenhaNovaError", "Informe a nova senha.");
      ok = false;
    } else if (nova.length < 8) {
      setSenhaFieldError("cfgSenhaNova", "cfgSenhaNovaError", "Mínimo de 8 caracteres.");
      ok = false;
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(nova)) {
      setSenhaFieldError(
        "cfgSenhaNova",
        "cfgSenhaNovaError",
        "Use maiúscula, minúscula e número."
      );
      ok = false;
    }
    if (!conf) {
      setSenhaFieldError("cfgSenhaConfirmar", "cfgSenhaConfirmarError", "Confirme a nova senha.");
      ok = false;
    } else if (nova && conf !== nova) {
      setSenhaFieldError("cfgSenhaConfirmar", "cfgSenhaConfirmarError", "As senhas não coincidem.");
      ok = false;
    }
    if (atual && nova && atual === nova) {
      setSenhaFieldError("cfgSenhaNova", "cfgSenhaNovaError", "A nova senha deve ser diferente da atual.");
      ok = false;
    }

    return ok;
  }

  function submitSenhaForm(e) {
    if (e) e.preventDefault();
    if (!validarSenhaForm()) return;

    if (els.senhaSubmit) els.senhaSubmit.disabled = true;
    if (els.senhaFormError) els.senhaFormError.classList.add("hidden");

    fetch(senhaApiUrl(), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senha_atual: els.senhaAtual.value,
        senha_nova: els.senhaNova.value,
        senha_confirmar: els.senhaConfirmar.value,
      }),
    })
      .then(function (r) {
        return r.text().then(function (text) {
          return { ok: r.ok, data: parseJsonResponse(text) };
        });
      })
      .then(function (res) {
        if (!res.ok || res.data.sucesso !== true) {
          throw new Error(res.data.mensagem || res.data.erro || "Não foi possível alterar a senha.");
        }
        resetSenhaForm();
        closeModal("cfgModalSenha");
        toast(res.data.mensagem || "Senha alterada com sucesso.", "success");
      })
      .catch(function (err) {
        if (els.senhaFormError) {
          els.senhaFormError.textContent = err.message || "Erro ao alterar senha.";
          els.senhaFormError.classList.remove("hidden");
        } else {
          toast(err.message || "Erro ao alterar senha.", "error");
        }
      })
      .finally(function () {
        if (els.senhaSubmit) els.senhaSubmit.disabled = false;
      });
  }

  function permItemsForRole(roleId) {
    if (roleId === "visualizador") {
      return [
        { key: "visualizar_ecopontos", label: "Visualizar Ecopontos" },
        { key: "visualizar_relatorios", label: "Visualizar relatórios" },
        { key: "excluir_usuarios", label: "Excluir usuários" },
        { key: "editar_usuarios", label: "Editar usuários" },
        { key: "configuracoes_sistema", label: "Configurações do sistema" },
      ];
    }
    return [
      { key: "criar_usuarios", label: "Criar usuários" },
      { key: "editar_usuarios", label: "Editar usuários" },
      { key: "excluir_usuarios", label: "Excluir usuários" },
      { key: "gerenciar_ecopontos", label: "Gerenciar ecopontos" },
      { key: "visualizar_relatorios", label: "Visualizar relatórios" },
      { key: "configuracoes_sistema", label: "Configurações do sistema" },
    ];
  }

  function setModalOpen(open) {
    document.body.classList.toggle("plat-config-modal-open", !!open);
  }

  function openModal(id) {
    var el = $(id);
    if (!el) return;
    el.classList.remove("hidden");
    setModalOpen(true);
  }

  function closeModal(id) {
    var el = $(id);
    if (!el) return;
    el.classList.add("hidden");
    if (!document.querySelector(".plat-config-modal:not(.hidden)")) {
      setModalOpen(false);
    }
    if (id === "cfgModalPerm") modalRoleId = null;
    if (id === "cfgModalSenha") resetSenhaForm();
  }

  function closeAllModals() {
    document.querySelectorAll(".plat-config-modal").forEach(function (m) {
      m.classList.add("hidden");
    });
    setModalOpen(false);
    modalRoleId = null;
  }

  function sessionDeviceIcon(tipo) {
    if (tipo === "mobile") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>';
  }

  function getSessoes() {
    if (!state.draft) return [];
    var seg = state.draft.seguranca || {};
    return Array.isArray(seg.sessoes) ? seg.sessoes : [];
  }

  function setSessoes(lista) {
    if (!state.draft) state.draft = cloneConfig(state.saved);
    state.draft.seguranca = state.draft.seguranca || {};
    state.draft.seguranca.sessoes = lista;
  }

  function renderSessoesModal() {
    if (!els.sessoesList) return;
    var sessoes = getSessoes();
    if (!sessoes.length) {
      els.sessoesList.innerHTML =
        '<li class="plat-config-sessions__empty">Nenhuma sessão ativa no momento.</li>';
      return;
    }

    els.sessoesList.innerHTML = sessoes
      .map(function (s) {
        var atual = !!s.atual;
        var hora = escapeHtml(s.ultima_atividade || "—");
        var rotulo = escapeHtml(s.rotulo || "Dispositivo");
        var id = escapeHtml(s.id || "");
        return (
          '<li class="plat-config-session">' +
          '<button type="button" class="plat-config-session__main' +
          (atual ? " is-current" : "") +
          '" data-session-id="' +
          id +
          '" data-session-rename>' +
          '<span class="plat-config-session__icon" aria-hidden="true">' +
          sessionDeviceIcon(s.tipo) +
          "</span>" +
          '<span class="plat-config-session__text">' +
          "<strong>" +
          rotulo +
          "</strong>" +
          "<span>Última sessão ativa às " +
          hora +
          "</span>" +
          (atual ? '<span class="plat-config-session__badge">Sessão atual</span>' : "") +
          "</span></button>" +
          '<button type="button" class="plat-config-session__disconnect" data-session-disconnect="' +
          id +
          '">Desconectar</button></li>'
        );
      })
      .join("");
  }

  function openSessoesModal() {
    renderSessoesModal();
    openModal("cfgModalSessoes");
  }

  function renderPermModal(roleId) {
    if (!els.permList || !roleId) return;
    if (!state.draft) state.draft = cloneConfig(state.saved);
    state.draft.permissoes = state.draft.permissoes || cloneConfig(state.saved).permissoes || {};

    var meta = ROLE_MODAL[roleId] || ROLE_MODAL.admin;
    if (els.permTitle) els.permTitle.textContent = meta.title;
    if (els.permIcon) els.permIcon.innerHTML = PERM_ICONS[meta.icon] || PERM_ICONS.shield;

    var rolePerms = state.draft.permissoes[roleId] || {};
    var items = permItemsForRole(roleId);

    els.permList.innerHTML = items
      .map(function (item) {
        var on = !!rolePerms[item.key];
        return (
          "<li>" +
          "<span>" +
          escapeHtml(item.label) +
          "</span>" +
          '<label class="plat-config-toggle">' +
          '<input type="checkbox" data-perm-key="' +
          escapeHtml(item.key) +
          '"' +
          (on ? " checked" : "") +
          ">" +
          '<span class="plat-config-toggle__track" aria-hidden="true"></span>' +
          "</label></li>"
        );
      })
      .join("");
  }

  function openPermModal(roleId) {
    modalRoleId = roleId;
    renderPermModal(roleId);
    openModal("cfgModalPerm");
  }

  function applyPermModalToggles() {
    if (!modalRoleId || !els.permList) return;
    if (!state.draft) state.draft = cloneConfig(state.saved);
    state.draft.permissoes = state.draft.permissoes || {};
    state.draft.permissoes[modalRoleId] = state.draft.permissoes[modalRoleId] || {};

    els.permList.querySelectorAll("[data-perm-key]").forEach(function (input) {
      var key = input.getAttribute("data-perm-key");
      if (key) state.draft.permissoes[modalRoleId][key] = input.checked;
    });
  }

  function setLoading(on) {
    if (els.loading) els.loading.classList.toggle("hidden", !on);
    if (els.grid) {
      if (on) els.grid.setAttribute("hidden", "");
      else els.grid.removeAttribute("hidden");
    }
  }

  function showAuthError(msg) {
    if (!els.authError) return;
    els.authError.textContent = msg;
    els.authError.classList.remove("hidden");
    setLoading(false);
    document.documentElement.classList.remove("plat-auth-checking");
  }

  function toast(msg, type) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.remove("plat-config-toast--error", "plat-config-toast--success");
    if (type === "error") els.toast.classList.add("plat-config-toast--error");
    else if (type === "success") els.toast.classList.add("plat-config-toast--success");
    els.toast.classList.add("is-visible");
    clearTimeout(els.toast._timer);
    els.toast._timer = setTimeout(function () {
      els.toast.classList.remove("is-visible");
    }, 3400);
  }

  function cloneConfig(cfg) {
    return JSON.parse(JSON.stringify(cfg || {}));
  }

  function applyTemaPreview(tema) {
    var modo = tema === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-plat-tema", modo);
    try {
      localStorage.setItem("ecocoletaPlatTema", modo);
    } catch (e) {

    }
  }

  function updateTemaButtons(tema) {
    if (!els.temaLight || !els.temaDark) return;
    els.temaLight.classList.toggle("is-active", tema === "light");
    els.temaDark.classList.toggle("is-active", tema === "dark");
  }

  function setBadgeState(el, ativo) {
    if (!el) return;
    el.textContent = ativo ? "Ativo" : "Inativo";
    el.classList.toggle("plat-config-badge--on", !!ativo);
  }

  function updateSyncStatus(mode) {
    if (!els.statusBadge) return;
    els.statusBadge.classList.remove("is-pending", "is-saving");
    var label = "Sincronizado";
    if (mode === "pending") {
      els.statusBadge.classList.add("is-pending");
      label = "Alterações pendentes";
    } else if (mode === "saving") {
      els.statusBadge.classList.add("is-saving");
      label = "Salvando…";
    }
    if (els.statusText) els.statusText.textContent = label;
  }

  function renderRoles(funcoes) {
    if (!els.rolesList) return;
    var list = Array.isArray(funcoes) ? funcoes : [];
    if (!list.length) {
      els.rolesList.innerHTML =
        '<li class="plat-config-roles__empty">Nenhuma função cadastrada no momento.</li>';
      return;
    }

    els.rolesList.innerHTML = list
      .map(function (role) {
        var id = String(role.id || "");
        var meta = ROLE_META[id] || { initial: "?", className: "" };
        var total = parseInt(role.total, 10) || 0;
        var label = total === 1 ? "1 usuário" : total + " usuários";
        var avatarClass =
          "plat-config-role__avatar" +
          (meta.className ? " plat-config-role__avatar--" + meta.className : "");

        return (
          '<li>' +
          '<button type="button" class="plat-config-role" data-role-id="' +
          escapeHtml(id) +
          '">' +
          '<span class="' +
          avatarClass +
          '" aria-hidden="true">' +
          escapeHtml(meta.initial) +
          "</span>" +
          '<span class="plat-config-role__body">' +
          "<strong>" +
          escapeHtml(role.titulo || "") +
          "</strong>" +
          "<span>" +
          escapeHtml(role.descricao || "") +
          "</span>" +
          "</span>" +
          '<span class="plat-config-badge">' +
          escapeHtml(label) +
          "</span>" +
          '<span class="plat-config-role__chevron" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>' +
          "</span>" +
          "</button></li>"
        );
      })
      .join("");
  }

  function escapeHtml(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readFormIntoDraft() {
    if (!state.draft) state.draft = cloneConfig(state.saved);

    state.draft.geral = state.draft.geral || {};
    state.draft.geral.nome_site = (els.nomeSite && els.nomeSite.value.trim()) || "";
    state.draft.geral.email_contato = (els.emailContato && els.emailContato.value.trim()) || "";
    state.draft.geral.tema =
      els.temaDark && els.temaDark.classList.contains("is-active") ? "dark" : "light";

    state.draft.notificacoes = state.draft.notificacoes || {};
    state.draft.notificacoes.coletas_agendadas = !!(els.notifColetas && els.notifColetas.checked);
    state.draft.notificacoes.ecopontos_problemas = !!(els.notifEcopontos && els.notifEcopontos.checked);
    state.draft.notificacoes.relatorios_semanais = !!(els.notifRelatorios && els.notifRelatorios.checked);
    state.draft.notificacoes.atualizacoes_sistema = !!(els.notifAtualizacoes && els.notifAtualizacoes.checked);

    state.draft.integracoes = state.draft.integracoes || {};
    state.draft.integracoes.recaptcha_ativo = !!(els.recaptchaAtivo && els.recaptchaAtivo.checked);
    state.draft.integracoes.recaptcha_site_key =
      (els.recaptchaSite && els.recaptchaSite.value.trim()) || "";
    if (els.recaptchaSecret && els.recaptchaSecret.value.trim() !== "") {
      state.draft.integracoes.recaptcha_secret_key = els.recaptchaSecret.value.trim();
    }
  }

  function ensureDraftPermissoes() {
    if (!state.draft) state.draft = cloneConfig(state.saved);
    if (!state.draft.permissoes && state.saved && state.saved.permissoes) {
      state.draft.permissoes = cloneConfig(state.saved.permissoes);
    }
  }

  function paintForm(cfg) {
    var g = cfg.geral || {};
    var n = cfg.notificacoes || {};
    var i = cfg.integracoes || {};
    var s = cfg.seguranca || {};

    if (els.nomeSite) els.nomeSite.value = g.nome_site || "";
    if (els.emailContato) els.emailContato.value = g.email_contato || "";

    var tema = g.tema === "dark" ? "dark" : "light";
    updateTemaButtons(tema);
    applyTemaPreview(tema);

    if (els.notifColetas) els.notifColetas.checked = !!n.coletas_agendadas;
    if (els.notifEcopontos) els.notifEcopontos.checked = !!n.ecopontos_problemas;
    if (els.notifRelatorios) els.notifRelatorios.checked = !!n.relatorios_semanais;
    if (els.notifAtualizacoes) els.notifAtualizacoes.checked = !!n.atualizacoes_sistema;

    if (els.apiKey) els.apiKey.value = i.api_key || "";
    if (els.recaptchaAtivo) els.recaptchaAtivo.checked = !!i.recaptcha_ativo;
    if (els.recaptchaSite) els.recaptchaSite.value = i.recaptcha_site_key || "";
    if (els.recaptchaSecret) els.recaptchaSecret.value = i.recaptcha_secret_key || "";
    setBadgeState(els.recaptchaBadge, !!i.recaptcha_ativo);
    setBadgeState(els.badge2fa, !!s.dois_fatores);
  }

  function setDirty(flag) {
    state.dirty = !!flag;
    if (els.savebar) {
      if (state.dirty) els.savebar.removeAttribute("hidden");
      else els.savebar.setAttribute("hidden", "");
    }
    updateSyncStatus(state.dirty ? "pending" : "synced");
  }

  function markDirty() {
    readFormIntoDraft();
    setDirty(true);
  }

  function loadConfig() {
    setLoading(true);
    return fetch(configApiUrl(), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(function (r) {
        return r.text().then(function (text) {
          return { ok: r.ok, data: parseJsonResponse(text) };
        });
      })
      .then(function (res) {
        if (!res.ok || res.data.sucesso !== true) {
          throw new Error(res.data.mensagem || res.data.erro || "Não foi possível carregar.");
        }
        state.saved = cloneConfig(res.data.config);
        state.draft = cloneConfig(res.data.config);
        state.regenerarApiKey = false;
        paintForm(state.saved);
        renderRoles(res.data.funcoes);
        renderPlatAdmins(res.data.administradores || []);
        setDirty(false);
        setLoading(false);
      })
      .catch(function (err) {
        setLoading(false);
        throw err;
      });
  }

  function buildPayload() {
    readFormIntoDraft();
    ensureDraftPermissoes();

    var payload = {
      geral: state.draft.geral,
      notificacoes: state.draft.notificacoes,
      integracoes: {
        recaptcha_ativo: state.draft.integracoes.recaptcha_ativo,
        recaptcha_site_key: state.draft.integracoes.recaptcha_site_key,
      },
      seguranca: {
        dois_fatores: !!(state.draft.seguranca && state.draft.seguranca.dois_fatores),
        sessoes: getSessoes(),
      },
      permissoes: state.draft.permissoes || {},
    };

    if (state.draft.integracoes.recaptcha_secret_key) {
      payload.integracoes.recaptcha_secret_key = state.draft.integracoes.recaptcha_secret_key;
    }
    if (state.regenerarApiKey) {
      payload.integracoes.regenerar_api_key = true;
    }
    return payload;
  }

  function saveConfig() {
    if (!state.dirty && !state.regenerarApiKey) return;

    if (els.save) els.save.disabled = true;
    updateSyncStatus("saving");

    fetch(configApiUrl(), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    })
      .then(function (r) {
        return r.text().then(function (text) {
          return { ok: r.ok, data: parseJsonResponse(text) };
        });
      })
      .then(function (res) {
        if (!res.ok || res.data.sucesso !== true) {
          throw new Error(res.data.mensagem || res.data.erro || "Falha ao salvar.");
        }
        state.saved = cloneConfig(res.data.config);
        state.draft = cloneConfig(res.data.config);
        state.regenerarApiKey = false;
        paintForm(state.saved);
        renderRoles(res.data.funcoes);
        setDirty(false);
        toast(res.data.mensagem || "Configurações salvas com sucesso.", "success");
      })
      .catch(function (err) {
        updateSyncStatus("pending");
        toast(err.message || "Erro ao salvar.", "error");
      })
      .finally(function () {
        if (els.save) els.save.disabled = false;
      });
  }

  function discardChanges() {
    state.draft = cloneConfig(state.saved);
    state.regenerarApiKey = false;
    paintForm(state.saved);
    setDirty(false);
    closeAllModals();
    toast("Alterações descartadas.", "success");
  }

  function copyField(id) {
    var input = $(id);
    if (!input || !input.value) {
      toast("Nada para copiar.", "error");
      return;
    }
    var text = input.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          toast("Copiado para a área de transferência.", "success");
        })
        .catch(function () {
          fallbackCopy(input);
        });
    } else {
      fallbackCopy(input);
    }
  }

  function fallbackCopy(input) {
    input.select();
    try {
      document.execCommand("copy");
      toast("Copiado para a área de transferência.", "success");
    } catch (e) {
      toast("Não foi possível copiar.", "error");
    }
  }

  function setupModalEvents() {
    document.querySelectorAll("[data-close-modal]").forEach(function (el) {
      el.addEventListener("click", function () {
        closeModal(el.getAttribute("data-close-modal"));
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAllModals();
    });

    if (els.senhaForm) {
      els.senhaForm.addEventListener("submit", submitSenhaForm);
    }

    if (els.sessoesList) {
      els.sessoesList.addEventListener("click", function (e) {
        var disconnect = e.target.closest("[data-session-disconnect]");
        if (disconnect) {
          var discId = disconnect.getAttribute("data-session-disconnect");
          var lista = getSessoes();
          var alvo = lista.find(function (s) {
            return s.id === discId;
          });
          if (alvo && alvo.atual) {
            toast("Não é possível desconectar a sessão atual deste navegador.", "error");
            return;
          }
          setSessoes(
            lista.filter(function (s) {
              return s.id !== discId;
            })
          );
          renderSessoesModal();
          markDirty();
          toast("Sessão desconectada.", "success");
          return;
        }

        var renameBtn = e.target.closest("[data-session-rename]");
        if (!renameBtn) return;
        var sid = renameBtn.getAttribute("data-session-id");
        var sessoes = getSessoes();
        var sess = sessoes.find(function (s) {
          return s.id === sid;
        });
        if (!sess) return;
        var novo = window.prompt("Nome desta sessão:", sess.rotulo || "");
        if (novo === null) return;
        novo = novo.trim();
        if (!novo) {
          toast("Informe um nome válido.", "error");
          return;
        }
        sess.rotulo = novo;
        setSessoes(sessoes);
        renderSessoesModal();
        markDirty();
        toast("Sessão renomeada.", "success");
      });
    }

    if (els.permList) {
      els.permList.addEventListener("change", function (e) {
        var input = e.target.closest("[data-perm-key]");
        if (!input || !modalRoleId) return;
        applyPermModalToggles();
        markDirty();
      });
    }

    if (els.permSave) {
      els.permSave.addEventListener("click", function () {
        applyPermModalToggles();
        markDirty();
        closeModal("cfgModalPerm");
        toast("Permissões atualizadas — salve para persistir no servidor.", "success");
      });
    }
  }

  function setupEvents() {
    setupModalEvents();
    [els.nomeSite, els.emailContato, els.recaptchaSite, els.recaptchaSecret].forEach(function (el) {
      if (!el) return;
      el.addEventListener("input", markDirty);
    });

    [
      els.notifColetas,
      els.notifEcopontos,
      els.notifRelatorios,
      els.notifAtualizacoes,
      els.recaptchaAtivo,
    ].forEach(function (el) {
      if (!el) return;
      el.addEventListener("change", function () {
        if (el === els.recaptchaAtivo) setBadgeState(els.recaptchaBadge, el.checked);
        markDirty();
      });
    });

    if (els.temaLight) {
      els.temaLight.addEventListener("click", function () {
        updateTemaButtons("light");
        applyTemaPreview("light");
        markDirty();
      });
    }
    if (els.temaDark) {
      els.temaDark.addEventListener("click", function () {
        updateTemaButtons("dark");
        applyTemaPreview("dark");
        markDirty();
      });
    }

    document.querySelectorAll("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        copyField(btn.getAttribute("data-copy"));
      });
    });

    if (els.toggleSecret && els.recaptchaSecret) {
      els.toggleSecret.addEventListener("click", function () {
        var show = els.recaptchaSecret.type === "password";
        els.recaptchaSecret.type = show ? "text" : "password";
        els.toggleSecret.setAttribute("aria-label", show ? "Ocultar secret key" : "Mostrar secret key");
      });
    }

    if (els.rolesList) {
      els.rolesList.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-role-id]");
        if (!btn) return;
        openPermModal(btn.getAttribute("data-role-id"));
      });
    }

    var regen = $("cfgRegenApiKey");
    if (regen) {
      regen.addEventListener("click", function () {
        if (
          !window.confirm(
            "Gerar uma nova chave de API? Integrações antigas deixarão de funcionar até serem atualizadas."
          )
        ) {
          return;
        }
        state.regenerarApiKey = true;
        setDirty(true);
        saveConfig();
      });
    }

    if (els.cancel) els.cancel.addEventListener("click", discardChanges);
    if (els.save) els.save.addEventListener("click", saveConfig);

    var btnSenha = $("cfgBtnSenha");
    if (btnSenha) {
      btnSenha.addEventListener("click", function () {
        if (window.PlatAdmPerfil && typeof window.PlatAdmPerfil.abrirModalEditar === "function") {
          window.PlatAdmPerfil.abrirModalEditar(true);
        } else {
          openSenhaModal();
        }
      });
    }

    var btn2fa = $("cfgBtn2fa");
    if (btn2fa) {
      btn2fa.addEventListener("click", function () {
        if (!state.draft) state.draft = cloneConfig(state.saved);
        state.draft.seguranca = state.draft.seguranca || {};
        state.draft.seguranca.dois_fatores = !state.draft.seguranca.dois_fatores;
        setBadgeState(els.badge2fa, state.draft.seguranca.dois_fatores);
        markDirty();
        toast(
          state.draft.seguranca.dois_fatores
            ? "2FA ativado — clique em Salvar para confirmar."
            : "2FA desativado — clique em Salvar para confirmar.",
          "success"
        );
      });
    }

    var btnSessoes = $("cfgBtnSessoes");
    if (btnSessoes) {
      btnSessoes.addEventListener("click", openSessoesModal);
    }
  }

  function boot() {
    bindEls();
    setupEvents();
    setupPlatAdminsUi();
    updateSyncStatus("synced");

    if (!window.PlatAdmShell || typeof window.PlatAdmShell.init !== "function") {
      document.documentElement.classList.remove("plat-auth-checking");
      loadConfig().catch(function (err) {
        showAuthError(err.message);
      });
      return;
    }

    window.PlatAdmShell.init()
      .then(function () {
        return loadConfig();
      })
      .catch(function (err) {
        if (err && err.message) showAuthError(err.message);
      });
  }

  window.PlatConfigAdm = {
    atualizarAdminNaLista: atualizarAdminNaLista,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
