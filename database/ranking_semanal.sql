
CREATE TABLE IF NOT EXISTS ranking_semana_snapshot (
    id_snapshot INT AUTO_INCREMENT PRIMARY KEY,
    semana_inicio DATE NOT NULL,
    semana_fim DATE NOT NULL,
    id_rua_vencedora INT NOT NULL,
    nome_rua VARCHAR(120) NOT NULL DEFAULT '',
    nome_bairro VARCHAR(120) NOT NULL DEFAULT '',
    pontos_totais INT NOT NULL DEFAULT 0,
    kg_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
    bonificacao_processada TINYINT(1) NOT NULL DEFAULT 0,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ranking_semana_inicio (semana_inicio),
    KEY idx_ranking_snapshot_rua (id_rua_vencedora)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ranking_bonificacao_usuario (
    id_bonificacao INT AUTO_INCREMENT PRIMARY KEY,
    semana_inicio DATE NOT NULL,
    id_usuario INT NOT NULL,
    id_rua INT NOT NULL,
    pontos_bonus INT NOT NULL DEFAULT 100,
    id_entrega_bonus INT NULL DEFAULT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ranking_bonus_semana_usuario (semana_inicio, id_usuario),
    KEY idx_ranking_bonus_usuario (id_usuario),
    CONSTRAINT fk_ranking_bonus_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ranking_controle (
    chave VARCHAR(64) NOT NULL PRIMARY KEY,
    valor VARCHAR(255) NOT NULL,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ranking_card_publico (
    semana_inicio DATE NOT NULL PRIMARY KEY,
    semana_fim DATE NOT NULL,
    total_kg DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_pontos INT NOT NULL DEFAULT 0,
    total_ruas INT NOT NULL DEFAULT 0,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ranking_card_usuario (
    id_card INT AUTO_INCREMENT PRIMARY KEY,
    semana_inicio DATE NOT NULL,
    id_usuario INT NOT NULL,
    id_rua INT NOT NULL DEFAULT 0,
    nome_rua VARCHAR(120) NOT NULL DEFAULT '',
    kg_pessoal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    kg_rua_semana DECIMAL(10, 2) NOT NULL DEFAULT 0,
    pontos_rua_semana INT NOT NULL DEFAULT 0,
    posicao_rua INT NOT NULL DEFAULT 0,
    total_ruas_ranking INT NOT NULL DEFAULT 0,
    kg_meta_mensal DECIMAL(10, 2) NOT NULL DEFAULT 1200,
    kg_mes_atual DECIMAL(10, 2) NOT NULL DEFAULT 0,
    percentual_meta INT NOT NULL DEFAULT 0,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ranking_card_usuario_semana (semana_inicio, id_usuario),
    KEY idx_ranking_card_usuario (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
