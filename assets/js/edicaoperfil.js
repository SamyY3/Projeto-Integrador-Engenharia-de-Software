

(function () {
  'use strict';

  function redirectLoginEdicao() {
    var root = window.ecocoletaProjectRoot || '/';
    window.location.replace(root + 'auth/login.html?redirect=' + encodeURIComponent('pages/edicaoperfil.html'));
  }

  function bloquearEdicaoVisitante() {
    ['loggedIn', 'userId', 'userName', 'userEmail'].forEach(function (key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {

      }
    });
    redirectLoginEdicao();
  }

  if (localStorage.getItem('loggedIn') !== 'true') {
    bloquearEdicaoVisitante();
    return;
  }

  function popupAlert(message, variant) {
    if (window.UserPopup && typeof window.UserPopup.alert === 'function') {
      return window.UserPopup.alert(message, { variant: variant || 'info' });
    }
    window.alert(message);
    return Promise.resolve();
  }

  function popupPrompt(message, defaultValue, opts) {
    if (window.UserPopup && typeof window.UserPopup.prompt === 'function') {
      return window.UserPopup.prompt(message, defaultValue, opts || {});
    }
    return Promise.resolve(window.prompt(message, defaultValue != null ? String(defaultValue) : ''));
  }

  function obterUrlServidor(arquivoPhp) {
    return window.ecocoletaPhpUrl ? window.ecocoletaPhpUrl(arquivoPhp) : null;
  }

  function parseJsonServidor(text) {
    const raw = String(text || '').replace(/^\uFEFF/, '').trim();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (e1) {
      const marcas = ['{"sucesso"', '{"erro"', '{"detalhe"', '{"usuario"', '{"mensagem"'];
      let idx = -1;
      for (const m of marcas) {
        const i = raw.indexOf(m);
        if (i >= 0 && (idx < 0 || i < idx)) idx = i;
      }
      if (idx < 0) throw e1;
      let depth = 0;
      for (let i = idx; i < raw.length; i++) {
        const c = raw[i];
        if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) return JSON.parse(raw.slice(idx, i + 1));
        }
      }
      throw e1;
    }
  }

  let saveConfirmOverlay;
  let confirmSaveBtn;
  let cancelSaveBtn;

  function showSaveConfirm() {
    if (saveConfirmOverlay) {
      saveConfirmOverlay.classList.remove('hidden');
    }
  }

  function hideSaveConfirm() {
    if (saveConfirmOverlay) {
      saveConfirmOverlay.classList.add('hidden');
    }
  }

  function showError(inputId, errorId, message) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    if (input) input.classList.add('input-error');
    if (error) error.textContent = message;
  }

  function clearErrors() {
    ['editEmail', 'editConfirmEmail', 'editPassword', 'editConfirmPassword'].forEach(function (id) {
      const input = document.getElementById(id);
      if (input) input.classList.remove('input-error');
    });
    ['emailError', 'confirmEmailError', 'passwordError', 'confirmPasswordError'].forEach(function (id) {
      const error = document.getElementById(id);
      if (error) error.textContent = '';
    });
  }

  function validarPerfil() {
    clearErrors();
    const email = document.getElementById('editEmail').value.trim();
    const confirmEmail = document.getElementById('editConfirmEmail').value.trim();
    const password = document.getElementById('editPassword').value.trim();
    const confirmPassword = document.getElementById('editConfirmPassword').value.trim();
    let valid = true;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      showError('editEmail', 'emailError', 'Digite um e-mail.');
      valid = false;
    } else if (!emailPattern.test(email)) {
      showError('editEmail', 'emailError', 'Digite um e-mail válido.');
      valid = false;
    }

    if (!confirmEmail) {
      showError('editConfirmEmail', 'confirmEmailError', 'Confirme seu e-mail.');
      valid = false;
    } else if (email !== confirmEmail) {
      showError('editConfirmEmail', 'confirmEmailError', 'Os e-mails não coincidem.');
      valid = false;
    }

    const bothPwdEmpty = password === '' && confirmPassword === '';
    if (!bothPwdEmpty) {
      if (!password) {
        showError('editPassword', 'passwordError', 'Digite a nova senha ou deixe os dois campos em branco.');
        valid = false;
      } else if (password.length < 8) {
        showError('editPassword', 'passwordError', 'Senha deve ter pelo menos 8 caracteres.');
        valid = false;
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        showError('editPassword', 'passwordError', 'Senha deve conter maiúscula, minúscula e número.');
        valid = false;
      }

      if (!confirmPassword) {
        showError('editConfirmPassword', 'confirmPasswordError', 'Confirme sua senha.');
        valid = false;
      } else if (password !== confirmPassword) {
        showError('editConfirmPassword', 'confirmPasswordError', 'As senhas não coincidem.');
        valid = false;
      }
    }

    return valid;
  }

  async function confirmarPerfil(event) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    const emails = document.querySelectorAll('input[type="email"]');
    const senhas = document.querySelectorAll('input[type="password"]');

    if (emails.length >= 2 && emails[0].value !== emails[1].value) {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      await popupAlert('Os e-mails não coincidem.', 'error');
      return;
    }

    if (senhas.length >= 2 && senhas[0].value !== senhas[1].value) {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      await popupAlert('As senhas não coincidem.', 'error');
      return;
    }

    if (!validarPerfil()) {
      return;
    }

    showSaveConfirm();
  }

  window.confirmarPerfil = confirmarPerfil;

  async function performSave() {
    if (!validarPerfil()) {
      return;
    }

    hideSaveConfirm();

    const url = obterUrlServidor('atualizar-perfil.php');
    const editEmail = document.getElementById('editEmail');
    const editConfirmEmail = document.getElementById('editConfirmEmail');
    const editPassword = document.getElementById('editPassword');
    const editConfirmPassword = document.getElementById('editConfirmPassword');

    if (!url) {
      await popupAlert('Abra a página pelo servidor (http://localhost/...), não por file://, para salvar no banco.', 'info');
      return;
    }

    try {
        const fd = new FormData();
        if (editEmail) fd.append('email', editEmail.value.trim());
        if (editConfirmEmail) fd.append('confirmaremail', editConfirmEmail.value.trim());
        if (editPassword) fd.append('senha', editPassword.value);
        if (editConfirmPassword) fd.append('confirmarsenha', editConfirmPassword.value);

        const end = document.getElementById('editEndereco');
        const bai = document.getElementById('editBairro');
        const num = document.getElementById('editNumero');
        const cid = document.getElementById('editCidade');
        const comp = document.getElementById('editComplemento');
        if (end) fd.append('endereco', end.value.trim());
        if (bai) fd.append('bairro', bai.value.trim());
        if (num) fd.append('numero', num.value.trim());
        if (cid) fd.append('cidade', cid.value.trim());
        if (comp) fd.append('complemento', comp.value.trim());

        const fotoEl = document.querySelector('.foto-perfil');
        const fi = document.getElementById('fileInput');
        if (fi && fi.files && fi.files[0]) {
          fd.append('foto', fi.files[0]);
        } else if (fotoEl && fotoEl.src && fotoEl.src.indexOf('data:image') === 0) {
          fd.append('foto_base64', fotoEl.src);
        }

        const res = await fetch(url, {
          method: 'POST',
          body: fd,
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const text = await res.text();
        let data;
        try {
          data = parseJsonServidor(text);
        } catch (e) {
          await popupAlert('Resposta inválida do servidor. Verifique se o PHP não está emitindo avisos antes do JSON.', 'error');
          return;
        }
        if (!data || data.sucesso !== true) {
          await popupAlert((data && data.erro) ? String(data.erro) : 'Não foi possível salvar.', 'error');
          return;
        }
    } catch (err) {
      await popupAlert('Erro de conexão ao salvar.', 'error');
      return;
    }

    const fotoEl = document.querySelector('.foto-perfil');
    if (data && data.foto_perfil) {
      try {
        localStorage.setItem('userFoto', String(data.foto_perfil));
      } catch (e) {

      }
    } else if (fotoEl && fotoEl.src) {
      const src = String(fotoEl.src);
      const okData = src.indexOf('data:image') === 0;
      const okHttp = src.indexOf('http://') === 0 || src.indexOf('https://') === 0;
      let okPath = false;
      try {
        const p = new URL(src, window.location.href).pathname || '';
        okPath = p.indexOf('/uploads/') >= 0 || p.indexOf('/assets/images/') >= 0;
      } catch (e2) {
        okPath = false;
      }
      if (okData || okHttp || okPath) {
        try {
          localStorage.setItem('userFoto', src);
        } catch (e3) {

        }
      }
    }

    const nomeEl = document.querySelector('.nome');
    if (nomeEl && nomeEl.textContent.trim()) {
      try {
        localStorage.setItem('userName', nomeEl.textContent.trim());
      } catch (e2) {}
    }

    if (editEmail && editEmail.value.trim()) {
      try {
        localStorage.setItem('userEmail', editEmail.value.trim());
      } catch (e3) {}
    }

    await popupAlert('Perfil atualizado com sucesso!', 'success');
    window.location.href = 'perfil.html';
  }

  function initEditarNome() {
    const nome = document.querySelector('.nome');
    const lapis = document.querySelector('.lapis');

    if (!nome || !lapis) {
      return;
    }

    lapis.addEventListener('click', async function () {
      const atual = nome.textContent.trim();
      const novoNome = await popupPrompt('Digite o novo nome:', atual, { title: 'Nome no perfil' });
      if (novoNome === null || novoNome === '' || String(novoNome).trim() === '') {
        return;
      }
      const nomeTrim = String(novoNome).trim();

      const url = obterUrlServidor('atualizar-nome.php');
      if (!url) {
        nome.textContent = nomeTrim;
        try {
          localStorage.setItem('userName', nomeTrim);
        } catch (e) {}
        await popupAlert('Nome atualizado localmente. Use o servidor (não file://) para gravar no banco.', 'info');
        return;
      }

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'nome=' + encodeURIComponent(nomeTrim),
        credentials: 'same-origin',
      })
        .then(function (response) {
          return response.text();
        })
        .then(async function (data) {
          const ok = String(data).trim() === 'sucesso';
          if (ok) {
            nome.textContent = nomeTrim;
            try {
              localStorage.setItem('userName', nomeTrim);
            } catch (e2) {}
            await popupAlert('Nome atualizado!', 'success');
          } else {
            await popupAlert('Erro ao atualizar nome.', 'error');
          }
        })
        .catch(async function () {
          await popupAlert('Erro de conexão ao atualizar nome.', 'error');
        });
    });
  }

  function aplicarFotoDoArmazenamento() {
    const foto = document.querySelector('.foto-perfil');
    if (!foto) return;
    let u = '';
    try {
      u = localStorage.getItem('userFoto') || '';
    } catch (e) {
      return;
    }
    if (
      u &&
      (u.indexOf('data:image') === 0 ||
        u.indexOf('http://') === 0 ||
        u.indexOf('https://') === 0 ||
        u.indexOf('assets/images/') === 0 ||
        u.indexOf('uploads/') === 0 ||
        u.indexOf('/') === 0)
    ) {
      foto.src = u;
    }
  }

  function initTrocarFoto() {
    const camera = document.querySelector('.icone-camera');
    const foto = document.querySelector('.foto-perfil');
    const fileInput = document.getElementById('fileInput');
    const cameraBtn = document.getElementById('iconeCameraBtn');

    if (!foto || !fileInput) {
      return;
    }

    aplicarFotoDoArmazenamento();

    function abrirSeletor() {
      fileInput.click();
    }

    if (camera) {
      camera.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        abrirSeletor();
      });
    }

    if (cameraBtn) {
      cameraBtn.addEventListener('click', function (e) {
        e.preventDefault();
        abrirSeletor();
      });
    }

    fileInput.addEventListener('change', function (event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (e) {
        const result = e.target && e.target.result;
        if (typeof result === 'string') {
          foto.src = result;
          try {
            localStorage.setItem('userFoto', result);
          } catch (err) {}
        }
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    });
  }

  function preencherFallbackLocal(nomeEl, editEmail, editConfirmEmail) {
    const n = localStorage.getItem('userName') || '';
    const e = localStorage.getItem('userEmail') || '';
    if (nomeEl && n) nomeEl.textContent = n;
    if (editEmail && e) editEmail.value = e;
    if (editConfirmEmail && e) editConfirmEmail.value = e;
    aplicarFotoDoArmazenamento();
  }

  async function carregarPerfilServidor() {
    const nomeEl = document.querySelector('.editar-perfil .nome');
    const editEmail = document.getElementById('editEmail');
    const editConfirmEmail = document.getElementById('editConfirmEmail');

    if (document.body && document.body.getAttribute('data-edicao-php') === '1') {
      if (nomeEl && nomeEl.textContent.trim()) {
        try {
          localStorage.setItem('userName', nomeEl.textContent.trim());
        } catch (e0) {}
      }
      if (editEmail && editEmail.value.trim()) {
        try {
          localStorage.setItem('userEmail', editEmail.value.trim());
        } catch (e0b) {}
      }
      aplicarFotoDoArmazenamento();
      return;
    }

    const url = obterUrlServidor('meu_perfil.php');
    if (!url) {
      bloquearEdicaoVisitante();
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(function () {
      controller.abort();
    }, 3000);

    try {
      const res = await fetch(url, { method: 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      clearTimeout(timeoutId);
      const text = await res.text();
      let data;
      try {
        data = parseJsonServidor(text);
      } catch (e) {
        bloquearEdicaoVisitante();
        return;
      }
      if (!data || data.sucesso !== true || !data.usuario || typeof data.usuario !== 'object') {
        bloquearEdicaoVisitante();
        return;
      }
      const u = data.usuario;
      localStorage.setItem('userId', String(u.id));
      localStorage.setItem('userName', u.nome != null ? String(u.nome) : '');
      localStorage.setItem('userEmail', u.email != null ? String(u.email) : '');
      const fp = u.foto_perfil != null ? String(u.foto_perfil).trim() : '';
      if (fp) {
        try {
          localStorage.setItem('userFoto', fp);
        } catch (eFp) {

        }
      }
      if (nomeEl && u.nome) nomeEl.textContent = String(u.nome);
      if (editEmail && u.email) editEmail.value = String(u.email);
      if (editConfirmEmail && u.email) editConfirmEmail.value = String(u.email);
      aplicarFotoDoArmazenamento();
      document.documentElement.classList.remove('edicao-auth-checking');
    } catch (err) {
      clearTimeout(timeoutId);
      bloquearEdicaoVisitante();
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    saveConfirmOverlay = document.getElementById('saveConfirmOverlay');
    confirmSaveBtn = document.getElementById('confirmSaveBtn');
    cancelSaveBtn = document.getElementById('cancelSaveBtn');

    if (confirmSaveBtn) {
      confirmSaveBtn.addEventListener('click', performSave);
    }
    if (cancelSaveBtn) {
      cancelSaveBtn.addEventListener('click', hideSaveConfirm);
    }

    initEditarNome();
    initTrocarFoto();
    carregarPerfilServidor();
  });
})();
