document.addEventListener("DOMContentLoaded", () => {

  
  const notificacao = document.querySelector(".icone-circulo a");

  if (notificacao) {
    notificacao.addEventListener("click", (e) => {
      e.preventDefault();
      alert("Você não tem notificações novas 🔔");
    });
  }


  const input = document.querySelector(".busca input");
  const linhas = document.querySelectorAll("tbody tr");

  if (input) {
    input.addEventListener("keyup", () => {
      const valor = input.value.toLowerCase();

      linhas.forEach(linha => {
        const texto = linha.textContent.toLowerCase();

        if (texto.includes(valor)) {
          linha.style.display = "";
        } else {
          linha.style.display = "none";
        }
      });
    });
  }


  const top1 = document.querySelector(".top1");
  const top2 = document.querySelector(".top2");
  const top3 = document.querySelector(".top3");

  if (top1) top1.style.fontWeight = "bold";
  if (top2) top2.style.fontWeight = "bold";
  if (top3) top3.style.fontWeight = "bold";

});