
USE ecocoleta;

CREATE TABLE bairro (
    id_bairro INT AUTO_INCREMENT PRIMARY KEY,
    nome_bairro VARCHAR(100) NOT NULL
);

CREATE TABLE rua (
    id_rua INT AUTO_INCREMENT PRIMARY KEY,
    nome_rua VARCHAR(100) NOT NULL,
    id_bairro INT,
    FOREIGN KEY (id_bairro) REFERENCES bairro(id_bairro)
);

CREATE TABLE usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
    tipo_usuario ENUM('admin', 'morador', 'cooperativa') NOT NULL,
    id_rua INT,
    codigo_recuperacao_hash VARCHAR(255) NULL,
    codigo_recuperacao_expira DATETIME NULL,
    reset_token VARCHAR(64) NULL,
    reset_token_expira DATETIME NULL
);

CREATE TABLE ponto_entrega (
    id_pev INT AUTO_INCREMENT PRIMARY KEY,
    nome_ponto VARCHAR(100) NOT NULL,
    endereco VARCHAR(255) NOT NULL,
    id_bairro INT,
    FOREIGN KEY (id_bairro) REFERENCES bairro(id_bairro)
);

CREATE TABLE material (
    id_material INT AUTO_INCREMENT PRIMARY KEY,
    descricao VARCHAR(100),
    tipo_material VARCHAR(50)
);

CREATE TABLE entrega (
    id_entrega INT AUTO_INCREMENT PRIMARY KEY,
    data_entrega DATETIME DEFAULT CURRENT_TIMESTAMP,
    peso_total DECIMAL(10,2),
    pontos_gerados INT,
    id_usuario INT,
    id_pev INT,
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
    FOREIGN KEY (id_pev) REFERENCES ponto_entrega(id_pev)
);

CREATE TABLE item_entrega (
    id_item_entrega INT AUTO_INCREMENT PRIMARY KEY,
    quantidade INT,
    peso DECIMAL(10,2),
    id_entrega INT,
    id_material INT,
    FOREIGN KEY (id_entrega) REFERENCES entrega(id_entrega),
    FOREIGN KEY (id_material) REFERENCES material(id_material)
);

CREATE TABLE parceiro (
    id_parceiro INT AUTO_INCREMENT PRIMARY KEY,
    nome_parceiro VARCHAR(100) NOT NULL,
    endereco VARCHAR(255),
    tipo_estabelecimento VARCHAR(50),
    id_bairro INT,
    FOREIGN KEY (id_bairro) REFERENCES bairro(id_bairro)
);

CREATE TABLE beneficio (
    id_beneficio INT AUTO_INCREMENT PRIMARY KEY,
    nome_beneficio VARCHAR(100),
    pontos_necessarios INT,
    codigo_cupom VARCHAR(40) NULL DEFAULT NULL,
    id_parceiro INT,
    FOREIGN KEY (id_parceiro) REFERENCES parceiro(id_parceiro)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE coleta (
    id_coleta INT AUTO_INCREMENT PRIMARY KEY,
    data_coleta DATETIME,
    quantidade_total DECIMAL(10,2),
    id_cooperativa INT,
    id_bairro INT,
    FOREIGN KEY (id_cooperativa) REFERENCES usuario(id_usuario),
    FOREIGN KEY (id_bairro) REFERENCES bairro(id_bairro)
);

CREATE TABLE resgate (
    id_resgate INT AUTO_INCREMENT PRIMARY KEY,
    data_resgate DATETIME DEFAULT CURRENT_TIMESTAMP,
    pontos_utilizados INT,
    id_usuario INT,
    id_beneficio INT,
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
    FOREIGN KEY (id_beneficio) REFERENCES beneficio(id_beneficio)
);