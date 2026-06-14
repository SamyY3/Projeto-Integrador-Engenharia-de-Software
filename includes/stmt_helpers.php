<?php

if (!function_exists("ecocoleta_stmt_num_rows")) {
    function ecocoleta_stmt_num_rows(mysqli_stmt $stmt): int {
        if (!$stmt->store_result()) {
            return 0;
        }
        $n = (int) $stmt->num_rows;
        $stmt->free_result();
        return $n;
    }
}

if (!function_exists("ecocoleta_stmt_fetch_one_assoc")) {
    function ecocoleta_stmt_fetch_one_assoc(mysqli_stmt $stmt): ?array {
        $meta = $stmt->result_metadata();
        if (!$meta) {
            return null;
        }
        $row = [];
        $bind = [];
        while ($field = $meta->fetch_field()) {
            $row[$field->name] = null;
            $bind[] = &$row[$field->name];
        }
        if ($bind === []) {
            $meta->free();
            return null;
        }
        call_user_func_array([$stmt, "bind_result"], $bind);
        if (!$stmt->fetch()) {
            $meta->free();
            return null;
        }
        $out = [];
        foreach ($row as $k => $v) {
            $out[$k] = $v;
        }
        $meta->free();
        return $out;
    }
}

if (!function_exists("ecocoleta_stmt_fetch_all_assoc")) {
    function ecocoleta_stmt_fetch_all_assoc(mysqli_stmt $stmt): array {
        $meta = $stmt->result_metadata();
        if (!$meta) {
            return [];
        }
        $row = [];
        $bind = [];
        while ($field = $meta->fetch_field()) {
            $row[$field->name] = null;
            $bind[] = &$row[$field->name];
        }
        if ($bind === []) {
            $meta->free();
            return [];
        }
        call_user_func_array([$stmt, "bind_result"], $bind);
        $rows = [];
        while ($stmt->fetch()) {
            $copy = [];
            foreach ($row as $k => $v) {
                $copy[$k] = $v;
            }
            $rows[] = $copy;
        }
        $meta->free();
        return $rows;
    }
}

if (!function_exists("ecocoleta_usuario_tem_coluna_saldo_ecopoints")) {
    function ecocoleta_usuario_tem_coluna_saldo_ecopoints(mysqli $conn): bool {
        static $cached = null;
        if ($cached !== null) {
            return $cached;
        }
        $q = $conn->query("SHOW COLUMNS FROM usuario LIKE 'saldo_ecopoints'");
        $cached = ($q && $q->num_rows > 0);
        if ($q) {
            $q->free();
        }
        return $cached;
    }
}

if (!function_exists("ecocoleta_obter_saldo_calculado_entrega_resgate")) {
    function ecocoleta_obter_saldo_calculado_entrega_resgate(mysqli $conn, int $uid): int {
        $uid = (int) $uid;
        $sql = "SELECT
      COALESCE((SELECT SUM(pontos_gerados) FROM entrega WHERE id_usuario = ?), 0)
      - COALESCE((SELECT SUM(pontos_utilizados) FROM resgate WHERE id_usuario = ?), 0) AS s";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            return 0;
        }
        $stmt->bind_param("ii", $uid, $uid);
        if (!$stmt->execute()) {
            $stmt->close();
            return 0;
        }
        $s = 0;
        $stmt->bind_result($s);
        if (!$stmt->fetch()) {
            $stmt->close();
            return 0;
        }
        $stmt->close();
        return max(0, (int) $s);
    }
}

if (!function_exists("ecocoleta_obter_saldo_usuario")) {
    function ecocoleta_obter_saldo_usuario(mysqli $conn, int $uid): int {
        $uid = (int) $uid;
        $calculado = ecocoleta_obter_saldo_calculado_entrega_resgate($conn, $uid);

        if (ecocoleta_usuario_tem_coluna_saldo_ecopoints($conn)) {
            $stmt = $conn->prepare("SELECT COALESCE(saldo_ecopoints, 0) AS s FROM usuario WHERE id_usuario = ? LIMIT 1");
            if (!$stmt) {
                return max(0, $calculado);
            }
            $stmt->bind_param("i", $uid);
            if (!$stmt->execute()) {
                $stmt->close();
                return max(0, $calculado);
            }
            $s = 0;
            $stmt->bind_result($s);
            if (!$stmt->fetch()) {
                $stmt->close();
                return max(0, $calculado);
            }
            $stmt->close();
            $col = (int) $s;
            return max(0, max($col, $calculado));
        }

        return max(0, $calculado);
    }
}
