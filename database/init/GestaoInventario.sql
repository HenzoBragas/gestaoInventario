SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- Banco de dados: `GestaoInventario`

CREATE TABLE `auditoria` (
  `SEQ` int NOT NULL,
  `Tabela_alterada` varchar(30) NOT NULL,
  `Campo_alterado` varchar(20) NOT NULL,
  `Valor_anterior` varchar(100) NOT NULL,
  `Valor_atual` varchar(100) NOT NULL,
  `Dta_alteracao` datetime NOT NULL DEFAULT (now()),
  `Funcionario` int DEFAULT NULL,
  `Usuario_Banco` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `auditoria` (`SEQ`, `Tabela_alterada`, `Campo_alterado`, `Valor_anterior`, `Valor_atual`, `Dta_alteracao`, `Funcionario`, `Usuario_Banco`) VALUES
(1, 'Produto', 'NOVO REGISTRO', 'N/A', 'Notebook Dell', '2026-04-13 19:51:24', NULL, 'root@%');

CREATE TABLE `categoria` (
  `SEQ` int NOT NULL,
  `Nome` varchar(50) NOT NULL,
  `Inativo` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `categoria` (`SEQ`, `Nome`, `Inativo`) VALUES
(1, 'Eletronicos', 0),
(2, 'Perifericos', 0),
(3, 'Moveis', 0),
(4, 'Armazenamento', 0),
(5, 'Redes', 0),
(6, 'Audio', 0),
(7, 'Hardware', 0),
(8, 'Wearables', 0),
(9, 'Games', 0),
(10, 'Utilitarios', 0);

CREATE TABLE `funcionario` (
  `SEQ` int NOT NULL,
  `Nome` varchar(50) NOT NULL,
  `Login` varchar(15) NOT NULL,
  `Senha` varchar(255) NOT NULL,
  `CPF` varchar(11) NOT NULL,
  `Inativo` int DEFAULT NULL,
  `Admin` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `produto` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `SEQ` varchar(20) NOT NULL,
  `Nome` varchar(255) NOT NULL,
  `Modelo` varchar(255) NOT NULL,
  `Categoria` int NOT NULL DEFAULT '1',
  `Qtd` int NOT NULL DEFAULT '0',
  `Dta_atualizacao` date NOT NULL DEFAULT (curdate()),
  `Funcionario` int DEFAULT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


DELIMITER $$
CREATE TRIGGER `trg_Audita_Produto_Insert` AFTER INSERT ON `produto` FOR EACH ROW BEGIN
  INSERT INTO auditoria (
        Tabela_alterada,
        Campo_alterado,
        Valor_anterior,
        Valor_atual,
        Dta_alteracao,
        Funcionario,
        Usuario_Banco
    ) VALUES (
        'Produto',
        'NOVO REGISTRO',
        'N/A',
        NEW.Nome,
        NOW(),
        NEW.Funcionario,
        CURRENT_USER()
    );
END
$$
DELIMITER ;

ALTER TABLE `auditoria`
  ADD PRIMARY KEY (`SEQ`);

ALTER TABLE `categoria`
  ADD PRIMARY KEY (`SEQ`);

ALTER TABLE `funcionario`
  ADD PRIMARY KEY (`SEQ`);

ALTER TABLE `produto`
  ADD KEY `FK_Produto_Categoria` (`Categoria`),
  ADD KEY `FK_Produto_Funcionario` (`Funcionario`);

ALTER TABLE `auditoria`
  MODIFY `SEQ` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

ALTER TABLE `categoria`
  MODIFY `SEQ` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

ALTER TABLE `funcionario`
  MODIFY `SEQ` int NOT NULL AUTO_INCREMENT;

ALTER TABLE `produto`
  MODIFY `Id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

ALTER TABLE `produto`
  ADD CONSTRAINT `FK_Produto_Categoria` FOREIGN KEY (`Categoria`) REFERENCES `categoria` (`SEQ`),
  ADD CONSTRAINT `FK_Produto_Funcionario` FOREIGN KEY (`Funcionario`) REFERENCES `funcionario` (`SEQ`);

COMMIT;
