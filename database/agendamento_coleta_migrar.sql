USE ecocoleta;

ALTER TABLE agendamento_coleta_morador
  ADD COLUMN status_coleta ENUM('confirmado','andamento','concluida') NOT NULL DEFAULT 'confirmado' AFTER slot_ordem;

ALTER TABLE agendamento_coleta_morador
  ADD COLUMN tipo_coleta ENUM('caminhao','prefeitura') NOT NULL DEFAULT 'caminhao' AFTER status_coleta;

ALTER TABLE agendamento_coleta_morador
  ADD COLUMN responsavel VARCHAR(80) NULL DEFAULT NULL AFTER tipo_coleta;

ALTER TABLE agendamento_coleta_morador
  ADD COLUMN id_pev INT NULL DEFAULT NULL AFTER responsavel;
