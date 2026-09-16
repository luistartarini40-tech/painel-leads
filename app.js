// ============================================================
// Cole aqui a URL do seu Web App do Google Apps Script.
// Você pega essa URL depois de fazer o "Implantar" no Apps Script
// (veja o passo a passo enviado junto com estes arquivos).
// ============================================================
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxBjAUa44rVucJeV1_Iutc4zK8zPZhYVSM60XjtwJHrB-J_ibISaNX_ddAIhjCROsH2nA/exec";

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchSheet(sheetKey) {
  const res = await fetch(`${APPS_SCRIPT_URL}?sheet=${sheetKey}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data || [];
}

async function postAction(payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

function setStatus(elId, msg) {
  document.getElementById(elId).textContent = msg;
}

function isLeadQuente(lead) {
  const semSite = !lead.Site || String(lead.Site).trim() === "";
  const nota = parseFloat(String(lead.Nota).replace(",", "."));
  const notaBaixa = !isNaN(nota) && nota < 4.0;
  return semSite || notaBaixa;
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR");
}

async function loadLeads() {
  setStatus("leads-status", "Carregando...");
  try {
    const leads = await fetchSheet("leads");
    const tbody = document.querySelector("#leads-table tbody");
    tbody.innerHTML = "";

    leads.forEach((lead) => {
      const tr = document.createElement("tr");
      if (isLeadQuente(lead)) tr.classList.add("lead-quente");

      const siteCell = lead.Site
        ? `<a href="${escapeHtml(lead.Site)}" target="_blank" rel="noopener">site</a>`
        : "-";

      tr.innerHTML = `
        <td>${escapeHtml(lead.Nome)}</td>
        <td>${escapeHtml(lead.Endereco)}</td>
        <td>${escapeHtml(lead.Telefone)}</td>
        <td>${siteCell}</td>
        <td>${escapeHtml(lead.Nota) || "-"}</td>
        <td></td>
      `;

      const btn = document.createElement("button");
      btn.className = "btn-mini";
      btn.textContent = "Virar cliente";
      btn.addEventListener("click", () => promoteToCliente(lead));
      tr.lastElementChild.appendChild(btn);

      tbody.appendChild(tr);
    });

    setStatus("leads-status", `${leads.length} leads carregados.`);
  } catch (err) {
    setStatus("leads-status", "Erro ao carregar: " + err.message);
  }
}

async function promoteToCliente(lead) {
  try {
    await postAction({
      action: "addCliente",
      cliente: { Nome: lead.Nome, Telefone: lead.Telefone, Status: "Negociando" },
    });
    alert(`${lead.Nome} adicionado à aba Clientes.`);
    loadClientes();
  } catch (err) {
    alert("Erro ao adicionar cliente: " + err.message);
  }
}

async function loadClientes() {
  setStatus("clientes-status", "Carregando...");
  try {
    const clientes = await fetchSheet("clientes");
    const tbody = document.querySelector("#clientes-table tbody");
    tbody.innerHTML = "";

    clientes.forEach((cliente) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(cliente.Nome)}</td>
        <td>${escapeHtml(cliente.Telefone)}</td>
        <td></td>
        <td>${formatDate(cliente.DataAtualizacao)}</td>
      `;

      const select = document.createElement("select");
      select.className = "status-select";
      ["Negociando", "Fechado", "Perdido"].forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        if (cliente.Status === opt) option.selected = true;
        select.appendChild(option);
      });
      select.addEventListener("change", () => updateStatus(cliente, select.value));
      tr.children[2].appendChild(select);

      tbody.appendChild(tr);
    });

    setStatus("clientes-status", `${clientes.length} clientes carregados.`);
  } catch (err) {
    setStatus("clientes-status", "Erro ao carregar: " + err.message);
  }
}

async function updateStatus(cliente, novoStatus) {
  try {
    await postAction({
      action: "updateClienteStatus",
      nome: cliente.Nome,
      telefone: cliente.Telefone,
      status: novoStatus,
    });
    loadClientes();
  } catch (err) {
    alert("Erro ao atualizar status: " + err.message);
  }
}

async function loadServicos() {
  setStatus("servicos-status", "Carregando...");
  try {
    const servicos = await fetchSheet("servicos");
    const tbody = document.querySelector("#servicos-table tbody");
    tbody.innerHTML = "";

    servicos.forEach((s) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(s.Servico)}</td>
        <td>${escapeHtml(s.Descricao)}</td>
        <td>${escapeHtml(s.Preco)}</td>
      `;
      tbody.appendChild(tr);
    });

    setStatus("servicos-status", `${servicos.length} serviços carregados.`);
  } catch (err) {
    setStatus("servicos-status", "Erro ao carregar: " + err.message);
  }
}

document.getElementById("refresh-leads").addEventListener("click", loadLeads);
document.getElementById("refresh-clientes").addEventListener("click", loadClientes);
document.getElementById("refresh-servicos").addEventListener("click", loadServicos);

loadLeads();
loadClientes();
loadServicos();
