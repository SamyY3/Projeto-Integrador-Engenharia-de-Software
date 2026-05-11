<?php

include("conexao.php");

$email = trim($_POST['email']);
$senha = trim($_POST['senha']);

$endereco = trim($_POST['endereco']);
$bairro = trim($_POST['bairro']);
$numero = trim($_POST['numero']);
$cidade = trim($_POST['cidade']);
$complemento = trim($_POST['complemento']);

$campos = [];

/* ===== EMAIL ===== */
if ($email != "") {
    $campos[] = "email = '$email'";
}

/* ===== SENHA ===== */
if ($senha != "") {
    $senhaHash = password_hash($senha, PASSWORD_DEFAULT);
    $campos[] = "senha_hash = '$senhaHash'";
}

/* ===== FOTO ===== */
if (isset($_FILES['foto']) && $_FILES['foto']['name'] != "") {

    $fotoNome = $_FILES['foto']['name'];
    $tempNome = $_FILES['foto']['tmp_name'];

    $caminho = "uploads/" . time() . "_" . $fotoNome;

    move_uploaded_file($tempNome, $caminho);

    $campos[] = "foto_perfil = '$caminho'";
}

/* ===== VALIDAÇÃO DO NÚMERO ===== */
if ($numero != "") {

    $numeroValido = preg_match('/^[0-9]+[A-Za-z]?$/', $numero) ||
                    preg_match('/^[0-9]+-[A-Za-z0-9]+$/', $numero) ||
                    strtoupper($numero) === "S/N";

    if (!$numeroValido) {

        echo "
        <script>
            alert('Número inválido! Use formatos como 32, 32A, 100-B ou S/N.');
            window.location.href='edicaoperfil.php';
        </script>
        ";
        exit;

    }

    $campos[] = "numero = '$numero'";
}

/* ===== CIDADE ===== */
if ($cidade != "") {
    $campos[] = "cidade = '$cidade'";
}

/* ===== COMPLEMENTO ===== */
if ($complemento != "") {
    $campos[] = "complemento = '$complemento'";
}

/* ===== BAIRRO + RUA ===== */
if ($bairro != "" && $endereco != "") {

    // BUSCA OU CRIA BAIRRO
    $sqlBairro = "SELECT id_bairro FROM bairro WHERE nome_bairro = '$bairro'";
    $resultadoBairro = mysqli_query($conexao, $sqlBairro);

    if (mysqli_num_rows($resultadoBairro) > 0) {
        $dadosBairro = mysqli_fetch_assoc($resultadoBairro);
        $idBairro = $dadosBairro['id_bairro'];
    } else {
        mysqli_query($conexao, "INSERT INTO bairro (nome_bairro) VALUES ('$bairro')");
        $idBairro = mysqli_insert_id($conexao);
    }

    // BUSCA OU CRIA RUA
    $sqlRua = "SELECT id_rua FROM rua WHERE nome_rua = '$endereco' AND id_bairro = $idBairro";
    $resultadoRua = mysqli_query($conexao, $sqlRua);

    if (mysqli_num_rows($resultadoRua) > 0) {
        $dadosRua = mysqli_fetch_assoc($resultadoRua);
        $idRua = $dadosRua['id_rua'];
    } else {
        mysqli_query($conexao, "INSERT INTO rua (nome_rua, id_bairro) VALUES ('$endereco', $idBairro)");
        $idRua = mysqli_insert_id($conexao);
    }

    $campos[] = "id_rua = $idRua";
}

/* ===== SE NADA FOI ALTERADO ===== */
if (empty($campos)) {
    echo "
    <script>
      alert('Nenhuma alteração foi feita.');
      window.location.href='edicaoperfil.php';
    </script>
    ";
    exit;
}

/* ===== UPDATE FINAL ===== */
$sql = "UPDATE usuario SET " . implode(", ", $campos) . " WHERE id_usuario = 1";

$resultado = mysqli_query($conexao, $sql);

if ($resultado) {
    echo "
    <script>
      alert('Perfil atualizado!');
      window.location.href='perfil.php';
    </script>
    ";
} else {
    echo mysqli_error($conexao);
}

?>