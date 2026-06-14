document.addEventListener('DOMContentLoaded', function () {
  const PESO_SUGERIDO = {
    plastico: 0.85,
    papel: 1.2,
    vidro: 1.5,
    metal: 0.65,
    organico: 2.1,
    eletronico: 2.8,
    misto: 1.0,
    madeira: 1.75
  };

  const MATERIAL_SVGS = {
    plastico: '<path d="M9 3h6l1 4H8L9 3z"/><path d="M8 7h8v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7z"/><path d="M10 11h4"/>',
    papel: '<path d="M14 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8l-4-6z"/><path d="M14 2v6h6"/><path d="M10 13h6M10 17h4"/>',
    vidro: '<path d="M9 2h6v4l-1 14H10L9 6V2z"/><path d="M9 6h6"/>',
    metal: '<ellipse cx="12" cy="14" rx="5" ry="2"/><path d="M7 14V8c0-2 2-4 5-4s5 2 5 4v6"/><path d="M9 8h6"/>',
    organico: '<path d="M12 21c-4-3-7-6-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4-3 7-7 10z"/><path d="M12 11v4"/>',
    eletronico: '<rect x="7" y="2" width="10" height="18" rx="2"/><path d="M10 18h4"/><circle cx="12" cy="6" r="1" fill="currentColor" stroke="none"/>',
    misto: '<path d="M7 7a5 5 0 0 1 10 0v2h1a3 3 0 0 1 0 6h-1l-1 3H8l-1-3H6a3 3 0 0 1 0-6h1V7z"/><path d="M12 4v6M9 7h6"/>',
    madeira: '<path d="M6 18h12"/><path d="M8 18V8l4-4 4 4v10"/><path d="M10 12h4M10 15h4"/>'
  };

  const MATERIAIS = [
    { id: 'plastico', label: 'Plástico', emoji: '🧴' },
    { id: 'papel', label: 'Papel', emoji: '📦' },
    { id: 'vidro', label: 'Vidro', emoji: '🍾' },
    { id: 'metal', label: 'Metal', emoji: '🛢️' },
    { id: 'organico', label: 'Orgânico', emoji: '🍃' },
    { id: 'eletronico', label: 'Eletrônico', emoji: '📱' },
    { id: 'misto', label: 'Resíduo', emoji: '♻️' },
    { id: 'madeira', label: 'Madeira', emoji: '🪵' }
  ];

  const CHART_DATA = [
    { label: 'Dom', value: 2.1, alt: false },
    { label: 'Seg', value: 3.4, alt: true },
    { label: 'Ter', value: 1.8, alt: false },
    { label: 'Qua', value: 3.9, alt: true },
    { label: 'Qui', value: 2.6, alt: false },
    { label: 'Sex', value: 3.2, alt: true },
    { label: 'Sáb', value: 2.4, alt: false }
  ];

  const params = new URLSearchParams(window.location.search);
  const modo = params.get('modo') === 'agenda' ? 'agenda' : 'demo';
  const agendaKey = 'ecoBalancaAgenda';
  const idAgendamentoUrl = parseInt(params.get('id_agendamento') || '0', 10) || 0;

  const kicker = document.getElementById('balancaKicker');
  const title = document.getElementById('balancaTitle');
  const subtitle = document.getElementById('balancaSubtitle');
  const modePill = document.getElementById('balancaModePill');
  const backLink = document.getElementById('balancaBackLink');
  const pesoDisplay = document.getElementById('balancaPesoDisplay');
  const pontosDisplay = document.getElementById('balancaPontosDisplay');
  const dialEl = document.querySelector('.balanca-dial');
  const pesoRange = document.getElementById('balancaPesoRange');
  const pesoInput = document.getElementById('balancaPesoInput');
  const pesoHint = document.getElementById('balancaPesoHint');
  const saldoAtual = document.getElementById('balancaSaldoAtual');
  const materialsGrid = document.getElementById('balancaMaterialsGrid');
  const materialsHint = document.getElementById('balancaMaterialsHint');
  const agendaSummary = document.getElementById('balancaAgendaSummary');
  const agendaData = document.getElementById('balancaAgendaData');
  const agendaHorario = document.getElementById('balancaAgendaHorario');
  const agendaPev = document.getElementById('balancaAgendaPev');
  const pendingNote = document.getElementById('balancaPendingNote');
  const primaryBtn = document.getElementById('balancaPrimaryBtn');
  const agendarLink = document.getElementById('balancaAgendarLink');
  const chart = document.getElementById('balancaChart');
  const chartTotalKg = document.getElementById('balancaChartTotalKg');
  const chartTotalPts = document.getElementById('balancaChartTotalPts');
  const breakdownEl = document.getElementById('balancaBreakdown');
  const breakdownList = document.getElementById('balancaBreakdownList');
  const breakdownTotal = document.getElementById('balancaBreakdownTotal');
  const breakdownNote = document.getElementById('balancaBreakdownNote');
  const materialsCount = document.getElementById('balancaMaterialsCount');

  let selectedMaterials = new Set(['plastico', 'papel', 'metal']);
  let pesoManual = false;
  let saving = false;
  let agendaPayload = null;
  let dialTimer = null;
  let ultimaEstimativa = null;

  function serverUrl(file) {
    if (window.ecocoletaPhpUrl) {
      return window.ecocoletaPhpUrl(file);
    }
    if (window.location.protocol === 'file:') return null;
    var prefix = /\/(pages|auth|admin|mapa)\//.test(window.location.pathname) ? '../' : '';
    return new URL(prefix + file, window.location.href).href;
  }

  function parseJson(text) {
    const raw = String(text || '').replace(/^\uFEFF/, '').trim();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (err) {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(raw.slice(start, end + 1));
      }
      throw err;
    }
  }

  function tiposSelecionados() {
    return Array.from(selectedMaterials);
  }

  function calcularPontosLocal(peso) {
    if (window.EcoPontuacaoColeta && typeof window.EcoPontuacaoColeta.calcularPontos === 'function') {
      return window.EcoPontuacaoColeta.calcularPontos(peso, tiposSelecionados(), true);
    }
    return { total: 0, detalhe: {} };
  }

  function setPrimaryBtnText(text) {
    if (!primaryBtn) return;
    const span = primaryBtn.querySelector('span');
    if (span) span.textContent = text;
    else primaryBtn.textContent = text;
  }

  function pulseDial() {
    if (!dialEl) return;
    dialEl.classList.add('is-updating');
    clearTimeout(dialTimer);
    dialTimer = setTimeout(function () {
      dialEl.classList.remove('is-updating');
    }, 350);
  }

  function formatPeso(peso) {
    return '+' + peso.toFixed(2).replace('.', ',') + ' Kg';
  }

  function formatPontosDial(pontos) {
    return '+' + pontos.toLocaleString('pt-BR');
  }

  function formatSaldo(pontos) {
    return Number(pontos || 0).toLocaleString('pt-BR') + ' EcoPontos';
  }

  function materialSvg(id) {
    const paths = MATERIAL_SVGS[id] || MATERIAL_SVGS.misto;
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>';
  }

  function pesoRecomendado() {
    let total = 0;
    selectedMaterials.forEach(function (tipo) {
      total += PESO_SUGERIDO[tipo] || 0;
    });
    return Math.round(total * 100) / 100;
  }

  function atualizarDisplays() {
    const peso = parseFloat(String(pesoInput.value || '0').replace(',', '.')) || 0;
    const calc = calcularPontosLocal(peso);
    ultimaEstimativa = calc;
    pesoDisplay.textContent = formatPeso(peso);
    pontosDisplay.textContent = formatPontosDial(calc.total);
    if (pesoRange) pesoRange.value = String(Math.min(50, Math.max(0.1, peso)));
    renderBreakdown(calc, true);
    pulseDial();
  }

  function aplicarPesoSugerido(force) {
    if (pesoManual && !force) return;
    const sugerido = pesoRecomendado();
    const valor = sugerido > 0 ? sugerido : 2.35;
    pesoInput.value = String(valor);
    if (pesoRange) pesoRange.value = String(Math.min(50, valor));
    atualizarDisplays();
    if (pesoHint) {
      pesoHint.textContent = sugerido > 0
        ? 'Sugestão: ' + sugerido.toFixed(2).replace('.', ',') + ' kg com base nos materiais marcados.'
        : 'Marque ao menos um material para calcular a sugestão.';
    }
  }

  function atualizarContadorMateriais() {
    if (!materialsCount) return;
    const n = selectedMaterials.size;
    materialsCount.textContent = n === 1 ? '1 selecionado' : n + ' selecionados';
  }

  function renderMaterials() {
    if (!materialsGrid) return;
    materialsGrid.classList.toggle('is-locked', modo === 'agenda');
    materialsGrid.innerHTML = '';
    MATERIAIS.forEach(function (item) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const ativo = selectedMaterials.has(item.id);
      btn.className =
        'balanca-material-card balanca-material-card--' + item.id + (ativo ? ' is-active' : '');
      btn.dataset.tipo = item.id;
      btn.setAttribute('aria-pressed', ativo ? 'true' : 'false');
      btn.setAttribute('aria-label', item.label + (ativo ? ' — selecionado' : ''));
      btn.innerHTML =
        '<span class="balanca-material-card__check" aria-hidden="true">✓</span>' +
        '<span class="balanca-material-card__icon" aria-hidden="true">' + (item.emoji || '♻️') + '</span>' +
        '<span class="balanca-material-card__label">' + item.label + '</span>';
      btn.addEventListener('click', function () {
        if (modo === 'agenda') return;
        if (selectedMaterials.has(item.id)) {
          if (selectedMaterials.size > 1) {
            selectedMaterials.delete(item.id);
          }
        } else {
          selectedMaterials.add(item.id);
        }
        renderMaterials();
        aplicarPesoSugerido(false);
      });
      materialsGrid.appendChild(btn);
    });
    atualizarContadorMateriais();
  }

  function renderChartGridlines() {
    const grid = document.querySelector('.balanca-chart-gridlines');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < 4; i += 1) {
      grid.appendChild(document.createElement('span'));
    }
  }

  function renderChart() {
    if (!chart) return;
    const max = Math.max.apply(null, CHART_DATA.map(function (d) { return d.value; }));
    const totalKg = CHART_DATA.reduce(function (sum, d) { return sum + d.value; }, 0);
    chart.innerHTML = '';
    CHART_DATA.forEach(function (item) {
      const bar = document.createElement('div');
      bar.className = 'balanca-chart-bar' + (item.alt ? ' is-alt' : '');
      const height = Math.max(12, Math.round((item.value / max) * 132));
      bar.innerHTML = '<i style="height:' + height + 'px"></i><span>' + item.label + '</span>';
      chart.appendChild(bar);
    });
    if (chartTotalKg) {
      chartTotalKg.textContent = Math.round(totalKg) + ' Kg';
    }
    if (chartTotalPts) {
      chartTotalPts.textContent = calcularPontosLocal(totalKg).total.toLocaleString('pt-BR');
    }
    renderChartGridlines();
  }

  function alertUi(message, variant) {
    if (window.UserPopup && typeof window.UserPopup.alert === 'function') {
      return window.UserPopup.alert(message, { variant: variant || 'info' });
    }
    window.alert(message);
    return Promise.resolve();
  }

  function renderBreakdown(calc, showPanel) {
    if (!breakdownEl || !breakdownList) return;
    const detalhe = (calc && calc.detalhe) || {};
    const total = (calc && calc.total) || 0;
    const rows = [
      { label: 'Agendamento', value: detalhe.agendamento },
      { label: 'Coleta concluída', value: detalhe.conclusao },
      { label: 'Bônus por peso', value: detalhe.peso },
      { label: 'Bônus por material', value: detalhe.materiais }
    ].filter(function (r) { return r.value > 0; });

    breakdownList.innerHTML = rows.map(function (r) {
      return '<li><span>' + r.label + '</span><strong>+' + r.value + ' pts</strong></li>';
    }).join('');

    if (breakdownTotal) {
      breakdownTotal.textContent = total.toLocaleString('pt-BR') + ' pts';
    }
    if (breakdownNote) {
      breakdownNote.textContent = modo === 'agenda'
        ? 'Estimativa com base no peso informado. Os pontos reais serão calculados após validação do EcoPonto.'
        : 'Simulação apenas — nenhum ponto é salvo no sistema.';
    }

    if (showPanel && total > 0) {
      breakdownEl.classList.remove('hidden');
    }
  }

  async function carregarSaldo() {
    const url = serverUrl('meu_perfil.php');
    if (!url || !saldoAtual) return;
    try {
      const res = await fetch(url, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
      const data = parseJson(await res.text());
      if (data && data.sucesso === true && data.usuario) {
        saldoAtual.textContent = formatSaldo(data.usuario.saldo_ecopoints);
      } else {
        saldoAtual.textContent = '0 EcoPontos';
      }
    } catch (err) {
      saldoAtual.textContent = '— EcoPontos';
    }
  }

  function lerAgenda() {
    try {
      const raw = sessionStorage.getItem(agendaKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.data_coleta) return null;
      if (idAgendamentoUrl > 0) {
        parsed.id_agendamento = idAgendamentoUrl;
      }
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function configurarModo() {
    if (modo === 'agenda') {
      agendaPayload = lerAgenda();
      if (!agendaPayload) {
        window.location.href = 'formulario-coleta.html';
        return false;
      }
      if (!agendaPayload.id_agendamento && idAgendamentoUrl > 0) {
        agendaPayload.id_agendamento = idAgendamentoUrl;
      }
      if (!agendaPayload.id_agendamento) {
        window.location.href = 'formulario-coleta.html';
        return false;
      }

      if (kicker) kicker.textContent = 'Agendamento';
      if (title) title.textContent = 'Informe o peso na balança';
      if (subtitle) {
        subtitle.textContent =
          'Registre o peso total que você levará ao EcoPonto. Nenhum ponto será creditado agora — apenas após a confirmação do administrador.';
      }
      if (modePill) modePill.textContent = 'Coleta pendente';
      if (backLink) backLink.href = 'formulario-coleta.html';
      if (materialsHint) {
        materialsHint.textContent = 'Materiais do seu agendamento (não editáveis nesta etapa).';
      }
      if (pendingNote) pendingNote.classList.remove('hidden');
      setPrimaryBtnText('Salvar peso e continuar');
      if (agendarLink) agendarLink.classList.add('hidden');

      const tipos = String(agendaPayload.tipo_residuo || '')
        .split(',')
        .map(function (t) { return t.trim(); })
        .filter(Boolean);
      if (tipos.length) {
        selectedMaterials = new Set(tipos);
      }

      if (agendaSummary) agendaSummary.classList.remove('hidden');
      if (agendaData) agendaData.textContent = agendaPayload.data_coleta || '—';
      if (agendaHorario) agendaHorario.textContent = agendaPayload.faixa_horario || '—';
      if (agendaPev) {
        agendaPev.textContent = agendaPayload.ecoponto_nome || ('EcoPonto #' + (agendaPayload.id_pev || ''));
      }
      return true;
    }

    if (kicker) kicker.textContent = 'Simulação inteligente';
    if (title) title.textContent = 'Balança EcoPonto';
    if (subtitle) {
      subtitle.textContent =
        'Simule o volume e veja quantos EcoPontos você poderia receber. Nenhum dado é salvo — é apenas uma estimativa.';
    }
    if (modePill) modePill.textContent = 'Demonstrativo';
    if (backLink) backLink.href = 'formulario-coleta.html';
    setPrimaryBtnText('Calcular estimativa');
    if (agendarLink) {
      agendarLink.classList.remove('hidden');
      agendarLink.href = 'formulario-coleta.html';
      agendarLink.textContent = 'Voltar ao agendamento';
    }
    return true;
  }

  async function simularPontos() {
    const peso = parseFloat(String(pesoInput.value || '0').replace(',', '.')) || 0;
    if (peso < 0.1) {
      await alertUi('Informe um peso válido (mínimo 0,1 kg).', 'error');
      return;
    }
    if (!selectedMaterials.size) {
      await alertUi('Marque ao menos um tipo de material.', 'error');
      return;
    }

    let calc = calcularPontosLocal(peso);
    const url = serverUrl('pontuacao-coleta.php');
    if (url) {
      try {
        const qs = new URLSearchParams({
          peso_kg: String(peso),
          tipo_residuo: tiposSelecionados().join(',')
        });
        const res = await fetch(url + '?' + qs.toString(), {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store'
        });
        const data = parseJson(await res.text());
        if (data && data.sucesso === true && data.simulacao === true) {
          calc = { total: data.pontos_estimados, detalhe: data.detalhe || calc.detalhe };
        }
      } catch (err) {

      }
    }

    ultimaEstimativa = calc;
    atualizarDisplays();
    renderBreakdown(calc, true);

    const nivel = window.EcoPontuacaoColeta && window.EcoPontuacaoColeta.calcularNivel
      ? window.EcoPontuacaoColeta.calcularNivel(calc.total)
      : null;

    let msg = 'Estimativa: ' + calc.total.toLocaleString('pt-BR') + ' EcoPontos.';
    if (nivel && nivel.nome) {
      msg += ' Nível estimado: ' + nivel.nome + '.';
    }
    msg += ' Nenhum ponto foi salvo — é apenas simulação.';

    await alertUi(msg, 'success');
  }

  async function salvarPesoAgenda() {
    if (saving || !agendaPayload) return;
    if (window.EcoColetaAuth && !window.EcoColetaAuth.requireLogin('Para registrar o peso, faça login ou crie sua conta.')) {
      return;
    }

    const peso = parseFloat(String(pesoInput.value || '0').replace(',', '.')) || 0;
    if (peso < 0.1) {
      await alertUi('Informe um peso válido (mínimo 0,1 kg).', 'error');
      return;
    }

    const url = serverUrl('agendamento_coleta.php');
    if (!url) {
      await alertUi('Abra a página pelo servidor local para continuar.', 'error');
      return;
    }

    saving = true;
    primaryBtn.disabled = true;
    setPrimaryBtnText('Salvando...');

    const body = new URLSearchParams();
    body.set('acao', 'atualizar_balanca');
    body.set('id_agendamento', String(agendaPayload.id_agendamento));
    body.set('peso_informado_kg', String(peso));
    body.set('tipo_residuo', agendaPayload.tipo_residuo || tiposSelecionados().join(','));

    try {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: body.toString()
      });
      const data = parseJson(await res.text());
      if (!data || data.sucesso !== true) {
        await alertUi((data && data.erro) || 'Não foi possível salvar o peso informado.', 'error');
        return;
      }

      sessionStorage.removeItem(agendaKey);
      try {
        window.dispatchEvent(new CustomEvent('ecocoleta:notificacoes-atualizar'));
      } catch (err) {}

      const pts = data.pontos_estimados || (ultimaEstimativa && ultimaEstimativa.total) || 0;
      await alertUi(
        (data.mensagem || 'Peso registrado!') +
          ' Estimativa: ~' + Number(pts).toLocaleString('pt-BR') +
          ' EcoPontos após confirmação do EcoPonto.',
        'success'
      );
      window.location.href = 'formulario-coleta.html';
    } catch (err) {
      await alertUi('Erro de conexão ao salvar o peso.', 'error');
    } finally {
      saving = false;
      primaryBtn.disabled = false;
      setPrimaryBtnText('Salvar peso e continuar');
    }
  }

  if (pesoRange) {
    pesoRange.max = '50';
    pesoRange.addEventListener('input', function () {
      pesoManual = true;
      pesoInput.value = pesoRange.value;
      atualizarDisplays();
    });
  }

  if (pesoInput) {
    pesoInput.addEventListener('input', function () {
      pesoManual = true;
      atualizarDisplays();
    });
  }

  if (primaryBtn) {
    primaryBtn.addEventListener('click', function () {
      if (modo === 'agenda') {
        void salvarPesoAgenda();
        return;
      }
      void simularPontos();
    });
  }

  if (!configurarModo()) {
    return;
  }

  renderMaterials();
  renderChart();
  aplicarPesoSugerido(true);
  void carregarSaldo();
});
