// ---- "uživatelská databáze" ----
const USERS = [
   { username: "spravce", password: "spravce", role: "accountant" },
   { username: "uzivatel", password: "uzivatel", role: "user" }
];
let currentUser = null;
let invoices = []; // budeme držet v paměti + localStorage
// ---- pomocné funkce ----
function loadInvoices() {
   const data = localStorage.getItem("invoices");
   if (data) {
       invoices = JSON.parse(data);
   } else {
       invoices = []; // prázdné, můžeš doplnit demo
   }
}
function saveInvoices() {
   localStorage.setItem("invoices", JSON.stringify(invoices));
}
function formatDate(dStr) {
   if (!dStr) return "";
   const d = new Date(dStr);
   if (Number.isNaN(d.getTime())) return dStr;
   const y = d.getFullYear();
   const m = String(d.getMonth() + 1).padStart(2, "0");
   const day = String(d.getDate()).padStart(2, "0");
   return `${day}.${m}.${y}`;
}
function getVisibleInvoices() {
   if (!currentUser) return [];
   if (currentUser.role === "accountant") {
       return invoices;
   }
   return invoices.filter(inv => inv.owner === currentUser.username);
}
function isOverdue(inv) {
   if (inv.status === "paid") return false;
   const due = new Date(inv.due_date);
   const today = new Date();
   today.setHours(0,0,0,0);
   return due < today;
}
// ---- vykreslování ----
function renderInvoices() {
   const tbody = document.getElementById("invoice-body");
   tbody.innerHTML = "";
   const visible = getVisibleInvoices();
   visible.forEach((inv, index) => {
       const tr = document.createElement("tr");
       if (isOverdue(inv)) tr.classList.add("overdue");
       tr.innerHTML = `
<td>${inv.number}</td>
<td>${inv.client}</td>
<td>${inv.amount.toFixed(2)}</td>
<td>${formatDate(inv.issue_date)}</td>
<td>${formatDate(inv.due_date)}</td>
<td>${inv.status === "paid" ? "Zaplaceno" : "Nezaplaceno"}</td>
<td>${inv.owner}</td>
<td>
<button data-index="${index}" class="toggle-status-btn">
                   Přepnout status
</button>
</td>
       `;
       tbody.appendChild(tr);
   });
}
function renderOverdue() {
   const tbody = document.getElementById("overdue-body");
   tbody.innerHTML = "";
   const visible = getVisibleInvoices().filter(isOverdue);
   visible.forEach(inv => {
       const tr = document.createElement("tr");
       tr.innerHTML = `
<td>${inv.number}</td>
<td>${inv.client}</td>
<td>${inv.amount.toFixed(2)}</td>
<td>${formatDate(inv.due_date)}</td>
<td>${inv.status === "paid" ? "Zaplaceno" : "Nezaplaceno"}</td>
       `;
       tbody.appendChild(tr);
   });
}
function renderMonthlyReport() {
   const tbody = document.getElementById("report-body");
   tbody.innerHTML = "";
   const visible = getVisibleInvoices().filter(inv => inv.status === "paid");
   const sums = {};
   visible.forEach(inv => {
       const d = new Date(inv.issue_date);
       if (Number.isNaN(d.getTime())) return;
       const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}`;
       if (!sums[key]) sums[key] = 0;
       sums[key] += inv.amount;
   });
   Object.keys(sums).sort().forEach(month => {
       const tr = document.createElement("tr");
       tr.innerHTML = `
<td>${month}</td>
<td>${sums[month].toFixed(2)}</td>
       `;
       tbody.appendChild(tr);
   });
}
function redrawAll() {
   renderInvoices();
   renderOverdue();
   renderMonthlyReport();
}
// ---- login / logout ----
function handleLogin(ev) {
   ev.preventDefault();
   const u = document.getElementById("login-username").value.trim();
   const p = document.getElementById("login-password").value.trim();
   const found = USERS.find(x => x.username === u && x.password === p);
   if (!found) {
       alert("Špatné jméno nebo heslo.");
       return;
   }
   currentUser = found;
   document.getElementById("current-user").textContent = currentUser.username;
   document.getElementById("current-role").textContent =
       currentUser.role === "accountant" ? "správce (accountant)" : "uživatel";
   document.getElementById("login-section").classList.add("hidden");
   document.getElementById("app-section").classList.remove("hidden");
   redrawAll();
}
function handleLogout() {
   currentUser = null;
   document.getElementById("login-form").reset();
   document.getElementById("login-section").classList.remove("hidden");
   document.getElementById("app-section").classList.add("hidden");
}
// ---- přidání faktury ----
function handleInvoiceSubmit(ev) {
   ev.preventDefault();
   if (!currentUser) return;
   const number = document.getElementById("inv-number").value.trim();
   const client = document.getElementById("inv-client").value.trim();
   const amount = parseFloat(document.getElementById("inv-amount").value);
   const issueDate = document.getElementById("inv-issue").value;
   const dueDate = document.getElementById("inv-due").value;
   const status = document.getElementById("inv-status").value;
   if (!number || !client || !issueDate || !dueDate || Number.isNaN(amount)) {
       alert("Vyplň prosím všechny údaje.");
       return;
   }
   invoices.push({
       number,
       client,
       amount,
       issue_date: issueDate,
       due_date: dueDate,
       status,
       owner: currentUser.username
   });
   saveInvoices();
   document.getElementById("invoice-form").reset();
   redrawAll();
}
// ---- přepínání statusu ----
function handleToggleStatus(ev) {
   const btn = ev.target.closest(".toggle-status-btn");
   if (!btn) return;
   const index = parseInt(btn.dataset.index, 10);
   const visible = getVisibleInvoices();
   const inv = visible[index];
   if (!inv) return;
   // najdeme reálný index v celkovém poli
   const realIndex = invoices.findIndex(i =>
       i.number === inv.number &&
       i.owner === inv.owner &&
       i.issue_date === inv.issue_date
   );
   if (realIndex === -1) return;
   invoices[realIndex].status = invoices[realIndex].status === "paid" ? "unpaid" : "paid";
   saveInvoices();
   redrawAll();
}
// ---- import CSV ----
function handleImport() {
   if (!currentUser) {
       alert("Nejdřív se přihlas.");
       return;
   }
   const fileInput = document.getElementById("csv-file");
   const file = fileInput.files[0];
   if (!file) {
       alert("Vyber CSV soubor.");
       return;
   }
   const reader = new FileReader();
   reader.onload = function(e) {
       const text = e.target.result;
       const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
       if (lines.length <= 1) {
           alert("Soubor je prázdný nebo chybí data.");
           return;
       }
       // první řádek = hlavička, přeskočíme
       let imported = 0;
       for (let i = 1; i < lines.length; i++) {
           const line = lines[i];
           const parts = line.split(/[;,]/); // povol ; i ,
           if (parts.length < 6) continue;
           const number = parts[0].trim();
           const client = parts[1].trim();
           const amount = parseFloat(parts[2].trim());
           const issueDate = parts[3].trim();
           const dueDate = parts[4].trim();
           const status = (parts[5].trim().toLowerCase() === "paid") ? "paid" : "unpaid";
           const owner = (parts[6] && parts[6].trim()) || currentUser.username;
           if (!number || !client || Number.isNaN(amount) || !issueDate || !dueDate) continue;
           invoices.push({
               number,
               client,
               amount,
               issue_date: issueDate,
               due_date: dueDate,
               status,
               owner
           });
           imported++;
       }
       saveInvoices();
       redrawAll();
       document.getElementById("import-result").textContent =
           `Naimportováno faktur: ${imported}`;
   };
   reader.readAsText(file, "utf-8");
}
// ---- inicializace ----
document.addEventListener("DOMContentLoaded", () => {
   loadInvoices();
   document.getElementById("login-form").addEventListener("submit", handleLogin);
   document.getElementById("logout-btn").addEventListener("click", handleLogout);
   document.getElementById("invoice-form").addEventListener("submit", handleInvoiceSubmit);
   document.getElementById("invoice-body").addEventListener("click", handleToggleStatus);
   document.getElementById("import-btn").addEventListener("click", handleImport);
});