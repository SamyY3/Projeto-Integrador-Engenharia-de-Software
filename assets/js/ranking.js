document.addEventListener("DOMContentLoaded", () => {
  const visitorPanel = document.getElementById("rankingVisitorPanel");
  const visitorLogin = document.getElementById("rankingVisitorLogin");
  const visitorCadastro = document.getElementById("rankingVisitorCadastro");
  let loggedIn =
    localStorage.getItem("loggedIn") === "true" ||
    document.body.classList.contains("ecocoleta-authenticated");
  let userId = parseInt(localStorage.getItem("userId") || "0", 10);

  const els = {
    prizeCard: document.querySelector(".ranking-prize-card"),
    podio: document.querySelector(".podio-ranking"),
    tbody: document.querySelector(".container-ranking tbody"),
    totalCard: document.querySelector('[data-public-card="total-reciclado"]'),
    posicaoCard: document.querySelector('[data-guest-card="posicao"]'),
    progressoCard: document.querySelector('[data-guest-card="progresso"]'),
    buscaInput: document.querySelector(".busca input"),
    tableHeading: document.querySelector(".table-heading p"),
    premioHint: document.getElementById("rankingPremioHint"),
    bonusBanner: document.getElementById("rankingBonusBanner"),
  };

  function redirectUrl(file) {
    const current =
      "pages/Ranking.html" + window.location.search + window.location.hash;
    const authPage = file === "login.html" ? "auth/login.html" : file === "cadastro.html" ? "auth/cadastro.html" : file;
    return authPage + "?redirect=" + encodeURIComponent(current);
  }

  function apiUrl() {
    const base = window.ecocoletaPhpUrl
      ? window.ecocoletaPhpUrl("ranking-ruas.php")
      : "api/ranking-ruas.php";
    const params = new URLSearchParams({ periodo: "semana" });
    if (loggedIn && userId > 0) {
      params.set("id_usuario", String(userId));
    }
    return base + (base.indexOf("?") >= 0 ? "&" : "?") + params.toString();
  }

  function parseJson(text) {
    const raw = String(text || "").replace(/^\uFEFF/, "").trim();
    const start = raw.indexOf("{");
    return JSON.parse(start >= 0 ? raw.slice(start) : raw);
  }

  function escHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function medalHtml(pos) {
    if (pos === 1) return '<span class="rank-medal rank-medal--gold">1</span>';
    if (pos === 2) return '<span class="rank-medal rank-medal--silver">2</span>';
    if (pos === 3) return '<span class="rank-medal rank-medal--bronze">3</span>';
    return String(pos).padStart(2, "0");
  }

  function rowClass(pos) {
    if (pos === 1) return "top1";
    if (pos === 2) return "top2";
    if (pos === 3) return "top3";
    return "";
  }

  function renderLider(lider, premio) {
    if (!els.prizeCard || !lider) return;
    const strong = els.prizeCard.querySelector("strong");
    const small = els.prizeCard.querySelector("small");
    const p = els.prizeCard.querySelector("p");
    const ptsBonus = (premio && premio.pontos) || 100;
    if (strong) strong.textContent = lider.nome_rua || "—";
    if (small) small.textContent = "Líder da semana · +" + ptsBonus + " pts/morador";
    if (p) p.textContent = (lider.pontos_fmt || "0") + " pts";
  }

  function renderPremio(premio, vencedorAnterior, bonificacao, minhaRua) {
    if (els.premioHint && premio) {
      const pts = premio.pontos || 100;
      els.premioHint.innerHTML =
        "A rua campeã da semana concede <strong>" +
        pts +
        " EcoPoints</strong> a cada morador cadastrado na rua (dados das coletas do EcoPonto).";
    }

    if (!els.bonusBanner) return;
    els.bonusBanner.classList.add("hidden");
    els.bonusBanner.classList.remove("is-winner");
    els.bonusBanner.textContent = "";

    if (bonificacao && bonificacao.recente && loggedIn) {
      els.bonusBanner.classList.remove("hidden");
      els.bonusBanner.classList.add("is-winner");
      els.bonusBanner.innerHTML =
        "🏆 <strong>Parabéns!</strong> Sua rua <strong>" +
        escHtml(bonificacao.nome_rua || minhaRua?.nome_rua || "") +
        "</strong> venceu a semana passada e você recebeu <strong>+" +
        escHtml(String(bonificacao.pontos || 100)) +
        " EcoPoints</strong> para trocar por cupons.";
      return;
    }

    if (vencedorAnterior && vencedorAnterior.nome_rua) {
      els.bonusBanner.classList.remove("hidden");
      const pts = (premio && premio.pontos) || 100;
      els.bonusBanner.innerHTML =
        "Semana anterior: <strong>" +
        escHtml(vencedorAnterior.nome_rua) +
        "</strong> liderou com " +
        escHtml(vencedorAnterior.pontos_fmt || "0") +
        " pts. Moradores da rua campeã ganharam <strong>+" +
        pts +
        " EcoPoints</strong>.";
    }
  }

  function renderPodio(podio) {
    if (!els.podio || !Array.isArray(podio)) return;

    const slots = [
      { sel: ".podio-2", idx: 1 },
      { sel: ".podio-1", idx: 0 },
      { sel: ".podio-3", idx: 2 },
    ];

    slots.forEach(({ sel, idx }) => {
      const card = els.podio.querySelector(sel);
      const item = podio[idx];
      if (!card || !item) return;
      const h3 = card.querySelector("h3");
      const strong = card.querySelector("strong");
      const small = card.querySelector("small");
      if (h3) h3.textContent = item.nome_rua || "—";
      if (strong) strong.textContent = (item.pontos_fmt || "0") + " pts";
      if (small) small.textContent = item.kg_fmt || "";
    });
  }

  function renderTabela(lista) {
    if (!els.tbody) return;
    if (!lista || !lista.length) {
      els.tbody.innerHTML =
        '<tr><td colspan="4">Nenhuma rua com coletas no período.</td></tr>';
      return;
    }

    els.tbody.innerHTML = lista
      .map((item) => {
        const pos = item.posicao || 0;
        const cls = rowClass(pos);
        return (
          "<tr" +
          (cls ? ' class="' + cls + '"' : "") +
          " data-busca=\"" +
          escHtml(item.busca || "") +
          "\">" +
          "<td>" +
          medalHtml(pos) +
          "</td>" +
          "<td>" +
          escHtml(item.nome_rua) +
          "</td>" +
          "<td>" +
          escHtml(item.pontos_fmt) +
          "</td>" +
          "<td>" +
          escHtml(item.kg_tabela) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    [".top1", ".top2", ".top3"].forEach((sel) => {
      const row = els.tbody.querySelector(sel);
      if (row) row.style.fontWeight = "bold";
    });
  }

  function renderResumo(resumo) {
    if (els.tableHeading && resumo) {
      const n = resumo.total_ruas || 0;
      els.tableHeading.textContent =
        "Atualizado semanalmente · " + n + " rua" + (n === 1 ? "" : "s");
    }
  }

  function renderCards(cards, resumo) {
    const total = (cards && cards.total_reciclado) || {};
    const posicao = (cards && cards.posicao_semanal) || {};
    const progresso = (cards && cards.progresso_mensal) || null;
    const isAuth = (cards && cards.usuario_logado) || loggedIn;

    if (els.totalCard) {
      const num = els.totalCard.querySelector(".numero");
      const legenda = els.totalCard.querySelector(".card-caption, .linha p:last-child, .linha > div > p:last-child");
      const valor =
        isAuth && total.kg_pessoal_fmt
          ? total.kg_pessoal_fmt
          : total.kg_fmt || (resumo && resumo.total_kg_fmt) || "0Kg";
      if (num) num.textContent = valor;
      if (legenda) {
        legenda.textContent =
          isAuth && total.rotulo_logado
            ? total.rotulo_logado
            : total.rotulo || "Materiais reciclados na semana";
      }
    }

    if (els.posicaoCard && isAuth) {
      if (posicao.sem_rua) {
        els.posicaoCard.innerHTML =
          '<span class="card-award-icon">🎖️</span>' +
          "<h3>Ranking Semanal</h3>" +
          '<p class="numero">—</p>' +
          "<p>" +
          escHtml(posicao.mensagem || "Cadastre sua rua no perfil.") +
          "</p>";
        return;
      }

      const posFmt = posicao.posicao_fmt || (posicao.posicao ? posicao.posicao + "º Lugar" : "—");
      const detalhe =
        posicao.fora_top && (posicao.kg_rua_fmt || posicao.pontos_fmt)
          ? escHtml(posicao.kg_rua_fmt || "") +
            (posicao.pontos_fmt ? " · " + escHtml(posicao.pontos_fmt) + " pts" : "")
          : "Sua rua: <strong>" + escHtml(posicao.nome_rua || "—") + "</strong>";

      els.posicaoCard.innerHTML =
        '<span class="card-award-icon">🎖️</span>' +
        "<h3>Ranking Semanal</h3>" +
        '<p class="numero">' +
        escHtml(posFmt) +
        "</p>" +
        "<p>" +
        detalhe +
        "</p>";
    }

    if (els.progressoCard && isAuth && progresso) {
      const pct = Math.min(100, Math.max(0, Number(progresso.percentual) || 0));
      els.progressoCard.innerHTML =
        '<span class="card-award-icon">🎯</span>' +
        "<h3>Seu progresso</h3>" +
        '<div class="progress-circle" style="--progress-pct:' +
        pct +
        '%"><span>' +
        pct +
        "%</span></div>" +
        '<p class="meta"><span class="titulo-meta">Meta Mensal</span><br>' +
        escHtml(progresso.rotulo || "") +
        "</p>";
      const circle = els.progressoCard.querySelector(".progress-circle");
      if (circle) {
        circle.style.setProperty("--progress-pct", pct + "%");
      }
    } else if (els.progressoCard && isAuth && !progresso) {
      els.progressoCard.innerHTML =
        '<span class="card-award-icon">🎯</span>' +
        "<h3>Seu progresso</h3>" +
        '<div class="progress-circle" style="--progress-pct:0%"><span>0%</span></div>' +
        '<p class="meta"><span class="titulo-meta">Meta Mensal</span><br>0 de 1200kg</p>';
    }
  }

  function renderMinhaRua(minhaRua, cards) {
    if (cards) {
      renderCards(cards);
      return;
    }
    if (!loggedIn || !els.posicaoCard || !minhaRua) return;
    renderCards({
      usuario_logado: true,
      posicao_semanal: {
        sem_rua: false,
        posicao: minhaRua.posicao,
        posicao_fmt: (minhaRua.posicao || 0) + "º Lugar",
        nome_rua: minhaRua.nome_rua,
      },
    });
  }

  function renderProgresso(progresso, cards) {
    if (cards) return;
    if (!loggedIn || !els.progressoCard || !progresso) return;
    renderCards({ usuario_logado: true, progresso_mensal: progresso });
  }

  function setupBusca() {
    if (!els.buscaInput || !els.tbody) return;
    els.buscaInput.addEventListener("keyup", () => {
      const valor = els.buscaInput.value.toLowerCase().trim();
      els.tbody.querySelectorAll("tr").forEach((linha) => {
        const texto = (linha.getAttribute("data-busca") || linha.textContent || "").toLowerCase();
        linha.style.display = !valor || texto.includes(valor) ? "" : "none";
      });
    });
  }

  function setupGuestUi() {
    if (visitorPanel && !loggedIn) {
      document.body.classList.add("ranking-guest");
      visitorPanel.style.display = "";
      visitorPanel.classList.remove("hidden");
      if (visitorLogin) visitorLogin.href = redirectUrl("login.html");
      if (visitorCadastro) visitorCadastro.href = redirectUrl("cadastro.html");

      if (els.posicaoCard) {
        els.posicaoCard.innerHTML =
          '<span class="card-award-icon">🎖️</span>' +
          "<h3>Ranking pessoal</h3>" +
          '<p class="guest-card-text">Entre para ver a posição da sua rua no ranking semanal.</p>' +
          '<div class="guest-card-actions">' +
          '<a href="' +
          redirectUrl("login.html") +
          '">Entrar</a>' +
          '<a href="' +
          redirectUrl("cadastro.html") +
          '">Cadastrar</a>' +
          "</div>";
      }
      if (els.progressoCard) {
        els.progressoCard.innerHTML =
          '<span class="card-award-icon">🎯</span>' +
          "<h3>Seu progresso</h3>" +
          '<p class="guest-card-text">Crie uma conta para acompanhar a meta mensal da sua rua.</p>' +
          '<div class="guest-card-actions">' +
          '<button type="button" data-requires-auth>Começar agora</button>' +
          "</div>";
        const btn = els.progressoCard.querySelector("[data-requires-auth]");
        if (btn) {
          btn.addEventListener("click", () => {
            window.location.href = redirectUrl("cadastro.html");
          });
        }
      }
    } else {
      document.body.classList.remove("ranking-guest");
      if (visitorPanel) {
        visitorPanel.classList.add("hidden");
        visitorPanel.style.display = "none";
      }
    }
  }

  function carregarRanking() {
    return fetch(apiUrl(), { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.text())
      .then((text) => {
        const data = parseJson(text);
        if (!data || data.sucesso !== true || !data.ranking) {
          throw new Error((data && data.erro) || "Não foi possível carregar o ranking.");
        }
        if (data.autenticado) {
          loggedIn = true;
        }
        if (data.id_usuario && !userId) {
          userId = parseInt(String(data.id_usuario), 10) || 0;
        }
        return data.ranking;
      });
  }

  setupGuestUi();
  setupBusca();

  carregarRanking()
    .then((ranking) => {
      if (loggedIn) {
        document.body.classList.remove("ranking-guest");
        if (visitorPanel) {
          visitorPanel.classList.add("hidden");
          visitorPanel.style.display = "none";
        }
      }

      renderLider(ranking.lider, ranking.premio_semanal);
      renderPremio(
        ranking.premio_semanal,
        ranking.vencedor_semana_anterior,
        ranking.bonificacao_recebida,
        ranking.minha_rua
      );
      renderPodio(ranking.podio);
      renderTabela(ranking.lista);
      renderResumo(ranking.resumo);
      renderCards(ranking.cards, ranking.resumo);
      renderMinhaRua(ranking.minha_rua, ranking.cards);
      renderProgresso(ranking.progresso_mensal, ranking.cards);

      if (ranking.desde && ranking.ate && els.tableHeading) {
        const fmt = (iso) => {
          const p = String(iso || "").split("-");
          return p.length === 3 ? p[2] + "/" + p[1] : iso;
        };
        const n = (ranking.resumo && ranking.resumo.total_ruas) || 0;
        els.tableHeading.textContent =
          "Semana " +
          fmt(ranking.desde) +
          " a " +
          fmt(ranking.ate) +
          " · " +
          n +
          " rua" +
          (n === 1 ? "" : "s");
      }
    })
    .catch((err) => {
      console.error(err);
      if (els.tbody) {
        els.tbody.innerHTML =
          '<tr><td colspan="4">Erro ao carregar dados. Verifique se o MySQL está ativo.</td></tr>';
      }
    });
});
