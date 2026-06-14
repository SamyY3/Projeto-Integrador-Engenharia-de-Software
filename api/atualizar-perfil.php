<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';

ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");

require_once dirname(__DIR__) . "/includes/conexao.php";

if (empty($_SESSION["usuario_id"]) || (int) $_SESSION["usuario_id"] <= 0) {
    echo json_encode(["sucesso" => false, "erro" => "Sessao expirada. Faca login novamente."], JSON_UNESCAPED_UNICODE);
    exit;
}

$uid = (int) $_SESSION["usuario_id"];

$qCepCol = @$conn->query("SHOW COLUMNS FROM usuario LIKE 'cep'");
if (!$qCepCol || $qCepCol->num_rows === 0) {
    @$conn->query("ALTER TABLE usuario ADD COLUMN cep VARCHAR(10) NULL DEFAULT NULL");
}
if ($qCepCol) {
    $qCepCol->free();
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

function numeroValido($numero) {
    $n = trim((string) $numero);
    if ($n === "") {
        return true;
    }
    if (strtoupper($n) === "S/N") {
        return true;
    }
    return (bool) preg_match("/^[0-9]+[A-Za-z]?$/", $n)
        || (bool) preg_match("/^[0-9]+-[A-Za-z0-9]+$/", $n);
}

function obterDiretorioUploadsPerfil() {
    $dir = __DIR__ . DIRECTORY_SEPARATOR . "uploads";
    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0755, true) && !is_dir($dir)) {
            return false;
        }
    }
    return is_writable($dir) ? $dir : false;
}

function uploadsUrlRelativaPerfil() {
    return "uploads/";
}

function stmtSelectOneInt(mysqli $conn, $sql, $types, array $params) {
    if ($types !== "" && strlen($types) !== count($params)) {
        return null;
    }
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return null;
    }
    if ($types !== "") {
        $bind = [$types];
        foreach (array_keys($params) as $k) {
            $bind[] = &$params[$k];
        }
        call_user_func_array([$stmt, "bind_param"], $bind);
    }
    if (!$stmt->execute()) {
        $stmt->close();
        return null;
    }
    $out = null;
    $stmt->bind_result($out);
    $found = $stmt->fetch();
    $stmt->close();
    return $found && $out !== null ? (int) $out : null;
}

function obterOuCriarIdBairro(mysqli $conn, $nomeBairro) {
    $nomeBairro = trim((string) $nomeBairro);
    if ($nomeBairro === "") {
        return null;
    }
    $id = stmtSelectOneInt(
        $conn,
        "SELECT id_bairro FROM bairro WHERE nome_bairro = ? LIMIT 1",
        "s",
        [$nomeBairro]
    );
    if ($id !== null && $id > 0) {
        return $id;
    }

    $ins = $conn->prepare("INSERT INTO bairro (nome_bairro) VALUES (?)");
    if (!$ins) {
        return null;
    }
    $ins->bind_param("s", $nomeBairro);
    if (!$ins->execute()) {
        $ins->close();
        return null;
    }
    $id = (int) $conn->insert_id;
    $ins->close();
    return $id > 0 ? $id : null;
}

function obterOuCriarIdRua(mysqli $conn, $nomeRua, $idBairro) {
    $nomeRua = trim((string) $nomeRua);
    $idBairro = (int) $idBairro;
    if ($nomeRua === "" || $idBairro <= 0) {
        return null;
    }

    $id = stmtSelectOneInt(
        $conn,
        "SELECT id_rua FROM rua WHERE nome_rua = ? AND id_bairro = ? LIMIT 1",
        "si",
        [$nomeRua, $idBairro]
    );
    if ($id !== null && $id > 0) {
        return $id;
    }

    $ins = $conn->prepare("INSERT INTO rua (nome_rua, id_bairro) VALUES (?, ?)");
    if (!$ins) {
        return null;
    }
    $ins->bind_param("si", $nomeRua, $idBairro);
    if (!$ins->execute()) {
        $ins->close();
        return null;
    }
    $id = (int) $conn->insert_id;
    $ins->close();
    return $id > 0 ? $id : null;
}

$email = trim((string) ($_POST["email"] ?? ""));
$confirmEmail = trim((string) ($_POST["confirmaremail"] ?? ""));
$senha = (string) ($_POST["senha"] ?? "");
$confirmSenha = (string) ($_POST["confirmarsenha"] ?? "");

$endereco = trim((string) ($_POST["endereco"] ?? ""));
$bairroNome = trim((string) ($_POST["bairro"] ?? ""));
$numero = trim((string) ($_POST["numero"] ?? ""));
$cidade = trim((string) ($_POST["cidade"] ?? ""));
$complemento = trim((string) ($_POST["complemento"] ?? ""));
$cep = trim((string) ($_POST["cep"] ?? ""));

function normalizarCepPerfil(string $cep): string
{
    $digitos = preg_replace("/\D/", "", $cep);
    if (strlen($digitos) === 8) {
        return substr($digitos, 0, 5) . "-" . substr($digitos, 5);
    }
    return trim($cep);
}

if ($email === "" || $confirmEmail === "") {
    echo json_encode(["sucesso" => false, "erro" => "Preencha o e-mail e a confirmacao."], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($email !== $confirmEmail) {
    echo json_encode(["sucesso" => false, "erro" => "Os e-mails nao coincidem."], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(["sucesso" => false, "erro" => "E-mail invalido."], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($senha !== $confirmSenha) {
    echo json_encode(["sucesso" => false, "erro" => "As senhas nao coincidem."], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($senha !== "" && strlen($senha) < 8) {
    echo json_encode(["sucesso" => false, "erro" => "Senha deve ter pelo menos 8 caracteres."], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($senha !== "" && !preg_match("/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/", $senha)) {
    echo json_encode(["sucesso" => false, "erro" => "Senha deve conter maiuscula, minuscula e numero."], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($cep !== "" && !preg_match("/^\d{5}-?\d{3}$/", $cep)) {
    echo json_encode([
        "sucesso" => false,
        "erro" => "CEP invalido. Use o formato 00000-000 ou 00000000.",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if (usuarioTemColuna($conn, "numero") && $numero !== "" && !numeroValido($numero)) {
    echo json_encode([
        "sucesso" => false,
        "erro" => "Numero invalido! Use formatos como 32, 32A, 100-B ou S/N.",
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$fotoPath = null;
if (usuarioTemColuna($conn, "foto_perfil")) {
    $fotoFile = (isset($_FILES["foto"]) && is_array($_FILES["foto"])) ? $_FILES["foto"] : null;
    $querBase64 = !empty($_POST["foto_base64"]) && is_string($_POST["foto_base64"]);
    $querFile = $fotoFile && !empty($fotoFile["tmp_name"]) && is_uploaded_file((string) $fotoFile["tmp_name"]);

    if ($querFile || $querBase64) {
        $dir = obterDiretorioUploadsPerfil();
        if ($dir === false) {
            echo json_encode([
                "sucesso" => false,
                "erro" => "Pasta uploads indisponivel. Crie Ecocoleta/uploads com permissao de escrita para o Apache.",
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $rel = uploadsUrlRelativaPerfil();

        if ($querFile) {
            $tmp = (string) $fotoFile["tmp_name"];
            $mime = function_exists("mime_content_type") ? mime_content_type($tmp) : (string) ($fotoFile["type"] ?? "");
            if (strpos((string) $mime, "image/") === 0) {
                $orig = isset($fotoFile["name"]) ? basename((string) $fotoFile["name"]) : "foto";
                $orig = preg_replace("/[^a-zA-Z0-9._-]/", "_", $orig);
                if ($orig === "" || $orig === "_") {
                    $orig = "foto.jpg";
                }
                $nomeArq = time() . "_" . $uid . "_" . $orig;
                $destinoFs = $dir . DIRECTORY_SEPARATOR . $nomeArq;
                if (@move_uploaded_file($tmp, $destinoFs)) {
                    $fotoPath = $rel . $nomeArq;
                }
            }
        } elseif ($querBase64) {
            $raw = (string) $_POST["foto_base64"];
            if (preg_match("#^data:image/(png|jpeg|jpg|webp);base64,#i", $raw, $m)) {
                $ext = strtolower($m[1]);
                if ($ext === "jpeg") {
                    $ext = "jpg";
                }
                $data = preg_replace("#^data:image/[^;]+;base64,#", "", $raw);
                $bin = base64_decode($data, true);
                if ($bin !== false && strlen($bin) > 0 && strlen($bin) < 6 * 1024 * 1024) {
                    $nomeArq = time() . "_" . $uid . "_preview." . $ext;
                    $destinoFs = $dir . DIRECTORY_SEPARATOR . $nomeArq;
                    if (@file_put_contents($destinoFs, $bin) !== false) {
                        $fotoPath = $rel . $nomeArq;
                    }
                }
            }
        }

        if ($fotoPath === null) {
            echo json_encode([
                "sucesso" => false,
                "erro" => "Nao foi possivel salvar a foto. Use PNG, JPG ou WebP.",
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
}

$idRua = null;
$conn->begin_transaction();
try {
    if ($bairroNome !== "" && $endereco !== "") {
        $idB = obterOuCriarIdBairro($conn, $bairroNome);
        if ($idB === null) {
            throw new Exception("bairro");
        }
        $idRua = obterOuCriarIdRua($conn, $endereco, $idB);
        if ($idRua === null) {
            throw new Exception("rua");
        }
    }

    if ($senha !== "") {
        $hash = password_hash($senha, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("UPDATE usuario SET email = ?, senha_hash = ? WHERE id_usuario = ? LIMIT 1");
        if (!$stmt) {
            throw new Exception("prepare");
        }
        $stmt->bind_param("ssi", $email, $hash, $uid);
        if (!$stmt->execute()) {
            if ((int) $conn->errno === 1062) {
                $conn->rollback();
                echo json_encode(["sucesso" => false, "erro" => "Este e-mail ja esta em uso."], JSON_UNESCAPED_UNICODE);
                exit;
            }
            throw new Exception("exec");
        }
        $stmt->close();
    } else {
        $stmt = $conn->prepare("UPDATE usuario SET email = ? WHERE id_usuario = ? LIMIT 1");
        if (!$stmt) {
            throw new Exception("prepare");
        }
        $stmt->bind_param("si", $email, $uid);
        if (!$stmt->execute()) {
            if ((int) $conn->errno === 1062) {
                $conn->rollback();
                echo json_encode(["sucesso" => false, "erro" => "Este e-mail ja esta em uso."], JSON_UNESCAPED_UNICODE);
                exit;
            }
            throw new Exception("exec");
        }
        $stmt->close();
    }

    $sets = [];
    $types = "";
    $vals = [];

    if (usuarioTemColuna($conn, "foto_perfil") && $fotoPath !== null) {
        $sets[] = "foto_perfil = ?";
        $types .= "s";
        $vals[] = $fotoPath;
    }
    if (usuarioTemColuna($conn, "numero") && $numero !== "") {
        $sets[] = "numero = ?";
        $types .= "s";
        $vals[] = $numero;
    }
    if (usuarioTemColuna($conn, "cidade") && $cidade !== "") {
        $sets[] = "cidade = ?";
        $types .= "s";
        $vals[] = $cidade;
    }
    if (usuarioTemColuna($conn, "complemento") && $complemento !== "") {
        $sets[] = "complemento = ?";
        $types .= "s";
        $vals[] = $complemento;
    }
    if (usuarioTemColuna($conn, "cep") && $cep !== "") {
        $sets[] = "cep = ?";
        $types .= "s";
        $vals[] = normalizarCepPerfil($cep);
    }
    if ($idRua !== null) {
        $sets[] = "id_rua = ?";
        $types .= "i";
        $vals[] = $idRua;
    }

    if (!empty($sets)) {
        $sql = "UPDATE usuario SET " . implode(", ", $sets) . " WHERE id_usuario = ? LIMIT 1";
        $stmt2 = $conn->prepare($sql);
        if (!$stmt2) {
            throw new Exception("prepare2");
        }
        $types2 = $types . "i";
        $vals[] = $uid;
        $bindArgs = [$types2];
        foreach ($vals as $k => $_) {
            $bindArgs[] = &$vals[$k];
        }
        call_user_func_array([$stmt2, "bind_param"], $bindArgs);
        if (!$stmt2->execute()) {
            throw new Exception("exec2");
        }
        $stmt2->close();
    }

    $conn->commit();
    $_SESSION["usuario_email"] = $email;

    $enderecoResp = [
        "rua" => "",
        "bairro" => "",
        "numero" => "",
        "cidade" => "",
        "complemento" => "",
        "cep" => "",
    ];
    $sqlEnd = "SELECT COALESCE(NULLIF(TRIM(r.nome_rua), ''), '') AS endereco,
                      COALESCE(NULLIF(TRIM(b.nome_bairro), ''), '') AS bairro";
    if (usuarioTemColuna($conn, "numero")) {
        $sqlEnd .= ", u.numero";
    }
    if (usuarioTemColuna($conn, "cidade")) {
        $sqlEnd .= ", u.cidade";
    }
    if (usuarioTemColuna($conn, "complemento")) {
        $sqlEnd .= ", u.complemento";
    }
    if (usuarioTemColuna($conn, "cep")) {
        $sqlEnd .= ", u.cep";
    }
    $sqlEnd .= " FROM usuario u
                 LEFT JOIN rua r ON r.id_rua = u.id_rua
                 LEFT JOIN bairro b ON b.id_bairro = r.id_bairro
                 WHERE u.id_usuario = ? LIMIT 1";
    $stmtEnd = $conn->prepare($sqlEnd);
    if ($stmtEnd) {
        $stmtEnd->bind_param("i", $uid);
        if ($stmtEnd->execute()) {
            $rowEnd = ecocoleta_stmt_fetch_one_assoc($stmtEnd);
            if ($rowEnd) {
                $enderecoResp["rua"] = (string) ($rowEnd["endereco"] ?? "");
                $enderecoResp["bairro"] = (string) ($rowEnd["bairro"] ?? "");
                if (array_key_exists("numero", $rowEnd) && $rowEnd["numero"] !== null) {
                    $enderecoResp["numero"] = (string) $rowEnd["numero"];
                }
                if (array_key_exists("cidade", $rowEnd) && $rowEnd["cidade"] !== null) {
                    $enderecoResp["cidade"] = (string) $rowEnd["cidade"];
                }
                if (array_key_exists("complemento", $rowEnd) && $rowEnd["complemento"] !== null) {
                    $enderecoResp["complemento"] = (string) $rowEnd["complemento"];
                }
                if (array_key_exists("cep", $rowEnd) && $rowEnd["cep"] !== null) {
                    $enderecoResp["cep"] = (string) $rowEnd["cep"];
                }
            }
        }
        $stmtEnd->close();
    }

    $payload = [
        "sucesso" => true,
        "mensagem" => "Perfil atualizado.",
        "endereco" => $enderecoResp,
    ];
    if ($fotoPath !== null) {
        $payload["foto_perfil"] = $fotoPath;
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    $conn->rollback();
    echo json_encode(["sucesso" => false, "erro" => "Nao foi possivel salvar. Tente novamente."], JSON_UNESCAPED_UNICODE);
}
