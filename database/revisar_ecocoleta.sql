USE ecocoleta;

SET @db := DATABASE();

SET @tem_codigo_cupom := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'beneficio' AND COLUMN_NAME = 'codigo_cupom'
);
SET @sql_codigo := IF(
  @tem_codigo_cupom = 0,
  'ALTER TABLE beneficio ADD COLUMN codigo_cupom VARCHAR(40) NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt_codigo FROM @sql_codigo;
EXECUTE stmt_codigo;
DEALLOCATE PREPARE stmt_codigo;

SET @tem_foto := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'usuario' AND COLUMN_NAME = 'foto_perfil'
);
SET @sql_foto := IF(
  @tem_foto = 0,
  'ALTER TABLE usuario ADD COLUMN foto_perfil VARCHAR(500) NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt_foto FROM @sql_foto;
EXECUTE stmt_foto;
DEALLOCATE PREPARE stmt_foto;

SET @tem_numero := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'usuario' AND COLUMN_NAME = 'numero'
);
SET @sql_numero := IF(
  @tem_numero = 0,
  'ALTER TABLE usuario ADD COLUMN numero VARCHAR(30) NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt_numero FROM @sql_numero;
EXECUTE stmt_numero;
DEALLOCATE PREPARE stmt_numero;

SET @tem_cidade := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'usuario' AND COLUMN_NAME = 'cidade'
);
SET @sql_cidade := IF(
  @tem_cidade = 0,
  'ALTER TABLE usuario ADD COLUMN cidade VARCHAR(120) NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt_cidade FROM @sql_cidade;
EXECUTE stmt_cidade;
DEALLOCATE PREPARE stmt_cidade;

SET @tem_compl := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'usuario' AND COLUMN_NAME = 'complemento'
);
SET @sql_compl := IF(
  @tem_compl = 0,
  'ALTER TABLE usuario ADD COLUMN complemento VARCHAR(200) NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt_compl FROM @sql_compl;
EXECUTE stmt_compl;
DEALLOCATE PREPARE stmt_compl;

SET @tem_status_ag := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'agendamento_coleta_morador' AND COLUMN_NAME = 'status_coleta'
);
SET @sql_status_ag := IF(
  @tem_status_ag = 0,
  'ALTER TABLE agendamento_coleta_morador ADD COLUMN status_coleta ENUM(''confirmado'',''andamento'',''concluida'') NOT NULL DEFAULT ''confirmado'' AFTER slot_ordem',
  'SELECT 1'
);
PREPARE stmt_status_ag FROM @sql_status_ag;
EXECUTE stmt_status_ag;
DEALLOCATE PREPARE stmt_status_ag;

SET @tem_tipo_ag := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'agendamento_coleta_morador' AND COLUMN_NAME = 'tipo_coleta'
);
SET @sql_tipo_ag := IF(
  @tem_tipo_ag = 0,
  'ALTER TABLE agendamento_coleta_morador ADD COLUMN tipo_coleta ENUM(''caminhao'',''prefeitura'') NOT NULL DEFAULT ''caminhao'' AFTER status_coleta',
  'SELECT 1'
);
PREPARE stmt_tipo_ag FROM @sql_tipo_ag;
EXECUTE stmt_tipo_ag;
DEALLOCATE PREPARE stmt_tipo_ag;

SET @tem_resp_ag := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'agendamento_coleta_morador' AND COLUMN_NAME = 'responsavel'
);
SET @sql_resp_ag := IF(
  @tem_resp_ag = 0,
  'ALTER TABLE agendamento_coleta_morador ADD COLUMN responsavel VARCHAR(80) NULL DEFAULT NULL AFTER tipo_coleta',
  'SELECT 1'
);
PREPARE stmt_resp_ag FROM @sql_resp_ag;
EXECUTE stmt_resp_ag;
DEALLOCATE PREPARE stmt_resp_ag;

SET @tem_pev_ag := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'agendamento_coleta_morador' AND COLUMN_NAME = 'id_pev'
);
SET @sql_pev_ag := IF(
  @tem_pev_ag = 0,
  'ALTER TABLE agendamento_coleta_morador ADD COLUMN id_pev INT NULL DEFAULT NULL AFTER responsavel',
  'SELECT 1'
);
PREPARE stmt_pev_ag FROM @sql_pev_ag;
EXECUTE stmt_pev_ag;
DEALLOCATE PREPARE stmt_pev_ag;

ALTER TABLE usuario ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS administrador_ecoponto (
    id_admin INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    nome_ecoponto VARCHAR(160) NOT NULL DEFAULT 'EcoPonto parceiro',
    id_pev INT NULL DEFAULT NULL,
    foto_perfil VARCHAR(255) NULL DEFAULT NULL,
    preferencias_json MEDIUMTEXT NULL DEFAULT NULL,
    status ENUM('ativo', 'inativo') NOT NULL DEFAULT 'ativo',
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultimo_login DATETIME NULL,
    UNIQUE KEY uq_admin_ecoponto_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
