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

// Um vendedor é considerado "online" se teve alguma requisição autenticada
// nos últimos ONLINE_LIMITE_MS. ULTIMO_ACESSO_THROTTLE_MS evita gravar no
// banco a cada requisição (uma página normalmente dispara várias chamadas
// de API em sequência) — só atualiza ultimo_acesso uma vez por minuto por
// usuário, o que é preciso o suficiente pra saber quem está online agora.
const ONLINE_LIMITE_MS = 5 * 60 * 1000;
const ULTIMO_ACESSO_THROTTLE_MS = 60 * 1000;
const ultimoAcessoRegistradoEm = new Map();

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

// Remove pontuação do CPF (mantém só dígitos) para que o mesmo CPF digitado
// com máscaras diferentes ("111.111.111-11" vs "11111111111") sempre bata
// na busca por cliente existente, evitando cadastros duplicados.
function normalizarCpf(cpf) {
  return (cpf || "").replace(/\D/g, "");
}

function comVendedorNome(linhas) {
  return linhas.map((linha) => {
    const { vendedores, ...resto } = linha;
    return { ...resto, vendedor_nome: vendedores?.nome || null };
  });
}

// Traduz o parâmetro ?periodo= (mes | mes_passado | ano) num predicado de
// mês/ano e no número de meses que ele cobre (usado pra escalar a meta, que
// é mensal). "mes" é o padrão quando o parâmetro vem ausente ou inválido.
function resolverPeriodo(periodo) {
  const agora = new Date();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth() + 1;

  if (periodo === "mes_passado") {
    const mesAlvo = mesAtual === 1 ? 12 : mesAtual - 1;
    const anoAlvo = mesAtual === 1 ? anoAtual - 1 : anoAtual;
    return { dentroDoPeriodo: (mm, yyyy) => mm === mesAlvo && yyyy === anoAlvo, mesesNoPeriodo: 1 };
  }
  if (periodo === "ano") {
    return { dentroDoPeriodo: (mm, yyyy) => yyyy === anoAtual, mesesNoPeriodo: mesAtual };
  }
  return { dentroDoPeriodo: (mm, yyyy) => mm === mesAtual && yyyy === anoAtual, mesesNoPeriodo: 1 };
}

// Soma faturamento e unidades vendidas por vendedor, direto da tabela vendas,
// filtrado pelo predicado de período (mês corrente por padrão). Não usa
// vendedores.vendas_mes/motos_vendidas porque esses contadores são
// cumulativos (nunca são zerados na virada do mês), o que fazia o
// dashboard/ranking mostrarem vendas de meses anteriores como "deste mês".
async function statsMesPorVendedor(dentroDoPeriodo) {
  const { data: vendas, error } = await supabase
    .from("vendas")
    .select("vendedor_id, valor, status, data");
  if (error) throw error;

  if (!dentroDoPeriodo) {
    dentroDoPeriodo = resolverPeriodo("mes").dentroDoPeriodo;
  }

  const porVendedor = new Map();
  for (const venda of vendas) {
    if (venda.status === "Cancelada" || !venda.vendedor_id) continue;
    const partes = String(venda.data || "").split("/");
    if (partes.length !== 3) continue;
    const [, mm, yyyy] = partes;
    if (!dentroDoPeriodo(Number(mm), Number(yyyy))) continue;

    const atual = porVendedor.get(venda.vendedor_id) || { faturamento: 0, unidades: 0 };
    atual.faturamento += venda.valor || 0;
    atual.unidades += 1;
    porVendedor.set(venda.vendedor_id, atual);
  }
  return porVendedor;
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

  const agora = new Date().toISOString();
  await supabase.from("vendedores").update({ ultimo_login: agora, ultimo_acesso: agora }).eq("id", vendedor.id);

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

  const agora = Date.now();
  const ultimoRegistro = ultimoAcessoRegistradoEm.get(req.usuario.id) || 0;
  if (agora - ultimoRegistro > ULTIMO_ACESSO_THROTTLE_MS) {
    ultimoAcessoRegistradoEm.set(req.usuario.id, agora);
    supabase.from("vendedores").update({ ultimo_acesso: new Date().toISOString() }).eq("id", req.usuario.id)
      .then(({ error }) => { if (error) console.error("Falha ao atualizar ultimo_acesso:", error.message); });
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
  if (req.usuario.role !== "admin") return res.json(lista.map((v) => ({ id: v.id, nome: v.nome })));

  const statsMes = await statsMesPorVendedor();
  res.json(lista.map((v) => ({
    ...v,
    vendas_mes: statsMes.get(v.id)?.faturamento || 0,
    motos_vendidas: statsMes.get(v.id)?.unidades || 0,
  })));
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

// Vendedor comum só vê os clientes que ele mesmo cadastrou; admin vê todos.
app.get("/api/clientes", wrap(async (req, res) => {
  let query = supabase.from("clientes").select("*, vendedores(nome)").order("nome");
  if (req.usuario.role !== "admin") query = query.eq("vendedor_id", req.usuario.id);

  const { data, error } = await query;
  if (error) throw error;
  res.json(comVendedorNome(data));
}));

app.get("/api/clientes/:id", wrap(async (req, res) => {
  const { data, error } = await supabase
    .from("clientes")
    .select("*, vendedores(nome)")
    .eq("id", req.params.id)
    .maybeSingle();
  if (error) throw error;
  if (!data || (req.usuario.role !== "admin" && data.vendedor_id !== req.usuario.id)) {
    return res.status(404).json({ erro: "Cliente não encontrado" });
  }
  res.json(comVendedorNome([data])[0]);
}));

app.post("/api/clientes", wrap(async (req, res) => {
  const { nome, telefone, email, cpf, vendedor_id } = req.body;
  if (!nome) return res.status(400).json({ erro: "Nome é obrigatório" });

  // Por padrão, quem cadastra é o próprio usuário logado. Só admin pode
  // atribuir o cadastro a outro vendedor (ex.: recepção cadastrando em
  // nome de quem atendeu o cliente).
  let vendedorId = req.usuario.id;
  if (req.usuario.role === "admin" && vendedor_id !== undefined) {
    if (vendedor_id === null || vendedor_id === "") {
      vendedorId = null;
    } else {
      const { data: vendedor, error: errVendedor } = await supabase
        .from("vendedores")
        .select("id")
        .eq("id", vendedor_id)
        .maybeSingle();
      if (errVendedor) throw errVendedor;
      if (!vendedor) throw new ErroValidacao("Vendedor não encontrado");
      vendedorId = vendedor.id;
    }
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nome,
      telefone: telefone || "",
      email: email || "",
      cpf: normalizarCpf(cpf),
      ultima_compra: "",
      motos_compradas: 0,
      vendedor_id: vendedorId,
    })
    .select("*, vendedores(nome)")
    .single();
  if (error) throw error;

  res.status(201).json(comVendedorNome([data])[0]);
}));

app.put("/api/clientes/:id", wrap(async (req, res) => {
  const { data: existente, error: errBusca } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();
  if (errBusca) throw errBusca;
  if (!existente || (req.usuario.role !== "admin" && existente.vendedor_id !== req.usuario.id)) {
    return res.status(404).json({ erro: "Cliente não encontrado" });
  }

  const { nome, telefone, email, cpf, vendedor_id } = req.body;

  // Só admin pode definir/corrigir manualmente quem cadastrou o cliente
  // (histórico anterior a essa funcionalidade não tinha essa informação).
  let vendedorId = existente.vendedor_id;
  if (req.usuario.role === "admin" && vendedor_id !== undefined) {
    if (vendedor_id === null || vendedor_id === "") {
      vendedorId = null;
    } else {
      const { data: vendedor, error: errVendedor } = await supabase
        .from("vendedores")
        .select("id")
        .eq("id", vendedor_id)
        .maybeSingle();
      if (errVendedor) throw errVendedor;
      if (!vendedor) throw new ErroValidacao("Vendedor não encontrado");
      vendedorId = vendedor.id;
    }
  }

  const { data, error } = await supabase
    .from("clientes")
    .update({
      nome: nome ?? existente.nome,
      telefone: telefone ?? existente.telefone,
      email: email ?? existente.email,
      cpf: cpf !== undefined ? normalizarCpf(cpf) : existente.cpf,
      vendedor_id: vendedorId,
    })
    .eq("id", req.params.id)
    .select("*, vendedores(nome)")
    .single();
  if (error) throw error;

  res.json(comVendedorNome([data])[0]);
}));

app.delete("/api/clientes/:id", wrap(async (req, res) => {
  if (req.usuario.role !== "admin") {
    const { data: existente, error: errBusca } = await supabase
      .from("clientes")
      .select("vendedor_id")
      .eq("id", req.params.id)
      .maybeSingle();
    if (errBusca) throw errBusca;
    if (!existente || existente.vendedor_id !== req.usuario.id) {
      return res.status(404).json({ erro: "Cliente não encontrado" });
    }
  }

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

  if (req.usuario.role === "admin") return res.json(data);
  res.json(data.map(({ valor, ...resto }) => resto));
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

  if (!cliente_nome && !valor) {
    return res.status(400).json({ erro: "Nome do cliente e valor são obrigatórios" });
  }
  if (!cliente_nome) {
    return res.status(400).json({ erro: "Nome do cliente é obrigatório" });
  }
  if (!valor) {
    return res.status(400).json({ erro: "Valor é obrigatório" });
  }

  const valorValidado = validarNumero(valor, { campo: "Valor", min: 0.01 });
  const cpfNormalizado = normalizarCpf(cliente_cpf);

  let moto = null;
  if (moto_id) {
    const { data, error } = await supabase.from("motos").select("*").eq("id", moto_id).maybeSingle();
    if (error) throw error;
    if (!data) throw new ErroValidacao("Moto não encontrada");
    if (data.quantidade <= 0) throw new ErroValidacao("Essa moto não tem estoque disponível");
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

  // Usa .limit(1) em vez de .maybeSingle(): com 2+ clientes cadastrados com
  // o mesmo nome (comum, já que "nome" não é único), .maybeSingle() lançava
  // erro do Postgrest ("multiple rows returned") e a venda inteira falhava
  // com um 500 sem explicação. Aqui sempre pega o primeiro match (ou nenhum),
  // nunca quebra.
  let cliente = null;
  if (cpfNormalizado) {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("cpf", cpfNormalizado)
      .order("id", { ascending: true })
      .limit(1);
    if (error) throw error;
    cliente = data[0] || null;
  }
  if (!cliente) {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("nome", cliente_nome)
      .order("id", { ascending: true })
      .limit(1);
    if (error) throw error;
    cliente = data[0] || null;
  }

  if (cliente) {
    const { error } = await supabase
      .from("clientes")
      .update({
        telefone: cliente_telefone || cliente.telefone,
        cpf: cpfNormalizado || cliente.cpf,
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
        cpf: cpfNormalizado,
        ultima_compra: hoje,
        motos_compradas: 1,
        vendedor_id: vendedor_id || req.usuario.id,
      })
      .select()
      .single();
    if (error) throw error;
    cliente = data;
  }

  if (moto) {
    // Update condicional (optimistic concurrency): só decrementa se a
    // quantidade ainda for a mesma que acabamos de ler. Se outra venda
    // simultânea já mexeu no estoque dessa moto, affectedRows vem vazio e
    // a venda é abortada com um erro claro, em vez de vender a mesma
    // última unidade duas vezes ou sobrescrever o estoque com um valor errado.
    const { data: motoAtualizada, error: errUpdate } = await supabase
      .from("motos")
      .update({ quantidade: moto.quantidade - 1 })
      .eq("id", moto_id)
      .eq("quantidade", moto.quantidade)
      .select()
      .maybeSingle();
    if (errUpdate) throw errUpdate;
    if (!motoAtualizada) {
      throw new ErroValidacao("O estoque dessa moto acabou de mudar (outra venda em andamento). Tente novamente.");
    }
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
      cliente_cpf: cpfNormalizado,
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

// Editar e excluir vendas mexe direto em faturamento, comissão e estoque,
// então fica restrito a admin (mesma lógica usada para vendedores/motos).
app.put("/api/vendas/:id", exigirAdmin, wrap(async (req, res) => {
  const { data: existente, error: errBusca } = await supabase
    .from("vendas").select("*").eq("id", req.params.id).maybeSingle();
  if (errBusca) throw errBusca;
  if (!existente) return res.status(404).json({ erro: "Venda não encontrada" });

  const {
    cliente_nome, cliente_telefone, cliente_cpf, moto_descricao,
    valor, forma_pagamento, observacoes, status,
  } = req.body;

  const valorValidado = validarNumero(valor, { campo: "Valor", min: 0.01, padrao: existente.valor });
  const novoStatus = status || existente.status;
  const eraCancelada = existente.status === "Cancelada";
  const ficaCancelada = novoStatus === "Cancelada";

  // Mantém vendas_mes/motos_vendidas do vendedor e a quantidade em estoque
  // coerentes com o novo status/valor (a venda só "conta" enquanto não está Cancelada).
  if (existente.vendedor_id && !eraCancelada && !ficaCancelada) {
    const delta = valorValidado - existente.valor;
    if (delta !== 0) {
      const { data: vend } = await supabase.from("vendedores").select("vendas_mes").eq("id", existente.vendedor_id).maybeSingle();
      if (vend) {
        await supabase.from("vendedores")
          .update({ vendas_mes: Math.max((vend.vendas_mes || 0) + delta, 0) })
          .eq("id", existente.vendedor_id);
      }
    }
  } else if (existente.vendedor_id && !eraCancelada && ficaCancelada) {
    const { data: vend } = await supabase.from("vendedores").select("vendas_mes, motos_vendidas").eq("id", existente.vendedor_id).maybeSingle();
    if (vend) {
      await supabase.from("vendedores").update({
        vendas_mes: Math.max((vend.vendas_mes || 0) - existente.valor, 0),
        motos_vendidas: Math.max((vend.motos_vendidas || 0) - 1, 0),
      }).eq("id", existente.vendedor_id);
    }
    if (existente.moto_id) {
      const { data: moto } = await supabase.from("motos").select("quantidade").eq("id", existente.moto_id).maybeSingle();
      if (moto) await supabase.from("motos").update({ quantidade: moto.quantidade + 1 }).eq("id", existente.moto_id);
      await recalcularStatusMoto(existente.moto_id);
    }
  } else if (existente.vendedor_id && eraCancelada && !ficaCancelada) {
    const { data: vend } = await supabase.from("vendedores").select("vendas_mes, motos_vendidas").eq("id", existente.vendedor_id).maybeSingle();
    if (vend) {
      await supabase.from("vendedores").update({
        vendas_mes: (vend.vendas_mes || 0) + valorValidado,
        motos_vendidas: (vend.motos_vendidas || 0) + 1,
      }).eq("id", existente.vendedor_id);
    }
    if (existente.moto_id) {
      const { data: moto } = await supabase.from("motos").select("quantidade").eq("id", existente.moto_id).maybeSingle();
      if (moto) await supabase.from("motos").update({ quantidade: Math.max(moto.quantidade - 1, 0) }).eq("id", existente.moto_id);
      await recalcularStatusMoto(existente.moto_id);
    }
  }

  const { data: atualizado, error } = await supabase
    .from("vendas")
    .update({
      cliente_nome: cliente_nome ?? existente.cliente_nome,
      cliente_telefone: cliente_telefone ?? existente.cliente_telefone,
      cliente_cpf: cliente_cpf ?? existente.cliente_cpf,
      moto_descricao: moto_descricao ?? existente.moto_descricao,
      valor: valorValidado,
      forma_pagamento: forma_pagamento ?? existente.forma_pagamento,
      observacoes: observacoes ?? existente.observacoes,
      status: novoStatus,
    })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) throw error;

  res.json(atualizado);
}));

app.delete("/api/vendas/:id", exigirAdmin, wrap(async (req, res) => {
  const { data: existente, error: errBusca } = await supabase
    .from("vendas").select("*").eq("id", req.params.id).maybeSingle();
  if (errBusca) throw errBusca;
  if (!existente) return res.status(404).json({ erro: "Venda não encontrada" });

  // Desfaz os efeitos da venda (estoque e estatísticas do vendedor) antes
  // de remover o registro, igual já era feito ao trocar o status para Cancelada.
  if (existente.status !== "Cancelada") {
    if (existente.vendedor_id) {
      const { data: vend } = await supabase.from("vendedores").select("vendas_mes, motos_vendidas").eq("id", existente.vendedor_id).maybeSingle();
      if (vend) {
        await supabase.from("vendedores").update({
          vendas_mes: Math.max((vend.vendas_mes || 0) - existente.valor, 0),
          motos_vendidas: Math.max((vend.motos_vendidas || 0) - 1, 0),
        }).eq("id", existente.vendedor_id);
      }
    }
    if (existente.moto_id) {
      const { data: moto } = await supabase.from("motos").select("quantidade").eq("id", existente.moto_id).maybeSingle();
      if (moto) await supabase.from("motos").update({ quantidade: moto.quantidade + 1 }).eq("id", existente.moto_id);
      await recalcularStatusMoto(existente.moto_id);
    }
  }

  if (existente.cliente_id) {
    const { data: cliente } = await supabase.from("clientes").select("motos_compradas").eq("id", existente.cliente_id).maybeSingle();
    if (cliente) {
      await supabase.from("clientes")
        .update({ motos_compradas: Math.max((cliente.motos_compradas || 0) - 1, 0) })
        .eq("id", existente.cliente_id);
    }
  }

  const { error } = await supabase.from("vendas").delete().eq("id", req.params.id);
  if (error) throw error;
  res.status(204).end();
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
  const { data, error } = await supabase.from("vendedores").select("id, nome, meta");
  if (error) throw error;

  const statsMes = await statsMesPorVendedor();

  // O ranking é só um placar de desempenho entre vendedores: não precisa
  // expor e-mail, telefone ou comissão de ninguém para montar isso.
  const ranking = data
    .map((v) => {
      const vendasMes = statsMes.get(v.id)?.faturamento || 0;
      return {
        id: v.id,
        nome: v.nome,
        vendas_mes: vendasMes,
        motos_vendidas: statsMes.get(v.id)?.unidades || 0,
        meta: v.meta || 0,
        percentual: v.meta > 0 ? Math.round((vendasMes / v.meta) * 100) : 0,
      };
    })
    .sort((a, b) => b.vendas_mes - a.vendas_mes)
    .map((v, i) => ({ ...v, posicao: i + 1 }));
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
    .select("id, nome, meta");
  if (errVend) throw errVend;

  const { dentroDoPeriodo, mesesNoPeriodo } = resolverPeriodo(req.query.periodo);
  const statsMes = await statsMesPorVendedor(dentroDoPeriodo);

  const totais = vendedoresData.reduce(
    (acc, v) => {
      const stats = statsMes.get(v.id);
      return {
        faturamento: acc.faturamento + (stats?.faturamento || 0),
        unidades: acc.unidades + (stats?.unidades || 0),
        meta: acc.meta + (v.meta || 0) * mesesNoPeriodo,
      };
    },
    { faturamento: 0, unidades: 0, meta: 0 }
  );

  const topVendedores = vendedoresData
    .map((v) => ({
      id: v.id,
      nome: v.nome,
      vendas_mes: statsMes.get(v.id)?.faturamento || 0,
      motos_vendidas: statsMes.get(v.id)?.unidades || 0,
    }))
    .sort((a, b) => b.vendas_mes - a.vendas_mes)
    .slice(0, 4);

  const agora = new Date();

  // Busca um lote recente e filtra em memória pro período escolhido, senão a
  // tabela de "últimas vendas" mistura vendas de outros meses junto com as
  // do período atual sempre que há menos de 5 vendas nele.
  const { data: recentesRaw, error: errUltimas } = await supabase
    .from("vendas")
    .select("*, vendedores(nome)")
    .order("id", { ascending: false })
    .limit(200);
  if (errUltimas) throw errUltimas;

  const ultimasVendasRaw = recentesRaw
    .filter((v) => {
      const partes = String(v.data || "").split("/");
      if (partes.length !== 3) return false;
      const [, mm, yyyy] = partes;
      return dentroDoPeriodo(Number(mm), Number(yyyy));
    })
    .slice(0, 5);

  const { data: todasVendas, error: errTodasVendas } = await supabase
    .from("vendas")
    .select("valor, data, status");
  if (errTodasVendas) throw errTodasVendas;

  const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
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
