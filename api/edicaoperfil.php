<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ecocoleta_session_start();
require_once dirname(__DIR__) . "/includes/conexao.php";
$isGuest = empty($_SESSION["usuario_id"]) || (int) $_SESSION["usuario_id"] <= 0;
$uid = $isGuest ? 0 : (int) $_SESSION["usuario_id"];

function h($s) {
    return htmlspecialchars((string) $s, ENT_QUOTES, "UTF-8");
}

function usuarioTemColuna(mysqli $conn, $nome) {
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        $q = $conn->query("SHOW COLUMNS FROM usuario");
        if ($q) {
            while ($row = $q->fetch_assoc()) {
                $cache[$row["Field"]] = true;
            }
        }
    }
    return !empty($cache[$nome]);
}

$defaults = [
    "nome" => "", "email" => "", "foto_perfil" => "", "numero" => "",
    "cidade" => "", "complemento" => "", "nome_rua" => "", "nome_bairro" => "",
];
$usuario = $defaults;

if (!$isGuest) {
    $extras = [];
    foreach (["foto_perfil", "numero", "cidade", "complemento"] as $col) {
        if (usuarioTemColuna($conn, $col)) {
            $extras[] = "u." . $col;
        }
    }

    $sql = "SELECT u.nome, u.email, u.id_rua";
    if (!empty($extras)) {
        $sql .= ", " . implode(", ", $extras);
    }
    $sql .= ", r.nome_rua AS nome_rua, b.nome_bairro AS nome_bairro
        FROM usuario u
        LEFT JOIN rua r ON u.id_rua = r.id_rua
        LEFT JOIN bairro b ON r.id_bairro = b.id_bairro
        WHERE u.id_usuario = ?
        LIMIT 1";

    $stmt = $conn->prepare($sql);
    if ($stmt) {
        $stmt->bind_param("i", $uid);
        if ($stmt->execute()) {
            $row = ecocoleta_stmt_fetch_one_assoc($stmt);
            if ($row) {
                $usuario = array_merge($defaults, array_map(function ($v) {
                    return $v === null ? "" : $v;
                }, $row));
            }
        }
        $stmt->close();
    }
}

$fotoSrc = "assets/images/mulher.png";
if (!empty($usuario["foto_perfil"])) {
    $fp = (string) $usuario["foto_perfil"];
    if (strpos($fp, "data:image") === 0 || preg_match("#^https?://#i", $fp) || $fp !== "") {
        $fotoSrc = $fp;
    }
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Editar Perfil</title>
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="edicaoperfil.css">
  <link rel="stylesheet" href="header.css?v=7">
  <link rel="stylesheet" href="notif-popup.css">
  <link rel="stylesheet" href="user-popup.css">
</head>
<body class="app editar-perfil" data-edicao-php="1">
<?php  ?>
<?php include dirname(__DIR__) . "/includes/edicaoperfil_body.inc.php"; ?>
</body>
</html>
