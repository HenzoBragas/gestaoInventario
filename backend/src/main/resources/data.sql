INSERT IGNORE INTO categoria (seq, nome, inativo) VALUES
(1, 'Eletrônicos', 0),
(2, 'Periféricos', 0),
(3, 'Móveis', 0),
(4, 'Armazenamento', 0),
(5, 'Redes', 0),
(6, 'Áudio', 0),
(7, 'Hardware', 0),
(8, 'Wearables', 0),
(9, 'Games', 0),
(10, 'Utilitarios', 0);

INSERT IGNORE INTO produto (seq, id, nome, modelo, categoria, qtd, dta_atualizacao) VALUES
(3, '3', 'Teclado Redragon', 'K552', 2, 30, '2026-04-13 00:00:00'),
(4, '4', 'Monitor LG', '24MK430H', 1, 20, '2026-04-13 00:00:00');