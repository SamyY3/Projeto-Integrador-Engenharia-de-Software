(function () {
  "use strict";

  function revelarPagina() {
    document.documentElement.classList.remove("admin-auth-checking");
  }

  const ecoAdm = window.EcoAdm;
  if (!ecoAdm) {
    revelarPagina();
    const errEl = document.getElementById("dashboardAuthError");
    if (errEl) {
      errEl.textContent =
        "Nao foi possivel carregar os scripts do painel. Verifique o Apache e recarregue (Ctrl+F5).";
      errEl.classList.add("visible");
    }
    return;
  }

  const { escHtml, fetchJson, setupProfileMenu, setupSidebar, validarSessaoAdmin } = ecoAdm;

  const API_URL = window.ecocoletaPhpUrl
    ? window.ecocoletaPhpUrl("adm-materiais.php")
    : "api/adm-materiais.php";

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
    materiasHint: document.getElementById("materiasEcopontoHint"),
    filterEcopontoAtual: document.getElementById("filterEcopontoAtual"),
    filters: document.getElementById("materiasFilters"),
    filterMaterial: document.getElementById("filterMaterial"),
    filterPeriodo: document.getElementById("filterPeriodo"),
    tableBody: document.getElementById("materiasTableBody"),
    materiasEmpty: document.getElementById("materiasEmpty"),
    pager: document.getElementById("materiasPager"),
    pagerPrev: document.getElementById("materiasPagerPrev"),
    pagerNext: document.getElementById("materiasPagerNext"),
    pagerInfo: document.getElementById("materiasPagerInfo"),
    kpiTotal: document.getElementById("materiasKpiTotal"),
    kpiTop: document.getElementById("materiasKpiTop"),
    kpiTopIcon: document.getElementById("materiasKpiTopIcon"),
    kpiTaxa: document.getElementById("materiasKpiTaxa"),
    chartTotal: document.getElementById("chartMateriaisTotal"),
    chartLegend: document.getElementById("chartMateriaisLegend"),
    actionButtons: document.querySelectorAll("[data-mat-action]"),
    modalRoot: document.getElementById("admMatModal"),
    modalBody: document.getElementById("admMatModalBody"),
    modalError: document.getElementById("admMatModalError"),
    modalConfirm: document.getElementById("admMatModalConfirm"),
    toast: document.getElementById("admMatToast"),
  };

  let chartMateriais = null;
  let chartPayloadPending = null;
  let chartWaitTimer = null;
  let ultimoMateriais = null;
  let linhasCache = [];
  let paginaAtual = 1;
  const POR_PAGINA = 10;
  let adminCtx = null;
  let moradoresCache = [];
  let responsaveisCache = [];
  let toastTimer = null;

  const iconClass = {
    plastico: "adm-material-icon--plastico",
    papel: "adm-material-icon--papel",
    vidro: "adm-material-icon--vidro",
    metal: "adm-material-icon--metal",
    organico: "adm-material-icon--organico",
    madeira: "adm-material-icon--madeira",
    eletronicos: "adm-material-icon--eletronicos",
    outros: "adm-material-icon--outros",
  };

  const MATERIAL_PATHS = {
    plastico:
      '<path d="M10.25 2.25h3.5v1.5h1.75c.55 0 1 .45 1 1v.75h-.9v11.9a2 2 0 0 1-2 1.85H9.4a2 2 0 0 1-2-1.85V6.5H6.5V5.5c0-.55.45-1 1-1h1.75V2.25Z" stroke-width="1.35"/>' +
      '<path d="M9.25 8.25h5.5M9.25 11.25h5.5M9.25 14.25h5.5" stroke-width="1.1"/>',
    papel:
      '<path d="M14.25 2.25H8.25a1.75 1.75 0 0 0-1.75 1.75v15.5a1.75 1.75 0 0 0 1.75 1.75h7.5a1.75 1.75 0 0 0 1.75-1.75V7.75l-4.5-4.5Z" stroke-width="1.35"/>' +
      '<path d="M14.25 2.25v5.5h5.5M8.25 13.25h7.5M8.25 16.75h5.25" stroke-width="1.1"/>',
    vidro:
      '<path d="M8.75 4.25h6.5v3.25L12 19.75l-3.25-12.25V4.25Z" stroke-width="1.75"/>' +
      '<path d="M9.75 19.75h4.5" stroke-width="1.75"/>',
    metal:
      '<path d="M8.25 3.25h7.5l1.1 2.75H18.5v12.65a1.75 1.75 0 0 1-1.75 1.75H7.25a1.75 1.75 0 0 1-1.75-1.75V6h2.55L8.25 3.25Z" stroke-width="1.35"/>' +
      '<ellipse cx="12" cy="13.25" rx="3.75" ry="1.1" stroke-width="1.05"/>' +
      '<path d="M10.25 9.25h3.5" stroke-width="1.1"/>',
    organico:
      '<path d="M12 4.25c-2.8 2.35-4.75 4.55-4.75 7.35a4.75 4.75 0 0 0 9.5 0c0-2.8-1.95-5-4.75-7.35Z" stroke-width="1.35"/>' +
      '<path d="M12 11.6v2.65M10.5 14.25h3" stroke-width="1.1"/>' +
      '<path d="M12 4.25V3" stroke-width="1.1"/>',
    madeira:
      '<path d="M8.25 4.25h7.5v3.5H8.25V4.25Z" stroke-width="1.35"/>' +
      '<path d="M7.25 7.75h9.5l-1.1 11H8.35L7.25 7.75Z" stroke-width="1.35"/>' +
      '<path d="M9.25 11.25h5.5M9.25 14.75h5.5" stroke-width="1.1"/>',
    eletronicos:
      '<rect x="5.25" y="4.25" width="13.5" height="15.5" rx="2" stroke-width="1.35"/>' +
      '<path d="M9.25 18.25h5.5M12 7.25v3.75l2 1.75" stroke-width="1.2"/>',
    outros:
      '<circle cx="12" cy="12" r="8.25" stroke-width="1.35"/>' +
      '<path d="M12 8.25v7.5M8.25 12h7.5" stroke-width="1.2"/>',
  };

  const KPI_PATHS = {
    total:
      '<path d="M7 4h10l1 3H6l1-3Zm-1 5h12l-1 11H7L6 9Zm4 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"/>',
    taxa:
      '<path d="M4 17.5V16l5.8-5.8 3.4 3.4L19.5 8V6h2.5v2h-1.8l-6 6.1-3.4-3.4L5.5 16.3v1.2H4Z"/>',
    destaque:
      '<path d="M5 19v-4h3v4H5Zm5-5v5h3V14h-3Zm5-8v13h3V6h-3Z"/>',
    reciclagem:
      '<path d="M5.77 7.15 7.2 4.8 8.63 7.15H5v4h4V8.35l-.77.8H5.77zM18.23 16.85 16.8 19.2l-1.43-2.35H19v-4h-4v1.65l1.43 2.35h1.57v2zM5 17v-4H1.23l1.43-2.35L4.09 15H5v2zM19 7h3.77l-1.43 2.35L19 8.35V10h-4V6h4v1z"/>',
  };

  const KPI_MATERIAL_PATHS = {
    plastico:
      '<path d="M10 2h4v2h2c.55 0 1 .45 1 1v1h-1v12c0 1.1-.9 2-2 2H9c-1.1 0-2-.9-2-2V6H6V5c0-.55.45-1 1-1h2V2zm-1 6h2v2H9V8zm0 3.5h2V14H9v-1.5zm0 3.5h2V18H9v-1.5z"/>',
    papel:
      '<path d="M14 3H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V8l-6-5Zm0 2.4L17.6 9H14V5.4ZM8 13h8v2H8v-2zm0 4h6v2H8v-2z"/>',
    vidro:
      '<path d="M9.5 2.5h5V5l2.2 3.2V20H7.3V8.2L9.5 5V2.5Zm2.5 14.5h1.5v2h-1.5v-2z"/>',
    metal:
      '<path d="M8.5 3.5h7l1 2.5h2.5v13c0 1-.8 1.8-1.8 1.8h-9.4c-1 0-1.8-.8-1.8-1.8V6h2.5l1-2.5Zm1.7 9.5c0 .8.7 1.5 1.5 1.5h2.6c.8 0 1.5-.7 1.5-1.5v-.8c0-.8-.7-1.5-1.5-1.5h-2.6c-.8 0-1.5.7-1.5 1.5v.8Z"/>',
    organico:
      '<path d="M12 3.5c-3.1 2.6-5.2 5.1-5.2 8.3a5.2 5.2 0 1 0 10.4 0c0-3.2-2.1-5.7-5.2-8.3Zm0 11.2a2.9 2.9 0 1 1 0-5.8 2.9 2.9 0 0 1 0 5.8Z"/>',
    madeira:
      '<path d="M8.5 4h7v3.5H8.5V4Zm-1.5 4h10l-1 11H7.5l-1-11Zm2 3h6v2h-6v-2Zm0 3.5h6V17h-6v-2.5z"/>',
    eletronicos:
      '<path d="M6 4.5h12c1 0 1.8.8 1.8 1.8v11.4c0 1-.8 1.8-1.8 1.8H6c-1 0-1.8-.8-1.8-1.8V6.3c0-1 .8-1.8 1.8-1.8Zm6 12.3a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6ZM9 7.5h6v6.5H9V7.5Z"/>',
    outros:
      '<path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5 8.5 8.5 0 0 0-8.5-8.5Zm0 3.8a1.5 1.5 0 1 1-1.5 1.5 1.5 1.5 0 0 1 1.5-1.5Zm-3.2 9.2h6.4v1.5H8.8v-1.5Z"/>',
  };

  const MATERIAL_LABEL_SLUG = {
    metal: "metal",
    plastico: "plastico",
    "plástico": "plastico",
    vidro: "vidro",
    organico: "organico",
    "orgânico": "organico",
    papel: "papel",
    madeira: "madeira",
    eletronicos: "eletronicos",
    "eletrônicos": "eletronicos",
    outros: "outros",
  };

  function inlineSvg(paths, svgClass) {
    return (
      '<svg class="' +
      svgClass +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">' +
      paths +
      "</svg>"
    );
  }

  function kpiSvg(paths, svgClass) {
    return (
      '<svg class="' +
      svgClass +
      '" viewBox="0 0 24 24" fill="currentColor" focusable="false" aria-hidden="true">' +
      paths +
      "</svg>"
    );
  }

  function materialIconHtml(slug) {
    const colorClass = iconClass[slug] || "adm-material-icon--outros";
    const paths = MATERIAL_PATHS[slug] || MATERIAL_PATHS.outros;
    return (
      '<span class="adm-material-icon ' +
      colorClass +
      '" aria-hidden="true">' +
      inlineSvg(paths, "adm-material-icon__svg") +
      "</span>"
    );
  }

  function resolverSlugMaterial(kpis) {
    const slug = String((kpis && kpis.material_top_slug) || "")
      .trim()
      .toLowerCase();
    if (slug && MATERIAL_PATHS[slug]) return slug;

    const topLabel = String((kpis && kpis.material_top) || "")
      .trim()
      .toLowerCase();
    if (topLabel && topLabel !== "—") {
      return MATERIAL_LABEL_SLUG[topLabel] || "";
    }

    const fmt = String((kpis && kpis.material_top_fmt) || "");
    if (!fmt || fmt === "—") return "";

    const label = fmt.split("·")[0].trim().toLowerCase();
    return MATERIAL_LABEL_SLUG[label] || "";
  }

  const CHART_SLUGS_PADRAO = ["plastico", "papel", "vidro", "metal", "organico"];

  const CHART_MAT_CORES = {
    gridH: "rgba(18, 137, 93, 0.07)",
    tickX: "#6b7f75",
    tickY: "#8a9b92",
  };

  function clarearCor(hex, amount) {
    const raw = String(hex || "").replace("#", "").trim();
    if (raw.length !== 6) return hex || "#7a8794";
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    const mix = (ch) => Math.min(255, Math.round(ch + (255 - ch) * amount));
    return "rgb(" + mix(r) + ", " + mix(g) + ", " + mix(b) + ")";
  }

  function formatKgChart(kg) {
    const n = Number(kg) || 0;
    if (n <= 0) return "0 kg";
    if (n >= 100) return Math.round(n).toLocaleString("pt-BR") + " kg";
    if (n >= 10) return n.toFixed(1).replace(".", ",") + " kg";
    if (n >= 1) return n.toFixed(1).replace(".", ",") + " kg";
    return Math.round(n * 1000) + " g";
  }

  function escalaGraficoMateriais(valores) {
    const maxValor = Math.max.apply(null, (valores || []).concat([1]));
    const padded = maxValor * 1.12;
    let step;
    if (padded <= 10) step = 2;
    else if (padded <= 50) step = 10;
    else if (padded <= 200) step = 25;
    else if (padded <= 500) step = 50;
    else step = 100;
    const max = Math.max(step, Math.ceil(padded / step) * step);
    return { max, step };
  }

  function corMaterialCss(slug) {
    const cor = getComputedStyle(document.documentElement)
      .getPropertyValue("--adm-mat-color-" + slug)
      .trim();
    return cor || "#7a8794";
  }

  function coresGraficoMateriais(chart) {
    const slugs =
      chart && Array.isArray(chart.slugs) && chart.slugs.length
        ? chart.slugs
        : CHART_SLUGS_PADRAO;
    return slugs.map((slug) => corMaterialCss(slug));
  }

  const MATERIAL_OPTS = [
    ["plastico", "Plástico"],
    ["papel", "Papel"],
    ["vidro", "Vidro"],
    ["metal", "Metal"],
    ["organico", "Orgânico"],
    ["madeira", "Madeira"],
    ["eletronicos", "Eletrônicos"],
    ["outros", "Outros"],
  ];

  function aplicarPayload(data, resetPagina) {
    ultimoMateriais = data;
    if (Array.isArray(data.moradores)) moradoresCache = data.moradores;
    if (Array.isArray(data.responsaveis)) responsaveisCache = data.responsaveis;
    linhasCache = data.linhas || [];
    if (resetPagina !== false) paginaAtual = 1;
    renderTabela();
    atualizarChart(data.chart || {});
    aplicarKpis(data.kpis || {});
  }

  function atualizarPaginacaoMateriais() {
    const total = linhasCache.length;
    const totalPag = Math.max(1, Math.ceil(total / POR_PAGINA));
    if (paginaAtual > totalPag) paginaAtual = totalPag;

    if (els.pagerInfo) {
      els.pagerInfo.textContent =
        total > 0
          ? "Página " + paginaAtual + " de " + totalPag + " · " + total + " registros"
          : "Página 1 de 1";
    }
    if (els.pagerPrev) els.pagerPrev.disabled = paginaAtual <= 1;
    if (els.pagerNext) els.pagerNext.disabled = paginaAtual >= totalPag;
    if (els.pager) els.pager.classList.toggle("hidden", total <= POR_PAGINA);
  }

  function renderTabela() {
    if (!els.tableBody) return;
    atualizarPaginacaoMateriais();

    if (!linhasCache.length) {
      els.tableBody.innerHTML = "";
      if (els.materiasEmpty) els.materiasEmpty.classList.remove("hidden");
      if (els.pager) els.pager.classList.add("hidden");
      return;
    }

    const offset = (paginaAtual - 1) * POR_PAGINA;
    const linhas = linhasCache.slice(offset, offset + POR_PAGINA);

    els.tableBody.innerHTML = linhas
      .map((l) => {
        const slug = l.material || "outros";
        const status = l.status === "coletado" ? "coletado" : "recebido";
        const badge =
          status === "coletado"
            ? '<span class="adm-badge adm-badge-coletado-mat">Coletado</span>'
            : '<span class="adm-badge adm-badge-recebido">Recebido</span>';
        return (
          "<tr>" +
          '<td><span class="adm-material-cell">' +
          materialIconHtml(slug) +
          " " +
          escHtml(l.material_label) +
          "</span></td>" +
          "<td>" +
          escHtml(l.quantidade_fmt) +
          "</td>" +
          "<td>" +
          escHtml(l.usuario || l.ecoponto || "—") +
          "</td>" +
          "<td>" +
          escHtml(l.data) +
          "</td>" +
          "<td>" +
          badge +
          "</td>" +
          "<td>" +
          escHtml(l.responsavel || "—") +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
    if (els.materiasEmpty) els.materiasEmpty.classList.add("hidden");
  }

  function atualizarResumoChart(chart, slugs, cores) {
    const labels = (chart && chart.labels) || [];
    const values = (chart && chart.values) || [];
    const total = values.reduce((acc, val) => acc + (Number(val) || 0), 0);

    if (els.chartTotal) {
      const valueEl = els.chartTotal.querySelector(".adm-materias-chart-total__value");
      if (valueEl) valueEl.textContent = formatKgChart(total);
    }

    if (!els.chartLegend) return;
    els.chartLegend.innerHTML = slugs
      .map((slug, i) => {
        const nome = labels[i] || slug;
        const valor = formatKgChart(values[i]);
        return (
          '<div class="adm-materias-chart-chip adm-materias-chart-chip--' +
          escHtml(slug) +
          '">' +
          '<div class="adm-materias-chart-chip__row">' +
          '<span class="adm-materias-chart-chip__dot" aria-hidden="true"></span>' +
          '<span class="adm-materias-chart-chip__name">' +
          escHtml(nome) +
          "</span>" +
          "</div>" +
          "<strong>" +
          escHtml(valor) +
          "</strong>" +
          "</div>"
        );
      })
      .join("");
  }

  function gradienteBarraMaterial(context, cores, clareamento) {
    const chart = context.chart;
    const idx = context.dataIndex;
    const base = cores[idx] || "#7a8794";
    const { ctx, chartArea } = chart;
    if (!chartArea) return base;
    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    gradient.addColorStop(0, base);
    gradient.addColorStop(0.55, clarearCor(base, clareamento));
    gradient.addColorStop(1, clarearCor(base, Math.min(0.42, clareamento + 0.18)));
    return gradient;
  }

  function opcoesGraficoMateriais(valores) {
    const escala = escalaGraficoMateriais(valores);
    const fontFamily = '"Sora", system-ui, sans-serif';

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 650, easing: "easeOutCubic" },
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 8, right: 10, bottom: 4, left: 2 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#09281c",
          titleColor: "#e8f7ef",
          bodyColor: "#c7dfd4",
          titleFont: { family: fontFamily, weight: "600", size: 12 },
          bodyFont: { family: fontFamily, size: 12 },
          padding: 12,
          cornerRadius: 10,
          borderColor: "rgba(152, 255, 209, 0.15)",
          borderWidth: 1,
          displayColors: true,
          boxPadding: 5,
          callbacks: {
            label(context) {
              return formatKgChart(context.parsed.y);
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          border: { display: false },
          ticks: {
            color: CHART_MAT_CORES.tickX,
            font: { size: 11, weight: "600", family: fontFamily },
            padding: 10,
            maxRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          max: escala.max,
          ticks: {
            stepSize: escala.step,
            color: CHART_MAT_CORES.tickY,
            font: { size: 10, weight: "500", family: fontFamily },
            padding: 8,
            callback(value) {
              const n = Number(value) || 0;
              return n >= 1000 ? Math.round(n / 100) / 10 + "k" : n;
            },
          },
          grid: {
            display: true,
            color: CHART_MAT_CORES.gridH,
            lineWidth: 1,
            drawBorder: false,
          },
          border: { display: false },
        },
      },
    };
  }

  function dadosGraficoMateriais(chart, slugs, cores) {
    return {
      labels: (chart && chart.labels) || [],
      datasets: [
        {
          data: (chart && chart.values) || [],
          backgroundColor(context) {
            return gradienteBarraMaterial(context, cores, 0.14);
          },
          hoverBackgroundColor(context) {
            return gradienteBarraMaterial(context, cores, 0.28);
          },
          borderRadius: {
            topLeft: 14,
            topRight: 14,
            bottomLeft: 5,
            bottomRight: 5,
          },
          borderSkipped: false,
          maxBarThickness: 48,
          barPercentage: 0.58,
          categoryPercentage: 0.72,
        },
      ],
    };
  }

  function atualizarChart(chart) {
    const canvas = document.getElementById("chartMateriaisQuantidade");
    if (!canvas) return;

    if (typeof Chart === "undefined") {
      chartPayloadPending = chart || {};
      if (!chartWaitTimer) {
        chartWaitTimer = window.setInterval(function () {
          if (typeof Chart === "undefined") return;
          window.clearInterval(chartWaitTimer);
          chartWaitTimer = null;
          atualizarChart(chartPayloadPending);
        }, 200);
        window.setTimeout(function () {
          if (!chartWaitTimer) return;
          window.clearInterval(chartWaitTimer);
          chartWaitTimer = null;
        }, 15000);
      }
      return;
    }

    chartPayloadPending = null;

    const slugs =
      chart && Array.isArray(chart.slugs) && chart.slugs.length
        ? chart.slugs
        : CHART_SLUGS_PADRAO;
    const cores = coresGraficoMateriais(chart);
    const valores = (chart && chart.values) || [];

    atualizarResumoChart(chart || {}, slugs, cores);

    const data = dadosGraficoMateriais(chart, slugs, cores);
    const options = opcoesGraficoMateriais(valores);

    if (chartMateriais) {
      chartMateriais.data = data;
      chartMateriais.options.scales.y.max = options.scales.y.max;
      chartMateriais.options.scales.y.ticks.stepSize = options.scales.y.ticks.stepSize;
      chartMateriais.update("active");
      window.requestAnimationFrame(() => {
        if (chartMateriais) chartMateriais.resize();
      });
      return;
    }

    Chart.defaults.font.family = '"Sora", system-ui, sans-serif';
    chartMateriais = new Chart(canvas, {
      type: "bar",
      data,
      options,
    });
    window.requestAnimationFrame(() => {
      if (chartMateriais) chartMateriais.resize();
    });
  }

  function configurarResizeChartMateriais() {
    const wrap = document.querySelector(".adm-materias-chart-wrap");
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (chartMateriais) chartMateriais.resize();
    });
    observer.observe(wrap);
  }

  function atualizarTemaKpiTop(slug) {
    const card = els.kpiTopIcon && els.kpiTopIcon.closest(".adm-materias-kpi-card--top");
    if (!card) return;
    card.className =
      "adm-materias-kpi-card adm-materias-kpi-card--top adm-materias-kpi-card--mat-" +
      (slug || "empty");
  }

  function materialTopEmEmpate(kpis) {
    if (!kpis) return false;
    if (kpis.material_top_empate === true) return true;
    const slugs = kpis.material_top_slugs;
    return Array.isArray(slugs) && slugs.length > 1;
  }

  function atualizarKpiTopIcon(kpis) {
    if (!els.kpiTopIcon) return;

    if (materialTopEmEmpate(kpis)) {
      atualizarTemaKpiTop("empate");
      els.kpiTopIcon.className =
        "adm-materias-kpi-icon adm-materias-kpi-icon--reciclagem adm-materias-kpi-icon--halo";
      els.kpiTopIcon.innerHTML = kpiSvg(KPI_PATHS.reciclagem, "adm-materias-kpi-icon__svg");
      return;
    }

    const slug = resolverSlugMaterial(kpis);
    atualizarTemaKpiTop(slug);
    if (!slug) {
      els.kpiTopIcon.className =
        "adm-materias-kpi-icon adm-materias-kpi-icon--destaque adm-materias-kpi-icon--halo";
      els.kpiTopIcon.innerHTML = kpiSvg(KPI_PATHS.destaque, "adm-materias-kpi-icon__svg");
      return;
    }
    els.kpiTopIcon.className =
      "adm-materias-kpi-icon adm-materias-kpi-icon--material adm-materias-kpi-icon--halo";
    els.kpiTopIcon.innerHTML = kpiSvg(
      KPI_MATERIAL_PATHS[slug] || KPI_MATERIAL_PATHS.outros,
      "adm-materias-kpi-icon__svg"
    );
  }

  function aplicarKpis(kpis) {
    if (!kpis) return;
    if (els.kpiTotal) els.kpiTotal.textContent = kpis.total_fmt || "0 kg";
    if (els.kpiTop) els.kpiTop.textContent = kpis.material_top_fmt || "—";
    if (els.kpiTaxa) els.kpiTaxa.textContent = (kpis.taxa_reciclagem ?? 0) + "%";
    atualizarKpiTopIcon(kpis);
  }

  function labelPeriodo() {
    const sel = els.filterPeriodo;
    if (!sel) return "—";
    const opt = sel.options[sel.selectedIndex];
    return opt ? opt.textContent : sel.value;
  }

  function labelMaterialFiltro() {
    const sel = els.filterMaterial;
    if (!sel || !sel.value) return "Todos";
    const opt = sel.options[sel.selectedIndex];
    return opt ? opt.textContent : sel.value;
  }

  function filtrosQueryParams() {
    const params = new URLSearchParams();
    if (els.filterPeriodo && els.filterPeriodo.value) {
      params.set("periodo", els.filterPeriodo.value);
    }
    if (els.filterMaterial && els.filterMaterial.value) {
      params.set("material", els.filterMaterial.value);
    }
    return params;
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

  function fecharModal() {
    if (!els.modalRoot) return;
    els.modalRoot.classList.add("hidden");
    els.modalRoot.setAttribute("aria-hidden", "true");
    document.body.classList.remove("adm-coleta-modal-open");
    setModalError("");
  }

  function montarCorpoModal() {
    const hoje = new Date().toISOString().slice(0, 10);
    const ecoponto =
      adminCtx?.ecoponto ||
      (els.filterEcopontoAtual && els.filterEcopontoAtual.textContent) ||
      "EcoPonto";

    let matOpts = "";
    MATERIAL_OPTS.forEach(([val, lab]) => {
      matOpts += '<option value="' + escHtml(val) + '">' + escHtml(lab) + "</option>";
    });

    let morOpts = '<option value="">Selecione o morador</option>';
    moradoresCache.forEach((m) => {
      morOpts +=
        '<option value="' +
        escHtml(String(m.id_usuario)) +
        '">' +
        escHtml(m.nome) +
        (m.bairro ? " · " + escHtml(m.bairro) : "") +
        "</option>";
    });

    let respOpts = "";
    const listaResp =
      responsaveisCache && responsaveisCache.length
        ? responsaveisCache
        : [ecoponto && ecoponto !== "—" ? ecoponto : "Ecoponto"];
    listaResp.forEach((nome, idx) => {
      const n = String(nome || "").trim();
      if (!n) return;
      respOpts +=
        '<option value="' +
        escHtml(n) +
        '"' +
        (idx === 0 ? " selected" : "") +
        ">" +
        escHtml(n) +
        "</option>";
    });

    return (
      '<label class="adm-coleta-modal__field"><span>Tipo de material</span>' +
      '<select id="matModalMaterial" required>' +
      matOpts +
      "</select></label>" +
      '<label class="adm-coleta-modal__field"><span>Quantidade (kg)</span>' +
      '<input type="number" id="matModalPeso" min="0.1" step="0.1" placeholder="Ex.: 12.5" required /></label>' +
      '<label class="adm-coleta-modal__field"><span>Morador</span>' +
      '<select id="matModalMorador" required>' +
      morOpts +
      "</select></label>" +
      '<label class="adm-coleta-modal__field"><span>Data do registro</span>' +
      '<input type="date" id="matModalData" value="' +
      hoje +
      '" max="' +
      hoje +
      '" required /></label>' +
      '<label class="adm-coleta-modal__field"><span>Responsável</span>' +
      '<select id="matModalResponsavel" required>' +
      respOpts +
      "</select></label>" +
      '<p class="adm-coleta-modal__hint">Ecoponto: <strong>' +
      escHtml(ecoponto) +
      "</strong>. O morador receberá EcoPoints proporcionais ao peso. Se a data não aparecer na tabela, amplie o filtro de período.</p>"
    );
  }

  function abrirModalRegistrar() {
    if (!els.modalRoot) return;
    setModalError("");

    if (!moradoresCache.length) {
      window.alert(
        "Não há moradores cadastrados no sistema. Cadastre um morador antes de registrar materiais."
      );
      return;
    }

    if (els.modalBody) {
      els.modalBody.innerHTML = montarCorpoModal();
    }

    const ctx = document.getElementById("admMatModalContext");
    if (ctx) {
      ctx.classList.add("hidden");
      ctx.innerHTML = "";
    }

    els.modalRoot.classList.remove("hidden");
    els.modalRoot.setAttribute("aria-hidden", "false");
    document.body.classList.add("adm-coleta-modal-open");

    window.setTimeout(() => {
      const first = els.modalBody && els.modalBody.querySelector("select, input");
      if (first) first.focus();
    }, 80);
  }

  async function confirmarRegistro() {
    setModalError("");

    const matSel = document.getElementById("matModalMaterial");
    const pesoInp = document.getElementById("matModalPeso");
    const morSel = document.getElementById("matModalMorador");
    const dataInp = document.getElementById("matModalData");
    const respInp = document.getElementById("matModalResponsavel");

    if (!matSel || !matSel.value) {
      setModalError("Selecione o tipo de material.");
      return;
    }
    const peso = pesoInp ? parseFloat(String(pesoInp.value).replace(",", ".")) : 0;
    if (!peso || peso <= 0) {
      setModalError("Informe a quantidade em kg (maior que zero).");
      return;
    }
    if (!morSel || !morSel.value) {
      setModalError("Selecione o morador.");
      return;
    }
    if (!dataInp || !dataInp.value) {
      setModalError("Informe a data do registro.");
      return;
    }
    const respVal = respInp ? String(respInp.value || "").trim() : "";
    if (!respVal) {
      setModalError("Selecione o responsável.");
      return;
    }

    const body = new URLSearchParams({
      acao: "registrar",
      material: matSel.value,
      peso_kg: String(peso),
      id_usuario: morSel.value,
      data_entrega: dataInp.value,
      responsavel: respVal,
    });

    if (els.filterPeriodo && els.filterPeriodo.value) {
      body.set("periodo", els.filterPeriodo.value);
    }
    if (els.filterMaterial && els.filterMaterial.value) {
      body.set("material_filtro", els.filterMaterial.value);
    }

    if (els.modalConfirm) els.modalConfirm.disabled = true;
    try {
      const data = await fetchJson(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: body.toString(),
      });
      aplicarPayload(data);
      fecharModal();
      mostrarToast(data.mensagem || "Material registrado com sucesso.");
    } catch (e) {
      setModalError(e.message || "Erro ao registrar material.");
    } finally {
      if (els.modalConfirm) els.modalConfirm.disabled = false;
    }
  }

  function exportarMateriais(format) {
    if (!ultimoMateriais) {
      window.alert("Atualize os dados antes de exportar.");
      return;
    }
    if (!window.EcocoletaExport) {
      window.alert("Módulo de exportação não carregado. Recarregue a página.");
      return;
    }

    const Ex = window.EcocoletaExport;
    const kpis = ultimoMateriais.kpis || {};
    const linhas = ultimoMateriais.linhas || [];
    const chart = ultimoMateriais.chart || {};
    const ecoponto =
      adminCtx?.ecoponto ||
      (els.filterEcopontoAtual && els.filterEcopontoAtual.textContent) ||
      "EcoPonto";

    const sections = [
      {
        heading: "Indicadores",
        headers: ["Indicador", "Valor"],
        rows: [
          ["Total coletado", kpis.total_fmt || "0 kg"],
          ["Material em destaque", kpis.material_top_fmt || "—"],
          ["Taxa de reciclagem", (kpis.taxa_reciclagem ?? 0) + "%"],
        ],
      },
    ];

    if (chart.labels && chart.labels.length) {
      sections.push({
        heading: "Quantidade por material",
        headers: ["Material", "Quantidade (kg)"],
        rows: chart.labels.map((lab, i) => [lab, String(chart.values[i] ?? 0)]),
      });
    }

    sections.push({
      heading: "Registros",
      headers: ["Material", "Quantidade", "Usuário", "Data", "Status", "Responsável"],
      rows: linhas.map((l) => [
        l.material_label || l.material,
        l.quantidade_fmt || l.quantidade_kg,
        l.usuario || l.ecoponto || "—",
        l.data,
        l.status === "coletado" ? "Coletado" : "Recebido",
        l.responsavel || "—",
      ]),
    });

    const meta = [
      ["Ecoponto", ecoponto],
      ["Período", labelPeriodo()],
      ["Material (filtro)", labelMaterialFiltro()],
    ];

    if (format === "pdf") {
      Ex.printPdf({
        title: "Relatório de Materiais",
        subtitle: ecoponto,
        meta: meta,
        sections: sections,
      });
      return;
    }

    Ex.downloadExcel("materiais_ecoponto_" + Ex.timestamp(), [
      { heading: "EcoColeta — Materiais", rows: meta },
    ].concat(sections));
  }

  async function carregarMateriais() {
    const params = filtrosQueryParams();
    const url = API_URL + (params.toString() ? "?" + params.toString() : "");
    const data = await fetchJson(url);
    aplicarPayload(data);
  }

  async function iniciarPainel(admin) {
    adminCtx = admin;
    const ecoponto = admin.ecoponto || "EcoPonto parceiro";
    if (els.materiasHint) els.materiasHint.textContent = "Materiais · " + ecoponto;
    if (els.filterEcopontoAtual) els.filterEcopontoAtual.textContent = ecoponto;
    revelarPagina();
    try {
      await carregarMateriais();
    } catch (e) {
      if (els.authError) {
        els.authError.textContent = e.message;
        els.authError.classList.add("visible");
      }
    }
  }

  function configurarPaginacaoMateriais() {
    if (els.pagerPrev) {
      els.pagerPrev.addEventListener("click", () => {
        if (paginaAtual > 1) {
          paginaAtual -= 1;
          renderTabela();
        }
      });
    }
    if (els.pagerNext) {
      els.pagerNext.addEventListener("click", () => {
        const totalPag = Math.max(1, Math.ceil(linhasCache.length / POR_PAGINA));
        if (paginaAtual < totalPag) {
          paginaAtual += 1;
          renderTabela();
        }
      });
    }
  }

  if (els.filters) {
    els.filters.addEventListener("submit", (event) => {
      event.preventDefault();
      paginaAtual = 1;
      carregarMateriais().catch((e) => window.alert(e.message));
    });
  }

  configurarPaginacaoMateriais();
  configurarResizeChartMateriais();

  els.actionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-mat-action");
      if (key === "atualizar") {
        carregarMateriais().catch((e) => window.alert(e.message));
      } else if (key === "exportar") {
        exportarMateriais("excel");
      } else if (key === "registrar") {
        abrirModalRegistrar();
      }
    });
  });

  document.querySelectorAll("[data-mat-modal-close]").forEach((el) => {
    el.addEventListener("click", fecharModal);
  });

  if (els.modalConfirm) {
    els.modalConfirm.addEventListener("click", () => {
      confirmarRegistro();
    });
  }

  if (els.modalRoot) {
    els.modalRoot.addEventListener("keydown", (event) => {
      if (event.key === "Escape") fecharModal();
    });
  }

  try {
    setupSidebar(els);
    setupProfileMenu(els);
    validarSessaoAdmin(els, iniciarPainel);
  } catch (e) {
    revelarPagina();
    if (els.authError) {
      els.authError.textContent = e.message || "Erro ao iniciar o painel de materiais.";
      els.authError.classList.add("visible");
    }
  }
})();
