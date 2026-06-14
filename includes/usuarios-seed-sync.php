<?php

declare(strict_types=1);

require_once __DIR__ . "/usuarios-seed-data.php";

const ECOSEED_EMAIL_SUFFIX = ECOSEED_USUARIOS_EMAIL_SUFFIX;
const ECOSEED_COUNT = ECOSEED_USUARIOS_TOTAL;
const ECOSEED_DEFAULT_PASSWORD = ECOSEED_USUARIOS_SENHA_PADRAO;

function ecoseed_coluna_existe(mysqli $conn, string $tabela, string $coluna): bool
{
    $tabela = preg_replace('/[^A-Za-z0-9_]/', "", $tabela);
    $coluna = preg_replace('/[^A-Za-z0-9_]/', "", $coluna);
    $res = @$conn->query("SHOW COLUMNS FROM `{$tabela}` LIKE '{$coluna}'");
    if (!$res) {
        return false;
    }
    $ok = $res->num_rows > 0;
    $res->free();
    return $ok;
}

function ecoseed_garantir_schema(mysqli $conn): void
{
    if (!ecoseed_coluna_existe($conn, "usuario", "telefone")) {
        @$conn->query(
            "ALTER TABLE usuario ADD COLUMN telefone VARCHAR(20) NULL DEFAULT NULL AFTER email"
        );
    }
    if (!ecoseed_coluna_existe($conn, "usuario", "status_conta")) {
        @$conn->query(
            "ALTER TABLE usuario ADD COLUMN status_conta ENUM('ativo','inativo') NOT NULL DEFAULT 'ativo' AFTER tipo_usuario"
        );
    }
}

function ecoseed_garantir_enderecos(mysqli $conn): array
{
    $mapaCidades = ecoseed_enderecos_por_cidade();
    $idsRuas = [];

    foreach ($mapaCidades as $ruasPorBairro) {
        foreach (array_keys($ruasPorBairro) as $nomeBairro) {
            $idBairro = 0;
            $stmt = $conn->prepare("SELECT id_bairro FROM bairro WHERE nome_bairro = ? LIMIT 1");
            if ($stmt) {
                $stmt->bind_param("s", $nomeBairro);
                $stmt->execute();
                $stmt->bind_result($idBairro);
                $stmt->fetch();
                $stmt->close();
            }

            if ($idBairro <= 0) {
                $ins = $conn->prepare("INSERT INTO bairro (nome_bairro) VALUES (?)");
                if ($ins) {
                    $ins->bind_param("s", $nomeBairro);
                    $ins->execute();
                    $idBairro = (int) $conn->insert_id;
                    $ins->close();
                }
            }

            foreach ($ruasPorBairro[$nomeBairro] ?? [] as $nomeRua) {
                $idRua = 0;
                $stmtR = $conn->prepare(
                    "SELECT id_rua FROM rua WHERE nome_rua = ? AND id_bairro = ? LIMIT 1"
                );
                if ($stmtR) {
                    $stmtR->bind_param("si", $nomeRua, $idBairro);
                    $stmtR->execute();
                    $stmtR->bind_result($idRua);
                    $stmtR->fetch();
                    $stmtR->close();
                }

                if ($idRua <= 0) {
                    $insR = $conn->prepare("INSERT INTO rua (nome_rua, id_bairro) VALUES (?, ?)");
                    if ($insR) {
                        $insR->bind_param("si", $nomeRua, $idBairro);
                        $insR->execute();
                        $idRua = (int) $conn->insert_id;
                        $insR->close();
                    }
                }

                if ($idRua > 0) {
                    $idsRuas[] = $idRua;
                }
            }
        }
    }

    if ($idsRuas === []) {
        $res = @$conn->query("SELECT id_rua FROM rua ORDER BY id_rua ASC LIMIT 20");
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $idsRuas[] = (int) ($row["id_rua"] ?? 0);
            }
            $res->free();
        }
    }

    return array_values(array_filter(array_unique($idsRuas), static fn (int $id): bool => $id > 0));
}

function ecoseed_remover_usuarios_seed(mysqli $conn): int
{
    $like = "%" . ECOSEED_EMAIL_SUFFIX;
    $stmt = $conn->prepare("DELETE FROM usuario WHERE email LIKE ?");
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param("s", $like);
    $stmt->execute();
    $removidos = $stmt->affected_rows;
    $stmt->close();
    return max(0, $removidos);
}

function ecoseed_contar_usuarios_seed(mysqli $conn): int
{
    $like = "%" . ECOSEED_EMAIL_SUFFIX;
    $stmt = $conn->prepare("SELECT COUNT(*) AS c FROM usuario WHERE email LIKE ?");
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param("s", $like);
    $stmt->execute();
    $c = 0;
    $stmt->bind_result($c);
    $stmt->fetch();
    $stmt->close();
    return (int) $c;
}

function ecoseed_gerar_usuarios(): array
{
    return array_slice(ecoseed_usuarios_dataset(), 0, ECOSEED_COUNT);
}

function ecoseed_resolver_id_rua(mysqli $conn, string $nomeBairro, array $idsRuasFallback): int
{
    $nomeBairro = trim($nomeBairro);
    if ($nomeBairro !== "") {
        $stmt = $conn->prepare(
            "SELECT r.id_rua
             FROM rua r
             INNER JOIN bairro b ON b.id_bairro = r.id_bairro
             WHERE b.nome_bairro = ?
             ORDER BY r.id_rua ASC
             LIMIT 1"
        );
        if ($stmt) {
            $stmt->bind_param("s", $nomeBairro);
            if ($stmt->execute()) {
                $id = 0;
                $stmt->bind_result($id);
                if ($stmt->fetch() && $id > 0) {
                    $stmt->close();
                    return (int) $id;
                }
            }
            $stmt->close();
        }
    }

    return $idsRuasFallback !== [] ? (int) $idsRuasFallback[0] : 0;
}

function ecoseed_inserir_usuario(
    mysqli $conn,
    array $u,
    string $senhaHash,
    int $idRua,
    bool $temTelefone,
    bool $temStatus
): bool {
    $cols = ["nome", "email"];
    $types = "ss";
    $vals = [(string) $u["nome"], (string) $u["email"]];

    if ($temTelefone) {
        $cols[] = "telefone";
        $types .= "s";
        $vals[] = (string) $u["telefone"];
    }

    $cols[] = "senha_hash";
    $cols[] = "tipo_usuario";
    $types .= "ss";
    $vals[] = $senhaHash;
    $vals[] = (string) $u["tipo_usuario"];

    if ($temStatus) {
        $cols[] = "status_conta";
        $types .= "s";
        $vals[] = (string) $u["status_conta"];
    }

    $cols[] = "id_rua";
    $cols[] = "numero";
    $cols[] = "cidade";
    $cols[] = "complemento";
    $cols[] = "data_cadastro";
    $types .= "issss";
    $vals[] = $idRua;
    $vals[] = (string) $u["numero"];
    $vals[] = (string) $u["cidade"];
    $vals[] = $u["complemento"] !== null ? (string) $u["complemento"] : "";
    $vals[] = (string) $u["data_cadastro"];

    $placeholders = implode(", ", array_fill(0, count($cols), "?"));
    $sql = "INSERT INTO usuario (" . implode(", ", $cols) . ") VALUES ({$placeholders})";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return false;
    }

    $stmt->bind_param($types, ...$vals);
    $ok = $stmt->execute();
    $stmt->close();
    return $ok;
}

function ecoseed_usuarios_sincronizar(mysqli $conn, bool $fresh = false): array
{
    $stats = ["inseridos" => 0, "total" => 0, "removidos" => 0];

    if (!ecocoleta_tabela_existe($conn, "usuario")) {
        return $stats;
    }

    if ($fresh) {
        $stats["removidos"] = ecoseed_remover_usuarios_seed($conn);
    } else {
        $existentes = ecoseed_contar_usuarios_seed($conn);
        if ($existentes >= ECOSEED_COUNT) {
            $stats["total"] = $existentes;
            return $stats;
        }
    }

    ecoseed_garantir_schema($conn);
    $idsRuas = ecoseed_garantir_enderecos($conn);
    if ($idsRuas === []) {
        return $stats;
    }

    $temTelefone = ecoseed_coluna_existe($conn, "usuario", "telefone");
    $temStatus = ecoseed_coluna_existe($conn, "usuario", "status_conta");
    $senhaHash = password_hash(ECOSEED_DEFAULT_PASSWORD, PASSWORD_DEFAULT);
    if ($senhaHash === false) {
        return $stats;
    }

    $emailsExistentes = [];
    $like = "%" . ECOSEED_EMAIL_SUFFIX;
    $resEmails = @$conn->query(
        "SELECT email FROM usuario WHERE email LIKE '" . $conn->real_escape_string($like) . "'"
    );
    if ($resEmails) {
        while ($row = $resEmails->fetch_assoc()) {
            $emailsExistentes[(string) $row["email"]] = true;
        }
        $resEmails->free();
    }

    $ruaCount = count($idsRuas);
    foreach (ecoseed_gerar_usuarios() as $idx => $u) {
        if (isset($emailsExistentes[$u["email"]])) {
            continue;
        }
        $idRua = ecoseed_resolver_id_rua($conn, (string) ($u["bairro"] ?? ""), $idsRuas);
        if ($idRua <= 0 && $ruaCount > 0) {
            $idRua = $idsRuas[$idx % $ruaCount];
        }
        if ($idRua <= 0) {
            continue;
        }
        if (ecoseed_inserir_usuario($conn, $u, $senhaHash, $idRua, $temTelefone, $temStatus)) {
            $stats["inseridos"]++;
        }
    }

    $stats["total"] = ecoseed_contar_usuarios_seed($conn);
    return $stats;
}
