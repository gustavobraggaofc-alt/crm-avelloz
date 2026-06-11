// =========================================================
// CRM AVELLOZ - Aplicação Express (API + arquivos estáticos)
// =========================================================

const path = require("path");
const express = require("express");
const supabase = require("./supabaseClient");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function wrap(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

async function recalcularStatusMoto(motoId) {
  const { data: moto, error } = await supabase.from("motos").select("*").eq("id", motoId).maybeSingle();
  if (error) throw error;
  if (!moto || moto.status === "Reservada") return;

  let novoStatus = "Disponível";
  if (moto.quantidade <= 0) novoStatus = "Esgotado";
  else if (moto.quantidade <= 2) novoStatus = "Estoque Baixo";

  if (novoStatus !== moto.status) {
    const { error: errUpdate } = await supabase.from("motos").update({ status: novoStatus }).eq("id", motoId);
    if (errUpdate) throw errUpdate;
  }
}

function dataHojeBR() {
  return new Date().toLocaleDateString("pt-BR");
}

function comVendedorNome(linhas) {
  return linhas.map((linha) => {
    const { vendedores, ...resto } = linha;
    return { ...resto, vendedor_nome: vendedores?.nome || null };
  });
}

// ---------------------------------------------------------
// VENDEDORES
// ---------------------------------------------------------

app.get("/api/vendedores", wrap(async (req, res) => {
  const { data, error } = await supabase.from("vendedores").select("*").order("nome");
  if (error) throw error;
  res.json(data);
}));

app.get("/api/vendedores/:id", wrap(async (req, res) => {
  const { data, error } = await supabase.from("vendedores").select("*").eq("id", req.params.id).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ erro: "Vendedor não encontrado" });
  res.json(data);
}));

app.post("/api/vendedores", wrap(async (req, res) => {
  const { nome, email, telefone, meta, comissao } = req.body;
  if (!nome || !email) return res.status(400).json({ erro: "Nome e e-mail são obrigatórios" });

  const { data, error } = await supabase
    .from("vendedores")
    .insert({
      nome,
      email,
      telefone: telefone || "",
      meta: Number(meta) || 0,
      comissao: Number(comissao) || 0,
    })
    .select()
    .single();
  if (error) throw error;

  res.status(201).json(data);
}));

app.put("/api/vendedores/:id", wrap(async (req, res) => {
  const { data: existente, error: errBusca } = await supabase
    .from("vendedores")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();
  if (errBusca) throw errBusca;
  if (!existente) return res.status(404).json({ erro: "Vendedor não encontrado" });

  const { nome, email, telefone, meta, comissao } = req.body;
  const { data, error } = await supabase
    .from("vendedores")
    .update({
      nome: nome ?? existente.nome,
      email: email ?? existente.email,
      telefone: telefone ?? existente.telefone,
      meta: Number(meta ?? existente.meta) || 0,
      comissao: Number(comissao ?? existente.comissao) || 0,
    })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) throw error;

  res.json(data);
}));

app.delete("/api/vendedores/:id", wrap(async (req, res) => {
  const { error } = await supabase.from("vendedores").delete().eq("id", req.params.id);
  if (error) throw error;
  res.status(204).end();
}));

// ---------------------------------------------------------
// CLIENTES
// ---------------------------------------------------------

app.get("/api/clientes", wrap(async (req, res) => {
  const { data, error } = await supabase.from("clientes").select("*").order("nome");
  if (error) throw error;
  res.json(data);
}));

app.get("/api/clientes/:id", wrap(async (req, res) => {
  const { data, error } = await supabase.from("clientes").select("*").eq("id", req.params.id).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ erro: "Cliente não encontrado" });
  res.json(data);
}));

app.post("/api/clientes", wrap(async (req, res) => {
  const { nome, telefone, email, cpf } = req.body;
  if (!nome) return res.status(400).json({ erro: "Nome é obrigatório" });

  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nome,
      telefone: telefone || "",
      email: email || "",
      cpf: cpf || "",
      ultima_compra: "",
      motos_compradas: 0,
    })
    .select()
    .single();
  if (error) throw error;

  res.status(201).json(data);
}));

app.put("/api/clientes/:id", wrap(async (req, res) => {
  const { data: existente, error: errBusca } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();
  if (errBusca) throw errBusca;
  if (!existente) return res.status(404).json({ erro: "Cliente não encontrado" });

  const { nome, telefone, email, cpf } = req.body;
  const { data, error } = await supabase
    .from("clientes")
    .update({
      nome: nome ?? existente.nome,
      telefone: telefone ?? existente.telefone,
      email: email ?? existente.email,
      cpf: cpf ?? existente.cpf,
    })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) throw error;

  res.json(data);
}));

app.delete("/api/clientes/:id", wrap(async (req, res) => {
  const { error } = await supabase.from("clientes").delete().eq("id", req.params.id);
  if (error) throw error;
  res.status(204).end();
}));

// ---------------------------------------------------------
// MOTOS / ESTOQUE
// ---------------------------------------------------------

app.get("/api/motos", wrap(async (req, res) => {
  const { data, error } = await supabase.from("motos").select("*").order("modelo");
  if (error) throw error;
  res.json(data);
}));

app.post("/api/motos", wrap(async (req, res) => {
  const { modelo, marca, ano, cor, valor, quantidade, status } = req.body;
  if (!modelo || !marca) return res.status(400).json({ erro: "Modelo e marca são obrigatórios" });

  const { data, error } = await supabase
    .from("motos")
    .insert({
      modelo,
      marca,
      ano: Number(ano) || null,
      cor: cor || "",
      valor: Number(valor) || 0,
      quantidade: Number(quantidade) || 0,
      status: status || "Disponível",
    })
    .select()
    .single();
  if (error) throw error;

  await recalcularStatusMoto(data.id);

  const { data: atualizado, error: errFinal } = await supabase.from("motos").select("*").eq("id", data.id).single();
  if (errFinal) throw errFinal;

  res.status(201).json(atualizado);
}));

app.put("/api/motos/:id", wrap(async (req, res) => {
  const { data: existente, error: errBusca } = await supabase
    .from("motos")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();
  if (errBusca) throw errBusca;
  if (!existente) return res.status(404).json({ erro: "Moto não encontrada" });

  const { modelo, marca, ano, cor, valor, quantidade, status } = req.body;
  const { error } = await supabase
    .from("motos")
    .update({
      modelo: modelo ?? existente.modelo,
      marca: marca ?? existente.marca,
      ano: Number(ano ?? existente.ano) || null,
      cor: cor ?? existente.cor,
      valor: Number(valor ?? existente.valor) || 0,
      quantidade: Number(quantidade ?? existente.quantidade) || 0,
      status: status ?? existente.status,
    })
    .eq("id", req.params.id);
  if (error) throw error;

  await recalcularStatusMoto(req.params.id);

  const { data: atualizado, error: errFinal } = await supabase.from("motos").select("*").eq("id", req.params.id).single();
  if (errFinal) throw errFinal;

  res.json(atualizado);
}));

app.delete("/api/motos/:id", wrap(async (req, res) => {
  const { error } = await supabase.from("motos").delete().eq("id", req.params.id);
  if (error) throw error;
  res.status(204).end();
}));

// ---------------------------------------------------------
// VENDAS
// ---------------------------------------------------------

app.get("/api/vendas", wrap(async (req, res) => {
  const limite = Number(req.query.limite) || 100;
  const { data, error } = await supabase
    .from("vendas")
    .select("*")
    .order("id", { ascending: false })
    .limit(limite);
  if (error) throw error;
  res.json(data);
}));

app.post("/api/vendas", wrap(async (req, res) => {
  const {
    cliente_nome,
    cliente_telefone,
    cliente_cpf,
    vendedor_id,
    moto_id,
    moto_descricao,
    valor,
    forma_pagamento,
    observacoes,
    status,
  } = req.body;

  if (!cliente_nome || !valor) {
    return res.status(400).json({ erro: "Cliente e valor são obrigatórios" });
  }

  const hoje = dataHojeBR();

  let cliente = null;
  if (cliente_cpf) {
    const { data, error } = await supabase.from("clientes").select("*").eq("cpf", cliente_cpf).maybeSingle();
    if (error) throw error;
    cliente = data;
  }
  if (!cliente) {
    const { data, error } = await supabase.from("clientes").select("*").eq("nome", cliente_nome).maybeSingle();
    if (error) throw error;
    cliente = data;
  }

  if (cliente) {
    const { error } = await supabase
      .from("clientes")
      .update({
        telefone: cliente_telefone || cliente.telefone,
        cpf: cliente_cpf || cliente.cpf,
        ultima_compra: hoje,
        motos_compradas: (cliente.motos_compradas || 0) + 1,
      })
      .eq("id", cliente.id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("clientes")
      .insert({
        nome: cliente_nome,
        telefone: cliente_telefone || "",
        cpf: cliente_cpf || "",
        ultima_compra: hoje,
        motos_compradas: 1,
      })
      .select()
      .single();
    if (error) throw error;
    cliente = data;
  }

  if (moto_id) {
    const { data: moto, error: errMoto } = await supabase.from("motos").select("*").eq("id", moto_id).maybeSingle();
    if (errMoto) throw errMoto;
    if (moto) {
      const { error: errUpdate } = await supabase
        .from("motos")
        .update({ quantidade: Math.max(moto.quantidade - 1, 0) })
        .eq("id", moto_id);
      if (errUpdate) throw errUpdate;
      await recalcularStatusMoto(moto_id);
    }
  }

  if (vendedor_id) {
    const { data: vendedor, error: errVendedor } = await supabase
      .from("vendedores")
      .select("*")
      .eq("id", vendedor_id)
      .maybeSingle();
    if (errVendedor) throw errVendedor;
    if (vendedor) {
      const { error: errUpdate } = await supabase
        .from("vendedores")
        .update({
          vendas_mes: (vendedor.vendas_mes || 0) + (Number(valor) || 0),
          motos_vendidas: (vendedor.motos_vendidas || 0) + 1,
        })
        .eq("id", vendedor_id);
      if (errUpdate) throw errUpdate;
    }
  }

  const { data: venda, error: errVenda } = await supabase
    .from("vendas")
    .insert({
      cliente_id: cliente.id,
      cliente_nome,
      cliente_telefone: cliente_telefone || "",
      cliente_cpf: cliente_cpf || "",
      vendedor_id: vendedor_id || null,
      moto_id: moto_id || null,
      moto_descricao: moto_descricao || "",
      valor: Number(valor) || 0,
      forma_pagamento: forma_pagamento || "",
      observacoes: observacoes || "",
      status: status || "Concluída",
      data: hoje,
    })
    .select()
    .single();
  if (errVenda) throw errVenda;

  res.status(201).json(venda);
}));

// ---------------------------------------------------------
// AGENDA
// ---------------------------------------------------------

app.get("/api/agenda", wrap(async (req, res) => {
  const { data, error } = await supabase
    .from("agenda")
    .select("*, vendedores(nome)")
    .order("data", { ascending: true })
    .order("hora", { ascending: true });
  if (error) throw error;

  res.json(comVendedorNome(data));
}));

app.post("/api/agenda", wrap(async (req, res) => {
  const { data, hora, titulo, descricao, vendedor_id, status } = req.body;
  if (!data || !titulo) return res.status(400).json({ erro: "Data e título são obrigatórios" });

  const { data: criado, error } = await supabase
    .from("agenda")
    .insert({
      data,
      hora: hora || "",
      titulo,
      descricao: descricao || "",
      vendedor_id: vendedor_id || null,
      status: status || "Pendente",
    })
    .select()
    .single();
  if (error) throw error;

  res.status(201).json(criado);
}));

app.put("/api/agenda/:id", wrap(async (req, res) => {
  const { data: existente, error: errBusca } = await supabase
    .from("agenda")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();
  if (errBusca) throw errBusca;
  if (!existente) return res.status(404).json({ erro: "Compromisso não encontrado" });

  const { data, hora, titulo, descricao, vendedor_id, status } = req.body;
  const { data: atualizado, error } = await supabase
    .from("agenda")
    .update({
      data: data ?? existente.data,
      hora: hora ?? existente.hora,
      titulo: titulo ?? existente.titulo,
      descricao: descricao ?? existente.descricao,
      vendedor_id: vendedor_id !== undefined ? vendedor_id || null : existente.vendedor_id,
      status: status ?? existente.status,
    })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) throw error;

  res.json(atualizado);
}));

app.delete("/api/agenda/:id", wrap(async (req, res) => {
  const { error } = await supabase.from("agenda").delete().eq("id", req.params.id);
  if (error) throw error;
  res.status(204).end();
}));

// ---------------------------------------------------------
// RANKING
// ---------------------------------------------------------

app.get("/api/ranking", wrap(async (req, res) => {
  const { data, error } = await supabase.from("vendedores").select("*").order("vendas_mes", { ascending: false });
  if (error) throw error;

  const ranking = data.map((v, i) => ({
    ...v,
    posicao: i + 1,
    percentual: v.meta > 0 ? Math.round((v.vendas_mes / v.meta) * 100) : 0,
  }));
  res.json(ranking);
}));

// ---------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------

app.get("/api/dashboard", wrap(async (req, res) => {
  const hoje = dataHojeBR();
  const ontem = new Date(Date.now() - 86400000).toLocaleDateString("pt-BR");

  const { count: vendasHoje, error: errHoje } = await supabase
    .from("vendas")
    .select("*", { count: "exact", head: true })
    .eq("data", hoje);
  if (errHoje) throw errHoje;

  const { count: vendasOntem, error: errOntem } = await supabase
    .from("vendas")
    .select("*", { count: "exact", head: true })
    .eq("data", ontem);
  if (errOntem) throw errOntem;

  const { data: vendedoresData, error: errVend } = await supabase
    .from("vendedores")
    .select("vendas_mes, motos_vendidas, meta");
  if (errVend) throw errVend;

  const totais = vendedoresData.reduce(
    (acc, v) => ({
      faturamento: acc.faturamento + (v.vendas_mes || 0),
      unidades: acc.unidades + (v.motos_vendidas || 0),
      meta: acc.meta + (v.meta || 0),
    }),
    { faturamento: 0, unidades: 0, meta: 0 }
  );

  const { data: topVendedores, error: errTop } = await supabase
    .from("vendedores")
    .select("*")
    .order("vendas_mes", { ascending: false })
    .limit(4);
  if (errTop) throw errTop;

  const { data: ultimasVendasRaw, error: errUltimas } = await supabase
    .from("vendas")
    .select("*, vendedores(nome)")
    .order("id", { ascending: false })
    .limit(5);
  if (errUltimas) throw errUltimas;

  res.json({
    vendasHoje: vendasHoje || 0,
    vendasOntem: vendasOntem || 0,
    vendasMes: totais.unidades,
    faturamentoMes: totais.faturamento,
    metaTotal: totais.meta,
    percentualMeta: totais.meta > 0 ? Math.round((totais.faturamento / totais.meta) * 100) : 0,
    topVendedores,
    ultimasVendas: comVendedorNome(ultimasVendasRaw),
  });
}));

// ---------------------------------------------------------
// SIMULAÇÕES (Financiamento e Consórcio)
// ---------------------------------------------------------

app.post("/api/simulacoes/financiamento", wrap(async (req, res) => {
  const {
    vendedor_id,
    cliente_nome,
    valor_veiculo,
    entrada,
    parcelas,
    taxa_juros,
    valor_parcela,
    total_pagar,
    total_juros,
    antecipou_parcelas,
  } = req.body;

  const { data, error } = await supabase
    .from("simulacoes_financiamento")
    .insert({
      vendedor_id: vendedor_id || null,
      cliente_nome: cliente_nome || "",
      valor_veiculo: Number(valor_veiculo) || 0,
      entrada: Number(entrada) || 0,
      parcelas: Number(parcelas) || 0,
      taxa_juros: Number(taxa_juros) || 0,
      valor_parcela: Number(valor_parcela) || 0,
      total_pagar: Number(total_pagar) || 0,
      total_juros: Number(total_juros) || 0,
      antecipou_parcelas: antecipou_parcelas ? 1 : 0,
    })
    .select()
    .single();
  if (error) throw error;

  res.status(201).json(data);
}));

app.post("/api/simulacoes/consorcio", wrap(async (req, res) => {
  const { vendedor_id, cliente_nome, valor_carta, prazo, taxa_administracao, fundo_reserva, valor_parcela, total_pagar } = req.body;

  const { data, error } = await supabase
    .from("simulacoes_consorcio")
    .insert({
      vendedor_id: vendedor_id || null,
      cliente_nome: cliente_nome || "",
      valor_carta: Number(valor_carta) || 0,
      prazo: Number(prazo) || 0,
      taxa_administracao: Number(taxa_administracao) || 0,
      fundo_reserva: Number(fundo_reserva) || 0,
      valor_parcela: Number(valor_parcela) || 0,
      total_pagar: Number(total_pagar) || 0,
    })
    .select()
    .single();
  if (error) throw error;

  res.status(201).json(data);
}));

// ---------------------------------------------------------
// Tratamento de erros
// ---------------------------------------------------------

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: err.message || "Erro interno do servidor" });
});

module.exports = app;
