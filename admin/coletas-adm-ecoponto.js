(function () {
  const { escHtml, fetchJson, badgeStatusColeta, iconeTipoColeta, setupProfileMenu, setupSidebar, validarSessaoAdmin } =
    window.EcoAdm;

  function apiColetasUrl(query) {
    const path = "adm-coletas.php";
    const base = window.ecocoletaPhpUrl
      ? window.ecocoletaPhpUrl(path)
      : "api/" + path;
    return base + (query ? "?" + query : "");
  }

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
    ecopontoHint: document.getElementById("coletasEcopontoHint"),
    ecopontoMapName: document.getElementById("ecopontoMapName"),
    ecopontoMapAddress: document.getElementById("ecopontoMapAddress"),
    filters: document.getElementById("coletasFilters"),
    filterBairro: document.getElementById("filterBairro"),
    filterStatus: document.getElementById("filterStatus"),
    tableBody: document.getElementById("coletasTableBody"),
    coletasEmpty: document.getElementById("coletasEmpty"),
    actionButtons: document.querySelectorAll("[data-coleta-action]"),
    legendMeuLabel: document.getElementById("legendMeuLabel"),
    legendOutrosLabel: document.getElementById("legendOutrosLabel"),
    legendEcoponto: document.getElementById("legendEcoponto"),
    legendOutros: document.getElementById("legendOutros"),
    modalRoot: document.getElementById("admColetaModal"),
    modalIcon: document.getElementById("admColetaModalIcon"),
    modalKicker: document.getElementById("admColetaModalKicker"),
    modalTitle: document.getElementById("admColetaModalTitle"),
    modalDesc: document.getElementById("admColetaModalDesc"),
    modalContext: document.getElementById("admColetaModalContext"),
    modalBody: document.getElementById("admColetaModalBody"),
    modalError: document.getElementById("admColetaModalError"),
    modalConfirm: document.getElementById("admColetaModalConfirm"),
    toast: document.getElementById("admColetaToast"),
    pager: document.getElementById("coletasPager"),
    pagerPrev: document.getElementById("coletasPagerPrev"),
    pagerNext: document.getElementById("coletasPagerNext"),
    pagerInfo: document.getElementById("coletasPagerInfo"),
    materiaisTip: document.getElementById("coletasMateriaisTip"),
  };

  let chartHoje = null;
  let chartHojeLabels = { meu: "Seu EcoPonto", outros: "Outros EcoPontos" };
  let selectedRow = null;
  let coletasCache = [];
  let paginaAtual = 1;
  let paginacaoAtual = { total: 0, pagina: 1, por_pagina: 10, total_paginas: 1 };
  let moradoresCache = [];
  let responsaveisCache = [];
  let modalAcaoAtual = null;
  let toastTimer = null;

  const MAT_TIP_CLASS = {
    plastico: "adm-coletas-mat-tip__icon--plastico",
    papel: "adm-coletas-mat-tip__icon--papel",
    vidro: "adm-coletas-mat-tip__icon--vidro",
    metal: "adm-coletas-mat-tip__icon--metal",
    organico: "adm-coletas-mat-tip__icon--organico",
    madeira: "adm-coletas-mat-tip__icon--madeira",
    eletronicos: "adm-coletas-mat-tip__icon--eletronicos",
    outros: "adm-coletas-mat-tip__icon--outros",
  };

  const MAT_TIP_SVG = {
    plastico:
      '<path d="M10.25 2.25h3.5v1.5h1.75c.55 0 1 .45 1 1v.75h-.9v11.9a2 2 0 0 1-2 1.85H9.4a2 2 0 0 1-2-1.85V6.5H6.5V5.5c0-.55.45-1 1-1h1.75V2.25Z" stroke-width="1.35"/>',
    papel:
      '<path d="M14.25 2.25H8.25a1.75 1.75 0 0 0-1.75 1.75v15.5a1.75 1.75 0 0 0 1.75 1.75h7.5a1.75 1.75 0 0 0 1.75-1.75V7.75l-4.5-4.5Z" stroke-width="1.35"/>',
    vidro: '<path d="M8.75 4.25h6.5v3.25L12 19.75l-3.25-12.25V4.25Z" stroke-width="1.75"/>',
    metal:
      '<path d="M8.25 3.25h7.5l1.1 2.75H18.5v12.65a1.75 1.75 0 0 1-1.75 1.75H7.25a1.75 1.75 0 0 1-1.75-1.75V6h2.55L8.25 3.25Z" stroke-width="1.35"/>',
    organico:
      '<path d="M12 4.25c-2.8 2.35-4.75 4.55-4.75 7.35a4.75 4.75 0 0 0 9.5 0c0-2.8-1.95-5-4.75-7.35Z" stroke-width="1.35"/>',
    madeira:
      '<path d="M8.25 4.25h7.5v3.5H8.25V4.25Z" stroke-width="1.35"/><path d="M7.25 7.75h9.5l-1.1 11H8.35L7.25 7.75Z" stroke-width="1.35"/>',
    eletronicos:
      '<rect x="5.25" y="4.25" width="13.5" height="15.5" rx="2" stroke-width="1.35"/>',
    outros: '<circle cx="12" cy="12" r="8.25" stroke-width="1.35"/>',
  };

  const MODAL_MATERIAIS = [
    { id: "plastico", label: "Plástico" },
    { id: "papel", label: "Papel" },
    { id: "vidro", label: "Vidro" },
    { id: "metal", label: "Metal" },
    { id: "organico", label: "Orgânico" },
    { id: "eletronicos", label: "Eletrônicos" },
    { id: "madeira", label: "Madeira" },
    { id: "outros", label: "Outros" },
  ];

  const MODAL_ICONS = {
    responsavel:
      '<svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-6 8a8 8 0 0 1 12 0v1H6v-1Z" fill="currentColor"/></svg>',
    status:
      '<svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8Z" fill="currentColor"/></svg>',
    concluida:
      '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 5.3-5.3 1.4 1.4-6.7 6.7Z" fill="currentColor"/></svg>',
    confirmar_recebimento:
      '<svg viewBox="0 0 24 24"><path d="M5 12.5 9.5 17 19 7.5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 3v4M8 5h8" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
    nova:
      '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  };

  function preencherFiltroBairros(bairros) {
    if (!els.filterBairro) return;
    const atual = els.filterBairro.value;
    els.filterBairro.innerHTML = '<option value="">Todos os bairros</option>';
    (bairros || []).forEach((nome) => {
      const opt = document.createElement("option");
      opt.value = nome;
      opt.textContent = nome;
      els.filterBairro.appendChild(opt);
    });
    if (atual) els.filterBairro.value = atual;
  }

  function atualizarPaginacao(paginacao) {
    paginacaoAtual = paginacao || paginacaoAtual;
    const totalPag = Math.max(1, Number(paginacaoAtual.total_paginas || 1));
    const pagina = Math.max(1, Number(paginacaoAtual.pagina || 1));
    const total = Number(paginacaoAtual.total || 0);

    if (els.pagerInfo) {
      els.pagerInfo.textContent =
        total > 0
          ? "Página " + pagina + " de " + totalPag + " · " + total + " moradores"
          : "Página 1 de 1";
    }
    if (els.pagerPrev) els.pagerPrev.disabled = pagina <= 1;
    if (els.pagerNext) els.pagerNext.disabled = pagina >= totalPag;
    if (els.pager) {
      els.pager.classList.toggle("hidden", total <= 10);
    }
  }

  function materialTipIconHtml(slug) {
    const key = MAT_TIP_SVG[slug] ? slug : "outros";
    const cls = MAT_TIP_CLASS[key] || MAT_TIP_CLASS.outros;
    return (
      '<span class="adm-coletas-mat-tip__icon ' +
      cls +
      '" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
      MAT_TIP_SVG[key] +
      "</svg></span>"
    );
  }

  function htmlTooltipMateriais(materiais) {
    if (!materiais || !materiais.length) {
      return (
        '<div class="adm-coletas-materiais-tip__card">' +
        '<div class="adm-coletas-materiais-tip__empty">' +
        '<span class="adm-coletas-materiais-tip__empty-icon" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 4h10l1 3H6l1-3Zm-1 5h12l-1 11H7L6 9Z"/></svg>' +
        "</span>" +
        "<p>Nenhum material registrado no EcoPonto.</p>" +
        "</div></div>"
      );
    }

    const itens = materiais
      .slice(0, 5)
      .map((m) => {
        const slug = String(m.material || "outros").toLowerCase();
        return (
          '<li class="adm-coletas-mat-tip__row">' +
          materialTipIconHtml(slug) +
          '<span class="adm-coletas-mat-tip__name">' +
          escHtml(m.label || m.material || "Material") +
          "</span>" +
          '<span class="adm-coletas-mat-tip__peso">' +
          escHtml(m.peso_fmt || "—") +
          "</span></li>"
        );
      })
      .join("");

    const qtd = Math.min(5, materiais.length);
    return (
      '<div class="adm-coletas-materiais-tip__card">' +
      '<header class="adm-coletas-materiais-tip__head">' +
      '<span class="adm-coletas-materiais-tip__head-icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M7 4h10l1 3H6l1-3Z"/><path d="M6 9h12l-1.2 10.5H7.2L6 9Z"/>' +
      "</svg></span>" +
      '<p class="adm-coletas-materiais-tip__title">Materiais para coleta</p>' +
      '<span class="adm-coletas-materiais-tip__count">' +
      qtd +
      "</span></header>" +
      '<ul class="adm-coletas-mat-tip__list">' +
      itens +
      "</ul></div>"
    );
  }

  function posicionarTooltipMateriais(row) {
    if (!els.materiaisTip || !row) return;

    const tip = els.materiaisTip;
    const rect = row.getBoundingClientRect();
    const gap = 14;
    const margin = 10;
    const tipRect = tip.getBoundingClientRect();

    let left = rect.right + gap;
    let top = rect.top + (rect.height - tipRect.height) / 2;
    let placement = "right";

    if (left + tipRect.width > window.innerWidth - margin) {
      left = rect.left - tipRect.width - gap;
      placement = "left";
    }
    if (left < margin) {
      left = Math.max(margin, rect.left + rect.width / 2 - tipRect.width / 2);
      top = rect.top - tipRect.height - gap;
      placement = "top";
    }

    top = Math.max(margin, Math.min(top, window.innerHeight - tipRect.height - margin));

    tip.style.left = left + "px";
    tip.style.top = top + "px";
    tip.dataset.placement = placement;
  }

  function mostrarTooltipMateriais(row, materiais) {
    if (!els.materiaisTip) return;
    els.materiaisTip.innerHTML = htmlTooltipMateriais(materiais);
    els.materiaisTip.classList.remove("hidden");
    els.materiaisTip.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(() => {
      posicionarTooltipMateriais(row);
      els.materiaisTip.classList.add("is-visible");
    });
  }

  function ocultarTooltipMateriais() {
    if (!els.materiaisTip) return;
    els.materiaisTip.classList.remove("is-visible");
    window.setTimeout(() => {
      if (!els.materiaisTip || els.materiaisTip.classList.contains("is-visible")) return;
      els.materiaisTip.classList.add("hidden");
      els.materiaisTip.setAttribute("aria-hidden", "true");
      els.materiaisTip.innerHTML = "";
    }, 180);
  }

  function renderTabela(coletas, paginacao) {
    coletasCache = coletas || [];
    if (paginacao) {
      paginaAtual = Math.max(1, Number(paginacao.pagina || 1));
      atualizarPaginacao(paginacao);
    }
    if (!els.tableBody) return;

    ocultarTooltipMateriais();

    if (!coletasCache.length) {
      els.tableBody.innerHTML = "";
      if (els.coletasEmpty) els.coletasEmpty.classList.remove("hidden");
      if (els.pager) els.pager.classList.add("hidden");
      return;
    }

    els.tableBody.innerHTML = coletasCache
      .map((c) => {
        const bairro = escHtml(c.bairro || "—");
        const tipo = escHtml(c.tipo || "caminhao");
        const status = escHtml(c.status || "confirmado");
        const pesoInf = c.peso_informado_kg != null ? Number(c.peso_informado_kg) : null;
        const ptsEst = c.pontos_estimados != null ? Number(c.pontos_estimados) : null;
        const pesoVal = c.peso_validado_kg != null ? Number(c.peso_validado_kg) : null;
        let validacaoExtra = "";
        if (pesoInf != null && pesoInf > 0) {
          validacaoExtra =
            '<br><small class="adm-coleta-peso-hint">Inf.: ' +
            escHtml(pesoInf.toFixed(2).replace(".", ",")) +
            " kg";
          if (ptsEst != null && ptsEst > 0) {
            validacaoExtra += " · ~" + escHtml(String(ptsEst)) + " pts";
          }
          validacaoExtra += "</small>";
        }
        if (pesoVal != null && pesoVal > 0) {
          validacaoExtra +=
            '<br><small class="adm-coleta-peso-hint">Val.: ' +
            escHtml(pesoVal.toFixed(2).replace(".", ",")) +
            " kg</small>";
        }
        const enderecoRaw = String(c.endereco || "").trim();
        const enderecoCelula =
          enderecoRaw && enderecoRaw !== "—"
            ? '<button type="button" class="adm-coleta-endereco-link" data-route-id="' +
              escHtml(c.id_agendamento) +
              '" title="Ver rota de caminhão no mapa">' +
              escHtml(enderecoRaw) +
              "</button>"
            : escHtml(enderecoRaw || "—");
        return (
          '<tr class="has-materiais-tip" data-id="' +
          escHtml(c.id_agendamento) +
          '" data-bairro="' +
          bairro +
          '" data-tipo="' +
          tipo +
          '" data-status="' +
          status +
          '">' +
          "<td>" +
          escHtml(c.usuario) +
          "</td>" +
          "<td>" +
          enderecoCelula +
          "</td>" +
          "<td>" +
          bairro +
          "</td>" +
          "<td>" +
          iconeTipoColeta(c.tipo) +
          "</td>" +
          "<td>" +
          escHtml(c.data_hora) +
          "</td>" +
          "<td>" +
          escHtml(c.responsavel || "—") +
          "</td>" +
          "<td>" +
          badgeStatusColeta(c.status) +
          validacaoExtra +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    if (els.coletasEmpty) els.coletasEmpty.classList.add("hidden");
    selectedRow = null;
  }

  const CHART_HOJE_CORES = {
    ecoponto: "#12895d",
    ecopontoFill: "rgba(18, 137, 93, 0.14)",
    prefeitura: "#4a6fa5",
    prefeituraFill: "rgba(74, 111, 165, 0.12)",
    gridH: "rgba(18, 137, 93, 0.07)",
    tickY: "#7a9489",
    tickX: "#5c766a",
  };

  const CHART_HOJE_LABELS_PADRAO = ["07h", "10h", "13h", "16h", "19h"];

  function escalaGraficoHoje(valores) {
    const maxValor = Math.max.apply(null, valores.concat([1]));
    const escalaMax = Math.max(4, Math.ceil(maxValor * 1.25));
    const step = escalaMax <= 4 ? 1 : Math.max(1, Math.ceil(escalaMax / 4));
    return { max: escalaMax, step };
  }

  function serieGraficoHoje(resumo) {
    const serie = (resumo && resumo.serie) || {};
    const labels = Array.isArray(serie.labels) && serie.labels.length
      ? serie.labels
      : CHART_HOJE_LABELS_PADRAO;
    const len = labels.length;
    const zeros = Array(len).fill(0);
    const meuArr = Array.isArray(serie.meu)
      ? serie.meu.slice(0, len)
      : Array.isArray(serie.ecoponto)
        ? serie.ecoponto.slice(0, len)
        : zeros.slice();
    const outrosArr = Array.isArray(serie.outros)
      ? serie.outros.slice(0, len)
      : Array.isArray(serie.prefeitura)
        ? serie.prefeitura.slice(0, len)
        : zeros.slice();
    while (meuArr.length < len) meuArr.push(0);
    while (outrosArr.length < len) outrosArr.push(0);
    return { labels, meu: meuArr, outros: outrosArr, eco: meuArr, pref: outrosArr };
  }

  function opcoesGraficoHoje(serie) {
    const escala = escalaGraficoHoje(serie.eco.concat(serie.pref));
    const fontFamily = '"Sora", system-ui, sans-serif';

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: "easeOutCubic" },
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 6, right: 8, bottom: 2, left: 0 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#09281c",
          titleColor: "#e8f7ef",
          bodyColor: "#c7dfd4",
          titleFont: { family: fontFamily, weight: "600", size: 12 },
          bodyFont: { family: fontFamily, size: 12 },
          padding: 10,
          cornerRadius: 8,
          borderColor: "rgba(152, 255, 209, 0.15)",
          borderWidth: 1,
          displayColors: true,
          boxPadding: 4,
          callbacks: {
            label(context) {
              const valor = context.parsed.y || 0;
              return valor === 1 ? "1 coleta" : valor + " coletas";
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          border: { display: false },
          ticks: {
            color: CHART_HOJE_CORES.tickX,
            font: { size: 11, weight: "500", family: fontFamily },
            padding: 8,
            maxRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          max: escala.max,
          ticks: {
            stepSize: escala.step,
            color: CHART_HOJE_CORES.tickY,
            font: { size: 10, weight: "500", family: fontFamily },
            padding: 6,
          },
          grid: {
            display: true,
            color: CHART_HOJE_CORES.gridH,
            lineWidth: 1,
            drawBorder: false,
          },
          border: { display: false },
        },
      },
    };
  }

  function dadosGraficoHoje(serie) {
    return {
      labels: serie.labels,
      datasets: [
        {
          label: chartHojeLabels.meu,
          data: serie.eco,
          borderColor: CHART_HOJE_CORES.ecoponto,
          backgroundColor: CHART_HOJE_CORES.ecopontoFill,
          borderWidth: 2.5,
          tension: 0.42,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: CHART_HOJE_CORES.ecoponto,
          pointHoverBorderColor: "#fff",
          pointHoverBorderWidth: 2,
          fill: true,
          order: 0,
        },
        {
          label: chartHojeLabels.outros,
          data: serie.pref,
          borderColor: CHART_HOJE_CORES.prefeitura,
          backgroundColor: "transparent",
          borderWidth: 2.5,
          tension: 0.42,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: CHART_HOJE_CORES.prefeitura,
          pointHoverBorderColor: "#fff",
          pointHoverBorderWidth: 2,
          fill: false,
          order: 1,
        },
      ],
    };
  }

  function atualizarGraficoHoje(resumo) {
    const nomeMeu = String((resumo && resumo.nome_ecoponto) || "Seu EcoPonto").trim();
    const meuTotal = Number(
      (resumo && resumo.meu_ecoponto) ?? (resumo && resumo.caminhao) ?? 0
    );
    const outrosTotal = Number(
      (resumo && resumo.outros_ecopontos) ?? (resumo && resumo.prefeitura) ?? 0
    );

    chartHojeLabels.meu = nomeMeu || "Seu EcoPonto";
    chartHojeLabels.outros = "Outros EcoPontos";

    if (els.legendMeuLabel) {
      els.legendMeuLabel.textContent = chartHojeLabels.meu;
      els.legendMeuLabel.title = chartHojeLabels.meu;
    }
    if (els.legendOutrosLabel) {
      els.legendOutrosLabel.textContent = chartHojeLabels.outros;
    }
    if (els.legendEcoponto) els.legendEcoponto.textContent = String(meuTotal);
    if (els.legendOutros) els.legendOutros.textContent = String(outrosTotal);

    const canvas = document.getElementById("chartColetaHoje");
    if (!canvas || typeof Chart === "undefined") return;

    const serie = serieGraficoHoje(resumo);
    const data = dadosGraficoHoje(serie);
    const options = opcoesGraficoHoje(serie);

    if (chartHoje) {
      if (chartHoje.config.type !== "line") {
        chartHoje.destroy();
        chartHoje = null;
      }
    }

    if (chartHoje) {
      chartHoje.data = data;
      chartHoje.options.scales.y.max = options.scales.y.max;
      chartHoje.options.scales.y.ticks.stepSize = options.scales.y.ticks.stepSize;
      chartHoje.update("active");
      return;
    }

    Chart.defaults.font.family = '"Sora", system-ui, sans-serif';
    chartHoje = new Chart(canvas, {
      type: "line",
      data,
      options,
    });
  }

  function iniciarMapaColetas(admin) {
    const Mapa = window.EcoColetaMapa;
    if (!Mapa || typeof Mapa.createEcopontoAdminMap !== "function") return;
    if (!document.getElementById("adm-coletas-map")) return;
    if (window.EcoColetaColetasMap) return;

    const ecoponto = admin.ecoponto || "EcoPonto";
    const address =
      admin.endereco ||
      (els.ecopontoMapAddress && els.ecopontoMapAddress.textContent.trim()) ||
      "";

    const widget = Mapa.createEcopontoAdminMap({
      mapElId: "adm-coletas-map",
      statusId: "adm-coletas-map-route-status",
      navMountId: "adm-coletas-map-nav-mount",
      getEcopontoInfo() {
        return {
          name:
            (els.ecopontoMapName && els.ecopontoMapName.textContent.trim()) ||
            ecoponto,
          address:
            (els.ecopontoMapAddress && els.ecopontoMapAddress.textContent.trim()) ||
            address,
        };
      },
    });

    widget.init();
    window.EcoColetaColetasMap = widget;
    widget.setEcoponto({ name: ecoponto, address }).then(() => {
      if (typeof widget.invalidateSize === "function") {
        window.setTimeout(() => widget.invalidateSize(), 150);
      }
    });
  }

  async function carregarColetas(pagina) {
    if (typeof pagina === "number" && pagina > 0) {
      paginaAtual = pagina;
    }
    const params = new URLSearchParams();
    params.set("pagina", String(paginaAtual));
    if (els.filterBairro && els.filterBairro.value) {
      params.set("bairro", els.filterBairro.value);
    }
    if (els.filterStatus && els.filterStatus.value) {
      params.set("status", els.filterStatus.value);
    }

    const url = apiColetasUrl(params.toString() || "");
    const data = await fetchJson(url);
    renderTabela(data.coletas || [], data.paginacao || null);
    moradoresCache = data.moradores || [];
    responsaveisCache = data.responsaveis || [];
    preencherFiltroBairros(data.bairros || []);
    atualizarGraficoHoje(data.resumo_hoje || {});

    const pev = data.ecoponto || {};
    if (els.ecopontoMapName) els.ecopontoMapName.textContent = pev.nome_ponto || "";
    if (els.ecopontoMapAddress && pev.endereco) {
      els.ecopontoMapAddress.textContent = pev.endereco;
    }

    const mapa = window.EcoColetaColetasMap;
    if (mapa && typeof mapa.setEcoponto === "function") {
      const lat = pev.latitude != null ? Number(pev.latitude) : NaN;
      const lng = pev.longitude != null ? Number(pev.longitude) : NaN;
      mapa.setEcoponto({
        name: pev.nome_ponto || "",
        address: pev.endereco || "",
        lat: Number.isFinite(lat) ? lat : undefined,
        lng: Number.isFinite(lng) ? lng : undefined,
      });
    }
  }

  function getColetaSelecionada() {
    if (!selectedRow) return null;
    const id = parseInt(selectedRow.getAttribute("data-id") || "0", 10);
    if (id <= 0) return null;
    return coletasCache.find((c) => Number(c.id_agendamento) === id) || {
      id_agendamento: id,
      usuario: selectedRow.cells[0] ? selectedRow.cells[0].textContent : "—",
      endereco: selectedRow.cells[1] ? selectedRow.cells[1].textContent : "—",
      bairro: selectedRow.getAttribute("data-bairro") || "—",
      tipo: selectedRow.getAttribute("data-tipo") || "caminhao",
      status: selectedRow.getAttribute("data-status") || "confirmado",
      data_hora: selectedRow.cells[4] ? selectedRow.cells[4].textContent : "—",
      responsavel: selectedRow.cells[5] ? selectedRow.cells[5].textContent : "—",
    };
  }

  function mostrarToast(msg, isError) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.toggle("is-error", !!isError);
    els.toast.classList.remove("hidden");
    els.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      els.toast.classList.remove("is-visible");
      window.setTimeout(() => els.toast.classList.add("hidden"), 280);
    }, 3200);
  }

  function setModalError(msg) {
    if (!els.modalError) return;
    if (!msg) {
      els.modalError.textContent = "";
      els.modalError.classList.add("hidden");
      return;
    }
    els.modalError.textContent = msg;
    els.modalError.classList.remove("hidden");
  }

  function normalizarSlugMaterial(slug) {
    const s = String(slug || "").toLowerCase().trim();
    if (s === "eletronico" || s === "eletrônico") return "eletronicos";
    if (s === "misto") return "outros";
    return s;
  }

  function mapaMateriaisMorador(coleta) {
    const map = {};
    (coleta && coleta.materiais ? coleta.materiais : []).forEach((m) => {
      const slug = normalizarSlugMaterial(m.material);
      if (!slug) return;
      map[slug] = {
        peso_kg: Number(m.peso_kg) || 0,
        label: m.label || m.material || slug,
      };
    });
    if (Object.keys(map).length === 0 && coleta && coleta.tipo_residuo) {
      String(coleta.tipo_residuo)
        .split(",")
        .forEach((part) => {
          const slug = normalizarSlugMaterial(part);
          if (slug) {
            map[slug] = { peso_kg: 0, label: slug };
          }
        });
    }
    return map;
  }

  function htmlModalBalancaMateriais(coleta) {
    const mapMorador = mapaMateriaisMorador(coleta);
    const cards = MODAL_MATERIAIS.map((mat) => {
      const decl = mapMorador[mat.id];
      const checked = decl ? " checked" : "";
      const pesoDecl = decl && decl.peso_kg > 0 ? decl.peso_kg : "";
      const pesoVal = pesoDecl !== "" ? String(pesoDecl) : "";
      const declHtml = decl
        ? '<span class="adm-coleta-balanca-mat__decl">Morador: ' +
          escHtml(
            pesoDecl !== ""
              ? Number(pesoDecl).toFixed(2).replace(".", ",") + " kg"
              : "informou este tipo"
          ) +
          "</span>"
        : "";
      return (
        '<label class="adm-coleta-balanca-mat">' +
        '<div class="adm-coleta-balanca-mat__top">' +
        '<input type="checkbox" data-mat-check="' +
        escHtml(mat.id) +
        '"' +
        checked +
        " />" +
        materialTipIconHtml(mat.id) +
        '<span class="adm-coleta-balanca-mat__label">' +
        escHtml(mat.label) +
        "</span></div>" +
        '<input type="number" class="adm-coleta-balanca-mat__peso" data-mat-peso="' +
        escHtml(mat.id) +
        '" min="0" step="0.01" inputmode="decimal" placeholder="kg"' +
        (checked ? "" : " disabled") +
        ' value="' +
        escHtml(pesoVal) +
        '" />' +
        declHtml +
        "</label>"
      );
    }).join("");

    return (
      '<section class="adm-coleta-balanca-mats" aria-label="Materiais na balança">' +
      '<div class="adm-coleta-balanca-mats__head">' +
      '<p class="adm-coleta-balanca-mats__title">Materiais alocados na balança</p>' +
      '<span class="adm-coleta-balanca-mats__sum" id="modalBalancaSomaMats">Soma: 0,00 kg</span>' +
      "</div>" +
      '<p class="adm-coleta-modal__hint">Confirme o que o morador reciclou: marque os materiais e distribua o peso validado entre eles.</p>' +
      '<div class="adm-coleta-balanca-mats__grid">' +
      cards +
      "</div>" +
      '<p class="adm-coleta-balanca-preview" id="modalBalancaPreview" hidden></p>' +
      "</section>"
    );
  }

  function coletarMateriaisModal() {
    if (!els.modalBody) return [];
    const lista = [];
    MODAL_MATERIAIS.forEach((mat) => {
      const chk = els.modalBody.querySelector('[data-mat-check="' + mat.id + '"]');
      const inp = els.modalBody.querySelector('[data-mat-peso="' + mat.id + '"]');
      if (!chk || !chk.checked || !inp) return;
      const peso = parseFloat(String(inp.value || "").replace(",", "."));
      if (!peso || peso <= 0) return;
      lista.push({ material: mat.id, peso_kg: Math.round(peso * 100) / 100 });
    });
    return lista;
  }

  function atualizarResumoBalancaModal() {
    if (!els.modalBody) return;
    const pesoInp = document.getElementById("modalInputPesoValidado");
    const somaEl = document.getElementById("modalBalancaSomaMats");
    const previewEl = document.getElementById("modalBalancaPreview");
    const pesoTotal = pesoInp ? parseFloat(String(pesoInp.value || "").replace(",", ".")) || 0 : 0;
    const materiais = coletarMateriaisModal();
    const somaMats = materiais.reduce((acc, m) => acc + m.peso_kg, 0);

    if (somaEl) {
      const fmt = somaMats.toFixed(2).replace(".", ",");
      somaEl.textContent = "Soma materiais: " + fmt + " kg";
      const diff = Math.abs(somaMats - pesoTotal);
      somaEl.classList.toggle("is-ok", pesoTotal > 0 && diff <= 0.05);
      somaEl.classList.toggle("is-warn", pesoTotal > 0 && diff > 0.05);
    }

    if (previewEl && window.EcoPontuacaoColeta) {
      const tipos = materiais.map((m) => m.material);
      const calc = window.EcoPontuacaoColeta.calcularPontos(pesoTotal, tipos, true);
      if (pesoTotal > 0 && tipos.length > 0) {
        previewEl.hidden = false;
        previewEl.innerHTML =
          "Estimativa de pontos com esta validação: <strong>~" +
          escHtml(String(calc.total)) +
          " pts</strong>";
      } else {
        previewEl.hidden = true;
        previewEl.innerHTML = "";
      }
    }
  }

  function vincularModalBalanca() {
    if (!els.modalBody) return;
    els.modalBody.querySelectorAll("[data-mat-check]").forEach((chk) => {
      chk.addEventListener("change", () => {
        const id = chk.getAttribute("data-mat-check");
        const inp = els.modalBody.querySelector('[data-mat-peso="' + id + '"]');
        if (!inp) return;
        inp.disabled = !chk.checked;
        if (!chk.checked) inp.value = "";
        else if (!inp.value) inp.focus();
        atualizarResumoBalancaModal();
      });
    });
    els.modalBody.querySelectorAll("[data-mat-peso]").forEach((inp) => {
      inp.addEventListener("input", atualizarResumoBalancaModal);
    });
    const pesoInp = document.getElementById("modalInputPesoValidado");
    if (pesoInp) {
      pesoInp.addEventListener("input", atualizarResumoBalancaModal);
    }
    atualizarResumoBalancaModal();
  }

  function fecharModal() {
    if (!els.modalRoot) return;
    els.modalRoot.classList.add("hidden");
    els.modalRoot.setAttribute("aria-hidden", "true");
    document.body.classList.remove("adm-coleta-modal-open");
    els.actionButtons.forEach((b) => b.classList.remove("is-active"));
    modalAcaoAtual = null;
    setModalError("");
  }

  function abrirModal(acao) {
    if (!els.modalRoot) return;
    if (acao === "concluida") {
      acao = "confirmar_recebimento";
    }
    modalAcaoAtual = acao;
    setModalError("");

    const precisaLinha = acao !== "nova";
    const coleta = getColetaSelecionada();

    const meta = {
      responsavel: {
        kicker: "Equipe",
        title: "Atribuir responsável",
        desc: "Defina quem irá realizar ou acompanhar esta coleta.",
        confirm: "Salvar responsável",
      },
      status: {
        kicker: "Status",
        title: "Atualizar status",
        desc: "Altere a situação da coleta selecionada.",
        confirm: "Atualizar status",
      },
      concluida: {
        kicker: "Conclusão",
        title: "Marcar como concluída",
        desc: "Confirme que a coleta foi finalizada com sucesso.",
        confirm: "Marcar concluída",
      },
      confirmar_recebimento: {
        kicker: "Conclusão",
        title: "Confirmar coleta na balança",
        desc: "Valide o peso real e os materiais reciclados antes de marcar a coleta como concluída.",
        confirm: "Concluir e creditar pontos",
      },
      nova: {
        kicker: "Nova solicitação",
        title: "Solicitar nova coleta",
        desc: "Registre um agendamento manual para um morador.",
        confirm: "Criar coleta",
      },
    }[acao];

    if (els.modalIcon) els.modalIcon.innerHTML = MODAL_ICONS[acao] || "";
    if (els.modalKicker) els.modalKicker.textContent = meta.kicker;
    if (els.modalTitle) els.modalTitle.textContent = meta.title;
    if (els.modalDesc) els.modalDesc.textContent = meta.desc;
    if (els.modalConfirm) els.modalConfirm.textContent = meta.confirm;

    if (els.modalContext) {
      if (precisaLinha && coleta) {
        els.modalContext.innerHTML =
          "<strong>Coleta selecionada:</strong> " +
          escHtml(coleta.usuario) +
          " · " +
          escHtml(coleta.endereco) +
          "<br><span>" +
          escHtml(coleta.data_hora) +
          "</span>";
        els.modalContext.classList.remove("hidden");
      } else if (precisaLinha && !coleta) {
        els.modalContext.innerHTML =
          "Selecione uma linha na tabela de coletas para continuar.";
        els.modalContext.classList.remove("hidden");
      } else {
        els.modalContext.classList.add("hidden");
        els.modalContext.innerHTML = "";
      }
    }

    if (els.modalBody) {
      if (precisaLinha && !coleta) {
        els.modalBody.innerHTML =
          '<p class="adm-coleta-modal__hint">Clique em uma coleta na tabela acima e tente novamente.</p>';
        if (els.modalConfirm) els.modalConfirm.disabled = true;
      } else if (acao === "responsavel") {
        els.modalConfirm.disabled = false;
        const respAtual = coleta ? String(coleta.responsavel || "").trim() : "";
        let respOpts = "";
        const listaResp =
          responsaveisCache && responsaveisCache.length
            ? responsaveisCache
            : [respAtual || "—"];
        listaResp.forEach((nome) => {
          const n = String(nome || "").trim();
          if (!n) return;
          respOpts +=
            '<option value="' +
            escHtml(n) +
            '"' +
            (n === respAtual ? " selected" : "") +
            ">" +
            escHtml(n) +
            "</option>";
        });
        els.modalBody.innerHTML =
          '<label class="adm-coleta-modal__field">' +
          "<span>Responsável</span>" +
          '<select id="modalSelectResponsavel" required>' +
          respOpts +
          "</select></label>" +
          '<p class="adm-coleta-modal__hint">Escolha o administrador do EcoPonto que ficará responsável por esta coleta.</p>';
      } else if (acao === "status") {
        els.modalConfirm.disabled = false;
        const st = coleta ? coleta.status : "confirmado";
        els.modalBody.innerHTML =
          '<label class="adm-coleta-modal__field">' +
          "<span>Novo status</span>" +
          '<select id="modalSelectStatus">' +
          '<option value="pendente"' +
          (st === "pendente" ? " selected" : "") +
          ">Pendente</option>" +
          '<option value="aguardando_validacao"' +
          (st === "aguardando_validacao" ? " selected" : "") +
          ">Aguardando validação</option>" +
          '<option value="confirmado"' +
          (st === "confirmado" ? " selected" : "") +
          ">Confirmado</option>" +
          '<option value="andamento"' +
          (st === "andamento" ? " selected" : "") +
          ">Em andamento</option>" +
          "</select></label>" +
          '<p class="adm-coleta-modal__hint">Para concluir com validação na balança, use o botão <strong>Marcar como concluída</strong>.</p>';
      } else if (acao === "confirmar_recebimento") {
        els.modalConfirm.disabled = false;
        const pesoInf = coleta && coleta.peso_informado_kg != null ? Number(coleta.peso_informado_kg) : 0;
        const ptsEst = coleta && coleta.pontos_estimados != null ? Number(coleta.pontos_estimados) : 0;
        const stVal = coleta && coleta.status_validacao ? String(coleta.status_validacao) : "";
        const mapMorador = mapaMateriaisMorador(coleta);
        let somaDecl = 0;
        Object.keys(mapMorador).forEach((k) => {
          somaDecl += Number(mapMorador[k].peso_kg) || 0;
        });
        const sugerido = pesoInf > 0 ? pesoInf : somaDecl > 0 ? somaDecl : "";
        els.modalBody.innerHTML =
          '<div class="adm-coleta-modal__confirm-box">' +
          "<p><strong>Peso informado pelo morador:</strong> " +
          (pesoInf > 0 ? escHtml(pesoInf.toFixed(2).replace(".", ",")) + " kg" : "—") +
          "</p>" +
          (ptsEst > 0
            ? "<p><strong>Estimativa de pontos:</strong> ~" + escHtml(String(ptsEst)) + " pts</p>"
            : "") +
          (stVal
            ? "<p><strong>Status validação:</strong> " + escHtml(stVal) + "</p>"
            : "") +
          "<p>Confirme o que foi pesado na balança antes de creditar os EcoPontos.</p>" +
          "</div>" +
          '<label class="adm-coleta-modal__field">' +
          "<span>Peso total validado na balança (kg)</span>" +
          '<input type="number" id="modalInputPesoValidado" min="0.1" step="0.01" required value="' +
          escHtml(sugerido ? String(sugerido) : "") +
          '" placeholder="Ex.: 12.5" />' +
          "</label>" +
          htmlModalBalancaMateriais(coleta) +
          '<p class="adm-coleta-modal__hint">A soma dos materiais deve igualar o peso total. Divergências acima de 10% geram alerta; acima de 30% registram ocorrência.</p>';
        vincularModalBalanca();
      } else if (acao === "nova") {
        els.modalConfirm.disabled = false;
        const hoje = new Date().toISOString().slice(0, 10);
        let morOpts = '<option value="">Selecione o morador</option>';
        moradoresCache.forEach((m) => {
          morOpts +=
            '<option value="' +
            escHtml(m.id_usuario) +
            '">' +
            escHtml(m.nome) +
            (m.bairro ? " · " + escHtml(m.bairro) : "") +
            "</option>";
        });
        els.modalBody.innerHTML =
          '<label class="adm-coleta-modal__field"><span>Morador</span><select id="modalSelectMorador">' +
          morOpts +
          "</select></label>" +
          '<label class="adm-coleta-modal__field"><span>Data da coleta</span><input type="date" id="modalInputData" value="' +
          hoje +
          '" min="' +
          hoje +
          '" /></label>' +
          '<label class="adm-coleta-modal__field"><span>Horário</span><select id="modalSelectSlot">' +
          '<option value="0">07:00 às 10:00</option>' +
          '<option value="1">10:00 às 13:00</option>' +
          '<option value="2">13:00 às 16:00</option>' +
          '<option value="3">16:00 às 19:00</option>' +
          '<option value="4">19:00 às 22:00</option>' +
          "</select></label>" +
          '<p class="adm-coleta-modal__hint">A coleta será registrada para o EcoPonto e aparecerá na lista assim que for confirmada.</p>';
      }
    }

    els.modalRoot.classList.remove("hidden");
    els.modalRoot.setAttribute("aria-hidden", "false");
    document.body.classList.add("adm-coleta-modal-open");

    const activeBtn = document.querySelector('[data-coleta-action="' + acao + '"]');
    if (activeBtn) activeBtn.classList.add("is-active");

    window.setTimeout(() => {
      const first = els.modalBody && els.modalBody.querySelector("input, select");
      if (first) first.focus();
    }, 80);
  }

  async function confirmarModal() {
    if (!modalAcaoAtual) return;
    setModalError("");

    if (modalAcaoAtual !== "nova") {
      const coleta = getColetaSelecionada();
      if (!coleta) {
        setModalError("Selecione uma coleta na tabela.");
        return;
      }
      const id = String(coleta.id_agendamento);
      const body = new URLSearchParams({ id_agendamento: id });

      if (modalAcaoAtual === "responsavel") {
        const sel = document.getElementById("modalSelectResponsavel");
        const resp = sel ? String(sel.value || "").trim() : "";
        if (!resp) {
          setModalError("Selecione o responsável.");
          return;
        }
        body.set("acao", "responsavel");
        body.set("responsavel", resp);
      } else if (modalAcaoAtual === "status") {
        const sel = document.getElementById("modalSelectStatus");
        const novoStatus = sel ? sel.value : "confirmado";
        if (novoStatus === "concluida") {
          fecharModal();
          abrirModal("confirmar_recebimento");
          return;
        }
        body.set("acao", "status");
        body.set("status", novoStatus);
      } else if (modalAcaoAtual === "confirmar_recebimento") {
        const pesoInp = document.getElementById("modalInputPesoValidado");
        const pesoVal = pesoInp ? parseFloat(String(pesoInp.value || "").replace(",", ".")) : 0;
        if (!pesoVal || pesoVal < 0.1) {
          setModalError("Informe o peso validado (mínimo 0,1 kg).");
          return;
        }
        const materiais = coletarMateriaisModal();
        if (!materiais.length) {
          setModalError("Marque pelo menos um material e informe o peso alocado na balança.");
          return;
        }
        const somaMats = materiais.reduce((acc, m) => acc + m.peso_kg, 0);
        if (Math.abs(somaMats - pesoVal) > 0.05) {
          setModalError(
            "A soma dos materiais (" +
              somaMats.toFixed(2).replace(".", ",") +
              " kg) deve igualar o peso total (" +
              pesoVal.toFixed(2).replace(".", ",") +
              " kg)."
          );
          return;
        }
        body.set("acao", "confirmar_recebimento");
        body.set("peso_validado_kg", String(pesoVal));
        body.set("materiais", JSON.stringify(materiais));
        body.set("pagina", String(paginaAtual));
      }

      if (els.modalConfirm) els.modalConfirm.disabled = true;
      try {
        const data = await fetchJson(apiColetasUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: body.toString(),
        });
        if (modalAcaoAtual === "confirmar_recebimento" && data.coletas) {
          renderTabela(data.coletas, data.paginacao || null);
          if (data.resumo_hoje) atualizarGraficoHoje(data.resumo_hoje);
        } else {
          await carregarColetas(paginaAtual);
          if (data.resumo_hoje) atualizarGraficoHoje(data.resumo_hoje);
        }
        fecharModal();
        let toastMsg = data.mensagem || "Coleta atualizada.";
        if (data.alerta_admin) {
          toastMsg += " " + data.alerta_admin;
        }
        mostrarToast(toastMsg);
      } catch (e) {
        setModalError(e.message || "Erro ao atualizar.");
      } finally {
        if (els.modalConfirm) els.modalConfirm.disabled = false;
      }
      return;
    }

    const morador = document.getElementById("modalSelectMorador");
    const dataInp = document.getElementById("modalInputData");
    const slot = document.getElementById("modalSelectSlot");
    if (!morador || !morador.value) {
      setModalError("Selecione o morador.");
      return;
    }
    if (!dataInp || !dataInp.value) {
      setModalError("Informe a data da coleta.");
      return;
    }

    const body = new URLSearchParams({
      acao: "nova",
      id_usuario: morador.value,
      data_coleta: dataInp.value,
      slot_ordem: slot ? slot.value : "0",
      tipo: "caminhao",
      status: "confirmado",
    });

    if (els.modalConfirm) els.modalConfirm.disabled = true;
    try {
      const data = await fetchJson(apiColetasUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: body.toString(),
      });
      await carregarColetas(1);
      if (data.resumo_hoje) atualizarGraficoHoje(data.resumo_hoje);
      fecharModal();
      mostrarToast(data.mensagem || "Nova coleta criada.");
      try {
        window.dispatchEvent(new CustomEvent("ecocoleta:adm-notificacoes-atualizar"));
      } catch (err) {}
    } catch (e) {
      setModalError(e.message || "Erro ao criar coleta.");
    } finally {
      if (els.modalConfirm) els.modalConfirm.disabled = false;
    }
  }

  function selecionarLinhaColeta(row) {
    if (!row || !els.tableBody.contains(row)) return null;
    if (selectedRow) selectedRow.classList.remove("is-selected");
    selectedRow = row;
    row.classList.add("is-selected");

    const id = parseInt(row.getAttribute("data-id") || "0", 10);
    if (id <= 0) return null;
    return coletasCache.find((c) => Number(c.id_agendamento) === id) || null;
  }

  function destacarEnderecoLinha(row) {
    if (!els.tableBody || !row) return;
    els.tableBody.querySelectorAll(".adm-coleta-endereco-link.is-active").forEach((el) => {
      el.classList.remove("is-active");
    });
    const link = row.querySelector(".adm-coleta-endereco-link");
    if (link) link.classList.add("is-active");
  }

  async function tracerRotaColeta(coleta, row, options) {
    const opts = options || {};
    if (!coleta) return null;

    const endereco = String(coleta.endereco || "").trim();
    if (!endereco || endereco === "—" || endereco === "-") {
      if (opts.notifyEmpty) {
        mostrarToast("Endereço indisponível para traçar rota.", true);
      }
      return null;
    }

    destacarEnderecoLinha(row);

    const mapa = window.EcoColetaColetasMap;
    if (!mapa || typeof mapa.traceRouteToAddress !== "function") {
      if (opts.notifyMapNotReady !== false) {
        mostrarToast("Mapa ainda não está pronto. Aguarde um instante.", true);
      }
      return null;
    }

    const result = await mapa.traceRouteToAddress(endereco, {
      rua: coleta.rua || endereco,
      bairro: coleta.bairro,
      cidade: coleta.cidade,
      usuario: coleta.usuario,
    });

    if (result && opts.notifySuccess) {
      mostrarToast(
        "Rota de caminhão: " +
          result.label +
          " · " +
          Math.round(result.distance / 100) / 10 +
          " km"
      );
    }

    return result;
  }

  function configurarTooltipMateriais() {
    if (!els.tableBody) return;

    els.tableBody.addEventListener("mouseenter", (event) => {
      const row = event.target.closest("tr");
      if (!row || !els.tableBody.contains(row)) return;
      const id = parseInt(row.getAttribute("data-id") || "0", 10);
      const coleta = coletasCache.find((c) => Number(c.id_agendamento) === id);
      mostrarTooltipMateriais(row, (coleta && coleta.materiais) || []);
    }, true);

    els.tableBody.addEventListener("mouseleave", () => {
      ocultarTooltipMateriais();
    });
  }

  function configurarPaginacao() {
    if (els.pagerPrev) {
      els.pagerPrev.addEventListener("click", () => {
        if (paginaAtual > 1) {
          carregarColetas(paginaAtual - 1).catch((e) => mostrarToast(e.message, true));
        }
      });
    }
    if (els.pagerNext) {
      els.pagerNext.addEventListener("click", () => {
        if (paginaAtual < paginacaoAtual.total_paginas) {
          carregarColetas(paginaAtual + 1).catch((e) => mostrarToast(e.message, true));
        }
      });
    }
  }

  function configurarSelecaoLinha() {
    if (!els.tableBody) return;
    els.tableBody.addEventListener("click", (event) => {
      const enderecoBtn = event.target.closest(".adm-coleta-endereco-link");
      const row = enderecoBtn
        ? enderecoBtn.closest("tr")
        : event.target.closest("tr");
      if (!row || !els.tableBody.contains(row)) return;

      if (enderecoBtn) event.preventDefault();

      const coleta = selecionarLinhaColeta(row);
      if (!coleta) return;

      tracerRotaColeta(coleta, row, {
        notifyEmpty: !!enderecoBtn,
        notifySuccess: !!enderecoBtn,
      });
    });
  }

  function configurarAcoes() {
    els.actionButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-coleta-action");
        if (key) abrirModal(key);
      });
    });
  }

  function configurarModal() {
    if (!els.modalRoot) return;

    els.modalRoot.querySelectorAll("[data-coleta-modal-close]").forEach((el) => {
      el.addEventListener("click", fecharModal);
    });

    if (els.modalConfirm) {
      els.modalConfirm.addEventListener("click", () => {
        confirmarModal().catch((e) => setModalError(e.message));
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalAcaoAtual) fecharModal();
    });
  }

  async function iniciarPainel(admin) {
    const ecoponto = admin.ecoponto || "EcoPonto parceiro";
    if (els.ecopontoHint) {
      els.ecopontoHint.textContent = "Gerenciando coletas · " + ecoponto;
    }
    if (els.ecopontoMapName) els.ecopontoMapName.textContent = ecoponto;
    if (els.ecopontoMapAddress) {
      els.ecopontoMapAddress.textContent =
        admin.endereco || localStorage.getItem("ecopontoAdminEndereco") || "";
    }

    document.documentElement.classList.remove("admin-auth-checking");
    iniciarMapaColetas(admin);

    try {
      await carregarColetas();
    } catch (e) {
      if (els.authError) {
        els.authError.textContent = e.message;
        els.authError.classList.add("visible");
      }
    }
  }

  if (els.filters) {
    els.filters.addEventListener("submit", (event) => {
      event.preventDefault();
      carregarColetas(1).catch((e) => window.alert(e.message));
    });
  }

  setupSidebar(els);
  setupProfileMenu(els);
  configurarPaginacao();
  configurarTooltipMateriais();
  configurarSelecaoLinha();
  configurarAcoes();
  configurarModal();
  validarSessaoAdmin(els, iniciarPainel);
})();
