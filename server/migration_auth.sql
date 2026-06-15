-- =========================================================
-- CRM AVELLOZ - Migração: autenticação (login por vendedor)
-- =========================================================
-- Execute este script no SQL Editor do Supabase
-- (Project > SQL Editor > New query).
--
-- Adiciona colunas de senha (hash) e perfil de acesso à tabela
-- de vendedores, garante e-mails únicos, e cria a conta de
-- administrador inicial. Este script é idempotente: pode ser
-- executado mais de uma vez sem erro.

ALTER TABLE vendedores ADD COLUMN IF NOT EXISTS senha_hash TEXT;
ALTER TABLE vendedores ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'vendedor';

-- Garante e-mails únicos (a coluna já pode ter essa restrição
-- vinda do schema original; ignora o erro se já existir).
DO $$
BEGIN
  ALTER TABLE vendedores ADD CONSTRAINT vendedores_email_key UNIQUE (email);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Conta de administrador: crmavelloz@gmail.com / Avelloz2026@
-- (a senha já está armazenada como hash bcrypt, nunca em texto puro)
INSERT INTO vendedores (nome, email, role, senha_hash, telefone, meta, comissao, vendas_mes, motos_vendidas)
VALUES (
  'Admin',
  'crmavelloz@gmail.com',
  'admin',
  '$2b$10$yNlaEELiu4ekzL1NB.x9Ue2tIT5kSkaPHP09dOr91KzJOVLZfYsqO',
  '',
  0,
  0,
  0,
  0
)
ON CONFLICT (email) DO UPDATE SET
  role = EXCLUDED.role,
  senha_hash = EXCLUDED.senha_hash;
