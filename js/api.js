// =========================================================
// CRM AVELLOZ - Cliente da API (fetch wrappers)
// =========================================================

const API_BASE = "/api";

async function apiRequest(metodo, caminho, corpo) {
  const opcoes = { method: metodo, headers: {}, credentials: "same-origin" };

  if (corpo !== undefined) {
    opcoes.headers["Content-Type"] = "application/json";
    opcoes.body = JSON.stringify(corpo);
  }

  const resposta = await fetch(`${API_BASE}${caminho}`, opcoes);

  if (resposta.status === 401 && caminho !== "/login") {
    const pagina = window.location.pathname.split("/").pop() || "index.html";
    if (pagina !== "login.html") {
      window.location.href = "login.html";
      return new Promise(() => {});
    }
  }

  if (!resposta.ok) {
    const erro = await resposta.json().catch(() => ({}));
    throw new Error(erro.erro || `Erro na requisição (${resposta.status})`);
  }

  if (resposta.status === 204) return null;
  return resposta.json();
}

const API = {
  // Autenticação
  login: (dados) => apiRequest("POST", "/login", dados),
  logout: () => apiRequest("POST", "/logout"),
  obterSessao: () => apiRequest("GET", "/me"),

  // Vendedores
  listarVendedores: () => apiRequest("GET", "/vendedores"),
  criarVendedor: (dados) => apiRequest("POST", "/vendedores", dados),
  atualizarVendedor: (id, dados) => apiRequest("PUT", `/vendedores/${id}`, dados),
  excluirVendedor: (id) => apiRequest("DELETE", `/vendedores/${id}`),

  // Clientes
  listarClientes: () => apiRequest("GET", "/clientes"),
  obterCliente: (id) => apiRequest("GET", `/clientes/${id}`),
  criarCliente: (dados) => apiRequest("POST", "/clientes", dados),
  atualizarCliente: (id, dados) => apiRequest("PUT", `/clientes/${id}`, dados),
  excluirCliente: (id) => apiRequest("DELETE", `/clientes/${id}`),

  // Motos / Estoque
  listarMotos: () => apiRequest("GET", "/motos"),
  criarMoto: (dados) => apiRequest("POST", "/motos", dados),
  atualizarMoto: (id, dados) => apiRequest("PUT", `/motos/${id}`, dados),
  excluirMoto: (id) => apiRequest("DELETE", `/motos/${id}`),

  // Vendas
  listarVendas: (limite) => apiRequest("GET", `/vendas${limite ? `?limite=${limite}` : ""}`),
  registrarVenda: (dados) => apiRequest("POST", "/vendas", dados),

  // Agenda
  listarAgenda: () => apiRequest("GET", "/agenda"),
  criarAgenda: (dados) => apiRequest("POST", "/agenda", dados),
  atualizarAgenda: (id, dados) => apiRequest("PUT", `/agenda/${id}`, dados),
  excluirAgenda: (id) => apiRequest("DELETE", `/agenda/${id}`),

  // Ranking e Dashboard
  obterRanking: () => apiRequest("GET", "/ranking"),
  obterDashboard: () => apiRequest("GET", "/dashboard"),

  // Simulações
  salvarSimulacaoFinanciamento: (dados) => apiRequest("POST", "/simulacoes/financiamento", dados),
  salvarSimulacaoConsorcio: (dados) => apiRequest("POST", "/simulacoes/consorcio", dados),

  // Oficina
  listarOficina: (filtros) => {
    const p = new URLSearchParams(filtros || {}).toString();
    return apiRequest("GET", `/oficina${p ? "?" + p : ""}`);
  },
  criarOrdem: (dados) => apiRequest("POST", "/oficina", dados),
  atualizarOrdem: (id, dados) => apiRequest("PUT", `/oficina/${id}`, dados),
  excluirOrdem: (id) => apiRequest("DELETE", `/oficina/${id}`),
};
