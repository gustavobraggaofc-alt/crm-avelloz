// =========================================================
// CRM AVELLOZ - Script base
// =========================================================

// ---- Formatação de moeda (BRL) ----
function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ---- Conversão de texto em moeda BRL para número ----
function parseMoeda(texto) {
  if (typeof texto === "number") return texto;
  const limpo = String(texto || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  return Number(limpo) || 0;
}

// ---- Iniciais de um nome (para o avatar do header) ----
function iniciais(nome) {
  if (!nome) return "?";
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] || "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

// =========================================================
// ÍCONES SVG (estilo line-icon, desenhados à mão)
// =========================================================

const ICONS = {
  home: `<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>`,
  "dollar-sign": `<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`,
  users: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  motorcycle: `<circle cx="5.5" cy="17.5" r="2.5"/><circle cx="18.5" cy="17.5" r="2.5"/><path d="M5.5 17.5h6l3-6h4"/><path d="M11.5 17.5 13.5 13h3.5l1.5 4.5"/><path d="M14.5 11.5 16 9h2.5"/>`,
  "trending-up": `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>`,
  calendar: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  "file-text": `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  "log-out": `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>`,
  "chevron-right": `<polyline points="9 18 15 12 9 6"/>`,
  "chevron-down": `<polyline points="6 9 12 15 18 9"/>`,
  search: `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`,
  bell: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
  target: `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`,
  package: `<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>`,
  "user-plus": `<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>`,
  repeat: `<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>`,
  gift: `<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>`,
  lock: `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  layers: `<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>`,
  award: `<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>`,
  calculator: `<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>`,
  tool: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>`,
  "edit-2": `<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>`,
  "trash-2": `<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>`,
  eye: `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`,
  menu: `<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>`,
};

function svgIcone(nome, tamanho = 18) {
  const conteudo = ICONS[nome];
  if (!conteudo) return "";
  return `<svg class="icon" width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${conteudo}</svg>`;
}

// ---- Logotipo Avelloz (monograma "A") ----
const LOGO_SVG = `<svg viewBox="0 0 40 40" width="55%" height="55%" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M20 6 33 34H27L24.5 28H15.5L13 34H7L20 6ZM20 14 16.5 22H23.5L20 14Z"/></svg>`;

const FAVICON_SVG = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#1452A3"/><path fill-rule="evenodd" clip-rule="evenodd" d="M20 6 33 34H27L24.5 28H15.5L13 34H7L20 6ZM20 14 16.5 22H23.5L20 14Z" fill="#ffffff"/></svg>'
)}`;

function injetarFavicon() {
  if (document.querySelector("link[rel='icon']")) return;
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/svg+xml";
  link.href = FAVICON_SVG;
  document.head.appendChild(link);
}

// =========================================================
// MENU LATERAL
// =========================================================

const MENU_ITEMS = [
  { label: "Dashboard", icon: "home", page: "index.html" },
  { label: "Vender", icon: "dollar-sign", page: "vender.html" },
  { label: "Financiamento", icon: "calculator", page: "financiamento.html" },
  { label: "Clientes", icon: "users", page: "clientes.html" },
  { label: "Estoque", icon: "motorcycle", page: "estoque.html" },
  { label: "Oficina", icon: "tool", page: "oficina.html" },
  { label: "Ranking de Vendedores", icon: "trending-up", page: "ranking.html" },
  { label: "Agenda", icon: "calendar", page: "agenda.html" },
  { label: "Relatórios", icon: "file-text", page: "relatorios.html" },
  {
    label: "Administração",
    icon: "settings",
    children: [
      { label: "Cadastrar Vendedor", page: "admin.html" },
      { label: "Metas", page: "admin-metas.html" },
      { label: "Permissões", page: "admin-permissoes.html" },
      { label: "Configurações", page: "admin-config.html" },
    ],
  },
];

function renderizarMenu() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  const paginaAtual = window.location.pathname.split("/").pop() || "index.html";
  let html = `<span class="sidebar__section">Menu</span>`;

  MENU_ITEMS.forEach((item) => {
    if (item.children) {
      const filhoAtivo = item.children.some((c) => c.page === paginaAtual);

      html += `
        <div class="menu-group ${filhoAtivo ? "open" : ""}">
          <button type="button" class="menu-item menu-group__header ${filhoAtivo ? "active-parent" : ""}">
            <span class="menu-item__icon">${svgIcone(item.icon)}</span>
            <span class="menu-item__label">${item.label}</span>
            <span class="menu-group__chevron">${svgIcone("chevron-right", 16)}</span>
          </button>
          <div class="submenu ${filhoAtivo ? "open" : ""}">
            ${item.children
              .map(
                (c) => `
              <a href="${c.page}" class="menu-item ${c.page === paginaAtual ? "active" : ""}" data-page="${c.page}">
                ${c.label}
              </a>`
              )
              .join("")}
          </div>
        </div>
      `;
    } else {
      html += `
        <a href="${item.page}" class="menu-item ${item.page === paginaAtual ? "active" : ""}" data-page="${item.page}">
          <span class="menu-item__icon">${svgIcone(item.icon)}</span> ${item.label}
        </a>
      `;
    }
  });

  html += `
    <div class="sidebar__spacer"></div>
    <a href="#" id="link-sair" class="menu-item menu-item--sair">
      <span class="menu-item__icon">${svgIcone("log-out")}</span> Sair
    </a>
  `;

  sidebar.innerHTML = html;

  // Abre/fecha o submenu de Administração
  const grupo = sidebar.querySelector(".menu-group");
  if (grupo) {
    const cabecalho = grupo.querySelector(".menu-group__header");
    const submenu = grupo.querySelector(".submenu");
    cabecalho.addEventListener("click", () => {
      grupo.classList.toggle("open");
      submenu.classList.toggle("open");
    });
  }

  sidebar.querySelector("#link-sair").addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await API.logout();
    } catch {}
    window.location.href = "login.html";
  });
}

// =========================================================
// MENU MOBILE (gaveta lateral em telas pequenas)
// =========================================================

function configurarMenuMobile() {
  const header = document.querySelector(".header");
  const brand = document.querySelector(".header__brand");
  const sidebar = document.getElementById("sidebar");
  if (!header || !brand || !sidebar) return;
  if (document.querySelector(".header__menu-btn")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "header__menu-btn header__icon-btn";
  btn.title = "Abrir menu";
  btn.setAttribute("aria-label", "Abrir menu");
  btn.innerHTML = svgIcone("menu", 20);
  brand.prepend(btn);

  const backdrop = document.createElement("div");
  backdrop.className = "sidebar-backdrop";
  document.body.appendChild(backdrop);

  function abrirMenu() {
    sidebar.classList.add("is-open");
    backdrop.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function fecharMenu() {
    sidebar.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  btn.addEventListener("click", () => {
    sidebar.classList.contains("is-open") ? fecharMenu() : abrirMenu();
  });

  backdrop.addEventListener("click", fecharMenu);

  sidebar.addEventListener("click", (e) => {
    if (e.target.closest("a.menu-item")) fecharMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharMenu();
  });
}

// =========================================================
// PWA - manifesto, ícone e service worker (experiência de app)
// =========================================================

function configurarPWA() {
  const head = document.head;

  if (!document.querySelector("link[rel='manifest']")) {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "manifest.json";
    head.appendChild(link);
  }

  if (!document.querySelector("link[rel='apple-touch-icon']")) {
    const link = document.createElement("link");
    link.rel = "apple-touch-icon";
    link.href = "icon.svg";
    head.appendChild(link);
  }

  const metas = {
    "theme-color": "#1452A3",
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Avelloz CRM",
  };

  Object.entries(metas).forEach(([nome, conteudo]) => {
    if (document.querySelector(`meta[name='${nome}']`)) return;
    const meta = document.createElement("meta");
    meta.name = nome;
    meta.content = conteudo;
    head.appendChild(meta);
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
}

// =========================================================
// SESSÃO - verifica login e personaliza o header
// =========================================================

async function verificarSessao() {
  const pagina = window.location.pathname.split("/").pop() || "index.html";
  if (pagina === "login.html") return;

  try {
    const usuario = await API.obterSessao();
    const nomeEl = document.querySelector(".header__user span");
    const avatarEl = document.querySelector(".header__avatar");
    if (nomeEl) nomeEl.textContent = `Olá, ${usuario.nome.split(" ")[0]}`;
    if (avatarEl) avatarEl.textContent = iniciais(usuario.nome);
    popularDropdownUsuario(usuario);
  } catch {
    window.location.href = "login.html";
  }
}

// =========================================================
// USER DROPDOWN (painel de conta no header)
// =========================================================

function configurarDropdownUsuario() {
  const userBtn = document.querySelector(".header__user");
  if (!userBtn) return;

  userBtn.setAttribute("role", "button");
  userBtn.setAttribute("tabindex", "0");
  userBtn.setAttribute("aria-haspopup", "true");
  userBtn.setAttribute("aria-expanded", "false");

  const dropdown = document.createElement("div");
  dropdown.className = "user-dropdown";
  dropdown.id = "user-dropdown";
  dropdown.setAttribute("hidden", "");
  dropdown.innerHTML = `
    <div class="user-dropdown__perfil">
      <div class="user-dropdown__avatar-lg" id="dd-avatar">--</div>
      <div class="user-dropdown__info">
        <strong class="user-dropdown__nome" id="dd-nome">Carregando…</strong>
        <span class="user-dropdown__email" id="dd-email"></span>
        <span class="user-dropdown__role-badge" id="dd-role">Vendedor</span>
      </div>
    </div>
    <div class="user-dropdown__sep"></div>
    <a href="admin-config.html" class="user-dropdown__item" id="dd-config">
      ${svgIcone("settings", 16)} Configurações
    </a>
    <div class="user-dropdown__sep"></div>
    <button type="button" class="user-dropdown__item" id="dd-trocar">
      ${svgIcone("repeat", 16)} Trocar de conta
    </button>
    <button type="button" class="user-dropdown__item user-dropdown__item--danger" id="dd-sair">
      ${svgIcone("log-out", 16)} Sair
    </button>
  `;
  document.body.appendChild(dropdown);

  function abrirDropdown() {
    dropdown.removeAttribute("hidden");
    userBtn.classList.add("is-open");
    userBtn.setAttribute("aria-expanded", "true");
  }

  function fecharDropdown() {
    dropdown.setAttribute("hidden", "");
    userBtn.classList.remove("is-open");
    userBtn.setAttribute("aria-expanded", "false");
  }

  userBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.hasAttribute("hidden") ? abrirDropdown() : fecharDropdown();
  });

  userBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrirDropdown(); }
    if (e.key === "Escape") fecharDropdown();
  });

  document.addEventListener("click", () => fecharDropdown());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharDropdown(); });
  dropdown.addEventListener("click", (e) => e.stopPropagation());

  async function fazerLogout(e) {
    e.preventDefault();
    try { await API.logout(); } catch {}
    window.location.href = "login.html";
  }

  dropdown.querySelector("#dd-trocar").addEventListener("click", fazerLogout);
  dropdown.querySelector("#dd-sair").addEventListener("click", fazerLogout);
}

function popularDropdownUsuario(usuario) {
  const ddAvatar = document.getElementById("dd-avatar");
  const ddNome = document.getElementById("dd-nome");
  const ddEmail = document.getElementById("dd-email");
  const ddRole = document.getElementById("dd-role");
  if (!ddAvatar) return;

  ddAvatar.textContent = iniciais(usuario.nome);
  ddNome.textContent = usuario.nome;
  ddEmail.textContent = usuario.email;

  const ehAdmin = usuario.role === "admin";
  ddRole.textContent = ehAdmin ? "Administrador" : "Vendedor";
  if (ehAdmin) ddRole.classList.add("user-dropdown__role-badge--admin");
}

// =========================================================
// HEADER - logotipo, busca e notificações
// =========================================================

function aprimorarHeader() {
  const logo = document.querySelector(".header__logo");
  if (logo) logo.innerHTML = LOGO_SVG;

  const userBox = document.querySelector(".header__user");
  if (userBox && !document.querySelector(".header__search")) {
    userBox.insertAdjacentHTML(
      "beforebegin",
      `
      <label class="header__search">
        ${svgIcone("search", 16)}
        <input type="text" placeholder="Buscar cliente, moto ou venda..." />
      </label>
      <button type="button" class="header__icon-btn" title="Notificações">
        ${svgIcone("bell", 18)}
        <span class="header__badge"></span>
      </button>
    `
    );

    userBox.insertAdjacentHTML(
      "beforeend",
      `<span class="header__chevron">${svgIcone("chevron-down", 16)}</span>`
    );
  }
}

// =========================================================
// MODAL (popup de formulários)
// =========================================================

function abrirModal(titulo, conteudoHTML) {
  let overlay = document.getElementById("modal-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "modal-overlay";
    overlay.className = "modal-overlay";
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) fecharModal();
    });
  }

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <h2>${titulo}</h2>
        <button type="button" class="modal__close" aria-label="Fechar">&times;</button>
      </div>
      <div class="modal__body">${conteudoHTML}</div>
    </div>
  `;

  overlay.classList.add("is-open");
  overlay.querySelector(".modal__close").addEventListener("click", fecharModal);
  document.body.style.overflow = "hidden";
}

function fecharModal() {
  const overlay = document.getElementById("modal-overlay");
  if (!overlay) return;
  overlay.classList.remove("is-open");
  overlay.innerHTML = "";
  document.body.style.overflow = "";
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") fecharModal();
});

// =========================================================
// SUBSTITUIÇÃO DE EMOJIS POR ÍCONES SVG
// =========================================================

const SUBSTITUICOES_ICONES = {
  ".icon-badge": {
    "🛵": "motorcycle",
    "📦": "package",
    "💰": "dollar-sign",
    "🎯": "target",
    "👥": "users",
    "🆕": "user-plus",
    "🔁": "repeat",
    "🎂": "gift",
    "🏍️": "motorcycle",
    "🧩": "layers",
    "🔒": "lock",
  },
  ".report-card__icon": {
    "💰": "dollar-sign",
    "🏆": "award",
    "🏍️": "motorcycle",
    "👥": "users",
    "🎯": "target",
    "📅": "calendar",
  },
  ".btn--icon": {
    "✏️": "edit-2",
    "🗑️": "trash-2",
    "👁️": "eye",
  },
};

const TAMANHOS_ICONES = {
  ".icon-badge": 20,
  ".report-card__icon": 24,
  ".btn--icon": 16,
};

const MEDALHAS = { "🥇": "gold", "🥈": "silver", "🥉": "bronze" };

function substituirIcones() {
  Object.entries(SUBSTITUICOES_ICONES).forEach(([seletor, mapa]) => {
    document.querySelectorAll(seletor).forEach((el) => {
      const texto = el.textContent.trim();
      if (mapa[texto]) {
        el.innerHTML = svgIcone(mapa[texto], TAMANHOS_ICONES[seletor]);
      }
    });
  });

  document.querySelectorAll(".podio__medal").forEach((el) => {
    const cor = MEDALHAS[el.textContent.trim()];
    if (cor) {
      el.innerHTML = svgIcone("award", 24);
      el.classList.add(`podio__medal--${cor}`);
    }
  });
}

// =========================================================
// INICIALIZAÇÃO
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
  injetarFavicon();
  configurarPWA();
  verificarSessao();
  renderizarMenu();
  aprimorarHeader();
  configurarDropdownUsuario();
  configurarMenuMobile();
  substituirIcones();
});
