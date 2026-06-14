USE ecocoleta;

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
