
(function () {
  "use strict";

  var PERFIL_URL = window.ecocoletaPhpUrl
    ? window.ecocoletaPhpUrl("meu-perfil-plataforma-adm.php")
    : "api/meu-perfil-plataforma-adm.php";
  var SALVAR_PERFIL_URL = window.ecocoletaPhpUrl
    ? window.ecocoletaPhpUrl("atualizar-perfil-plataforma-adm.php")
    : "api/atualizar-perfil-plataforma-adm.php";
  var VERIFICAR_EMAIL_URL = window.ecocoletaPhpUrl
    ? window.ecocoletaPhpUrl("adm-plataforma-verificar-email.php")
    : "api/adm-plataforma-verificar-email.php";

  var els = {
    profileToggle: document.getElementById("profileToggle"),
    profileInitial: document.getElementById("profileInitial"),
    profileName: document.getElementById("profileName"),
    profileEmail: document.getElementById("profileEmail"),
    profileRole: document.getElementById("profileRole"),
    configAdminName: document.getElementById("configAdminName"),
    configAdminEmail: document.getElementById("configAdminEmail"),
    configAdminCargo: document.getElementById("configAdminCargo"),
    configAdminAvatar: document.getElementById("configAdminAvatar"),
    configAdminAvatarFallback: document.getElementById("configAdminAvatarFallback"),
    btnEditProfile: document.getElementById("btnEditProfile"),
    btnChangePassword: document.getElementById("btnChangePassword"),
    toast: document.getElementById("cfgToast"),
    editModal: document.getElementById("editProfileModal"),
    editBackdrop: document.getElementById("editProfileBackdrop"),
    btnCloseEditProfile: document.getElementById("btnCloseEditProfile"),
    btnCancelEditProfile: document.getElementById("btnCancelEditProfile"),
    editProfileForm: document.getElementById("editProfileForm"),
    modalAdminNomeInput: document.getElementById("modalAdminNomeInput"),
    modalCargo: document.getElementById("modalCargo"),
    modalEmail: document.getElementById("modalEmail"),
    modalConfirmEmail: document.getElementById("modalConfirmEmail"),
    modalPassword: document.getElementById("modalPassword"),
    modalConfirmPassword: document.getElementById("modalConfirmPassword"),
    modalFoto: document.getElementById("modalFotoPerfil"),
    modalFotoInicial: document.getElementById("modalFotoInicial"),
    modalFotoBox: document.getElementById("modalFotoBox"),
    modalFileInput: document.getElementById("modalFileInput"),
    modalCameraBtn: document.getElementById("modalCameraBtn"),
    modalSaveOverlay: document.getElementById("modalSaveConfirmOverlay"),
    modalCancelSaveBtn: document.getElementById("modalCancelSaveBtn"),
    modalConfirmSaveBtn: document.getElementById("modalConfirmSaveBtn"),
    modalEmailVerifyPanel: document.getElementById("modalEmailVerifyPanel"),
    modalEmailCanalEmail: document.getElementById("modalEmailCanalEmail"),
    btnEnviarCodigoEmail: document.getElementById("btnEnviarCodigoEmail"),
    btnReenviarCodigoEmail: document.getElementById("btnReenviarCodigoEmail"),
    modalEmailCodigoWrap: document.getElementById("modalEmailCodigoWrap"),
    modalEmailCodigo: document.getElementById("modalEmailCodigo"),
    btnConfirmarCodigoEmail: document.getElementById("btnConfirmarCodigoEmail"),
    modalEmailVerifyHint: document.getElementById("modalEmailVerifyHint"),
    modalEmailVerifyOk: document.getElementById("modalEmailVerifyOk"),
    modalEmailCodigoError: document.getElementById("modalEmailCodigoError"),
  };

  var toastTimer = null;
  var emailVerificacao = { emailOriginal: "", verificado: false, codigoEnviado: false };
  var adminAtual = null;
  var fotoArquivoPendente = null;
  var fotoBase64Pendente = "";

  function parseJsonServidor(text) {
    var raw = String(text || "").replace(/^\uFEFF/, "").trim();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (e) {
      var idx = raw.indexOf('{"');
      if (idx >= 0) return JSON.parse(raw.slice(idx));
      throw e;
    }
  }

  function inicialDoNome(nome) {
    var parte = String(nome || "A").trim().split(/\s+/)[0];
    return (parte.charAt(0) || "A").toUpperCase();
  }

  function obterBaseApp() {
    var base = document.querySelector("base");
    if (base && base.href) {
      try {
        return new URL(base.href, window.location.href).href;
      } catch (e) {
        return base.href;
      }
    }
    return window.location.origin + "/";
  }

  function resolverUrlFoto(path, cacheBust) {
    if (!path) return "";
    var p = String(path).trim();
    if (/^(https?:|data:|blob:)/i.test(p)) return p;
    try {
      var url = new URL(p.replace(/^\//, ""), obterBaseApp()).href;
      if (!cacheBust) return url;
      return url + (url.indexOf("?") >= 0 ? "&" : "?") + "_=" + Date.now();
    } catch (e) {
      return p;
    }
  }

  function isFotoAdminValida(path) {
    if (!path) return false;
    var p = String(path).trim().toLowerCase();
    if (!p || p === "null" || p === "undefined") return false;
    if (p.indexOf("logo") >= 0 || p.indexOf("imagens/") >= 0) return false;
    return (
      p.indexOf("uploads/") >= 0 ||
      p.indexOf("data:image") === 0 ||
      p.indexOf("blob:") === 0
    );
  }

  function mostrarToast(mensagem, isErro) {
    if (!els.toast) return;
    els.toast.textContent = mensagem;
    els.toast.classList.remove("plat-config-toast--error", "plat-config-toast--success");
    if (isErro) els.toast.classList.add("plat-config-toast--error");
    else els.toast.classList.add("plat-config-toast--success");
    els.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove("is-visible");
    }, 3400);
  }

  function garantirImgAvatarHeader() {
    if (!els.profileToggle) return null;
    var inner = els.profileToggle.querySelector(".plat-avatar__inner");
    if (!inner) return null;
    var img = inner.querySelector(".plat-avatar__photo");
    if (!img) {
      img = document.createElement("img");
      img.className = "plat-avatar__photo is-hidden";
      img.width = 44;
      img.height = 44;
      img.decoding = "async";
      img.alt = "";
      inner.insertBefore(img, inner.firstChild);
    }
    var fallback = inner.querySelector(".plat-avatar__initial");
    return { img: img, fallback: fallback };
  }

  function mostrarAvatarInicial(img, fallback, nome) {
    var wrap = img && img.closest ? img.closest(".plat-config-profile-avatar, .plat-avatar") : null;
    if (img) {
      img.classList.add("is-hidden");
      img.removeAttribute("src");
      img.onload = null;
      img.onerror = null;
    }
    if (fallback) {
      fallback.textContent = inicialDoNome(nome);
      fallback.classList.remove("is-hidden");
    }
    if (wrap) wrap.classList.remove("has-foto");
  }

  function mostrarAvatarFoto(img, fallback) {
    var wrap = img && img.closest ? img.closest(".plat-config-profile-avatar, .plat-avatar") : null;
    if (img) img.classList.remove("is-hidden");
    if (fallback) fallback.classList.add("is-hidden");
    if (wrap) wrap.classList.add("has-foto");
  }

  function aplicarFotoAvatar(alvos, fotoPath, nome) {
    if (!alvos || !alvos.img || !alvos.fallback) return;
    var img = alvos.img;
    var fallback = alvos.fallback;

    if (!isFotoAdminValida(fotoPath)) {
      mostrarAvatarInicial(img, fallback, nome);
      return;
    }

    var url = /^data:image|^blob:/i.test(String(fotoPath))
      ? String(fotoPath)
      : resolverUrlFoto(fotoPath, true);

    img.onload = function () {
      if (img.naturalWidth > 0) {
        mostrarAvatarFoto(img, fallback);
      } else {
        mostrarAvatarInicial(img, fallback, nome);
      }
    };
    img.onerror = function () {
      mostrarAvatarInicial(img, fallback, nome);
    };
    img.alt = "Foto de " + (nome || "administrador");
    img.src = url;
    if (img.complete && img.naturalWidth > 0) {
      mostrarAvatarFoto(img, fallback);
    }
  }

  function avatarAlvosPerfilCard() {
    if (!els.configAdminAvatar || !els.configAdminAvatarFallback) return null;
    return { img: els.configAdminAvatar, fallback: els.configAdminAvatarFallback };
  }

  function aplicarFotoPerfil(fotoPath, nome) {
    aplicarFotoAvatar(avatarAlvosPerfilCard(), fotoPath, nome);
    aplicarFotoAvatar(garantirImgAvatarHeader(), fotoPath, nome);
  }

  function registrarArquivoFoto(file) {
    if (!file) return;
    fotoArquivoPendente = file;
    fotoBase64Pendente = "";
    var reader = new FileReader();
    reader.onload = function () {
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
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(typeof reader.result === "string" ? reader.result : "");
      };
      reader.onerror = function () {
        reject(new Error("read"));
      };
      reader.readAsDataURL(file);
    });
  }

  function anexarFotoAoFormData(fd) {
    var file = fotoArquivoPendente;
    if (!file && els.modalFileInput && els.modalFileInput.files && els.modalFileInput.files[0]) {
      file = els.modalFileInput.files[0];
    }
    if (file) {
      return fileParaBase64(file).then(function (b64) {
        if (b64 && b64.indexOf("data:image") === 0) {
          fd.append("foto_base64", b64);
        } else {
          fd.append("foto", file);
        }
      });
    }
    if (fotoBase64Pendente) {
      fd.append("foto_base64", fotoBase64Pendente);
    }
    return Promise.resolve();
  }

  function preencherPainel(admin) {
    adminAtual = admin;
    var nome = admin.nome || "Administrador";
    var email = admin.email || "";
    var cargo = admin.cargo_label || admin.cargo || "Administrador da plataforma";

    if (els.profileName) els.profileName.textContent = nome;
    if (els.profileEmail) els.profileEmail.textContent = email || "—";
    if (els.profileRole) els.profileRole.textContent = cargo;
    if (els.configAdminName) els.configAdminName.textContent = nome;
    if (els.configAdminEmail) els.configAdminEmail.textContent = email || "—";
    if (els.configAdminCargo) els.configAdminCargo.textContent = cargo;
    if (els.profileInitial) els.profileInitial.textContent = inicialDoNome(nome);

    aplicarFotoPerfil(admin.foto_perfil, nome);

    if (window.PlatAdmShell && typeof window.PlatAdmShell.applyAdminUi === "function") {
      window.PlatAdmShell.applyAdminUi(admin);
    }

    if (window.PlatConfigAdm && typeof window.PlatConfigAdm.atualizarAdminNaLista === "function") {
      window.PlatConfigAdm.atualizarAdminNaLista(admin);
    }
  }

  function emailModalMudou() {
    var atual = emailVerificacao.emailOriginal || (adminAtual && adminAtual.email) || "";
    var novo = els.modalEmail ? els.modalEmail.value.trim() : "";
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
    var adminRef = admin || adminAtual || {};
    var emailMask = adminRef.email_mascarado || adminRef.email || "—";
    if (els.modalEmailCanalEmail) els.modalEmailCanalEmail.textContent = emailMask;

    var mudou = emailModalMudou();
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

    var pendente = (els.modalEmail && els.modalEmail.value.trim()) || "";
    if (
      adminRef.email_alteracao_verificado &&
      adminRef.email_alteracao_pendente &&
      pendente.toLowerCase() === String(adminRef.email_alteracao_pendente).toLowerCase()
    ) {
      emailVerificacao.verificado = true;
      if (els.modalEmailVerifyOk) els.modalEmailVerifyOk.classList.remove("hidden");
    } else if (!emailVerificacao.verificado && els.modalEmailVerifyOk) {
      els.modalEmailVerifyOk.classList.add("hidden");
    }
  }

  function enviarCodigoEmail(reenviar) {
    if (!emailModalMudou()) {
      mostrarToast("Informe um novo e-mail diferente do atual.", true);
      return;
    }

    var novoEmail = els.modalEmail ? els.modalEmail.value.trim() : "";
    var confirmEmail = els.modalConfirmEmail ? els.modalConfirmEmail.value.trim() : "";
    if (!novoEmail || !confirmEmail || novoEmail !== confirmEmail) {
      mostrarToast("Preencha e confirme o novo e-mail antes de enviar o código.", true);
      return;
    }

    var fd = new FormData();
    fd.append("acao", reenviar ? "reenviar" : "enviar");
    fd.append("novo_email", novoEmail);
    fd.append("canal", "email");

    if (els.btnEnviarCodigoEmail) els.btnEnviarCodigoEmail.disabled = true;
    if (els.btnReenviarCodigoEmail) els.btnReenviarCodigoEmail.disabled = true;

    fetch(VERIFICAR_EMAIL_URL, {
      method: "POST",
      body: fd,
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(function (r) {
        return r.text().then(parseJsonServidor);
      })
      .then(function (data) {
        if (!data || data.sucesso !== true) {
          throw new Error((data && data.erro) || "Não foi possível enviar o código.");
        }
        emailVerificacao.codigoEnviado = true;
        emailVerificacao.verificado = false;
        if (els.modalEmailVerifyOk) els.modalEmailVerifyOk.classList.add("hidden");
        if (els.modalEmailCodigoWrap) els.modalEmailCodigoWrap.classList.remove("hidden");
        if (els.btnReenviarCodigoEmail) els.btnReenviarCodigoEmail.classList.remove("hidden");
        if (els.modalEmailVerifyHint) {
          var hint = data.mensagem || "Código enviado.";
          if (data.codigo_para_teste) hint += " Código (modo local): " + data.codigo_para_teste;
          els.modalEmailVerifyHint.textContent = hint;
        }
        if (els.modalEmailCodigo) els.modalEmailCodigo.focus();
        mostrarToast(data.mensagem || "Código enviado.");
      })
      .catch(function (err) {
        mostrarToast(err.message || "Erro de conexão ao enviar o código.", true);
      })
      .finally(function () {
        if (els.btnEnviarCodigoEmail) els.btnEnviarCodigoEmail.disabled = false;
        if (els.btnReenviarCodigoEmail) els.btnReenviarCodigoEmail.disabled = false;
      });
  }

  function verificarCodigoEmail() {
    var novoEmail = els.modalEmail ? els.modalEmail.value.trim() : "";
    var codigo = els.modalEmailCodigo ? els.modalEmailCodigo.value.replace(/\D/g, "") : "";

    if (!emailModalMudou()) {
      mostrarToast("Altere o e-mail antes de verificar.", true);
      return;
    }
    if (codigo.length !== 6) {
      if (els.modalEmailCodigoError) els.modalEmailCodigoError.textContent = "Digite os 6 números.";
      return;
    }
    if (els.modalEmailCodigoError) els.modalEmailCodigoError.textContent = "";

    var fd = new FormData();
    fd.append("acao", "verificar");
    fd.append("novo_email", novoEmail);
    fd.append("codigo", codigo);

    if (els.btnConfirmarCodigoEmail) els.btnConfirmarCodigoEmail.disabled = true;

    fetch(VERIFICAR_EMAIL_URL, {
      method: "POST",
      body: fd,
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(function (r) {
        return r.text().then(parseJsonServidor);
      })
      .then(function (data) {
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
      })
      .catch(function () {
        mostrarToast("Erro de conexão ao verificar o código.", true);
      })
      .finally(function () {
        if (els.btnConfirmarCodigoEmail) els.btnConfirmarCodigoEmail.disabled = false;
      });
  }

  function limparErrosModal() {
    ["modalEmailError", "modalConfirmEmailError", "modalPasswordError", "modalConfirmPasswordError", "modalEmailCodigoError"].forEach(
      function (id) {
        var el = document.getElementById(id);
        if (el) el.textContent = "";
      }
    );
    [els.modalEmail, els.modalConfirmEmail, els.modalPassword, els.modalConfirmPassword, els.modalAdminNomeInput].forEach(
      function (input) {
        if (input) input.classList.remove("input-error");
      }
    );
  }

  function validarModalPerfil() {
    limparErrosModal();
    var email = els.modalEmail ? els.modalEmail.value.trim() : "";
    var confirmEmail = els.modalConfirmEmail ? els.modalConfirmEmail.value.trim() : "";
    var senha = els.modalPassword ? els.modalPassword.value : "";
    var confirmSenha = els.modalConfirmPassword ? els.modalConfirmPassword.value : "";
    var ok = true;

    function setErr(id, input, msg) {
      var el = document.getElementById(id);
      if (el) el.textContent = msg;
      if (input) input.classList.add("input-error");
      ok = false;
    }

    var nome = obterNomeModal();
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
      setErr("modalEmailCodigoError", els.modalEmailCodigo, "Confirme o código enviado ao e-mail atual.");
      ok = false;
    }

    return ok;
  }

  function obterNomeModal() {
    return els.modalAdminNomeInput ? els.modalAdminNomeInput.value.trim() : "";
  }

  function exibirFotoModal(url) {
    if (!els.modalFoto || !url) return;
    var mostrar = function () {
      if (els.modalFoto.naturalWidth <= 0) {
        if (els.modalFotoBox) els.modalFotoBox.classList.remove("has-foto");
        if (els.modalFotoInicial) els.modalFotoInicial.style.display = "";
        els.modalFoto.removeAttribute("src");
        return;
      }
      if (els.modalFotoBox) els.modalFotoBox.classList.add("has-foto");
      if (els.modalFotoInicial) els.modalFotoInicial.style.display = "none";
    };
    els.modalFoto.onload = mostrar;
    els.modalFoto.onerror = function () {
      if (els.modalFotoBox) els.modalFotoBox.classList.remove("has-foto");
      if (els.modalFotoInicial) els.modalFotoInicial.style.display = "";
      els.modalFoto.removeAttribute("src");
    };
    els.modalFoto.src = url;
    if (els.modalFoto.complete && els.modalFoto.naturalWidth > 0) mostrar();
  }

  function aplicarFotoModal(fotoPath, nome) {
    if (!els.modalFoto) return;
    if (els.modalFotoInicial) {
      els.modalFotoInicial.textContent = inicialDoNome(nome);
      els.modalFotoInicial.style.display = "";
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
    if (els.modalFotoBox) els.modalFotoBox.classList.remove("has-foto");
    if (els.modalFoto) els.modalFoto.removeAttribute("src");
  }

  function preencherModalEditar(admin, focoSenha) {
    if (!admin) return;
    var nome = admin.nome || "Administrador";
    var email = admin.email || "";
    var cargo = admin.cargo || "Administrador da plataforma";

    if (els.modalAdminNomeInput) els.modalAdminNomeInput.value = nome;
    if (els.modalCargo) els.modalCargo.value = cargo;
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
      window.setTimeout(function () {
        els.modalPassword.focus();
      }, 120);
    }
  }

  function abrirModalEditar(focoSenha) {
    if (!els.editModal) return;
    if (!adminAtual) {
      carregarPerfilCompleto().then(function () {
        preencherModalEditar(adminAtual, focoSenha);
        els.editModal.classList.remove("hidden");
        document.body.classList.add("plat-modal-open");
      });
      return;
    }
    preencherModalEditar(adminAtual, focoSenha);
    els.editModal.classList.remove("hidden");
    document.body.classList.add("plat-modal-open");
  }

  function fecharModalEditar() {
    if (!els.editModal) return;
    els.editModal.classList.add("hidden");
    document.body.classList.remove("plat-modal-open");
    if (els.modalSaveOverlay) els.modalSaveOverlay.classList.add("hidden");
  }

  function salvarPerfilModal() {
    if (!validarModalPerfil()) return;
    if (els.modalSaveOverlay) els.modalSaveOverlay.classList.add("hidden");

    var fd = new FormData();
    var nome = obterNomeModal();
    if (!nome) {
      mostrarToast("Informe o nome do administrador.", true);
      return;
    }
    fd.append("nome", nome);
    if (els.modalCargo) fd.append("cargo", els.modalCargo.value.trim());
    if (els.modalEmail) fd.append("email", els.modalEmail.value.trim());
    if (els.modalConfirmEmail) fd.append("confirmaremail", els.modalConfirmEmail.value.trim());
    if (els.modalPassword) fd.append("senha", els.modalPassword.value);
    if (els.modalConfirmPassword) fd.append("confirmarsenha", els.modalConfirmPassword.value);

    var enviouFoto = Boolean(
      fotoArquivoPendente ||
        fotoBase64Pendente ||
        (els.modalFileInput && els.modalFileInput.files && els.modalFileInput.files[0])
    );

    var btn = document.getElementById("btnSaveEditProfile");

    anexarFotoAoFormData(fd)
      .then(function () {
        if (btn) btn.disabled = true;
        return fetch(SALVAR_PERFIL_URL, {
          method: "POST",
          body: fd,
          credentials: "same-origin",
          cache: "no-store",
        });
      })
      .then(function (r) {
        return r.text().then(parseJsonServidor);
      })
      .then(function (data) {
        if (!data || data.sucesso !== true) {
          throw new Error((data && data.erro) || "Não foi possível salvar o perfil.");
        }
        if (enviouFoto && !data.foto_perfil && !(data.admin && data.admin.foto_perfil)) {
          mostrarToast(
            "Perfil salvo, mas a foto não foi gravada. Verifique a pasta uploads ou tente outra imagem.",
            true
          );
        }
        limparFotoPendente();
        fecharModalEditar();
        return recarregarPerfilAdmin();
      })
      .then(function () {
        if (!enviouFoto || (adminAtual && adminAtual.foto_perfil)) {
          mostrarToast("Perfil atualizado com sucesso.");
        }
      })
      .catch(function (err) {
        mostrarToast(err.message || "Erro de conexão ao salvar o perfil.", true);
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function recarregarPerfilAdmin() {
    return fetch(PERFIL_URL, { credentials: "same-origin", cache: "no-store" })
      .then(function (r) {
        return r.text().then(parseJsonServidor);
      })
      .then(function (data) {
        if (!data || data.sucesso !== true || !data.admin) {
          throw new Error((data && data.erro) || "Não foi possível recarregar o perfil.");
        }
        adminAtual = data.admin;
        preencherPainel(data.admin);
        return data.admin;
      });
  }

  function carregarPerfilCompleto() {
    return recarregarPerfilAdmin().then(function (admin) {
      var hash = (window.location.hash || "").toLowerCase();
      if (hash === "#senha" || hash === "#editar-perfil" || hash === "#editar") {
        abrirModalEditar(hash === "#senha");
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      return admin;
    });
  }

  function configurarModalEditar() {
    if (els.btnEditProfile) {
      els.btnEditProfile.addEventListener("click", function () {
        abrirModalEditar(false);
      });
    }
    if (els.btnChangePassword) {
      els.btnChangePassword.addEventListener("click", function () {
        abrirModalEditar(true);
      });
    }
    if (els.btnCloseEditProfile) els.btnCloseEditProfile.addEventListener("click", fecharModalEditar);
    if (els.btnCancelEditProfile) els.btnCancelEditProfile.addEventListener("click", fecharModalEditar);
    if (els.editBackdrop) els.editBackdrop.addEventListener("click", fecharModalEditar);

    if (els.editProfileForm) {
      els.editProfileForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!validarModalPerfil()) return;
        if (els.modalSaveOverlay) els.modalSaveOverlay.classList.remove("hidden");
      });
    }

    if (els.modalCancelSaveBtn) {
      els.modalCancelSaveBtn.addEventListener("click", function () {
        if (els.modalSaveOverlay) els.modalSaveOverlay.classList.add("hidden");
      });
    }
    var saveConfirmBackdrop = document.getElementById("modalSaveConfirmBackdrop");
    if (saveConfirmBackdrop) {
      saveConfirmBackdrop.addEventListener("click", function () {
        if (els.modalSaveOverlay) els.modalSaveOverlay.classList.add("hidden");
      });
    }
    if (els.modalConfirmSaveBtn) {
      els.modalConfirmSaveBtn.addEventListener("click", salvarPerfilModal);
    }

    if (els.modalEmail) {
      els.modalEmail.addEventListener("input", function () {
        emailVerificacao.verificado = false;
        if (adminAtual) adminAtual.email_alteracao_verificado = false;
        atualizarPainelVerificacaoEmail(adminAtual);
      });
    }
    if (els.modalConfirmEmail) {
      els.modalConfirmEmail.addEventListener("input", function () {
        atualizarPainelVerificacaoEmail(adminAtual);
      });
    }
    if (els.btnEnviarCodigoEmail) {
      els.btnEnviarCodigoEmail.addEventListener("click", function () {
        enviarCodigoEmail(false);
      });
    }
    if (els.btnReenviarCodigoEmail) {
      els.btnReenviarCodigoEmail.addEventListener("click", function () {
        enviarCodigoEmail(true);
      });
    }
    if (els.btnConfirmarCodigoEmail) {
      els.btnConfirmarCodigoEmail.addEventListener("click", verificarCodigoEmail);
    }
    if (els.modalEmailCodigo) {
      els.modalEmailCodigo.addEventListener("input", function () {
        els.modalEmailCodigo.value = els.modalEmailCodigo.value.replace(/\D/g, "").slice(0, 6);
        if (els.modalEmailCodigoError) els.modalEmailCodigoError.textContent = "";
        if (els.modalEmailCodigo.value.length === 6) verificarCodigoEmail();
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && els.editModal && !els.editModal.classList.contains("hidden")) {
        if (els.modalSaveOverlay && !els.modalSaveOverlay.classList.contains("hidden")) {
          if (els.modalSaveOverlay) els.modalSaveOverlay.classList.add("hidden");
        } else {
          fecharModalEditar();
        }
      }
    });
  }

  function boot() {
    if (!els.editModal) return;
    configurarModalEditar();

    var iniciar = function () {
      carregarPerfilCompleto().catch(function (err) {
        mostrarToast(err.message || "Erro ao carregar perfil.", true);
      });
    };

    if (window.PlatAdmShell && typeof window.PlatAdmShell.init === "function") {
      window.PlatAdmShell.init().then(iniciar).catch(iniciar);
    } else {
      iniciar();
    }
  }

  window.PlatAdmPerfil = {
    abrirModalEditar: abrirModalEditar,
    carregarPerfil: carregarPerfilCompleto,
    getAdminAtual: function () {
      return adminAtual;
    },
  };

  window.ecoRegistrarFotoPlatAdmin = registrarArquivoFoto;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
