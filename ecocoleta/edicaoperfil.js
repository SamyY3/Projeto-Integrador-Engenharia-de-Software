function confirmarPerfil(event) {

  const emails = document.querySelectorAll('input[type="email"]');

  const senhas = document.querySelectorAll('input[type="password"]');

  if (emails[0].value !== emails[1].value) {

    event.preventDefault();

    alert("Os e-mails não coincidem.");

    return;

  }

  if (senhas[0].value !== senhas[1].value) {

    event.preventDefault();

    alert("As senhas não coincidem.");

    return;

  }

}



/* ===== EDITAR NOME ===== */

const nome = document.querySelector(".nome");

const lapis = document.querySelector(".lapis");

lapis.addEventListener("click", () => {

  const novoNome = prompt("Digite o novo nome:");

  if (novoNome && novoNome.trim() !== "") {

    fetch("atualizar_nome.php", {

      method: "POST",

      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },

      body: "nome=" + encodeURIComponent(novoNome)

    })

    .then(response => response.text())

    .then(data => {

      if (data === "sucesso") {

        nome.textContent = novoNome;

        alert("Nome atualizado!");

      } else {

        alert("Erro ao atualizar nome.");

      }

    });

  }

});



/* ===== TROCAR FOTO ===== */

const camera = document.querySelector(".icone-camera");

const foto = document.querySelector(".foto-perfil");

const fileInput = document.getElementById("fileInput");

camera.addEventListener("click", () => {

  fileInput.click();

});



fileInput.addEventListener("change", (event) => {

  const file = event.target.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = function(e) {

    foto.src = e.target.result;

  };

  reader.readAsDataURL(file);

});