
(function () {
  const LOGIN_PAGE = "Login-ADM-Ecoponto.html";
  const SESSION_URL = "admin-ecoponto-session.php";
  const PERFIL_URL = "api/meu-perfil-admin.php";
  const SALVAR_PERFIL_URL = "api/atualizar-perfil-admin.php";
  const VERIFICAR_EMAIL_URL = "api/adm-ecoponto-verificar-email.php";
  const CONFIG_URL = "api/configuracoes-adm-ecoponto.php";
  const ADM_TEAM_URL = "api/adm-ecoponto-administradores.php";
  const SIDEBAR_STORAGE_KEY = "ecopontoAdmSidebarExpanded";

  const els = {
    sidebar: document.getElementById("admSidebar"),
    sidebarToggle: document.getElementById("sidebarToggle"),
    sidebarLabels: document.getElementById("admSidebarLabels"),
    profileToggle: document.getElementById("profileToggle"),
    profileMenu: document.getElementById("profileMenu"),
    profileInitial: document.getElementById("profileInitial"),
    profileName: document.getElementById("profileName"),
    profileEmail: document.getElementById("profileEmail"),
    profilePoint: document.getElementById("profilePoint"),
    logout: document.getElementById("logoutAdmin"),
    authError: document.getElementById("dashboardAuthError"),
    configAdminName: document.getElementById("configAdminName"),
    configAdminEmail: document.getElementById("configAdminEmail"),
    configAdminAvatar: document.getElementById("configAdminAvatar"),
    configAdminAvatarFallback: document.getElementById("configAdminAvatarFallback"),
    configLanguage: document.getElementById("configLanguage"),
    configNotifications: document.getElementById("configNotifications"),
    config2fa: document.getElementById("config2fa"),
    configHours: document.getElementById("configHours"),
    configAreas: document.getElementById("configAreas"),
    themeButtons: document.querySelectorAll("[data-theme]"),
    typeButtons: document.querySelectorAll("[data-collect-type]"),
    btnSave: document.getElementById("btnSaveConfig"),
    btnAddUser: document.getElementById("btnAddUser"),
    configUserList: document.getElementById("configUserList"),
    btnEditHours: document.getElementById("btnEditHours"),
    btnEditProfile: document.getElementById("btnEditProfile"),
    btnChangePassword: document.getElementById("btnChangePassword"),
    adminTeamModal: document.getElementById("adminTeamModal"),
    adminTeamBackdrop: document.getElementById("adminTeamBackdrop"),
    adminTeamForm: document.getElementById("adminTeamForm"),
    adminTeamId: document.getElementById("adminTeamId"),
    adminTeamNome: document.getElementById("adminTeamNome"),
    adminTeamEmail: document.getElementById("adminTeamEmail"),
    adminTeamFuncao: document.getElementById("adminTeamFuncao"),
    adminTeamSenha: document.getElementById("adminTeamSenha"),
    adminTeamSenhaHint: document.getElementById("adminTeamSenhaHint"),
    adminTeamModalTitle: document.getElementById("adminTeamModalTitle"),
    btnCloseAdminTeam: document.getElementById("btnCloseAdminTeam"),
    btnCancelAdminTeam: document.getElementById("btnCancelAdminTeam"),
    toast: document.getElementById("configToast"),
    editModal: document.getElementById("editProfileModal"),
    editBackdrop: document.getElementById("editProfileBackdrop"),
    btnCloseEditProfile: document.getElementById("btnCloseEditProfile"),
    btnCancelEditProfile: document.getElementById("btnCancelEditProfile"),
    editProfileForm: document.getElementById("editProfileForm"),
    modalAdminNomeInput: document.getElementById("modalAdminNomeInput"),
    modalFotoBox: document.getElementById("modalFotoBox"),
    modalFotoInicial: document.getElementById("modalFotoInicial"),
    modalNomeEcoponto: document.getElementById("modalNomeEcoponto"),
    modalEmail: document.getElementById("modalEmail"),
    modalConfirmEmail: document.getElementById("modalConfirmEmail"),
    modalPassword: document.getElementById("modalPassword"),
    modalConfirmPassword: document.getElementById("modalConfirmPassword"),
    modalFoto: document.getElementById("modalFotoPerfil"),
    modalFileInput: document.getElementById("modalFileInput"),
    modalCameraBtn: document.getElementById("modalCameraBtn"),
    modalSaveOverlay: document.getElementById("modalSaveConfirmOverlay"),
    modalCancelSaveBtn: document.getElementById("modalCancelSaveBtn"),
    modalConfirmSaveBtn: document.getElementById("modalConfirmSaveBtn"),
    modalEmailVerifyPanel: document.getElementById("modalEmailVerifyPanel"),
    modalEmailCanalEmail: document.getElementById("modalEmailCanalEmail"),
    modalEmailCanalTel: document.getElementById("modalEmailCanalTel"),
    modalEmailCanalTelRadio: document.getElementById("modalEmailCanalTelRadio"),
    btnEnviarCodigoEmail: document.getElementById("btnEnviarCodigoEmail"),
    btnReenviarCodigoEmail: document.getElementById("btnReenviarCodigoEmail"),
    modalEmailCodigoWrap: document.getElementById("modalEmailCodigoWrap"),
    modalEmailCodigo: document.getElementById("modalEmailCodigo"),
    btnConfirmarCodigoEmail: document.getElementById("btnConfirmarCodigoEmail"),
    modalEmailVerifyHint: document.getElementById("modalEmailVerifyHint"),
    modalEmailVerifyOk: document.getElementById("modalEmailVerifyOk"),
    modalEmailCodigoError: document.getElementById("modalEmailCodigoError"),
  };

  let toastTimer = null;
  let emailVerificacao = {
    emailOriginal: "",
    verificado: false,
    codigoEnviado: false,
  };
  let preferenciasAtuais = null;
  let adminAtual = null;
  let administradoresCache = [];
  let fotoArquivoPendente = null;
  let fotoBase64Pendente = "";

  function limparAdminLocal() {
    localStorage.removeItem("ecopontoAdminLoggedIn");
    localStorage.removeItem("ecopontoAdminName");
    localStorage.removeItem("ecopontoAdminEmail");
    localStorage.removeItem("ecopontoAdminPoint");
    localStorage.removeItem("ecopontoAdminFoto");
  }

  function voltarLoginAdmin() {
    if (window.EcoAdm && typeof window.EcoAdm.voltarLoginAdmin === "function") {
      window.EcoAdm.voltarLoginAdmin();
      return;
    }
    limparAdminLocal();
    window.location.replace(LOGIN_PAGE);
  }

  function mostrarErroAuth(mensagem) {
    if (!els.authError) return;
    els.authError.textContent = mensagem;
    els.authError.classList.add("visible");
    document.documentElement.classList.remove("admin-auth-checking");
  }

  function parseJsonServidor(text) {
    const raw = String(text || "").replace(/^\uFEFF/, "").trim();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (e) {
      const idx = raw.indexOf('{"');
      if (idx >= 0) return JSON.parse(raw.slice(idx));
      throw e;
    }
  }

  function salvarAdminLocal(admin) {
    localStorage.setItem("ecopontoAdminLoggedIn", "true");
    localStorage.setItem("ecopontoAdminName", admin.nome || "");
    localStorage.setItem("ecopontoAdminEmail", admin.email || "");
    localStorage.setItem("ecopontoAdminPoint", admin.ecoponto || "");
    if (admin.foto_perfil) {
      localStorage.setItem("ecopontoAdminFoto", admin.foto_perfil);
    }
  }

  function resolverUrlFoto(path, cacheBust) {
    if (window.EcoAdm && typeof window.EcoAdm.resolverUrlFotoAdm === "function") {
      return window.EcoAdm.resolverUrlFotoAdm(path, cacheBust);
    }
    return path || "";
  }

  function iniciaisDoNome(nome) {
    const partes = String(nome || "A")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (partes.length === 0) return "A";
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
  }

  function inicialDoNome(nome) {
    const parte = String(nome || "A").trim().split(/\s+/)[0];
    return (parte.charAt(0) || "A").toUpperCase();
  }

  function mostrarToast(mensagem, isErro) {
    if (!els.toast) return;
    els.toast.textContent = mensagem;
    els.toast.style.background = isErro ? "#c94a4a" : "";
    els.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      els.toast.classList.remove("is-visible");
      els.toast.style.background = "";
    }, 3200);
  }

  function isFotoAdminValida(path) {
    if (window.EcoAdm && typeof window.EcoAdm.isFotoAdminValida === "function") {
      return window.EcoAdm.isFotoAdminValida(path);
    }
    return Boolean(path);
  }

  function registrarArquivoFoto(file) {
    if (!file) return;
    fotoArquivoPendente = file;
    fotoBase64Pendente = "";
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        fotoBase64Pendente = reader.result;
      }
    };
    reader.readAsDataURL(file);
  }

  function limparFotoPendente() {
    fotoArquivoPendente = null;
    fotoBase64Pendente = "";
  }

  function fileParaBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(file);
    });
  }

  async function blobParaBase64(blobUrl) {
    const resp = await fetch(blobUrl);
    const blob = await resp.blob();
    return fileParaBase64(blob);
  }

  async function anexarFotoAoFormData(fd) {
    let file = fotoArquivoPendente;
    if (!file && els.modalFileInput && els.modalFileInput.files && els.modalFileInput.files[0]) {
      file = els.modalFileInput.files[0];
    }
    if (file) {
      try {
        let b64 = fotoBase64Pendente;
        if (!b64 || b64.indexOf("data:image") !== 0) {
          b64 = await fileParaBase64(file);
        }
        if (b64 && b64.indexOf("data:image") === 0) {
          fd.append("foto_base64", b64);
          return;
        }
      } catch (e) {

      }
      fd.append("foto", file);
      return;
    }
    if (fotoBase64Pendente) {
      fd.append("foto_base64", fotoBase64Pendente);
      return;
    }
    if (!els.modalFoto || !els.modalFoto.src) return;
    const src = String(els.modalFoto.src);
    if (src.indexOf("data:image") === 0) {
      fd.append("foto_base64", src);
      return;
    }
    if (src.indexOf("blob:") === 0) {
      try {
        const b64 = await blobParaBase64(src);
        if (b64) fd.append("foto_base64", b64);
      } catch (e) {

      }
    }
  }

  async function recarregarPerfilAdmin() {
    const res = await fetch(PERFIL_URL, {
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = parseJsonServidor(await res.text());
    if (!data || data.sucesso !== true || !data.admin) {
      return null;
    }
    adminAtual = data.admin;
    salvarAdminLocal(data.admin);
    preencherPainel(data.admin);
    return data.admin;
  }

  function avatarAlvosPerfilCard() {
    if (!els.configAdminAvatar || !els.configAdminAvatarFallback) return null;
    return { img: els.configAdminAvatar, fallback: els.configAdminAvatarFallback };
  }

  function aplicarFotoPerfil(fotoPath, nome) {
    const alvos = avatarAlvosPerfilCard();
    if (!alvos) return;
    if (window.EcoAdm && typeof window.EcoAdm.aplicarFotoAvatar === "function") {
      window.EcoAdm.aplicarFotoAvatar(alvos, fotoPath, nome);
      return;
    }
    alvos.fallback.textContent = inicialDoNome(nome);
  }

  function aplicarFotoHeader(fotoPath, nome) {
    if (!window.EcoAdm || typeof window.EcoAdm.garantirImgAvatarHeader !== "function") return;
    const alvos = window.EcoAdm.garantirImgAvatarHeader(els.profileToggle);
    if (alvos && typeof window.EcoAdm.aplicarFotoAvatar === "function") {
      window.EcoAdm.aplicarFotoAvatar(alvos, fotoPath, nome);
    }
  }

  function aplicarTemaAdm(tema) {
    const modo = tema === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-adm-tema", modo);
    try {
      localStorage.setItem("ecopontoAdmTema", modo);
    } catch (e) {

    }
  }

  function aplicarPreferencias(config) {
    preferenciasAtuais = config;
    if (!config) return;

    if (config.tema) {
      aplicarTemaAdm(config.tema);
      els.themeButtons.forEach((btn) => {
        btn.classList.toggle("is-active", btn.getAttribute("data-theme") === config.tema);
      });
    }

    if (els.configLanguage && config.idioma) {
      els.configLanguage.value = config.idioma;
    }
    if (els.configNotifications && typeof config.notificacoes === "boolean") {
      els.configNotifications.checked = config.notificacoes;
    }
    if (els.config2fa && typeof config.dois_fatores === "boolean") {
      els.config2fa.checked = config.dois_fatores;
    }
    if (els.configHours && config.horarios) {
      els.configHours.value = config.horarios;
    }
    if (config.tipo_coleta) {
      const tipo =
        config.tipo_coleta === "manual" ? "prefeitura" : config.tipo_coleta;
      els.typeButtons.forEach((btn) => {
        btn.classList.toggle(
          "is-active",
          btn.getAttribute("data-collect-type") === tipo
        );
      });
    }
    if (els.configAreas && Array.isArray(config.areas_atendidas)) {
      els.configAreas.innerHTML = config.areas_atendidas
        .map((a) => '<span class="adm-config-chip">' + escapeHtml(a) + "</span>")
        .join("");
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function coletarPreferenciasForm() {
    return {
      idioma: els.configLanguage ? els.configLanguage.value : "pt-BR",
      notificacoes: els.configNotifications ? els.configNotifications.checked : true,
      tema:
        document.querySelector("[data-theme].is-active")?.getAttribute("data-theme") || "light",
      tipo_coleta: (() => {
        const t =
          document.querySelector("[data-collect-type].is-active")?.getAttribute(
            "data-collect-type"
          ) || "truck";
        return t === "manual" ? "prefeitura" : t;
      })(),
      horarios: els.configHours ? els.configHours.value.trim() : "08:00-17:00",
      dois_fatores: els.config2fa ? els.config2fa.checked : false,
      areas_atendidas: preferenciasAtuais?.areas_atendidas || ["Centro", "Zona Norte", "Zona Sul"],
    };
  }

  function obterCanalEmailSelecionado() {
    const checked = document.querySelector('input[name="modalEmailCanal"]:checked');
    return checked ? checked.value : "email";
  }

  function emailModalMudou() {
    const atual = emailVerificacao.emailOriginal || (adminAtual && adminAtual.email) || "";
    const novo = els.modalEmail ? els.modalEmail.value.trim() : "";
    return novo !== "" && atual !== "" && novo.toLowerCase() !== atual.toLowerCase();
  }

  function resetEmailVerificacao(admin) {
    emailVerificacao.emailOriginal = (admin && admin.email) || "";
    emailVerificacao.verificado = Boolean(admin && admin.email_alteracao_verificado);
    emailVerificacao.codigoEnviado = false;

    if (els.modalEmailCodigo) els.modalEmailCodigo.value = "";
    if (els.modalEmailCodigoError) els.modalEmailCodigoError.textContent = "";
    if (els.modalEmailVerifyHint) els.modalEmailVerifyHint.textContent = "";
    if (els.modalEmailCodigoWrap) els.modalEmailCodigoWrap.classList.add("hidden");
    if (els.btnReenviarCodigoEmail) els.btnReenviarCodigoEmail.classList.add("hidden");
    if (els.modalEmailVerifyOk) {
      els.modalEmailVerifyOk.classList.toggle("hidden", !emailVerificacao.verificado);
    }
    atualizarPainelVerificacaoEmail(admin);
  }

  function atualizarPainelVerificacaoEmail(admin) {
    const adminRef = admin || adminAtual || {};
    const emailMask = adminRef.email_mascarado || adminRef.email || "—";
    const telMask = adminRef.telefone_mascarado || "—";
    const temTelefone = Boolean(adminRef.telefone && String(adminRef.telefone).replace(/\D/g, "").length >= 10);

    if (els.modalEmailCanalEmail) els.modalEmailCanalEmail.textContent = emailMask;
    if (els.modalEmailCanalTel) els.modalEmailCanalTel.textContent = telMask;

    if (els.modalEmailCanalTelRadio) {
      const labelTel = els.modalEmailCanalTelRadio.closest(".adm-email-verify-canal");
      els.modalEmailCanalTelRadio.disabled = !temTelefone;
      if (labelTel) labelTel.classList.toggle("is-disabled", !temTelefone);
      if (!temTelefone) {
        const emailRadio = document.querySelector('input[name="modalEmailCanal"][value="email"]');
        if (emailRadio) emailRadio.checked = true;
      }
    }

    const mudou = emailModalMudou();
    if (els.modalEmailVerifyPanel) {
      els.modalEmailVerifyPanel.classList.toggle("hidden", !mudou);
    }

    if (!mudou) {
      emailVerificacao.verificado = false;
      if (els.modalEmailVerifyOk) els.modalEmailVerifyOk.classList.add("hidden");
      if (els.modalEmailCodigoWrap) els.modalEmailCodigoWrap.classList.add("hidden");
      if (els.btnReenviarCodigoEmail) els.btnReenviarCodigoEmail.classList.add("hidden");
      return;
    }

    const pendente = (els.modalEmail && els.modalEmail.value.trim()) || "";
    if (
      adminRef.email_alteracao_verificado &&
      adminRef.email_alteracao_pendente &&
      pendente.toLowerCase() === String(adminRef.email_alteracao_pendente).toLowerCase()
    ) {
      emailVerificacao.verificado = true;
      if (els.modalEmailVerifyOk) els.modalEmailVerifyOk.classList.remove("hidden");
    } else if (!emailVerificacao.verificado) {
      if (els.modalEmailVerifyOk) els.modalEmailVerifyOk.classList.add("hidden");
    }
  }

  async function enviarCodigoEmail(reenviar) {
    if (!emailModalMudou()) {
      mostrarToast("Informe um novo e-mail diferente do atual.", true);
      return;
    }

    const novoEmail = els.modalEmail ? els.modalEmail.value.trim() : "";
    const confirmEmail = els.modalConfirmEmail ? els.modalConfirmEmail.value.trim() : "";
    if (!novoEmail || !confirmEmail || novoEmail !== confirmEmail) {
      mostrarToast("Preencha e confirme o novo e-mail antes de enviar o código.", true);
      return;
    }

    const fd = new FormData();
    fd.append("acao", reenviar ? "reenviar" : "enviar");
    fd.append("novo_email", novoEmail);
    fd.append("canal", obterCanalEmailSelecionado());

    if (els.btnEnviarCodigoEmail) els.btnEnviarCodigoEmail.disabled = true;
    if (els.btnReenviarCodigoEmail) els.btnReenviarCodigoEmail.disabled = true;

    try {
      const res = await fetch(VERIFICAR_EMAIL_URL, {
        method: "POST",
        body: fd,
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = parseJsonServidor(await res.text());
      if (!data || data.sucesso !== true) {
        mostrarToast((data && data.erro) || "Não foi possível enviar o código.", true);
        return;
      }

      emailVerificacao.codigoEnviado = true;
      emailVerificacao.verificado = false;
      if (els.modalEmailVerifyOk) els.modalEmailVerifyOk.classList.add("hidden");
      if (els.modalEmailCodigoWrap) els.modalEmailCodigoWrap.classList.remove("hidden");
      if (els.btnReenviarCodigoEmail) els.btnReenviarCodigoEmail.classList.remove("hidden");
      if (els.modalEmailVerifyHint) {
        let hint = data.mensagem || "Código enviado.";
        if (data.codigo_para_teste) {
          hint += " Código (modo local): " + data.codigo_para_teste;
        }
        els.modalEmailVerifyHint.textContent = hint;
      }
      if (els.modalEmailCodigo) els.modalEmailCodigo.focus();
      mostrarToast(data.mensagem || "Código enviado.");
    } catch (e) {
      mostrarToast("Erro de conexão ao enviar o código.", true);
    } finally {
      if (els.btnEnviarCodigoEmail) els.btnEnviarCodigoEmail.disabled = false;
      if (els.btnReenviarCodigoEmail) els.btnReenviarCodigoEmail.disabled = false;
    }
  }

  async function verificarCodigoEmail() {
    const novoEmail = els.modalEmail ? els.modalEmail.value.trim() : "";
    const codigo = els.modalEmailCodigo ? els.modalEmailCodigo.value.replace(/\D/g, "") : "";

    if (!emailModalMudou()) {
      mostrarToast("Altere o e-mail antes de verificar.", true);
      return;
    }
    if (codigo.length !== 6) {
      if (els.modalEmailCodigoError) els.modalEmailCodigoError.textContent = "Digite os 6 números.";
      return;
    }
    if (els.modalEmailCodigoError) els.modalEmailCodigoError.textContent = "";

    const fd = new FormData();
    fd.append("acao", "verificar");
    fd.append("novo_email", novoEmail);
    fd.append("codigo", codigo);

    if (els.btnConfirmarCodigoEmail) els.btnConfirmarCodigoEmail.disabled = true;
    try {
      const res = await fetch(VERIFICAR_EMAIL_URL, {
        method: "POST",
        body: fd,
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = parseJsonServidor(await res.text());
      if (!data || data.sucesso !== true) {
        if (els.modalEmailCodigoError) {
          els.modalEmailCodigoError.textContent = (data && data.erro) || "Código inválido.";
        }
        return;
      }

      emailVerificacao.verificado = true;
      if (adminAtual) {
        adminAtual.email_alteracao_verificado = true;
        adminAtual.email_alteracao_pendente = novoEmail;
      }
      if (els.modalEmailVerifyOk) els.modalEmailVerifyOk.classList.remove("hidden");
      if (els.modalEmailCodigoError) els.modalEmailCodigoError.textContent = "";
      mostrarToast(data.mensagem || "E-mail verificado.");
    } catch (e) {
      mostrarToast("Erro de conexão ao verificar o código.", true);
    } finally {
      if (els.btnConfirmarCodigoEmail) els.btnConfirmarCodigoEmail.disabled = false;
    }
  }

  function limparErrosModal() {
    ["modalEmailError", "modalConfirmEmailError", "modalPasswordError", "modalConfirmPasswordError", "modalEmailCodigoError"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = "";
      }
    );
    [els.modalEmail, els.modalConfirmEmail, els.modalPassword, els.modalConfirmPassword].forEach((input) => {
      if (input) input.classList.remove("input-error");
    });
  }

  function validarModalPerfil() {
    limparErrosModal();
    const email = els.modalEmail ? els.modalEmail.value.trim() : "";
    const confirmEmail = els.modalConfirmEmail ? els.modalConfirmEmail.value.trim() : "";
    const senha = els.modalPassword ? els.modalPassword.value : "";
    const confirmSenha = els.modalConfirmPassword ? els.modalConfirmPassword.value : "";
    let ok = true;

    const setErr = (id, input, msg) => {
      const el = document.getElementById(id);
      if (el) el.textContent = msg;
      if (input) input.classList.add("input-error");
      ok = false;
    };

    const nome = obterNomeModal();
    if (!nome) {
      if (els.modalAdminNomeInput) els.modalAdminNomeInput.classList.add("input-error");
      ok = false;
    }

    if (!email) setErr("modalEmailError", els.modalEmail, "Informe o e-mail.");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr("modalEmailError", els.modalEmail, "E-mail inválido.");
    }
    if (!confirmEmail) setErr("modalConfirmEmailError", els.modalConfirmEmail, "Confirme o e-mail.");
    else if (email && confirmEmail && email !== confirmEmail) {
      setErr("modalConfirmEmailError", els.modalConfirmEmail, "Os e-mails não coincidem.");
    }
    if (senha !== confirmSenha) {
      setErr("modalConfirmPasswordError", els.modalConfirmPassword, "As senhas não coincidem.");
    } else if (senha !== "" && senha.length < 8) {
      setErr("modalPasswordError", els.modalPassword, "Mínimo 8 caracteres.");
    } else if (senha !== "" && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(senha)) {
      setErr("modalPasswordError", els.modalPassword, "Use maiúscula, minúscula e número.");
    }

    if (emailModalMudou() && !emailVerificacao.verificado) {
      setErr(
        "modalEmailCodigoError",
        els.modalEmailCodigo,
        "Confirme o código enviado ao e-mail ou telefone atual."
      );
      ok = false;
    }

    return ok;
  }

  function obterNomeModal() {
    return els.modalAdminNomeInput ? els.modalAdminNomeInput.value.trim() : "";
  }

  function arquivoImagemValido(file) {
    if (!file) return false;
    if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.type || "")) return true;
    return /\.(png|jpe?g|webp|gif)$/i.test(file.name || "");
  }

  function exibirFotoModal(url) {
    if (!els.modalFoto || !url) return;
    const mostrar = () => {
      if (els.modalFotoBox) els.modalFotoBox.classList.add("has-foto");
    };
    els.modalFoto.onload = mostrar;
    els.modalFoto.onerror = () => {
      if (els.modalFotoBox) els.modalFotoBox.classList.remove("has-foto");
      els.modalFoto.removeAttribute("src");
    };
    els.modalFoto.src = url;
    if (els.modalFoto.complete && els.modalFoto.naturalWidth > 0) {
      mostrar();
    }
  }

  function limparPreviewFotoModal() {
    if (els.modalFoto && els.modalFoto._objectUrl) {
      URL.revokeObjectURL(els.modalFoto._objectUrl);
      els.modalFoto._objectUrl = null;
    }
    if (els.modalFoto) {
      els.modalFoto.removeAttribute("src");
    }
    if (els.modalFotoBox) els.modalFotoBox.classList.remove("has-foto");
  }

  function aplicarFotoModal(fotoPath, nome) {
    if (!els.modalFoto) return;
    const inicial = inicialDoNome(nome);
    if (els.modalFotoInicial) {
      els.modalFotoInicial.textContent = inicial;
    }

    els.modalFoto.alt = "Foto de " + (nome || "administrador");

    if (/^data:image|^blob:/i.test(String(fotoPath))) {
      exibirFotoModal(String(fotoPath));
      return;
    }

    if (isFotoAdminValida(fotoPath)) {
      exibirFotoModal(resolverUrlFoto(fotoPath, true));
      return;
    }

    limparPreviewFotoModal();
  }

  function preencherModalEditar(admin, focoSenha) {
    if (!admin) return;
    const nome = admin.nome || "Administrador";
    const email = admin.email || "";
    const ecoponto = admin.ecoponto || "";

    if (els.modalAdminNomeInput) els.modalAdminNomeInput.value = nome;
    if (els.modalNomeEcoponto) els.modalNomeEcoponto.value = ecoponto;
    if (els.modalEmail) els.modalEmail.value = email;
    if (els.modalConfirmEmail) els.modalConfirmEmail.value = email;
    if (els.modalPassword) els.modalPassword.value = "";
    if (els.modalConfirmPassword) els.modalConfirmPassword.value = "";
    if (els.modalFileInput) els.modalFileInput.value = "";
    limparFotoPendente();

    aplicarFotoModal(admin.foto_perfil, nome);
    resetEmailVerificacao(admin);

    limparErrosModal();

    if (focoSenha && els.modalPassword) {
      window.setTimeout(() => els.modalPassword.focus(), 120);
    }
  }

  function abrirModalEditar(focoSenha) {
    if (!els.editModal || !adminAtual) return;
    preencherModalEditar(adminAtual, focoSenha);
    els.editModal.classList.remove("hidden");
    document.body.classList.add("adm-modal-open");
  }

  function fecharModalEditar() {
    if (!els.editModal) return;
    els.editModal.classList.add("hidden");
    document.body.classList.remove("adm-modal-open");
    if (els.modalSaveOverlay) els.modalSaveOverlay.classList.add("hidden");
  }

  function showModalSaveConfirm() {
    if (els.modalSaveOverlay) els.modalSaveOverlay.classList.remove("hidden");
  }

  function hideModalSaveConfirm() {
    if (els.modalSaveOverlay) els.modalSaveOverlay.classList.add("hidden");
  }

  async function salvarPerfilModal() {
    if (!validarModalPerfil()) return;
    hideModalSaveConfirm();

    const fd = new FormData();
    const nome = obterNomeModal();
    if (!nome) {
      mostrarToast("Informe o nome do administrador.", true);
      return;
    }
    fd.append("nome", nome);
    if (els.modalNomeEcoponto) fd.append("nome_ecoponto", els.modalNomeEcoponto.value.trim());
    if (els.modalEmail) fd.append("email", els.modalEmail.value.trim());
    if (els.modalConfirmEmail) fd.append("confirmaremail", els.modalConfirmEmail.value.trim());
    if (els.modalPassword) fd.append("senha", els.modalPassword.value);
    if (els.modalConfirmPassword) fd.append("confirmarsenha", els.modalConfirmPassword.value);

    const enviouFoto = Boolean(
      fotoArquivoPendente ||
        fotoBase64Pendente ||
        (els.modalFileInput && els.modalFileInput.files && els.modalFileInput.files[0])
    );

    await anexarFotoAoFormData(fd);

    const btn = document.getElementById("btnSaveEditProfile");
    if (btn) btn.disabled = true;

    try {
      const res = await fetch(SALVAR_PERFIL_URL, {
        method: "POST",
        body: fd,
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = parseJsonServidor(await res.text());
      if (!data || data.sucesso !== true) {
        mostrarToast((data && data.erro) || "Não foi possível salvar o perfil.", true);
        return;
      }

      if (enviouFoto && !data.foto_perfil && !(data.admin && data.admin.foto_perfil)) {
        mostrarToast(
          "Perfil salvo, mas a foto não foi gravada. Verifique a pasta uploads ou tente outra imagem.",
          true
        );
      }

      limparFotoPendente();
      fecharModalEditar();
      await recarregarPerfilAdmin();
      if (!enviouFoto || data.foto_perfil || (data.admin && data.admin.foto_perfil)) {
        mostrarToast(data.mensagem || "Perfil atualizado com sucesso.");
      }
    } catch (e) {
      mostrarToast("Erro de conexão ao salvar o perfil.", true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function configurarModalEditar() {
    if (els.btnEditProfile) {
      els.btnEditProfile.addEventListener("click", () => abrirModalEditar(false));
    }
    if (els.btnCloseEditProfile) {
      els.btnCloseEditProfile.addEventListener("click", fecharModalEditar);
    }
    if (els.btnCancelEditProfile) {
      els.btnCancelEditProfile.addEventListener("click", fecharModalEditar);
    }
    if (els.editBackdrop) {
      els.editBackdrop.addEventListener("click", fecharModalEditar);
    }
    if (els.editProfileForm) {
      els.editProfileForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!validarModalPerfil()) return;
        showModalSaveConfirm();
      });
    }
    if (els.modalCancelSaveBtn) {
      els.modalCancelSaveBtn.addEventListener("click", hideModalSaveConfirm);
    }
    const saveConfirmBackdrop = document.getElementById("modalSaveConfirmBackdrop");
    if (saveConfirmBackdrop) {
      saveConfirmBackdrop.addEventListener("click", hideModalSaveConfirm);
    }
    if (els.modalConfirmSaveBtn) {
      els.modalConfirmSaveBtn.addEventListener("click", salvarPerfilModal);
    }
    if (els.modalFileInput && els.modalFoto) {
      const aplicarPreviewArquivo = (file) => {
        if (!arquivoImagemValido(file)) {
          mostrarToast("Use uma imagem PNG, JPG ou WebP.", true);
          els.modalFileInput.value = "";
          limparFotoPendente();
          return;
        }

        registrarArquivoFoto(file);

        if (els.modalFoto._objectUrl) {
          URL.revokeObjectURL(els.modalFoto._objectUrl);
          els.modalFoto._objectUrl = null;
        }

        const usarObjectUrl = () => {
          try {
            const objUrl = URL.createObjectURL(file);
            els.modalFoto._objectUrl = objUrl;
            exibirFotoModal(objUrl);
            return true;
          } catch (e) {
            return false;
          }
        };

        if (!usarObjectUrl()) {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              exibirFotoModal(reader.result);
            }
          };
          reader.onerror = () => mostrarToast("Não foi possível ler a imagem.", true);
          reader.readAsDataURL(file);
        }
      };

      els.modalFileInput.addEventListener("change", () => {
        const file = els.modalFileInput.files && els.modalFileInput.files[0];
        if (!file) return;
        aplicarPreviewArquivo(file);
      });
    }
    if (els.modalCameraBtn && els.modalFileInput) {
      els.modalCameraBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        els.modalFileInput.click();
      });
    }
    if (els.modalEmail) {
      els.modalEmail.addEventListener("input", () => {
        emailVerificacao.verificado = false;
        if (adminAtual) adminAtual.email_alteracao_verificado = false;
        atualizarPainelVerificacaoEmail(adminAtual);
      });
    }
    if (els.modalConfirmEmail) {
      els.modalConfirmEmail.addEventListener("input", () => atualizarPainelVerificacaoEmail(adminAtual));
    }
    if (els.btnEnviarCodigoEmail) {
      els.btnEnviarCodigoEmail.addEventListener("click", () => enviarCodigoEmail(false));
    }
    if (els.btnReenviarCodigoEmail) {
      els.btnReenviarCodigoEmail.addEventListener("click", () => enviarCodigoEmail(true));
    }
    if (els.btnConfirmarCodigoEmail) {
      els.btnConfirmarCodigoEmail.addEventListener("click", verificarCodigoEmail);
    }
    if (els.modalEmailCodigo) {
      els.modalEmailCodigo.addEventListener("input", () => {
        els.modalEmailCodigo.value = els.modalEmailCodigo.value.replace(/\D/g, "").slice(0, 6);
        if (els.modalEmailCodigoError) els.modalEmailCodigoError.textContent = "";
        if (els.modalEmailCodigo.value.length === 6) {
          verificarCodigoEmail();
        }
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.editModal && !els.editModal.classList.contains("hidden")) {
        if (els.modalSaveOverlay && !els.modalSaveOverlay.classList.contains("hidden")) {
          hideModalSaveConfirm();
        } else {
          fecharModalEditar();
        }
      }
    });
  }

  function preencherPainel(admin) {
    adminAtual = admin;
    const nome = admin.nome || "Administrador";
    const email = admin.email || "";
    const ecoponto = admin.ecoponto || "EcoPonto parceiro";

    if (els.profileName) els.profileName.textContent = nome;
    if (els.profileEmail) els.profileEmail.textContent = email || "—";
    if (els.profilePoint) els.profilePoint.textContent = ecoponto;
    if (els.configAdminName) els.configAdminName.textContent = nome;
    if (els.configAdminEmail) els.configAdminEmail.textContent = email || "—";
    aplicarFotoPerfil(admin.foto_perfil, nome);
    aplicarFotoHeader(admin.foto_perfil, nome);
    if (admin.preferencias) {
      aplicarPreferencias(admin.preferencias);
    }

    document.documentElement.classList.remove("admin-auth-checking");
  }

  function renderAdministradores(lista) {
    administradoresCache = lista || [];
    if (!els.configUserList) return;

    if (!administradoresCache.length) {
      els.configUserList.innerHTML =
        '<li class="adm-config-user-item adm-config-user-item--empty"><p>Nenhum administrador cadastrado para este EcoPonto.</p></li>';
      return;
    }

    els.configUserList.innerHTML = administradoresCache
      .map((adm) => {
        const id = adm.id_admin;
        const nome = escapeHtml(adm.nome || "—");
        const email = escapeHtml(adm.email || "—");
        const badge = escapeHtml(adm.funcao_label || "Administrador");
        const iniciais = escapeHtml(adm.iniciais || "AD");
        const desabilitarExcluir = adm.is_self ? ' disabled title="Não é possível excluir a própria conta"' : "";
        return (
          '<li class="adm-config-user-item" data-admin-id="' +
          id +
          '">' +
          '<div class="adm-config-user-main">' +
          '<span class="adm-avatar adm-avatar--xs" aria-hidden="true"><span class="adm-avatar__circle"><span class="adm-avatar__initial">' +
          iniciais +
          "</span></span></span>" +
          '<div class="adm-config-user-meta"><strong>' +
          nome +
          "</strong><span>" +
          email +
          "</span></div>" +
          '<span class="adm-config-user-role">' +
          badge +
          "</span></div>" +
          '<div class="adm-config-user-actions">' +
          '<button type="button" class="adm-config-icon-btn adm-config-icon-btn--edit" data-user-action="edit" data-admin-id="' +
          id +
          '" aria-label="Editar ' +
          nome +
          '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>' +
          "</button>" +
          '<button type="button" class="adm-config-icon-btn adm-config-icon-btn--danger" data-user-action="delete" data-admin-id="' +
          id +
          '" aria-label="Excluir ' +
          nome +
          '"' +
          desabilitarExcluir +
          ">" +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
          "</button></div></li>"
        );
      })
      .join("");
  }

  function fecharModalAdminTeam() {
    if (!els.adminTeamModal) return;
    els.adminTeamModal.classList.add("hidden");
    document.body.classList.remove("adm-modal-open");
  }

  function abrirModalAdminTeam(adm) {
    if (!els.adminTeamModal) return;
    const editando = Boolean(adm && adm.id_admin);
    if (els.adminTeamModalTitle) {
      els.adminTeamModalTitle.textContent = editando
        ? "Editar administrador"
        : "Adicionar administrador";
    }
    if (els.adminTeamId) els.adminTeamId.value = editando ? String(adm.id_admin) : "";
    if (els.adminTeamNome) els.adminTeamNome.value = editando ? adm.nome || "" : "";
    if (els.adminTeamEmail) els.adminTeamEmail.value = editando ? adm.email || "" : "";
    if (els.adminTeamFuncao) {
      els.adminTeamFuncao.value = editando ? adm.funcao || "gestor" : "gestor";
    }
    if (els.adminTeamSenha) els.adminTeamSenha.value = "";
    if (els.adminTeamSenhaHint) {
      els.adminTeamSenhaHint.textContent = editando
        ? "Deixe em branco ao editar para manter a senha atual."
        : "Senha obrigatória (mínimo 8 caracteres).";
    }
    els.adminTeamModal.classList.remove("hidden");
    document.body.classList.add("adm-modal-open");
    if (els.adminTeamNome) els.adminTeamNome.focus();
  }

  async function salvarAdminTeam(event) {
    if (event) event.preventDefault();
    const id = els.adminTeamId ? parseInt(els.adminTeamId.value, 10) : 0;
    const payload = {
      id_admin: id > 0 ? id : undefined,
      nome: els.adminTeamNome ? els.adminTeamNome.value.trim() : "",
      email: els.adminTeamEmail ? els.adminTeamEmail.value.trim() : "",
      funcao: els.adminTeamFuncao ? els.adminTeamFuncao.value : "gestor",
      senha: els.adminTeamSenha ? els.adminTeamSenha.value : "",
    };

    if (els.btnSaveAdminTeam) els.btnSaveAdminTeam.disabled = true;
    try {
      const res = await fetch(ADM_TEAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=UTF-8" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = parseJsonServidor(await res.text());
      if (!data || data.sucesso !== true) {
        mostrarToast((data && data.erro) || "Não foi possível salvar.", true);
        return;
      }
      renderAdministradores(data.administradores || []);
      fecharModalAdminTeam();
      mostrarToast(data.mensagem || "Administrador salvo.");
    } catch (e) {
      mostrarToast("Erro de conexão ao salvar administrador.", true);
    } finally {
      if (els.btnSaveAdminTeam) els.btnSaveAdminTeam.disabled = false;
    }
  }

  async function excluirAdminTeam(idAdmin) {
    if (!window.confirm("Remover este administrador do EcoPonto?")) return;
    try {
      const res = await fetch(ADM_TEAM_URL, {
        method: "DELETE",
        headers: { "Content-Type": "application/json;charset=UTF-8" },
        body: JSON.stringify({ id_admin: idAdmin }),
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = parseJsonServidor(await res.text());
      if (!data || data.sucesso !== true) {
        mostrarToast((data && data.erro) || "Não foi possível excluir.", true);
        return;
      }
      renderAdministradores(data.administradores || []);
      mostrarToast(data.mensagem || "Administrador removido.");
    } catch (e) {
      mostrarToast("Erro de conexão ao excluir.", true);
    }
  }

  function configurarGestaoAdmins() {
    if (els.btnAddUser) {
      els.btnAddUser.addEventListener("click", () => abrirModalAdminTeam(null));
    }
    if (els.btnCloseAdminTeam) {
      els.btnCloseAdminTeam.addEventListener("click", fecharModalAdminTeam);
    }
    if (els.btnCancelAdminTeam) {
      els.btnCancelAdminTeam.addEventListener("click", fecharModalAdminTeam);
    }
    if (els.adminTeamBackdrop) {
      els.adminTeamBackdrop.addEventListener("click", fecharModalAdminTeam);
    }
    if (els.adminTeamForm) {
      els.adminTeamForm.addEventListener("submit", salvarAdminTeam);
    }
    if (els.configUserList) {
      els.configUserList.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-user-action]");
        if (!btn || btn.disabled) return;
        const id = parseInt(btn.getAttribute("data-admin-id") || "0", 10);
        if (id <= 0) return;
        const adm = administradoresCache.find((a) => a.id_admin === id);
        const acao = btn.getAttribute("data-user-action");
        if (acao === "edit") {
          abrirModalAdminTeam(adm || { id_admin: id });
        } else if (acao === "delete") {
          excluirAdminTeam(id);
        }
      });
    }
  }

  async function carregarPreferenciasEAdmins() {
    const res = await fetch(CONFIG_URL, {
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = parseJsonServidor(await res.text());
    if (!data || data.sucesso !== true) {
      throw new Error((data && data.erro) || "Não foi possível carregar configurações.");
    }
    if (data.preferencias) {
      preferenciasAtuais = data.preferencias;
      aplicarPreferencias(data.preferencias);
    }
    renderAdministradores(data.administradores || []);
    if (data.ecoponto && adminAtual) {
      adminAtual.endereco = data.ecoponto.endereco || adminAtual.endereco;
      adminAtual.ecoponto = data.ecoponto.nome_ponto || adminAtual.ecoponto;
    }
  }

  async function carregarPerfilCompleto() {
    const res = await fetch(PERFIL_URL, {
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = parseJsonServidor(await res.text());
    if (!data || data.sucesso !== true || !data.admin) {
      throw new Error((data && data.erro) || "Não foi possível carregar o perfil.");
    }
    adminAtual = data.admin;
    salvarAdminLocal(data.admin);
    preencherPainel(data.admin);
    await carregarPreferenciasEAdmins();

    const hash = (window.location.hash || "").toLowerCase();
    if (hash === "#senha" || hash === "#editar-perfil" || hash === "#editar") {
      abrirModalEditar(hash === "#senha");
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  async function salvarPreferencias() {
    if (els.btnSave) els.btnSave.disabled = true;
    const payload = coletarPreferenciasForm();

    try {
      const res = await fetch(CONFIG_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=UTF-8" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = parseJsonServidor(await res.text());
      if (!data || data.sucesso !== true) {
        mostrarToast((data && data.erro) || "Erro ao salvar preferências.", true);
        return;
      }
      if (data.preferencias) {
        aplicarPreferencias(data.preferencias);
      }
      mostrarToast(data.mensagem || "Alterações salvas com sucesso.");
    } catch (e) {
      mostrarToast("Erro de conexão ao salvar.", true);
    } finally {
      if (els.btnSave) els.btnSave.disabled = false;
    }
  }

  function configurarTema() {
    els.themeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        els.themeButtons.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        aplicarTemaAdm(btn.getAttribute("data-theme") || "light");
        if (btn.getAttribute("data-theme") === "dark") {
          mostrarToast("Modo escuro ativo — clique em Salvar para persistir no servidor.");
        } else {
          mostrarToast("Modo claro ativo — clique em Salvar para persistir no servidor.");
        }
      });
    });
  }

  function configurarTipoColeta() {
    els.typeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        els.typeButtons.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
      });
    });
  }

  function configurarAcoes() {
    if (els.btnSave) {
      els.btnSave.addEventListener("click", salvarPreferencias);
    }

    if (els.btnEditHours) {
      els.btnEditHours.addEventListener("click", () => {
        if (!els.configHours) return;
        els.configHours.removeAttribute("readonly");
        els.configHours.focus();
        els.configHours.select();
      });
    }

    if (els.btnChangePassword) {
      els.btnChangePassword.addEventListener("click", () => abrirModalEditar(true));
    }

  }

  async function validarSessaoAdmin() {
    if (window.EcoAdm && typeof window.EcoAdm.validarSessaoAdmin === "function") {
      await window.EcoAdm.validarSessaoAdmin(els, carregarPerfilCompleto);
      return;
    }
  }

  async function encerrarSessao() {
    if (els.logout) els.logout.disabled = true;
    try {
      await fetch(SESSION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: "acao=logout",
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch (e) {

    }
    voltarLoginAdmin();
  }

  if (window.EcoAdm) {
    window.EcoAdm.setupSidebar(els);
    window.EcoAdm.setupProfileMenu(els);
  }

  if (els.logout) {
    els.logout.addEventListener("click", encerrarSessao);
  }

  configurarTema();
  configurarTipoColeta();
  configurarModalEditar();
  configurarGestaoAdmins();
  configurarAcoes();
  validarSessaoAdmin();

  window.ecoRegistrarFotoAdmin = registrarArquivoFoto;
})();
