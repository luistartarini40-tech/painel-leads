// ============================================================
// Cole aqui a URL do seu Web App do Google Apps Script.
// Você pega essa URL depois de fazer o "Implantar" no Apps Script
// (veja o passo a passo enviado junto com estes arquivos).
// ============================================================
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxBjAUa44rVucJeV1_Iutc4zK8zPZhYVSM60XjtwJHrB-J_ibISaNX_ddAIhjCROsH2nA/exec";

const STATUS_OPCOES = ["Preciso entrar em contato", "Negociando", "Fechado", "Perdido"];

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

function temSite(lead) {
  return Boolean(lead.Site && String(lead.Site).trim() !== "");
}

function leadEstaQuebrado(lead) {
  // "nao deu certo" na coleta: faltou nome ou telefone
  const semNome = !lead.Nome || String(lead.Nome).trim() === "";
  const semTelefone = !lead.Telefone || String(lead.Telefone).trim() === "";
  return semNome || semTelefone;
}

function notaBaixa(lead) {
  const nota = parseFloat(String(lead.Nota).replace(",", "."));
  return !isNaN(nota) && nota < 4.0;
}

function isSameDay(dateValue) {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return false;
  const hoje = new Date();
  return (
    d.getFullYear() === hoje.getFullYear() &&
    d.getMonth() === hoje.getMonth() &&
    d.getDate() === hoje.getDate()
  );
}

async function loadLeads() {
  setStatus("leads-status", "Carregando...");
  try {
    const todos = await fetchSheet("leads");

    // Esconde automaticamente: quem ja tem site, e quem veio quebrado
    // da coleta (faltou nome ou telefone). Continuam guardados na
    // planilha, so nao aparecem aqui pra nao poluir sua tela.
    const leads = todos.filter((lead) => !temSite(lead) && !leadEstaQuebrado(lead));

    const tbody = document.querySelector("#leads-table tbody");
    tbody.innerHTML = "";

    leads.forEach((lead) => {
      const tr = document.createElement("tr");
      if (notaBaixa(lead)) tr.classList.add("lead-quente");

      tr.innerHTML = `
        <td>${escapeHtml(lead.Nome)}</td>
        <td>${escapeHtml(lead.Endereco)}</td>
        <td>${escapeHtml(lead.Telefone)}</td>
        <td>${escapeHtml(lead.Nicho) || "-"}</td>
        <td>${escapeHtml(lead.Nota) || "-"}</td>
        <td class="acoes"></td>
      `;

      const btnCliente = document.createElement("button");
      btnCliente.className = "btn-mini";
      btnCliente.textContent = "Virar cliente";
      btnCliente.addEventListener("click", () => promoteToCliente(lead));

      const btnDescartar = document.createElement("button");
      btnDescartar.className = "btn-mini btn-mini-danger";
      btnDescartar.textContent = "Descartar";
      btnDescartar.addEventListener("click", () => discardLead(lead));

      const acoesCell = tr.querySelector(".acoes");
      acoesCell.appendChild(btnCliente);
      acoesCell.appendChild(btnDescartar);

      tbody.appendChild(tr);
    });

    setStatus(
      "leads-status",
      `${leads.length} leads pra trabalhar (de ${todos.length} coletados — os com site ou incompletos ficam escondidos).`
    );
  } catch (err) {
    setStatus("leads-status", "Erro ao carregar: " + err.message);
  }
}

async function promoteToCliente(lead) {
  try {
    await postAction({
      action: "addCliente",
      cliente: {
        Nome: lead.Nome,
        Endereco: lead.Endereco,
        Telefone: lead.Telefone,
        Nicho: lead.Nicho,
        Status: "Preciso entrar em contato",
      },
    });
    alert(`${lead.Nome} adicionado à aba Clientes.`);
    loadClientes();
  } catch (err) {
    alert("Erro ao adicionar cliente: " + err.message);
  }
}

async function discardLead(lead) {
  if (!confirm(`Descartar "${lead.Nome}"? Ele some da sua lista de leads.`)) return;
  try {
    await postAction({ action: "discardLead", nome: lead.Nome, endereco: lead.Endereco });
    loadLeads();
  } catch (err) {
    alert("Erro ao descartar: " + err.message);
  }
}

async function loadClientes() {
  setStatus("clientes-status", "Carregando...");
  try {
    const todos = await fetchSheet("clientes");

    // "Perdido" some sozinho da tela a partir do dia seguinte a quando
    // foi marcado (no mesmo dia ainda aparece, como confirmacao visual).
    const clientes = todos.filter((c) => !(c.Status === "Perdido" && !isSameDay(c.DataAtualizacao)));

    const tbody = document.querySelector("#clientes-table tbody");
    tbody.innerHTML = "";

    clientes.forEach((cliente) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(cliente.Nome)}</td>
        <td>${escapeHtml(cliente.Endereco)}</td>
        <td>${escapeHtml(cliente.Telefone)}</td>
        <td>${escapeHtml(cliente.Nicho) || "-"}</td>
        <td class="status-cell"></td>
      `;

      const select = document.createElement("select");
      select.className = "status-select";
      STATUS_OPCOES.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        if (cliente.Status === opt) option.selected = true;
        select.appendChild(option);
      });
      select.addEventListener("change", () => updateStatus(cliente, select.value));
      tr.querySelector(".status-cell").appendChild(select);

      tbody.appendChild(tr);
    });

    setStatus("clientes-status", `${clientes.length} clientes na tela.`);
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
