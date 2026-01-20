// ---- Supabase klient ----
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://ebrxolwhgibtoaahipis.supabase.co"
const supabaseAnonKey = "sb_publishable_9vr6nvi6NxoNhnDbvIH2qw_RkPDuewr"

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ---- "uživatelská databáze" ----
const USERS = [
   { username: "spravce", password: "spravce", role: "accountant" },
   { username: "uzivatel", password: "uzivatel", role: "user" }
];
let currentUser = null;
let invoices = [];

// ---- načtení faktur ze Supabase ----
async function loadInvoices() {
    const { data, error } = await supabase.from('invoices').select('*')
    if (error) {
        console.error('Supabase error:', error)
        invoices = []
    } else {
        invoices = data
    }
}

// ---- přidání faktury do Supabase ----
async function saveInvoice(inv) {
    const { data, error } = await supabase.from('invoices').insert([inv])
    if (error) console.error('Insert error:', error)
}

// ---- pomocné funkce ----
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
   if (currentUser.role === "accountant") return invoices;
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
<td>${parseFloat(inv.amount).toFixed(2)}</td>
<td>${formatDate(inv.issue_date)}</td>
<td>${formatDate(inv.due_date)}</td>
<td>${inv.status === "paid" ? "Zaplaceno" : "Nezaplaceno"}</td>
<td>${inv.owner}</td>
<td>
<button data-index="${index}" class="toggle-status-btn">
                   Přepnout status
</button>
</td>`;
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
<td>${parseFloat(inv.amount).toFixed(2)}</td>
<td>${formatDate(inv.due_date)}</td>
<td>${inv.status === "paid" ? "Zaplaceno" : "Nezaplaceno"}</td>`;
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
       sums[key] += parseFloat(inv.amount);
   });
   Object.keys(sums).sort().forEach(month => {
       const tr = document.createElement("tr");
       tr.innerHTML = `
<td>${month}</td>
<td>${sums[month].toFixed(2)}</td>`;
       tbody.appendChild(tr);
   });
}

async function redrawAll() {
   await loadInvoices();
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
async function handleInvoiceSubmit(ev) {
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
   const inv = {
       number,
       client,
       amount,
       issue_date: issueDate,
       due_date: dueDate,
       status,
       owner: currentUser.username
   };
   await saveInvoice(inv);
   redrawAll();
   document.getElementById("invoice-form").reset();
}

// ---- přepínání statusu ----
async function handleToggleStatus(ev) {
   const btn = ev.target.closest(".toggle-status-btn");
   if (!btn) return;
   const index = parseInt(btn.dataset.index, 10);
   const visible = getVisibleInvoices();
   const inv = visible[index];
   if (!inv) return;

   const newStatus = inv.status === "paid" ? "unpaid" : "paid";
   const { error } = await supabase
       .from('invoices')
       .update({ status: newStatus })
       .eq('id', inv.id);
   if (error) console.error('Update error:', error);
   redrawAll();
}

// ---- inicializace ----
document.addEventListener("DOMContentLoaded", () => {
   document.getElementById("login-form").addEventListener("submit", handleLogin);
   document.getElementById("logout-btn").addEventListener("click", handleLogout);
   document.getElementById("invoice-form").addEventListener("submit", handleInvoiceSubmit);
   document.getElementById("invoice-body").addEventListener("click", handleToggleStatus);
});
