-- Auditoria por triggers: traducao para PostgreSQL de "Scripts BD.sql" (MySQL).
-- Executado a cada inicializacao do backend (idempotente) por AuditDatabaseConfig.
-- Separador de comandos: ";;" (os corpos das funcoes contem ";").
--
-- Diferencas em relacao ao script MySQL:
--   * @id_funcionario  -> app.id_funcionario, definido pelo backend em cada conexao com o
--     usuario logado (fn_funcionario_sessao). CURRENT_USER() -> current_user.
--   * "<>" -> IS DISTINCT FROM, para registrar tambem trocas de/para NULL.
--   * Valores longos sao cortados em 100 caracteres (tamanho de Valor_anterior/Valor_atual).
--   * Funcionario do script = tabela usuario do sistema (Inativo <- ativo, Admin <- papel; sem CPF).
--   * Produto, Categoria e NotaFiscal seguem o script; Fornecedor, Localizacao e Configuracao
--     foram adicionados no mesmo padrao para manter a trilha que o sistema ja registrava.

CREATE OR REPLACE FUNCTION fn_funcionario_sessao() RETURNS integer
LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.id_funcionario', true), '')::integer
$$;;

CREATE OR REPLACE FUNCTION fn_registra_auditoria(p_tabela varchar, p_campo varchar, p_anterior text,
                                                 p_atual text, p_funcionario integer) RETURNS void
LANGUAGE sql AS $$
    INSERT INTO auditoria (tabela_alterada, campo_alterado, valor_anterior, valor_atual, dta_alteracao,
                           funcionario, usuario_banco)
    VALUES (p_tabela, p_campo, left(COALESCE(p_anterior, 'N/A'), 100), left(COALESCE(p_atual, 'N/A'), 100),
            now(), p_funcionario, current_user)
$$;;

-- Booleano "ativo" do sistema no formato Inativo (0/1) do script.
CREATE OR REPLACE FUNCTION fn_inativo(p_ativo boolean) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN p_ativo IS NULL THEN 'NULL' WHEN p_ativo THEN '0' ELSE '1' END
$$;;

-- ------------------------------------------------------------------ Produto

CREATE OR REPLACE FUNCTION fn_audita_produto() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_funcionario integer := fn_funcionario_sessao();
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM fn_registra_auditoria('Produto', 'NOVO REGISTRO', 'N/A', NEW.nome, v_funcionario);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM fn_registra_auditoria('Produto', 'REGISTRO DELETADO', OLD.nome, 'Excluído', v_funcionario);
        RETURN OLD;
    END IF;

    IF OLD.nome IS DISTINCT FROM NEW.nome THEN
        PERFORM fn_registra_auditoria('Produto', 'Nome', OLD.nome, NEW.nome, v_funcionario);
    END IF;
    IF OLD.modelo IS DISTINCT FROM NEW.modelo THEN
        PERFORM fn_registra_auditoria('Produto', 'Modelo', OLD.modelo, NEW.modelo, v_funcionario);
    END IF;
    IF OLD.qtd IS DISTINCT FROM NEW.qtd THEN
        PERFORM fn_registra_auditoria('Produto', 'Qtd', OLD.qtd::text, NEW.qtd::text, v_funcionario);
    END IF;
    IF OLD.categoria IS DISTINCT FROM NEW.categoria THEN
        PERFORM fn_registra_auditoria('Produto', 'Categoria', OLD.categoria::text, NEW.categoria::text, v_funcionario);
    END IF;
    IF OLD.ativo IS DISTINCT FROM NEW.ativo THEN
        PERFORM fn_registra_auditoria('Produto', 'Inativo', fn_inativo(OLD.ativo), fn_inativo(NEW.ativo), v_funcionario);
    END IF;
    RETURN NEW;
END
$$;;

CREATE OR REPLACE TRIGGER trg_audita_produto AFTER UPDATE ON produto
    FOR EACH ROW EXECUTE FUNCTION fn_audita_produto();;
CREATE OR REPLACE TRIGGER trg_audita_produto_insert AFTER INSERT ON produto
    FOR EACH ROW EXECUTE FUNCTION fn_audita_produto();;
CREATE OR REPLACE TRIGGER trg_audita_produto_delete AFTER DELETE ON produto
    FOR EACH ROW EXECUTE FUNCTION fn_audita_produto();;

-- ------------------------------------------------------------------ Categoria

CREATE OR REPLACE FUNCTION fn_audita_categoria() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_funcionario integer := fn_funcionario_sessao();
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM fn_registra_auditoria('Categoria', 'NOVO REGISTRO', 'N/A', NEW.nome, v_funcionario);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM fn_registra_auditoria('Categoria', 'REGISTRO DELETADO', OLD.nome, 'Excluído', v_funcionario);
        RETURN OLD;
    END IF;

    IF OLD.nome IS DISTINCT FROM NEW.nome THEN
        PERFORM fn_registra_auditoria('Categoria', 'Nome', OLD.nome, NEW.nome, v_funcionario);
    END IF;
    IF OLD.inativo IS DISTINCT FROM NEW.inativo THEN
        PERFORM fn_registra_auditoria('Categoria', 'Inativo', COALESCE(OLD.inativo::text, 'NULL'),
                                      COALESCE(NEW.inativo::text, 'NULL'), v_funcionario);
    END IF;
    RETURN NEW;
END
$$;;

CREATE OR REPLACE TRIGGER trg_audita_categoria_update AFTER UPDATE ON categoria
    FOR EACH ROW EXECUTE FUNCTION fn_audita_categoria();;
CREATE OR REPLACE TRIGGER trg_audita_categoria_insert AFTER INSERT ON categoria
    FOR EACH ROW EXECUTE FUNCTION fn_audita_categoria();;
CREATE OR REPLACE TRIGGER trg_audita_categoria_delete AFTER DELETE ON categoria
    FOR EACH ROW EXECUTE FUNCTION fn_audita_categoria();;

-- ------------------------------------------------------------------ Funcionario (tabela usuario)

CREATE OR REPLACE FUNCTION fn_audita_funcionario() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_funcionario integer := fn_funcionario_sessao();
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM fn_registra_auditoria('Funcionario', 'NOVO REGISTRO', 'N/A', NEW.nome, v_funcionario);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM fn_registra_auditoria('Funcionario', 'REGISTRO DELETADO', OLD.nome, 'Excluído', v_funcionario);
        RETURN OLD;
    END IF;

    IF OLD.nome IS DISTINCT FROM NEW.nome THEN
        PERFORM fn_registra_auditoria('Funcionario', 'Nome', OLD.nome, NEW.nome, v_funcionario);
    END IF;
    IF OLD.login IS DISTINCT FROM NEW.login THEN
        PERFORM fn_registra_auditoria('Funcionario', 'Login', OLD.login, NEW.login, v_funcionario);
    END IF;
    -- Por seguranca, registra apenas que o hash da senha mudou.
    IF OLD.senha_hash IS DISTINCT FROM NEW.senha_hash THEN
        PERFORM fn_registra_auditoria('Funcionario', 'Senha', '**********', '**********', v_funcionario);
    END IF;
    IF OLD.ativo IS DISTINCT FROM NEW.ativo THEN
        PERFORM fn_registra_auditoria('Funcionario', 'Inativo', fn_inativo(OLD.ativo), fn_inativo(NEW.ativo), v_funcionario);
    END IF;
    IF OLD.papel IS DISTINCT FROM NEW.papel THEN
        PERFORM fn_registra_auditoria('Funcionario', 'Admin', OLD.papel, NEW.papel, v_funcionario);
    END IF;
    RETURN NEW;
END
$$;;

CREATE OR REPLACE TRIGGER trg_audita_funcionario_update AFTER UPDATE ON usuario
    FOR EACH ROW EXECUTE FUNCTION fn_audita_funcionario();;
CREATE OR REPLACE TRIGGER trg_audita_funcionario_insert AFTER INSERT ON usuario
    FOR EACH ROW EXECUTE FUNCTION fn_audita_funcionario();;
CREATE OR REPLACE TRIGGER trg_audita_funcionario_delete AFTER DELETE ON usuario
    FOR EACH ROW EXECUTE FUNCTION fn_audita_funcionario();;

-- ------------------------------------------------------------------ NotaFiscal
-- Funcionario: o usuario logado; na falta dele (alteracao direta no banco), o comprador da nota,
-- como no script original.

CREATE OR REPLACE FUNCTION fn_audita_nota_fiscal() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_funcionario integer := fn_funcionario_sessao();
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM fn_registra_auditoria('NotaFiscal', 'NOVO REGISTRO', 'N/A', NEW.numero_nota,
                                      COALESCE(v_funcionario, NEW.funcionario));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM fn_registra_auditoria('NotaFiscal', 'REGISTRO DELETADO', OLD.numero_nota, 'Excluído',
                                      COALESCE(v_funcionario, OLD.funcionario));
        RETURN OLD;
    END IF;

    v_funcionario := COALESCE(v_funcionario, NEW.funcionario);
    IF OLD.numero_nota IS DISTINCT FROM NEW.numero_nota THEN
        PERFORM fn_registra_auditoria('NotaFiscal', 'NumeroNota', OLD.numero_nota, NEW.numero_nota, v_funcionario);
    END IF;
    IF OLD.local_compra IS DISTINCT FROM NEW.local_compra THEN
        PERFORM fn_registra_auditoria('NotaFiscal', 'LocalCompra', OLD.local_compra, NEW.local_compra, v_funcionario);
    END IF;
    IF OLD.valor IS DISTINCT FROM NEW.valor THEN
        PERFORM fn_registra_auditoria('NotaFiscal', 'Valor', OLD.valor::text, NEW.valor::text, v_funcionario);
    END IF;
    IF OLD.dta_pagamento IS DISTINCT FROM NEW.dta_pagamento THEN
        PERFORM fn_registra_auditoria('NotaFiscal', 'DtaPagamento', OLD.dta_pagamento::text, NEW.dta_pagamento::text, v_funcionario);
    END IF;
    IF OLD.produto IS DISTINCT FROM NEW.produto THEN
        PERFORM fn_registra_auditoria('NotaFiscal', 'Produto', OLD.produto::text, NEW.produto::text, v_funcionario);
    END IF;
    IF OLD.funcionario IS DISTINCT FROM NEW.funcionario THEN
        PERFORM fn_registra_auditoria('NotaFiscal', 'Funcionario', OLD.funcionario::text, NEW.funcionario::text, v_funcionario);
    END IF;
    IF OLD.arquivo_nfe IS DISTINCT FROM NEW.arquivo_nfe THEN
        PERFORM fn_registra_auditoria('NotaFiscal', 'ArquivoNFe',
                                      CASE WHEN OLD.arquivo_nfe IS NULL THEN 'NULL' ELSE '[ANEXO ANTERIOR]' END,
                                      CASE WHEN NEW.arquivo_nfe IS NULL THEN 'NULL' ELSE '[NOVO ANEXO]' END,
                                      v_funcionario);
    END IF;
    RETURN NEW;
END
$$;;

CREATE OR REPLACE TRIGGER trg_audita_notafiscal_update AFTER UPDATE ON nota_fiscal
    FOR EACH ROW EXECUTE FUNCTION fn_audita_nota_fiscal();;
CREATE OR REPLACE TRIGGER trg_audita_notafiscal_insert AFTER INSERT ON nota_fiscal
    FOR EACH ROW EXECUTE FUNCTION fn_audita_nota_fiscal();;
CREATE OR REPLACE TRIGGER trg_audita_notafiscal_delete AFTER DELETE ON nota_fiscal
    FOR EACH ROW EXECUTE FUNCTION fn_audita_nota_fiscal();;

-- ------------------------------------------------------------------ Fornecedor (adicionado)

CREATE OR REPLACE FUNCTION fn_audita_fornecedor() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_funcionario integer := fn_funcionario_sessao();
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM fn_registra_auditoria('Fornecedor', 'NOVO REGISTRO', 'N/A', NEW.nome, v_funcionario);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM fn_registra_auditoria('Fornecedor', 'REGISTRO DELETADO', OLD.nome, 'Excluído', v_funcionario);
        RETURN OLD;
    END IF;

    IF OLD.nome IS DISTINCT FROM NEW.nome THEN
        PERFORM fn_registra_auditoria('Fornecedor', 'Nome', OLD.nome, NEW.nome, v_funcionario);
    END IF;
    IF OLD.documento IS DISTINCT FROM NEW.documento THEN
        PERFORM fn_registra_auditoria('Fornecedor', 'Documento', OLD.documento, NEW.documento, v_funcionario);
    END IF;
    IF OLD.ativo IS DISTINCT FROM NEW.ativo THEN
        PERFORM fn_registra_auditoria('Fornecedor', 'Inativo', fn_inativo(OLD.ativo), fn_inativo(NEW.ativo), v_funcionario);
    END IF;
    RETURN NEW;
END
$$;;

CREATE OR REPLACE TRIGGER trg_audita_fornecedor_update AFTER UPDATE ON fornecedor
    FOR EACH ROW EXECUTE FUNCTION fn_audita_fornecedor();;
CREATE OR REPLACE TRIGGER trg_audita_fornecedor_insert AFTER INSERT ON fornecedor
    FOR EACH ROW EXECUTE FUNCTION fn_audita_fornecedor();;
CREATE OR REPLACE TRIGGER trg_audita_fornecedor_delete AFTER DELETE ON fornecedor
    FOR EACH ROW EXECUTE FUNCTION fn_audita_fornecedor();;

-- ------------------------------------------------------------------ Localizacao (adicionado)

CREATE OR REPLACE FUNCTION fn_audita_localizacao() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_funcionario integer := fn_funcionario_sessao();
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM fn_registra_auditoria('Localizacao', 'NOVO REGISTRO', 'N/A', NEW.codigo || ' · ' || NEW.nome, v_funcionario);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM fn_registra_auditoria('Localizacao', 'REGISTRO DELETADO', OLD.codigo || ' · ' || OLD.nome, 'Excluído', v_funcionario);
        RETURN OLD;
    END IF;

    IF OLD.codigo IS DISTINCT FROM NEW.codigo THEN
        PERFORM fn_registra_auditoria('Localizacao', 'Codigo', OLD.codigo, NEW.codigo, v_funcionario);
    END IF;
    IF OLD.nome IS DISTINCT FROM NEW.nome THEN
        PERFORM fn_registra_auditoria('Localizacao', 'Nome', OLD.nome, NEW.nome, v_funcionario);
    END IF;
    IF OLD.tipo IS DISTINCT FROM NEW.tipo THEN
        PERFORM fn_registra_auditoria('Localizacao', 'Tipo', OLD.tipo, NEW.tipo, v_funcionario);
    END IF;
    IF OLD.ativo IS DISTINCT FROM NEW.ativo THEN
        PERFORM fn_registra_auditoria('Localizacao', 'Inativo', fn_inativo(OLD.ativo), fn_inativo(NEW.ativo), v_funcionario);
    END IF;
    RETURN NEW;
END
$$;;

CREATE OR REPLACE TRIGGER trg_audita_localizacao_update AFTER UPDATE ON localizacao
    FOR EACH ROW EXECUTE FUNCTION fn_audita_localizacao();;
CREATE OR REPLACE TRIGGER trg_audita_localizacao_insert AFTER INSERT ON localizacao
    FOR EACH ROW EXECUTE FUNCTION fn_audita_localizacao();;
CREATE OR REPLACE TRIGGER trg_audita_localizacao_delete AFTER DELETE ON localizacao
    FOR EACH ROW EXECUTE FUNCTION fn_audita_localizacao();;

-- ------------------------------------------------------------------ Configuracao (adicionado)
-- Registro unico criado na instalacao: so alteracoes sao auditadas.

CREATE OR REPLACE FUNCTION fn_audita_configuracao() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_funcionario integer := fn_funcionario_sessao();
BEGIN
    IF OLD.nome_organizacao IS DISTINCT FROM NEW.nome_organizacao THEN
        PERFORM fn_registra_auditoria('Configuracao', 'Nome_organizacao', OLD.nome_organizacao, NEW.nome_organizacao, v_funcionario);
    END IF;
    IF OLD.documento IS DISTINCT FROM NEW.documento THEN
        PERFORM fn_registra_auditoria('Configuracao', 'Documento', OLD.documento, NEW.documento, v_funcionario);
    END IF;
    IF OLD.moeda IS DISTINCT FROM NEW.moeda THEN
        PERFORM fn_registra_auditoria('Configuracao', 'Moeda', OLD.moeda, NEW.moeda, v_funcionario);
    END IF;
    IF OLD.localidade IS DISTINCT FROM NEW.localidade THEN
        PERFORM fn_registra_auditoria('Configuracao', 'Localidade', OLD.localidade, NEW.localidade, v_funcionario);
    END IF;
    IF OLD.fuso_horario IS DISTINCT FROM NEW.fuso_horario THEN
        PERFORM fn_registra_auditoria('Configuracao', 'Fuso_horario', OLD.fuso_horario, NEW.fuso_horario, v_funcionario);
    END IF;
    IF OLD.estoque_minimo_padrao IS DISTINCT FROM NEW.estoque_minimo_padrao THEN
        PERFORM fn_registra_auditoria('Configuracao', 'Estoque_min_padrao', OLD.estoque_minimo_padrao::text,
                                      NEW.estoque_minimo_padrao::text, v_funcionario);
    END IF;
    IF OLD.unidades IS DISTINCT FROM NEW.unidades THEN
        PERFORM fn_registra_auditoria('Configuracao', 'Unidades', OLD.unidades, NEW.unidades, v_funcionario);
    END IF;
    RETURN NEW;
END
$$;;

CREATE OR REPLACE TRIGGER trg_audita_configuracao_update AFTER UPDATE ON configuracao
    FOR EACH ROW EXECUTE FUNCTION fn_audita_configuracao();;
