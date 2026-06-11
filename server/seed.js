// =========================================================
// CRM AVELLOZ - Popula o banco (Supabase) com dados iniciais
// =========================================================

const supabase = require("./supabaseClient");

const vendedores = [
  { nome: "Carlos Mendes", email: "carlos@avelloz.com", telefone: "(11) 98888-1111", meta: 60000, comissao: 3, vendas_mes: 168000, motos_vendidas: 14 },
  { nome: "Juliana Alves", email: "juliana@avelloz.com", telefone: "(11) 98888-2222", meta: 60000, comissao: 3, vendas_mes: 132000, motos_vendidas: 11 },
  { nome: "Pedro Souza", email: "pedro@avelloz.com", telefone: "(11) 98888-3333", meta: 50000, comissao: 2.5, vendas_mes: 104000, motos_vendidas: 9 },
  { nome: "Marina Costa", email: "marina@avelloz.com", telefone: "(11) 98888-4444", meta: 50000, comissao: 2.5, vendas_mes: 83000, motos_vendidas: 8 },
  { nome: "Rafael Tavares", email: "rafael@avelloz.com", telefone: "(11) 98888-5555", meta: 50000, comissao: 2.5, vendas_mes: 56000, motos_vendidas: 5 },
  { nome: "Tatiane Borges", email: "tatiane@avelloz.com", telefone: "(11) 98888-6666", meta: 50000, comissao: 2.5, vendas_mes: 42000, motos_vendidas: 4 },
];

const clientes = [
  { nome: "Roberto Lima", telefone: "(11) 99876-1234", email: "roberto.lima@email.com", cpf: "123.456.789-00", ultima_compra: "11/06/2026", motos_compradas: 1 },
  { nome: "Fernanda Dias", telefone: "(11) 98765-4321", email: "fernanda.dias@email.com", cpf: "234.567.890-11", ultima_compra: "11/06/2026", motos_compradas: 1 },
  { nome: "André Rocha", telefone: "(11) 97654-3210", email: "andre.rocha@email.com", cpf: "345.678.901-22", ultima_compra: "10/06/2026", motos_compradas: 2 },
  { nome: "Patrícia Nunes", telefone: "(11) 96543-2109", email: "patricia.nunes@email.com", cpf: "456.789.012-33", ultima_compra: "10/06/2026", motos_compradas: 1 },
  { nome: "Lucas Martins", telefone: "(11) 95432-1098", email: "lucas.martins@email.com", cpf: "567.890.123-44", ultima_compra: "09/06/2026", motos_compradas: 3 },
];

const motos = [
  { modelo: "CG 160 Titan", marca: "Honda", ano: 2026, cor: "Vermelha", valor: 14500, quantidade: 8, status: "Disponível" },
  { modelo: "Fazer 250", marca: "Yamaha", ano: 2025, cor: "Azul", valor: 19900, quantidade: 5, status: "Disponível" },
  { modelo: "Biz 125", marca: "Honda", ano: 2026, cor: "Branca", valor: 12300, quantidade: 2, status: "Estoque Baixo" },
  { modelo: "PCX 160", marca: "Honda", ano: 2025, cor: "Preta", valor: 18700, quantidade: 0, status: "Esgotado" },
  { modelo: "XTZ 150 Crosser", marca: "Yamaha", ano: 2025, cor: "Verde", valor: 16200, quantidade: 6, status: "Disponível" },
  { modelo: "Meteor 350", marca: "Royal Enfield", ano: 2025, cor: "Cinza", valor: 28900, quantidade: 3, status: "Reservada" },
];

async function seed() {
  const { count, error: errCount } = await supabase.from("vendedores").select("*", { count: "exact", head: true });
  if (errCount) throw errCount;

  if (count > 0) {
    console.log("O banco já possui dados. Seed não executado.");
    return;
  }

  const { data: vendedoresInseridos, error: errV } = await supabase.from("vendedores").insert(vendedores).select();
  if (errV) throw errV;

  const { data: clientesInseridos, error: errC } = await supabase.from("clientes").insert(clientes).select();
  if (errC) throw errC;

  const { data: motosInseridas, error: errM } = await supabase.from("motos").insert(motos).select();
  if (errM) throw errM;

  const idVendedor = (i) => vendedoresInseridos[i - 1].id;
  const idCliente = (i) => clientesInseridos[i - 1].id;
  const idMoto = (i) => motosInseridas[i - 1].id;

  const vendas = [
    { cliente_id: idCliente(1), cliente_nome: "Roberto Lima", cliente_telefone: "(11) 99876-1234", cliente_cpf: "123.456.789-00", vendedor_id: idVendedor(1), moto_id: idMoto(1), moto_descricao: "Honda CG 160 Titan", valor: 14500, forma_pagamento: "À vista", observacoes: "", status: "Concluída", data: "11/06/2026" },
    { cliente_id: idCliente(2), cliente_nome: "Fernanda Dias", cliente_telefone: "(11) 98765-4321", cliente_cpf: "234.567.890-11", vendedor_id: idVendedor(2), moto_id: idMoto(2), moto_descricao: "Yamaha Fazer 250", valor: 19900, forma_pagamento: "Financiamento", observacoes: "", status: "Financiamento", data: "11/06/2026" },
    { cliente_id: idCliente(3), cliente_nome: "André Rocha", cliente_telefone: "(11) 97654-3210", cliente_cpf: "345.678.901-22", vendedor_id: idVendedor(3), moto_id: idMoto(3), moto_descricao: "Honda Biz 125", valor: 12300, forma_pagamento: "À vista", observacoes: "", status: "Concluída", data: "10/06/2026" },
    { cliente_id: idCliente(4), cliente_nome: "Patrícia Nunes", cliente_telefone: "(11) 96543-2109", cliente_cpf: "456.789.012-33", vendedor_id: idVendedor(4), moto_id: idMoto(4), moto_descricao: "Honda PCX 160", valor: 18700, forma_pagamento: "Cartão de Crédito", observacoes: "", status: "Aguardando pagamento", data: "10/06/2026" },
    { cliente_id: idCliente(5), cliente_nome: "Lucas Martins", cliente_telefone: "(11) 95432-1098", cliente_cpf: "567.890.123-44", vendedor_id: idVendedor(1), moto_id: idMoto(5), moto_descricao: "Yamaha XTZ 150 Crosser", valor: 16200, forma_pagamento: "À vista", observacoes: "", status: "Concluída", data: "09/06/2026" },
  ];
  const { error: errVendas } = await supabase.from("vendas").insert(vendas);
  if (errVendas) throw errVendas;

  const agenda = [
    { data: "11/06/2026", hora: "09:00", titulo: "Test-drive · Honda CG 160 Titan", descricao: "Cliente: Roberto Lima", vendedor_id: idVendedor(1), status: "Confirmado" },
    { data: "11/06/2026", hora: "11:30", titulo: "Entrega de moto · Yamaha Fazer 250", descricao: "Cliente: Fernanda Dias", vendedor_id: idVendedor(2), status: "Agendado" },
    { data: "11/06/2026", hora: "14:00", titulo: "Reunião · Renovação de financiamento", descricao: "Cliente: André Rocha", vendedor_id: idVendedor(3), status: "Pendente" },
    { data: "11/06/2026", hora: "16:30", titulo: "Test-drive · Honda PCX 160", descricao: "Cliente: Patrícia Nunes", vendedor_id: idVendedor(4), status: "Confirmado" },
    { data: "12/06/2026", hora: "10:00", titulo: "Test-drive · Yamaha XTZ 150 Crosser", descricao: "Cliente: Lucas Martins", vendedor_id: idVendedor(1), status: "Confirmado" },
    { data: "12/06/2026", hora: "15:00", titulo: "Visita técnica · Revisão pós-venda", descricao: "Cliente: Tatiane Borges", vendedor_id: idVendedor(4), status: "Agendado" },
    { data: "15/06/2026", hora: "09:30", titulo: "Reunião de equipe · Metas da semana", descricao: "Todos os vendedores", vendedor_id: null, status: "Agendado" },
  ];
  const { error: errAgenda } = await supabase.from("agenda").insert(agenda);
  if (errAgenda) throw errAgenda;

  console.log("Banco populado com sucesso!");
}

seed().catch((erro) => {
  console.error("Erro ao popular o banco:", erro);
  process.exit(1);
});
