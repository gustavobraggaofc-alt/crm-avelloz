-- =========================================================
-- CRM AVELLOZ - Migração: rastrear login/atividade dos vendedores
-- =========================================================
-- Execute este script no SQL Editor do Supabase
-- (Project > SQL Editor > New query).
--
-- ultimo_login  = data/hora do último login bem-sucedido (nunca muda
--                 fora do POST /api/login).
-- ultimo_acesso = data/hora da última requisição autenticada feita
--                 pelo usuário; usado para calcular "está online agora"
--                 (ultimo_acesso dentro dos últimos minutos).

ALTER TABLE vendedores ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMPTZ;
ALTER TABLE vendedores ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMPTZ;
