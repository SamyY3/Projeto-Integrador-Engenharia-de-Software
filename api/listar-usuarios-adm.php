<?php
require_once dirname(__DIR__) . '/includes/session-bootstrap.php';
ini_set("display_errors", "0");
error_reporting(0);

ecocoleta_session_start();
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

require_once dirname(__DIR__) . "/includes/conexao.php";
require_once dirname(__DIR__) . "/includes/admin-plataforma-helpers.php";
require_once dirname(__DIR__) . "/includes/admin-plataforma-data.php";
require_once dirname(__DIR__) . "/includes/stmt_helpers.php";
require_once dirname(__DIR__) . "/includes/usuarios-plataforma-adm-format.php";

ecoplat_exigir_sessao();
ecoplat_garantir_schema_sessao($conn);

function ecoplat_listar_usuarios_cadastro(mysqli $conn): array
{
    $lista = [];
    $temStatus = ecoplat_usuario_tem_coluna_status($conn);

    $cols = "id_usuario, nome, email, tipo_usuario";
    if ($temStatus) {
        $cols .= ", status_conta AS status";
    }

    $sql = "SELECT {$cols} FROM usuario ORDER BY nome ASC LIMIT 400";
    $res = @$conn->query($sql);
    if (!$res) {
        return [];
    }

    while ($row = $res->fetch_assoc()) {
        $item = [
            "id_usuario" => (int) ($row["id_usuario"] ?? 0),
            "nome" => (string) ($row["nome"] ?? ""),
            "email" => (string) ($row["email"] ?? ""),
            "tipo" => (string) ($row["tipo_usuario"] ?? "morador"),
            "status" => $temStatus ? (string) ($row["status"] ?? "ativo") : "ativo",
        ];
        $lista[] = ecoplat_formatar_usuario_item($item);
    }
    $res->free();

    $tblPlat = @$conn->query("SHOW TABLES LIKE 'administrador_plataforma'");
    if ($tblPlat && $tblPlat->num_rows > 0) {
        $tblPlat->free();
        $sqlAdm = "SELECT id_admin, nome, email, status FROM administrador_plataforma ORDER BY nome ASC";
        $resAdm = @$conn->query($sqlAdm);
        if ($resAdm) {
            while ($row = $resAdm->fetch_assoc()) {
                $idAdmin = (int) ($row["id_admin"] ?? 0);
                $lista[] = ecoplat_formatar_usuario_item([
                    "id_usuario" => ecoplat_admin_id_virtual($idAdmin),
                    "nome" => (string) ($row["nome"] ?? ""),
                    "email" => (string) ($row["email"] ?? ""),
                    "tipo" => "admin",
                    "status" => (string) ($row["status"] ?? "ativo"),
                    "origem" => "plataforma",
                ]);
            }
            $resAdm->free();
        }
    }

    usort($lista, static function (array $a, array $b): int {
        return strcasecmp((string) ($a["nome"] ?? ""), (string) ($b["nome"] ?? ""));
    });

    return $lista;
}

$lista = ecoplat_listar_usuarios_cadastro($conn);

ecoplat_json_ok([
    "usuarios" => $lista,
    "resumo" => ecoplat_resumo_usuarios($lista),
    "meta" => [
        "fonte" => "banco",
        "total" => count($lista),
    ],
]);
