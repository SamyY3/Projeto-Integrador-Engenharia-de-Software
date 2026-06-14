document.addEventListener('DOMContentLoaded', async function () {
  const resgatadosServidor = new Set();
  const PONTOS_PADRAO = 0;
  const MSG_PONTOS_INSUFICIENTES = 'Você não possui pontos suficientes para resgatar este prêmio.';
  const CUPOM_NOVO_USUARIO = 'ECOSAVE20';
  let userPoints = PONTOS_PADRAO;
  let cupomNovoUsuarioEstado = {
    codigo_cupom: CUPOM_NOVO_USUARIO,
    resgatado: false,
    elegivel: true,
    motivo: '',
  };

  function isLoggedIn() {
    if (window.EcoColetaAuth && typeof window.EcoColetaAuth.isLoggedIn === 'function') {
      return window.EcoColetaAuth.isLoggedIn();
    }
    return localStorage.getItem('loggedIn') === 'true';
  }

  function aplicarModoVisitantePremios() {
    const isGuest = !isLoggedIn();
    document.documentElement.classList.toggle('guest-mode', isGuest);
    document.body.classList.toggle('guest-mode', isGuest);
    document.querySelectorAll('[data-auth-only="true"], .points-card').forEach(function (element) {
      element.classList.toggle('is-hidden-guest', isGuest);
    });
  }

  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function avisoPremios(msg, variant) {
    const v = variant || 'info';
    if (window.UserPopup && typeof window.UserPopup.alert === 'function') {
      return window.UserPopup.alert(String(msg || ''), { variant: v });
    }
    window.alert(String(msg || ''));
    return Promise.resolve();
  }

  function isErroPontosInsuficientes(data) {
    if (!data) return false;
    if (data.erro_codigo === 'pontos_insuficientes') return true;
    const e = String(data.erro || '').toLowerCase();
    return e.indexOf('pontos suficientes') !== -1 || e.indexOf('pontos insuficientes') !== -1;
  }

  const premios = [
    { id: 1, nome: 'PowerFit Club', descricao: '15% de descontos', pontos_necessarios: 347, cupom_codigo: 'ECO100OFF', desconto_percentual: 15, valor_minimo: 150, data_inicio: '2026-04-01', data_expiracao: '2026-04-16', parceiro: 'PowerFit Club', ativo: true },
    { id: 2, nome: 'IronFlex', descricao: '30% de descontos', pontos_necessarios: 289, cupom_codigo: 'IRON30', desconto_percentual: 30, valor_minimo: 120, data_inicio: '2026-04-01', data_expiracao: '2026-04-16', parceiro: 'IronFlex', ativo: true },
    { id: 3, nome: 'MoveUp Gym', descricao: '20% de descontos', pontos_necessarios: 412, cupom_codigo: 'MOVEUP20', desconto_percentual: 20, valor_minimo: 200, data_inicio: '2026-04-01', data_expiracao: '2026-04-16', parceiro: 'MoveUp Gym', ativo: true },
    { id: 4, nome: 'Pão Nobre', descricao: '15% de descontos', pontos_necessarios: 150, cupom_codigo: 'PANOBRE15', desconto_percentual: 15, valor_minimo: 80, data_inicio: '2026-04-01', data_expiracao: '2026-04-16', parceiro: 'Pão Nobre', ativo: true },
    { id: 5, nome: 'Forno Dourado', descricao: '20% de descontos', pontos_necessarios: 200, cupom_codigo: 'DOURADO20', desconto_percentual: 20, valor_minimo: 100, data_inicio: '2026-04-01', data_expiracao: '2026-04-16', parceiro: 'Forno Dourado', ativo: true },
    { id: 6, nome: 'Trigo & Sabor', descricao: '10% de descontos', pontos_necessarios: 100, cupom_codigo: 'TRIGO10', desconto_percentual: 10, valor_minimo: 150, data_inicio: '2026-04-01', data_expiracao: '2026-04-16', parceiro: 'Trigo & Sabor', ativo: true },
    { id: 7, nome: 'VitaNex', descricao: '10% de descontos', pontos_necessarios: 120, cupom_codigo: 'VITANEX10', desconto_percentual: 10, valor_minimo: 200, data_inicio: '2026-04-01', data_expiracao: '2026-04-16', parceiro: 'VitaNex', ativo: true },
    { id: 8, nome: 'PharmaLeaf', descricao: '20% de descontos', pontos_necessarios: 220, cupom_codigo: 'PHARMALEAF20', desconto_percentual: 20, valor_minimo: 300, data_inicio: '2026-04-01', data_expiracao: '2026-04-16', parceiro: 'PharmaLeaf', ativo: true },
    { id: 9, nome: 'SaúdePrime', descricao: '25% de descontos', pontos_necessarios: 280, cupom_codigo: 'SAUDEPRIME25', desconto_percentual: 25, valor_minimo: 250, data_inicio: '2026-04-01', data_expiracao: '2026-04-16', parceiro: 'SaúdePrime', ativo: true },
    { id: 10, nome: 'MaxCompra', descricao: '10% de descontos', pontos_necessarios: 130, cupom_codigo: 'MAXCOMPRA10', desconto_percentual: 10, valor_minimo: 70, data_inicio: '2026-04-01', data_expiracao: '2026-04-16', parceiro: 'MaxCompra', ativo: true },
    { id: 11, nome: 'MercaPlus', descricao: '30% de descontos', pontos_necessarios: 320, cupom_codigo: 'MERCAPLUS30', desconto_percentual: 30, valor_minimo: 180, data_inicio: '2026-04-01', data_expiracao: '2026-04-16', parceiro: 'MercaPlus', ativo: true },
    { id: 12, nome: 'BomPreço', descricao: '20% de descontos', pontos_necessarios: 210, cupom_codigo: 'BOMPRECO20', desconto_percentual: 20, valor_minimo: 140, data_inicio: '2026-04-01', data_expiracao: '2026-04-16', parceiro: 'BomPreço', ativo: true },
    { id: 13, nome: 'Sabor da Vila', descricao: '15% de descontos', pontos_necessarios: 180, cupom_codigo: 'VILA15', desconto_percentual: 15, valor_minimo: 110, data_inicio: '2026-04-01', data_expiracao: '2026-04-16', parceiro: 'Sabor da Vila', ativo: true },
    { id: 14, nome: 'Essência Gourmet', descricao: '10% de descontos', pontos_necessarios: 110, cupom_codigo: 'ESSENCIA10', desconto_percentual: 10, valor_minimo: 220, data_inicio: '2026-04-01', data_expiracao: '2026-04-16', parceiro: 'Essência Gourmet', ativo: true },
    { id: 15, nome: 'Bistrô Raiz', descricao: '10% de descontos', pontos_necessarios: 105, cupom_codigo: 'RAIZ10', desconto_percentual: 10, valor_minimo: 90, data_inicio: '2026-04-01', data_expiracao: '2026-04-16', parceiro: 'Bistrô Raiz', ativo: true },
    { id: 16, nome: 'GlowBella', descricao: '10% de descontos', pontos_necessarios: 125, cupom_codigo: 'GLOW10', desconto_percentual: 10, valor_minimo: 280, data_inicio: '2026-04-01', data_expiracao: '2026-04-16', parceiro: 'GlowBella', ativo: true },
    { id: 17, nome: 'MakeLuxe', descricao: '15% de descontos', pontos_necessarios: 170, cupom_codigo: 'LUXE15', desconto_percentual: 15, valor_minimo: 160, data_inicio: '2026-04-01', data_expiracao: '2026-04-16', parceiro: 'MakeLuxe', ativo: true },
    { id: 18, nome: 'BeautyCharm', descricao: '20% de descontos', pontos_necessarios: 240, cupom_codigo: 'CHARM20', desconto_percentual: 20, valor_minimo: 130, data_inicio: '2026-04-01', data_expiracao: '2026-04-16', parceiro: 'BeautyCharm', ativo: true },
    { id: 19, nome: 'EcoStyle', descricao: '18% de descontos', pontos_necessarios: 230, cupom_codigo: 'ECOSTYLE18', desconto_percentual: 18, valor_minimo: 190, data_inicio: '2026-04-01', data_expiracao: '2026-04-30', parceiro: 'EcoStyle', ativo: true },
    { id: 20, nome: 'VerdeVibe', descricao: '25% de descontos', pontos_necessarios: 260, cupom_codigo: 'VERDEVIBE25', desconto_percentual: 25, valor_minimo: 240, data_inicio: '2026-04-10', data_expiracao: '2026-05-10', parceiro: 'VerdeVibe', ativo: true }
  ];

  function obterUrlServidor(arquivoPhp) {
    return window.ecocoletaPhpUrl ? window.ecocoletaPhpUrl(arquivoPhp) : null;
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

  async function carregarSaldoMeuPerfil() {
    const url = obterUrlServidor('meu_perfil.php');
    if (!url) return null;
    try {
      const res = await fetch(url, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
      const text = await res.text();
      let data;
      try {
        data = parseJsonServidor(text);
      } catch (e) {
        return null;
      }
      if (!data || data.sucesso !== true || !data.usuario || typeof data.usuario !== 'object') {
        return null;
      }
      return normalizarSaldoEcopoints(data.usuario.saldo_ecopoints);
    } catch (e) {
      return null;
    }
  }

  function parseJsonServidor(text) {
    const raw = String(text || '').replace(/^\uFEFF/, '').trim();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (e1) {
      const marcas = ['{"sucesso"', '{"erro"', '{"detalhe"', '{"usuario"', '{"mensagem"'];
      let idx = -1;
      for (let m = 0; m < marcas.length; m++) {
        const i = raw.indexOf(marcas[m]);
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

  async function postResgateAcao(acao, extra) {
    const url = obterUrlServidor('resgate_premio.php');
    if (!url) {
      throw new Error('FILE_PROTOCOL');
    }
    const body = new URLSearchParams();
    body.set('acao', acao);
    if (extra && typeof extra === 'object') {
      Object.keys(extra).forEach(function (k) {
        body.set(k, String(extra[k]));
      });
    }
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
      throw new Error('BAD_JSON');
    }
    return { res: res, data: data };
  }

  function sincronizarResgatesLocalStorage() {
    try {
      localStorage.setItem('redeemedPrizes', JSON.stringify(Array.from(resgatadosServidor)));
    } catch (e) {

    }
  }

  function notificarResgatesAtualizados() {
    try {
      var ch = new BroadcastChannel('ecocoleta-resgates');
      ch.postMessage({
        type: 'updated',
        t: Date.now(),
        saldo_ecopoints: userPoints,
      });
      ch.close();
    } catch (e1) {

    }
  }

  async function carregarEstadoServidor() {
    try {
      const { data } = await postResgateAcao('verificar_resgates');
      if (data && data.sucesso === true && Array.isArray(data.resgates)) {
        resgatadosServidor.clear();
        data.resgates.forEach(function (id) {
          resgatadosServidor.add(Number(id));
        });
      }
      let saldo = data ? normalizarSaldoEcopoints(data.saldo_ecopoints) : null;
      if (saldo === null) {
        saldo = await carregarSaldoMeuPerfil();
      }
      if (saldo !== null) {
        userPoints = saldo;
      } else {
        const fb = normalizarSaldoEcopoints(localStorage.getItem('userPoints'));
        userPoints = fb !== null ? fb : PONTOS_PADRAO;
      }
      localStorage.setItem('userPoints', String(userPoints));
      sincronizarResgatesLocalStorage();
    } catch (e) {
      let saldo = await carregarSaldoMeuPerfil();
      if (saldo === null) {
        const fb = normalizarSaldoEcopoints(localStorage.getItem('userPoints'));
        userPoints = fb !== null ? fb : PONTOS_PADRAO;
      } else {
        userPoints = saldo;
      }
    }
  }

  async function carregarEstadoCupomNovoUsuario() {
    try {
      const { data } = await postResgateAcao('verificar_cupom_novo_usuario');
      if (data && data.sucesso === true) {
        cupomNovoUsuarioEstado = {
          codigo_cupom: data.codigo_cupom || CUPOM_NOVO_USUARIO,
          resgatado: data.resgatado === true,
          elegivel: data.elegivel === true,
          motivo: data.motivo || '',
        };
      }
    } catch (e) {
      cupomNovoUsuarioEstado = {
        codigo_cupom: CUPOM_NOVO_USUARIO,
        resgatado: false,
        elegivel: false,
        motivo: 'Abra pelo servidor para validar o cupom.',
      };
    }
  }

  function atualizarCupomNovoUsuarioUI() {
    const couponButton = document.querySelector('.coupon-button');
    const couponCard = document.querySelector('.coupon-card');
    const couponDescription = document.querySelector('.coupon-description');
    if (!couponButton) return;

    couponButton.disabled = false;
    couponButton.classList.remove('coupon-button-disabled');
    if (couponCard) {
      couponCard.classList.remove('coupon-card-disabled', 'coupon-card-resgatado');
    }

    if (couponDescription) {
      couponDescription.textContent = 'Cupom exclusivo para novos usuários';
    }

    if (cupomNovoUsuarioEstado.resgatado) {
      couponButton.disabled = true;
      couponButton.textContent = 'Cupom já resgatado';
      couponButton.classList.add('coupon-button-disabled');
      if (couponCard) couponCard.classList.add('coupon-card-resgatado');
      if (couponDescription) {
        couponDescription.textContent = 'Este cupom já foi resgatado nesta conta';
      }
      return;
    }

    if (!cupomNovoUsuarioEstado.elegivel) {
      couponButton.disabled = true;
      couponButton.textContent = 'Indisponível';
      couponButton.classList.add('coupon-button-disabled');
      if (couponCard) couponCard.classList.add('coupon-card-disabled');
      if (couponDescription && cupomNovoUsuarioEstado.motivo) {
        couponDescription.textContent = cupomNovoUsuarioEstado.motivo;
      }
      return;
    }

    couponButton.textContent = 'Resgatar cupom';
  }

  async function copiarTexto(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
    return false;
  }

  function updatePointsDisplay() {
    if (!isLoggedIn()) {
      aplicarModoVisitantePremios();
      return;
    }
    const pointsDisplay = document.querySelector('#premios-saldo-ecopoints') || document.querySelector('.points-card strong');
    const n = normalizarSaldoEcopoints(userPoints);
    const valor = n !== null ? n : 0;
    if (pointsDisplay) {
      pointsDisplay.textContent = valor.toLocaleString('pt-BR');
    }
    localStorage.setItem('userPoints', String(valor));
  }

  window.addEventListener('ecocoleta:saldo-atualizar', function (ev) {
    const saldo = ev && ev.detail ? normalizarSaldoEcopoints(ev.detail.saldo_ecopoints) : null;
    if (saldo !== null) {
      userPoints = saldo;
      updatePointsDisplay();
    }
  });

  window.addEventListener('ecocoleta:notificacoes-atualizar', function () {
    void carregarSaldoMeuPerfil().then(function (saldo) {
      if (saldo !== null) {
        userPoints = saldo;
        updatePointsDisplay();
      }
    });
  });

  function generateCards() {
    const gridCards = document.querySelector('.grid-cards');
    if (!gridCards) return;
    gridCards.innerHTML = '';

    premios.forEach(function (premio) {
      if (!premio.ativo) return;

      const isRedeemed = resgatadosServidor.has(premio.id);
      const card = document.createElement('article');
      card.className = 'card';
      if (isRedeemed) {
        card.classList.add('resgatado-card');
      }
      card.setAttribute('data-points', String(premio.pontos_necessarios));
      card.setAttribute('data-prize-id', String(premio.id));

      const buttonState = isRedeemed
        ? '<button type="button" class="badge resgatar-button resgatado" disabled>Resgatado</button>'
        : '<button type="button" class="badge resgatar-button">Resgatar</button>';

      const cupomCodigoCard = escHtml(premio.cupom_codigo);
      const cupomVisivel = isRedeemed
        ? '<div class="coupon-top"><p class="coupon-code">' + cupomCodigoCard + '</p><p class="coupon-value">' + premio.desconto_percentual + '% OFF</p></div><p class="card-msg-resgate">Cupom liberado na sua conta.</p>'
        : '<div class="coupon-top"><p class="coupon-code">' + cupomCodigoCard + '</p><p class="coupon-value">' + premio.desconto_percentual + '% OFF</p></div>';

      card.innerHTML =
        '<div class="card-icon"></div>' +
        '<p class="card-title">' + premio.parceiro + '</p>' +
        '<p class="card-description">' + premio.descricao + '</p>' +
        '<p class="card-points">' + premio.pontos_necessarios + ' pontos</p>' +
        buttonState +
        '<div class="card-detail">' +
        cupomVisivel +
        '<p class="coupon-text">Ganhe ' + premio.desconto_percentual + '% OFF em compras acima de R$' + premio.valor_minimo + ',00 no parceiro ' + premio.parceiro + '.</p>' +
        '<div class="coupon-meta">' +
        '<span class="coupon-date-start">Início: ' + new Date(premio.data_inicio).toLocaleDateString('pt-BR') + '</span>' +
        '<span class="coupon-date-end">Expiração: ' + new Date(premio.data_expiracao).toLocaleDateString('pt-BR') + '</span>' +
        '</div></div>';

      gridCards.appendChild(card);
    });
  }

  const searchInput = document.querySelector('.search-box input');
  const searchButton = document.querySelector('.search-box button');
  const feedback = document.createElement('div');
  feedback.className = 'search-feedback';
  const searchBox = document.querySelector('.search-box');

  if (searchBox) {
    searchBox.parentNode.insertBefore(feedback, searchBox.nextSibling);
  }

  function updateFeedback(message, status) {
    feedback.textContent = message;
    feedback.className = 'search-feedback ' + (status || 'info');
  }

  function filterCards() {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const cards = document.querySelectorAll('.grid-cards .card');
    let count = 0;

    cards.forEach(function (card) {
      const text = card.innerText.toLowerCase();
      const isMatch = query === '' || text.includes(query);
      card.style.display = isMatch ? 'grid' : 'none';
      if (isMatch) count += 1;
    });

    if (!query) {
      updateFeedback('', 'info');
    } else if (count === 0) {
      updateFeedback('Nenhum prêmio encontrado para "' + query + '".', 'error');
    } else {
      updateFeedback(count + ' prêmio(s) encontrado(s).', 'success');
    }
  }

  if (searchButton && searchInput) {
    searchButton.addEventListener('click', filterCards);
    searchInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        filterCards();
      }
    });
  }

  function showResgatePopup(prizeName, pointsUsed, couponCode, couponText, couponStart, couponEnd) {
    const existingPopup = document.querySelector('.resgate-popup');
    if (existingPopup) existingPopup.remove();

    const codeTitulo = String(couponCode || '').replace(/</g, '').replace(/>/g, '');

    const popup = document.createElement('div');
    popup.className = 'resgate-popup';
    popup.innerHTML =
      '<div class="resgate-overlay">' +
      '<div class="resgate-content">' +
      '<button type="button" class="resgate-close" aria-label="Fechar">&times;</button>' +
      '<div class="resgate-header">' +
      '<h3 class="resgate-title">' + codeTitulo + '</h3>' +
      '<p class="resgate-dates"><span class="date-label">Prazo:</span> <span class="date-start">' + couponStart + '</span> <span class="date-end">' + couponEnd + '</span></p>' +
      '</div>' +
      '<div class="resgate-icon">🎁</div>' +
      '<h3>Prêmio resgatado!</h3>' +
      '<p class="resgate-prize"></p>' +
      '<p class="resgate-points">-' + pointsUsed + ' pontos</p>' +
      '<p class="resgate-message"></p>' +
      '<div class="resgate-acoes-popup">' +
      '<button type="button" class="resgate-copiar">Copiar código</button>' +
      '<button type="button" class="resgate-ok">OK</button>' +
      '</div>' +
      '</div></div>';
    document.body.appendChild(popup);

    const elPrize = popup.querySelector('.resgate-prize');
    const elMsg = popup.querySelector('.resgate-message');
    if (elPrize) elPrize.textContent = prizeName;
    if (elMsg) elMsg.textContent = couponText;

    const codeReal = String(couponCode || '');

    function fechar() {
      popup.remove();
    }

    popup.querySelector('.resgate-close').addEventListener('click', fechar);
    popup.querySelector('.resgate-ok').addEventListener('click', fechar);
    popup.querySelector('.resgate-overlay').addEventListener('click', function (ev) {
      if (ev.target === popup.querySelector('.resgate-overlay')) fechar();
    });

    popup.querySelector('.resgate-copiar').addEventListener('click', function () {
      if (!codeReal) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(codeReal).then(function () {
          updateFeedback('Código copiado para a área de transferência.', 'success');
        }, function () {
          updateFeedback('Não foi possível copiar. Selecione o código manualmente.', 'error');
        });
      } else {
        updateFeedback('Copie manualmente: ' + codeReal, 'info');
      }
    });
  }

  const gridCards = document.querySelector('.grid-cards');
  if (gridCards) {
    gridCards.addEventListener('click', async function (ev) {
      const button = ev.target.closest('.resgatar-button');
      if (!button || button.disabled) return;
      if (window.EcoColetaAuth && !window.EcoColetaAuth.requireLogin('Para resgatar prêmios, faça login ou crie sua conta.')) {
        return;
      }

      const card = button.closest('.card');
      if (!card) return;

      const prizeId = parseInt(card.getAttribute('data-prize-id'), 10);
      const pointsRequired = parseInt(card.getAttribute('data-points'), 10) || 0;
      const prizeNameEl = card.querySelector('.card-title');
      const prizeName = prizeNameEl ? prizeNameEl.textContent : 'Prêmio';

      if (resgatadosServidor.has(prizeId)) {
        updateFeedback('Este prêmio já foi resgatado.', 'error');
        return;
      }

      if (userPoints < pointsRequired) {
        await avisoPremios(MSG_PONTOS_INSUFICIENTES, 'error');
        updateFeedback(MSG_PONTOS_INSUFICIENTES, 'error');
        return;
      }

      button.disabled = true;

      try {
        const { data } = await postResgateAcao('resgatar', { id_beneficio: prizeId });
        if (data && data.sucesso === true) {
          window.dispatchEvent(new CustomEvent('ecocoleta:notificacoes-atualizar'));
        }

        if (!data || data.sucesso !== true) {
          if (isErroPontosInsuficientes(data)) {
            await avisoPremios(MSG_PONTOS_INSUFICIENTES, 'error');
            updateFeedback(MSG_PONTOS_INSUFICIENTES, 'error');
            await carregarEstadoServidor();
            updatePointsDisplay();
            generateCards();
            filterCards();
            button.disabled = false;
            return;
          }
          const err = (data && data.erro) ? String(data.erro) : 'Não foi possível resgatar.';
          if (err.toLowerCase().indexOf('ja resgatado') !== -1 || err.toLowerCase().indexOf('já resgatado') !== -1) {
            resgatadosServidor.add(prizeId);
            sincronizarResgatesLocalStorage();
            notificarResgatesAtualizados();
            await carregarEstadoServidor();
            updatePointsDisplay();
            generateCards();
            filterCards();
          }
          updateFeedback(err, 'error');
          button.disabled = false;
          return;
        }

        const couponText = card.querySelector('.coupon-text')
          ? card.querySelector('.coupon-text').textContent.trim()
          : '';
        const couponStart = card.querySelector('.coupon-date-start')
          ? card.querySelector('.coupon-date-start').textContent.trim()
          : '';
        const couponEnd = card.querySelector('.coupon-date-end')
          ? card.querySelector('.coupon-date-end').textContent.trim()
          : '';

        resgatadosServidor.add(prizeId);
        sincronizarResgatesLocalStorage();

        const novoSaldo = normalizarSaldoEcopoints(data.saldo_ecopoints);
        if (novoSaldo !== null) {
          userPoints = novoSaldo;
        } else {
          userPoints -= pointsRequired;
        }
        updatePointsDisplay();

        notificarResgatesAtualizados();

        const cupomServidor = (data.cupom_codigo != null) ? String(data.cupom_codigo) : '';
        if (cupomServidor) {
          for (let pi = 0; pi < premios.length; pi++) {
            if (premios[pi].id === prizeId) {
              premios[pi].cupom_codigo = cupomServidor;
              break;
            }
          }
        }

        generateCards();
        filterCards();

        showResgatePopup(prizeName, data.pontos_utilizados || pointsRequired, cupomServidor, couponText, couponStart, couponEnd);
      } catch (e) {
        if (e && e.message === 'FILE_PROTOCOL') {
          updateFeedback('Abra pelo servidor (não use file://).', 'error');
        } else {
          updateFeedback('Erro de conexão. Tente novamente.', 'error');
        }
        button.disabled = false;
      }
    });
  }

  aplicarModoVisitantePremios();
  if (isLoggedIn()) {
    await carregarEstadoServidor();
    await carregarEstadoCupomNovoUsuario();
    notificarResgatesAtualizados();
  }
  generateCards();
  updatePointsDisplay();
  filterCards();
  atualizarCupomNovoUsuarioUI();

  const verMaisButton = document.querySelector('.cta button');
  if (verMaisButton) {
    verMaisButton.addEventListener('click', function () {
      updateFeedback('Em breve mais parceiros!', 'info');
    });
  }

  const couponButton = document.querySelector('.coupon-button');
  const couponCodeHero = document.querySelector('.coupon-code');

  if (couponButton && couponCodeHero) {
    couponButton.addEventListener('click', async function () {
      if (couponButton.disabled) return;
      if (window.EcoColetaAuth && !window.EcoColetaAuth.requireLogin('Para resgatar o cupom, faça login ou crie sua conta.')) {
        return;
      }

      const code = couponCodeHero.textContent.trim();
      if (cupomNovoUsuarioEstado.resgatado) {
        await avisoPremios('Este cupom já foi resgatado nesta conta.', 'error');
        atualizarCupomNovoUsuarioUI();
        return;
      }
      if (!cupomNovoUsuarioEstado.elegivel) {
        await avisoPremios(cupomNovoUsuarioEstado.motivo || 'Este cupom é exclusivo para novos usuários.', 'error');
        atualizarCupomNovoUsuarioUI();
        return;
      }

      couponButton.disabled = true;
      couponButton.textContent = 'Validando…';

      try {
        const { data } = await postResgateAcao('resgatar_cupom_novo_usuario');
        if (!data || data.sucesso !== true) {
          const err = (data && data.erro) ? String(data.erro) : 'Não foi possível resgatar o cupom.';
          cupomNovoUsuarioEstado = {
            codigo_cupom: (data && data.codigo_cupom) || CUPOM_NOVO_USUARIO,
            resgatado: data && data.erro_codigo === 'cupom_ja_resgatado',
            elegivel: false,
            motivo: err,
          };
          atualizarCupomNovoUsuarioUI();
          await avisoPremios(err, 'error');
          return;
        }

        cupomNovoUsuarioEstado = {
          codigo_cupom: data.codigo_cupom || code || CUPOM_NOVO_USUARIO,
          resgatado: true,
          elegivel: false,
          motivo: 'Cupom já resgatado nesta conta.',
        };

        const codeReal = cupomNovoUsuarioEstado.codigo_cupom;
        couponCodeHero.textContent = codeReal;
        try {
          const copiado = await copiarTexto(codeReal);
          if (!copiado) {
            throw new Error('CLIPBOARD_UNAVAILABLE');
          }
          showResgatadoPopup();
          updateFeedback('Cupom resgatado e copiado para a área de transferência.', 'success');
        } catch (eCopy) {
          await avisoPremios('Cupom resgatado. Copie manualmente: ' + codeReal, 'success');
        }
        atualizarCupomNovoUsuarioUI();
      } catch (e) {
        couponButton.disabled = false;
        couponButton.textContent = 'Resgatar cupom';
        await avisoPremios('Erro de conexão ao validar o cupom.', 'error');
      }
    });
  }

  function showResgatadoPopup() {
    const existingPopup = document.querySelector('.resgatado-popup');
    if (existingPopup) existingPopup.remove();

    const codeEl = document.querySelector('.coupon-code');
    const descEl = document.querySelector('.coupon-description');
    const datesEl = document.querySelector('.coupon-dates');
    if (!codeEl || !descEl || !datesEl) return;

    const couponCode = codeEl.textContent.trim();
    const couponDescription = descEl.textContent.trim();
    const couponDates = datesEl.innerHTML;

    const popup = document.createElement('div');
    popup.className = 'resgatado-popup';
    popup.innerHTML =
      '<div class="resgatado-overlay">' +
      '<div class="resgatado-content">' +
      '<button type="button" class="resgatado-close" aria-label="Fechar">&times;</button>' +
      '<div class="resgatado-header">' +
      '<h3 class="resgatado-title">' + couponCode + '</h3>' +
      '<p class="resgatado-dates">' + couponDates + '</p>' +
      '</div>' +
      '<div class="resgatado-icon">✓</div>' +
      '<h3>Cupom copiado!</h3>' +
      '<p>Seu cupom foi copiado para a área de transferência.</p>' +
      '<div class="resgatado-codigo">' + couponCode + '</div>' +
      '<p class="resgatado-details">' + couponDescription + '</p>' +
      '<p class="resgatado-instructions">Apresente este código no parceiro para obter seu desconto.</p>' +
      '</div></div>';
    document.body.appendChild(popup);

    popup.querySelector('.resgatado-close').addEventListener('click', function () {
      popup.remove();
    });
    popup.querySelector('.resgatado-overlay').addEventListener('click', function () {
      popup.remove();
    });

    setTimeout(function () {
      popup.remove();
    }, 6000);
  }
});
