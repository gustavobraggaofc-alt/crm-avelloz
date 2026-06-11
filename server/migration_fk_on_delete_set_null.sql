-- =========================================================
-- CRM AVELLOZ - Migração: permitir excluir clientes/vendedores/motos
-- mesmo quando já existem vendas/agenda/simulações vinculadas.
-- =========================================================
-- Execute este script no SQL Editor do Supabase
-- (Project > SQL Editor > New query).
--
-- Sem isso, o Postgres bloqueia a exclusão com o erro:
-- "update or delete on table ... violates foreign key constraint ..."
-- e a API responde 500.
--
-- Com ON DELETE SET NULL, o registro de venda/agenda/simulação
-- é mantido (com os dados textuais já salvos), apenas a referência
-- (cliente_id / vendedor_id / moto_id) fica nula.

ALTER TABLE vendas DROP CONSTRAINT vendas_cliente_id_fkey;
ALTER TABLE vendas ADD CONSTRAINT vendas_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;

ALTER TABLE vendas DROP CONSTRAINT vendas_vendedor_id_fkey;
ALTER TABLE vendas ADD CONSTRAINT vendas_vendedor_id_fkey
  FOREIGN KEY (vendedor_id) REFERENCES vendedores(id) ON DELETE SET NULL;

ALTER TABLE vendas DROP CONSTRAINT vendas_moto_id_fkey;
ALTER TABLE vendas ADD CONSTRAINT vendas_moto_id_fkey
  FOREIGN KEY (moto_id) REFERENCES motos(id) ON DELETE SET NULL;

ALTER TABLE agenda DROP CONSTRAINT agenda_vendedor_id_fkey;
ALTER TABLE agenda ADD CONSTRAINT agenda_vendedor_id_fkey
  FOREIGN KEY (vendedor_id) REFERENCES vendedores(id) ON DELETE SET NULL;

ALTER TABLE simulacoes_financiamento DROP CONSTRAINT simulacoes_financiamento_vendedor_id_fkey;
ALTER TABLE simulacoes_financiamento ADD CONSTRAINT simulacoes_financiamento_vendedor_id_fkey
  FOREIGN KEY (vendedor_id) REFERENCES vendedores(id) ON DELETE SET NULL;

ALTER TABLE simulacoes_consorcio DROP CONSTRAINT simulacoes_consorcio_vendedor_id_fkey;
ALTER TABLE simulacoes_consorcio ADD CONSTRAINT simulacoes_consorcio_vendedor_id_fkey
  FOREIGN KEY (vendedor_id) REFERENCES vendedores(id) ON DELETE SET NULL;
