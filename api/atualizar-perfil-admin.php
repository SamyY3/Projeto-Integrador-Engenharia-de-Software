<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';

ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-helpers.php";
require_once dirname(__DIR__) . "/includes/admin-ecoponto-data.php";

$idAdmin = ecoadm_exigir_sessao();
ecoadm_garantir_colunas_admin($conn);
$ctxPerfil = ecoadm_obter_contexto($conn, $idAdmin);
$idPevPerfil = (int) ($ctxPerfil["id_pev"] ?? 0);

$stmtAtual = $conn->prepare("SELECT email FROM administrador_ecoponto WHERE id_admin = ? LIMIT 1");
$emailAtualDb = "";
if ($stmtAtual) {
    $stmtAtual->bind_param("i", $idAdmin);
    if ($stmtAtual->execute()) {
        $rowAtual = ecocoleta_stmt_fetch_one_assoc($stmtAtual);
        $emailAtualDb = trim((string) ($rowAtual["email"] ?? ""));
    }
    $stmtAtual->close();
}

[$email, $senha] = ecoadm_validar_email_senha();
ecoadm_exigir_verificacao_troca_email($conn, $idAdmin, $emailAtualDb, $email);

$nome = trim((string) ($_POST["nome"] ?? ""));
$nomeEcoponto = trim((string) ($_POST["nome_ecoponto"] ?? ""));

if ($nome !== "" && strlen($nome) > 120) {
    ecoadm_json_erro("Nome muito longo (maximo 120 caracteres).");
}
if ($nomeEcoponto !== "" && strlen($nomeEcoponto) > 160) {
    ecoadm_json_erro("Nome do EcoPonto muito longo (maximo 160 caracteres).");
}

$tentouFoto = ecoadm_cliente_enviou_foto();
$fotoPath = null;
if (!ecoadm_admin_tem_coluna($conn, "foto_perfil")) {
    if ($tentouFoto) {
        ecoadm_json_erro("Coluna foto_perfil ausente no banco. Execute as migracoes ou contate o suporte.");
    }
} else {
    $fotoPath = ecoadm_processar_foto_upload($idAdmin);
    if ($tentouFoto && $fotoPath === null) {
        ecoadm_json_erro("Nao foi possivel gravar a foto. Verifique a pasta uploads/ do projeto.");
    }
}

$conn->begin_transaction();
try {
    if ($senha !== "") {
        $hash = password_hash($senha, PASSWORD_DEFAULT);
        $stmt = $conn->prepare(
            "UPDATE administrador_ecoponto SET email = ?, senha_hash = ? WHERE id_admin = ? LIMIT 1"
        );
        if (!$stmt) {
            throw new RuntimeException("prepare");
        }
        $stmt->bind_param("ssi", $email, $hash, $idAdmin);
    } else {
        $stmt = $conn->prepare(
            "UPDATE administrador_ecoponto SET email = ? WHERE id_admin = ? LIMIT 1"
        );
        if (!$stmt) {
            throw new RuntimeException("prepare");
        }
        $stmt->bind_param("si", $email, $idAdmin);
    }

    if (!$stmt->execute()) {
        if ((int) $conn->errno === 1062) {
            $conn->rollback();
            ecoadm_json_erro("Este e-mail ja esta em uso por outro administrador.");
        }
        throw new RuntimeException("exec");
    }
    $stmt->close();

    $sets = [];
    $types = "";
    $vals = [];

    if ($nome !== "") {
        $sets[] = "nome = ?";
        $types .= "s";
        $vals[] = $nome;
    }
    if ($nomeEcoponto !== "") {
        $sets[] = "nome_ecoponto = ?";
        $types .= "s";
        $vals[] = $nomeEcoponto;
    }
    if ($fotoPath !== null && ecoadm_admin_tem_coluna($conn, "foto_perfil")) {
        $sets[] = "foto_perfil = ?";
        $types .= "s";
        $vals[] = $fotoPath;
    }

    if (!empty($sets)) {
        $sql = "UPDATE administrador_ecoponto SET " . implode(", ", $sets) . " WHERE id_admin = ? LIMIT 1";
        $stmt2 = $conn->prepare($sql);
        if (!$stmt2) {
            throw new RuntimeException("prepare2");
        }
        $types2 = $types . "i";
        $vals[] = $idAdmin;
        $bindArgs = [$types2];
        foreach ($vals as $k => $_) {
            $bindArgs[] = &$vals[$k];
        }
        call_user_func_array([$stmt2, "bind_param"], $bindArgs);
        if (!$stmt2->execute()) {
            throw new RuntimeException("exec2");
        }
        $stmt2->close();
    }

    if ($nomeEcoponto !== "" && $idPevPerfil > 0) {
        ecoadm_sincronizar_pev_nome($conn, $idPevPerfil, $nomeEcoponto);
    }

    $conn->commit();

    if (strcasecmp($emailAtualDb, $email) !== 0) {
        ecoadm_limpar_verificacao_email_sessao();
    }

    $_SESSION["ecoponto_admin_email"] = $email;
    if ($nome !== "") {
        $_SESSION["ecoponto_admin_nome"] = $nome;
    }
    if ($nomeEcoponto !== "") {
        $_SESSION["ecoponto_admin_nome_ecoponto"] = $nomeEcoponto;
    }
    if ($fotoPath !== null) {
        $_SESSION["ecoponto_admin_foto"] = $fotoPath;
    }

    $payload = [
        "mensagem" => "Perfil administrativo atualizado.",
        "admin" => [
            "id" => $idAdmin,
            "nome" => $nome !== "" ? $nome : (string) ($_SESSION["ecoponto_admin_nome"] ?? ""),
            "email" => $email,
            "ecoponto" => $nomeEcoponto !== ""
                ? $nomeEcoponto
                : (string) ($_SESSION["ecoponto_admin_nome_ecoponto"] ?? ""),
        ],
    ];
    if ($fotoPath !== null) {
        $payload["foto_perfil"] = $fotoPath;
        $payload["admin"]["foto_perfil"] = $fotoPath;
    }

    ecoadm_json_ok($payload);
} catch (Throwable $e) {
    $conn->rollback();
    ecoadm_json_erro("Nao foi possivel salvar o perfil. Tente novamente.");
}
