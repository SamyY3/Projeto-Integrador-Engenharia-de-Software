document.addEventListener("DOMContentLoaded", function () {
  const btnEditarPerfil = document.getElementById("openPerfilModal");
  const btnEditarEndereco = document.getElementById("editarEnderecoBtn");
  const btnMais = document.querySelector(".btn-mais");
  const celulas = document.querySelectorAll(".celula");
  const notificacoes = document.querySelectorAll(".notificacao");
  const historicos = document.querySelectorAll(".item-historico");
  const pontosPerfil = document.getElementById("user-points");

  const paginaEdicao = "/ecocoleta/edicaoperfil";

  if (btnEditarPerfil) {
    btnEditarPerfil.addEventListener("click", function () {
      window.location.href = paginaEdicao;
    });
  }

  if (btnEditarEndereco) {
    btnEditarEndereco.addEventListener("click", function () {
      window.location.href = paginaEdicao;
    });
  }

  let pontos = localStorage.getItem("userPoints");

  if (!pontos) {
    pontos = 1250;
    localStorage.setItem("userPoints", pontos);
  }

  if (pontosPerfil) {
    pontosPerfil.textContent = Number(pontos).toLocaleString("pt-BR") + " EcoPoints";
  }

  if (btnMais) {
    btnMais.addEventListener("click", function () {
      alert("Modo de agendamento ativado! Clique em um horário vazio do calendário.");
    });
  }

  celulas.forEach(function (celula) {
    celula.addEventListener("click", function () {
      celula.classList.toggle("coleta");

      if (celula.classList.contains("coleta")) {
        celula.textContent = "Coleta";
      } else {
        celula.textContent = "";
      }
    });
  });

  const nomesMeses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const diasSemana = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  const tituloCalendario = document.getElementById("calendarMonthYear");
  const btnAnterior = document.getElementById("calendarPrev");
  const btnProximo = document.getElementById("calendarNext");
  const labelsDias = document.querySelectorAll(".cabecalho-dias span");

  let dataAtual = new Date(2026, 4, 1);

  function renderizarCalendario() {
    if (!tituloCalendario || labelsDias.length === 0) return;

    const ano = dataAtual.getFullYear();
    const mes = dataAtual.getMonth();

    tituloCalendario.textContent =
      "Calendário de coleta - " + nomesMeses[mes] + " " + ano;

    const primeiroDiaMes = new Date(ano, mes, 1);
    const inicioSemana = new Date(primeiroDiaMes);
    const diaSemana = (primeiroDiaMes.getDay() + 6) % 7;

    inicioSemana.setDate(primeiroDiaMes.getDate() - diaSemana);

    labelsDias.forEach(function (span, index) {
      if (index === 0) {
        span.textContent = "Horário";
        span.classList.remove("month-fade");
        return;
      }

      const dia = new Date(inicioSemana);
      dia.setDate(inicioSemana.getDate() + index - 1);

      span.innerHTML = diasSemana[index - 1] + "<br>" + dia.getDate();

      if (dia.getMonth() !== mes) {
        span.classList.add("month-fade");
      } else {
        span.classList.remove("month-fade");
      }
    });
  }

  if (btnAnterior) {
    btnAnterior.addEventListener("click", function () {
      dataAtual.setMonth(dataAtual.getMonth() - 1);
      renderizarCalendario();
    });
  }

  if (btnProximo) {
    btnProximo.addEventListener("click", function () {
      dataAtual.setMonth(dataAtual.getMonth() + 1);
      renderizarCalendario();
    });
  }

  renderizarCalendario();

  notificacoes.forEach(function (item) {
    item.addEventListener("mouseenter", function () {
      item.style.transform = "scale(1.02)";
      item.style.transition = "0.2s";
      item.style.cursor = "pointer";
    });

    item.addEventListener("mouseleave", function () {
      item.style.transform = "scale(1)";
    });
  });

  historicos.forEach(function (item) {
    item.addEventListener("mouseenter", function () {
      item.style.backgroundColor = "#f5f7ff";
      item.style.transition = "0.2s";
    });

    item.addEventListener("mouseleave", function () {
      item.style.backgroundColor = "transparent";
    });
  });
});