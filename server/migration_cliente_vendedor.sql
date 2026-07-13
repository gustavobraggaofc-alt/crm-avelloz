-- =========================================================
-- CRM AVELLOZ - Migração: registrar qual vendedor cadastrou cada cliente
-- =========================================================
-- Execute este script no SQL Editor do Supabase
-- (Project > SQL Editor > New query).

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS vendedor_id BIGINT REFERENCES vendedores(id) ON DELETE SET NULL;

-- ---------------------------------------------------------
-- Backfill (opcional, best-effort) para clientes já existentes
-- ---------------------------------------------------------
-- O sistema nunca registrou quem cadastrou cada cliente, então não há
-- como recuperar essa informação com certeza para quem foi cadastrado
-- manualmente (botão "+ Novo Cliente") sem nenhuma venda vinculada.
--
-- Para clientes que entraram no sistema através do fluxo de venda
-- (cadastro automático ao registrar uma venda), é possível inferir o
-- vendedor pela venda mais antiga vinculada a esse cliente. É uma
-- estimativa (o vendedor de uma venda é escolhido manualmente no
-- formulário e pode não ser exatamente quem preencheu o cadastro),
-- não uma garantia — mas é o melhor dado disponível.
--
-- Só preenche onde vendedor_id ainda está nulo; não sobrescreve nada.

UPDATE clientes c
SET vendedor_id = sub.vendedor_id
FROM (
  SELECT DISTINCT ON (v.cliente_id) v.cliente_id, v.vendedor_id
  FROM vendas v
  WHERE v.cliente_id IS NOT NULL AND v.vendedor_id IS NOT NULL
  ORDER BY v.cliente_id, to_date(v.data, 'DD/MM/YYYY') ASC, v.id ASC
) sub
WHERE c.id = sub.cliente_id AND c.vendedor_id IS NULL;
