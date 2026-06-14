<?php

declare(strict_types=1);

require_once __DIR__ . "/admin-plataforma-helpers.php";
require_once __DIR__ . "/admin-ecoponto-data.php";
require_once __DIR__ . "/configuracoes-plataforma.php";

function ecoplat_garantir_tabela_admin(mysqli $conn): void
{
    @$conn->query(
        "CREATE TABLE IF NOT EXISTS administrador_plataforma (
            id_admin INT AUTO_INCREMENT PRIMARY KEY,
            nome VARCHAR(120) NOT NULL,
            email VARCHAR(160) NOT NULL,
            senha_hash VARCHAR(255) NOT NULL,
            cargo VARCHAR(120) NOT NULL DEFAULT 'Administrador da plataforma',
            status ENUM('ativo', 'inativo') NOT NULL DEFAULT 'ativo',
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ultimo_login DATETIME NULL,
            UNIQUE KEY uq_admin_plataforma_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $res = @$conn->query("SELECT COUNT(*) AS total FROM administrador_plataforma");
    $total = 0;
    if ($res) {
        $row = $res->fetch_assoc();
        $total = (int) ($row["total"] ?? 0);
        $res->free();
    }

    if ($total === 0) {
        $senhaDemo = password_hash("EcoPlat@2026", PASSWORD_DEFAULT);
        $stmt = $conn->prepare(
            "INSERT INTO administrador_plataforma (nome, email, senha_hash, cargo)
             VALUES (?, ?, ?, ?)"
        );
        if ($stmt) {
            $nome = "Administrador da Plataforma";
            $email = "admin.plataforma@ecocoleta.local";
            $cargo = "Diretor de operacoes";
            $stmt->bind_param("ssss", $nome, $email, $senhaDemo, $cargo);
            @$stmt->execute();
            $stmt->close();
        }
    }
}

function ecoplat_admin_tem_coluna(mysqli $conn, string $nome): bool
{
    if (!isset($GLOBALS["ecoplat_admin_cols_cache"]) || !is_array($GLOBALS["ecoplat_admin_cols_cache"])) {
        $GLOBALS["ecoplat_admin_cols_cache"] = [];
        $q = @$conn->query("SHOW COLUMNS FROM administrador_plataforma");
        if ($q) {
            while ($row = $q->fetch_assoc()) {
                $GLOBALS["ecoplat_admin_cols_cache"][$row["Field"]] = true;
            }
            $q->free();
        }
    }

    return !empty($GLOBALS["ecoplat_admin_cols_cache"][$nome]);
}

function ecoplat_invalidar_cache_admin(): void
{
    $GLOBALS["ecoplat_admin_cols_cache"] = null;
}

function ecoplat_garantir_colunas_admin(mysqli $conn): void
{
    ecoplat_garantir_tabela_admin($conn);
    if (!ecoplat_admin_tem_coluna($conn, "foto_perfil")) {
        @$conn->query(
            "ALTER TABLE administrador_plataforma
             ADD COLUMN foto_perfil VARCHAR(255) NULL DEFAULT NULL AFTER cargo"
        );
        ecoplat_invalidar_cache_admin();
    }
}

function ecoplat_garantir_schema_sessao(mysqli $conn): void
{
    if (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION["ecoplat_schema_ok"])) {
        return;
    }
    ecoplat_garantir_tabela_admin($conn);
    ecoplat_garantir_colunas_admin($conn);
    ecoplat_config_garantir_tabela($conn);
    ecoadm_garantir_schema_integracao($conn);
    if (session_status() === PHP_SESSION_ACTIVE) {
        $_SESSION["ecoplat_schema_ok"] = true;
    }
}

function ecoplat_funcao_label(string $cargo): string
{
    $c = trim($cargo);
    return $c !== "" ? $c : "Administrador da plataforma";
}

function ecoplat_listar_administradores_plataforma(mysqli $conn, int $idAdminAtual): array
{
    ecoplat_garantir_schema_sessao($conn);

    if (!ecocoleta_tabela_existe($conn, "administrador_plataforma")) {
        return [];
    }

    $stmt = $conn->prepare(
        "SELECT id_admin, nome, email, cargo, status, criado_em
         FROM administrador_plataforma
         ORDER BY nome ASC
         LIMIT 100"
    );
    if (!$stmt || !$stmt->execute()) {
        return [];
    }

    $lista = [];
    foreach (ecocoleta_stmt_fetch_all_assoc($stmt) as $row) {
        $id = (int) ($row["id_admin"] ?? 0);
        $nome = (string) ($row["nome"] ?? "");
        $lista[] = [
            "id_admin" => $id,
            "nome" => $nome,
            "email" => (string) ($row["email"] ?? ""),
            "cargo" => (string) ($row["cargo"] ?? ""),
            "cargo_label" => ecoplat_funcao_label((string) ($row["cargo"] ?? "")),
            "status" => (string) ($row["status"] ?? "ativo"),
            "iniciais" => mb_strtoupper(
                mb_substr(preg_replace("/\s+/", "", $nome) ?: "A", 0, 2, "UTF-8"),
                "UTF-8"
            ),
            "is_self" => $id === $idAdminAtual,
        ];
    }
    $stmt->close();

    return $lista;
}

function ecoplat_salvar_administrador_plataforma(mysqli $conn, int $idAdminAtual, array $dados): array
{
    ecoplat_garantir_schema_sessao($conn);

    $idEdit = (int) ($dados["id_admin"] ?? 0);
    $nome = mb_substr(trim((string) ($dados["nome"] ?? "")), 0, 120, "UTF-8");
    $email = mb_strtolower(trim((string) ($dados["email"] ?? "")), "UTF-8");
    $cargo = mb_substr(trim((string) ($dados["cargo"] ?? "Administrador da plataforma")), 0, 120, "UTF-8");
    $senha = (string) ($dados["senha"] ?? "");

    if ($nome === "" || $email === "") {
        ecoplat_json_erro("Informe nome e e-mail.");
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        ecoplat_json_erro("E-mail invalido.");
    }

    if ($idEdit > 0) {
        if ($senha !== "" && strlen($senha) < 8) {
            ecoplat_json_erro("Senha deve ter pelo menos 8 caracteres.");
        }
        $sets = ["nome = ?", "email = ?", "cargo = ?"];
        $types = "sss";
        $vals = [$nome, $email, $cargo];
        if ($senha !== "") {
            $sets[] = "senha_hash = ?";
            $types .= "s";
            $vals[] = password_hash($senha, PASSWORD_DEFAULT);
        }
        $sql = "UPDATE administrador_plataforma SET " . implode(", ", $sets) . " WHERE id_admin = ? LIMIT 1";
        $types .= "i";
        $vals[] = $idEdit;
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            ecoplat_json_erro("Erro ao atualizar administrador.");
        }
        $bindArgs = [$types];
        foreach ($vals as $k => $_) {
            $bindArgs[] = &$vals[$k];
        }
        call_user_func_array([$stmt, "bind_param"], $bindArgs);
        if (!$stmt->execute()) {
            if ((int) $conn->errno === 1062) {
                ecoplat_json_erro("Este e-mail ja esta em uso.");
            }
            ecoplat_json_erro("Nao foi possivel atualizar.");
        }
        $stmt->close();
        if ($idEdit === $idAdminAtual) {
            $_SESSION["ecocoleta_plat_admin_nome"] = $nome;
            $_SESSION["ecocoleta_plat_admin_email"] = $email;
            $_SESSION["ecocoleta_plat_admin_cargo"] = $cargo;
        }
        return ["id_admin" => $idEdit, "mensagem" => "Administrador atualizado."];
    }

    if ($senha === "" || strlen($senha) < 8) {
        ecoplat_json_erro("Informe senha com pelo menos 8 caracteres para o novo administrador.");
    }
    $hash = password_hash($senha, PASSWORD_DEFAULT);
    $stmt = $conn->prepare(
        "INSERT INTO administrador_plataforma (nome, email, senha_hash, cargo, status)
         VALUES (?, ?, ?, ?, 'ativo')"
    );
    if (!$stmt) {
        ecoplat_json_erro("Erro ao criar administrador.");
    }
    $stmt->bind_param("ssss", $nome, $email, $hash, $cargo);
    if (!$stmt->execute()) {
        if ((int) $conn->errno === 1062) {
            ecoplat_json_erro("Este e-mail ja esta cadastrado.");
        }
        ecoplat_json_erro("Nao foi possivel criar o administrador.");
    }
    $novoId = (int) $conn->insert_id;
    $stmt->close();

    return ["id_admin" => $novoId, "mensagem" => "Administrador adicionado."];
}

function ecoplat_obter_perfil_admin(mysqli $conn, int $idAdmin): ?array
{
    ecoplat_garantir_colunas_admin($conn);

    $cols = "id_admin, nome, email, cargo, status";
    if (ecoplat_admin_tem_coluna($conn, "foto_perfil")) {
        $cols .= ", foto_perfil";
    }

    $stmt = $conn->prepare(
        "SELECT {$cols} FROM administrador_plataforma WHERE id_admin = ? AND status = 'ativo' LIMIT 1"
    );
    if (!$stmt) {
        return null;
    }
    $stmt->bind_param("i", $idAdmin);
    if (!$stmt->execute()) {
        $stmt->close();
        return null;
    }
    $row = ecocoleta_stmt_fetch_one_assoc($stmt);
    $stmt->close();
    if (!$row) {
        return null;
    }

    $nome = (string) ($row["nome"] ?? "");
    $perfil = [
        "id_admin" => (int) ($row["id_admin"] ?? 0),
        "nome" => $nome,
        "email" => (string) ($row["email"] ?? ""),
        "cargo" => (string) ($row["cargo"] ?? ""),
        "cargo_label" => ecoplat_funcao_label((string) ($row["cargo"] ?? "")),
        "status" => (string) ($row["status"] ?? "ativo"),
        "iniciais" => mb_strtoupper(
            mb_substr(preg_replace("/\s+/", "", $nome) ?: "A", 0, 2, "UTF-8"),
            "UTF-8"
        ),
    ];
    if (
        ecoplat_admin_tem_coluna($conn, "foto_perfil")
        && !empty($row["foto_perfil"])
    ) {
        $perfil["foto_perfil"] = (string) $row["foto_perfil"];
    }

    return $perfil;
}

function ecoplat_sync_sessao_admin(array $perfil): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }
    if (!empty($perfil["nome"])) {
        $_SESSION["ecocoleta_plat_admin_nome"] = (string) $perfil["nome"];
    }
    if (!empty($perfil["email"])) {
        $_SESSION["ecocoleta_plat_admin_email"] = (string) $perfil["email"];
    }
    if (array_key_exists("cargo", $perfil)) {
        $_SESSION["ecocoleta_plat_admin_cargo"] = (string) $perfil["cargo"];
    }
    if (!empty($perfil["foto_perfil"])) {
        $_SESSION["ecocoleta_plat_admin_foto"] = (string) $perfil["foto_perfil"];
    }
}

function ecoplat_atualizar_perfil_admin(mysqli $conn, int $idAdmin, array $dados, ?string $fotoPath): array
{
    ecoplat_garantir_colunas_admin($conn);

    $nome = mb_substr(trim((string) ($dados["nome"] ?? "")), 0, 120, "UTF-8");
    $email = mb_strtolower(trim((string) ($dados["email"] ?? "")), "UTF-8");
    $cargo = mb_substr(trim((string) ($dados["cargo"] ?? "")), 0, 120, "UTF-8");
    $senha = (string) ($dados["senha"] ?? "");

    if ($nome === "" || $email === "") {
        ecoplat_json_erro("Informe nome e e-mail.");
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        ecoplat_json_erro("E-mail invalido.");
    }
    if ($senha !== "" && strlen($senha) < 8) {
        ecoplat_json_erro("Senha deve ter pelo menos 8 caracteres.");
    }
    if ($cargo === "") {
        $cargo = "Administrador da plataforma";
    }

    $sets = ["nome = ?", "email = ?", "cargo = ?"];
    $types = "sss";
    $vals = [$nome, $email, $cargo];

    if ($senha !== "") {
        $sets[] = "senha_hash = ?";
        $types .= "s";
        $vals[] = password_hash($senha, PASSWORD_DEFAULT);
    }
    if ($fotoPath !== null && ecoplat_admin_tem_coluna($conn, "foto_perfil")) {
        $sets[] = "foto_perfil = ?";
        $types .= "s";
        $vals[] = $fotoPath;
    }

    $sql = "UPDATE administrador_plataforma SET " . implode(", ", $sets) . " WHERE id_admin = ? AND status = 'ativo' LIMIT 1";
    $types .= "i";
    $vals[] = $idAdmin;

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        ecoplat_json_erro("Erro ao atualizar perfil.");
    }
    $bindArgs = [$types];
    foreach ($vals as $k => $_) {
        $bindArgs[] = &$vals[$k];
    }
    call_user_func_array([$stmt, "bind_param"], $bindArgs);
    if (!$stmt->execute()) {
        if ((int) $conn->errno === 1062) {
            ecoplat_json_erro("Este e-mail ja esta em uso.");
        }
        ecoplat_json_erro("Nao foi possivel salvar o perfil.");
    }
    if ($stmt->affected_rows < 1) {
        $stmt->close();
        ecoplat_json_erro("Administrador nao encontrado.");
    }
    $stmt->close();

    $perfil = ecoplat_obter_perfil_admin($conn, $idAdmin);
    if (!$perfil) {
        ecoplat_json_erro("Perfil nao encontrado apos salvar.");
    }
    ecoplat_sync_sessao_admin($perfil);

    return [
        "mensagem" => "Perfil atualizado com sucesso.",
        "admin" => $perfil,
    ];
}

function ecoplat_excluir_administrador_plataforma(mysqli $conn, int $idAdminAtual, int $idExcluir): void
{
    if ($idExcluir <= 0) {
        ecoplat_json_erro("Administrador invalido.");
    }
    if ($idExcluir === $idAdminAtual) {
        ecoplat_json_erro("Voce nao pode remover a propria conta.");
    }

    $res = @$conn->query("SELECT COUNT(*) AS c FROM administrador_plataforma WHERE status = 'ativo'");
    $total = 0;
    if ($res) {
        $row = $res->fetch_assoc();
        $total = (int) ($row["c"] ?? 0);
        $res->free();
    }
    if ($total <= 1) {
        ecoplat_json_erro("Nao e possivel remover o unico administrador ativo.");
    }

    $stmt = $conn->prepare(
        "UPDATE administrador_plataforma SET status = 'inativo' WHERE id_admin = ? LIMIT 1"
    );
    if (!$stmt) {
        ecoplat_json_erro("Erro ao remover administrador.");
    }
    $stmt->bind_param("i", $idExcluir);
    if (!$stmt->execute() || $stmt->affected_rows < 1) {
        $stmt->close();
        ecoplat_json_erro("Administrador nao encontrado.");
    }
    $stmt->close();
}

function ecoplat_garantir_dados_listagem(mysqli $conn): void
{
    ecoplat_garantir_schema_sessao($conn);
}
