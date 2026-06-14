(function () {
  "use strict";

  var relatorio = null;
  var chartMensal = null;
  var chartMateriais = null;
  var chartEvolucao = null;

  var MATERIAL_COLORS = {
    "Plástico": "#1FA8C9",
    "Papel": "#5B8DEF",
    "Vidro": "#12A06A",
    "Metal": "#E5A03D",
    "Orgânico": "#7D9B76",
    "Madeira": "#B8834A",
    "Outros": "#9BB5A8",
  };

  var CHART = {
    deep: "#0a3d2e",
    emerald: "#12a06a",
    forest: "#0f6b4a",
    mint: "#8fffc7",
    muted: "#5c766a",
    grid: "rgba(15, 107, 74, 0.07)",
    barStops: [
      "rgba(143, 255, 199, 0.92)",
      "rgba(111, 232, 177, 0.92)",
      "rgba(77, 210, 154, 0.92)",
      "rgba(45, 186, 132, 0.92)",
      "rgba(24, 168, 114, 0.94)",
      "rgba(18, 160, 106, 0.96)",
      "rgba(15, 142, 94, 0.96)",
      "rgba(12, 124, 82, 0.98)",
      "rgba(10, 106, 72, 0.98)",
      "rgba(9, 90, 62, 0.98)",
      "rgba(8, 78, 54, 0.98)",
      "rgba(7, 66, 46, 0.98)",
    ],
  };

  function apiUrl(opts) {
    opts = opts || {};
    var url = window.ecocoletaPhpUrl
      ? window.ecocoletaPhpUrl("relatorio-plataforma-adm.php")
      : "api/relatorio-plataforma-adm.php";
    var params = new URLSearchParams();
    var inicio = document.getElementById("filterDataInicio");
    var fim = document.getElementById("filterDataFim");
    var bairro = document.getElementById("filterBairro");
    if (inicio && inicio.value) params.set("desde", inicio.value);
    if (fim && fim.value) params.set("ate", fim.value);
    if (bairro && bairro.value) params.set("bairro", bairro.value);
    if (opts.sync) params.set("sync", "1");
    var qs = params.toString();
    return qs ? url + (url.indexOf("?") >= 0 ? "&" : "?") + qs : url;
  }

  function loadRelatorio() {
    return fetch(apiUrl(), { credentials: "same-origin", cache: "no-store" })
      .then(function (r) {
        return r.text();
      })
      .then(function (text) {
        var raw = String(text).replace(/^\uFEFF/, "").trim();
        var data = JSON.parse(raw.indexOf("{") >= 0 ? raw.slice(raw.indexOf("{")) : raw);
        if (!data || data.sucesso !== true) {
          throw new Error((data && data.erro) || "Não foi possível carregar o relatório.");
        }
        return data.relatorio || data;
      });
  }

  function formatNum(n) {
    return Number(n).toLocaleString("pt-BR");
  }

  function setDefaultDates() {
    var fim = document.getElementById("filterDataFim");
    var inicio = document.getElementById("filterDataInicio");
    if (!fim || !inicio) return;

    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, "0");
    var d = String(now.getDate()).padStart(2, "0");
    fim.value = y + "-" + m + "-" + d;
    inicio.value = y + "-01-01";
  }

  function populateBairros(bairros) {
    var select = document.getElementById("filterBairro");
    if (!select) return;

    var current = select.value;
    select.innerHTML = '<option value="">Todos os bairros</option>';
    (bairros || []).forEach(function (b) {
      var opt = document.createElement("option");
      opt.value = b;
      opt.textContent = b;
      select.appendChild(opt);
    });
    if (current) select.value = current;
  }

  function filterFactor() {
    return 1;
  }

  function scaledValues(values, factor) {
    return values.map(function (v) {
      return Math.round(v * factor * 100) / 100;
    });
  }

  function renderKpis(data, factor) {
    var resumo = data.resumo || {};
    var impacto = data.impacto || {};

    var ton = (resumo.total_toneladas || 0) * factor;
    var elTon = document.getElementById("kpiTotalColetado");
    if (elTon) elTon.textContent = ton.toFixed(1).replace(".", ",") + " Ton";

    var trend = document.getElementById("kpiTotalTrend");
    var pct = resumo.total_trend_pct;
    if (trend) {
      if (pct == null || Number.isNaN(Number(pct))) {
        trend.hidden = true;
      } else {
        trend.hidden = false;
        var up = pct >= 0;
        trend.textContent =
          pct === 0
            ? "Estável vs último mês"
            : (up ? "↑ " : "↓ ") + Math.abs(pct) + "% vs último mês";
        trend.classList.toggle("plat-rel-kpi__trend--down", !up);
        trend.classList.toggle("plat-rel-kpi__trend--flat", pct === 0);
      }
    }

    var elEco = document.getElementById("kpiEcopontos");
    if (elEco) elEco.textContent = formatNum(Math.round((resumo.ecopontos_ativos || 0) * (factor > 0.85 ? 1 : 0.9)));

    var elPart = document.getElementById("kpiParticipacoes");
    if (elPart) elPart.textContent = formatNum(Math.round((resumo.participacoes || 0) * factor));

    var elArv = document.getElementById("impactoArvores");
    if (elArv) elArv.textContent = formatNum(Math.round((impacto.arvores || 0) * factor));

    var elAgua = document.getElementById("impactoAgua");
    if (elAgua) elAgua.textContent = formatNum(Math.round((impacto.agua_litros || 0) * factor));

    var elEn = document.getElementById("impactoEnergia");
    if (elEn) {
      elEn.textContent = (impacto.energia_mwh * factor).toFixed(1).replace(".", ",");
    }

    var mat = data.materiais || {};
    var donutKg = document.getElementById("donutKg");
    var donutPct = document.getElementById("donutPct");
    if (donutKg) {
      var totalKg = Math.round((mat.total_kg || 0) * factor);
      donutKg.textContent =
        totalKg >= 1000
          ? (totalKg / 1000).toFixed(1).replace(".", ",") + " t"
          : formatNum(totalKg) + " kg";
    }
    if (donutPct) donutPct.textContent = (mat.total_pct || 0) + "% reciclável";

    var mensalTrend = document.getElementById("chartMensalTrend");
    if (mensalTrend && data.coleta_mensal) {
      var tp = data.coleta_mensal.trend_pct;
      if (tp == null || tp === 0) {
        mensalTrend.textContent = "Evolução no período";
        mensalTrend.classList.add("plat-rel-chart-trend--flat");
      } else {
        mensalTrend.classList.remove("plat-rel-chart-trend--flat");
        mensalTrend.textContent = (tp > 0 ? "↑ " : "↓ ") + Math.abs(tp) + "% no período";
      }
    }
  }

  function barColorsFor(count) {
    var palette = CHART.barStops;
    if (count <= 0) return [CHART.emerald];
    if (count === 1) return [palette[palette.length - 1]];
    return Array.from({ length: count }, function (_, i) {
      var idx = Math.round((i / Math.max(1, count - 1)) * (palette.length - 1));
      return palette[idx];
    });
  }

  function formatKgShort(kg) {
    var n = Number(kg) || 0;
    if (n >= 1000) {
      return (n / 1000).toFixed(1).replace(".", ",") + " t";
    }
    return formatNum(Math.round(n)) + " kg";
  }

  function resolveMaterialColors(labels, serverColors) {
    return (labels || []).map(function (label, i) {
      return MATERIAL_COLORS[label] || serverColors[i] || CHART.emerald;
    });
  }

  function renderLegendMateriais(mat, factor) {
    var list = document.getElementById("legendMateriais");
    if (!list || !mat.labels) return;

    var total = mat.values.reduce(function (a, b) {
      return a + b;
    }, 0);

    list.innerHTML = mat.labels
      .map(function (label, i) {
        var val = Math.round((mat.values[i] || 0) * factor);
        var pct = total > 0 ? Math.round((val / total) * 100) : 0;
        var color = resolveMaterialColors(mat.labels, mat.colors)[i] || CHART.emerald;
        return (
          '<li class="plat-rel-legend__item">' +
          '<span class="plat-rel-legend-swatch" style="background:' +
          color +
          ';box-shadow:0 0 0 1px ' +
          color +
          '33"></span>' +
          '<span class="plat-rel-legend__label">' +
          label +
          "</span>" +
          '<span class="plat-rel-legend__meta">' +
          '<strong class="plat-rel-legend__pct">' +
          pct +
          "%</strong>" +
          '<span class="plat-rel-legend__kg">' +
          formatKgShort(val) +
          "</span></span></li>"
        );
      })
      .join("");
  }

  function destroyCharts() {
    [chartMensal, chartMateriais, chartEvolucao].forEach(function (c) {
      if (c) c.destroy();
    });
    chartMensal = chartMateriais = chartEvolucao = null;
  }

  function initCharts(data, factor) {
    if (typeof Chart === "undefined") return;

    destroyCharts();

    var fontFamily = '"Sora", system-ui, sans-serif';
    Chart.defaults.font.family = fontFamily;
    Chart.defaults.color = CHART.muted;

    var mensal = data.coleta_mensal || {};
    var mensalValues = scaledValues(mensal.values || [], factor);
    var canvasMensal = document.getElementById("chartColetaMensal");
    if (canvasMensal) {
      chartMensal = new Chart(canvasMensal, {
        type: "bar",
        data: {
          labels: mensal.labels || [],
          datasets: [
            {
              data: mensalValues,
              backgroundColor: barColorsFor(mensalValues.length),
              borderRadius: 10,
              borderSkipped: false,
              maxBarThickness: 40,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: CHART.grid },
              border: { display: false },
              ticks: {
                color: CHART.muted,
                callback: function (v) {
                  return v + " t";
                },
              },
            },
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: { color: CHART.muted, font: { weight: "600" } },
            },
          },
        },
      });
    }

    var mat = data.materiais || {};
    var canvasMat = document.getElementById("chartMateriais");
    if (canvasMat) {
      var matValues = scaledValues(mat.values || [], factor);
      var matColors = resolveMaterialColors(mat.labels || [], mat.colors || []);
      chartMateriais = new Chart(canvasMat, {
        type: "doughnut",
        data: {
          labels: mat.labels || [],
          datasets: [
            {
              data: matValues,
              backgroundColor: matColors,
              borderColor: "#ffffff",
              borderWidth: 4,
              hoverBorderColor: "#ffffff",
              hoverOffset: 10,
              spacing: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "68%",
          plugins: { legend: { display: false }, tooltip: { enabled: true } },
        },
      });
    }

    var evo = data.evolucao || {};
    var canvasEvo = document.getElementById("chartEvolucao");
    if (canvasEvo) {
      var evoValues = scaledValues(evo.values || [], factor);
      var ctx = canvasEvo.getContext("2d");
      var lineFill = null;
      if (ctx) {
        var grad = ctx.createLinearGradient(0, 0, 0, canvasEvo.height || 240);
        grad.addColorStop(0, "rgba(18, 160, 106, 0.28)");
        grad.addColorStop(0.55, "rgba(143, 255, 199, 0.12)");
        grad.addColorStop(1, "rgba(143, 255, 199, 0)");
        lineFill = grad;
      }
      chartEvolucao = new Chart(canvasEvo, {
        type: "line",
        data: {
          labels: evo.labels || [],
          datasets: [
            {
              data: evoValues,
              borderColor: CHART.forest,
              backgroundColor: lineFill || "rgba(18, 160, 106, 0.14)",
              fill: true,
              tension: 0.42,
              borderWidth: 2.5,
              pointRadius: 5,
              pointHoverRadius: 7,
              pointBackgroundColor: CHART.emerald,
              pointBorderColor: "#fff",
              pointBorderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: CHART.grid },
              border: { display: false },
              ticks: {
                color: CHART.muted,
                callback: function (v) {
                  return formatKgShort(v);
                },
              },
            },
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: { color: CHART.muted, font: { weight: "600" } },
            },
          },
        },
      });
    }

    renderLegendMateriais(mat, factor);
  }

  function refreshView() {
    if (!relatorio) return;
    var factor = filterFactor();
    renderKpis(relatorio, factor);
    initCharts(relatorio, factor);
  }

  function getFilterMeta() {
    var inicio = document.getElementById("filterDataInicio");
    var fim = document.getElementById("filterDataFim");
    var bairro = document.getElementById("filterBairro");
    var di = inicio && inicio.value ? inicio.value : "";
    var df = fim && fim.value ? fim.value : "";
    var periodo = di && df ? di + " a " + df : di || df || "Período não definido";
    return {
      periodo: periodo,
      bairro: bairro && bairro.value ? bairro.value : "Todos os bairros",
    };
  }

  function buildExportSections(factor) {
    var resumo = relatorio.resumo || {};
    var impacto = relatorio.impacto || {};
    var mensal = relatorio.coleta_mensal || {};
    var mat = relatorio.materiais || {};
    var evo = relatorio.evolucao || {};

    var ton = ((resumo.total_toneladas || 0) * factor).toFixed(1).replace(".", ",");
    var mensalRows = (mensal.labels || []).map(function (label, i) {
      var vals = scaledValues(mensal.values || [], factor);
      return [label, String(vals[i] != null ? vals[i] : 0).replace(".", ",") + " t"];
    });
    var matRows = (mat.labels || []).map(function (label, i) {
      var vals = scaledValues(mat.values || [], factor);
      return [label, String(vals[i] != null ? vals[i] : 0) + " kg"];
    });
    var evoRows = (evo.labels || []).map(function (label, i) {
      var vals = scaledValues(evo.values || [], factor);
      return [label, String(vals[i] != null ? vals[i] : 0) + " kg"];
    });

    return [
      {
        heading: "Indicadores",
        headers: ["Indicador", "Valor"],
        rows: [
          ["Total coletado (toneladas)", ton],
          ["Ecopontos ativos", String(Math.round((resumo.ecopontos_ativos || 0) * (factor > 0.85 ? 1 : 0.9)))],
          ["Participações", String(Math.round((resumo.participacoes || 0) * factor))],
          ["Tendência mensal (%)", String(resumo.total_trend_pct != null ? resumo.total_trend_pct : "—")],
        ],
      },
      {
        heading: "Impacto ambiental",
        headers: ["Indicador", "Valor"],
        rows: [
          ["Árvores conservadas", String(Math.round((impacto.arvores || 0) * factor))],
          ["Litros de água conservados", String(Math.round((impacto.agua_litros || 0) * factor))],
          ["MWh de energia conservados", String((impacto.energia_mwh * factor).toFixed(1).replace(".", ","))],
        ],
      },
      {
        heading: "Coleta mensal",
        headers: ["Mês", "Volume (t)"],
        rows: mensalRows,
      },
      {
        heading: "Materiais coletados",
        headers: ["Material", "Volume (kg)"],
        rows: matRows,
      },
      {
        heading: "Evolução de coleta",
        headers: ["Período", "Volume (kg)"],
        rows: evoRows,
      },
    ];
  }

  function exportRelatorio(format) {
    if (!relatorio) {
      window.alert("Aguarde o carregamento do relatório antes de exportar.");
      return;
    }
    if (!window.EcocoletaExport) {
      window.alert("Módulo de exportação não carregado. Recarregue a página.");
      return;
    }

    var Ex = window.EcocoletaExport;
    var factor = filterFactor();
    var meta = getFilterMeta();
    var sections = buildExportSections(factor);
    var filename = "relatorio_plataforma_" + Ex.timestamp();

    if (format === "pdf") {
      Ex.printPdf({
        title: "Relatórios e Análises — EcoColeta",
        subtitle: "Painel da plataforma",
        meta: [
          ["Período", meta.periodo],
          ["Local", meta.bairro],
        ],
        sections: sections,
      });
      return;
    }

    Ex.downloadExcel(filename, [
      {
        heading: "EcoColeta — Relatório da plataforma",
        rows: [
          ["Período", meta.periodo],
          ["Local", meta.bairro],
        ],
      },
    ].concat(sections));
  }

  function setupFilters() {
    setDefaultDates();
    var form = document.getElementById("relatorioFilters");
    if (form) {
      form.addEventListener("change", function () {
        loadRelatorioUi();
      });
    }

    var btnExport = document.getElementById("btnExportarRelatorio");
    if (btnExport) {
      btnExport.addEventListener("click", function () {
        exportRelatorio("excel");
      });
    }
  }

  function loadRelatorioUi() {
    return loadRelatorio()
      .then(function (data) {
        relatorio = data;
        populateBairros(data.bairros || []);
        refreshView();
      })
      .catch(function (err) {
        relatorio = {
          resumo: {},
          impacto: {},
          coleta_mensal: { labels: [], values: [] },
          materiais: { labels: [], values: [], colors: [] },
          evolucao: { labels: [], values: [] },
          bairros: [],
        };
        populateBairros([]);
        window.alert((err && err.message) || "Não foi possível carregar o relatório do banco de dados.");
        refreshView();
      });
  }

  function init() {
    setupFilters();

    if (!window.PlatAdmShell || typeof window.PlatAdmShell.init !== "function") {
      document.documentElement.classList.remove("plat-auth-checking");
      loadRelatorioUi();
      return;
    }

    window.PlatAdmShell.init()
      .then(function () {
        return loadRelatorioUi();
      })
      .catch(function (err) {
        if (err && err.message === "sessao") {
          return;
        }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
