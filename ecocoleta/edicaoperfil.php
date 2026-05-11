<?php

include("conexao.php");

$sql = "SELECT 
            usuario.nome,
            usuario.email,
            usuario.foto_perfil,
            usuario.numero,
            usuario.cidade,
            usuario.complemento,
            rua.nome_rua,
            bairro.nome_bairro
        FROM usuario
        LEFT JOIN rua ON usuario.id_rua = rua.id_rua
        LEFT JOIN bairro ON rua.id_bairro = bairro.id_bairro
        WHERE usuario.id_usuario = 1";

$resultado = mysqli_query($conexao, $sql);

$usuario = mysqli_fetch_assoc($resultado);

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>

  <meta charset="UTF-8">

  <meta name="viewport"
        content="width=device-width, initial-scale=1.0">

  <title>Editar Perfil</title>

  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Space+Grotesk:wght@600;700&display=swap"
        rel="stylesheet">

  <link rel="stylesheet" href="edicaoperfil.css">

  <link rel="stylesheet" href="notif-popup.css">

</head>

<body class="app editar-perfil">

  <div class="modal-overlay">

    <div class="modal">

      <div class="perfil-container">

        <div class="perfil-header">

          <div>

            <span class="page-label">
              Perfil
            </span>

            <h1 class="perfil-titulo">
              Editar perfil
            </h1>

            <p class="perfil-subtitulo">
              Atualize seus dados de acesso e mantenha seu perfil seguro e alinhado com a sua conta.
            </p>

          </div>

          <button type="button"
                  class="close-modal"
                  onclick="fecharModal()">

            ×

          </button>

        </div>

        <div class="perfil-topo">

          <div class="perfil-info">

            <div class="foto-box">

              <img src="<?php echo $usuario['foto_perfil']; ?>"
                   class="foto-perfil">

              <img src="Imagens/image.png"
                   class="icone-camera">

            </div>

            <div class="nome-com-lapis">

              <span class="nome">
                <?php echo $usuario['nome']; ?>
              </span>

              <div class="lapis">

                <img src="Imagens/lapis.png"
                     alt="Editar nome">

              </div>

            </div>

          </div>

        </div>

        <form class="perfil-form"
              action="atualizarperfil.php"
              method="POST"
              enctype="multipart/form-data"
              onsubmit="confirmarPerfil(event)">

          <input type="file"
                 id="fileInput"
                 name="foto"
                 accept="image/*"
                 hidden>

          <div class="campos-form">

            <div class="perfil-campo">

              <label>E-mail</label>

             <input type="email"
                    name="email"
                     placeholder="Digite aqui o seu e-mail...">

            </div>

            <div class="perfil-campo">

              <label>Confirmar e-mail</label>

              <input type="email"
                     name="confirmaremail"
                     placeholder="Confirme seu e-mail...">

            </div>

            <div class="perfil-campo">

              <label>Senha</label>

              <input type="password"
                     name="senha"
                     placeholder="Digite aqui a sua senha...">

            </div>

            <div class="perfil-campo">

              <label>Confirmar senha</label>

              <input type="password"
                     name="confirmarsenha"
                     placeholder="Confirme sua senha...">

            </div>

            <div class="perfil-campo">

              <label>Endereço</label>

             <input type="text"
                     name="endereco"
                      value="<?php echo $usuario['nome_rua']; ?>"
                       placeholder="Rua, avenida, travessa...">
            </div>

            <div class="perfil-campo">

              <label>Bairro</label>

              <input type="text"
                    name="bairro"
                    value="<?php echo $usuario['nome_bairro']; ?>"
                    placeholder="Digite o bairro...">
            </div>

            <div class="perfil-campo">

              <label>Número</label>

             <input type="text"
                   name="numero"
                    value="<?php echo $usuario['numero']; ?>"
                     placeholder="Ex: 32, 32A, 100-B ou S/N"
                     maxlength="10">
            </div>

            <div class="perfil-campo">

              <label>Cidade</label>

             <input type="text"
                    name="cidade"
                    value="<?php echo $usuario['cidade']; ?>"
                    placeholder="Digite a cidade...">

            </div>

            <div class="perfil-campo">

              <label>Complemento</label>

             <input type="text"
                  name="complemento"
                  value="<?php echo $usuario['complemento']; ?>"
                   placeholder="Apartamento, bloco, referência...">

            </div>

          </div>

          <button type="submit"
                  class="perfil-botao">

            Confirmar

          </button>

        </form>

      </div>

    </div>

  </div>

  <script src="edicaoperfil.js"></script>

  <script>

    function fecharModal() {

      window.history.back();

    }

  </script>

</body>

</html>