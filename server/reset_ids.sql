-- =========================================================
-- CRM AVELLOZ - Reiniciar contadores de ID (após zerar os dados)
-- =========================================================
-- Execute este script no SQL Editor do Supabase
-- (Project > SQL Editor > New query).
--
-- Faz com que o próximo registro criado em cada tabela
-- comece novamente em id = 1.
-- Só funciona corretamente se as tabelas já estiverem vazias.

ALTER TABLE vendedores ALTER COLUMN id RESTART WITH 1;
ALTER TABLE clientes ALTER COLUMN id RESTART WITH 1;
ALTER TABLE motos ALTER COLUMN id RESTART WITH 1;
ALTER TABLE vendas ALTER COLUMN id RESTART WITH 1;
ALTER TABLE agenda ALTER COLUMN id RESTART WITH 1;
ALTER TABLE simulacoes_financiamento ALTER COLUMN id RESTART WITH 1;
ALTER TABLE simulacoes_consorcio ALTER COLUMN id RESTART WITH 1;
