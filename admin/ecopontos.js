document.addEventListener("DOMContentLoaded", () => {

  const notificacao = document.querySelector(".icone-circulo a");

  if (notificacao) {
    notificacao.addEventListener("click", (e) => {
      e.preventDefault();
      alert("Você não tem notificações novas 🔔");
    });
  }
  const lista = document.querySelector(".pagina-ecopontos .lista");
  let ecopontosDoMapa = [];

  function escHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cardEcopontoHtml(ponto) {
    const nome = escHtml(ponto.name || "EcoPonto");
    const cidade = escHtml(ponto.city || "Cariri");
    const endereco = escHtml(ponto.address || cidade);
    return (
      '<div class="card-ecoponto card-ecoponto-dinamico is-selected" data-ecoponto-id="' + escHtml(ponto.id) + '">' +
        '<h2>' + nome + '</h2>' +
        '<p class="endereco"><span class="endereco-pin">📍</span> ' + endereco + '</p>' +
        '<div class="horario">' +
          '<h3>Horário de Funcionamento</h3>' +
          '<div class="horario-linha"><span>Seg - Sex:</span><strong>08:00 - 18:00</strong></div>' +
          '<div class="horario-linha"><span>Sáb:</span><strong>08:00 - 14:00</strong></div>' +
        '</div>' +
        '<div class="materiais">' +
          '<h3>Materiais Aceitos</h3>' +
          '<div class="icons">' +
            '<div><img src="assets/images/garrafa.png" alt="Plástico"><span>Plástico</span></div>' +
            '<div><img src="assets/images/papel.png" alt="Papel"><span>Papel</span></div>' +
            '<div><img src="assets/images/vidro.png" alt="Vidro"><span>Vidro</span></div>' +
            '<div><img src="assets/images/lata.png" alt="Metal"><span>Metal</span></div>' +
            '<div><img src="assets/images/madeira.png" alt="Madeira"><span>Madeira</span></div>' +
            '<div><img src="assets/images/eletronicos.png" alt="Eletrônicos"><span>Eletrônicos</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="nao-aceitos">' +
          '<h3>Não aceitos</h3>' +
          '<div class="icons icons-nao-aceitos">' +
            '<div><span class="nao-aceito-icon">☠</span><span>Resíduos<br>Perigosos</span></div>' +
            '<div><span class="nao-aceito-icon">🚫</span><span>Pilhas e<br>Baterias</span></div>' +
            '<div><span class="nao-aceito-icon">🚯</span><span>Lixo<br>Orgânico</span></div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function guardarEcopontosDoMapa(ecopontos) {
    if (!lista) return;
    if (!Array.isArray(ecopontos) || ecopontos.length === 0) {
      ecopontosDoMapa = [];
      lista.innerHTML = "";
      lista.classList.add("lista-empty");
      return;
    }

    ecopontosDoMapa = ecopontos.slice();
    lista.innerHTML = "";
    lista.classList.add("lista-empty");
  }

  function bindEcopontoCardSelection() {
    const selectMapa = document.getElementById("ecoponto-select");
    if (!selectMapa) return;

    document.querySelectorAll(".pagina-ecopontos [data-ecoponto-id]").forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-ecoponto-id");
        if (!id) return;
        selectMapa.value = id;
        selectMapa.dispatchEvent(new Event("change", { bubbles: true }));
        abrirCardEcoponto(id, false);
      });
    });
  }

  function abrirCardEcoponto(id, shouldScroll) {
    if (!id) return;
    let card = Array.from(document.querySelectorAll(".pagina-ecopontos [data-ecoponto-id]"))
      .find((el) => el.getAttribute("data-ecoponto-id") === String(id));

    if (!card && lista) {
      const ponto = ecopontosDoMapa.find((item) => String(item.id) === String(id));
      if (!ponto) return;
      lista.innerHTML = cardEcopontoHtml(ponto);
      lista.classList.remove("lista-empty");
      bindEcopontoCardSelection();
      card = lista.querySelector("[data-ecoponto-id]");
    }

    if (!card) return;

    document.querySelectorAll(".pagina-ecopontos [data-ecoponto-id].is-selected").forEach((el) => {
      el.classList.remove("is-selected");
    });
    card.classList.add("is-selected");

    if (shouldScroll !== false) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  window.addEventListener("ecocoleta:ecopontos-loaded", (ev) => {
    guardarEcopontosDoMapa(ev.detail && ev.detail.ecopontos);
  });

  if (Array.isArray(window.EcoColetaEcopontos)) {
    guardarEcopontosDoMapa(window.EcoColetaEcopontos);
  }

  window.addEventListener("ecocoleta:ecoponto-selected", (ev) => {
    const id = ev.detail && ev.detail.id;
    abrirCardEcoponto(id, true);
  });

  const input = document.querySelector(".filtro input");
  const cards = () => document.querySelectorAll(".ecoponto-card");

  if (input) {
    input.addEventListener("keyup", () => {
      const valor = input.value.toLowerCase();

      cards().forEach(card => {
        const texto = card.textContent.toLowerCase();

        if (texto.includes(valor)) {
          card.style.display = "flex";
        } else {
          card.style.display = "none";
        }
      });
    });
  }
  const select = document.querySelector(".filtro select");

  if (select) {
    select.addEventListener("change", () => {
      const valor = select.value.toLowerCase();

      cards().forEach(card => {
        const texto = card.textContent.toLowerCase();

        if (valor === "filtrar por: bairro" || texto.includes(valor)) {
          card.style.display = "flex";
        } else {
          card.style.display = "none";
        }
      });
    });
  }
});