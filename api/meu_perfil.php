<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");

require_once dirname(__DIR__) . "/includes/conexao.php";

if (empty($_SESSION["usuario_id"]) || (int) $_SESSION["usuario_id"] <= 0) {
    echo json_encode([
        "sucesso" => false,
        "erro" => "Sessao expirada. Faca login novamente.",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$uid = (int) $_SESSION["usuario_id"];

$hasFotoPerfil = false;
$qc = @$conn->query("SHOW COLUMNS FROM usuario LIKE 'foto_perfil'");
if ($qc) {
    $hasFotoPerfil = $qc->num_rows > 0;
    $qc->free();
}

function ecocoleta_usuario_tem_coluna_perfil(mysqli $conn, string $coluna): bool {
    static $cols = null;
    if ($cols === null) {
        $cols = [];
        $q = @$conn->query("SHOW COLUMNS FROM usuario");
        if ($q) {
            while ($r = $q->fetch_assoc()) {
                $cols[$r["Field"]] = true;
            }
            $q->free();
        }
    }
    return !empty($cols[$coluna]);
}

$hasCep = false;
$qCepCol = @$conn->query("SHOW COLUMNS FROM usuario LIKE 'cep'");
if ($qCepCol && $qCepCol->num_rows > 0) {
    $hasCep = true;
}
if ($qCepCol) {
    $qCepCol->free();
}
if (!$hasCep) {
    if (@$conn->query("ALTER TABLE usuario ADD COLUMN cep VARCHAR(10) NULL DEFAULT NULL")) {
        $hasCep = true;
    }
}

$hasNumero = ecocoleta_usuario_tem_coluna_perfil($conn, "numero");
$hasCidade = ecocoleta_usuario_tem_coluna_perfil($conn, "cidade");
$hasComplemento = ecocoleta_usuario_tem_coluna_perfil($conn, "complemento");

$sql = "SELECT u.id_usuario, u.nome, u.email,
               COALESCE(NULLIF(TRIM(r.nome_rua), ''), '') AS endereco,
               COALESCE(NULLIF(TRIM(b.nome_bairro), ''), '') AS bairro";
if ($hasFotoPerfil) {
    $sql .= ", u.foto_perfil";
}
if ($hasNumero) {
    $sql .= ", u.numero";
}
if ($hasCidade) {
    $sql .= ", u.cidade";
}
if ($hasComplemento) {
    $sql .= ", u.complemento";
}
if ($hasCep) {
    $sql .= ", u.cep";
}
$sql .= " FROM usuario u
          LEFT JOIN rua r ON r.id_rua = u.id_rua
          LEFT JOIN bairro b ON b.id_bairro = r.id_bairro
          WHERE u.id_usuario = ? LIMIT 1";
$stmt = $conn->prepare($sql);

if (!$stmt) {
    $sql = "SELECT id_usuario, nome, email FROM usuario WHERE id_usuario = ? LIMIT 1";
    $stmt = $conn->prepare($sql);
}

if (!$stmt) {
    echo json_encode(["sucesso" => false, "erro" => "Erro ao preparar consulta do perfil."], JSON_UNESCAPED_UNICODE);
    exit;
}

$stmt->bind_param("i", $uid);
if (!$stmt->execute()) {
    $stmt->close();
    echo json_encode(["sucesso" => false, "erro" => "Erro ao carregar perfil."], JSON_UNESCAPED_UNICODE);
    exit;
}

$row = ecocoleta_stmt_fetch_one_assoc($stmt);
$stmt->close();
if (!$row) {
    echo json_encode(["sucesso" => false, "erro" => "Usuario nao encontrado."], JSON_UNESCAPED_UNICODE);
    exit;
}

$_SESSION["usuario_nome"] = $row["nome"];
$_SESSION["usuario_email"] = $row["email"];

$usuario = [
    "id" => (int) $row["id_usuario"],
    "nome" => $row["nome"],
    "email" => $row["email"],
    "saldo_ecopoints" => ecocoleta_obter_saldo_usuario($conn, $uid),
];

if ($hasFotoPerfil && array_key_exists("foto_perfil", $row) && $row["foto_perfil"] !== null && $row["foto_perfil"] !== "") {
    $usuario["foto_perfil"] = (string) $row["foto_perfil"];
}

$usuario["endereco"] = [
    "rua" => array_key_exists("endereco", $row) ? (string) $row["endereco"] : "",
    "bairro" => array_key_exists("bairro", $row) ? (string) $row["bairro"] : "",
    "numero" => ($hasNumero && array_key_exists("numero", $row) && $row["numero"] !== null) ? (string) $row["numero"] : "",
    "cidade" => ($hasCidade && array_key_exists("cidade", $row) && $row["cidade"] !== null) ? (string) $row["cidade"] : "",
    "complemento" => ($hasComplemento && array_key_exists("complemento", $row) && $row["complemento"] !== null) ? (string) $row["complemento"] : "",
    "cep" => ($hasCep && array_key_exists("cep", $row) && $row["cep"] !== null) ? (string) $row["cep"] : "",
];

echo json_encode([
    "sucesso" => true,
    "usuario" => $usuario,
], JSON_UNESCAPED_UNICODE);
