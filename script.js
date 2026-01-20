// ---- Konfigurace Supabase ----
const supabaseUrl = 'https://ebrxolwhgibtoaahipis.supabase.co';
const supabaseAnonKey = 'sb_publishable_9vr6nvi6NxoNhnDbvIH2qw_RkPDuewr';
const supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);

// ---- Uživatelé pro login ----
const USERS = [
  { username: "spravce", password: "spravce", role: "accountant" },
  { username: "uzivatel", password: "uzivatel", role: "user" }
];
let currentUser = null;
let invoices = [];

// ---- Funkce ----
function formatDate(dStr) {
  if (!dStr) return "";
  const d = new Date(dStr);
  if (Number.isNaN(d.getTime())) return dStr;
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

function isOverdue(inv) {
  if (inv.status === "paid") return false;
  const due = new Date(inv.due_date);
  const today = new Date();
  today.setHours(0,0,0,0);
  return due < today;
}

function getVisibleInvoices() {
  if (!currentUser) return [];
  if (currentUser.role === "accountant") return invoices;
  return invoices.filter(i => i.owner === currentUser.username);
}

// ---- Supabase načítání ----
async function loadInvoices() {
  const { data, error } = await supabase.from('invoices').select('*');
  if (error) {
    console.error('Supabase error:', error);
    invoices = [];
  } else {
    invoices = data;
  }
  redrawAll();
}

// ---- Supabase ukládání nové faktury ----
async function saveInvoice(inv) {
  const { data, error } = await supabase.from('invoices').insert([inv]);
  if (error) console.error('Insert error:', error);
  await loadInvoices();
}

// ---- Vykreslování ----
function renderInvoices() {
  const tbody = document.getElementById("invoice-body");
  tbody.innerHTML = "";
  getVisibleInvoices().forEach((inv, index) => {
    const tr = document.createElement("tr");
    if (isOverdue(inv)) tr.classList.add("overdue");
    tr.innerHTML = `
      <td>${inv.number}</td>
      <td>${inv.client}</td>
      <td>${inv.amount.toFixed(2)}</td>
      <td>${formatDate(inv.issue_date)}</td>
      <td>${formatDate(inv.due_date)}</td>
      <td>${inv.status==="paid"?"Zaplaceno":"Nezaplaceno"}</td>
      <td>${inv.owner}</td>
      <td>
        <button data-index="${index}" class="toggle-status-btn">Přepnout status</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderOverdue() {
  const tbody = document.getElementById("overdue-body");
  tbody.innerHTML = "";
  getVisibleInvoices().filter(isOverdue).forEach(inv => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${inv.number}</td>
      <td>${inv.client}</td>
      <td>${inv.amount.toFixed(2)}</td>
      <td>${formatDate(inv.due_date)}</td>
      <td>${inv.status==="paid"?"Zaplaceno":"Nezaplaceno"}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderMonthlyReport() {
  const tbody = document.getElementById("report-body");
  tbody.innerHTML = "";
  const sums = {};
  getVisibleInvoices().filter(i => i.status==="paid").forEach(inv => {
    const d = new Date(inv.issue_date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    sums[key] = (sums[key]||0)+inv.amount;
  });
  Object.keys(sums).sort().forEach(month => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${month}</td><td>${sums[month].toFixed(2)}</td>`;
    tbody.appendChild(tr);
  });
}

function redrawAll() {
  renderInvoices();
  renderOverdue();
  renderMonthlyReport();
}

// ---- Login / Logout ----
function handleLogin(ev){
  ev.preventDefault();
  const u = document.getElementById("login-username").value.trim();
  const p = document.getElementById("login-password").value.trim();
  const found = USERS.find(x=>x.username===u && x.password===p);
  if(!found){ alert("Špatné jméno nebo heslo."); return; }
  currentUser = found;
  document.getElementById("current-user").textContent = currentUser.username;
  document.getElementById("current-role").textContent = currentUser.role==="accountant"?"správce (accountant)":"uživatel";
  document.getElementById("login-section").classList.add("hidden");
  document.getElementById("app-section").classList.remove("hidden");
  loadInvoices();
}

function handleLogout(){
  currentUser=null;
  document.getElementById("login-form").reset();
  document.getElementById("login-section").classList.remove("hidden");
  document.getElementById("app-section").classList.add("hidden");
}

// ---- Přidání faktury ----
document.getElementById("invoice-form").addEventListener("submit", async ev=>{
  ev.preventDefault();
  if(!currentUser) return;
  const inv={
    number: document.getElementById("inv-number").value.trim(),
    client: document.getElementById("inv-client").value.trim(),
    amount: parseFloat(document.getElementById("inv-amount").value),
    issue_date: document.getElementById("inv-issue").value,
    due_date: document.getElementById("inv-due").value,
    status: document.getElementById("inv-status").value,
    owner: currentUser.username
  };
  await saveInvoice(inv);
  document.getElementById("invoice-form").reset();
});

// ---- Přepnutí statusu ----
document.getElementById("invoice-body").addEventListener("click", async ev=>{
  const btn = ev.target.closest(".toggle-status-btn");
  if(!btn) return;
  const index = parseInt(btn.dataset.index,10);
  const inv = getVisibleInvoices()[index];
  if(!inv) return;
  const newStatus = inv.status==="paid"?"unpaid":"paid";
  await supabase.from('invoices').update({status:newStatus})
    .eq('id',inv.id); // musíte mít id v tabulce invoices
  await loadInvoices();
});

// ---- Import CSV ----
document.getElementById("import-btn").addEventListener("click", ()=>{
  const file = document.getElementById("csv-file").files[0];
  if(!file){ alert("Vyber CSV soubor."); return; }
  const reader = new FileReader();
  reader.onload = async e=>{
    const lines = e.target.result.split(/\r?\n/).filter(l=>l.trim().length>0);
    let imported = 0;
    for(let i=1;i<lines.length;i++){
      const parts = lines[i].split(/[;,]/);
      if(parts.length<6) continue;
      const inv = {
        number: parts[0].trim(),
        client: parts[1].trim(),
        amount: parseFloat(parts[2].trim()),
        issue_date: parts[3].trim(),
        due_date: parts[4].trim(),
        status: parts[5].trim().toLowerCase()==="paid"?"paid":"unpaid",
        owner: (parts[6] && parts[6].trim()) || currentUser.username
      };
      await saveInvoice(inv);
      imported++;
    }
    document.getElementById("import-result").textContent=`Naimportováno faktur: ${imported}`;
  };
  reader.readAsText(file,"utf-8");
});

// ---- Inicializace ----
document.getElementById("login-form").addEventListener("submit",handleLogin);
document.getElementById("logout-btn").addEventListener("click",handleLogout);
