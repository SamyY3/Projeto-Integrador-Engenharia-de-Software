CREATE DATABASE IF NOT EXISTS ecocoleta
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE ecocoleta;

SET NAMES utf8mb4;
SET default_storage_engine = InnoDB;

CREATE TABLE IF NOT EXISTS bairro (
    id_bairro INT AUTO_INCREMENT PRIMARY KEY,
    nome_bairro VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rua (
    id_rua INT AUTO_INCREMENT PRIMARY KEY,
    nome_rua VARCHAR(100) NOT NULL,
    id_bairro INT,
    FOREIGN KEY (id_bairro) REFERENCES bairro(id_bairro)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
    tipo_usuario ENUM('admin', 'morador', 'cooperativa') NOT NULL,
    id_rua INT,
    codigo_recuperacao_hash VARCHAR(255) NULL,
    codigo_recuperacao_expira DATETIME NULL,
    reset_token VARCHAR(64) NULL,
    reset_token_expira DATETIME NULL,
    foto_perfil VARCHAR(500) NULL DEFAULT NULL,
    numero VARCHAR(30) NULL DEFAULT NULL,
    cidade VARCHAR(120) NULL DEFAULT NULL,
    complemento VARCHAR(200) NULL DEFAULT NULL,
    UNIQUE KEY uq_usuario_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ponto_entrega (
    id_pev INT AUTO_INCREMENT PRIMARY KEY,
    nome_ponto VARCHAR(100) NOT NULL,
    endereco VARCHAR(255) NOT NULL,
    id_bairro INT,
    FOREIGN KEY (id_bairro) REFERENCES bairro(id_bairro)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS material (
    id_material INT AUTO_INCREMENT PRIMARY KEY,
    descricao VARCHAR(100),
    tipo_material VARCHAR(50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entrega (
    id_entrega INT AUTO_INCREMENT PRIMARY KEY,
    data_entrega DATETIME DEFAULT CURRENT_TIMESTAMP,
    peso_total DECIMAL(10,2),
    pontos_gerados INT,
    id_usuario INT,
    id_pev INT,
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
    FOREIGN KEY (id_pev) REFERENCES ponto_entrega(id_pev)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_entrega (
    id_item_entrega INT AUTO_INCREMENT PRIMARY KEY,
    quantidade INT,
    peso DECIMAL(10,2),
    id_entrega INT,
    id_material INT,
    FOREIGN KEY (id_entrega) REFERENCES entrega(id_entrega),
    FOREIGN KEY (id_material) REFERENCES material(id_material)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parceiro (
    id_parceiro INT AUTO_INCREMENT PRIMARY KEY,
    nome_parceiro VARCHAR(100) NOT NULL,
    endereco VARCHAR(255),
    tipo_estabelecimento VARCHAR(50),
    id_bairro INT,
    FOREIGN KEY (id_bairro) REFERENCES bairro(id_bairro)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS beneficio (
    id_beneficio INT AUTO_INCREMENT PRIMARY KEY,
    nome_beneficio VARCHAR(100),
    pontos_necessarios INT,
    codigo_cupom VARCHAR(40) NULL DEFAULT NULL,
    id_parceiro INT,
    FOREIGN KEY (id_parceiro) REFERENCES parceiro(id_parceiro)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coleta (
    id_coleta INT AUTO_INCREMENT PRIMARY KEY,
    data_coleta DATETIME,
    quantidade_total DECIMAL(10,2),
    id_cooperativa INT,
    id_bairro INT,
    FOREIGN KEY (id_cooperativa) REFERENCES usuario(id_usuario),
    FOREIGN KEY (id_bairro) REFERENCES bairro(id_bairro)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resgate (
    id_resgate INT AUTO_INCREMENT PRIMARY KEY,
    data_resgate DATETIME DEFAULT CURRENT_TIMESTAMP,
    pontos_utilizados INT,
    id_usuario INT,
    id_beneficio INT,
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
    FOREIGN KEY (id_beneficio) REFERENCES beneficio(id_beneficio),
    UNIQUE KEY uq_resgate_usuario_beneficio (id_usuario, id_beneficio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agendamento_coleta_morador (
  id_agendamento INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  data_coleta DATE NOT NULL,
  slot_ordem TINYINT UNSIGNED NOT NULL,
  status_coleta ENUM('confirmado','andamento','concluida') NOT NULL DEFAULT 'confirmado',
  tipo_coleta ENUM('caminhao','prefeitura') NOT NULL DEFAULT 'caminhao',
  responsavel VARCHAR(80) NULL DEFAULT NULL,
  id_pev INT NULL DEFAULT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuario_data_slot (id_usuario, data_coleta, slot_ordem),
  KEY idx_intervalo (id_usuario, data_coleta),
  CONSTRAINT fk_agendamento_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notificacao (
  id_notificacao INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  tipo VARCHAR(32) NOT NULL DEFAULT 'sistema',
  prioridade ENUM('normal', 'importante') NOT NULL DEFAULT 'normal',
  titulo VARCHAR(160) NOT NULL,
  mensagem TEXT NOT NULL,
  icone VARCHAR(16) NULL,
  badge_texto VARCHAR(32) NULL,
  ref_tipo VARCHAR(32) NULL,
  ref_id INT NULL,
  lida TINYINT(1) NOT NULL DEFAULT 0,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lida_em DATETIME NULL,
  KEY idx_usuario_lista (id_usuario, lida, criado_em),
  UNIQUE KEY uq_usuario_ref (id_usuario, ref_tipo, ref_id),
  CONSTRAINT fk_notificacao_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cadastro_pendente (
  id_cadastro_pendente INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  codigo_hash VARCHAR(255) NOT NULL,
  codigo_expira DATETIME NOT NULL,
  tentativas TINYINT UNSIGNED NOT NULL DEFAULT 0,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cadastro_pendente_email (email),
  KEY idx_cadastro_pendente_expira (codigo_expira)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

INSERT IGNORE INTO parceiro (id_parceiro, nome_parceiro, endereco, tipo_estabelecimento, id_bairro)
VALUES (1, 'Rede de Parceiros EcoColeta', NULL, 'Premios digitais', NULL);

INSERT INTO beneficio (id_beneficio, nome_beneficio, pontos_necessarios, codigo_cupom, id_parceiro) VALUES
(1, 'PowerFit Club - 15%', 347, 'ECO100OFF', 1),
(2, 'IronFlex - 30%', 289, 'IRON30', 1),
(3, 'MoveUp Gym - 20%', 412, 'MOVEUP20', 1),
(4, 'Pao Nobre - 15%', 150, 'PANOBRE15', 1),
(5, 'Forno Dourado - 20%', 200, 'DOURADO20', 1),
(6, 'Trigo e Sabor - 10%', 100, 'TRIGO10', 1),
(7, 'VitaNex - 10%', 120, 'VITANEX10', 1),
(8, 'PharmaLeaf - 20%', 220, 'PHARMALEAF20', 1),
(9, 'SaudePrime - 25%', 280, 'SAUDEPRIME25', 1),
(10, 'MaxCompra - 10%', 130, 'MAXCOMPRA10', 1),
(11, 'MercaPlus - 30%', 320, 'MERCAPLUS30', 1),
(12, 'BomPreco - 20%', 210, 'BOMPRECO20', 1),
(13, 'Sabor da Vila - 15%', 180, 'VILA15', 1),
(14, 'Essencia Gourmet - 10%', 110, 'ESSENCIA10', 1),
(15, 'Bistro Raiz - 10%', 105, 'RAIZ10', 1),
(16, 'GlowBella - 10%', 125, 'GLOW10', 1),
(17, 'MakeLuxe - 15%', 170, 'LUXE15', 1),
(18, 'BeautyCharm - 20%', 240, 'CHARM20', 1),
(19, 'EcoStyle - 18%', 230, 'ECOSTYLE18', 1),
(20, 'VerdeVibe - 25%', 260, 'VERDEVIBE25', 1)
ON DUPLICATE KEY UPDATE
  nome_beneficio = VALUES(nome_beneficio),
  pontos_necessarios = VALUES(pontos_necessarios),
  codigo_cupom = VALUES(codigo_cupom),
  id_parceiro = VALUES(id_parceiro);
