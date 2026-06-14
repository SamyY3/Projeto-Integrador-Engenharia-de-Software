(function () {
  const API_URL = "api/adm-dashboard.php";
  const { escHtml, fetchJson, badgeStatusColeta, iconeTipoColeta, setupProfileMenu, setupSidebar, validarSessaoAdmin } =
    window.EcoAdm;

  const els = {
    ecopontoName: document.getElementById("ecopontoDetailName"),
    ecopontoPhoto: document.getElementById("ecopontoPhoto"),
    ecopontoPhotoPlaceholder: document.getElementById("ecopontoPhotoPlaceholder"),
    ecopontoDetailAddress: document.getElementById("ecopontoDetailAddress"),
    ecopontoCapacityText: document.getElementById("ecopontoCapacityText"),
    ecopontoCapacityBar: document.getElementById("ecopontoCapacityBar"),
    kpiColetasHoje: document.getElementById("kpiColetasHoje"),
    kpiCapacidade: document.getElementById("kpiCapacidade"),
    kpiMateriaisKg: document.getElementById("kpiMateriaisKg"),
    coletasAgendadasBody: document.getElementById("coletasAgendadasBody"),
    homeColetasSub: document.getElementById("homeColetasSub"),
    homeColetasEmpty: document.getElementById("homeColetasEmpty"),
    homeColetasPager: document.getElementById("homeColetasPager"),
    homeColetasPagerPrev: document.getElementById("homeColetasPagerPrev"),
    homeColetasPagerNext: document.getElementById("homeColetasPagerNext"),
    homeColetasPagerInfo: document.getElementById("homeColetasPagerInfo"),
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
    dashboardSubtitle: document.getElementById("dashboardPageSubtitle"),
    actionButtons: document.querySelectorAll("[data-action]"),
  };

  let chartMateriais = null;
  let coletasHomeCache = [];
  let paginaHomeColetas = 1;
  const POR_PAGINA_HOME = 5;

  function iniciaisNome(nome) {
    return String(nome || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("");
  }

  function celulaUsuarioHome(nome) {
    const n = String(nome || "—").trim() || "—";
    const ini = iniciaisNome(n) || "?";
    return (
      '<span class="adm-home-user">' +
      '<span class="adm-home-user__avatar" aria-hidden="true">' +
      escHtml(ini) +
      "</span>" +
      '<span class="adm-home-user__name">' +
      escHtml(n) +
      "</span></span>"
    );
  }

  function celulaHorarioHome(horario, dataColeta) {
    const slot = escHtml(horario || "—");
    const data = dataColeta ? '<span class="adm-home-slot__date">' + escHtml(dataColeta) + "</span>" : "";
    return '<span class="adm-home-slot">' + data + '<span class="adm-home-slot__time">' + slot + "</span></span>";
  }

  function celulaResponsavelHome(nome) {
    const n = String(nome || "—").trim() || "—";
    const ini = iniciaisNome(n) || "?";
    return (
      '<span class="adm-home-resp">' +
      '<span class="adm-home-resp__avatar" aria-hidden="true">' +
      escHtml(ini) +
      "</span>" +
      '<span class="adm-home-resp__name">' +
      escHtml(n) +
      "</span></span>"
    );
  }

  function atualizarPagerHomeColetas(total) {
    const totalPag = Math.max(1, Math.ceil(total / POR_PAGINA_HOME));
    if (paginaHomeColetas > totalPag) paginaHomeColetas = totalPag;
    if (els.homeColetasPagerInfo) {
      els.homeColetasPagerInfo.textContent =
        total > 0
          ? "Página " + paginaHomeColetas + " de " + totalPag + " · " + total + " coletas"
          : "Nenhuma coleta";
    }
    if (els.homeColetasPagerPrev) els.homeColetasPagerPrev.disabled = paginaHomeColetas <= 1;
    if (els.homeColetasPagerNext) {
      els.homeColetasPagerNext.disabled = paginaHomeColetas >= totalPag || total === 0;
    }
    if (els.homeColetasPager) {
      els.homeColetasPager.classList.toggle("hidden", total <= POR_PAGINA_HOME);
    }
    if (els.homeColetasSub) {
      els.homeColetasSub.textContent =
        total > 0
          ? total + (total === 1 ? " coleta agendada" : " coletas agendadas")
          : "Nenhuma coleta nos próximos dias";
    }
  }

  function renderColetasAgendadasPagina() {
    if (!els.coletasAgendadasBody) return;
    const total = coletasHomeCache.length;
    atualizarPagerHomeColetas(total);

    if (!total) {
      els.coletasAgendadasBody.innerHTML = "";
      if (els.homeColetasEmpty) els.homeColetasEmpty.classList.remove("hidden");
      if (els.homeColetasPager) els.homeColetasPager.classList.add("hidden");
      return;
    }

    const offset = (paginaHomeColetas - 1) * POR_PAGINA_HOME;
    const pagina = coletasHomeCache.slice(offset, offset + POR_PAGINA_HOME);

    els.coletasAgendadasBody.innerHTML = pagina
      .map((c, idx) => {
        const dataFmt = c.data_coleta
          ? String(c.data_coleta).split("-").reverse().join("/").slice(0, 10)
          : "";
        return (
          '<tr class="' +
          (idx % 2 === 1 ? "is-alt" : "") +
          '">' +
          '<td class="adm-home-coletas-td adm-home-coletas-td--user">' +
          celulaUsuarioHome(c.usuario) +
          "</td>" +
          '<td class="adm-home-coletas-td adm-home-coletas-td--slot">' +
          celulaHorarioHome(c.faixa_horario || c.data_hora, dataFmt) +
          "</td>" +
          '<td class="adm-home-coletas-td adm-home-coletas-td--tipo">' +
          '<span class="adm-home-coletas-cell adm-home-coletas-cell--center">' +
          iconeTipoColeta(c.tipo, true) +
          "</span></td>" +
          '<td class="adm-home-coletas-td adm-home-coletas-td--status">' +
          '<span class="adm-home-coletas-cell adm-home-coletas-cell--center">' +
          badgeStatusColeta(c.status) +
          "</span></td>" +
          '<td class="adm-home-coletas-td adm-home-coletas-td--resp">' +
          celulaResponsavelHome(c.responsavel) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    if (els.homeColetasEmpty) els.homeColetasEmpty.classList.add("hidden");
  }

  function renderColetasAgendadas(lista) {
    coletasHomeCache = lista || [];
    paginaHomeColetas = 1;
    renderColetasAgendadasPagina();
  }

  function configurarFotoEcoponto() {
    if (!els.ecopontoPhoto) return;
    const mostrarPlaceholder = () => {
      els.ecopontoPhoto.classList.add("is-hidden");
      if (els.ecopontoPhotoPlaceholder) {
        els.ecopontoPhotoPlaceholder.classList.add("is-visible");
      }
    };
    els.ecopontoPhoto.addEventListener("error", mostrarPlaceholder);
  }

  function infoMapaEcoponto(admin) {
    const lat = admin.latitude != null ? Number(admin.latitude) : NaN;
    const lng = admin.longitude != null ? Number(admin.longitude) : NaN;
    return {
      name: admin.ecoponto || "EcoPonto Verde",
      address: admin.endereco || "Centro, Juazeiro do Norte",
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
    };
  }

  function atualizarMapaAdmin(admin) {
    const widget = window.EcoColetaAdmMap;
    if (!widget || typeof widget.setEcoponto !== "function") return;
    widget.setEcoponto(infoMapaEcoponto(admin)).then(() => {
      if (typeof widget.invalidateSize === "function") {
        window.setTimeout(() => widget.invalidateSize(), 120);
      }
    });
  }

  function aplicarCapacidade(percent) {
    const p = Math.min(100, Math.max(0, Number(percent) || 0));
    if (els.kpiCapacidade) els.kpiCapacidade.textContent = p + "%";
    if (els.ecopontoCapacityText) els.ecopontoCapacityText.textContent = p + "%";
    if (els.ecopontoCapacityBar) els.ecopontoCapacityBar.style.width = p + "%";
    document.querySelectorAll(".adm-kpi-progress-fill--green").forEach((el) => {
      el.style.width = p + "%";
    });
  }

  function atualizarChartMateriais(chart) {
    const canvas = document.getElementById("chartMateriaisRecebidos");
    if (!canvas || typeof Chart === "undefined" || !chart) return;

    const payload = {
      labels: chart.labels || [],
      datasets: [
        {
          data: chart.values || [],
          backgroundColor: ["#0f6b38", "#12895d", "#5eb8d4", "#8a9ba8", "#7a8f3e"],
          borderRadius: 8,
          borderSkipped: false,
          maxBarThickness: 52,
        },
      ],
    };

    if (chartMateriais) {
      chartMateriais.data = payload;
      chartMateriais.update();
      return;
    }

    chartMateriais = new Chart(canvas, {
      type: "bar",
      data: payload,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true },
          x: { grid: { display: false } },
        },
      },
    });
  }

  function aplicarDashboard(dash, admin) {
    const eco = dash.ecoponto || {};
    const kpis = dash.kpis || {};

    if (els.ecopontoName) els.ecopontoName.textContent = eco.nome || admin.ecoponto || "";
    if (els.ecopontoDetailAddress) {
      els.ecopontoDetailAddress.textContent = eco.endereco || admin.endereco || "";
    }
    if (els.kpiColetasHoje) {
      els.kpiColetasHoje.textContent = String(kpis.coletas_hoje ?? 0);
    }
    if (els.kpiMateriaisKg) {
      const kg = kpis.materiais_kg_mes ?? 0;
      els.kpiMateriaisKg.textContent = kg + " Kg";
    }
    aplicarCapacidade(kpis.capacidade_percent ?? eco.capacidade_percent ?? 0);
    renderColetasAgendadas(dash.coletas_agendadas || []);
    atualizarChartMateriais(dash.chart_materiais || {});
    const materiaisEl = document.querySelector("[data-adm-ecoponto-materiais]");
    if (materiaisEl && window.EcoAdmMateriais) {
      const lista = dash.materiais_aceitos || (eco.materiais_aceitos || []);
      window.EcoAdmMateriais.montarPainel(materiaisEl, lista);
      materiaisEl.dataset.materiaisLoaded = "1";
    }
    atualizarMapaAdmin({
      ecoponto: eco.nome || admin.ecoponto,
      endereco: eco.endereco || admin.endereco,
      latitude: eco.latitude != null ? eco.latitude : admin.latitude,
      longitude: eco.longitude != null ? eco.longitude : admin.longitude,
    });
  }

  async function iniciarPainel(admin) {
    const nomePonto = admin.ecoponto || "EcoPonto Verde";
    if (els.ecopontoName) {
      els.ecopontoName.textContent = nomePonto;
    }
    if (els.dashboardSubtitle) {
      els.dashboardSubtitle.textContent =
        "Operação de " + nomePonto + " — coletas, capacidade e materiais em tempo real.";
    }
    if (els.ecopontoDetailAddress && admin.endereco) {
      els.ecopontoDetailAddress.textContent = admin.endereco;
    }

    document.documentElement.classList.remove("admin-auth-checking");

    const Mapa = window.EcoColetaMapa;
    if (Mapa && typeof Mapa.createEcopontoAdminMap === "function" && !window.EcoColetaAdmMap) {
      const widget = Mapa.createEcopontoAdminMap({
        mapElId: "adm-map",
        searchInputId: "adm-map-search-input",
        searchBtnId: "adm-map-search-btn",
        statusId: "adm-map-search-status",
        navMountId: "adm-map-nav-mount",
        autoRouteOnSearch: true,
        getEcopontoInfo() {
          return infoMapaEcoponto(admin);
        },
      });
      widget.init();
      window.EcoColetaAdmMap = widget;
    }

    try {
      const data = await fetchJson(API_URL);
      if (data.admin) {
        if (els.ecopontoName) els.ecopontoName.textContent = data.admin.ecoponto || admin.ecoponto;
        if (els.ecopontoDetailAddress && data.admin.endereco) {
          els.ecopontoDetailAddress.textContent = data.admin.endereco;
        }
      }
      aplicarDashboard(data.dashboard || {}, data.admin || admin);
    } catch (e) {
      if (els.authError) {
        els.authError.textContent = e.message;
        els.authError.classList.add("visible");
      }
    }
  }

  els.actionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      window.alert("Use a tela de Coletas para atualizar status e responsaveis.");
    });
  });

  if (els.homeColetasPagerPrev) {
    els.homeColetasPagerPrev.addEventListener("click", () => {
      if (paginaHomeColetas > 1) {
        paginaHomeColetas -= 1;
        renderColetasAgendadasPagina();
      }
    });
  }

  if (els.homeColetasPagerNext) {
    els.homeColetasPagerNext.addEventListener("click", () => {
      const totalPag = Math.max(1, Math.ceil(coletasHomeCache.length / POR_PAGINA_HOME));
      if (paginaHomeColetas < totalPag) {
        paginaHomeColetas += 1;
        renderColetasAgendadasPagina();
      }
    });
  }

  setupSidebar(els);
  setupProfileMenu(els);
  configurarFotoEcoponto();
  validarSessaoAdmin(els, iniciarPainel);
})();
