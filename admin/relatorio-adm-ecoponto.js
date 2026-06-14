(function () {
  const { escHtml, fetchJson, setupProfileMenu, setupSidebar, validarSessaoAdmin } =
    window.EcoAdm;

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
    relatorioHint: document.getElementById("relatorioEcopontoHint"),
    relatorioEcopontoNome: document.getElementById("relatorioEcopontoNome"),
    filterPeriodo: document.getElementById("filterPeriodo"),
    filterMaterial: document.getElementById("filterMaterial"),
    filterResponsavel: document.getElementById("filterResponsavel"),
    tableBody: document.getElementById("relatorioTableBody"),
    relatorioEmpty: document.getElementById("relatorioEmpty"),
    relatorioTableSubtitle: document.getElementById("relatorioTableSubtitle"),
    pager: document.getElementById("relatorioPager"),
    pagerPrev: document.getElementById("relatorioPagerPrev"),
    pagerNext: document.getElementById("relatorioPagerNext"),
    pagerInfo: document.getElementById("relatorioPagerInfo"),
    kpiTotal: document.getElementById("relatorioKpiTotal"),
    kpiTop: document.getElementById("relatorioKpiTop"),
    kpiTopIcon: document.getElementById("relatorioKpiTopIcon"),
    kpiTopCard: document.getElementById("relatorioKpiTopCard"),
    kpiTaxa: document.getElementById("relatorioKpiTaxa"),
    actionButtons: document.querySelectorAll("[data-rel-action]"),
  };

  let chartMat = null;
  let chartEvo = null;
  let chartTipo = null;
  let ultimoRelatorio = null;
  let adminCtx = null;
  let detalhesCache = [];
  let paginaAtual = 1;
  const POR_PAGINA = 5;

  const REL_KPI_MATERIAL_PATHS = {
    plastico:
      "M10 2h4v2h2c.55 0 1 .45 1 1v1h-1v12c0 1.1-.9 2-2 2H9c-1.1 0-2-.9-2-2V6H6V5c0-.55.45-1 1-1h2V2zm-1 6h2v2H9V8zm0 3.5h2V14H9v-1.5zm0 3.5h2V18H9v-1.5z",
    papel:
      "M14 3H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V8l-6-5Zm0 2.4L17.6 9H14V5.4ZM8 13h8v2H8v-2zm0 4h6v2H8v-2z",
    vidro: "M9.5 2.5h5V5l2.2 3.2V20H7.3V8.2L9.5 5V2.5Zm2.5 14.5h1.5v2h-1.5v-2z",
    metal:
      "M8.5 3.5h7l1 2.5h2.5v13c0 1-.8 1.8-1.8 1.8h-9.4c-1 0-1.8-.8-1.8-1.8V6h2.5l1-2.5Zm1.7 9.5c0 .8.7 1.5 1.5 1.5h2.6c.8 0 1.5-.7 1.5-1.5v-.8c0-.8-.7-1.5-1.5-1.5h-2.6c-.8 0-1.5.7-1.5 1.5v.8Z",
    organico:
      "M12 3.5c-3.1 2.6-5.2 5.1-5.2 8.3a5.2 5.2 0 1 0 10.4 0c0-3.2-2.1-5.7-5.2-8.3Zm0 11.2a2.9 2.9 0 1 1 0-5.8 2.9 2.9 0 0 1 0 5.8Z",
    madeira:
      "M8.5 4h7v3.5H8.5V4Zm-1.5 4h10l-1 11H7.5l-1-11Zm2 3h6v2h-6v-2Zm0 3.5h6V17h-6v-2.5z",
    eletronicos:
      "M6 4.5h12c1 0 1.8.8 1.8 1.8v11.4c0 1-.8 1.8-1.8 1.8H6c-1 0-1.8-.8-1.8-1.8V6.3c0-1 .8-1.8 1.8-1.8Zm6 12.3a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6ZM9 7.5h6v6.5H9V7.5Z",
    outros:
      "M12 3.5a8.5 8.5 0 1 0 8.5 8.5 8.5 8.5 0 0 0-8.5-8.5Zm0 3.8a1.5 1.5 0 1 1-1.5 1.5 1.5 1.5 0 0 1 1.5-1.5Zm-3.2 9.2h6.4v1.5H8.8v-1.5Z",
    reciclagem:
      "M5.77 7.15 7.2 4.8 8.63 7.15H5v4h4V8.35l-.77.8H5.77zM18.23 16.85 16.8 19.2l-1.43-2.35H19v-4h-4v1.65l1.43 2.35h1.57v2zM5 17v-4H1.23l1.43-2.35L4.09 15H5v2zM19 7h3.77l-1.43 2.35L19 8.35V10h-4V6h4v1z",
    destaque: "M5 19v-4h3v4H5Zm5-5v5h3V14h-3Zm5-8v13h3V6h-3Z",
  };

  const MATERIAL_SLUG_MAP = {
    plástico: "plastico",
    plastico: "plastico",
    papel: "papel",
    vidro: "vidro",
    metal: "metal",
    orgânico: "organico",
    organico: "organico",
    madeira: "madeira",
    eletrônicos: "eletronicos",
    eletronicos: "eletronicos",
    recicláveis: "outros",
    reciclaveis: "outros",
  };

  function resolverSlugMaterial(d) {
    const slug = String(d.material_slug || "").trim().toLowerCase();
    if (slug) return slug;
    const label = String(d.material || "")
      .trim()
      .toLowerCase();
    return MATERIAL_SLUG_MAP[label] || "outros";
  }

  function iniciaisNome(nome) {
    return String(nome || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("");
  }

  function celulaMaterial(d) {
    const slug = resolverSlugMaterial(d);
    return (
      '<span class="adm-rel-material">' +
      '<span class="adm-rel-material__dot adm-rel-material__dot--' +
      escHtml(slug) +
      '" aria-hidden="true"></span>' +
      '<span class="adm-rel-material__label">' +
      escHtml(d.material) +
      "</span></span>"
    );
  }

  function celulaQuantidade(qtd) {
    return '<span class="adm-rel-qty">' + escHtml(qtd) + "</span>";
  }

  function celulaTipoColeta(tipo) {
    const isPref = String(tipo || "").toLowerCase() === "prefeitura";
    return (
      '<span class="adm-rel-tipo adm-rel-tipo--' +
      (isPref ? "pref" : "cam") +
      '">' +
      escHtml(tipo) +
      "</span>"
    );
  }

  function celulaResponsavel(nome) {
    const n = String(nome || "—").trim() || "—";
    const ini = iniciaisNome(n) || "?";
    return (
      '<span class="adm-rel-resp">' +
      '<span class="adm-rel-resp__avatar" aria-hidden="true">' +
      escHtml(ini) +
      "</span>" +
      '<span class="adm-rel-resp__name">' +
      escHtml(n) +
      "</span></span>"
    );
  }

  function celulaEcoponto(nome) {
    return (
      '<span class="adm-rel-ecoponto">' +
      '<span class="adm-rel-ecoponto__dot" aria-hidden="true"></span>' +
      escHtml(nome) +
      "</span>"
    );
  }

  function atualizarSubtituloTabela(total) {
    if (!els.relatorioTableSubtitle) return;
    if (total <= 0) {
      els.relatorioTableSubtitle.textContent = "Nenhum registro para os filtros atuais";
      return;
    }
    const sel = els.filterResponsavel ? String(els.filterResponsavel.value || "").trim() : "";
    const filtro = sel ? " · filtrado por " + sel : "";
    els.relatorioTableSubtitle.textContent =
      total + (total === 1 ? " registro" : " registros") + " no período" + filtro;
  }

  function apiRelatorioUrl() {
    const params = new URLSearchParams();
    if (els.filterPeriodo) {
      params.set("periodo", els.filterPeriodo.value || "todos");
    }
    if (els.filterMaterial && els.filterMaterial.value) {
      params.set("material", els.filterMaterial.value);
    }
    const qs = params.toString();
    const path = "adm-relatorio.php";
    const base = window.ecocoletaPhpUrl
      ? window.ecocoletaPhpUrl(path)
      : "api/" + path;
    return base + (qs ? "?" + qs : "");
  }

  function filtrarDetalhes(detalhes) {
    const sel = els.filterResponsavel ? String(els.filterResponsavel.value || "").trim() : "";
    return (detalhes || []).filter((d) => {
      const resp = String(d.responsavel || "").trim();
      if (sel && resp !== sel) return false;
      return true;
    });
  }

  function atualizarPager(total) {
    const totalPag = Math.max(1, Math.ceil(total / POR_PAGINA));
    if (paginaAtual > totalPag) paginaAtual = totalPag;
    if (els.pagerInfo) {
      els.pagerInfo.textContent =
        total > 0
          ? "Página " + paginaAtual + " de " + totalPag + " · " + total + " registros"
          : "Nenhum registro";
    }
    if (els.pagerPrev) els.pagerPrev.disabled = paginaAtual <= 1;
    if (els.pagerNext) els.pagerNext.disabled = paginaAtual >= totalPag || total === 0;
    if (els.pager) {
      els.pager.classList.toggle("hidden", total <= POR_PAGINA);
    }
  }

  function renderTabela(detalhes, resetPagina) {
    if (!els.tableBody) return;
    if (resetPagina !== false) paginaAtual = 1;

    const filtrados = filtrarDetalhes(detalhes);
    atualizarPager(filtrados.length);
    atualizarSubtituloTabela(filtrados.length);

    if (!filtrados.length) {
      els.tableBody.innerHTML = "";
      if (els.relatorioEmpty) els.relatorioEmpty.classList.remove("hidden");
      if (els.pager) els.pager.classList.add("hidden");
      return;
    }

    const offset = (paginaAtual - 1) * POR_PAGINA;
    const pagina = filtrados.slice(offset, offset + POR_PAGINA);

    els.tableBody.innerHTML = pagina
      .map(
        (d, idx) =>
          '<tr class="' +
          (idx % 2 === 1 ? "is-alt" : "") +
          '">' +
          '<td><span class="adm-rel-date">' +
          escHtml(d.data) +
          "</span></td>" +
          "<td>" +
          celulaEcoponto(d.ecoponto) +
          "</td>" +
          "<td>" +
          celulaMaterial(d) +
          "</td>" +
          "<td>" +
          celulaQuantidade(d.quantidade) +
          "</td>" +
          "<td>" +
          celulaTipoColeta(d.tipo_coleta) +
          "</td>" +
          "<td>" +
          celulaResponsavel(d.responsavel) +
          "</td>" +
          "</tr>"
      )
      .join("");
    if (els.relatorioEmpty) els.relatorioEmpty.classList.add("hidden");
  }

  function atualizarCharts(charts) {
    if (!charts || typeof Chart === "undefined") return;

    const ctxMat = document.getElementById("chartRelMaterial");
    if (ctxMat) {
      const mat = charts.materiais || {};
      const payload = {
        labels: mat.labels || [],
        datasets: [
          {
            data: mat.values || [],
            backgroundColor: [
              "#22a06b",
              "#3b82c4",
              "#e8b84a",
              "#9b6bff",
              "#8a6b3e",
              "#8a9ba8",
            ],
            borderRadius: 8,
          },
        ],
      };
      if (chartMat) {
        chartMat.data = payload;
        chartMat.update();
      } else {
        chartMat = new Chart(ctxMat, {
          type: "bar",
          data: payload,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
          },
        });
      }
    }

    const ctxEvo = document.getElementById("chartRelEvolucao");
    if (ctxEvo) {
      const evo = charts.evolucao || {};
      const payload = {
        labels: evo.labels || [],
        datasets: [
          {
            data: evo.values || [],
            borderColor: "#12895d",
            backgroundColor: "rgba(18, 137, 93, 0.12)",
            fill: true,
            tension: 0.35,
          },
        ],
      };
      if (chartEvo) {
        chartEvo.data = payload;
        chartEvo.update();
      } else {
        chartEvo = new Chart(ctxEvo, {
          type: "line",
          data: payload,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
          },
        });
      }
    }

    const ctxTipo = document.getElementById("chartRelTipoColeta");
    if (ctxTipo) {
      const tipo = charts.tipo_coleta || {};
      const cam = tipo.caminhao || 0;
      const pref = tipo.prefeitura || 0;
      const total = cam + pref || 1;
      const payload = {
        labels: [
          "Caminhão (" + Math.round((cam / total) * 100) + "%)",
          "Prefeitura (" + Math.round((pref / total) * 100) + "%)",
        ],
        datasets: [
          {
            data: [cam, pref],
            backgroundColor: ["#0f6b38", "#7ee8b0"],
            borderWidth: 3,
            borderColor: "#ffffff",
          },
        ],
      };
      if (chartTipo) {
        chartTipo.data = payload;
        chartTipo.update();
      } else {
        chartTipo = new Chart(ctxTipo, {
          type: "doughnut",
          data: payload,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "58%",
          },
        });
      }
    }
  }

  function relatorioKpiSvg(pathD) {
    return (
      '<svg class="adm-relatorio-kpi__icon-svg" viewBox="0 0 24 24" fill="currentColor" focusable="false" aria-hidden="true">' +
      '<path d="' +
      pathD +
      '"/></svg>'
    );
  }

  function resolverSlugMaterialKpi(kpis) {
    const slug = String(kpis.material_top_slug || "").trim().toLowerCase();
    if (slug) return slug;
    const label = String(kpis.material_top || "")
      .trim()
      .toLowerCase()
      .split(",")[0]
      .trim();
    return MATERIAL_SLUG_MAP[label] || "";
  }

  function materialTopEmEmpate(kpis) {
    if (!kpis) return false;
    if (kpis.material_top_empate === true) return true;
    const slugs = kpis.material_top_slugs;
    return Array.isArray(slugs) && slugs.length > 1;
  }

  function atualizarKpiTopIcon(kpis) {
    if (!els.kpiTopIcon) return;

    let modo = "empty";
    let path = REL_KPI_MATERIAL_PATHS.destaque;

    if (materialTopEmEmpate(kpis)) {
      modo = "empate";
      path = REL_KPI_MATERIAL_PATHS.reciclagem;
    } else {
      const slug = resolverSlugMaterialKpi(kpis);
      if (slug) {
        modo = slug;
        path = REL_KPI_MATERIAL_PATHS[slug] || REL_KPI_MATERIAL_PATHS.outros;
      }
    }

    els.kpiTopIcon.className =
      "adm-relatorio-kpi__icon adm-relatorio-kpi__icon--material adm-relatorio-kpi__icon--mat-" +
      modo;
    els.kpiTopIcon.innerHTML = relatorioKpiSvg(path);

    if (els.kpiTopCard) {
      els.kpiTopCard.className = "adm-relatorio-kpi adm-relatorio-kpi--top adm-relatorio-kpi--mat-" + modo;
    }
  }

  function aplicarKpis(kpis) {
    if (!kpis) return;
    if (els.kpiTotal) els.kpiTotal.textContent = kpis.total_fmt || "0 kg";
    if (els.kpiTop) els.kpiTop.textContent = kpis.material_top || "—";
    if (els.kpiTaxa) els.kpiTaxa.textContent = (kpis.taxa_reaproveitamento ?? 0) + "%";
    atualizarKpiTopIcon(kpis);
  }

  function labelPeriodo() {
    const sel = els.filterPeriodo;
    if (!sel) return "—";
    const opt = sel.options[sel.selectedIndex];
    return opt ? opt.textContent : sel.value;
  }

  function labelMaterial() {
    const sel = els.filterMaterial;
    if (!sel || !sel.value) return "Todos";
    const opt = sel.options[sel.selectedIndex];
    return opt ? opt.textContent : sel.value;
  }

  function buildExportSections() {
    const data = ultimoRelatorio || {};
    const kpis = data.kpis || {};
    const charts = data.charts || {};
    const detalhes = filtrarDetalhes(data.detalhes || []);

    const sections = [
      {
        heading: "Indicadores",
        headers: ["Indicador", "Valor"],
        rows: [
          ["Total coletado", kpis.total_fmt || "0 kg"],
          ["Material mais reciclado", kpis.material_top || "—"],
          ["Taxa de reaproveitamento", (kpis.taxa_reaproveitamento ?? 0) + "%"],
        ],
      },
    ];

    const mat = charts.materiais || {};
    if (mat.labels && mat.labels.length) {
      sections.push({
        heading: "Materiais (gráfico)",
        headers: ["Material", "Quantidade (kg)"],
        rows: mat.labels.map((lab, i) => [lab, String(mat.values[i] ?? 0)]),
      });
    }

    const evo = charts.evolucao || {};
    if (evo.labels && evo.labels.length) {
      sections.push({
        heading: "Evolução diária",
        headers: ["Data", "Quantidade (kg)"],
        rows: evo.labels.map((lab, i) => [lab, String(evo.values[i] ?? 0)]),
      });
    }

    const tipo = charts.tipo_coleta || {};
    sections.push({
      heading: "Tipo de coleta",
      headers: ["Tipo", "Quantidade"],
      rows: [
        ["Caminhão", String(tipo.caminhao ?? 0)],
        ["Prefeitura", String(tipo.prefeitura ?? 0)],
      ],
    });

    sections.push({
      heading: "Detalhamento",
      headers: ["Data", "Ecoponto", "Material", "Quantidade", "Tipo de coleta", "Responsável"],
      rows: detalhes.map((d) => [
        d.data,
        d.ecoponto,
        d.material,
        d.quantidade,
        d.tipo_coleta,
        d.responsavel,
      ]),
    });

    return sections;
  }

  function exportRelatorio(format) {
    if (!ultimoRelatorio) {
      window.alert("Gere o relatório antes de exportar.");
      return;
    }
    if (!window.EcocoletaExport) {
      window.alert("Módulo de exportação não carregado. Recarregue a página.");
      return;
    }

    const Ex = window.EcocoletaExport;
    const ecoponto =
      adminCtx?.ecoponto ||
      (els.relatorioEcopontoNome && els.relatorioEcopontoNome.textContent) ||
      "EcoPonto";
    const meta = [
      ["Ecoponto", ecoponto],
      ["Período", labelPeriodo()],
      ["Material", labelMaterial()],
    ];
    const sections = buildExportSections();
    const filename = "relatorio_ecoponto_" + Ex.timestamp();

    if (format === "pdf") {
      Ex.printPdf({
        title: "Relatórios e Análises",
        subtitle: ecoponto,
        meta: meta,
        sections: sections,
      });
      return;
    }

    Ex.downloadExcel(filename, [
      {
        heading: "EcoColeta — Relatório do EcoPonto",
        rows: meta,
      },
    ].concat(sections));
  }

  async function carregarRelatorio() {
    const data = await fetchJson(apiRelatorioUrl());
    ultimoRelatorio = data;
    detalhesCache = data.detalhes || [];
    renderTabela(detalhesCache, true);
    atualizarCharts(data.charts || {});
    aplicarKpis(data.kpis || {});
    if (els.authError) {
      els.authError.textContent = "";
      els.authError.classList.remove("visible");
    }
  }

  async function iniciarPainel(admin) {
    adminCtx = admin;
    const ecoponto = admin.ecoponto || "EcoPonto parceiro";
    if (els.relatorioHint) els.relatorioHint.textContent = "Análises · " + ecoponto;
    if (els.relatorioEcopontoNome) els.relatorioEcopontoNome.textContent = ecoponto;
    document.documentElement.classList.remove("admin-auth-checking");
    try {
      await carregarRelatorio();
    } catch (e) {
      if (els.authError) {
        els.authError.textContent = e.message;
        els.authError.classList.add("visible");
      }
    }
  }

  [els.filterPeriodo, els.filterMaterial].forEach((el) => {
    if (el) {
      el.addEventListener("change", () => {
        carregarRelatorio().catch((e) => window.alert(e.message));
      });
    }
  });

  if (els.filterResponsavel) {
    els.filterResponsavel.addEventListener("change", () => {
      renderTabela(detalhesCache, true);
    });
  }

  if (els.pagerPrev) {
    els.pagerPrev.addEventListener("click", () => {
      if (paginaAtual > 1) {
        paginaAtual -= 1;
        renderTabela(detalhesCache, false);
      }
    });
  }

  if (els.pagerNext) {
    els.pagerNext.addEventListener("click", () => {
      const total = filtrarDetalhes(detalhesCache).length;
      const totalPag = Math.max(1, Math.ceil(total / POR_PAGINA));
      if (paginaAtual < totalPag) {
        paginaAtual += 1;
        renderTabela(detalhesCache, false);
      }
    });
  }

  els.actionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-rel-action");
      if (key === "gerar") {
        carregarRelatorio().catch((e) => window.alert(e.message));
      } else if (key === "pdf") {
        exportRelatorio("pdf");
      } else if (key === "excel") {
        exportRelatorio("excel");
      }
    });
  });

  setupSidebar(els);
  setupProfileMenu(els);
  validarSessaoAdmin(els, iniciarPainel);
})();
