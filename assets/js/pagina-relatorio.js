document.addEventListener("DOMContentLoaded", function () {
  const DEFAULT_AVATAR = "assets/images/icons pessoa.png";
  const BAIRRO_ICONS = {
    centro:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20V11h3.5v9M9.5 20V7H14v13M16 20V13H19.5V20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 20h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    esperanca:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4.2l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7L12 4.2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    jardim:
      '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8.5" r="4.2" stroke="currentColor" stroke-width="1.8"/><path d="M12 12.5V20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9 20h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    industrial:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M3 20h18M6.5 20V12.5L9 11v9M11.5 20V9l3-1.8V20M16 20V10.5l3.5-2.1V20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 7.5V5.5M20 6.5h-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };

  const els = {
    periodButtons: document.querySelectorAll(".period-btn"),
    barItems: document.querySelectorAll(".bar-item .bar"),
    yAxis: document.querySelector(".y-axis"),
    chartMeta: document.querySelector(".chart-meta"),
    legendValues: document.querySelectorAll(".chart-legend .legend-value"),
    bairrosList: document.getElementById("statBairrosList"),
    materiaisList: document.getElementById("statMateriaisList"),
    trophyCard: document.getElementById("reportTrophyCard"),
    trophyMedal: document.getElementById("reportTrophyMedal"),
    trophyGuestIcon: null,
    trophyUserIcon: null,
    trophyAvatar: document.getElementById("reportTrophyAvatar"),
    trophyPoints: document.getElementById("reportTrophyPoints"),
    trophyStatus: document.getElementById("reportTrophyStatus"),
    highlightLocationText: document.querySelector(".highlight-location-text"),
    profileImg: document.querySelector(".profile-pill img"),
    profileName: document.querySelector(".profile-pill .profile-info strong"),
    profileRole: document.querySelector(".profile-pill .profile-info span"),
    highlightMetrics: document.querySelectorAll(".highlight-metrics span strong"),
    reportMain: document.querySelector("main .container"),
  };

  if (els.trophyMedal) {
    els.trophyGuestIcon = els.trophyMedal.querySelector(".trophy-medal-icon--guest");
    els.trophyUserIcon = els.trophyMedal.querySelector(".trophy-medal-icon--user");
  }

  let relatorioAtual = null;
  let periodoAtual = "mensal";

  function escHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isLoggedInUser() {
    return (
      localStorage.getItem("loggedIn") === "true" ||
      document.body.classList.contains("ecocoleta-authenticated")
    );
  }

  function isValidProfilePhoto(src) {
    const value = String(src || "").trim();
    return (
      value.indexOf("data:image") === 0 ||
      value.indexOf("uploads/") === 0 ||
      value.indexOf("assets/images/") === 0 ||
      value.indexOf("http://") === 0 ||
      value.indexOf("https://") === 0 ||
      value.indexOf("/") === 0
    );
  }

  function formatEcoPoints(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return "0 EcoPoints";
    return n.toLocaleString("pt-BR") + " EcoPoints";
  }

  function formatKg(value) {
    const n = Number(value) || 0;
    if (n <= 0) return "0 kg";
    if (n < 1) return n.toFixed(1).replace(".", ",") + " kg";
    if (Math.abs(n - Math.round(n)) < 0.05) return Math.round(n) + " kg";
    return n.toFixed(1).replace(".", ",") + " kg";
  }

  function apiUrl(periodo) {
    const base = window.ecocoletaPhpUrl
      ? window.ecocoletaPhpUrl("relatorio-usuario.php")
      : "api/relatorio-usuario.php";
    const params = new URLSearchParams({ periodo: periodo || "mensal" });
    return base + (base.indexOf("?") >= 0 ? "&" : "?") + params.toString();
  }

  function parseJson(text) {
    const raw = String(text || "").replace(/^\uFEFF/, "").trim();
    const start = raw.indexOf("{");
    return JSON.parse(start >= 0 ? raw.slice(start) : raw);
  }

  function showActiveUserTrophy(photoSrc) {
    if (!els.trophyCard || !els.trophyGuestIcon || !els.trophyUserIcon || !els.trophyAvatar) return;
    els.trophyCard.classList.add("report-trophy-card--active-user");
    els.trophyGuestIcon.classList.add("hidden");
    els.trophyUserIcon.classList.remove("hidden");
    els.trophyAvatar.src = isValidProfilePhoto(photoSrc) ? photoSrc : DEFAULT_AVATAR;
    els.trophyAvatar.onerror = function () {
      els.trophyAvatar.onerror = null;
      els.trophyAvatar.src = DEFAULT_AVATAR;
    };
  }

  function showGuestTrophy() {
    if (!els.trophyCard || !els.trophyGuestIcon || !els.trophyUserIcon) return;
    els.trophyCard.classList.remove("report-trophy-card--active-user");
    els.trophyGuestIcon.classList.remove("hidden");
    els.trophyUserIcon.classList.add("hidden");
  }

  function renderBairros(bairros) {
    if (!els.bairrosList) return;
    const lista = Array.isArray(bairros) ? bairros : [];
    if (!lista.length) {
      els.bairrosList.innerHTML =
        '<li class="stat-empty"><span class="stat-item-label">Nenhuma coleta no período</span><strong>0 kg</strong></li>';
      return;
    }
    els.bairrosList.innerHTML = lista
      .map(function (item) {
        const iconClass = BAIRRO_ICONS[item.icon_class] ? item.icon_class : "centro";
        const svg = BAIRRO_ICONS[iconClass] || BAIRRO_ICONS.centro;
        return (
          '<li><span class="stat-item-label"><span class="stat-item-icon stat-item-icon--' +
          escHtml(iconClass) +
          '" aria-hidden="true">' +
          svg +
          "</span>" +
          escHtml(item.nome) +
          '</span><strong>' +
          escHtml(item.kg_fmt || formatKg(item.kg)) +
          "</strong></li>"
        );
      })
      .join("");
  }

  function renderMateriais(materiais) {
    if (!els.materiaisList) return;
    const lista = Array.isArray(materiais) ? materiais : [];
    els.materiaisList.innerHTML = lista
      .map(function (item) {
        return (
          '<li><span class="stat-item-label"><img class="stat-item-img" src="' +
          escHtml(item.img || DEFAULT_AVATAR) +
          '" alt="" loading="lazy" decoding="async">' +
          escHtml(item.nome) +
          '</span><strong>' +
          escHtml(item.kg_fmt || formatKg(item.kg)) +
          "</strong></li>"
        );
      })
      .join("");
  }

  function getNiceAxisMax(maxValue) {
    const raw = Math.max(Number(maxValue) || 0, 1);
    const padded = raw * 1.18;
    if (padded <= 5) return Math.ceil(padded);
    if (padded <= 30) return Math.ceil(padded / 5) * 5;
    if (padded <= 150) return Math.ceil(padded / 10) * 10;
    return Math.ceil(padded / 50) * 50;
  }

  function updateYAxis(axisMax) {
    if (!els.yAxis) return;
    const steps = [1, 0.75, 0.5, 0.25, 0];
    els.yAxis.innerHTML = steps
      .map(function (step) {
        const value = Math.round(axisMax * step);
        return "<span>" + value + "</span>";
      })
      .join("");
  }

  function renderGrafico(grafico, resumo) {
    const valores = (grafico && grafico.valores) || [];
    const maxBarValue = Math.max.apply(null, valores.concat([0, 1]));
    const axisMax = getNiceAxisMax(maxBarValue);
    updateYAxis(axisMax);

    els.barItems.forEach(function (bar, index) {
      const value = Number(valores[index]) || 0;
      const height = Math.max(0, Math.round((value / axisMax) * 100));
      bar.style.height = height + "%";
      bar.style.minHeight = value > 0 ? "24px" : "0";
      bar.setAttribute("title", formatKg(value));
      bar.setAttribute("aria-label", formatKg(value));
      bar.innerHTML = '<span class="bar-value">' + formatKg(value) + "</span>";
    });

    const totalKg = Number((resumo && resumo.total_kg) || 0);
    const pts = (resumo && resumo.pontos_periodo_fmt) || "0";
    const totalFmt = (resumo && resumo.total_kg_fmt) || formatKg(totalKg);

    if (els.chartMeta) {
      els.chartMeta.innerHTML =
        "<span>Total reciclado: " +
        escHtml(totalFmt) +
        "</span><span>EcoPontos Recebidos: " +
        escHtml(pts) +
        "</span>";
    }

    if (els.legendValues.length >= 3) {
      const somaBarras = valores.reduce(function (sum, item) {
        return sum + (Number(item) || 0);
      }, 0);
      els.legendValues[0].textContent = formatKg(somaBarras);
      els.legendValues[1].textContent = totalFmt;
      els.legendValues[2].textContent = pts;
    }
  }

  function renderDestaque(destaque, usuario) {
    const d = destaque || {};
    const u = usuario || {};

    if (els.profileName) {
      els.profileName.textContent = d.nome || u.nome || localStorage.getItem("userName") || "Usuário";
    }
    if (els.profileRole) {
      els.profileRole.textContent = d.rotulo || "Seu desempenho no período";
    }

    const foto = u.foto_perfil || localStorage.getItem("userFoto") || "";
    if (els.profileImg) {
      els.profileImg.src = isValidProfilePhoto(foto) ? foto : DEFAULT_AVATAR;
      els.profileImg.alt = "Foto de " + (d.nome || u.nome || "usuário");
      els.profileImg.onerror = function () {
        els.profileImg.onerror = null;
        els.profileImg.src = DEFAULT_AVATAR;
      };
    }

    let local = d.rua || u.rua || localStorage.getItem("userRua") || "";
    const bairro = d.bairro || u.bairro || localStorage.getItem("userBairro") || "";
    if (bairro) {
      local = local ? local + " - " + bairro : bairro;
    }
    if (els.highlightLocationText) {
      els.highlightLocationText.textContent = local ? local.toUpperCase() : "ENDEREÇO NÃO INFORMADO";
    }

    if (els.highlightMetrics.length >= 3) {
      els.highlightMetrics[0].textContent = d.pontos_fmt || "+0";
      els.highlightMetrics[1].textContent = d.kg_fmt || "0 kg";
      els.highlightMetrics[2].textContent = d.posicao_fmt || "—";
    }

    if (d.rua) {
      try {
        localStorage.setItem("userRua", d.rua);
      } catch (e) {}
    }
    if (d.bairro) {
      try {
        localStorage.setItem("userBairro", d.bairro);
      } catch (e) {}
    }
  }

  function renderResumo(resumo, usuario, autenticado) {
    const r = resumo || {};
    const saldo = r.saldo_ecopoints != null ? r.saldo_ecopoints : (usuario && usuario.saldo_ecopoints) || 0;

    if (els.trophyPoints) {
      els.trophyPoints.textContent = formatEcoPoints(saldo);
    }
    if (els.trophyStatus) {
      els.trophyStatus.textContent = r.status_trophy || "Faça login para ver seu desempenho";
    }

    if (autenticado) {
      const foto = (usuario && usuario.foto_perfil) || localStorage.getItem("userFoto") || DEFAULT_AVATAR;
      showActiveUserTrophy(foto);
      if (usuario && usuario.nome) {
        try {
          localStorage.setItem("userName", usuario.nome);
        } catch (e) {}
      }
      if (saldo >= 0) {
        try {
          localStorage.setItem("userPoints", String(saldo));
        } catch (e) {}
      }
    } else {
      showGuestTrophy();
    }
  }

  function renderRelatorio(payload) {
    if (!payload || !payload.relatorio) return;
    relatorioAtual = payload.relatorio;
    const rel = relatorioAtual;
    const autenticado = !!payload.autenticado;

    renderResumo(rel.resumo, rel.usuario, autenticado);
    renderBairros(rel.bairros);
    renderMateriais(rel.materiais);
    renderGrafico(rel.grafico, rel.resumo);
    renderDestaque(rel.destaque, rel.usuario);

    if (els.reportMain) {
      els.reportMain.classList.toggle("relatorio-guest", !autenticado);
      els.reportMain.classList.toggle("relatorio-auth", autenticado);
    }
  }

  async function carregarRelatorio(periodo) {
    periodoAtual = periodo || "mensal";
    try {
      let data;
      const url = apiUrl(periodoAtual);
      if (window.EcoColetaFetch && typeof window.EcoColetaFetch.fetchJson === "function") {
        data = await window.EcoColetaFetch.fetchJson(url, {
          cacheKey: "relatorio_usuario_" + periodoAtual,
          ttlMs: 60000,
        });
      } else {
        const res = await fetch(url, { method: "GET", credentials: "same-origin", cache: "no-store" });
        data = parseJson(await res.text());
      }
      if (data && data.sucesso === true) {
        if (data.autenticado) {
          try {
            localStorage.setItem("loggedIn", "true");
          } catch (e) {}
        }
        renderRelatorio(data);
        return;
      }
    } catch (err) {
      console.warn("[pagina-relatorio] Falha ao carregar relatório:", err);
    }

    if (isLoggedInUser()) {
      showActiveUserTrophy(localStorage.getItem("userFoto") || DEFAULT_AVATAR);
      const pts = Number(localStorage.getItem("userPoints"));
      if (Number.isFinite(pts) && els.trophyPoints) {
        els.trophyPoints.textContent = formatEcoPoints(pts);
      }
    } else {
      showGuestTrophy();
    }
  }

  els.periodButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      els.periodButtons.forEach(function (btn) {
        btn.classList.remove("active");
      });
      button.classList.add("active");
      carregarRelatorio(button.dataset.period || "mensal");
    });
  });

  window.addEventListener("ecocoleta:saldo-atualizar", function (ev) {
    if (!isLoggedInUser()) return;
    const saldo = ev && ev.detail ? Number(ev.detail.saldo_ecopoints) : NaN;
    if (Number.isFinite(saldo) && saldo >= 0 && els.trophyPoints) {
      els.trophyPoints.textContent = formatEcoPoints(saldo);
    }
  });

  window.addEventListener("ecocoleta:profile-loaded", function () {
    carregarRelatorio(periodoAtual);
  });

  const activeBtn = document.querySelector(".period-btn.active");
  carregarRelatorio((activeBtn && activeBtn.dataset.period) || "mensal");
});
