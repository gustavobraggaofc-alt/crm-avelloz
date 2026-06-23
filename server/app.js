// =========================================================
// CRM AVELLOZ - Aplicação Express (API + arquivos estáticos)
// =========================================================

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const supabase = require("./supabaseClient");

const app = express();

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_AUTH = "crm_token";

app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
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

class ErroValidacao extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.status = 400;
  }
}

// Valida/converte um campo numérico. Se `valor` não for informado, usa `padrao`
// (se `padrao` for omitido, o campo é obrigatório). Lança ErroValidacao (400)
// para valores não numéricos ou fora do intervalo [min, max].
function validarNumero(valor, { campo, min = -Infinity, max = Infinity, padrao, feminino = false } = {}) {
  if (valor === undefined || valor === null || valor === "") {
    if (padrao !== undefined) return padrao;
    throw new ErroValidacao(`${campo} é obrigatório`);
  }
  const n = Number(valor);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new ErroValidacao(`${campo} inválid${feminino ? "a" : "o"}`);
  }
  return n;
}

// Remove o hash de senha antes de devolver dados de vendedor ao cliente.
function semSenha(vendedor) {
  if (!vendedor) return vendedor;
  const { senha_hash, ...resto } = vendedor;
  return resto;
}

function semSenhaLista(vendedores) {
  return vendedores.map(semSenha);
}

// ---------------------------------------------------------
// AUTENTICAÇÃO
// ---------------------------------------------------------

app.post("/api/login", wrap(async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: "E-mail e senha são obrigatórios" });

  const { data: vendedor, error } = await supabase
    .from("vendedores")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  if (error) throw error;

  const senhaOk = vendedor?.senha_hash && bcrypt.compareSync(senha, vendedor.senha_hash);
  if (!senhaOk) return res.status(401).json({ erro: "E-mail ou senha inválidos" });

  const token = jwt.sign(
    { id: vendedor.id, nome: vendedor.nome, email: vendedor.email, role: vendedor.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie(COOKIE_AUTH, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json(semSenha(vendedor));
}));

app.post("/api/logout", (req, res) => {
  res.clearCookie(COOKIE_AUTH);
  res.json({ ok: true });
});

// A partir daqui, todas as rotas /api/* exigem sessão válida.
app.use("/api", (req, res, next) => {
  const token = req.cookies?.[COOKIE_AUTH];
  if (!token) return res.status(401).json({ erro: "Não autenticado" });
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ erro: "Sessão inválida ou expirada" });
  }
});

app.get("/api/me", (req, res) => res.json(req.usuario));

// Bloqueia o acesso a quem não é administrador. Aplicado às rotas que
// expõem ou alteram dados sigilosos (cadastro de usuários, papéis,
// comissões, metas, gestão de estoque).
function exigirAdmin(req, res, next) {
  if (req.usuario?.role !== "admin") {
    return res.status(403).json({ erro: "Acesso restrito a administradores" });
  }
  next();
}

// ---------------------------------------------------------
// VENDEDORES
// ---------------------------------------------------------

// Lista de vendedores: qualquer usuário autenticado pode consultar (é usada
// em selects de "vendedor responsável" em Vender/Agenda), mas só o admin
// recebe os campos sigilosos (e-mail, telefone, meta, comissão, vendas).
app.get("/api/vendedores", wrap(async (req, res) => {
  const { data, error } = await supabase.from("vendedores").select("*").order("nome");
  if (error) throw error;
  const lista = semSenhaLista(data);
  if (req.usuario.role === "admin") return res.json(lista);
  res.json(lista.map((v) => ({ id: v.id, nome: v.nome })));
}));

app.get("/api/vendedores/:id", exigirAdmin, wrap(async (req, res) => {
  const { data, error } = await supabase.from("vendedores").select("*").eq("id", req.params.id).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ erro: "Vendedor não encontrado" });
  res.json(semSenha(data));
}));

app.post("/api/vendedores", exigirAdmin, wrap(async (req, res) => {
  const { nome, email, telefone, meta, comissao, senha, role } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: "Nome, e-mail e senha são obrigatórios" });
  if (senha.length < 6) return res.status(400).json({ erro: "Senha deve ter pelo menos 6 caracteres" });

  const metaValidada = validarNumero(meta, { campo: "Meta", min: 0, padrao: 0, feminino: true });
  const comissaoValidada = validarNumero(comissao, { campo: "Comissão", min: 0, padrao: 0, feminino: true });

  const { data, error } = await supabase
    .from("vendedores")
    .insert({
      nome,
      email,
      telefone: telefone || "",
      meta: metaValidada,
      comissao: comissaoValidada,
      senha_hash: bcrypt.hashSync(senha, 10),
      role: role === "admin" ? "admin" : "vendedor",
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new ErroValidacao("Já existe um vendedor com esse e-mail");
    throw error;
  }

  res.status(201).json(semSenha(data));
}));

app.put("/api/vendedores/:id", exigirAdmin, wrap(async (req, res) => {
  const { data: existente, error: errBusca } = await supabase
    .from("vendedores")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();
  if (errBusca) throw errBusca;
  if (!existente) return res.status(404).json({ erro: "Vendedor não encontrado" });

  const { nome, email, telefone, meta, comissao, senha, role } = req.body;
  if (senha && senha.length < 6) return res.status(400).json({ erro: "Senha deve ter pelo menos 6 caracteres" });

  const metaValidada = validarNumero(meta, { campo: "Meta", min: 0, padrao: existente.meta, feminino: true });
  const comissaoValidada = validarNumero(comissao, { campo: "Comissão", min: 0, padrao: existente.comissao, feminino: true });

  const { data, error } = await supabase
    .from("vendedores")
    .update({
      nome: nome ?? existente.nome,
      email: email ?? existente.email,
      telefone: telefone ?? existente.telefone,
      meta: metaValidada,
      comissao: comissaoValidada,
      senha_hash: senha ? bcrypt.hashSync(senha, 10) : existente.senha_hash,
      role: role === "admin" || role === "vendedor" ? role : existente.role,
    })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new ErroValidacao("Já existe um vendedor com esse e-mail");
    throw error;
  }

  res.json(semSenha(data));
}));

app.delete("/api/vendedores/:id", exigirAdmin, wrap(async (req, res) => {
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

app.post("/api/motos", exigirAdmin, wrap(async (req, res) => {
  const { modelo, marca, ano, cor, valor, quantidade, status } = req.body;
  if (!modelo || !marca) return res.status(400).json({ erro: "Modelo e marca são obrigatórios" });

  const anoValidado = validarNumero(ano, { campo: "Ano", min: 1900, max: 2100, padrao: null });
  const valorValidado = validarNumero(valor, { campo: "Valor", min: 0, padrao: 0 });
  const quantidadeValidada = validarNumero(quantidade, { campo: "Quantidade", min: 0, padrao: 0, feminino: true });

  const { data, error } = await supabase
    .from("motos")
    .insert({
      modelo,
      marca,
      ano: anoValidado,
      cor: cor || "",
      valor: valorValidado,
      quantidade: quantidadeValidada,
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

app.put("/api/motos/:id", exigirAdmin, wrap(async (req, res) => {
  const { data: existente, error: errBusca } = await supabase
    .from("motos")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();
  if (errBusca) throw errBusca;
  if (!existente) return res.status(404).json({ erro: "Moto não encontrada" });

  const { modelo, marca, ano, cor, valor, quantidade, status } = req.body;
  const anoValidado = validarNumero(ano, { campo: "Ano", min: 1900, max: 2100, padrao: existente.ano });
  const valorValidado = validarNumero(valor, { campo: "Valor", min: 0, padrao: existente.valor });
  const quantidadeValidada = validarNumero(quantidade, { campo: "Quantidade", min: 0, padrao: existente.quantidade, feminino: true });

  const { error } = await supabase
    .from("motos")
    .update({
      modelo: modelo ?? existente.modelo,
      marca: marca ?? existente.marca,
      ano: anoValidado,
      cor: cor ?? existente.cor,
      valor: valorValidado,
      quantidade: quantidadeValidada,
      status: status ?? existente.status,
    })
    .eq("id", req.params.id);
  if (error) throw error;

  await recalcularStatusMoto(req.params.id);

  const { data: atualizado, error: errFinal } = await supabase.from("motos").select("*").eq("id", req.params.id).single();
  if (errFinal) throw errFinal;

  res.json(atualizado);
}));

app.delete("/api/motos/:id", exigirAdmin, wrap(async (req, res) => {
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

  const valorValidado = validarNumero(valor, { campo: "Valor", min: 0.01 });

  let moto = null;
  if (moto_id) {
    const { data, error } = await supabase.from("motos").select("*").eq("id", moto_id).maybeSingle();
    if (error) throw error;
    if (!data) throw new ErroValidacao("Moto não encontrada");
    moto = data;
  }

  let vendedor = null;
  if (vendedor_id) {
    const { data, error } = await supabase.from("vendedores").select("*").eq("id", vendedor_id).maybeSingle();
    if (error) throw error;
    if (!data) throw new ErroValidacao("Vendedor não encontrado");
    vendedor = data;
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

  if (moto) {
    const { error: errUpdate } = await supabase
      .from("motos")
      .update({ quantidade: Math.max(moto.quantidade - 1, 0) })
      .eq("id", moto_id);
    if (errUpdate) throw errUpdate;
    await recalcularStatusMoto(moto_id);
  }

  if (vendedor) {
    const { error: errUpdate } = await supabase
      .from("vendedores")
      .update({
        vendas_mes: (vendedor.vendas_mes || 0) + valorValidado,
        motos_vendidas: (vendedor.motos_vendidas || 0) + 1,
      })
      .eq("id", vendedor_id);
    if (errUpdate) throw errUpdate;
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
      valor: valorValidado,
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

  // O ranking é só um placar de desempenho entre vendedores: não precisa
  // expor e-mail, telefone ou comissão de ninguém para montar isso.
  const ranking = data.map((v, i) => ({
    id: v.id,
    nome: v.nome,
    vendas_mes: v.vendas_mes || 0,
    motos_vendidas: v.motos_vendidas || 0,
    meta: v.meta || 0,
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

  const { data: topVendedoresRaw, error: errTop } = await supabase
    .from("vendedores")
    .select("*")
    .order("vendas_mes", { ascending: false })
    .limit(4);
  if (errTop) throw errTop;
  const topVendedores = semSenhaLista(topVendedoresRaw);

  const { data: ultimasVendasRaw, error: errUltimas } = await supabase
    .from("vendas")
    .select("*, vendedores(nome)")
    .order("id", { ascending: false })
    .limit(5);
  if (errUltimas) throw errUltimas;

  const { data: todasVendas, error: errTodasVendas } = await supabase
    .from("vendas")
    .select("valor, data, status");
  if (errTodasVendas) throw errTodasVendas;

  const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const agora = new Date();
  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const ref = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    buckets.push({
      chave: `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`,
      label: MESES_ABREV[ref.getMonth()],
      valor: 0,
    });
  }

  for (const venda of todasVendas) {
    if (venda.status === "Cancelada") continue;
    const partes = String(venda.data || "").split("/");
    if (partes.length !== 3) continue;
    const [, mm, yyyy] = partes;
    const bucket = buckets.find((b) => b.chave === `${yyyy}-${mm}`);
    if (bucket) bucket.valor += venda.valor || 0;
  }

  const vendasPorMes = buckets.map(({ label, valor }) => ({ label, valor }));

  const ultimasVendas = comVendedorNome(ultimasVendasRaw);
  const ehAdmin = req.usuario.role === "admin";

  // Faturamento, meta e os valores em R$ de vendas/ranking são dados
  // financeiros da empresa: só o admin recebe esses campos. Vendedores
  // recebem só as contagens (quantas vendas), sem nenhum valor monetário.
  res.json({
    vendasHoje: vendasHoje || 0,
    vendasOntem: vendasOntem || 0,
    vendasMes: totais.unidades,
    topVendedores: ehAdmin
      ? topVendedores
      : topVendedores.map((v) => ({ nome: v.nome, motos_vendidas: v.motos_vendidas })),
    ultimasVendas: ehAdmin
      ? ultimasVendas
      : ultimasVendas.map(({ valor, ...resto }) => resto),
    ...(ehAdmin
      ? {
          faturamentoMes: totais.faturamento,
          metaTotal: totais.meta,
          percentualMeta: totais.meta > 0 ? Math.round((totais.faturamento / totais.meta) * 100) : 0,
          vendasPorMes,
        }
      : {}),
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
// OFICINA - Revisões periódicas e montagens
// ---------------------------------------------------------

const CAMPOS_OFICINA = [
  "tipo", "status", "cliente_nome", "modelo_moto", "mecanico",
  "data_entrada", "data_prevista", "data_conclusao", "km_entrada",
  "servicos", "observacoes",
];

app.get("/api/oficina", wrap(async (req, res) => {
  let q = supabase.from("oficina_ordens").select("*").order("created_at", { ascending: false });
  if (req.query.tipo) q = q.eq("tipo", req.query.tipo);
  if (req.query.status) q = q.eq("status", req.query.status);
  const { data, error } = await q;
  if (error) {
    if (error.message && error.message.includes("oficina_ordens")) {
      return res.status(503).json({ erro: "TABELA_NAO_CRIADA", mensagem: error.message });
    }
    throw error;
  }
  res.json(data || []);
}));

app.post("/api/oficina", wrap(async (req, res) => {
  const reg = Object.fromEntries(
    CAMPOS_OFICINA.filter((c) => req.body[c] !== undefined).map((c) => [c, req.body[c]])
  );
  if (!reg.data_entrada) reg.data_entrada = dataHojeBR();
  const { data, error } = await supabase.from("oficina_ordens").insert(reg).select().single();
  if (error) throw error;
  res.status(201).json(data);
}));

app.put("/api/oficina/:id", wrap(async (req, res) => {
  const upd = Object.fromEntries(
    CAMPOS_OFICINA.filter((c) => req.body[c] !== undefined).map((c) => [c, req.body[c]])
  );
  const { data, error } = await supabase
    .from("oficina_ordens").update(upd).eq("id", req.params.id).select().single();
  if (error) throw error;
  res.json(data);
}));

app.delete("/api/oficina/:id", wrap(async (req, res) => {
  const { error } = await supabase.from("oficina_ordens").delete().eq("id", req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

// ---------------------------------------------------------
// Tratamento de erros
// ---------------------------------------------------------

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ erro: err.message || "Erro interno do servidor" });
});

module.exports = app;
