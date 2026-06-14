USE ecocoleta;

ALTER TABLE usuario ENGINE=InnoDB;

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
