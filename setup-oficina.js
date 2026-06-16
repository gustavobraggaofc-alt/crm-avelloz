// Run once: node setup-oficina.js
// Creates the oficina_ordens table in Supabase.

require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SQL = `
CREATE TABLE IF NOT EXISTS oficina_ordens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo           TEXT NOT NULL CHECK (tipo IN ('revisao', 'montagem')),
  status         TEXT NOT NULL DEFAULT 'aguardando'
                   CHECK (status IN ('aguardando','em_andamento','concluido','cancelado')),
  cliente_nome   TEXT,
  modelo_moto    TEXT NOT NULL,
  mecanico       TEXT NOT NULL,
  data_entrada   TEXT NOT NULL,
  data_prevista  TEXT,
  data_conclusao TEXT,
  km_entrada     INTEGER,
  servicos       TEXT,
  observacoes    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
`.trim();

async function main() {
  const ref = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!ref) { console.error("SUPABASE_URL inválida."); process.exit(1); }

  console.log("Criando tabela oficina_ordens no projeto:", ref);

  // Tenta via Supabase Management API (requer SUPABASE_ACCESS_TOKEN no .env)
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (token) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: SQL }),
    });
    if (res.ok) {
      console.log("✅ Tabela criada com sucesso via API de gerenciamento!");
      return;
    }
    console.warn("API de gerenciamento retornou", res.status, "— tente via dashboard.");
  }

  // Fallback: imprime o SQL para copiar no Supabase dashboard
  console.log("\n──────────────────────────────────────────────────────");
  console.log("Cole o SQL abaixo no Supabase → SQL Editor → Run:\n");
  console.log(SQL);
  console.log("──────────────────────────────────────────────────────");
  console.log("\nAcesse: https://supabase.com/dashboard/project/" + ref + "/sql/new");
}

main().catch(console.error);
