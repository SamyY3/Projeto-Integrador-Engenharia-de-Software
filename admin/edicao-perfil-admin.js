(function () {
  const LOGIN_PAGE = "Login-ADM-Ecoponto.html";
  const PERFIL_URL = "../api/meu-perfil-admin.php";
  const SALVAR_URL = "../api/atualizar-perfil-admin.php";

  const els = {
    nomeDisplay: document.getElementById("adminNomeDisplay"),
    editNomeEcoponto: document.getElementById("editNomeEcoponto"),
    editEmail: document.getElementById("editEmail"),
    editConfirmEmail: document.getElementById("editConfirmEmail"),
    editPassword: document.getElementById("editPassword"),
    editConfirmPassword: document.getElementById("editConfirmPassword"),
    foto: document.getElementById("fotoPerfilEdicao"),
    fileInput: document.getElementById("fileInput"),
    btnConfirmar: document.getElementById("btnConfirmarPerfil"),
    btnEditarNome: document.getElementById("btnEditarNome"),
    saveOverlay: document.getElementById("saveConfirmOverlay"),
    cancelSave: document.getElementById("cancelSaveBtn"),
    confirmSave: document.getElementById("confirmSaveBtn"),
    authError: document.getElementById("edicaoAuthError"),
  };

  let adminAtual = { nome: "", email: "", ecoponto: "" };

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

  function mostrarErro(msg) {
    if (!els.authError) {
      window.alert(msg);
      return;
    }
    els.authError.textContent = msg;
    els.authError.classList.add("visible");
    window.setTimeout(() => els.authError.classList.remove("visible"), 4000);
  }

  function resolverUrlFoto(path) {
    if (!path) return "";
    const p = String(path).trim();
    if (/^(https?:|data:|blob:)/i.test(p)) return p;
    const base = document.querySelector("base[data-app-base]");
    const root = base && base.href ? base.href : "../";
    try {
      return new URL(p.replace(/^\//, ""), root).href;
    } catch (e) {
      return p;
    }
  }

  function validarPerfil() {
    const erros = {
      emailError: "",
      confirmEmailError: "",
      passwordError: "",
      confirmPasswordError: "",
    };

    const email = els.editEmail ? els.editEmail.value.trim() : "";
    const confirmEmail = els.editConfirmEmail ? els.editConfirmEmail.value.trim() : "";
    const senha = els.editPassword ? els.editPassword.value : "";
    const confirmSenha = els.editConfirmPassword ? els.editConfirmPassword.value : "";

    if (!email || !confirmEmail) {
      erros.emailError = email ? "" : "Informe o e-mail.";
      erros.confirmEmailError = confirmEmail ? "" : "Confirme o e-mail.";
    } else if (email !== confirmEmail) {
      erros.confirmEmailError = "Os e-mails não coincidem.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      erros.emailError = "E-mail inválido.";
    }

    if (senha !== confirmSenha) {
      erros.confirmPasswordError = "As senhas não coincidem.";
    } else if (senha !== "" && senha.length < 8) {
      erros.passwordError = "Mínimo 8 caracteres.";
    } else if (senha !== "" && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(senha)) {
      erros.passwordError = "Use maiúscula, minúscula e número.";
    }

    ["emailError", "confirmEmailError", "passwordError", "confirmPasswordError"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = erros[id] || "";
    });

    return !Object.values(erros).some(Boolean);
  }

  function preencherFormulario(admin) {
    adminAtual = admin;
    if (els.nomeDisplay) els.nomeDisplay.textContent = admin.nome || "Administrador";
    if (els.editNomeEcoponto) els.editNomeEcoponto.value = admin.ecoponto || "";
    if (els.editEmail) els.editEmail.value = admin.email || "";
    if (els.editConfirmEmail) els.editConfirmEmail.value = admin.email || "";

    if (els.foto && admin.foto_perfil) {
      els.foto.src = resolverUrlFoto(admin.foto_perfil);
    }

    document.documentElement.classList.remove("admin-auth-checking");

    if (window.location.hash === "#senha" && els.editPassword) {
      els.editPassword.focus();
    }
  }

  async function carregarPerfil() {
    try {
      const res = await fetch(PERFIL_URL, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = parseJsonServidor(await res.text());
      if (!data || data.sucesso !== true || !data.admin) {
        mostrarErro((data && data.erro) || "Sessão expirada.");
        window.setTimeout(() => window.location.replace(LOGIN_PAGE), 1600);
        return;
      }
      preencherFormulario(data.admin);
    } catch (e) {
      mostrarErro("Erro ao carregar perfil. Verifique o Apache no XAMPP.");
      window.setTimeout(() => window.location.replace(LOGIN_PAGE), 2200);
    }
  }

  function showSaveConfirm() {
    if (els.saveOverlay) els.saveOverlay.classList.remove("hidden");
  }

  function hideSaveConfirm() {
    if (els.saveOverlay) els.saveOverlay.classList.add("hidden");
  }

  async function performSave() {
    if (!validarPerfil()) return;
    hideSaveConfirm();

    const fd = new FormData();
    const nome = els.nomeDisplay ? els.nomeDisplay.textContent.trim() : "";
    if (nome) fd.append("nome", nome);
    if (els.editNomeEcoponto) fd.append("nome_ecoponto", els.editNomeEcoponto.value.trim());
    if (els.editEmail) fd.append("email", els.editEmail.value.trim());
    if (els.editConfirmEmail) fd.append("confirmaremail", els.editConfirmEmail.value.trim());
    if (els.editPassword) fd.append("senha", els.editPassword.value);
    if (els.editConfirmPassword) fd.append("confirmarsenha", els.editConfirmPassword.value);

    if (els.fileInput && els.fileInput.files && els.fileInput.files[0]) {
      fd.append("foto", els.fileInput.files[0]);
    } else if (els.foto && els.foto.src && els.foto.src.indexOf("data:image") === 0) {
      fd.append("foto_base64", els.foto.src);
    }

    try {
      const res = await fetch(SALVAR_URL, {
        method: "POST",
        body: fd,
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = parseJsonServidor(await res.text());
      if (!data || data.sucesso !== true) {
        mostrarErro((data && data.erro) || "Não foi possível salvar.");
        return;
      }

      const admin = data.admin || {};
      try {
        localStorage.setItem("ecopontoAdminLoggedIn", "true");
        if (admin.nome) localStorage.setItem("ecopontoAdminName", admin.nome);
        if (admin.email) localStorage.setItem("ecopontoAdminEmail", admin.email);
        if (admin.ecoponto) localStorage.setItem("ecopontoAdminPoint", admin.ecoponto);
        if (data.foto_perfil) localStorage.setItem("ecopontoAdminFoto", data.foto_perfil);
      } catch (e) {

      }

      window.location.href = "configuracoes-ADM-Ecoponto.html";
    } catch (e) {
      mostrarErro("Erro de conexão ao salvar.");
    }
  }

  function configurarFoto() {
    const foto = els.foto;
    const fileInput = els.fileInput;
    const cameraBtn = document.getElementById("iconeCameraBtn");
    if (!foto || !fileInput) return;

    const aplicarPreview = (file) => {
      const reader = new FileReader();
      reader.onload = () => {
        foto.src = reader.result;
      };
      reader.readAsDataURL(file);
    };

    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files[0]) {
        aplicarPreview(fileInput.files[0]);
      }
    });

    if (cameraBtn) {
      cameraBtn.addEventListener("click", () => fileInput.click());
    }
  }

  if (els.btnConfirmar) {
    els.btnConfirmar.addEventListener("click", () => {
      if (!validarPerfil()) return;
      showSaveConfirm();
    });
  }

  if (els.cancelSave) els.cancelSave.addEventListener("click", hideSaveConfirm);
  if (els.confirmSave) els.confirmSave.addEventListener("click", performSave);

  if (els.btnEditarNome && els.nomeDisplay) {
    els.btnEditarNome.addEventListener("click", (e) => {
      e.preventDefault();
      els.nomeDisplay.focus();
      if (typeof els.nomeDisplay.select === "function") {
        els.nomeDisplay.select();
      }
    });
  }

  configurarFoto();
  carregarPerfil();
})();
