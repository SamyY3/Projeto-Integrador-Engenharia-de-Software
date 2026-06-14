<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: text/plain; charset=utf-8");

include dirname(__DIR__) . "/includes/conexao.php";

if (empty($_SESSION["usuario_id"]) || (int) $_SESSION["usuario_id"] <= 0) {
    echo "erro";
    exit;
}

$nome = isset($_POST["nome"]) ? trim((string) $_POST["nome"]) : "";
if ($nome === "" || strlen($nome) > 200) {
    echo "erro";
    exit;
}

$uid = (int) $_SESSION["usuario_id"];
$sql = "UPDATE usuario SET nome = ? WHERE id_usuario = ? LIMIT 1";
$stmt = mysqli_prepare($conexao, $sql);

if (!$stmt) {
    echo "erro";
    exit;
}

mysqli_stmt_bind_param($stmt, "si", $nome, $uid);
$resultado = mysqli_stmt_execute($stmt);
mysqli_stmt_close($stmt);

if ($resultado) {
    $_SESSION["usuario_nome"] = $nome;
    echo "sucesso";
} else {
    echo "erro";
}
