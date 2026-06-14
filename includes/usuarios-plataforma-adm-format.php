<?php

const ECOPLAT_ADMIN_ID_OFFSET = 900000;

function ecoplat_admin_id_virtual(int $idAdmin): int
{
    return ECOPLAT_ADMIN_ID_OFFSET + $idAdmin;
}

function ecoplat_parse_id_usuario_lista(int $idLista): array
{
    if ($idLista >= ECOPLAT_ADMIN_ID_OFFSET) {
        return ["kind" => "plataforma", "id" => $idLista - ECOPLAT_ADMIN_ID_OFFSET];
    }
    return ["kind" => "usuario", "id" => $idLista];
}

function ecoplat_usuario_tem_coluna_status(mysqli $conn): bool
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $res = @$conn->query("SHOW COLUMNS FROM usuario LIKE 'status_conta'");
    $cache = $res && $res->num_rows > 0;
    if ($res) {
        $res->free();
    }
    return $cache;
}

function ecoplat_tipo_ui(string $tipoRaw): string
{
    $t = strtolower(trim($tipoRaw));
    if ($t === "admin") {
        return "admin";
    }
    return "usuario";
}

function ecoplat_label_tipo(string $tipoUi): string
{
    return $tipoUi === "admin" ? "Admin" : "Usuário";
}

function ecoplat_tipo_db_from_ui(string $tipoUi, string $tipoAtualDb = ""): string
{
    if ($tipoUi === "admin") {
        return "admin";
    }
    $atual = strtolower(trim($tipoAtualDb));
    if ($atual === "cooperativa") {
        return "cooperativa";
    }
    return "morador";
}

function ecoplat_formatar_usuario_item(array $row): array
{
    $tipoUi = ecoplat_tipo_ui((string) ($row["tipo"] ?? $row["tipo_usuario"] ?? "morador"));
    $status = strtolower(trim((string) ($row["status"] ?? "ativo")));
    if (!in_array($status, ["ativo", "inativo"], true)) {
        $status = "ativo";
    }

    return [
        "id_usuario" => (int) ($row["id_usuario"] ?? 0),
        "nome" => (string) ($row["nome"] ?? "—"),
        "email" => (string) ($row["email"] ?? "—"),
        "tipo" => $tipoUi,
        "tipo_label" => ecoplat_label_tipo($tipoUi),
        "status" => $status,
        "status_label" => $status === "ativo" ? "Ativo" : "Inativo",
        "origem" => (string) ($row["origem"] ?? "usuario"),
    ];
}

function ecoplat_resumo_usuarios(array $lista): array
{
    $admins = 0;
    $ativos = 0;

    foreach ($lista as $item) {
        if (($item["tipo"] ?? "") === "admin") {
            $admins++;
        }
        if (($item["status"] ?? "") === "ativo") {
            $ativos++;
        }
    }

    return [
        "total" => count($lista),
        "administradores" => $admins,
        "ativos" => $ativos,
    ];
}

function ecoplat_buscar_usuario_formatado(mysqli $conn, int $idLista): ?array
{
    $parsed = ecoplat_parse_id_usuario_lista($idLista);

    if ($parsed["kind"] === "plataforma") {
        $tbl = @$conn->query("SHOW TABLES LIKE 'administrador_plataforma'");
        if (!$tbl || $tbl->num_rows === 0) {
            if ($tbl) {
                $tbl->free();
            }
            return null;
        }
        $tbl->free();

        $stmt = $conn->prepare(
            "SELECT id_admin, nome, email, status FROM administrador_plataforma WHERE id_admin = ? LIMIT 1"
        );
        if (!$stmt) {
            return null;
        }
        $idAdmin = $parsed["id"];
        $stmt->bind_param("i", $idAdmin);
        $stmt->execute();
        $row = ecocoleta_stmt_fetch_assoc($stmt);
        $stmt->close();
        if ($row === null) {
            return null;
        }

        return ecoplat_formatar_usuario_item([
            "id_usuario" => ecoplat_admin_id_virtual((int) $row["id_admin"]),
            "nome" => $row["nome"],
            "email" => $row["email"],
            "tipo" => "admin",
            "status" => $row["status"],
            "origem" => "plataforma",
        ]);
    }

    $temStatus = ecoplat_usuario_tem_coluna_status($conn);
    $cols = "id_usuario, nome, email, tipo_usuario";
    if ($temStatus) {
        $cols .= ", status_conta AS status";
    }

    $stmt = $conn->prepare("SELECT {$cols} FROM usuario WHERE id_usuario = ? LIMIT 1");
    if (!$stmt) {
        return null;
    }
    $idUsuario = $parsed["id"];
    $stmt->bind_param("i", $idUsuario);
    $stmt->execute();
    $row = ecocoleta_stmt_fetch_assoc($stmt);
    $stmt->close();
    if ($row === null) {
        return null;
    }

    return ecoplat_formatar_usuario_item([
        "id_usuario" => (int) $row["id_usuario"],
        "nome" => $row["nome"],
        "email" => $row["email"],
        "tipo" => $row["tipo_usuario"] ?? "morador",
        "status" => $temStatus ? ($row["status"] ?? "ativo") : "ativo",
        "origem" => "usuario",
    ]);
}
