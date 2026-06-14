document.addEventListener('DOMContentLoaded', async function () {
  function redirectPerfilLogin() {
    var root = window.ecocoletaProjectRoot || '/';
    window.location.replace(root + 'auth/login.html?redirect=' + encodeURIComponent('pages/perfil.html'));
  }

  function bloquearPerfilVisitante() {
    ['loggedIn', 'userId', 'userName', 'userEmail'].forEach(function (key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {

      }
    });
    redirectPerfilLogin();
  }

  if (localStorage.getItem('loggedIn') !== 'true') {
    redirectPerfilLogin();
    return;
  }

  const botaoMais = document.querySelector("button.btn-mais");
  const celulas = document.querySelectorAll(".celula");
  const notificacoes = document.querySelectorAll(".notificacao");
  const historicos = document.querySelectorAll(".item-historico");
  const pontosPerfil = document.querySelector("#user-points");
  const profileDisplayName = document.getElementById('profileDisplayName');
  const profileDisplayEmail = document.getElementById('profileDisplayEmail');
  const perfilNotificacoesLista = document.getElementById('perfil-notificacoes-lista');
  const perfilNotificacoesCount = document.getElementById('perfil-notificacoes-count');
  const perfilNotificacoesRefresh = document.getElementById('perfil-notificacoes-refresh');

  let perfilAtual = {
    id: null,
    nome: '',
    email: '',
    saldo_ecopoints: null,
    endereco: { rua: '', bairro: '', numero: '', cidade: '', complemento: '', cep: '' },
  };

  function formatarCepExibicao(cep) {
    const digitos = String(cep || '').replace(/\D/g, '');
    if (digitos.length === 8) {
      return digitos.slice(0, 5) + '-' + digitos.slice(5);
    }
    const limpo = String(cep || '').trim();
    return limpo || '—';
  }

  function normalizarEnderecoPerfil(raw) {
    const e = raw && typeof raw === 'object' ? raw : {};
    return {
      rua: String(e.rua != null ? e.rua : '').trim(),
      bairro: String(e.bairro != null ? e.bairro : '').trim(),
      numero: String(e.numero != null ? e.numero : '').trim(),
      cidade: String(e.cidade != null ? e.cidade : '').trim(),
      complemento: String(e.complemento != null ? e.complemento : '').trim(),
      cep: String(e.cep != null ? e.cep : '').trim(),
    };
  }

  function enderecoTemColeta(endereco) {
    return !!(endereco && String(endereco.rua || '').trim());
  }

  function rotuloLogradouro(rua) {
    const r = String(rua || '').trim();
    if (!r) {
      return 'Rua/Avenida: —';
    }
    if (/^(rua|avenida|av\.?|travessa|alameda|rodovia|estrada)\b/i.test(r)) {
      return r.charAt(0).toUpperCase() + r.slice(1);
    }
    return 'Rua: ' + r;
  }

  function linhaEnderecoRotulo(rotulo, valor) {
    const v = String(valor || '').trim();
    return rotulo + ': ' + (v || '—');
  }

  function renderizarEnderecoPerfil(endereco) {
    const e = normalizarEnderecoPerfil(endereco);
    const tem = enderecoTemColeta(e);
    const box = document.getElementById('perfilEnderecoBox');
    const btnEndereco = document.getElementById('editarEnderecoBtn');
    const tag = document.getElementById('perfilEnderecoTag');
    const cidadeEl = document.getElementById('perfilEnderecoCidade');
    const linha1 = document.getElementById('perfilEnderecoLinha1');
    const linha2 = document.getElementById('perfilEnderecoLinha2');
    const linha3 = document.getElementById('perfilEnderecoLinha3');
    const linha4 = document.getElementById('perfilEnderecoLinha4');
    const linha5 = document.getElementById('perfilEnderecoLinha5');

    if (box) {
      box.classList.toggle('endereco-box--sem-endereco', !tem);
    }
    if (btnEndereco) {
      btnEndereco.textContent = tem ? 'Editar endereço' : 'Cadastrar endereço';
    }

    if (!tem) {
      return;
    }

    if (tag) {
      tag.textContent = 'Atualizado';
      tag.classList.remove('is-empty');
    }

    if (cidadeEl) {
      cidadeEl.textContent = linhaEnderecoRotulo('Cidade', e.cidade);
      cidadeEl.style.display = '';
    }
    if (linha1) {
      linha1.textContent = linhaEnderecoRotulo('CEP', formatarCepExibicao(e.cep));
      linha1.style.display = '';
    }
    if (linha2) {
      linha2.textContent = rotuloLogradouro(e.rua);
      linha2.style.display = '';
    }
    if (linha3) {
      linha3.textContent = linhaEnderecoRotulo('Número', e.numero);
      linha3.style.display = '';
    }
    if (linha4) {
      linha4.textContent = linhaEnderecoRotulo('Bairro', e.bairro);
      linha4.style.display = '';
    }
    if (linha5) {
      if (e.complemento) {
        linha5.textContent = linhaEnderecoRotulo('Complemento', e.complemento);
        linha5.style.display = '';
      } else {
        linha5.textContent = '';
        linha5.style.display = 'none';
      }
    }
  }

  function syncEnderecoModalFromPerfil() {
    const e = normalizarEnderecoPerfil(perfilAtual.endereco);
    const setVal = function (id, val) {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };
    setVal('modalRua', e.rua);
    setVal('modalBairro', e.bairro);
    setVal('modalNumero', e.numero);
    setVal('modalCidadeEstado', e.cidade);
    setVal('modalComplemento', e.complemento);
    let cepModal = e.cep || '';
    if (!cepModal) {
      try {
        cepModal = localStorage.getItem('userCep') || '';
      } catch (eCep) {

      }
    }
    setVal('modalCep', cepModal);
  }

  function uiAlert(message, variant) {
    if (window.UserPopup && typeof window.UserPopup.alert === 'function') {
      return window.UserPopup.alert(message, { variant: variant || 'info' });
    }
    window.alert(message);
    return Promise.resolve();
  }

  function obterUrlServidor(arquivoPhp) {
    if (window.location.protocol === 'file:') {
      return null;
    }
    var prefix = /\/(pages|auth|admin|mapa)\//.test(window.location.pathname) ? "../" : "";
    return new URL(prefix + arquivoPhp, window.location.href).href;
  }

  function normalizarSaldoEcopoints(val) {
    if (val == null || val === '') return null;
    if (typeof val === 'number' && !Number.isNaN(val)) {
      return Math.max(0, Math.floor(val));
    }
    if (typeof val === 'string') {
      const n = parseInt(String(val).replace(/\D/g, ''), 10);
      if (!Number.isNaN(n) && n >= 0) return n;
    }
    return null;
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

  function escHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function tempoRelativoPerfil(iso) {
    if (!iso) return '';
    const data = new Date(iso);
    if (Number.isNaN(data.getTime())) return '';
    const min = Math.floor(Math.max(0, Date.now() - data.getTime()) / 60000);
    if (min < 1) return 'agora mesmo';
    if (min < 60) return 'há ' + min + ' minuto' + (min === 1 ? '' : 's');
    const horas = Math.floor(min / 60);
    if (horas < 24) return 'há ' + horas + ' hora' + (horas === 1 ? '' : 's');
    const dias = Math.floor(horas / 24);
    return 'há ' + dias + ' dia' + (dias === 1 ? '' : 's');
  }

  async function postNotificacaoPerfil(acao, extra) {
    const url = obterUrlServidor('notificacoes.php');
    if (!url) throw new Error('FILE_PROTOCOL');
    const body = new URLSearchParams();
    body.set('acao', acao);
    if (extra && typeof extra === 'object') {
      Object.keys(extra).forEach((key) => body.set(key, String(extra[key])));
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body.toString(),
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const text = await res.text();
    return parseJsonServidor(text);
  }

  function renderizarNotificacoesPerfil(data) {
    if (!perfilNotificacoesLista) return;

    const importantes = (data && Array.isArray(data.importantes)) ? data.importantes : [];
    const outras = (data && Array.isArray(data.outras)) ? data.outras : [];
    const todas = importantes.concat(outras).slice(0, 6);
    const naoLidas = Math.max(0, parseInt(data && data.nao_lidas, 10) || 0);

    if (perfilNotificacoesCount) {
      perfilNotificacoesCount.textContent = naoLidas === 1 ? '1 nova' : naoLidas + ' novas';
      perfilNotificacoesCount.classList.toggle('is-empty', naoLidas === 0);
    }

    if (!todas.length) {
      perfilNotificacoesLista.innerHTML = '<p class="notificacoes-status">Você não tem notificações no momento.</p>';
      return;
    }

    const iconMap = { green: '♻️', yellow: '🏆', purple: '📅', bell: '🔔' };
    perfilNotificacoesLista.innerHTML = todas.map((n) => {
      const iconeKey = n.icone || 'bell';
      const icone = iconMap[iconeKey] || iconMap.bell;
      const badge = n.badge ? '<span class="notificacao-badge">' + escHtml(n.badge) + '</span>' : '';
      const unread = n.lida ? '' : ' notificacao--unread';
      return (
        '<article class="notificacao' + unread + '" data-id="' + escHtml(n.id) + '">' +
          '<span class="notificacao-icone ' + escHtml(iconeKey) + '">' + icone + '</span>' +
          '<div class="notificacao-conteudo">' +
            '<strong>' + escHtml(n.titulo || 'Notificação') + '</strong>' +
            '<p>' + escHtml(n.mensagem || '') + '</p>' +
            '<span>' + escHtml(tempoRelativoPerfil(n.criado_em)) + '</span>' +
          '</div>' +
          badge +
        '</article>'
      );
    }).join('');
  }

  async function carregarNotificacoesPerfil() {
    if (!perfilNotificacoesLista) return;
    perfilNotificacoesLista.innerHTML = '<p class="notificacoes-status">Carregando notificações...</p>';
    try {
      const data = await postNotificacaoPerfil('listar');
      if (!data || data.sucesso !== true) {
        const msg = data && data.erro ? data.erro : 'Não foi possível carregar as notificações.';
        perfilNotificacoesLista.innerHTML = '<p class="notificacoes-status is-error">' + escHtml(msg) + '</p>';
        return;
      }
      renderizarNotificacoesPerfil(data);
    } catch (e) {
      perfilNotificacoesLista.innerHTML = '<p class="notificacoes-status is-error">Erro ao conectar com o servidor de notificações.</p>';
    }
  }

  function aplicarPerfilLocalFallback() {
    const n = localStorage.getItem('userName') || '';
    const e = localStorage.getItem('userEmail') || '';
    perfilAtual = { id: localStorage.getItem('userId'), nome: n, email: e, saldo_ecopoints: null };
    if (profileDisplayName) profileDisplayName.textContent = n || '—';
    if (profileDisplayEmail) profileDisplayEmail.textContent = e || '—';
    const mn = document.getElementById('modalNome');
    if (mn) mn.textContent = n || '—';
  }

  async function carregarPerfilServidor() {
    const url = obterUrlServidor('meu_perfil.php');
    if (!url) {
      bloquearPerfilVisitante();
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(function () {
      controller.abort();
    }, 3000);
    try {
      let data;
      if (window.EcoColetaFetch && typeof window.EcoColetaFetch.fetchJson === 'function') {
        clearTimeout(timeoutId);
        data = await window.EcoColetaFetch.fetchJson(url, {
          cacheKey: 'meu_perfil',
          ttlMs: 90000,
          signal: controller.signal,
        });
      } else {
        const res = await fetch(url, { method: 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId);
        const text = await res.text();
        try {
          data = parseJsonServidor(text);
        } catch (e) {
          bloquearPerfilVisitante();
          return;
        }
      }
      try {
        window.dispatchEvent(new CustomEvent('ecocoleta:profile-loaded', { detail: data }));
      } catch (eEvt) {}
      if (!data || data.sucesso !== true || !data.usuario || typeof data.usuario !== 'object') {
        bloquearPerfilVisitante();
        return;
      }
      const u = data.usuario;
      const enderecoSrv = normalizarEnderecoPerfil(u.endereco);
      if (!enderecoSrv.cep) {
        try {
          const cepLocal = localStorage.getItem('userCep') || '';
          if (cepLocal) {
            enderecoSrv.cep = cepLocal;
          }
        } catch (eCepLoad) {

        }
      }
      perfilAtual = {
        id: u.id,
        nome: (u.nome != null) ? String(u.nome) : '',
        email: (u.email != null) ? String(u.email) : '',
        saldo_ecopoints: normalizarSaldoEcopoints(u.saldo_ecopoints),
        endereco: enderecoSrv,
        tem_endereco_coleta: enderecoTemColeta(enderecoSrv),
      };
      renderizarEnderecoPerfil(enderecoSrv);
      localStorage.setItem('loggedIn', 'true');
      localStorage.setItem('userId', String(perfilAtual.id));
      localStorage.setItem('userName', perfilAtual.nome);
      localStorage.setItem('userEmail', perfilAtual.email);
      const fp = u.foto_perfil != null ? String(u.foto_perfil).trim() : '';
      if (fp) {
        try {
          localStorage.setItem(
            'userFoto',
            fp,
          );
        } catch (eFoto) {

        }
      }
      if (profileDisplayName) profileDisplayName.textContent = perfilAtual.nome || '—';
      if (profileDisplayEmail) profileDisplayEmail.textContent = perfilAtual.email || '—';
      const mnLoad = document.getElementById('modalNome');
      if (mnLoad) mnLoad.textContent = perfilAtual.nome || '—';
      document.documentElement.classList.remove('perfil-auth-checking');
    } catch (err) {
      clearTimeout(timeoutId);
      bloquearPerfilVisitante();
    }
  }

  await carregarPerfilServidor();
  carregarNotificacoesPerfil();

  if (perfilNotificacoesRefresh) {
    perfilNotificacoesRefresh.addEventListener('click', carregarNotificacoesPerfil);
  }

  window.addEventListener('ecocoleta:notificacoes-atualizar', function () {
    carregarNotificacoesPerfil();
    void sincronizarPontosComServidor();
  });
  window.addEventListener('ecocoleta:notificacoes-lidas', carregarNotificacoesPerfil);

  window.addEventListener('ecocoleta:saldo-atualizar', function (ev) {
    const saldo = ev && ev.detail ? normalizarSaldoEcopoints(ev.detail.saldo_ecopoints) : null;
    if (saldo !== null) {
      aplicarPontosNoPerfil(saldo);
    }
  });

  const PONTOS_PADRAO = 0;

  function aplicarPontosNoPerfil(valor) {
    const n = normalizarSaldoEcopoints(valor);
    const exibir = n !== null ? n : PONTOS_PADRAO;
    perfilAtual.saldo_ecopoints = exibir;
    try {
      localStorage.setItem('userPoints', String(exibir));
    } catch (ePts) {

    }
    if (pontosPerfil) {
      pontosPerfil.textContent = exibir.toLocaleString('pt-BR') + ' EcoPoints';
    }
  }

  const rawUserPoints = localStorage.getItem('userPoints');
  let userPoints = PONTOS_PADRAO;

  if (perfilAtual.saldo_ecopoints != null) {
    userPoints = perfilAtual.saldo_ecopoints;
  } else if (rawUserPoints !== null) {
    const cleanedPoints = rawUserPoints.replace(/[^\d]/g, '');
    const parsedPoints = parseInt(cleanedPoints, 10);
    if (!isNaN(parsedPoints) && parsedPoints >= 0) {
      userPoints = parsedPoints;
    }
  }

  aplicarPontosNoPerfil(userPoints);

  async function sincronizarPontosComServidor() {
    const url = obterUrlServidor('meu_perfil.php');
    if (!url) {
      return;
    }
    try {
      const res = await fetch(url, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
      const text = await res.text();
      let data;
      try {
        data = parseJsonServidor(text);
      } catch (e) {
        return;
      }
      if (!data || data.sucesso !== true || !data.usuario) {
        return;
      }
      const u = data.usuario;
      const saldoSrv = normalizarSaldoEcopoints(u.saldo_ecopoints);
      if (saldoSrv !== null) {
        aplicarPontosNoPerfil(saldoSrv);
      }
    } catch (err) {

    }
  }

  if (typeof EcoColetaAvatar !== 'undefined') {
    EcoColetaAvatar.init();
  }

  let historicoResgatesPerfil = [];

  function formatarDataResgatePerfil(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  async function carregarHistoricoResgatesServidor() {
    const url = obterUrlServidor('resgate_premio.php');
    if (!url) {
      historicoResgatesPerfil = [];
      return;
    }
    try {
      const body = new URLSearchParams();
      body.set('acao', 'listar_historico');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString(),
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const text = await res.text();
      let data;
      try {
        data = parseJsonServidor(text);
      } catch (e) {
        historicoResgatesPerfil = [];
        return;
      }
      if (data && data.sucesso === true && Array.isArray(data.historico)) {
        historicoResgatesPerfil = data.historico;
        const ids = historicoResgatesPerfil.map(function (h) {
          return h.id_beneficio;
        });
        const idsUnicos = Array.from(new Set(ids));
        try {
          localStorage.setItem('redeemedPrizes', JSON.stringify(idsUnicos));
        } catch (e2) {

        }
      } else {
        historicoResgatesPerfil = [];
      }
    } catch (err) {
      historicoResgatesPerfil = [];
    }
  }

  await carregarHistoricoResgatesServidor();

  function carregarPremiosResgatados() {
    const premiosList = document.getElementById('premios-list-perfil');
    const premiosCount = document.getElementById('premios-count');
    if (!premiosList || !premiosCount) return;

    if (!historicoResgatesPerfil.length) {
      premiosList.innerHTML = '<li class="no-premios">Nenhum prêmio resgatado ainda</li>';
      premiosCount.textContent = '0 itens';
      return;
    }

    premiosList.innerHTML = '';
    historicoResgatesPerfil.forEach(function (item) {
      const li = document.createElement('li');
      li.className = 'premio-resgatado-item';

      const main = document.createElement('div');
      main.className = 'premio-resgatado-main';

      const nome = document.createElement('span');
      nome.className = 'premio-resgatado-nome';
      nome.textContent = item.nome_premio || 'Prêmio';

      const pts = document.createElement('span');
      pts.className = 'pontos-negativos';
      const gasto = Math.abs(parseInt(item.pontos_gastos, 10) || 0);
      pts.textContent = '-' + gasto + ' pts';

      main.appendChild(nome);
      main.appendChild(pts);

      const codigoRow = document.createElement('div');
      codigoRow.className = 'premio-resgatado-codigo-row';
      const lbl = document.createElement('span');
      lbl.className = 'premio-codigo-label';
      lbl.textContent = 'Código: ';
      const code = document.createElement('code');
      code.className = 'premio-codigo-valor';
      code.textContent = item.codigo_cupom || '—';
      codigoRow.appendChild(lbl);
      codigoRow.appendChild(code);

      const dataEl = document.createElement('div');
      dataEl.className = 'premio-resgatado-data';
      dataEl.textContent = item.data_resgate
        ? 'Resgatado em ' + formatarDataResgatePerfil(item.data_resgate)
        : '';

      const detail = document.createElement('div');
      detail.className = 'card-detail';
      const top = document.createElement('div');
      top.className = 'coupon-top';
      const pCode = document.createElement('p');
      pCode.className = 'coupon-code';
      pCode.textContent = item.codigo_cupom || '—';
      const pVal = document.createElement('p');
      pVal.className = 'coupon-value';
      pVal.textContent = 'Cupom';
      top.appendChild(pCode);
      top.appendChild(pVal);
      const pTxt = document.createElement('p');
      pTxt.className = 'coupon-text';
      pTxt.textContent = 'Apresente este código no parceiro para utilizar seu benefício.';
      detail.appendChild(top);
      detail.appendChild(pTxt);

      li.appendChild(main);
      li.appendChild(codigoRow);
      if (dataEl.textContent) li.appendChild(dataEl);
      li.appendChild(detail);

      premiosList.appendChild(li);
    });

    const count = historicoResgatesPerfil.length;
    premiosCount.textContent = count + ' ' + (count === 1 ? 'item' : 'itens');
  }

  carregarPremiosResgatados();

  window.addEventListener('focus', async function () {
    await sincronizarPontosComServidor();
    await carregarHistoricoResgatesServidor();
    carregarPremiosResgatados();
  });
  window.addEventListener('pageshow', async function () {
    await sincronizarPontosComServidor();
    await carregarHistoricoResgatesServidor();
    carregarPremiosResgatados();
  });
  window.addEventListener('storage', function (ev) {
    if (ev.key === 'redeemedPrizes') {
      carregarHistoricoResgatesServidor().then(function () {
        carregarPremiosResgatados();
      });
    }
    if (ev.key === 'userPoints') {
      const cleaned = String(ev.newValue || '').replace(/[^\d]/g, '');
      const parsed = parseInt(cleaned, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        aplicarPontosNoPerfil(parsed);
      }
    }
  });
  try {
    var bcResgates = new BroadcastChannel('ecocoleta-resgates');
    bcResgates.addEventListener('message', function (ev) {
      const d = ev && ev.data;
      if (d && typeof d.saldo_ecopoints === 'number' && !Number.isNaN(d.saldo_ecopoints)) {
        aplicarPontosNoPerfil(d.saldo_ecopoints);
      }
      carregarHistoricoResgatesServidor().then(function () {
        carregarPremiosResgatados();
      });
    });
  } catch (eBc) {

  }

  const perfilModal = document.getElementById("perfilModal");
  const openPerfilModal = document.getElementById("openPerfilModal");
  const closePerfilModal = document.getElementById("closePerfilModal");
  const cancelPerfilModal = document.getElementById("cancelPerfilModal");
  const perfilForm = document.getElementById("perfilForm");
  const editNameBtn = document.getElementById("editNameBtn");
  const modalNome = document.getElementById("modalNome");
  const modalTitle = document.getElementById("modalTitle");
  const modalText = document.querySelector(".modal-text");
  const modalFoto = document.getElementById("modalFoto");
  const editarEnderecoBtn = document.getElementById("editarEnderecoBtn");
  let currentModalMode = "profile";

  function syncModalFieldsFromPerfil() {
    const em = document.getElementById('modalEmail');
    const emc = document.getElementById('modalEmailConfirm');
    const mn = document.getElementById('modalNome');
    if (mn && perfilAtual.nome) mn.textContent = perfilAtual.nome;
    if (em && perfilAtual.email) {
      em.value = perfilAtual.email;
      if (emc) emc.value = perfilAtual.email;
    }
  }

function setModalMode(mode) {
  currentModalMode = mode;

  const modalTopo = document.querySelector('#perfilModal .perfil-topo');
  if (modalTopo) {
    modalTopo.classList.toggle('hidden', mode === 'address');
  }

  const allFields = document.querySelectorAll('#perfilModal .perfil-campo');
  const addressFields = document.querySelectorAll('#perfilModal .perfil-campo.endereco-campo');
  const nonAddressFields = document.querySelectorAll('#perfilModal .perfil-campo:not(.endereco-campo)');

  if (mode === 'address') {
    if (modalTitle) {
      modalTitle.textContent = 'Editar endereço';
    }
    if (modalText) {
      modalText.textContent = 'Atualize apenas os dados do seu endereço.';
    }

    allFields.forEach(field => field.classList.add('hidden'));

    addressFields.forEach(field => field.classList.remove('hidden'));

  } else {
    if (modalTitle) {
      modalTitle.textContent = 'Editar perfil';
    }
    if (modalText) {
      modalText.textContent = 'Atualize seus dados rapidamente, sem sair da página.';
    }

    addressFields.forEach(field => field.classList.add('hidden'));

    nonAddressFields.forEach(field => field.classList.remove('hidden'));
  }
}

  function openModal(mode = 'profile') {
    if (perfilModal) {
      if (mode === 'profile') {
        syncModalFieldsFromPerfil();
        if (typeof EcoColetaAvatar !== 'undefined') {
          EcoColetaAvatar.syncModalMiniFromStorage();
        }
      } else if (mode === 'address') {
        syncModalFieldsFromPerfil();
        syncEnderecoModalFromPerfil();
      }
      setModalMode(mode);
      perfilModal.classList.remove("hidden");
      document.body.classList.add("modal-open");
    }
  }

  function closeModal() {
    if (perfilModal) {
      perfilModal.classList.add("hidden");
      document.body.classList.remove("modal-open");
    }
  }

  if (openPerfilModal) {
    openPerfilModal.addEventListener("click", function () { openModal('profile'); });
  }

  if (editarEnderecoBtn) {
    editarEnderecoBtn.addEventListener("click", function () { openModal('address'); });
  }

  if (closePerfilModal) {
    closePerfilModal.addEventListener("click", closeModal);
  }

  if (cancelPerfilModal) {
    cancelPerfilModal.addEventListener("click", closeModal);
  }

  if (perfilModal) {
    perfilModal.addEventListener("click", function (event) {
      if (event.target === perfilModal) {
        closeModal();
      }
    });
  }

  const confirmarPerfilBtn = document.getElementById("confirmarPerfilBtn");
  const saveConfirmOverlay = document.getElementById("saveConfirmOverlay");
  const confirmSaveBtn = document.getElementById("confirmSaveBtn");
  const cancelSaveBtn = document.getElementById("cancelSaveBtn");

  function showSaveConfirm() {
    if (saveConfirmOverlay) {
      saveConfirmOverlay.classList.remove("hidden");
    }
  }

  function hideSaveConfirm() {
    if (saveConfirmOverlay) {
      saveConfirmOverlay.classList.add("hidden");
    }
  }

  async function performSave() {
    const campos = Array.from(document.querySelectorAll('#perfilModal .perfil-campo input'))
      .filter(field => !field.closest('.perfil-campo').classList.contains('hidden'));
    let todosPreenchidos = true;

    campos.forEach(campo => {
      if (campo.required && campo.value.trim() === "") {
        todosPreenchidos = false;
      }
    });

    if (!todosPreenchidos) {
      await uiAlert('Preencha todos os campos obrigatórios antes de continuar.', 'error');
      return;
    }

    const emails = Array.from(document.querySelectorAll('#perfilModal .perfil-campo:not(.hidden) input[type="email"]'));
    if (emails.length >= 2 && emails[0].value !== emails[1].value) {
      await uiAlert('Os e-mails não coincidem.', 'error');
      return;
    }

    const pwdEl = document.getElementById('modalPassword');
    const pwdCEl = document.getElementById('modalPasswordConfirm');
    const p1 = pwdEl ? pwdEl.value : '';
    const p2 = pwdCEl ? pwdCEl.value : '';
    const pwdCamposVisiveis = pwdEl && pwdCEl && pwdEl.closest('.perfil-campo') && !pwdEl.closest('.perfil-campo').classList.contains('hidden');
    const bothPwdEmpty = p1 === '' && p2 === '';
    if (pwdCamposVisiveis && !bothPwdEmpty) {
      if (p1 !== p2) {
        await uiAlert('As senhas não coincidem.', 'error');
        return;
      }
      if (p1.length < 8) {
        await uiAlert('Senha deve ter pelo menos 8 caracteres.', 'error');
        return;
      }
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(p1)) {
        await uiAlert('Senha deve conter maiúscula, minúscula e número.', 'error');
        return;
      }
    }

    const cepInput = document.getElementById('modalCep');
    if (cepInput && cepInput.value.trim() && !/^\d{5}-?\d{3}$/.test(cepInput.value.trim())) {
      await uiAlert('CEP deve estar no formato 00000-000 ou 00000000.', 'error');
      return;
    }

    hideSaveConfirm();

    const apiUrl = obterUrlServidor('atualizar-perfil.php');
    if (apiUrl) {
      try {
        const fd = new FormData();
        const em = document.getElementById('modalEmail');
        const emc = document.getElementById('modalEmailConfirm');
        const emailPerfil = perfilAtual.email || '';
        if (em && !em.value.trim() && emailPerfil) {
          em.value = emailPerfil;
        }
        if (emc && !emc.value.trim() && emailPerfil) {
          emc.value = emailPerfil;
        }
        if (em) fd.append('email', em.value.trim() || emailPerfil);
        if (emc) fd.append('confirmaremail', emc.value.trim() || emailPerfil);
        if (pwdEl) fd.append('senha', p1);
        if (pwdCEl) fd.append('confirmarsenha', p2);

        const ruaInput = document.getElementById('modalRua');
        const bairroInput = document.getElementById('modalBairro');
        const numeroInput = document.getElementById('modalNumero');
        const cidadeEstadoInput = document.getElementById('modalCidadeEstado');
        const compInput = document.getElementById('modalComplemento');
        if (ruaInput) fd.append('endereco', ruaInput.value.trim());
        if (bairroInput) fd.append('bairro', bairroInput.value.trim());
        if (numeroInput) fd.append('numero', numeroInput.value.trim());
        if (cidadeEstadoInput) fd.append('cidade', cidadeEstadoInput.value.trim());
        if (compInput) fd.append('complemento', compInput.value.trim());
        if (cepInput) fd.append('cep', cepInput.value.trim());

        const fileModal = document.getElementById('avatarPerfilFileModal');
        if (fileModal && fileModal.files && fileModal.files[0]) {
          fd.append('foto', fileModal.files[0]);
        } else if (modalFoto && modalFoto.src && modalFoto.src.indexOf('data:image') === 0) {
          fd.append('foto_base64', modalFoto.src);
        }

        const res = await fetch(apiUrl, {
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
          await uiAlert('Resposta inválida do servidor.', 'error');
          return;
        }
        if (!data || data.sucesso !== true) {
          await uiAlert((data && data.erro) ? String(data.erro) : 'Não foi possível salvar.', 'error');
          return;
        }
        if (window.EcoColetaFetch && typeof window.EcoColetaFetch.invalidate === 'function') {
          window.EcoColetaFetch.invalidate('meu_perfil');
        }

        if (data.endereco && typeof data.endereco === 'object') {
          perfilAtual.endereco = normalizarEnderecoPerfil(data.endereco);
          perfilAtual.tem_endereco_coleta = enderecoTemColeta(perfilAtual.endereco);
          renderizarEnderecoPerfil(perfilAtual.endereco);
        }
      } catch (err) {
        await uiAlert('Erro de conexão ao salvar.', 'error');
        return;
      }
    }

    closeModal();

    if (currentModalMode === 'profile' && modalNome) {
      const nn = modalNome.textContent.trim();
      if (nn) {
        localStorage.setItem('userName', nn);
        perfilAtual.nome = nn;
        if (profileDisplayName) profileDisplayName.textContent = nn;
      }
    }
    if (currentModalMode === 'profile') {
      const emailInput = document.getElementById('modalEmail');
      if (emailInput && emailInput.value.trim()) {
        const ne = emailInput.value.trim();
        localStorage.setItem('userEmail', ne);
        perfilAtual.email = ne;
        if (profileDisplayEmail) profileDisplayEmail.textContent = ne;
      }
    }

    const ruaInput = document.getElementById('modalRua');
    const numeroInput = document.getElementById('modalNumero');
    const bairroInput = document.getElementById('modalBairro');
    const cidadeEstadoInput = document.getElementById('modalCidadeEstado');
    const compInput = document.getElementById('modalComplemento');

    if (cepInput && cepInput.value.trim()) {
      localStorage.setItem('userCep', cepInput.value.trim());
    }
    if (ruaInput && ruaInput.value.trim()) {
      localStorage.setItem('userRua', ruaInput.value.trim());
    }
    if (currentModalMode === 'address' || (ruaInput && ruaInput.value.trim())) {
      perfilAtual.endereco = normalizarEnderecoPerfil({
        rua: ruaInput ? ruaInput.value.trim() : perfilAtual.endereco.rua,
        bairro: bairroInput ? bairroInput.value.trim() : perfilAtual.endereco.bairro,
        numero: numeroInput ? numeroInput.value.trim() : perfilAtual.endereco.numero,
        cidade: cidadeEstadoInput ? cidadeEstadoInput.value.trim() : perfilAtual.endereco.cidade,
        complemento: compInput ? compInput.value.trim() : perfilAtual.endereco.complemento,
        cep: cepInput ? cepInput.value.trim() : perfilAtual.endereco.cep,
      });
      perfilAtual.tem_endereco_coleta = enderecoTemColeta(perfilAtual.endereco);
      renderizarEnderecoPerfil(perfilAtual.endereco);
    }
    if (numeroInput && numeroInput.value.trim()) {
      localStorage.setItem('userNumero', numeroInput.value.trim());
    }
    if (bairroInput && bairroInput.value.trim()) {
      localStorage.setItem('userBairro', bairroInput.value.trim());
    }
    if (cidadeEstadoInput && cidadeEstadoInput.value.trim()) {
      localStorage.setItem('userCidadeEstado', cidadeEstadoInput.value.trim());
    }
    if (compInput && compInput.value.trim()) {
      localStorage.setItem('userComplemento', compInput.value.trim());
    }

    if (modalFoto && modalFoto.getAttribute('src')) {
      try {
        localStorage.setItem('userFoto', modalFoto.src);
      } catch (e) {  }
    }

    await uiAlert('Perfil atualizado com sucesso!', 'success');
  }

  if (perfilForm) {
    perfilForm.addEventListener("submit", function (event) {
      event.preventDefault();
      showSaveConfirm();
    });
  }

  if (confirmarPerfilBtn) {
    confirmarPerfilBtn.addEventListener("click", function (event) {
      event.preventDefault();
      showSaveConfirm();
    });
  }

  if (confirmSaveBtn) {
    confirmSaveBtn.addEventListener("click", function () {
      void performSave();
    });
  }

  if (cancelSaveBtn) {
    cancelSaveBtn.addEventListener("click", hideSaveConfirm);
  }

  const deleteAccountOverlay = document.getElementById("deleteAccountOverlay");
  const openDeleteAccountOverlay = document.getElementById("openDeleteAccountOverlay");
  const cancelDeleteAccountBtn = document.getElementById("cancelDeleteAccountBtn");
  const confirmDeleteAccountBtn = document.getElementById("confirmDeleteAccountBtn");
  const deleteAccountError = document.getElementById("deleteAccountError");
  const logoutBtn = document.getElementById("logoutBtn");

  function limparDadosLocaisUsuario() {
    [
      "loggedIn",
      "userId",
      "userName",
      "userEmail",
      "userPoints",
      "redeemedPrizes",
      "userFoto",
      "userFotoHistory",
      "userCep",
      "userRua",
      "userNumero",
      "userBairro",
      "userCidadeEstado",
      "userComplemento",
    ].forEach(function (k) {
      try {
        localStorage.removeItem(k);
      } catch (e) {

      }
    });
    try {
      sessionStorage.removeItem("ecocheck_token");
      sessionStorage.removeItem("ecocheck_token_exp");
    } catch (e) {

    }
    if (window.EcoCheckBridge && typeof window.EcoCheckBridge.reset === "function") {
      window.EcoCheckBridge.reset();
    } else if (window.EcoCheck && typeof window.EcoCheck.clearToken === "function") {
      window.EcoCheck.clearToken();
    }
    document.dispatchEvent(new CustomEvent("ecocheck:reset"));
  }

  function showDeleteAccountOverlay() {
    if (deleteAccountError) {
      deleteAccountError.textContent = "";
      deleteAccountError.classList.add("hidden");
    }
    if (deleteAccountOverlay) {
      deleteAccountOverlay.classList.remove("hidden");
    }
  }

  function hideDeleteAccountOverlay() {
    if (deleteAccountOverlay) {
      deleteAccountOverlay.classList.add("hidden");
    }
  }

  async function executarExclusaoConta() {
    const url = obterUrlServidor("excluir_conta.php");
    if (!url) {
      if (deleteAccountError) {
        deleteAccountError.textContent = "Abra pelo servidor (não use file://).";
        deleteAccountError.classList.remove("hidden");
      }
      return;
    }
    if (confirmDeleteAccountBtn) {
      confirmDeleteAccountBtn.disabled = true;
    }
    if (deleteAccountError) {
      deleteAccountError.textContent = "";
      deleteAccountError.classList.add("hidden");
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: "confirmar=1",
        credentials: "same-origin",
        cache: "no-store",
      });
      const text = await res.text();
      let data;
      try {
        data = parseJsonServidor(text);
      } catch (e) {
        if (deleteAccountError) {
          deleteAccountError.textContent = "Resposta inválida do servidor.";
          deleteAccountError.classList.remove("hidden");
        }
        return;
      }
      if (data && data.sucesso === true) {
        limparDadosLocaisUsuario();
        hideDeleteAccountOverlay();
        if (window.UserPopup && typeof window.UserPopup.alert === "function") {
          await window.UserPopup.alert("Sua conta foi excluída. Você será redirecionado ao login.", { variant: "success" });
        }
        window.location.href = (window.ecocoletaProjectRoot || '/') + 'auth/login.html';
        return;
      }
      if (deleteAccountError) {
        deleteAccountError.textContent = (data && data.erro) ? String(data.erro) : "Não foi possível excluir a conta.";
        deleteAccountError.classList.remove("hidden");
      }
    } catch (e) {
      if (deleteAccountError) {
        deleteAccountError.textContent = "Sem conexão com o servidor.";
        deleteAccountError.classList.remove("hidden");
      }
    } finally {
      if (confirmDeleteAccountBtn) {
        confirmDeleteAccountBtn.disabled = false;
      }
    }
  }

  if (openDeleteAccountOverlay) {
    openDeleteAccountOverlay.addEventListener("click", showDeleteAccountOverlay);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      if (window.EcoColetaAuth && !window.EcoColetaAuth.isLoggedIn()) {
        window.EcoColetaAuth.open("Você ainda não está logado.");
        return;
      }
      try {
        const url = obterUrlServidor("logout.php");
        if (url) {
          await fetch(url, { method: "POST", credentials: "same-origin", cache: "no-store" });
        }
      } catch (e) {

      }
      limparDadosLocaisUsuario();
      if (window.UserPopup && typeof window.UserPopup.alert === "function") {
        await window.UserPopup.alert("Você saiu da sua conta.", { variant: "success" });
      }
      window.location.href = "tela-inicia.html";
    });
  }

  if (cancelDeleteAccountBtn) {
    cancelDeleteAccountBtn.addEventListener("click", hideDeleteAccountOverlay);
  }

  if (confirmDeleteAccountBtn) {
    confirmDeleteAccountBtn.addEventListener("click", function () {
      executarExclusaoConta();
    });
  }

  if (deleteAccountOverlay) {
    deleteAccountOverlay.addEventListener("click", function (event) {
      if (event.target === deleteAccountOverlay) {
        hideDeleteAccountOverlay();
      }
    });
  }

  if (editNameBtn && modalNome) {
    editNameBtn.addEventListener("click", async function () {
      const atual = modalNome.textContent.trim();
      let novoNome = atual;
      if (window.UserPopup && typeof window.UserPopup.prompt === "function") {
        novoNome = await window.UserPopup.prompt("Digite o novo nome:", atual, { title: "Nome no perfil" });
      } else {
        novoNome = window.prompt("Digite o novo nome:", atual);
      }
      if (novoNome === null || novoNome.trim() === "") {
        return;
      }
      novoNome = novoNome.trim();
      const urlNome = obterUrlServidor("atualizar-nome.php");
      if (!urlNome) {
        modalNome.textContent = novoNome;
        perfilAtual.nome = novoNome;
        try {
          localStorage.setItem("userName", novoNome);
        } catch (e0) {}
        if (profileDisplayName) profileDisplayName.textContent = novoNome;
        await uiAlert("Nome atualizado neste aparelho. Use http://localhost para gravar no servidor.", "info");
        return;
      }
      try {
        const res = await fetch(urlNome, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body: "nome=" + encodeURIComponent(novoNome),
          credentials: "same-origin",
          cache: "no-store",
        });
        const txt = (await res.text()).trim();
        if (txt === "sucesso") {
          modalNome.textContent = novoNome;
          perfilAtual.nome = novoNome;
          try {
            localStorage.setItem("userName", novoNome);
          } catch (e1) {}
          if (profileDisplayName) profileDisplayName.textContent = novoNome;
          await uiAlert("Nome atualizado!", "success");
        } else {
          await uiAlert("Erro ao atualizar nome no servidor.", "error");
        }
      } catch (e2) {
        await uiAlert("Erro de conexão ao atualizar nome.", "error");
      }
    });
  }

  function dispararAtualizacaoNotificacoes() {
    try {
      window.dispatchEvent(new CustomEvent("ecocoleta:notificacoes-atualizar"));
    } catch (e0) {}
  }

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const weekDayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const calendarMonthYear = document.getElementById('calendarMonthYear');
  const calendarPrev = document.getElementById('calendarPrev');
  const calendarNext = document.getElementById('calendarNext');
  const calendarDayLabels = document.querySelectorAll('.cabecalho-dias span');

  let currentCalendarDate = new Date();
  currentCalendarDate.setHours(0, 0, 0, 0);
  let agendamentosMapa = new Map();
  let agendamentoEmAndamento = false;

  function formatarDataIso(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function chaveAgendamento(dataIso, slot) {
    return `${dataIso}|${slot}`;
  }

  function marcarCelulaAgendada(celula, idAgendamento) {
    celula.classList.add("coleta");
    celula.textContent = "Coleta";
    if (idAgendamento) {
      celula.dataset.idAgendamento = String(idAgendamento);
    }
  }

  function limparCelulaAgendada(celula) {
    celula.classList.remove("coleta");
    celula.textContent = "";
    delete celula.dataset.idAgendamento;
  }

  async function apiAgendamento(acao, params) {
    const url = obterUrlServidor("agendamento_coleta.php");
    if (!url) {
      return { sucesso: false, erro: "Servidor indisponivel." };
    }
    const body = new URLSearchParams({ acao: acao });
    Object.keys(params || {}).forEach((k) => {
      if (params[k] !== undefined && params[k] !== null) {
        body.set(k, String(params[k]));
      }
    });
    const res = await fetch(url, {
      method: acao === "listar" ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: acao === "listar"
        ? undefined
        : { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: acao === "listar" ? undefined : body.toString(),
    });
    const txt = (await res.text()).trim();
    return parseJsonServidor(txt);
  }

  async function carregarAgendamentosCalendario(date) {
    const url = obterUrlServidor("agendamento_coleta.php");
    if (!url) {
      return;
    }
    const year = date.getFullYear();
    const month = date.getMonth();
    const desde = formatarDataIso(new Date(year, month, 1));
    const ate = formatarDataIso(new Date(year, month + 1, 0));
    try {
      const qs = new URLSearchParams({ acao: "listar", desde: desde, ate: ate });
      const res = await fetch(`${url}?${qs.toString()}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = parseJsonServidor((await res.text()).trim());
      agendamentosMapa = new Map();
      if (data && data.sucesso && Array.isArray(data.agendamentos)) {
        data.agendamentos.forEach((ag) => {
          agendamentosMapa.set(
            chaveAgendamento(ag.data_coleta, ag.slot_ordem),
            ag
          );
        });
      }
    } catch (eAg) {
      agendamentosMapa = new Map();
    }
  }

  function renderCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();

    calendarMonthYear.textContent = `Calendário de coleta - ${monthNames[month]} ${year}`;

    const firstDayOfMonth = new Date(year, month, 1);
    const firstWeekStart = new Date(firstDayOfMonth);
    const dayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
    firstWeekStart.setDate(firstDayOfMonth.getDate() - dayOfWeek);
    firstWeekStart.setHours(0, 0, 0, 0);

    calendarDayLabels.forEach((span, index) => {
      if (index === 0) {
        span.textContent = 'Horário';
        span.classList.remove('month-fade');
        return;
      }

      const currentDay = new Date(firstWeekStart);
      currentDay.setDate(firstWeekStart.getDate() + index - 1);
      span.textContent = `${weekDayNames[index - 1]} ${currentDay.getDate()}`;

      if (currentDay.getMonth() !== month) {
        span.classList.add('month-fade');
      } else {
        span.classList.remove('month-fade');
      }
    });

    const linhas = document.querySelectorAll(".linha-horario");
    linhas.forEach((linha, slotIndex) => {
      linha.dataset.slot = String(slotIndex);
      const celulasLinha = linha.querySelectorAll(".celula");
      celulasLinha.forEach((celula, dayIndex) => {
        const dia = new Date(firstWeekStart);
        dia.setDate(firstWeekStart.getDate() + dayIndex);
        const dataIso = formatarDataIso(dia);
        celula.dataset.date = dataIso;
        celula.dataset.slot = String(slotIndex);

        const ag = agendamentosMapa.get(chaveAgendamento(dataIso, slotIndex));
        if (ag) {
          marcarCelulaAgendada(celula, ag.id_agendamento);
        } else {
          limparCelulaAgendada(celula);
        }
      });
    });
  }

  async function refreshCalendar() {
    await carregarAgendamentosCalendario(currentCalendarDate);
    renderCalendar(currentCalendarDate);
  }

  function moradorTemEnderecoColeta() {
    if (perfilAtual && perfilAtual.tem_endereco_coleta === true) {
      return true;
    }
    return String(localStorage.getItem("userRua") || "").trim() !== "";
  }

  async function alternarAgendamentoCelula(celula) {
    if (agendamentoEmAndamento) {
      return;
    }
    const dataIso = celula.dataset.date;
    const slot = parseInt(celula.dataset.slot, 10);
    if (!dataIso || Number.isNaN(slot)) {
      return;
    }

    const hojeIso = formatarDataIso(new Date());
    if (dataIso < hojeIso) {
      await uiAlert("Nao e possivel agendar coleta em data passada.", "info");
      return;
    }

    if (!celula.classList.contains("coleta") && !moradorTemEnderecoColeta()) {
      await uiAlert(
        "Cadastre seu endereco no perfil antes de agendar uma coleta.",
        "error"
      );
      return;
    }

    agendamentoEmAndamento = true;
    try {
      if (celula.classList.contains("coleta")) {
        const params = { data_coleta: dataIso, slot_ordem: slot };
        if (celula.dataset.idAgendamento) {
          params.id_agendamento = celula.dataset.idAgendamento;
        }
        const data = await apiAgendamento("cancelar", params);
        if (!data || !data.sucesso) {
          await uiAlert((data && data.erro) || "Erro ao cancelar agendamento.", "error");
          return;
        }
        limparCelulaAgendada(celula);
        agendamentosMapa.delete(chaveAgendamento(dataIso, slot));
        await uiAlert("Agendamento cancelado.", "success");
        return;
      }

      const data = await apiAgendamento("agendar", {
        data_coleta: dataIso,
        slot_ordem: slot,
      });
      if (!data || !data.sucesso) {
        if (data && data.erro_codigo === "ja_agendado") {
          await refreshCalendar();
        }
        if (data && data.erro_codigo === "sem_endereco") {
          if (perfilAtual) perfilAtual.tem_endereco_coleta = false;
          await uiAlert(
            (data && data.erro) || "Cadastre seu endereco no perfil antes de agendar uma coleta.",
            "error"
          );
          return;
        }
        await uiAlert((data && data.erro) || "Erro ao agendar coleta.", "error");
        return;
      }
      marcarCelulaAgendada(celula, data.id_agendamento);
      agendamentosMapa.set(chaveAgendamento(dataIso, slot), {
        id_agendamento: data.id_agendamento,
        data_coleta: dataIso,
        slot_ordem: slot,
      });
      dispararAtualizacaoNotificacoes();
      await uiAlert("Coleta agendada! Voce recebera uma notificacao.", "success");
    } catch (eCal) {
      await uiAlert("Erro de conexao ao atualizar agendamento.", "error");
    } finally {
      agendamentoEmAndamento = false;
    }
  }

  function changeCalendarMonth(offset) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + offset);
    void refreshCalendar();
  }

  if (calendarPrev) {
    calendarPrev.addEventListener('click', function () {
      changeCalendarMonth(-1);
    });
  }

  if (calendarNext) {
    calendarNext.addEventListener('click', function () {
      changeCalendarMonth(1);
    });
  }

  if (botaoMais) {
    botaoMais.addEventListener("click", function () {
      void uiAlert(
        "Clique em uma celula vazia do calendario para agendar coleta. Clique de novo para cancelar.",
        "info"
      );
    });
  }

  celulas.forEach(function (celula) {
    celula.addEventListener("click", function () {
      void alternarAgendamentoCelula(celula);
    });
  });

  void refreshCalendar();

  notificacoes.forEach(function (item) {
    item.addEventListener("mouseover", function () {
      item.style.transform = "scale(1.02)";
      item.style.transition = "0.2s";
      item.style.cursor = "pointer";
    });

    item.addEventListener("mouseout", function () {
      item.style.transform = "scale(1)";
    });
  });

  historicos.forEach(function (item) {
    item.addEventListener("mouseover", function () {
      item.style.backgroundColor = "#f5f7ff";
      item.style.transition = "0.2s";
    });

    item.addEventListener("mouseout", function () {
      item.style.backgroundColor = "transparent";
    });
  });
});