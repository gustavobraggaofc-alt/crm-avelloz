// =========================================================
// CRM AVELLOZ - Servidor local (Express + Supabase)
// =========================================================

const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`CRM Avelloz rodando em http://localhost:${PORT}`);
});
