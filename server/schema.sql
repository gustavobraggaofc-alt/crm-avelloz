-- =========================================================
-- CRM AVELLOZ - Esquema do banco de dados (PostgreSQL / Supabase)
-- =========================================================
-- Execute este script no SQL Editor do Supabase
-- (Project > SQL Editor > New query) antes de usar o sistema.

CREATE TABLE IF NOT EXISTS vendedores (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT,
  role TEXT NOT NULL DEFAULT 'vendedor',
  telefone TEXT,
  meta DOUBLE PRECISION DEFAULT 0,
  comissao DOUBLE PRECISION DEFAULT 0,
  vendas_mes DOUBLE PRECISION DEFAULT 0,
  motos_vendidas INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS clientes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  cpf TEXT,
  ultima_compra TEXT,
  motos_compradas INTEGER DEFAULT 0,
  vendedor_id BIGINT REFERENCES vendedores(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS motos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  modelo TEXT NOT NULL,
  marca TEXT NOT NULL,
  ano INTEGER,
  cor TEXT,
  valor DOUBLE PRECISION DEFAULT 0,
  quantidade INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Disponível'
);

CREATE TABLE IF NOT EXISTS vendas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id BIGINT REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT,
  cliente_cpf TEXT,
  vendedor_id BIGINT REFERENCES vendedores(id) ON DELETE SET NULL,
  moto_id BIGINT REFERENCES motos(id) ON DELETE SET NULL,
  moto_descricao TEXT,
  valor DOUBLE PRECISION DEFAULT 0,
  forma_pagamento TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'Concluída',
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agenda (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  data TEXT NOT NULL,
  hora TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  vendedor_id BIGINT REFERENCES vendedores(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Pendente'
);

CREATE TABLE IF NOT EXISTS simulacoes_financiamento (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendedor_id BIGINT REFERENCES vendedores(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  valor_veiculo DOUBLE PRECISION,
  entrada DOUBLE PRECISION,
  parcelas INTEGER,
  taxa_juros DOUBLE PRECISION,
  valor_parcela DOUBLE PRECISION,
  total_pagar DOUBLE PRECISION,
  total_juros DOUBLE PRECISION,
  antecipou_parcelas INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS simulacoes_consorcio (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendedor_id BIGINT REFERENCES vendedores(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  valor_carta DOUBLE PRECISION,
  prazo INTEGER,
  taxa_administracao DOUBLE PRECISION,
  fundo_reserva DOUBLE PRECISION,
  valor_parcela DOUBLE PRECISION,
  total_pagar DOUBLE PRECISION,
  criado_em TIMESTAMPTZ DEFAULT now()
);
